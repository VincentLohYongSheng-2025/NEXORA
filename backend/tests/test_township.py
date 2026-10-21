"""Township scope totals, demo provenance and independent facility state."""
from copy import deepcopy

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from src.workbench import (
    ASSETS, FACILITY_ASSETS, SESSION, SNAPSHOT, ActionRequest, _session,
    _state, decide, router, township,
)


@pytest.fixture(autouse=True)
def clean_session():
    SESSION.clear()
    yield
    SESSION.clear()


@pytest.mark.parametrize("period", ["day", "week"])
def test_total_is_sum_of_all_six_profiles_for_same_period(period):
    original = deepcopy(SNAPSHOT)
    total = township(period)
    assert total["facility_count"] == 6
    assert len(ASSETS) == 4
    energy = []
    for item in total["items"]:
        detail = _state(item["asset"]["id"], period)
        assert detail["metrics"] == item["metrics"]
        assert detail["asset"]["provenance"]["kind"] == "simulated_demonstration_assumption"
        assert all(r["quality_status"] == "demo_estimate" for r in detail["observed"])
        energy.append(detail["metrics"]["observed_energy_kwh"])
        assert detail["observed_window"] == total["observed_window"]
    assert len(set(energy)) == 6
    for key, value in total["metrics"].items():
        assert value == pytest.approx(sum(item["metrics"][key] for item in total["items"]))
    assert sum(row["consumption_kwh"] for row in total["observed"]) == pytest.approx(sum(energy))
    assert SNAPSHOT == original


def test_periods_configurations_and_approved_plans_stay_separate():
    keys = list(FACILITY_ASSETS)
    baseline = township("day")
    assert township("week")["metrics"]["observed_energy_kwh"] > baseline["metrics"]["observed_energy_kwh"]
    neighbour = deepcopy(_state(keys[1], "day"))
    _session(keys[0])["config"]["tariff_myr_per_kwh"] = .8
    after = township("day")
    energy = baseline["items"][0]["metrics"]["observed_energy_kwh"]
    assert after["metrics"]["observed_cost_estimate_myr"] - baseline["metrics"]["observed_cost_estimate_myr"] == pytest.approx(energy * .3)
    assert after["metrics"]["observed_energy_kwh"] == baseline["metrics"]["observed_energy_kwh"]
    decide("solar", "approve", ActionRequest(asset_id=keys[0]))
    approved = township("day")["metrics"]["projected_grid_avoided_kwh"]
    assert approved > 0
    decide("shift", "dismiss", ActionRequest(asset_id=keys[0]))
    assert township("day")["metrics"]["projected_grid_avoided_kwh"] == approved
    assert _state(keys[1], "day") == neighbour


def test_missing_inputs_do_not_turn_incomplete_subtotals_into_totals():
    before = township("day")
    first = next(iter(FACILITY_ASSETS))
    _session(first)["config"].update(tariff_myr_per_kwh=None, carbon_kg_per_kwh=None)
    after = township("day")
    assert after["metrics"]["observed_cost_estimate_myr"] is None
    assert after["metrics"]["observed_carbon_estimate_kg"] is None
    assert after["metrics"]["observed_energy_kwh"] == before["metrics"]["observed_energy_kwh"]


def test_facility_routes_report_and_period_validation():
    app = FastAPI()
    app.include_router(router, prefix="/api")
    client = TestClient(app)
    assets = client.get("/api/workbench/assets").json()
    assert len(assets["items"]) == 4
    assert len(assets["facilities"]) == 6
    key = assets["facilities"][0]["id"]
    result = client.get("/api/workbench/state", params={"asset_id": key, "period": "week"})
    assert result.status_code == 200
    assert result.json()["asset"]["name"] == "Nexora Galleria"
    assert client.get("/api/workbench/township?period=week").status_code == 200
    assert client.get("/api/workbench/township?period=year").status_code == 422
    report = client.get("/api/workbench/report.pdf", params={"asset_id": key, "period": "week"})
    assert report.content.startswith(b"%PDF")
    assert b"Nexora Galleria" in report.content
    assert b"Facility results are scaled illustrative estimates" in report.content
