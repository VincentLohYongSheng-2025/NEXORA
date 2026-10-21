"""Additive read-only demo routes; only fixed public BDG2 API reads, no DB writes."""
from __future__ import annotations
import asyncio
from datetime import datetime, timezone
from typing import Annotated, Literal
from urllib.parse import parse_qs, urlencode, urlsplit
from uuid import UUID
from zoneinfo import ZoneInfo
import httpx
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi import Query
from src.history_aggregation import aggregate_observed, calendar_periods, calendar_query_windows
from src.demo_scenarios import (
    EnergyInputs,
    SolarGridDispatchInputs,
    ShiftInputs,
    ImpactInputs,
    InvestmentComparisonInputs,
    energy_scenario,
    solar_grid_dispatch,
    peak_shift,
    impact_estimate,
    investment_comparison,
)
from src.scenario_profile import build_scenario_profile

router = APIRouter(prefix="/demo", tags=["Labelled demo calculations"])
PUBLIC_API = "https://energios-backend.vercel.app"

class DemoReader:
    def __init__(self, service=None):
        self.service = service

    async def read(self, path: str) -> dict:
        if self.service is not None:
            parsed = urlsplit(path)
            query = parse_qs(parsed.query)
            if parsed.path == "/assets":
                return self.service.list_assets(100)
            _, _, asset_id, kind = parsed.path.split("/")
            if kind.startswith("anomalies"):
                return self.service.anomalies(UUID(asset_id), None, None, int(query.get("limit", [10])[0]))
            if kind == "forecast":
                return self.service.forecast(UUID(asset_id))
            start = query.get("from", [None])[0]
            end = query.get("to", [None])[0]
            parse_stamp = lambda value: datetime.fromisoformat(value.replace("Z", "+00:00")).astimezone(timezone.utc) if value else None
            return self.service.readings(
                UUID(asset_id), parse_stamp(start), parse_stamp(end), int(query.get("limit", [24])[0])
            )
        # Local integration can read the already-public backend without copying credentials.
        # No user-controlled host, credentials, redirects, database access or substitute data.
        try:
            async with httpx.AsyncClient(timeout=35, follow_redirects=False) as client:
                response = await client.get(PUBLIC_API+path, headers={"Accept": "application/json"})
            if response.status_code == 404:
                raise HTTPException(404, "Asset not found")
            response.raise_for_status()
            payload = response.json()
            if not isinstance(payload, dict):
                raise ValueError("Invalid public API response")
            return payload
        except (httpx.HTTPError, ValueError) as error:
            raise HTTPException(503, "Public BDG2 backend is unavailable; no substitute data was used") from error

    async def asset(self, asset_id: UUID) -> dict:
        assets = await self.read("/assets")
        for asset in assets.get("items", []):
            if asset["id"] == str(asset_id) and asset.get("provenance", {}).get("source_code") == "bdg2_v1":
                return asset
        raise HTTPException(404, "Asset not found in the approved BDG2 cohort")


def get_demo_reader(request: Request) -> DemoReader:
    return DemoReader(getattr(request.app.state, "bdg2_service", None))

Reader = Annotated[DemoReader, Depends(get_demo_reader)]

@router.get("/scenario-profile/{asset_id}", response_model=dict)
async def scenario_profile(asset_id: UUID, reader: Reader):
    """Return versioned, read-only, user-editable demonstration defaults."""
    asset = await reader.asset(asset_id)
    return build_scenario_profile(asset)

@router.post("/energy-scenario", response_model=dict)
async def simulate_energy(inputs: EnergyInputs, reader: Reader):
    asset = await reader.asset(inputs.asset_id)
    forecast = await reader.read(f"/assets/{inputs.asset_id}/forecast")
    try:
        return energy_scenario(forecast, asset, inputs)
    except (ValueError, KeyError) as error:
        raise HTTPException(422, "A valid complete hourly BDG2 forecast is required") from error


@router.post("/solar-grid-dispatch", response_model=dict)
async def recommend_solar_grid_dispatch(inputs: SolarGridDispatchInputs, reader: Reader):
    """Return a read-only simulated dispatch recommendation from the ML demand forecast."""
    asset = await reader.asset(inputs.asset_id)
    forecast = await reader.read(f"/assets/{inputs.asset_id}/forecast")
    try:
        return solar_grid_dispatch(forecast, asset, inputs)
    except (ValueError, KeyError) as error:
        raise HTTPException(422, "A valid complete hourly BDG2 forecast is required") from error

@router.post("/peak-shift", response_model=dict)
async def simulate_shift(inputs: ShiftInputs, reader: Reader):
    await reader.asset(inputs.asset_id)
    forecast = await reader.read(f"/assets/{inputs.asset_id}/forecast")
    try:
        return peak_shift(forecast, inputs)
    except ValueError as error:
        raise HTTPException(422, str(error)) from error

@router.post("/impact", response_model=dict)
async def estimate_impact(inputs: ImpactInputs, reader: Reader):
    await reader.asset(inputs.asset_id)
    kind = "forecast" if inputs.basis == "forecast" else "readings?limit=24"
    data = await reader.read(f"/assets/{inputs.asset_id}/{kind}")
    return impact_estimate(data, inputs)


@router.post("/investment-comparison", response_model=dict)
async def compare_investments(inputs: InvestmentComparisonInputs, reader: Reader):
    asset = await reader.asset(inputs.asset_id)
    return investment_comparison(asset, inputs)

@router.get("/portfolio", response_model=dict)
async def portfolio(reader: Reader):
    assets = (await reader.read("/assets")).get("items", [])
    if not assets:
        return dict(label="derived", items=[], count=0, common_interval_count=0, total_kwh=None)
    if len(assets) > 4:
        raise HTTPException(503, "Public cohort exceeds the approved four-building bound")
    responses = await asyncio.gather(*(reader.read(f"/assets/{a['id']}/readings?limit=24") for a in assets))
    maps = [{row["timestamp"]: row for row in response["items"]} for response in responses]
    common = sorted(set.intersection(*(set(m) for m in maps)))
    curves = [dict(timestamp=t, total_kwh=sum(m[t]["consumption_kwh"] for m in maps)) for t in common]
    item_rows = []
    for asset, response, rows in zip(assets, responses, maps):
        values = [rows[t]["consumption_kwh"] for t in common]
        zone = ZoneInfo(asset["timezone"])
        overnight = [
            rows[t]["consumption_kwh"] for t in common
            if datetime.fromisoformat(t.replace("Z", "+00:00")).astimezone(zone).hour < 6
        ]
        total = sum(values) if values else None
        area = asset.get("floor_area_m2")
        item_rows.append(dict(
            asset=asset,
            observations=response["items"],
            common_energy_kwh=total,
            mean_interval_average_kw=sum(values) / len(values) if values else None,
            peak_interval_average_kw=max(values) if values else None,
            energy_intensity_kwh_per_m2=total / area if total is not None and area else None,
            overnight_window="00:00–05:59 source-local time",
            overnight_interval_count=len(overnight),
            overnight_energy_kwh=sum(overnight),
            overnight_share_percent=(sum(overnight) / total * 100) if total else None,
            overnight_investigation_candidate=False,
            provenance=response["provenance"],
        ))
    candidates = [item for item in item_rows if item["overnight_share_percent"] is not None]
    if candidates:
        highest = max(candidates, key=lambda item: item["overnight_share_percent"])
        highest["overnight_investigation_candidate"] = True
    return dict(label="derived", unit="kWh", demand_unit="kW_interval_average", count=len(assets),
                common_interval_count=len(common), total_kwh=sum(r["total_kwh"] for r in curves) if curves else None,
                latest_interval_average_kw=curves[-1]["total_kwh"] if curves else None,
                common_start=common[0] if common else None, common_end=common[-1] if common else None,
                items=item_rows, aligned_curve=curves,
                limitations=["Benchmark comparison, not a measured township or electrical network.",
                             "Only shared returned timestamps are aggregated; missing intervals stay absent.",
                             "Area-based intensity is descriptive only; different uses, schedules and weather prevent an efficiency ranking.",
                             "The highest overnight share is only a candidate for investigation; no operating schedule or ghost-load cause is available."])


@router.get("/assets/{asset_id}/history", response_model=dict)
async def observed_history(
    asset_id: UUID,
    reader: Reader,
    granularity: Literal["daily", "monthly"] = "daily",
    periods: Annotated[int, Query(ge=1, le=31)] = 31,
):
    maximum = 31 if granularity == "daily" else 12
    if periods > maximum:
        raise HTTPException(422, f"{granularity} periods cannot exceed {maximum}")
    asset = await reader.asset(asset_id)
    latest = await reader.read(f"/assets/{asset_id}/readings?limit=1")
    if not latest.get("items"):
        raise HTTPException(503, "No observed BDG2 readings are available for calendar aggregation")
    try:
        buckets = calendar_periods(latest["items"][-1]["timestamp"], asset["timezone"], granularity, periods)
        windows = calendar_query_windows(buckets)
    except (KeyError, TypeError, ValueError) as error:
        raise HTTPException(503, "Observed BDG2 calendar metadata is invalid") from error

    semaphore = asyncio.Semaphore(4)
    async def fetch_window(start: datetime, end: datetime) -> dict:
        query = urlencode({
            "limit": 1000,
            "from": start.isoformat().replace("+00:00", "Z"),
            "to": end.isoformat().replace("+00:00", "Z"),
        })
        async with semaphore:
            return await reader.read(f"/assets/{asset_id}/readings?{query}")

    responses = await asyncio.gather(*(fetch_window(start, end) for start, end in windows))
    rows = [row for response in responses for row in response.get("items", [])]
    try:
        items = aggregate_observed(rows, buckets)
    except (KeyError, TypeError, ValueError) as error:
        raise HTTPException(503, "Observed BDG2 readings could not be aggregated safely") from error
    complete_count = sum(item["complete"] for item in items)
    interval_count = sum(item["observed_interval_count"] for item in items)
    expected_count = sum(item["expected_interval_count"] for item in items)
    return {
        "asset_id": str(asset_id),
        "result_type": "observed_aggregate",
        "granularity": granularity,
        "label": "observed",
        "unit": "kWh",
        "source_timezone": asset["timezone"],
        "period_count": len(items),
        "complete_period_count": complete_count,
        "observed_interval_count": interval_count,
        "expected_interval_count": expected_count,
        "range": {
            "from_local": buckets[0].start_local.isoformat(),
            "to_local_exclusive": buckets[-1].end_local.isoformat(),
            "from_utc": buckets[0].start_utc.isoformat().replace("+00:00", "Z"),
            "to_utc_exclusive": buckets[-1].end_utc.isoformat().replace("+00:00", "Z"),
            "latest_observed_timestamp": latest["items"][-1]["timestamp"],
        },
        "provenance": latest["provenance"],
        "items": items,
        "limitations": [
            "Observed BDG2 public benchmark interval kWh aggregated by source-local calendar boundaries.",
            "Incomplete periods expose observed partial sums and coverage; complete totals remain null when intervals are missing.",
            "Missing readings are never filled or estimated. This is not Sime Darby or Elmina telemetry.",
        ],
    }
