import asyncio
import json
import sqlite3
from pathlib import Path

import pytest
import httpx
from fastapi.testclient import TestClient

from app import app, get_bdg2_service
from src.bdg2_api import Bdg2DataService, DatabaseConfig, SupabaseRestRepository


ROOT = Path(__file__).resolve().parents[2]
BUNDLE = ROOT / "data/local/bdg2-cohort-v1"


class IsolatedImportedDatabase:
    """SQLite test database populated from the verified real BDG2 import bundle."""

    def __init__(self):
        self.db = sqlite3.connect(":memory:")
        self.db.row_factory = sqlite3.Row
        self.db.executescript("""
            create table data_sources (id text primary key, payload text not null);
            create table data_import_runs (id text primary key, data_source_id text not null, payload text not null);
            create table assets (id text primary key, data_source_id text not null, payload text not null);
            create table meters (id text primary key, data_source_id text not null, asset_id text not null, payload text not null);
            create table energy_readings (
                source_record_key text primary key,
                meter_id text not null,
                recorded_at text not null,
                payload text not null
            );
        """)
        source = self._json("data_source.json")
        manifest = self._json("manifest.json")
        run = {
            "id": manifest["import_run_id"],
            "data_source_id": manifest["data_source_id"],
            "cohort_code": manifest["cohort_code"],
            "status": "completed",
            "manifest_json": manifest,
            "completed_at": "2018-01-01T06:00:00Z",
        }
        self.db.execute("insert into data_sources values (?,?)", (source["id"], json.dumps(source)))
        self.db.execute(
            "insert into data_import_runs values (?,?,?)",
            (run["id"], run["data_source_id"], json.dumps(run)),
        )
        self.db.executemany(
            "insert into assets values (?,?,?)",
            [(row["id"], row["data_source_id"], json.dumps(row)) for row in self._json("assets.json")],
        )
        self.db.executemany(
            "insert into meters values (?,?,?,?)",
            [(row["id"], row["data_source_id"], row["asset_id"], json.dumps(row))
             for row in self._json("meters.json")],
        )
        with (BUNDLE / "readings.ndjson").open(encoding="utf-8") as stream:
            self.db.executemany(
                "insert into energy_readings values (?,?,?,?)",
                ((row["source_record_key"], row["meter_id"], row["recorded_at"], json.dumps(row))
                 for row in map(json.loads, stream)),
            )
        self.db.commit()

    @staticmethod
    def _json(name):
        return json.loads((BUNDLE / name).read_text(encoding="utf-8"))

    def _one(self, sql, params=()):
        row = self.db.execute(sql, params).fetchone()
        return json.loads(row["payload"]) if row else None

    def _many(self, sql, params=()):
        return [json.loads(row["payload"]) for row in self.db.execute(sql, params).fetchall()]

    async def get_source(self):
        return self._one("select payload from data_sources limit 1")

    async def get_completed_run(self, source_id):
        return self._one(
            "select payload from data_import_runs where data_source_id=? limit 1", (source_id,)
        )

    async def list_assets(self, source_id):
        return self._many("select payload from assets where data_source_id=? order by id", (source_id,))

    async def list_meters(self, source_id):
        return self._many("select payload from meters where data_source_id=? order by id", (source_id,))

    async def list_all_readings(self, meter_id):
        return self._many(
            "select payload from energy_readings where meter_id=? order by recorded_at", (meter_id,)
        )

    async def close(self):
        self.db.close()


@pytest.fixture(scope="module")
def database_service():
    repository = IsolatedImportedDatabase()
    service = Bdg2DataService(repository)
    asyncio.run(service.prepare())
    yield service
    asyncio.run(service.close())


@pytest.fixture()
def client(database_service):
    app.dependency_overrides[get_bdg2_service] = lambda: database_service
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


def test_assets_and_bounded_observed_readings_are_database_backed(client):
    assets = client.get("/assets?limit=2")
    assert assets.status_code == 200
    body = assets.json()
    assert body["count"] == 2
    assert body["limit"] == 2
    assert all(item["scope"] == "whole_building" for item in body["items"])
    assert all(item["provenance"]["kind"] == "public_benchmark" for item in body["items"])
    assert all(item["provenance"]["source_code"] == "bdg2_v1" for item in body["items"])

    asset_id = body["items"][0]["id"]
    readings = client.get(
        f"/assets/{asset_id}/readings",
        params={"from": "2016-01-01T06:00:00Z", "to": "2016-01-02T06:00:00Z", "limit": 24},
    )
    assert readings.status_code == 200
    payload = readings.json()
    assert payload["asset_id"] == asset_id
    assert payload["count"] == 24
    assert payload["unit"] == "kWh"
    assert payload["reading_semantics"] == "interval_sum"
    assert all(item["label"] == "observed" for item in payload["items"])
    assert all(item["timestamp"].endswith("Z") for item in payload["items"])


def test_forecast_contract_contains_24_labelled_values_and_evidence(client):
    asset_id = client.get("/assets?limit=1").json()["items"][0]["id"]
    response = client.get(f"/assets/{asset_id}/forecast")

    assert response.status_code == 200
    body = response.json()
    assert body["result_type"] == "forecast"
    assert body["horizon_hours"] == 24
    assert len(body["items"]) == 24
    assert all(item["label"] == "forecast" and item["unit"] == "kWh" for item in body["items"])
    assert body["method"]["model_version"] == "bdg2_seasonal_baseline_blend_v1"
    assert body["test_metrics"]["model"]["n"] > 0
    assert body["provenance"]["label"] == "Public benchmark data — Building Data Genome Project 2 v1.0"


def test_anomalies_are_only_unusual_patterns_without_cause_claims(client):
    assets = client.get("/assets").json()["items"]
    office = next(item for item in assets if item["source_asset_id"] == "Hog_office_Bill")
    response = client.get(f"/assets/{office['id']}/anomalies?limit=5")

    assert response.status_code == 200
    body = response.json()
    assert body["result_type"] == "detected"
    assert body["label"] == "unusual_consumption_pattern"
    assert body["count"] == 118
    assert len(body["items"]) == 5
    assert all(item["label"] == "unusual_consumption_pattern" for item in body["items"])
    assert all(item["cause"] is None for item in body["items"])


@pytest.mark.parametrize(
    "path",
    [
        "/assets?limit=0",
        "/assets?limit=101",
        "/assets/not-a-uuid/readings",
        "/assets/00000000-0000-4000-8000-000000000099/readings",
        "/assets/00000000-0000-4000-8000-000000000099/forecast",
    ],
)
def test_invalid_limits_and_asset_ids_do_not_return_data(client, path):
    response = client.get(path)
    assert response.status_code in {404, 422}


def test_date_ranges_must_be_complete_ordered_and_bounded(client):
    asset_id = client.get("/assets?limit=1").json()["items"][0]["id"]
    base = f"/assets/{asset_id}/readings"

    assert client.get(base, params={"from": "2016-01-01T00:00:00Z"}).status_code == 422
    assert client.get(base, params={
        "from": "2016-02-01T00:00:00Z", "to": "2016-01-01T00:00:00Z"
    }).status_code == 422
    assert client.get(base, params={
        "from": "2016-01-01T00:00:00Z", "to": "2016-03-01T00:00:00Z"
    }).status_code == 422
    assert client.get(base, params={
        "from": "2016-01-01T00:00:00", "to": "2016-01-02T00:00:00"
    }).status_code == 422


def test_database_secret_is_sent_only_by_the_server_transport():
    captured = {}

    async def handler(request):
        captured["authorization"] = request.headers.get("authorization")
        captured["apikey"] = request.headers.get("apikey")
        captured["path"] = request.url.path
        return httpx.Response(200, json=[])

    repository = SupabaseRestRepository(
        DatabaseConfig("https://project.example.supabase.co", "server-secret"),
        transport=httpx.MockTransport(handler),
    )
    assert asyncio.run(repository.get_source()) is None
    asyncio.run(repository.close())
    assert captured == {
        "authorization": "Bearer server-secret",
        "apikey": "server-secret",
        "path": "/rest/v1/data_sources",
    }
