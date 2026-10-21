"""Offline deterministic demo fixture. No environment reads or network access."""

import argparse
import hashlib
import json
import os
import random
import tempfile
from datetime import datetime, timedelta, timezone
from pathlib import Path

MANIFEST_PATH = Path(__file__).resolve().parents[1] / "seed_manifest.json"
DEFAULT_OUTPUT = Path(__file__).resolve().parents[2] / "data/generated/seed-v1"


def json_text(value):
    return json.dumps(value, indent=2, sort_keys=True, allow_nan=False) + "\n"


def utc_text(value):
    return value.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


def generate_seed():
    """Return independent rows and provenance metadata from the versioned fixture."""
    spec = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    rng = random.Random(spec["random_seed"])
    local_zone = timezone(timedelta(minutes=spec["utc_offset_minutes"]))
    start = datetime.fromisoformat(spec["start_utc"])
    schedule = spec["operating_schedule"]
    anomaly = spec["anomaly"]
    assets = [dict(asset, timezone=spec["timezone"], data_status=spec["provenance"])
              for asset in spec["assets"]]
    meters = [{key: meter[key] for key in ("id", "asset_id", "floor_label", "meter_role")}
              | {"source_kind": spec["provenance"], "is_active": True}
              for meter in spec["meters"]]
    readings = []
    injected = []
    for hour in range(spec["days"] * 24):
        instant = start + timedelta(hours=hour)
        timestamp = utc_text(instant)
        local = instant.astimezone(local_zone)
        operating = (local.weekday() in schedule["weekdays"]
                     and schedule["start_hour_local"] <= local.hour
                     < schedule["end_hour_local_exclusive"])
        # Integer tenths make the derived building total exactly equal its floors.
        values = {}
        for meter in spec["meters"]:
            if "derived_from" in meter:
                continue
            base = meter["operating_kwh" if operating else "after_hours_kwh"] * 10
            value = base + rng.randint(-2, 2)
            if meter["id"] == anomaly["meter_id"] and timestamp == anomaly["window_start"]:
                if operating:
                    raise ValueError("The fixture anomaly must be after hours.")
                injected.append({"meter_id": meter["id"], "recorded_at": timestamp,
                                 "without_injection_kwh": value / 10})
                value += anomaly["added_kwh"] * 10
            values[meter["id"]] = value
        for meter in spec["meters"]:
            if "derived_from" in meter:
                values[meter["id"]] = sum(values[key] for key in meter["derived_from"])
            readings.append({"meter_id": meter["id"], "recorded_at": timestamp,
                             "interval_minutes": spec["interval_minutes"],
                             "consumption_kwh": values[meter["id"]] / 10,
                             "provenance": spec["provenance"]})
    if len(injected) != 1:
        raise ValueError("Exactly one injected source interval is required.")
    dataset = {"assets": assets, "meters": meters, "energy_readings": readings}
    counts = {table: len(rows) for table, rows in dataset.items()} | {"alerts": 0, "scenarios": 0}
    if counts != spec["expected_counts"]:
        raise ValueError("Generated counts do not match the versioned manifest.")
    event_reading = next(row for row in readings if row["meter_id"] == anomaly["meter_id"]
                         and row["recorded_at"] == anomaly["window_start"])
    run_manifest = {
        "generator_version": spec["generator_version"],
        "random_seed": spec["random_seed"], "label": spec["label"],
        "provenance": spec["provenance"], "timezone": spec["timezone"],
        "start_utc": spec["start_utc"],
        "end_utc_exclusive": utc_text(start + timedelta(days=spec["days"])),
        "counts": counts, "assets": assets, "meters": meters,
        "operating_schedule": schedule,
        "anomaly": anomaly | injected[0] | {"observed_kwh": event_reading["consumption_kwh"]},
        "dataset_sha256": hashlib.sha256(json_text(dataset).encode()).hexdigest(),
        "expected_alert_status": "planned; not inserted or detected by seed generation",
        "aggregation": "Use building_total; never add diagnostic floors to that total.",
    }
    return dataset, run_manifest


def seed_sql(dataset):
    """Export atomic insert-only SQL; identical conflicts are no-ops, differing ones fail."""
    statements = [
        "-- Synthetic demonstration data. Offline export; not automatically applied.",
        "-- Apply only after backend Supabase environment configuration is complete.",
        "BEGIN;",
        "-- Prevent competing writers between conflict inspection and inserts.",
        "LOCK TABLE public.assets, public.meters, public.energy_readings IN SHARE ROW EXCLUSIVE MODE;",
    ]
    for table, rows in dataset.items():
        columns = list(rows[0])
        column_sql = ", ".join(columns)
        # Staging deliberately excludes target defaults/constraints/indexes.
        statements.append(f"CREATE TEMP TABLE seed_{table} ON COMMIT DROP AS "
                          f"SELECT {column_sql} FROM public.{table} WITH NO DATA;")
        payload = json.dumps(rows, separators=(",", ":"), allow_nan=False).replace("'", "''")
        statements.append(f"INSERT INTO seed_{table} ({column_sql}) SELECT {column_sql} "
                          f"FROM jsonb_populate_recordset(NULL::seed_{table}, '{payload}'::jsonb);")
        keys = ["meter_id", "recorded_at"] if table == "energy_readings" else ["id"]
        join_sql = " AND ".join(f"existing.{key}=incoming.{key}" for key in keys)
        existing = ", ".join(f"existing.{key}" for key in columns)
        incoming = ", ".join(f"incoming.{key}" for key in columns)
        statements.append(f"DO $$ BEGIN IF EXISTS (SELECT 1 FROM public.{table} existing "
                          f"JOIN seed_{table} incoming ON {join_sql} "
                          f"WHERE ROW({existing}) IS DISTINCT FROM ROW({incoming})) THEN "
                          f"RAISE EXCEPTION 'Conflicting EnergiOS fixture rows in {table}; no data overwritten'; "
                          "END IF; END $$;")
        statements.append(f"INSERT INTO public.{table} ({column_sql}) "
                          f"SELECT {column_sql} FROM seed_{table} "
                          f"ON CONFLICT ({', '.join(keys)}) DO NOTHING;")
    statements.append("COMMIT;")
    return "\n".join(statements) + "\n"


def write_bundle(output):
    """Preserve existing files; unchanged reruns do not write anything."""
    dataset, manifest = generate_seed()
    contents = {"dataset.json": json_text(dataset), "manifest.json": json_text(manifest),
                "seed.sql": seed_sql(dataset)}
    output = Path(output)
    if output.exists():
        if all((output / name).is_file() and (output / name).read_bytes() == text.encode()
               for name, text in contents.items()):
            return "unchanged"
        raise FileExistsError("Output differs or is incomplete; choose a new empty output path. No files overwritten.")
    output.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="energios-seed-", dir=output.parent) as temporary:
        bundle = Path(temporary) / "bundle"
        bundle.mkdir()
        for name, text in contents.items():
            (bundle / name).write_bytes(text.encode("utf-8"))
        os.rename(bundle, output)
    return "created"


def main():
    parser = argparse.ArgumentParser(description="Generate offline synthetic demo files; never connects to Supabase.")
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    args = parser.parse_args()
    try:
        status = write_bundle(args.output)
    except FileExistsError as error:
        parser.exit(1, f"{error}\n")
    print(f"Synthetic demonstration data: {status}; 4 assets, 7 meters, 4704 hourly readings. No database writes.")


if __name__ == "__main__":
    main()
