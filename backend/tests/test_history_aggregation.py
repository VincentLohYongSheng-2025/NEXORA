"""Focused source-local observed-history aggregation tests."""
from datetime import datetime, timedelta
from urllib.parse import parse_qs, urlsplit

import pytest
from fastapi.testclient import TestClient

from app import app
from src.demo_routes import DemoReader, get_demo_reader
from src.history_aggregation import aggregate_observed, calendar_periods, calendar_query_windows


ASSET_ID = "00000000-0000-4000-8000-000000000001"
PROVENANCE = {"source_code": "bdg2_v1", "kind": "public_benchmark"}


def readings_for(period, missing_index=None):
    rows = []
    stamp = period.start_utc
    index = 0
    while stamp < period.end_utc:
        if index != missing_index:
            rows.append({
                "timestamp": stamp.isoformat(),
                "consumption_kwh": 1.5,
                "interval_minutes": 60,
                "label": "observed",
            })
        stamp += timedelta(hours=1)
        index += 1
    return rows


def test_daily_periods_follow_source_timezone_dst_boundaries():
    spring = calendar_periods("2024-03-11T04:00:00Z", "US/Central", "daily", 2)
    assert [period.key for period in spring] == ["2024-03-09", "2024-03-10"]
    assert [period.expected_interval_count for period in spring] == [24, 23]

    fall = calendar_periods("2024-11-04T05:00:00Z", "US/Central", "daily", 1)
    assert fall[0].key == "2024-11-03"
    assert fall[0].expected_interval_count == 25


def test_monthly_period_uses_local_calendar_and_dst_duration():
    march = calendar_periods("2024-04-01T04:00:00Z", "US/Central", "monthly", 1)
    assert march[0].key == "2024-03"
    assert march[0].expected_interval_count == 743
    assert calendar_query_windows(march) == [(march[0].start_utc, march[0].end_utc)]


def test_missing_intervals_remain_partial_and_empty_periods_remain_missing():
    periods = calendar_periods("2024-01-03T05:00:00Z", "US/Central", "daily", 2)
    items = aggregate_observed(readings_for(periods[0], missing_index=7), periods)
    assert items[0]["observed_interval_count"] == 23
    assert items[0]["missing_interval_count"] == 1
    assert items[0]["observed_sum_kwh"] == pytest.approx(34.5)
    assert items[0]["complete_total_kwh"] is None
    assert items[0]["complete"] is False
    assert items[1]["observed_interval_count"] == 0
    assert items[1]["observed_sum_kwh"] is None
    assert items[1]["complete_total_kwh"] is None


class HistoryReader(DemoReader):
    def __init__(self):
        super().__init__()
        self.paths = []

    async def read(self, path):
        self.paths.append(path)
        if path == "/assets":
            return {"items": [{
                "id": ASSET_ID,
                "source_asset_id": "Hog_test",
                "timezone": "US/Central",
                "provenance": PROVENANCE,
            }]}
        parsed = urlsplit(path)
        query = parse_qs(parsed.query)
        if query.get("limit") == ["1"]:
            return {"items": [{"timestamp": "2018-01-01T05:00:00Z"}], "provenance": PROVENANCE}
        start = datetime.fromisoformat(query["from"][0].replace("Z", "+00:00"))
        end = datetime.fromisoformat(query["to"][0].replace("Z", "+00:00"))
        assert end - start <= timedelta(days=31)
        rows = []
        stamp = start
        while stamp < end:
            rows.append({
                "timestamp": stamp.isoformat(),
                "consumption_kwh": 2.0,
                "interval_minutes": 60,
                "label": "observed",
            })
            stamp += timedelta(hours=1)
        return {"items": rows, "provenance": PROVENANCE}


@pytest.fixture()
def history_client():
    reader = HistoryReader()
    app.dependency_overrides[get_demo_reader] = lambda: reader
    with TestClient(app) as client:
        yield client, reader
    app.dependency_overrides.clear()


def test_history_route_is_bounded_and_returns_complete_daily_and_monthly_totals(history_client):
    client, reader = history_client
    daily = client.get(f"/demo/assets/{ASSET_ID}/history", params={"granularity": "daily", "periods": 2})
    assert daily.status_code == 200
    assert daily.json()["period_count"] == 2
    assert daily.json()["complete_period_count"] == 2
    assert all(item["label"] == "observed" and item["complete"] for item in daily.json()["items"])

    monthly = client.get(f"/demo/assets/{ASSET_ID}/history", params={"granularity": "monthly", "periods": 2})
    assert monthly.status_code == 200
    body = monthly.json()
    assert [item["period"] for item in body["items"]] == ["2017-11", "2017-12"]
    assert [item["expected_interval_count"] for item in body["items"]] == [721, 744]
    assert body["observed_interval_count"] == 1465
    ranged = [path for path in reader.paths if "from=" in path]
    assert ranged and all("limit=1000" in path for path in ranged)


@pytest.mark.parametrize("params", [
    {"granularity": "daily", "periods": 0},
    {"granularity": "daily", "periods": 32},
    {"granularity": "monthly", "periods": 13},
    {"granularity": "weekly", "periods": 2},
])
def test_history_route_rejects_unbounded_or_unknown_requests(history_client, params):
    client, _ = history_client
    assert client.get(f"/demo/assets/{ASSET_ID}/history", params=params).status_code == 422
