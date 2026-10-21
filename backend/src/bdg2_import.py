"""Build the verified four-building BDG2 import bundle without database access."""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import os
import tempfile
import uuid
from datetime import datetime, timedelta, timezone
from decimal import Decimal, InvalidOperation
from importlib.metadata import version
from pathlib import Path
from zoneinfo import ZoneInfo

SOURCE_CODE = "bdg2_v1"
COHORT_CODE = "hog_four_buildings_v1"
SOURCE_TIMEZONE = "US/Central"
CANONICAL_TIMEZONE = "America/Chicago"
METADATA_SHA256 = "992d0b29f24f96ad4332bc4dbb534b7bdd7dd2689aad093f94e93068ecddca02"
ELECTRICITY_SHA256 = "b01056f4ceec1992ce019297e674d6d6ecd0240e50a2aaeb6f958c65efdc282d"
PINNED_COMMIT = "3d0cbaf7ba281029ce04887503ab56f3c8344575"
BUILDING_IDS = (
    "Hog_office_Bill",
    "Hog_education_Donnie",
    "Hog_assembly_Dona",
    "Hog_lodging_Francisco",
)
EXPECTED = {
    "source_timestamps": 17_544,
    "source_cells": 70_176,
    "non_null": 70_168,
    "missing": 8,
    "dst_quarantined": 16,
    "accepted": 70_152,
    "zero": 0,
    "invalid": 0,
}
NAMESPACE = uuid.uuid5(uuid.NAMESPACE_URL, "https://doi.org/10.5281/zenodo.3887306")


def stable_uuid(kind: str, source_id: str) -> str:
    return str(uuid.uuid5(NAMESPACE, f"{SOURCE_CODE}|{kind}|{source_id}"))


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def utc_text(value: datetime) -> str:
    return value.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


def normalise_timestamp(naive: datetime, source_zone: ZoneInfo, canonical_zone: ZoneInfo):
    if naive.tzinfo is not None:
        raise ValueError("BDG2 source timestamps must be naive local times")
    candidates = []
    for fold in (0, 1):
        aware = naive.replace(tzinfo=canonical_zone, fold=fold)
        instant = aware.astimezone(timezone.utc)
        if instant.astimezone(canonical_zone).replace(tzinfo=None) == naive:
            candidates.append((instant, aware.utcoffset()))
    unique = {(instant, offset) for instant, offset in candidates}
    if not unique:
        return None, "nonexistent"
    if len({instant for instant, _ in unique}) > 1:
        return None, "ambiguous"
    instant = next(iter(unique))[0]
    if naive.replace(tzinfo=source_zone, fold=0).utcoffset() != instant.astimezone(canonical_zone).utcoffset():
        raise ValueError(f"Timezone alias mismatch at {naive.isoformat()}")
    return instant, None


def load_metadata(path: Path):
    with path.open(encoding="utf-8-sig", newline="") as stream:
        selected = {row["building_id"]: row for row in csv.DictReader(stream)
                    if row["building_id"] in BUILDING_IDS}
    if set(selected) != set(BUILDING_IDS):
        raise ValueError("The metadata file does not contain the exact approved cohort")
    assets = []
    meters = []
    for building_id in BUILDING_IDS:
        row = selected[building_id]
        if row["site_id"] != "Hog" or row["timezone"] != SOURCE_TIMEZONE or row["electricity"] != "Yes":
            raise ValueError(f"Unexpected source mapping for {building_id}")
        area = Decimal(row["sqm"])
        if not area.is_finite() or area <= 0:
            raise ValueError(f"Invalid floor area for {building_id}")
        asset_id = stable_uuid("asset", building_id)
        meter_source_id = f"{building_id}:electricity"
        assets.append({
            "id": asset_id,
            "name": building_id,
            "asset_type": row["primaryspaceusage"],
            "floor_area_m2": str(area),
            "timezone": SOURCE_TIMEZONE,
            "data_status": "public_benchmark",
            "source_asset_id": building_id,
            "source_site_id": row["site_id"],
            "primary_space_usage": row["primaryspaceusage"],
        })
        meters.append({
            "id": stable_uuid("meter", meter_source_id),
            "asset_id": asset_id,
            "floor_label": None,
            "meter_role": "building_total",
            "source_kind": "public_benchmark",
            "is_active": True,
            "source_meter_id": meter_source_id,
            "unit": "kWh",
            "reading_semantics": "interval_sum",
        })
    return assets, meters


def load_readings(path: Path, meters):
    source_zone = ZoneInfo(SOURCE_TIMEZONE)
    canonical_zone = ZoneInfo(CANONICAL_TIMEZONE)
    meter_by_building = {meter["source_meter_id"].removesuffix(":electricity"): meter for meter in meters}
    readings = []
    missing = zero = invalid = dst_quarantined = source_timestamps = 0
    per_meter = {building_id: {"accepted": 0, "missing": 0, "dst_quarantined": 0,
                               "zero": 0, "sum_kwh": Decimal(0), "first_utc": None,
                               "last_utc": None}
                 for building_id in BUILDING_IDS}
    previous_local = None
    local_keys = set()
    with path.open(encoding="utf-8-sig", newline="") as stream:
        reader = csv.DictReader(stream)
        if reader.fieldnames is None or not set(BUILDING_IDS).issubset(reader.fieldnames):
            raise ValueError("The electricity file does not contain the exact approved cohort")
        for row in reader:
            source_timestamps += 1
            if source_timestamps > EXPECTED["source_timestamps"]:
                raise ValueError("Source timestamp limit exceeded")
            naive = datetime.fromisoformat(row["timestamp"])
            if previous_local is not None and naive != previous_local + timedelta(hours=1):
                raise ValueError(f"Unexpected source interval at {naive.isoformat()}")
            previous_local = naive
            local_text = naive.isoformat(timespec="seconds")
            if local_text in local_keys:
                raise ValueError(f"Duplicate source timestamp {local_text}")
            local_keys.add(local_text)
            utc_instant, dst_reason = normalise_timestamp(naive, source_zone, canonical_zone)
            for building_id in BUILDING_IDS:
                raw = row[building_id].strip()
                stats = per_meter[building_id]
                if not raw:
                    missing += 1
                    stats["missing"] += 1
                    continue
                try:
                    value = Decimal(raw)
                except InvalidOperation as error:
                    invalid += 1
                    raise ValueError(f"Invalid value for {building_id} at {local_text}") from error
                if not value.is_finite() or value < 0:
                    invalid += 1
                    raise ValueError(f"Invalid value for {building_id} at {local_text}")
                if dst_reason:
                    dst_quarantined += 1
                    stats["dst_quarantined"] += 1
                    continue
                if value == 0:
                    zero += 1
                    stats["zero"] += 1
                meter = meter_by_building[building_id]
                recorded_at = utc_text(utc_instant)
                readings.append({
                    "meter_id": meter["id"],
                    "recorded_at": recorded_at,
                    "interval_minutes": 60,
                    "consumption_kwh": str(value),
                    "provenance": "public_benchmark",
                    "source_local_timestamp": local_text,
                    "source_timezone": SOURCE_TIMEZONE,
                    "source_record_key": f"{SOURCE_CODE}|electricity|{building_id}|{local_text}",
                    "quality_status": "observed_zero" if value == 0 else "observed",
                })
                stats["accepted"] += 1
                stats["sum_kwh"] += value
                stats["first_utc"] = stats["first_utc"] or recorded_at
                stats["last_utc"] = recorded_at
    counts = {
        "source_timestamps": source_timestamps,
        "source_cells": source_timestamps * len(BUILDING_IDS),
        "non_null": source_timestamps * len(BUILDING_IDS) - missing,
        "missing": missing,
        "dst_quarantined": dst_quarantined,
        "accepted": len(readings),
        "zero": zero,
        "invalid": invalid,
    }
    if counts != EXPECTED:
        raise ValueError(f"Cohort counts differ from the approved bounds: {counts}")
    for stats in per_meter.values():
        stats["sum_kwh"] = str(stats["sum_kwh"])
    return readings, counts, per_meter


def build_bundle(source_dir: Path):
    metadata_path = source_dir / "metadata.csv"
    electricity_path = source_dir / "electricity_cleaned.csv"
    hashes = {"metadata_sha256": sha256(metadata_path), "electricity_sha256": sha256(electricity_path)}
    if hashes != {"metadata_sha256": METADATA_SHA256, "electricity_sha256": ELECTRICITY_SHA256}:
        raise ValueError("BDG2 source hash mismatch")
    assets, meters = load_metadata(metadata_path)
    readings, counts, per_meter = load_readings(electricity_path, meters)
    source_id = stable_uuid("source", SOURCE_CODE)
    run_id = stable_uuid("import_run", COHORT_CODE)
    for row in (*assets, *meters, *readings):
        row["data_source_id"] = source_id
        row["import_run_id"] = run_id
    data_source = {
        "id": source_id,
        "source_code": SOURCE_CODE,
        "title": "Building Data Genome Project 2",
        "version": "v1.0",
        "doi": "10.5281/zenodo.3887306",
        "licence_spdx": "CC-BY-4.0",
        "attribution_label": "Public benchmark data — Building Data Genome Project 2 v1.0",
        "repository_url": "https://github.com/buds-lab/building-data-genome-project-2",
        "pinned_commit": PINNED_COMMIT,
        **hashes,
        "limitations_json": {
            "whole_building_only": True,
            "not_sime_darby_or_elmina": True,
            "no_floor_room_equipment_schedule_or_hvac_cause": True,
        },
    }
    manifest = {
        "source_code": SOURCE_CODE,
        "cohort_code": COHORT_CODE,
        "data_source_id": source_id,
        "import_run_id": run_id,
        "building_ids": list(BUILDING_IDS),
        "source_timezone": SOURCE_TIMEZONE,
        "normalization_timezone": CANONICAL_TIMEZONE,
        "tzdata_version": version("tzdata"),
        "unit": "kWh",
        "reading_semantics": "interval_sum",
        "interval_minutes": 60,
        "counts": counts,
        "per_meter": per_meter,
        **hashes,
        "readings_sha256": hashlib.sha256("\n".join(
            json.dumps(row, sort_keys=True, separators=(",", ":")) for row in readings
        ).encode()).hexdigest(),
    }
    return data_source, assets, meters, readings, manifest


def write_bundle(source_dir: Path, output_dir: Path):
    data_source, assets, meters, readings, manifest = build_bundle(source_dir)
    documents = {
        "data_source.json": json.dumps(data_source, indent=2, sort_keys=True) + "\n",
        "assets.json": json.dumps(assets, indent=2, sort_keys=True) + "\n",
        "meters.json": json.dumps(meters, indent=2, sort_keys=True) + "\n",
        "manifest.json": json.dumps(manifest, indent=2, sort_keys=True) + "\n",
        "readings.ndjson": "".join(json.dumps(row, sort_keys=True, separators=(",", ":")) + "\n"
                                     for row in readings),
    }
    if output_dir.exists():
        if all((output_dir / name).is_file() and (output_dir / name).read_text(encoding="utf-8") == text
               for name, text in documents.items()):
            return "unchanged", manifest
        raise FileExistsError("Output exists with different content; no files overwritten")
    output_dir.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="energios-bdg2-", dir=output_dir.parent) as temporary:
        bundle = Path(temporary) / "bundle"
        bundle.mkdir()
        for name, text in documents.items():
            (bundle / name).write_text(text, encoding="utf-8", newline="\n")
        os.rename(bundle, output_dir)
    return "created", manifest


def main():
    root = Path(__file__).resolve().parents[2]
    parser = argparse.ArgumentParser(description="Build the verified BDG2 public-benchmark import bundle")
    parser.add_argument("--source-dir", type=Path, default=root / "data/source/bdg2-v1")
    parser.add_argument("--output-dir", type=Path, default=root / "data/local/bdg2-cohort-v1")
    args = parser.parse_args()
    status, manifest = write_bundle(args.source_dir, args.output_dir)
    print(json.dumps({"status": status, "counts": manifest["counts"],
                      "tzdata_version": manifest["tzdata_version"]}, sort_keys=True))


if __name__ == "__main__":
    main()
