"""Stateless demo calculations. No writes, inferred equipment data, or default prices."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from math import sin, pi, isfinite
from typing import Literal
from uuid import UUID
from zoneinfo import ZoneInfo

from pydantic import BaseModel, ConfigDict, Field, model_validator


class Inputs(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)


class EnergyInputs(Inputs):
    asset_id: UUID
    solar_capacity_kw: float = Field(ge=0, le=100_000)
    battery_capacity_kwh: float = Field(ge=0, le=1_000_000)
    battery_power_kw: float = Field(ge=0, le=100_000)
    starting_soc_percent: float = Field(ge=0, le=100)
    efficiency: float = Field(default=0.95, ge=0.5, le=1)
    target_fraction: float = Field(default=0.85, ge=0, le=1)
    tariff_myr_per_kwh: float | None = Field(default=None, ge=0, le=100)
    assumption_reference: str = Field(default="", max_length=240)

    @model_validator(mode="after")
    def price_reference(self):
        if self.tariff_myr_per_kwh is not None and not self.assumption_reference.strip():
            raise ValueError("Disclose a user assumption or source for the grid price")
        return self


class SolarGridDispatchInputs(Inputs):
    """User-configured, read-only dispatch simulation inputs.

    The existing ML forecast supplies demand.  Solar availability and battery
    characteristics remain disclosed hypothetical inputs because BDG2 has no
    measured PV, storage, tariff, or weather telemetry.
    """
    asset_id: UUID
    solar_capacity_kw: float = Field(ge=0, le=100_000)
    battery_capacity_kwh: float = Field(ge=0, le=1_000_000)
    battery_power_kw: float = Field(ge=0, le=100_000)
    starting_soc_percent: float = Field(ge=0, le=100)
    efficiency: float = Field(default=0.95, ge=0.5, le=1)
    tariff_myr_per_kwh: float | None = Field(default=None, ge=0, le=100)
    hourly_grid_price_myr_per_kwh: list[float] | None = Field(default=None, min_length=24, max_length=24)
    assumption_reference: str = Field(default="", max_length=240)

    @model_validator(mode="after")
    def validate_dispatch_assumptions(self):
        if self.hourly_grid_price_myr_per_kwh is not None:
            if any(not isfinite(value) or value < 0 or value > 100 for value in self.hourly_grid_price_myr_per_kwh):
                raise ValueError("Hourly grid prices must be finite values from 0 to 100")
        if (self.tariff_myr_per_kwh is not None or self.hourly_grid_price_myr_per_kwh is not None) and not self.assumption_reference.strip():
            raise ValueError("Disclose a user assumption or source for any grid price")
        return self


class ShiftInputs(Inputs):
    asset_id: UUID
    flexible_load_kwh: float = Field(ge=0, le=1_000_000)
    from_interval: int = Field(ge=0, le=23, strict=True)
    to_interval: int = Field(ge=0, le=23, strict=True)

    @model_validator(mode="after")
    def different_intervals(self):
        if self.from_interval == self.to_interval:
            raise ValueError("Shift intervals must differ")
        return self


class ImpactInputs(Inputs):
    asset_id: UUID
    basis: Literal["observed", "forecast"] = "observed"
    tariff_myr_per_kwh: float | None = Field(default=None, ge=0, le=100)
    carbon_kg_per_kwh: float | None = Field(default=None, ge=0, le=100)
    assumption_reference: str = Field(default="", max_length=240)
    capex_myr: float | None = Field(default=None, ge=0, le=1e12)
    annual_energy_reduction_kwh: float | None = Field(default=None, ge=0, le=1e10)
    annual_maintenance_myr: float | None = Field(default=None, ge=0, le=1e10)

    @model_validator(mode="after")
    def disclose_reference(self):
        if any(v is not None for v in (self.tariff_myr_per_kwh, self.carbon_kg_per_kwh,
                                       self.capex_myr, self.annual_energy_reduction_kwh)):
            if not self.assumption_reference.strip():
                raise ValueError("Disclose the source or user assumption for all estimate inputs")
        return self


class InvestmentCandidate(Inputs):
    name: str = Field(min_length=1, max_length=80)
    capex_myr: float | None = Field(default=None, ge=0, le=1e12)
    expected_annual_energy_change_kwh: float | None = Field(default=None, ge=0, le=1e10)
    tariff_myr_per_kwh: float | None = Field(default=None, ge=0, le=100)
    carbon_kg_per_kwh: float | None = Field(default=None, ge=0, le=100)
    annual_operating_cost_change_myr: float | None = Field(default=None, ge=0, le=1e10)
    assumption_reference: str = Field(default="", max_length=240)

    @model_validator(mode="after")
    def disclose_assumptions(self):
        values = (
            self.capex_myr,
            self.expected_annual_energy_change_kwh,
            self.tariff_myr_per_kwh,
            self.carbon_kg_per_kwh,
            self.annual_operating_cost_change_myr,
        )
        if any(value is not None for value in values) and not self.assumption_reference.strip():
            raise ValueError("Disclose the source or user assumption for candidate inputs")
        return self


class InvestmentComparisonInputs(Inputs):
    asset_id: UUID
    candidates: list[InvestmentCandidate] = Field(min_length=2, max_length=6)


def hourly_values(forecast: dict) -> tuple[list[float], list[str]]:
    items = forecast.get("items", [])
    if (len(items) != 24 or forecast.get("unit") != "kWh"
            or forecast.get("provenance", {}).get("source_code") != "bdg2_v1"):
        raise ValueError("A complete source-labelled BDG2 hourly forecast is required")
    values = [float(row["forecast_kwh"]) for row in items]
    stamps = [datetime.fromisoformat(row["timestamp"].replace("Z", "+00:00")) for row in items]
    if any(not isfinite(v) or v < 0 for v in values):
        raise ValueError("Forecast values must be finite non-negative interval kWh")
    if any(s.tzinfo is None or s.utcoffset() is None for s in stamps):
        raise ValueError("Forecast timestamps must be timezone-aware")
    utc = [s.astimezone(timezone.utc) for s in stamps]
    if any(b-a != timedelta(hours=1) for a,b in zip(utc, utc[1:])):
        raise ValueError("Forecast must contain 24 consecutive hourly intervals")
    return values, [s.isoformat().replace("+00:00", "Z") for s in utc]


def energy_scenario(forecast: dict, asset: dict, inputs: EnergyInputs) -> dict:
    baseline, timestamps = hourly_values(forecast)
    zone = ZoneInfo(asset["timezone"])
    local_hours = [datetime.fromisoformat(t.replace("Z", "+00:00")).astimezone(zone).hour
                   for t in timestamps]
    # Hypothetical clear-day profile, evaluated by source-site local clock, not UTC index.
    factors = [max(0., sin(pi*(h-6)/12)) if 6 <= h <= 18 else 0. for h in local_hours]
    solar = [inputs.solar_capacity_kw*f for f in factors]
    stored = initial = inputs.battery_capacity_kwh*inputs.starting_soc_percent/100
    target = max(baseline)*inputs.target_fraction
    rows = []
    for stamp, demand, generation in zip(timestamps, baseline, solar):
        direct = min(demand, generation)
        surplus = generation-direct
        charge = min(surplus, inputs.battery_power_kw,
                     max(0., inputs.battery_capacity_kwh-stored)/inputs.efficiency)
        stored += charge*inputs.efficiency
        discharge = min(max(0., demand-direct-target), inputs.battery_power_kw,
                        stored*inputs.efficiency)
        stored = max(0., stored-discharge/inputs.efficiency)
        rows.append(dict(timestamp=stamp, baseline_kwh=demand, solar_kwh=generation,
                         direct_solar_kwh=direct, charge_kwh=charge, discharge_kwh=discharge,
                         grid_kwh=max(0., demand-direct-discharge), curtailed_kwh=surplus-charge,
                         stored_kwh=stored, soc_percent=stored/inputs.battery_capacity_kwh*100
                         if inputs.battery_capacity_kwh else 0))
    grid = [r["grid_kwh"] for r in rows]
    return dict(label="simulated", asset_id=str(inputs.asset_id), unit="kWh",
                demand_unit="kW_interval_average", interval_hours=1,
                provenance=forecast["provenance"], input_label="forecast",
                assumptions=inputs.model_dump(mode="json"), solar_profile="hypothetical_sine_06_18_local",
                timezone=asset["timezone"], initial_stored_kwh=initial, ending_stored_kwh=stored,
                baseline_peak_kw=max(baseline), simulated_peak_kw=max(grid),
                peak_reduction_kw=max(baseline)-max(grid), baseline_energy_kwh=sum(baseline),
                cost_estimate=None if inputs.tariff_myr_per_kwh is None else dict(
                    baseline_cost_myr=sum(baseline)*inputs.tariff_myr_per_kwh,
                    simulated_cost_myr=sum(grid)*inputs.tariff_myr_per_kwh,
                    horizon_difference_myr=(sum(baseline)-sum(grid))*inputs.tariff_myr_per_kwh),
                simulated_grid_energy_kwh=sum(grid), items=rows,
                limitations=["Simulation, not measured solar or battery telemetry; no equipment command.",
                             "One-hour interval kWh / 1 h gives interval-average kW, not instantaneous demand.",
                             "Solar-only charging; fixed per-leg efficiency; no export credit or battery degradation.",
                             "Starting stored energy is an assumption; grid-energy difference is not verified savings."])


def solar_grid_dispatch(forecast: dict, asset: dict, inputs: SolarGridDispatchInputs) -> dict:
    """Produce a deterministic, forecast-informed simulated dispatch recommendation.

    This is an optimiser over a *forecast* and disclosed assumptions.  It is
    deliberately not a solar-production ML model and does not issue controls.
    """
    baseline, timestamps = hourly_values(forecast)
    zone = ZoneInfo(asset["timezone"])
    local_hours = [datetime.fromisoformat(t.replace("Z", "+00:00")).astimezone(zone).hour for t in timestamps]
    solar_factors = [max(0., sin(pi * (hour - 6) / 12)) if 6 <= hour <= 18 else 0. for hour in local_hours]
    solar = [inputs.solar_capacity_kw * factor for factor in solar_factors]
    prices = (inputs.hourly_grid_price_myr_per_kwh
              if inputs.hourly_grid_price_myr_per_kwh is not None
              else ([inputs.tariff_myr_per_kwh] * 24 if inputs.tariff_myr_per_kwh is not None else [1.0] * 24))
    price_disclosed = inputs.hourly_grid_price_myr_per_kwh is not None or inputs.tariff_myr_per_kwh is not None

    # Dynamic-programming state is battery state-of-charge in 1/80 capacity steps.
    # It optimises simulated grid import cost when a user price exists, otherwise
    # it optimises grid-energy import. Charging is solar-surplus only.
    steps = 80
    capacity = inputs.battery_capacity_kwh
    quantum = capacity / steps if capacity else 1.0
    initial_stored = capacity * inputs.starting_soc_percent / 100
    initial_state = min(steps, max(0, round(initial_stored / quantum))) if capacity else 0

    def transition(state: int, index: int, discharge_step: int) -> tuple[int, dict] | None:
        stored = state * quantum if capacity else 0.0
        demand, generation = baseline[index], solar[index]
        direct = min(demand, generation)
        surplus = generation - direct
        charge = min(surplus, inputs.battery_power_kw, max(0.0, capacity - stored) / inputs.efficiency)
        after_charge = min(capacity, stored + charge * inputs.efficiency)
        max_discharge = min(demand - direct, inputs.battery_power_kw, after_charge * inputs.efficiency)
        discharge = min(max_discharge, discharge_step * quantum * inputs.efficiency)
        ending = max(0.0, after_charge - discharge / inputs.efficiency)
        next_state = min(steps, max(0, round(ending / quantum))) if capacity else 0
        grid = max(0.0, demand - direct - discharge)
        return next_state, dict(direct=direct, surplus=surplus, charge=charge, discharge=discharge, grid=grid, stored=ending)

    costs: list[dict[int, tuple[float, int]]] = [{} for _ in range(25)]
    costs[24] = {state: (0.0, 0) for state in range(steps + 1)}
    for index in range(23, -1, -1):
        for state in range(steps + 1):
            best: tuple[float, int] | None = None
            for discharge_step in range(steps + 1):
                result = transition(state, index, discharge_step)
                if result is None:
                    continue
                next_state, row = result
                candidate = row["grid"] * prices[index] + costs[index + 1][next_state][0]
                if best is None or candidate < best[0] - 1e-9:
                    best = (candidate, discharge_step)
            if best is not None:
                costs[index][state] = best

    state = initial_state
    rows = []
    for index, stamp in enumerate(timestamps):
        discharge_step = costs[index][state][1]
        next_state, row = transition(state, index, discharge_step)
        state = next_state
        source = "solar" if row["grid"] <= 1e-9 and row["discharge"] <= 1e-9 else (
            "solar_and_battery" if row["grid"] <= 1e-9 else (
                "solar_battery_and_grid" if row["direct"] > 1e-9 or row["discharge"] > 1e-9 else "grid"))
        reason = ("Hypothetical solar directly covers the forecast demand." if source == "solar" else
                  "Hypothetical stored solar is reserved for this forecast interval by the simulated dispatch objective." if row["discharge"] > 1e-9 else
                  "Grid supplies the remaining forecast demand after hypothetical solar and storage limits.")
        rows.append(dict(timestamp=stamp, baseline_kwh=baseline[index], solar_kwh=solar[index],
                         direct_solar_kwh=row["direct"], charge_kwh=row["charge"], discharge_kwh=row["discharge"],
                         grid_kwh=row["grid"], curtailed_kwh=row["surplus"] - row["charge"], stored_kwh=row["stored"],
                         soc_percent=(row["stored"] / capacity * 100) if capacity else 0.0,
                         assumed_grid_price_myr_per_kwh=prices[index] if price_disclosed else None,
                         recommended_supply=source, recommendation_reason=reason))
    grid_energy = sum(row["grid_kwh"] for row in rows)
    baseline_cost = sum(value * price for value, price in zip(baseline, prices)) if price_disclosed else None
    simulated_cost = sum(row["grid_kwh"] * price for row, price in zip(rows, prices)) if price_disclosed else None
    return dict(label="simulated_dispatch_recommendation", asset_id=str(inputs.asset_id), unit="kWh",
                demand_unit="kW_interval_average", interval_hours=1, provenance=forecast["provenance"],
                input_label="calculated_forecast", timezone=asset["timezone"],
                model="forecast_informed_simulated_dynamic_programming_dispatch", optimisation_objective=(
                    "minimise_user_assumed_grid_cost" if price_disclosed else "minimise_simulated_grid_import"),
                assumptions=inputs.model_dump(mode="json"), solar_profile="hypothetical_sine_06_18_source_local",
                initial_stored_kwh=initial_stored, ending_stored_kwh=rows[-1]["stored_kwh"],
                baseline_energy_kwh=sum(baseline), simulated_grid_energy_kwh=grid_energy,
                baseline_peak_kw=max(baseline), simulated_grid_peak_kw=max(row["grid_kwh"] for row in rows),
                cost_estimate=None if not price_disclosed else dict(baseline_cost_myr=baseline_cost,
                    simulated_grid_cost_myr=simulated_cost, horizon_difference_myr=baseline_cost - simulated_cost),
                items=rows,
                limitations=[
                    "Demand input is a calculated BDG2 forecast; it is not live demand telemetry.",
                    "Solar profile, battery capacity, starting state, efficiency and any price are user-editable simulation assumptions, not weather, tariff or equipment measurements.",
                    "The recommendation is read-only and sends no BMS, SCADA, inverter, battery or grid control command.",
                    "No export credit, grid charging, battery degradation, outage, demand charge, actual tariff or verified savings is modelled.",
                ])


def peak_shift(forecast: dict, inputs: ShiftInputs) -> dict:
    baseline, timestamps = hourly_values(forecast)
    if inputs.flexible_load_kwh > baseline[inputs.from_interval]:
        raise ValueError("Flexible load exceeds the source interval consumption; enter a smaller load")
    after = list(baseline)
    after[inputs.from_interval] -= inputs.flexible_load_kwh
    after[inputs.to_interval] += inputs.flexible_load_kwh
    return dict(label="simulated", asset_id=str(inputs.asset_id), unit="kWh",
                demand_unit="kW_interval_average", provenance=forecast["provenance"],
                assumptions=inputs.model_dump(mode="json"), baseline_peak_kw=max(baseline),
                simulated_peak_kw=max(after), peak_reduction_kw=max(baseline)-max(after),
                energy_balance_kwh=sum(after)-sum(baseline),
                items=[dict(timestamp=t, before_kwh=b, after_kwh=a)
                       for t,b,a in zip(timestamps,baseline,after)],
                limitations=["User-assumed flexible load; no evidence of load flexibility or equipment control.",
                             "A negative peak reduction means the shift worsened the peak.",
                             "Energy is conserved; no flat-rate cost saving is implied."])


def impact_estimate(data: dict, inputs: ImpactInputs) -> dict:
    items = data.get("items", [])[-24:]
    value_key = "forecast_kwh" if inputs.basis == "forecast" else "consumption_kwh"
    # Explicitly withhold a daily total for gaps rather than inventing missing readings.
    complete = len(items) == 24
    if complete:
        stamps = [datetime.fromisoformat(r["timestamp"].replace("Z", "+00:00")) for r in items]
        complete = all(b-a == timedelta(hours=1) for a,b in zip(stamps, stamps[1:]))
    total = sum(r[value_key] for r in items) if complete else None
    price, factor = inputs.tariff_myr_per_kwh, inputs.carbon_kg_per_kwh
    annual = None
    if (price is not None and inputs.annual_energy_reduction_kwh is not None
            and inputs.annual_maintenance_myr is not None):
        annual = inputs.annual_energy_reduction_kwh*price-inputs.annual_maintenance_myr
    payback = inputs.capex_myr/annual if inputs.capex_myr is not None and annual is not None and annual>0 else None
    return dict(label="simulated_estimate", basis=inputs.basis, asset_id=str(inputs.asset_id),
                provenance=data["provenance"], complete_24h=complete, energy_kwh=total,
                cost_myr=total*price if total is not None and price is not None else None,
                emissions_kg_co2e=total*factor if total is not None and factor is not None else None,
                annual_net_benefit_myr=annual, simple_payback_years=payback,
                assumptions=inputs.model_dump(mode="json"),
                limitations=["Flat user-assumed rate only; not a verified applicable tariff or official carbon factor.",
                             "Payback requires explicit CAPEX, annual energy reduction, maintenance and tariff.",
                             "No annualisation of the 24-hour benchmark; no verified savings or investment recommendation."])


def investment_comparison(asset: dict, inputs: InvestmentComparisonInputs) -> dict:
    """Compare user-supplied project scenarios without inferring operational performance."""
    required = (
        "capex_myr",
        "expected_annual_energy_change_kwh",
        "tariff_myr_per_kwh",
        "carbon_kg_per_kwh",
        "annual_operating_cost_change_myr",
    )
    results = []
    for position, candidate in enumerate(inputs.candidates):
        missing = [name for name in required if getattr(candidate, name) is None]
        complete = not missing
        gross_cost_change = None
        carbon_change = None
        net_benefit = None
        payback = None
        if complete:
            gross_cost_change = (
                candidate.expected_annual_energy_change_kwh * candidate.tariff_myr_per_kwh
            )
            carbon_change = (
                candidate.expected_annual_energy_change_kwh * candidate.carbon_kg_per_kwh
            )
            net_benefit = gross_cost_change - candidate.annual_operating_cost_change_myr
            if net_benefit > 0:
                payback = candidate.capex_myr / net_benefit
        results.append(dict(
            input_position=position,
            name=candidate.name,
            complete=complete,
            missing_inputs=missing,
            assumptions=candidate.model_dump(mode="json"),
            annual_cost_change_myr=gross_cost_change,
            annual_carbon_change_kg_co2e=carbon_change,
            annual_net_benefit_myr=net_benefit,
            simple_payback_years=payback,
            ranking_position=None,
        ))

    eligible = [item for item in results if item["simple_payback_years"] is not None]
    eligible.sort(key=lambda item: (
        item["simple_payback_years"],
        -item["annual_net_benefit_myr"],
        item["input_position"],
    ))
    for rank, item in enumerate(eligible, start=1):
        item["ranking_position"] = rank

    return dict(
        label="illustrative_scenario_ranking",
        asset_id=str(inputs.asset_id),
        asset_label=asset["source_asset_id"],
        provenance=asset["provenance"],
        ranking_method=(
            "Complete positive-net-benefit scenarios ordered by shortest simple payback, "
            "then highest annual net benefit; input order breaks remaining ties."
        ),
        formulas={
            "annual_cost_change_myr": "expected_annual_energy_change_kwh × tariff_myr_per_kwh",
            "annual_carbon_change_kg_co2e": "expected_annual_energy_change_kwh × carbon_kg_per_kwh",
            "annual_net_benefit_myr": "annual_cost_change_myr − annual_operating_cost_change_myr",
            "simple_payback_years": "capex_myr ÷ annual_net_benefit_myr when annual_net_benefit_myr > 0",
        },
        items=results,
        limitations=[
            "Illustrative scenario ranking from user-entered assumptions; not measured project performance.",
            "No equipment inefficiency, intervention, applicable tariff, official carbon factor, financing, degradation or verified savings is established.",
            "Expected annual energy change is entered directly and is not extrapolated from the BDG2 benchmark window.",
            "Incomplete or non-positive-net-benefit scenarios are not ranked and display Not calculated where required.",
        ],
    )
