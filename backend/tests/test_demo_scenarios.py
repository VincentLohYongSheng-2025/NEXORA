"""Internal calculation fixtures are tests only, never operational demo data."""
from datetime import datetime, timedelta, timezone
import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError
from app import app
from src.demo_routes import DemoReader, get_demo_reader
from src.demo_scenarios import (
    EnergyInputs,
    SolarGridDispatchInputs,
    ShiftInputs,
    ImpactInputs,
    InvestmentCandidate,
    InvestmentComparisonInputs,
    energy_scenario,
    solar_grid_dispatch,
    peak_shift,
    impact_estimate,
    investment_comparison,
)
from src.scenario_profile import SCENARIO_VERSION, build_scenario_profile

ID="00000000-0000-4000-8000-000000000001"
PROV={"source_code":"bdg2_v1","kind":"public_benchmark"}

def forecast(start="2018-01-01T06:00:00+00:00"):
    stamp=datetime.fromisoformat(start)
    return dict(unit="kWh", provenance=PROV,items=[dict(timestamp=(stamp+timedelta(hours=i)).isoformat(),forecast_kwh=100. if i!=18 else 200.) for i in range(24)])

def inputs(**changes):
    return EnergyInputs(asset_id=ID,solar_capacity_kw=150,battery_capacity_kwh=200,battery_power_kw=50,starting_soc_percent=50,**changes)

def test_energy_is_deterministic_bounded_and_balances_each_hour():
    data=forecast(); result=energy_scenario(data,{"timezone":"US/Central"},inputs())
    assert result==energy_scenario(data,{"timezone":"US/Central"},inputs())
    stored=result["initial_stored_kwh"]
    for row in result["items"]:
        assert row["solar_kwh"]==pytest.approx(row["direct_solar_kwh"]+row["charge_kwh"]+row["curtailed_kwh"])
        assert row["baseline_kwh"]==pytest.approx(row["grid_kwh"]+row["direct_solar_kwh"]+row["discharge_kwh"])
        stored+=row["charge_kwh"]*.95-row["discharge_kwh"]/.95
        assert row["stored_kwh"]==pytest.approx(stored)
        assert 0<=row["soc_percent"]<=100
        assert row["charge_kwh"]<=50 and row["discharge_kwh"]<=50
    assert result["label"]=="simulated"
    assert result["items"][0]["solar_kwh"]==0  # 06 UTC is midnight at source site
    assert result["items"][12]["solar_kwh"]==150  # noon local, not UTC noon

def test_zero_storage_and_zero_solar_preserve_forecast():
    config=inputs().model_copy(update=dict(solar_capacity_kw=0,battery_capacity_kwh=0))
    result=energy_scenario(forecast(),{"timezone":"US/Central"},config)
    assert [r["grid_kwh"] for r in result["items"]]==[r["forecast_kwh"] for r in forecast()["items"]]


def test_forecast_informed_dispatch_is_deterministic_balanced_and_read_only():
    config = SolarGridDispatchInputs(asset_id=ID, solar_capacity_kw=150, battery_capacity_kwh=200,
                                     battery_power_kw=50, starting_soc_percent=50)
    result = solar_grid_dispatch(forecast(), {"timezone": "US/Central"}, config)
    assert result == solar_grid_dispatch(forecast(), {"timezone": "US/Central"}, config)
    assert result["model"] == "forecast_informed_simulated_dynamic_programming_dispatch"
    assert result["optimisation_objective"] == "minimise_simulated_grid_import"
    assert result["cost_estimate"] is None
    assert len(result["items"]) == 24
    for row in result["items"]:
        assert row["baseline_kwh"] == pytest.approx(row["grid_kwh"] + row["direct_solar_kwh"] + row["discharge_kwh"])
        assert row["solar_kwh"] == pytest.approx(row["direct_solar_kwh"] + row["charge_kwh"] + row["curtailed_kwh"])
        assert row["recommended_supply"] in {"solar", "solar_and_battery", "solar_battery_and_grid", "grid"}
        assert row["assumed_grid_price_myr_per_kwh"] is None


def test_dispatch_uses_only_disclosed_price_and_prefers_the_expensive_hour():
    config = SolarGridDispatchInputs(asset_id=ID, solar_capacity_kw=0, battery_capacity_kwh=100,
                                     battery_power_kw=100, starting_soc_percent=100,
                                     hourly_grid_price_myr_per_kwh=[.1] * 23 + [1.0],
                                     assumption_reference="User-entered illustrative time-of-use price")
    result = solar_grid_dispatch(forecast(), {"timezone": "US/Central"}, config)
    assert result["optimisation_objective"] == "minimise_user_assumed_grid_cost"
    assert result["cost_estimate"] is not None
    assert result["items"][-1]["discharge_kwh"] > 0
    with pytest.raises(ValidationError):
        SolarGridDispatchInputs(asset_id=ID, solar_capacity_kw=0, battery_capacity_kwh=0,
                                battery_power_kw=0, starting_soc_percent=0, tariff_myr_per_kwh=.5)

def test_shift_preserves_energy_and_can_worsen_peak():
    result=peak_shift(forecast(),ShiftInputs(asset_id=ID,flexible_load_kwh=50,from_interval=0,to_interval=18))
    assert result["peak_reduction_kw"]==-50
    assert result["energy_balance_kwh"]==pytest.approx(0)
    with pytest.raises(ValueError):
        peak_shift(forecast(),ShiftInputs(asset_id=ID,flexible_load_kwh=101,from_interval=0,to_interval=1))

@pytest.mark.parametrize("changes",[{"starting_soc_percent":101},{"solar_capacity_kw":-1},{"efficiency":0},{"battery_power_kw":float("inf")}])
def test_bad_assumptions_rejected(changes):
    data=inputs().model_dump();data.update(changes)
    with pytest.raises(ValidationError): EnergyInputs(**data)

def test_incomplete_nonconsecutive_or_naive_forecast_rejected():
    for change in ["short","gap","naive"]:
        data=forecast()
        if change=="short":data["items"].pop()
        if change=="gap":data["items"][2]["timestamp"]=data["items"][0]["timestamp"]
        if change=="naive":data["items"][0]["timestamp"]="2018-01-01T06:00:00"
        with pytest.raises(ValueError):energy_scenario(data,{"timezone":"US/Central"},inputs())

def test_impact_requires_disclosed_inputs_and_never_annualises_day():
    config=ImpactInputs(asset_id=ID,basis="forecast")
    empty=impact_estimate(forecast(),config)
    assert empty["cost_myr"] is None and empty["emissions_kg_co2e"] is None
    assert empty["simple_payback_years"] is None
    config=ImpactInputs(asset_id=ID,basis="forecast",tariff_myr_per_kwh=.5,carbon_kg_per_kwh=.2,
                        assumption_reference="Test user assumption",capex_myr=1000,
                        annual_energy_reduction_kwh=2000,annual_maintenance_myr=100)
    result=impact_estimate(forecast(),config)
    assert result["cost_myr"]==1250
    assert result["emissions_kg_co2e"]==500
    assert result["simple_payback_years"]==pytest.approx(1000/900)
    gap=forecast();gap["items"].pop()
    assert impact_estimate(gap,config)["energy_kwh"] is None
    with pytest.raises(ValidationError):ImpactInputs(asset_id=ID,tariff_myr_per_kwh=.5)


def test_investment_comparison_is_deterministic_and_withholds_incomplete_outputs():
    candidates = [
        InvestmentCandidate(
            name="Battery dispatch assumption",
            capex_myr=100_000,
            expected_annual_energy_change_kwh=30_000,
            tariff_myr_per_kwh=.5,
            carbon_kg_per_kwh=.4,
            annual_operating_cost_change_myr=1_000,
            assumption_reference="User-entered hackathon scenario",
        ),
        InvestmentCandidate(
            name="Controls assumption",
            capex_myr=40_000,
            expected_annual_energy_change_kwh=20_000,
            tariff_myr_per_kwh=.5,
            carbon_kg_per_kwh=.4,
            annual_operating_cost_change_myr=500,
            assumption_reference="User-entered hackathon scenario",
        ),
        InvestmentCandidate(
            name="Incomplete idea",
            capex_myr=20_000,
            assumption_reference="User-entered placeholder",
        ),
    ]
    config = InvestmentComparisonInputs(asset_id=ID, candidates=candidates)
    asset = {"source_asset_id": "Hog_test", "provenance": PROV}
    result = investment_comparison(asset, config)
    assert result == investment_comparison(asset, config)
    assert result["label"] == "illustrative_scenario_ranking"
    assert result["items"][1]["ranking_position"] == 1
    assert result["items"][0]["ranking_position"] == 2
    assert result["items"][2]["complete"] is False
    assert result["items"][2]["simple_payback_years"] is None
    assert "tariff_myr_per_kwh" in result["items"][2]["missing_inputs"]
    with pytest.raises(ValidationError):
        InvestmentCandidate(name="Undisclosed", capex_myr=1)

class Reader(DemoReader):
    async def read(self,path):
        if path=="/assets":return {"items":[dict(id=ID,source_asset_id="Hog_test",timezone="US/Central",floor_area_m2=1000,provenance=PROV)]}
        if path.endswith("/forecast"):return forecast()
        return dict(provenance=PROV,items=[dict(timestamp=r["timestamp"],consumption_kwh=r["forecast_kwh"]) for r in forecast()["items"]])

@pytest.fixture
def client(monkeypatch):
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    app.dependency_overrides[get_demo_reader]=lambda:Reader()
    with TestClient(app) as c:yield c
    app.dependency_overrides.clear()

def test_demo_route_contracts_and_unchanged_health(client):
    assert client.get("/health").json()=={"status":"ok","version":"1"}
    result=client.post("/demo/energy-scenario",json=inputs().model_dump(mode="json"))
    assert result.status_code==200 and len(result.json()["items"])==24
    assert result.json()["provenance"]["source_code"]=="bdg2_v1"
    assert client.post("/demo/peak-shift",json=dict(asset_id=ID,flexible_load_kwh=10,from_interval=18,to_interval=0)).status_code==200
    assert client.post("/demo/impact",json=dict(asset_id=ID,basis="forecast")).json()["cost_myr"] is None
    portfolio=client.get("/demo/portfolio").json()
    assert portfolio["common_interval_count"]==24
    assert portfolio["items"][0]["energy_intensity_kwh_per_m2"]==pytest.approx(2.5)
    assert portfolio["items"][0]["overnight_window"]=="00:00–05:59 source-local time"
    comparison=client.post("/demo/investment-comparison",json=dict(asset_id=ID,candidates=[
        dict(name="A",capex_myr=1000,expected_annual_energy_change_kwh=500,tariff_myr_per_kwh=.5,
             carbon_kg_per_kwh=.4,annual_operating_cost_change_myr=50,assumption_reference="User input"),
        dict(name="B",capex_myr=None,expected_annual_energy_change_kwh=None,tariff_myr_per_kwh=None,
             carbon_kg_per_kwh=None,annual_operating_cost_change_myr=None,assumption_reference=""),
    ]))
    assert comparison.status_code==200
    assert comparison.json()["label"]=="illustrative_scenario_ranking"
    assert client.get("/demo/assistant/status").json()["available"] is False
    assert client.post("/demo/energy-scenario",json={}).status_code==422
    dispatch = client.post("/demo/solar-grid-dispatch", json=dict(
        asset_id=ID, solar_capacity_kw=100, battery_capacity_kwh=100,
        battery_power_kw=50, starting_soc_percent=50,
    ))
    assert dispatch.status_code == 200
    assert dispatch.json()["label"] == "simulated_dispatch_recommendation"
    assert client.post("/demo/impact",json=dict(asset_id="00000000-0000-4000-8000-000000000099")).status_code==404


def test_scenario_profile_is_versioned_balanced_and_explicitly_simulated(client):
    response = client.get(f"/demo/scenario-profile/{ID}")
    assert response.status_code == 200
    profile = response.json()
    assert profile["scenario_version"] == SCENARIO_VERSION
    assert profile["label"] == "Simulated demonstration assumption"
    assert sum(profile["assumptions"]["load_allocations_percent"].values()) == 100
    assert sum(row["allocation_percent"] for row in profile["assumptions"]["floors"]) == 100
    assert profile["source"]["type"] == "internal_demo_assumption"
    assert "not BDG2 measurements" in profile["limitations"][0]
    assert "equipment command" in profile["limitations"][-1].lower()


def test_scenario_profile_varies_by_building_use_without_claiming_external_source():
    office = build_scenario_profile({"id": ID, "source_asset_id": "Office", "primary_space_usage": "Office", "timezone": "US/Central"})
    education = build_scenario_profile({"id": ID, "source_asset_id": "School", "primary_space_usage": "Education", "timezone": "US/Central"})
    assert office["assumptions"]["load_allocations_percent"] != education["assumptions"]["load_allocations_percent"]
    assert office["assumptions"]["microgrid"]["solar_capacity_kw"] != education["assumptions"]["microgrid"]["solar_capacity_kw"]
    assert office["source"]["type"] == "internal_demo_assumption"
