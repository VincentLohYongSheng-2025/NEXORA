import hashlib
import json
from collections import Counter
from datetime import datetime, timedelta
from decimal import Decimal

import pytest

from src.seed import generate_seed, json_text, seed_sql, write_bundle


def test_repeatable_fixture_and_complete_unique_hourly_keys():
    dataset, manifest = generate_seed()
    assert (dataset, manifest) == generate_seed()
    assert manifest["counts"] == {"assets": 4, "meters": 7, "energy_readings": 4704,
                                  "alerts": 0, "scenarios": 0}
    assert {table: len(rows) for table, rows in dataset.items()} == {
        "assets": 4, "meters": 7, "energy_readings": 4704}
    keys = {(row["meter_id"], row["recorded_at"]) for row in dataset["energy_readings"]}
    assert len(keys) == 4704
    assert set(Counter(row["meter_id"] for row in dataset["energy_readings"]).values()) == {672}
    start = datetime.fromisoformat(manifest["start_utc"])
    expected_times = {(start + timedelta(hours=n)).isoformat().replace("+00:00", "Z")
                      for n in range(672)}
    for meter in dataset["meters"]:
        assert {time for meter_id, time in keys if meter_id == meter["id"]} == expected_times
    assert all(row["provenance"] == "synthetic_demo" and row["interval_minutes"] == 60
               and row["consumption_kwh"] >= 0 for row in dataset["energy_readings"])
    assert manifest["label"] == "Synthetic demonstration data"
    assert manifest["dataset_sha256"] == hashlib.sha256(json_text(dataset).encode()).hexdigest()


def test_focus_building_total_reconciles_every_hour_and_portfolio_excludes_floor_duplication():
    dataset, _ = generate_seed()
    focus = dataset["assets"][0]["id"]
    floors = [meter["id"] for meter in dataset["meters"]
              if meter["asset_id"] == focus and meter["meter_role"] == "floor"]
    assert len(floors) == 3
    total = next(meter["id"] for meter in dataset["meters"]
                 if meter["asset_id"] == focus and meter["meter_role"] == "building_total")
    readings = {(row["meter_id"], row["recorded_at"]): Decimal(str(row["consumption_kwh"]))
                for row in dataset["energy_readings"]}
    for timestamp in {time for _, time in readings}:
        assert readings[total, timestamp] == sum(readings[meter, timestamp] for meter in floors)
    # Each asset has exactly one authoritative total, including the three others.
    assert Counter(meter["asset_id"] for meter in dataset["meters"]
                   if meter["meter_role"] == "building_total") == Counter({asset["id"]: 1 for asset in dataset["assets"]})


def test_one_reproducible_after_hours_event_and_expected_metadata():
    dataset, manifest = generate_seed()
    event = manifest["anomaly"]
    assert event["event_id"] == "demo-after-hours-floor-2-v1"
    assert event["window_start"] == "2026-10-08T12:00:00Z"
    assert event["window_end"] == "2026-10-08T13:00:00Z"
    assert event["expected_rule_code"] == "AFTER_HOURS_EXCESS"
    assert event["expected_alert_count"] == 1
    assert event["observed_kwh"] == 65.1
    assert event["without_injection_kwh"] == 5.1
    assert Decimal(str(event["observed_kwh"])) - Decimal(str(event["without_injection_kwh"])) == 60
    local = datetime.fromisoformat(event["window_start"]) + timedelta(hours=8)
    assert local.hour == 20 and local.weekday() == 3
    meter = next(meter for meter in dataset["meters"] if meter["id"] == event["meter_id"])
    assert meter["floor_label"] == "Floor 2"
    # Only this independently generated floor interval exceeds its operating load.
    floor_ids = {row["id"] for row in dataset["meters"] if row["meter_role"] == "floor"}
    exceptional = [row for row in dataset["energy_readings"]
                   if row["meter_id"] in floor_ids and row["consumption_kwh"] > 30]
    assert [(row["meter_id"], row["recorded_at"]) for row in exceptional] == [(event["meter_id"], event["window_start"])]
    # Prior comparable weekday hours provide a baseline; injected hour is excluded.
    comparable = [row for row in dataset["energy_readings"]
                  if row["meter_id"] == event["meter_id"]
                  and row["recorded_at"] < event["window_start"]
                  and datetime.fromisoformat(row["recorded_at"]).hour == 12
                  and (datetime.fromisoformat(row["recorded_at"]) + timedelta(hours=8)).weekday() < 5]
    assert len(comparable) >= 5
    assert all(4.8 <= row["consumption_kwh"] <= 5.2 for row in comparable)


def test_offline_output_is_byte_stable_and_preserves_existing_work(tmp_path):
    output = tmp_path / "seed"
    assert write_bundle(output) == "created"
    before = {path.name: (path.read_bytes(), path.stat().st_mtime_ns) for path in output.iterdir()}
    assert write_bundle(output) == "unchanged"
    assert before == {path.name: (path.read_bytes(), path.stat().st_mtime_ns) for path in output.iterdir()}
    (output / "dataset.json").write_text("teammate work", encoding="utf-8")
    with pytest.raises(FileExistsError, match="No files overwritten"):
        write_bundle(output)
    assert (output / "dataset.json").read_text() == "teammate work"
    assert json.loads((output / "manifest.json").read_text())["counts"]["energy_readings"] == 4704


def test_export_does_not_seed_alerts_scenarios_or_change_security():
    dataset, _ = generate_seed()
    sql = seed_sql(dataset)
    assert sql.startswith("-- Synthetic demonstration data.") and sql.endswith("COMMIT;\n")
    assert "ON CONFLICT (meter_id, recorded_at) DO NOTHING" in sql
    assert "IS DISTINCT FROM" in sql
    assert "public.alerts" not in sql and "public.scenarios" not in sql
    assert not any(word in sql for word in ("DELETE FROM", "TRUNCATE", "DISABLE ROW", "GRANT "))
