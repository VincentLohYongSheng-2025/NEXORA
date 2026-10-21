"""Database access and read-only API service for the verified BDG2 cohort."""

from __future__ import annotations

import asyncio
import os
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Protocol
from uuid import UUID

import httpx

from src.bdg2_analytics import Point, evaluate_series, parse_utc, utc_text


SOURCE_CODE = "bdg2_v1"
PROVENANCE = "public_benchmark"


class DataUnavailable(RuntimeError):
    """Raised when database-backed data cannot be served safely."""


class AssetNotFound(LookupError):
    """Raised when an asset is outside the approved imported cohort."""


class Repository(Protocol):
    async def get_source(self) -> dict | None: ...
    async def get_completed_run(self, source_id: str) -> dict | None: ...
    async def list_assets(self, source_id: str) -> list[dict]: ...
    async def list_meters(self, source_id: str) -> list[dict]: ...
    async def list_all_readings(self, meter_id: str) -> list[dict]: ...
    async def close(self) -> None: ...


@dataclass(frozen=True)
class DatabaseConfig:
    url: str
    secret_key: str

    @classmethod
    def from_environment(cls) -> "DatabaseConfig | None":
        url = os.getenv("SUPABASE_URL", "").strip().rstrip("/")
        secret = os.getenv("SUPABASE_SECRET_KEY", "").strip()
        if not url and not secret:
            return None
        if not url or not secret or not url.startswith(("https://", "http://127.0.0.1", "http://localhost")):
            raise DataUnavailable("Database configuration is incomplete or invalid")
        return cls(url=url, secret_key=secret)


class SupabaseRestRepository:
    """Minimal server-side PostgREST reader; credentials never enter responses."""

    def __init__(self, config: DatabaseConfig, transport: httpx.AsyncBaseTransport | None = None):
        self._client = httpx.AsyncClient(
            base_url=f"{config.url}/rest/v1/",
            headers={
                "apikey": config.secret_key,
                "Authorization": f"Bearer {config.secret_key}",
                "Accept": "application/json",
            },
            timeout=20.0,
            transport=transport,
        )

    async def _select(self, table: str, params: dict[str, str]) -> list[dict]:
        try:
            response = await self._client.get(table, params=params)
            response.raise_for_status()
            payload = response.json()
        except (httpx.HTTPError, ValueError) as error:
            raise DataUnavailable("Database read failed") from error
        if not isinstance(payload, list):
            raise DataUnavailable("Database returned an invalid response")
        return payload

    async def get_source(self) -> dict | None:
        rows = await self._select("data_sources", {
            "select": "id,source_code,title,version,doi,licence_spdx,attribution_label,limitations_json",
            "source_code": f"eq.{SOURCE_CODE}",
            "limit": "1",
        })
        return rows[0] if rows else None

    async def get_completed_run(self, source_id: str) -> dict | None:
        rows = await self._select("data_import_runs", {
            "select": "id,cohort_code,status,manifest_json,completed_at",
            "data_source_id": f"eq.{source_id}",
            "status": "eq.completed",
            "limit": "1",
        })
        return rows[0] if rows else None

    async def list_assets(self, source_id: str) -> list[dict]:
        return await self._select("assets", {
            "select": "id,name,asset_type,floor_area_m2,timezone,data_status,source_asset_id,source_site_id,primary_space_usage,data_source_id,import_run_id",
            "data_source_id": f"eq.{source_id}",
            "data_status": f"eq.{PROVENANCE}",
            "order": "source_asset_id.asc",
            "limit": "100",
        })

    async def list_meters(self, source_id: str) -> list[dict]:
        return await self._select("meters", {
            "select": "id,asset_id,meter_role,source_kind,is_active,source_meter_id,unit,reading_semantics,data_source_id,import_run_id",
            "data_source_id": f"eq.{source_id}",
            "source_kind": f"eq.{PROVENANCE}",
            "is_active": "eq.true",
            "order": "source_meter_id.asc",
            "limit": "100",
        })

    async def list_all_readings(self, meter_id: str) -> list[dict]:
        rows: list[dict] = []
        page_size = 1000
        while True:
            page = await self._select("energy_readings", {
                "select": "meter_id,recorded_at,interval_minutes,consumption_kwh,provenance,source_local_timestamp,source_timezone,quality_status,data_source_id,import_run_id",
                "meter_id": f"eq.{meter_id}",
                "provenance": f"eq.{PROVENANCE}",
                "order": "recorded_at.asc",
                "limit": str(page_size),
                "offset": str(len(rows)),
            })
            rows.extend(page)
            if len(page) < page_size:
                return rows

    async def close(self) -> None:
        await self._client.aclose()


class Bdg2DataService:
    """Prepared read snapshot sourced exclusively from the imported database rows."""

    def __init__(self, repository: Repository):
        self._repository = repository
        self._ready = False
        self._source: dict = {}
        self._run: dict = {}
        self._assets: dict[str, dict] = {}
        self._meters_by_asset: dict[str, dict] = {}
        self._readings_by_asset: dict[str, list[dict]] = {}
        self._analytics: dict = {}

    async def prepare(self) -> None:
        source = await self._repository.get_source()
        if not source or source.get("source_code") != SOURCE_CODE:
            raise DataUnavailable("Verified BDG2 source is unavailable")
        run = await self._repository.get_completed_run(source["id"])
        if not run or run.get("status") != "completed":
            raise DataUnavailable("Verified BDG2 import is incomplete")
        assets, meters = await asyncio.gather(
            self._repository.list_assets(source["id"]),
            self._repository.list_meters(source["id"]),
        )
        if len(assets) != 4 or len(meters) != 4:
            raise DataUnavailable("Imported BDG2 cohort does not match the validated bounds")
        assets_by_id = {str(row["id"]): row for row in assets}
        meters_by_asset = {str(row["asset_id"]): row for row in meters}
        if set(assets_by_id) != set(meters_by_asset):
            raise DataUnavailable("Each approved asset must have one whole-building meter")

        reading_groups = await asyncio.gather(*(
            self._repository.list_all_readings(str(meter["id"])) for meter in meters
        ))
        manifest = run.get("manifest_json")
        if not isinstance(manifest, dict) or manifest.get("source_code") != SOURCE_CODE:
            raise DataUnavailable("Stored import manifest is invalid")
        if manifest.get("data_source_id") != source["id"] or manifest.get("import_run_id") != run["id"]:
            raise DataUnavailable("Stored import lineage does not match database rows")

        series: dict[str, list[Point]] = {}
        meter_names: dict[str, str] = {}
        readings_by_asset: dict[str, list[dict]] = {}
        accepted = 0
        for meter, readings in zip(meters, reading_groups, strict=True):
            meter_id = str(meter["id"])
            asset_id = str(meter["asset_id"])
            points = []
            cleaned = []
            for row in readings:
                if (
                    row.get("provenance") != PROVENANCE
                    or str(row.get("data_source_id")) != source["id"]
                    or str(row.get("import_run_id")) != run["id"]
                    or row.get("quality_status") not in {"observed", "observed_zero"}
                    or int(row.get("interval_minutes", 0)) != 60
                ):
                    raise DataUnavailable("Reading lineage or semantics are invalid")
                timestamp = parse_utc(str(row["recorded_at"]))
                value = float(row["consumption_kwh"])
                points.append(Point(timestamp, value))
                cleaned.append({**row, "recorded_at": utc_text(timestamp), "consumption_kwh": value})
            points.sort(key=lambda point: point.timestamp)
            cleaned.sort(key=lambda row: row["recorded_at"])
            series[meter_id] = points
            meter_names[meter_id] = meter["source_meter_id"]
            readings_by_asset[asset_id] = cleaned
            accepted += len(readings)
        if accepted != manifest.get("counts", {}).get("accepted"):
            raise DataUnavailable("Database reading count differs from the import manifest")

        try:
            analytics = evaluate_series(manifest, meter_names, series)
        except ValueError as error:
            raise DataUnavailable("Database readings failed analytics validation") from error
        self._source = source
        self._run = run
        self._assets = assets_by_id
        self._meters_by_asset = meters_by_asset
        self._readings_by_asset = readings_by_asset
        self._analytics = analytics
        self._ready = True

    def _require_asset(self, asset_id: UUID | str) -> tuple[str, dict, dict]:
        if not self._ready:
            raise DataUnavailable("Database-backed BDG2 data is unavailable")
        key = str(asset_id)
        asset = self._assets.get(key)
        if asset is None:
            raise AssetNotFound(key)
        return key, asset, self._meters_by_asset[key]

    def provenance(self) -> dict:
        return {
            "kind": PROVENANCE,
            "source_code": self._source["source_code"],
            "source_title": self._source["title"],
            "source_version": self._source["version"],
            "doi": self._source["doi"],
            "licence": self._source["licence_spdx"],
            "label": self._source["attribution_label"],
            "cohort_code": self._run["cohort_code"],
        }

    def list_assets(self, limit: int) -> dict:
        if not self._ready:
            raise DataUnavailable("Database-backed BDG2 data is unavailable")
        items = []
        for asset in sorted(self._assets.values(), key=lambda row: row["source_asset_id"])[:limit]:
            meter = self._meters_by_asset[str(asset["id"])]
            items.append({
                "id": str(asset["id"]),
                "name": asset["name"],
                "asset_type": asset["asset_type"],
                "timezone": asset["timezone"],
                "floor_area_m2": asset.get("floor_area_m2"),
                "scope": "whole_building",
                "source_asset_id": asset["source_asset_id"],
                "primary_space_usage": asset["primary_space_usage"],
                "meter": {
                    "id": str(meter["id"]),
                    "source_meter_id": meter["source_meter_id"],
                    "role": meter["meter_role"],
                    "unit": meter["unit"],
                    "reading_semantics": meter["reading_semantics"],
                },
                "provenance": self.provenance(),
            })
        return {"items": items, "count": len(items), "limit": limit}

    def readings(
        self, asset_id: UUID, start: datetime | None, end: datetime | None, limit: int
    ) -> dict:
        key, _asset, meter = self._require_asset(asset_id)
        rows = self._readings_by_asset[key]
        filtered = [row for row in rows if (start is None or parse_utc(row["recorded_at"]) >= start)
                    and (end is None or parse_utc(row["recorded_at"]) < end)]
        if start is None:
            filtered = filtered[-limit:]
        else:
            filtered = filtered[:limit]
        items = [{
            "timestamp": row["recorded_at"],
            "consumption_kwh": row["consumption_kwh"],
            "interval_minutes": row["interval_minutes"],
            "label": "observed",
            "quality_status": row["quality_status"],
            "source_local_timestamp": row["source_local_timestamp"],
            "source_timezone": row["source_timezone"],
        } for row in filtered]
        return {
            "asset_id": key,
            "meter_id": str(meter["id"]),
            "meter_source_id": meter["source_meter_id"],
            "unit": meter["unit"],
            "reading_semantics": meter["reading_semantics"],
            "provenance": self.provenance(),
            "count": len(items),
            "limit": limit,
            "items": items,
        }

    def forecast(self, asset_id: UUID) -> dict:
        key, _asset, meter = self._require_asset(asset_id)
        source_meter_id = meter["source_meter_id"]
        items = [
            {**row, "label": "forecast", "unit": "kWh"}
            for row in self._analytics["next_24h_forecasts"]
            if row["meter_source_id"] == source_meter_id
        ]
        evidence = self._analytics["per_meter"][source_meter_id]
        return {
            "asset_id": key,
            "meter_id": str(meter["id"]),
            "meter_source_id": source_meter_id,
            "result_type": "forecast",
            "unit": "kWh",
            "horizon_hours": 24,
            "provenance": self.provenance(),
            "method": self._analytics["method"],
            "split": self._analytics["split"],
            "test_metrics": {
                "model": evidence["test_model"],
                "baseline": evidence["test_baseline"],
            },
            "limitations": self._analytics["limitations"],
            "items": items,
        }

    def anomalies(
        self, asset_id: UUID, start: datetime | None, end: datetime | None, limit: int
    ) -> dict:
        key, _asset, meter = self._require_asset(asset_id)
        source_meter_id = meter["source_meter_id"]
        matching = []
        for row in self._analytics["test_anomalies"]:
            timestamp = parse_utc(row["timestamp"])
            if row["meter_source_id"] != source_meter_id:
                continue
            if start is not None and timestamp < start:
                continue
            if end is not None and timestamp >= end:
                continue
            matching.append({**row, "unit": "kWh"})
        evidence = self._analytics["per_meter"][source_meter_id]
        return {
            "asset_id": key,
            "meter_id": str(meter["id"]),
            "meter_source_id": source_meter_id,
            "result_type": "detected",
            "label": "unusual_consumption_pattern",
            "unit": "kWh",
            "provenance": self.provenance(),
            "rule": {
                "version": self._analytics["method"]["anomaly_rule_version"],
                "description": self._analytics["method"]["anomaly_rule_description"],
                **evidence["anomaly_rule"],
            },
            "count": len(matching),
            "limit": limit,
            "items": matching[:limit],
            "limitations": self._analytics["limitations"],
        }

    async def close(self) -> None:
        await self._repository.close()


def as_utc(value: datetime) -> datetime:
    if value.tzinfo is None or value.utcoffset() is None:
        raise ValueError("Timestamp must include a timezone offset")
    return value.astimezone(timezone.utc)
