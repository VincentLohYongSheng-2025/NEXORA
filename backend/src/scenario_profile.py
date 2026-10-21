"""Versioned, read-only assumptions for the EnergiOS demonstration scenario.

These values are editable demo inputs.  They are never measurements, tariffs,
official factors, equipment states, or control commands.
"""
from __future__ import annotations

from copy import deepcopy


SCENARIO_VERSION = "energios-demo-1.0.0"
ASSUMPTION_SOURCE = {
    "type": "internal_demo_assumption",
    "name": "EnergiOS Demonstration Scenario",
    "version": SCENARIO_VERSION,
    "reference": "User-editable hackathon demonstration defaults; no external market or equipment benchmark is asserted.",
}

USE_PROFILES = {
    "Office": {"loads": (45, 18, 27, 10), "schedule": (8, 18), "solar_kw": 140},
    "Education": {"loads": (42, 24, 22, 12), "schedule": (7, 18), "solar_kw": 110},
    "Lodging/residential": {"loads": (48, 16, 20, 16), "schedule": (0, 24), "solar_kw": 125},
    "Entertainment/public assembly": {"loads": (50, 22, 18, 10), "schedule": (10, 23), "solar_kw": 160},
}


def build_scenario_profile(asset: dict) -> dict:
    use = asset.get("primary_space_usage") or "Office"
    template = USE_PROFILES.get(use, USE_PROFILES["Office"])
    hvac, lighting, it_plug, other = template["loads"]
    open_hour, close_hour = template["schedule"]
    solar_kw = template["solar_kw"]
    assumptions = {
        "load_allocations_percent": {
            "hvac": hvac,
            "lighting": lighting,
            "it_plug": it_plug,
            "other": other,
        },
        "hvac": {
            "chiller_share_percent": 60,
            "ahu_share_percent": 25,
            "other_hvac_percent": 15,
            "cooling_setpoint_c": 23.0,
            "fan_command_percent": 60,
            "illustrative_cop": 3.2,
            "enabled": True,
            "mode": "comfort",
        },
        "floors": [
            {"id": "ground", "label": "Ground", "allocation_percent": 34},
            {"id": "level_1", "label": "Level 1", "allocation_percent": 33},
            {"id": "roof", "label": "Roof", "allocation_percent": 33},
        ],
        "operating_schedule": {
            "weekday_open_hour": open_hour,
            "weekday_close_hour": close_hour,
            "weekend_mode": "same_as_weekday" if use == "Lodging/residential" else "reduced_demo_schedule",
            "timezone": asset.get("timezone", "UTC"),
        },
        "microgrid": {
            "solar_capacity_kw": solar_kw,
            "profile": "hypothetical_sine_06_18_source_local",
            "battery_capacity_kwh": 250,
            "battery_power_kw": 75,
            "starting_soc_percent": 50,
            "round_trip_leg_efficiency": 0.95,
            "target_peak_fraction": 0.85,
        },
        "flexible_load": {"energy_kwh": 40, "from_interval": 18, "to_interval": 3},
        "impact": {
            "currency_code": "MYR",
            "tariff_myr_per_kwh": 0.50,
            "carbon_kg_per_kwh": 0.55,
            "assumption_reference": "EnergiOS user-editable demonstration assumption; not an applicable tariff or official emission factor.",
        },
        "investments": [
            {
                "name": "Illustrative load-management project",
                "capex_myr": 80000,
                "expected_annual_energy_change_kwh": 24000,
                "annual_operating_cost_change_myr": 1200,
            },
            {
                "name": "Illustrative lighting project",
                "capex_myr": 45000,
                "expected_annual_energy_change_kwh": 18000,
                "annual_operating_cost_change_myr": 600,
            },
        ],
    }
    return {
        "scenario_version": SCENARIO_VERSION,
        "classification": "simulated_demonstration_assumption",
        "label": "Simulated demonstration assumption",
        "asset_id": asset["id"],
        "asset_label": asset.get("source_asset_id") or asset.get("name"),
        "asset_timezone": asset.get("timezone"),
        "source": deepcopy(ASSUMPTION_SOURCE),
        "assumptions": assumptions,
        "formulas": {
            "equipment_allocation": "observed interval kWh × editable allocation percent / 100",
            "floor_allocation": "observed interval kWh × editable floor percent / 100; floor percentages must total 100%",
            "flat_cost": "energy kWh × editable tariff MYR/kWh",
            "carbon": "energy kWh × editable carbon factor kg CO2e/kWh",
            "simple_payback": "CAPEX MYR ÷ positive annual net benefit MYR/year",
        },
        "limitations": [
            "All profile values are user-editable demonstration assumptions, not BDG2 measurements.",
            "BDG2 supplies whole-building electricity only; equipment, floor, schedule, solar and battery values are simulated.",
            "Tariff, carbon and investment defaults are hypothetical and are not Malaysian market facts or verified savings.",
            "No value in this profile authorises or sends a BMS, SCADA or equipment command.",
        ],
    }
