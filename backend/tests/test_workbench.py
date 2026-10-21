"""Checks for the local, source-labelled workbench calculations and plan state."""
from uuid import UUID

from fastapi import HTTPException

from src.workbench import SNAPSHOT, SESSION, ActionRequest, CopilotRequest, _state, copilot, decide, report


def test_four_buildings_have_distinct_observed_results_and_source_dates():
    SESSION.clear()
    ids = [asset["id"] for asset in SNAPSHOT["assets"]["items"]]
    assert len(ids) == 4
    totals = []
    for asset_id in ids:
        day = _state(asset_id, "day")
        week = _state(asset_id, "week")
        assert day["asset"]["scope"] == "whole_building"
        assert day["observed_window"]["to"].startswith("2017-12-31")
        assert week["metrics"]["observed_energy_kwh"] > day["metrics"]["observed_energy_kwh"]
        assert len(day["forecast"]) == 24
        assert len(day["observed_trend"]) == 168
        totals.append(day["metrics"]["observed_energy_kwh"])
    assert len(set(totals)) == 4


def test_approval_recalculates_and_dismissal_preserves_applied_plan():
    SESSION.clear()
    key = SNAPSHOT["assets"]["items"][0]["id"]
    before = _state(key, "day")["metrics"]
    approved = decide("solar", "approve", ActionRequest(asset_id=UUID(key)))["metrics"]
    assert approved["projected_energy_reduction_kwh"] == 0
    assert approved["projected_grid_avoided_kwh"] > 0
    assert approved["projected_cost_difference_myr"] > 0
    dismissed = decide("shift", "dismiss", ActionRequest(asset_id=UUID(key)))["metrics"]
    assert dismissed["projected_grid_avoided_kwh"] == approved["projected_grid_avoided_kwh"]
    assert dismissed["observed_energy_kwh"] == before["observed_energy_kwh"]
    both = decide("efficiency", "approve", ActionRequest(asset_id=UUID(key)))["metrics"]
    assert both["projected_energy_reduction_kwh"] > 0
    assert both["projected_grid_avoided_kwh"] > approved["projected_grid_avoided_kwh"]
    try:
        decide("solar", "dismiss", ActionRequest(asset_id=UUID(key)))
    except HTTPException as error:
        assert error.status_code == 409
    else:
        raise AssertionError("Approved plan must not be removed by dismissal")


def test_report_pdf_contains_selected_period_assumptions_and_source():
    SESSION.clear()
    key = SNAPSHOT["assets"]["items"][0]["id"]
    response = report(UUID(key), "week")
    assert response.body.startswith(b"%PDF-1.4")
    assert b"Building Data Genome Project 2 v1.0" in response.body
    assert b"2017-12-25" in response.body
    assert b"Methodology & calculation assumptions" in response.body
    assert b"No corporate-site identity" in response.body
    assert b"Scope 1 / direct" in response.body
    assert b"Not assessed" in response.body
    assert response.headers["content-disposition"].startswith('attachment; filename="nexora-carbon-esg-')
    assert response.headers["cache-control"] == "no-store"


def test_missing_price_and_factor_remain_unavailable_in_metrics_and_chat():
    SESSION.clear()
    key = SNAPSHOT["assets"]["items"][0]["id"]
    _state(key, "day")
    SESSION[key]["config"].update(tariff_myr_per_kwh=None, carbon_kg_per_kwh=None)
    state = _state(key, "day")
    assert state["metrics"]["observed_cost_estimate_myr"] is None
    assert state["metrics"]["observed_carbon_estimate_kg"] is None
    assert "not calculated" in copilot(CopilotRequest(asset_id=key, question="What is the cost?"))["answer"]
    assert "not calculated" in copilot(CopilotRequest(asset_id=key, question="What are the emissions?"))["answer"]
    assert "unavailable" in copilot(CopilotRequest(asset_id=key, question="What is the room temperature?"))["answer"]


def test_zero_impact_proposal_cannot_be_approved():
    SESSION.clear()
    key = SNAPSHOT["assets"]["items"][0]["id"]
    _state(key, "day")
    SESSION[key]["config"].update(pv_kw=0, battery_kwh=0, battery_power_kw=0)
    try:
        decide("solar", "approve", ActionRequest(asset_id=key))
    except HTTPException as error:
        assert error.status_code == 422
    else:
        raise AssertionError("A zero-impact proposal must be rejected")
    assert SESSION[key]["approved"] == []
