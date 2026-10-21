"""Alert approvals share one plan with monitoring, township and reports."""
from uuid import UUID
import pytest
from fastapi import HTTPException
import src.workbench as wb


def test_alert_approval_settles_once_and_updates_shared_projection(tmp_path, monkeypatch):
    monkeypatch.setattr(wb, "SESSION_FILE", tmp_path / "session.json")
    wb.SESSION.clear()
    key = next(k for k, a in wb.FACILITY_ASSETS.items() if a["facility_id"] == "hospital")
    other = next(k for k, a in wb.FACILITY_ASSETS.items() if a["facility_id"] == "mall")
    before = wb._state(key, "day")
    alert = before["alerts"][0]
    request = wb.ActionRequest(asset_id=UUID(key))
    after = wb.approve_alert(alert["id"], request)
    assert next(a for a in after["alerts"] if a["id"] == alert["id"])["status"] == "settled"
    assert after["metrics"]["projected_energy_reduction_kwh"] == pytest.approx(alert["energy_kwh"])
    assert after["metrics"]["projected_cost_difference_myr"] == pytest.approx(alert["cost_myr"])
    assert after["metrics"]["projected_avoided_carbon_kg"] == pytest.approx(alert["carbon_kg"])
    assert after["metrics"]["observed_energy_kwh"] == before["metrics"]["observed_energy_kwh"]
    repeated = wb.approve_alert(alert["id"], request)
    assert repeated["metrics"] == after["metrics"]
    assert len(repeated["history"]) == 1
    assert all(a["status"] == "proposed" for a in wb._state(other, "day")["alerts"])
    assert wb._state(key, "week")["metrics"]["projected_energy_reduction_kwh"] == after["metrics"]["projected_energy_reduction_kwh"]
    assert wb.township("day")["metrics"]["projected_energy_reduction_kwh"] == pytest.approx(alert["energy_kwh"])
    with pytest.raises(HTTPException):
        wb.approve_alert("not-a-real-alert", request)
    # A legacy solar plan composes with the alert reduction and remains applied.
    wb.decide("solar", "approve", request)
    final = wb._state(key, "day")
    assert final["metrics"]["projected_energy_reduction_kwh"] == pytest.approx(alert["energy_kwh"])
    assert final["metrics"]["projected_grid_avoided_kwh"] >= alert["energy_kwh"]
    assert wb.SESSION_FILE.exists()
    wb.SESSION.clear()
