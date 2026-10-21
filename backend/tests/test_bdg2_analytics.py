import json
from datetime import datetime, timedelta, timezone
from pathlib import Path

from src.bdg2_analytics import (
    ANOMALY_RULE_VERSION,
    Point,
    chronological_split,
    detect_anomalies,
    evaluate_bundle,
    fit_profile,
    metrics,
)


ROOT = Path(__file__).resolve().parents[2]
BUNDLE = ROOT / "data/local/bdg2-cohort-v1"


def test_real_bdg2_evaluation_is_deterministic_and_source_bounded():
    first = evaluate_bundle(BUNDLE)
    second = evaluate_bundle(BUNDLE)

    assert json.dumps(first, sort_keys=True) == json.dumps(second, sort_keys=True)
    assert first["source"]["source_code"] == "bdg2_v1"
    assert first["source"]["provenance"] == "public_benchmark"
    assert first["source"]["unit"] == "kWh"
    assert len(first["per_meter"]) == 4
    assert len(first["next_24h_forecasts"]) == 4 * 24
    assert all(row["label"] == "unusual_consumption_pattern" for row in first["test_anomalies"])
    assert all(row["cause"] is None for row in first["test_anomalies"])


def test_real_bdg2_split_is_strictly_chronological():
    report = evaluate_bundle(BUNDLE)
    split = report["split"]

    assert split["train_start"] < split["train_end_exclusive"]
    assert split["train_end_exclusive"] == split["validation_start"]
    assert split["validation_start"] < split["validation_end_exclusive"]
    assert split["validation_end_exclusive"] == split["test_start"]
    assert split["test_start"] < split["test_end_exclusive"]
    for result in report["per_meter"].values():
        assert result["train_readings"] > result["validation_readings"] > 0
        assert result["test_readings"] > 0


def test_metric_formula_reports_mae_and_rmse():
    result = metrics([1.0, 3.0], [2.0, 1.0])
    assert result == {"n": 2, "mae_kwh": 1.5, "rmse_kwh": 1.581139}


def test_anomaly_rule_is_strict_and_uses_unusual_pattern_label_only():
    rows = [
        {"timestamp": datetime(2026, 1, 1, tzinfo=timezone.utc), "actual": 10.0,
         "prediction": 10.0, "residual": 0.0},
        {"timestamp": datetime(2026, 1, 1, 1, tzinfo=timezone.utc), "actual": 25.0,
         "prediction": 10.0, "residual": 15.0},
    ]
    found = detect_anomalies(rows, center=0.0, threshold=10.0, meter_name="test-meter")

    assert len(found) == 1
    assert found[0]["label"] == "unusual_consumption_pattern"
    assert found[0]["cause"] is None
    assert found[0]["id"] == detect_anomalies(
        rows, center=0.0, threshold=10.0, meter_name="test-meter"
    )[0]["id"]


def test_split_helper_uses_ordered_calendar_boundaries():
    start = datetime(2025, 1, 1, tzinfo=timezone.utc)
    points = [Point(start + timedelta(hours=index), float(index)) for index in range(40 * 24)]
    split = chronological_split({"meter": points})

    assert split.start == start
    assert split.train_end == start + timedelta(days=24)
    assert split.validation_end == start + timedelta(days=32)
    assert split.end == start + timedelta(days=40)


def test_profile_fit_excludes_future_values():
    start = datetime(2025, 1, 1, tzinfo=timezone.utc)
    boundary = start + timedelta(days=14)
    history = [Point(start + timedelta(hours=index), 10.0) for index in range(14 * 24)]
    future = [Point(boundary + timedelta(hours=index), 1_000_000.0) for index in range(7 * 24)]

    without_future = fit_profile(history, boundary)
    with_future_present = fit_profile(history + future, boundary)

    assert without_future == with_future_present
    assert with_future_present.overall_mean == 10.0
