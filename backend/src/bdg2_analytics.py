"""Small, deterministic BDG2 forecast benchmark and anomaly detector.

The module reads only the verified local BDG2 import bundle.  It uses rolling
24-hour forecast origins, a seasonal hour-of-week profile, and a previous-day
same-hour baseline.  Validation residuals set the anomaly threshold; test
observations never tune the model or threshold.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import statistics
from collections import defaultdict
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Iterable


MODEL_VERSION = "bdg2_seasonal_baseline_blend_v1"
BASELINE_VERSION = "previous_day_same_hour_v1"
ANOMALY_RULE_VERSION = "validation_residual_mad_v1"
HORIZON_HOURS = 24
SEASONAL_HOURS = 168
MIN_LEVEL_OBSERVATIONS = 18
MAD_SCALE = 1.4826
ANOMALY_MULTIPLIER = 6.0
EXPECTED_SOURCE_CODE = "bdg2_v1"
EXPECTED_PROVENANCE = "public_benchmark"
ATTRIBUTION = "Public benchmark data — Building Data Genome Project 2 v1.0"


@dataclass(frozen=True)
class Point:
    timestamp: datetime
    value: float


@dataclass(frozen=True)
class Split:
    start: datetime
    train_end: datetime
    validation_end: datetime
    end: datetime


@dataclass(frozen=True)
class SeasonalProfile:
    by_hour_of_week: tuple[float, ...]
    overall_mean: float

    def expected(self, timestamp: datetime) -> float:
        value = self.by_hour_of_week[timestamp.weekday() * 24 + timestamp.hour]
        return value if math.isfinite(value) else self.overall_mean


def parse_utc(value: str) -> datetime:
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if parsed.tzinfo is None or parsed.utcoffset() != timedelta(0):
        raise ValueError(f"Expected a UTC timestamp: {value}")
    return parsed.astimezone(timezone.utc)


def utc_text(value: datetime) -> str:
    return value.astimezone(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def load_verified_bundle(bundle_dir: Path) -> tuple[dict, dict[str, str], dict[str, list[Point]]]:
    manifest = json.loads((bundle_dir / "manifest.json").read_text(encoding="utf-8"))
    meters = json.loads((bundle_dir / "meters.json").read_text(encoding="utf-8"))
    if manifest.get("source_code") != EXPECTED_SOURCE_CODE:
        raise ValueError("Analytics input is not the approved BDG2 v1 source")
    if manifest.get("unit") != "kWh" or manifest.get("reading_semantics") != "interval_sum":
        raise ValueError("Analytics requires hourly interval kWh readings")
    if manifest.get("interval_minutes") != 60:
        raise ValueError("Analytics requires 60-minute readings")

    meter_names = {row["id"]: row["source_meter_id"] for row in meters}
    if len(meter_names) != 4 or any(row.get("source_kind") != EXPECTED_PROVENANCE for row in meters):
        raise ValueError("Meter catalogue differs from the verified four-meter cohort")

    series: dict[str, list[Point]] = defaultdict(list)
    canonical_rows: list[str] = []
    with (bundle_dir / "readings.ndjson").open(encoding="utf-8") as stream:
        for line in stream:
            if not line.strip():
                continue
            row = json.loads(line)
            if row.get("provenance") != EXPECTED_PROVENANCE or row.get("quality_status") != "observed":
                raise ValueError("Only observed public-benchmark readings may be used")
            if row.get("data_source_id") != manifest["data_source_id"]:
                raise ValueError("Reading source does not match the verified manifest")
            if row.get("import_run_id") != manifest["import_run_id"]:
                raise ValueError("Reading import run does not match the verified manifest")
            if row.get("interval_minutes") != 60 or row["meter_id"] not in meter_names:
                raise ValueError("Reading shape differs from the verified cohort")
            value = float(row["consumption_kwh"])
            if not math.isfinite(value) or value < 0:
                raise ValueError("Invalid consumption value")
            series[row["meter_id"]].append(Point(parse_utc(row["recorded_at"]), value))
            canonical_rows.append(json.dumps(row, sort_keys=True, separators=(",", ":")))

    digest = hashlib.sha256("\n".join(canonical_rows).encode()).hexdigest()
    if digest != manifest.get("readings_sha256"):
        raise ValueError("Reading content hash does not match the verified manifest")
    if sum(map(len, series.values())) != manifest["counts"]["accepted"]:
        raise ValueError("Reading count does not match the verified manifest")
    for meter_id, points in series.items():
        points.sort(key=lambda point: point.timestamp)
        if len({point.timestamp for point in points}) != len(points):
            raise ValueError(f"Duplicate timestamp for {meter_names[meter_id]}")
    return manifest, meter_names, dict(series)


def chronological_split(series: dict[str, list[Point]]) -> Split:
    start = min(points[0].timestamp for points in series.values())
    last = max(points[-1].timestamp for points in series.values())
    end = last + timedelta(hours=1)
    total_days = int((end - start).total_seconds() // 86_400)
    if total_days < 30:
        raise ValueError("At least 30 complete days are required")
    train_days = int(total_days * 0.60)
    validation_days = int(total_days * 0.20)
    split = Split(
        start=start,
        train_end=start + timedelta(days=train_days),
        validation_end=start + timedelta(days=train_days + validation_days),
        end=end,
    )
    if not split.start < split.train_end < split.validation_end < split.end:
        raise ValueError("Chronological split is not strictly ordered")
    return split


def fit_profile(points: Iterable[Point], end_exclusive: datetime) -> SeasonalProfile:
    buckets: list[list[float]] = [[] for _ in range(SEASONAL_HOURS)]
    values: list[float] = []
    for point in points:
        if point.timestamp >= end_exclusive:
            continue
        values.append(point.value)
        buckets[point.timestamp.weekday() * 24 + point.timestamp.hour].append(point.value)
    if not values:
        raise ValueError("Training split contains no readings")
    overall = statistics.fmean(values)
    profile = tuple(statistics.fmean(bucket) if bucket else overall for bucket in buckets)
    return SeasonalProfile(profile, overall)


def forecast_24(profile: SeasonalProfile, history: dict[datetime, float], origin: datetime) -> list[float]:
    residuals = []
    for hours_back in range(1, HORIZON_HOURS + 1):
        timestamp = origin - timedelta(hours=hours_back)
        if timestamp in history:
            residuals.append(history[timestamp] - profile.expected(timestamp))
    correction = statistics.fmean(residuals) if len(residuals) >= MIN_LEVEL_OBSERVATIONS else 0.0
    return [max(0.0, profile.expected(origin + timedelta(hours=offset)) + correction)
            for offset in range(HORIZON_HOURS)]


def metrics(actual: list[float], predicted: list[float]) -> dict[str, float | int]:
    if len(actual) != len(predicted) or not actual:
        raise ValueError("Metrics require equal, non-empty arrays")
    errors = [observed - expected for observed, expected in zip(actual, predicted, strict=True)]
    return {
        "n": len(errors),
        "mae_kwh": round(statistics.fmean(abs(error) for error in errors), 6),
        "rmse_kwh": round(math.sqrt(statistics.fmean(error * error for error in errors)), 6),
    }


def evaluate_window(
    points: list[Point], profile: SeasonalProfile, start: datetime, end: datetime
) -> tuple[list[float], list[float], list[float], list[dict]]:
    observed = {point.timestamp: point.value for point in points}
    actual: list[float] = []
    model: list[float] = []
    baseline: list[float] = []
    rows: list[dict] = []
    origin = start
    while origin < end:
        predictions = forecast_24(profile, observed, origin)
        for offset, prediction in enumerate(predictions):
            timestamp = origin + timedelta(hours=offset)
            if timestamp >= end or timestamp not in observed:
                continue
            baseline_timestamp = timestamp - timedelta(hours=24)
            if baseline_timestamp not in observed:
                continue
            actual.append(observed[timestamp])
            model.append(prediction)
            baseline.append(observed[baseline_timestamp])
            rows.append({
                "timestamp": timestamp,
                "actual": observed[timestamp],
                "prediction": prediction,
                "baseline": observed[baseline_timestamp],
                "residual": observed[timestamp] - prediction,
            })
        origin += timedelta(hours=HORIZON_HOURS)
    if not rows:
        raise ValueError("Evaluation window contains no comparable readings")
    return actual, model, baseline, rows


def select_blend(validation_rows: list[dict]) -> float:
    """Select the seasonal-profile share using validation RMSE only."""
    best: tuple[float, float] | None = None
    for integer_weight in range(11):
        weight = integer_weight / 10
        squared_errors = []
        for row in validation_rows:
            blended = weight * row["prediction"] + (1.0 - weight) * row["baseline"]
            squared_errors.append((row["actual"] - blended) ** 2)
        score = statistics.fmean(squared_errors)
        candidate = (score, weight)
        if best is None or candidate < best:
            best = candidate
    assert best is not None
    return best[1]


def apply_blend(rows: list[dict], seasonal_weight: float) -> tuple[list[float], list[float], list[dict]]:
    actual = []
    predicted = []
    blended_rows = []
    for row in rows:
        prediction = seasonal_weight * row["prediction"] + (1.0 - seasonal_weight) * row["baseline"]
        actual.append(row["actual"])
        predicted.append(prediction)
        blended_rows.append({**row, "prediction": prediction, "residual": row["actual"] - prediction})
    return actual, predicted, blended_rows


def robust_threshold(validation_residuals: list[float]) -> tuple[float, float, float]:
    center = statistics.median(validation_residuals)
    mad = statistics.median(abs(value - center) for value in validation_residuals)
    threshold = max(ANOMALY_MULTIPLIER * MAD_SCALE * mad, 1e-9)
    return center, mad, threshold


def detect_anomalies(rows: list[dict], center: float, threshold: float, meter_name: str) -> list[dict]:
    detected = []
    for row in rows:
        deviation = abs(row["residual"] - center)
        if deviation <= threshold:
            continue
        timestamp = utc_text(row["timestamp"])
        stable_id = hashlib.sha256(
            f"{ANOMALY_RULE_VERSION}|{meter_name}|{timestamp}".encode()
        ).hexdigest()[:24]
        detected.append({
            "id": stable_id,
            "meter_source_id": meter_name,
            "timestamp": timestamp,
            "label": "unusual_consumption_pattern",
            "direction": "above_expected" if row["residual"] > center else "below_expected",
            "observed_kwh": round(row["actual"], 6),
            "forecast_kwh": round(row["prediction"], 6),
            "residual_kwh": round(row["residual"], 6),
            "absolute_centered_residual_kwh": round(deviation, 6),
            "threshold_kwh": round(threshold, 6),
            "cause": None,
        })
    return detected


def evaluate_series(manifest: dict, meter_names: dict[str, str], series: dict[str, list[Point]]) -> dict:
    """Evaluate already validated database readings without file-system fallback."""
    if manifest.get("source_code") != EXPECTED_SOURCE_CODE:
        raise ValueError("Analytics input is not the approved BDG2 v1 source")
    if manifest.get("unit") != "kWh" or manifest.get("reading_semantics") != "interval_sum":
        raise ValueError("Analytics requires hourly interval kWh readings")
    if len(series) != 4 or set(series) != set(meter_names):
        raise ValueError("Analytics requires the verified four-meter cohort")
    split = chronological_split(series)
    per_meter = {}
    anomalies = []
    forecasts = []
    pooled_actual: list[float] = []
    pooled_model: list[float] = []
    pooled_baseline: list[float] = []

    for meter_id in sorted(series, key=lambda item: meter_names[item]):
        points = series[meter_id]
        train_profile = fit_profile(points, split.train_end)
        val_actual, _val_seasonal, val_baseline, val_rows = evaluate_window(
            points, train_profile, split.train_end, split.validation_end
        )
        seasonal_weight = select_blend(val_rows)
        val_actual, val_model, val_rows = apply_blend(val_rows, seasonal_weight)
        center, mad, threshold = robust_threshold([row["residual"] for row in val_rows])

        final_profile = fit_profile(points, split.validation_end)
        test_actual, _test_seasonal, test_baseline, test_rows = evaluate_window(
            points, final_profile, split.validation_end, split.end
        )
        test_actual, test_model, test_rows = apply_blend(test_rows, seasonal_weight)
        meter_anomalies = detect_anomalies(test_rows, center, threshold, meter_names[meter_id])
        anomalies.extend(meter_anomalies)
        pooled_actual.extend(test_actual)
        pooled_model.extend(test_model)
        pooled_baseline.extend(test_baseline)

        history = {point.timestamp: point.value for point in points}
        next_seasonal = forecast_24(fit_profile(points, split.end), history, split.end)
        next_values = [
            seasonal_weight * seasonal
            + (1.0 - seasonal_weight)
            * history[split.end - timedelta(hours=24) + timedelta(hours=offset)]
            for offset, seasonal in enumerate(next_seasonal)
        ]
        for offset, value in enumerate(next_values):
            forecasts.append({
                "meter_source_id": meter_names[meter_id],
                "timestamp": utc_text(split.end + timedelta(hours=offset)),
                "forecast_kwh": round(value, 6),
            })

        per_meter[meter_names[meter_id]] = {
            "train_readings": sum(point.timestamp < split.train_end for point in points),
            "validation_readings": sum(split.train_end <= point.timestamp < split.validation_end for point in points),
            "test_readings": sum(split.validation_end <= point.timestamp < split.end for point in points),
            "validation_model": metrics(val_actual, val_model),
            "validation_baseline": metrics(val_actual, val_baseline),
            "test_model": metrics(test_actual, test_model),
            "test_baseline": metrics(test_actual, test_baseline),
            "anomaly_rule": {
                "validation_residual_center_kwh": round(center, 6),
                "validation_residual_mad_kwh": round(mad, 6),
                "threshold_kwh": round(threshold, 6),
                "test_anomaly_count": len(meter_anomalies),
            },
            "selected_seasonal_weight": seasonal_weight,
        }

    anomalies.sort(key=lambda row: (row["timestamp"], row["meter_source_id"]))
    forecasts.sort(key=lambda row: (row["meter_source_id"], row["timestamp"]))
    return {
        "source": {
            "source_code": manifest["source_code"],
            "cohort_code": manifest["cohort_code"],
            "readings_sha256": manifest["readings_sha256"],
            "provenance": EXPECTED_PROVENANCE,
            "attribution": ATTRIBUTION,
            "unit": "kWh",
            "reading_semantics": "interval_sum",
        },
        "method": {
            "model_version": MODEL_VERSION,
            "description": "validation-selected blend of a 168-hour seasonal profile and the previous-day value; seasonal profile has a trailing-24-hour residual level correction",
            "baseline_version": BASELINE_VERSION,
            "baseline_description": "observed consumption exactly 24 hours earlier",
            "anomaly_rule_version": ANOMALY_RULE_VERSION,
            "anomaly_rule_description": "absolute centered forecast residual above 6 x 1.4826 x validation MAD",
            "horizon_hours": HORIZON_HOURS,
            "evaluation": "rolling non-overlapping 24-hour origins; prior observations only",
        },
        "split": {
            "train_start": utc_text(split.start),
            "train_end_exclusive": utc_text(split.train_end),
            "validation_start": utc_text(split.train_end),
            "validation_end_exclusive": utc_text(split.validation_end),
            "test_start": utc_text(split.validation_end),
            "test_end_exclusive": utc_text(split.end),
        },
        "overall_test": {
            "model": metrics(pooled_actual, pooled_model),
            "baseline": metrics(pooled_actual, pooled_baseline),
            "anomaly_count": len(anomalies),
        },
        "per_meter": per_meter,
        "next_24h_forecasts": forecasts,
        "test_anomalies": anomalies,
        "limitations": [
            "Results apply only to the selected BDG2 public benchmark cohort, not Sime Darby or Elmina Lakeside Mall.",
            "Whole-building interval kWh does not identify floors, rooms, equipment, operating schedules, causes, tariffs, savings, or HVAC faults.",
            "Anomalies are statistical unusual-consumption patterns and do not establish waste, faults, or causes.",
            "The model uses energy history only and is a small hackathon benchmark, not a production forecasting system.",
        ],
    }


def evaluate_bundle(bundle_dir: Path) -> dict:
    manifest, meter_names, series = load_verified_bundle(bundle_dir)
    return evaluate_series(manifest, meter_names, series)


def write_report(bundle_dir: Path, output_path: Path) -> tuple[str, dict]:
    report = evaluate_bundle(bundle_dir)
    content = json.dumps(report, indent=2, sort_keys=True) + "\n"
    if output_path.exists() and output_path.read_text(encoding="utf-8") == content:
        return "unchanged", report
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(content, encoding="utf-8", newline="\n")
    return "written", report


def main() -> None:
    root = Path(__file__).resolve().parents[2]
    parser = argparse.ArgumentParser(description="Evaluate the verified BDG2 forecast/anomaly benchmark")
    parser.add_argument("--bundle-dir", type=Path, default=root / "data/local/bdg2-cohort-v1")
    parser.add_argument("--output", type=Path, default=root / "data/local/bdg2-analytics-v1/report.json")
    args = parser.parse_args()
    status, report = write_report(args.bundle_dir, args.output)
    print(json.dumps({"status": status, "overall_test": report["overall_test"]}, sort_keys=True))


if __name__ == "__main__":
    main()
