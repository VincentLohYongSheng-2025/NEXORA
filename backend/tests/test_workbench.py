"""Checks for the local, source-labelled workbench calculations and plan state."""
from uuid import UUID
import pytest
import src.workbench as workbench

from fastapi import HTTPException

from src.workbench import SNAPSHOT, SESSION, ActionRequest, CopilotRequest, _state, copilot, decide, report


@pytest.fixture(autouse=True)
def isolate_workbench_persistence(tmp_path, monkeypatch):
    monkeypatch.setattr(workbench, "SESSION_FILE", tmp_path / "workbench-session.json")


def test_one_malaysian_reference_retains_observed_source_dates():
    SESSION.clear()
    ids = [asset["id"] for asset in SNAPSHOT["assets"]["items"]]
    assert len(ids) == 1
    totals = []
    for asset_id in ids:
        day = _state(asset_id, "day")
        week = _state(asset_id, "week")
        assert day["asset"]["scope"] == "whole_building"
        assert day["observed_window"]["to"].startswith("2023-10-24")
        assert week["metrics"]["observed_energy_kwh"] > day["metrics"]["observed_energy_kwh"]
        assert len(day["forecast"]) == 24
        assert len(day["observed_trend"]) == 696
        totals.append(day["metrics"]["observed_energy_kwh"])
    assert len(set(totals)) == 1


def test_historical_forecasts_match_selected_dates_and_township_scaling():
    from datetime import datetime
    for asset in workbench.FACILITY_ASSETS.values():
        source_rows = workbench.HISTORY_FORECASTS['buildings'][asset['source_asset_id']]['items']
        for period, count in [('day', 24), ('week', 144)]:
            data = _state(asset['id'], period)
            rows = data['history_forecast']
            assert len(rows) == count
            assert [r['timestamp'] for r in rows] == [r['timestamp'] for r in data['observed']]
            assert len({r['source_local_timestamp'][:10] for r in rows}) == count // 24
            cutoff = datetime.fromisoformat(data['model']['history_forecast']['training_end_exclusive'])
            source_map={r['timestamp']:r for r in source_rows}
            for row in rows:
                source=source_map[row['timestamp']]
                origin, timestamp = map(datetime.fromisoformat, (row['forecast_origin'], row['timestamp']))
                assert cutoff <= origin <= timestamp
                assert (timestamp - origin).total_seconds() < 24 * 3600
                assert row['forecast_kwh'] == pytest.approx(source['forecast_kwh'] * asset['demo_basis']['load_multiplier'] * workbench.schedule(asset['facility_id'],timestamp.astimezone(workbench.ZoneInfo(asset['timezone']))))


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
    assert b"CLEMD Malaysian institutional reference" in response.body
    assert b"2023-10-18" in response.body
    assert b"Source provenance and checks" in response.body
    assert b"No corporate-site identity" in response.body
    assert b"Scope 1 / direct" in response.body
    assert b"Not assessed" in response.body
    assert response.headers["content-disposition"].startswith('attachment; filename="nexora-carbon-report-')
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


def test_dashboard_report_includes_planning_assumptions_without_changing_inventory():
    SESSION.clear()
    key = SNAPSHOT["assets"]["items"][0]["id"]
    response = report(UUID(key), "week", dashboard=True, load_type="hvac",
                      target_percent=25, tree_factor=22, bei_benchmark=180,
                      evidence_count=3)
    assert response.body.startswith(b"%PDF-1.4")
    assert b"Dashboard planning appendix" in response.body
    assert b"Assumed load allocation" in response.body
    assert b"Selected load: HVAC" in response.body
    assert b"Scope 1 / direct" in response.body
    assert b"not separately metered" in response.body


def test_esg_export_is_distinct_and_discloses_missing_social_and_governance_evidence():
    SESSION.clear()
    key = SNAPSHOT["assets"]["items"][0]["id"]
    response = report(UUID(key), "day", dashboard=True, report_type="esg",
                      reviewed_items="energy,factor,assurance")
    assert response.headers["content-disposition"].startswith('attachment; filename="nexora-esg-report-')
    for text in (b"Governance, strategy", b"Social, governance", b"Marked reviewed",
                 b"Supporting file not verified", b"IFRS", b"GHG Protocol", b"Bursa Malaysia"):
        assert text in response.body
    assert b"Scope 1 / direct" in response.body
    assert b"Not assessed" in response.body


def test_carbon_report_does_not_promote_assumed_factors_or_missing_values_to_verified_inventory():
    SESSION.clear()
    key = SNAPSHOT["assets"]["items"][0]["id"]
    _state(key, "day")
    SESSION[key]["config"].update(carbon_kg_per_kwh=None, tariff_myr_per_kwh=None)
    response = report(UUID(key), "day", report_type="carbon")
    for text in (b"Not available", b"location-based", b"market-based", b"Not established",
                 b"Base year and restatements", b"Factor", b"Uncertainty", b"Independent assurance"):
        assert text.lower() in response.body.lower()


def test_report_rejects_unknown_review_items():
    key = SNAPSHOT["assets"]["items"][0]["id"]
    try:
        report(UUID(key), reviewed_items="invented-evidence")
    except HTTPException as error:
        assert error.status_code == 422
    else:
        raise AssertionError("Unknown checklist items must be rejected")
