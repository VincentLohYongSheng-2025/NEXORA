"""EnergiOS health and read-only BDG2 public-benchmark API."""

from __future__ import annotations

from contextlib import asynccontextmanager
from datetime import datetime, timedelta
from typing import Annotated, Literal
from uuid import UUID

from fastapi import Depends, FastAPI, HTTPException, Query, Request
from pydantic import BaseModel, Field

from src.bdg2_api import (
    AssetNotFound,
    Bdg2DataService,
    DataUnavailable,
    DatabaseConfig,
    SupabaseRestRepository,
    as_utc,
)


READING_RANGE_DAYS = 31
ANOMALY_RANGE_DAYS = 366


class HealthResponse(BaseModel):
    status: Literal["ok"] = "ok"
    version: Literal["1"] = "1"


class ProvenanceResponse(BaseModel):
    kind: Literal["public_benchmark"]
    source_code: Literal["bdg2_v1"]
    source_title: str
    source_version: str
    doi: str
    licence: str
    label: str
    cohort_code: str


class MeterResponse(BaseModel):
    id: UUID
    source_meter_id: str
    role: Literal["building_total"]
    unit: Literal["kWh"]
    reading_semantics: Literal["interval_sum"]


class AssetResponse(BaseModel):
    id: UUID
    name: str
    asset_type: str
    timezone: str
    floor_area_m2: float | None
    scope: Literal["whole_building"]
    source_asset_id: str
    primary_space_usage: str
    meter: MeterResponse
    provenance: ProvenanceResponse


class AssetListResponse(BaseModel):
    items: list[AssetResponse]
    count: int
    limit: int


class ReadingResponse(BaseModel):
    timestamp: datetime
    consumption_kwh: float = Field(ge=0)
    interval_minutes: Literal[60]
    label: Literal["observed"]
    quality_status: Literal["observed", "observed_zero"]
    source_local_timestamp: datetime
    source_timezone: str


class ReadingListResponse(BaseModel):
    asset_id: UUID
    meter_id: UUID
    meter_source_id: str
    unit: Literal["kWh"]
    reading_semantics: Literal["interval_sum"]
    provenance: ProvenanceResponse
    count: int
    limit: int
    items: list[ReadingResponse]


class MetricResponse(BaseModel):
    n: int = Field(gt=0)
    mae_kwh: float = Field(ge=0)
    rmse_kwh: float = Field(ge=0)


class ForecastItemResponse(BaseModel):
    meter_source_id: str
    timestamp: datetime
    forecast_kwh: float = Field(ge=0)
    label: Literal["forecast"]
    unit: Literal["kWh"]


class ForecastResponse(BaseModel):
    asset_id: UUID
    meter_id: UUID
    meter_source_id: str
    result_type: Literal["forecast"]
    unit: Literal["kWh"]
    horizon_hours: Literal[24]
    provenance: ProvenanceResponse
    method: dict
    split: dict
    test_metrics: dict[str, MetricResponse]
    limitations: list[str]
    items: list[ForecastItemResponse]


class AnomalyItemResponse(BaseModel):
    id: str
    meter_source_id: str
    timestamp: datetime
    label: Literal["unusual_consumption_pattern"]
    direction: Literal["above_expected", "below_expected"]
    observed_kwh: float = Field(ge=0)
    forecast_kwh: float = Field(ge=0)
    residual_kwh: float
    absolute_centered_residual_kwh: float = Field(ge=0)
    threshold_kwh: float = Field(gt=0)
    cause: None
    unit: Literal["kWh"]


class AnomalyListResponse(BaseModel):
    asset_id: UUID
    meter_id: UUID
    meter_source_id: str
    result_type: Literal["detected"]
    label: Literal["unusual_consumption_pattern"]
    unit: Literal["kWh"]
    provenance: ProvenanceResponse
    rule: dict
    count: int
    limit: int
    items: list[AnomalyItemResponse]
    limitations: list[str]


@asynccontextmanager
async def lifespan(application: FastAPI):
    application.state.bdg2_service = None
    application.state.bdg2_error = None
    service = None
    try:
        config = DatabaseConfig.from_environment()
        if config is not None:
            service = Bdg2DataService(SupabaseRestRepository(config))
            await service.prepare()
            application.state.bdg2_service = service
    except DataUnavailable as error:
        application.state.bdg2_error = str(error)
    yield
    if service is not None:
        await service.close()


app = FastAPI(
    title="EnergiOS API",
    version="1",
    description=(
        "Built: health plus read-only Building Data Genome Project 2 v1.0 "
        "public-benchmark assets, readings, forecasts, and unusual-pattern detections. "
        "This is not Sime Darby or Elmina Lakeside Mall data."
    ),
    redoc_url=None,
    lifespan=lifespan,
)


@app.get("/health", response_model=HealthResponse, tags=["Operations"])
async def health() -> HealthResponse:
    """Report application liveness only; this does not check a database."""
    return HealthResponse()


def get_bdg2_service(request: Request) -> Bdg2DataService:
    service = getattr(request.app.state, "bdg2_service", None)
    if service is None:
        raise HTTPException(status_code=503, detail="Database-backed BDG2 data is unavailable")
    return service


def checked_range(
    start: datetime | None, end: datetime | None, maximum_days: int
) -> tuple[datetime | None, datetime | None]:
    if (start is None) != (end is None):
        raise HTTPException(status_code=422, detail="from and to must be supplied together")
    if start is None:
        return None, None
    try:
        start_utc, end_utc = as_utc(start), as_utc(end)
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    if end_utc <= start_utc:
        raise HTTPException(status_code=422, detail="to must be later than from")
    if end_utc - start_utc > timedelta(days=maximum_days):
        raise HTTPException(status_code=422, detail=f"date range cannot exceed {maximum_days} days")
    return start_utc, end_utc


def not_found_or_unavailable(error: Exception) -> HTTPException:
    if isinstance(error, AssetNotFound):
        return HTTPException(status_code=404, detail="Asset not found")
    return HTTPException(status_code=503, detail="Database-backed BDG2 data is unavailable")


ServiceDependency = Annotated[Bdg2DataService, Depends(get_bdg2_service)]


@app.get("/assets", response_model=AssetListResponse, tags=["BDG2 public benchmark"])
async def assets(
    service: ServiceDependency,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
) -> dict:
    """List source-backed whole-building assets in the verified BDG2 cohort."""
    try:
        return service.list_assets(limit)
    except (AssetNotFound, DataUnavailable) as error:
        raise not_found_or_unavailable(error) from error


@app.get(
    "/assets/{asset_id}/readings",
    response_model=ReadingListResponse,
    tags=["BDG2 public benchmark"],
)
async def asset_readings(
    asset_id: UUID,
    service: ServiceDependency,
    from_: Annotated[datetime | None, Query(alias="from")] = None,
    to: Annotated[datetime | None, Query()] = None,
    limit: Annotated[int, Query(ge=1, le=1000)] = 168,
) -> dict:
    """Return bounded observed interval-kWh readings; missing intervals stay absent."""
    start, end = checked_range(from_, to, READING_RANGE_DAYS)
    try:
        return service.readings(asset_id, start, end, limit)
    except (AssetNotFound, DataUnavailable) as error:
        raise not_found_or_unavailable(error) from error


@app.get(
    "/assets/{asset_id}/forecast",
    response_model=ForecastResponse,
    tags=["BDG2 public benchmark"],
)
async def asset_forecast(asset_id: UUID, service: ServiceDependency) -> dict:
    """Return the validated next-24-hour forecast and held-out evidence."""
    try:
        return service.forecast(asset_id)
    except (AssetNotFound, DataUnavailable) as error:
        raise not_found_or_unavailable(error) from error


@app.get(
    "/assets/{asset_id}/anomalies",
    response_model=AnomalyListResponse,
    tags=["BDG2 public benchmark"],
)
async def asset_anomalies(
    asset_id: UUID,
    service: ServiceDependency,
    from_: Annotated[datetime | None, Query(alias="from")] = None,
    to: Annotated[datetime | None, Query()] = None,
    limit: Annotated[int, Query(ge=1, le=500)] = 100,
) -> dict:
    """Return statistical unusual-consumption patterns without cause claims."""
    start, end = checked_range(from_, to, ANOMALY_RANGE_DAYS)
    try:
        return service.anomalies(asset_id, start, end, limit)
    except (AssetNotFound, DataUnavailable) as error:
        raise not_found_or_unavailable(error) from error



# Additive, stateless demo calculations; existing route contracts remain unchanged.
from src.demo_routes import router as demo_router
app.include_router(demo_router)

from src.gemini_assistant import router as assistant_router
app.include_router(assistant_router)

from src.workbench import router as workbench_router
app.include_router(workbench_router)
app.include_router(workbench_router, prefix="/api")

# Serve the local workbench without requiring a frontend package install.
# Mounted last so all API routes keep their existing contracts.
from pathlib import Path
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

FRONTEND_DIRECTORY = Path(__file__).resolve().parents[1] / "frontend"
app.mount("/src", StaticFiles(directory=FRONTEND_DIRECTORY / "src"), name="workbench-source")
app.mount("/assets", StaticFiles(directory=FRONTEND_DIRECTORY / "assets"), name="workbench-assets")


@app.get("/", include_in_schema=False)
def workbench_page():
    return FileResponse(FRONTEND_DIRECTORY / "index.html")


@app.get("/{page}.html", include_in_schema=False)
def workbench_legacy_page(page: str):
    if page not in {"index", "diagnostics", "energy", "digital-twin", "settings", "methodology", "qa", "qa-audit"}:
        raise HTTPException(status_code=404, detail="Not Found")
    return FileResponse(FRONTEND_DIRECTORY / f"{page}.html")
