"""Reproduce held-out forecasts for the frozen dashboard's historical week."""
from datetime import timedelta
import json
from pathlib import Path
import sys

BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND))

from src.bdg2_analytics import (apply_blend, chronological_split, evaluate_window,
                               fit_profile, load_verified_bundle, parse_utc,
                               select_blend, utc_text, metrics, MODEL_VERSION)


def build():
    manifest, names, series = load_verified_bundle(BACKEND.parent / 'data/local/bdg2-cohort-v1')
    snapshot = json.loads((BACKEND / 'bdg2_live_snapshot.json').read_text(encoding='utf-8'))
    split = chronological_split(series)
    buildings = {}
    for meter_id, points in series.items():
        name = names[meter_id]
        bundle = next(b for b in snapshot['buildings'].values()
                      if b['readings']['meter_source_id'] == name)
        # Match the existing validation-selected blend, then evaluate with the
        # frozen pre-test profile. forecast_24 uses only hours before each origin.
        _, _, _, validation = evaluate_window(points, fit_profile(points, split.train_end),
                                               split.train_end, split.validation_end)
        weight = select_blend(validation)
        _, _, _, evaluation = evaluate_window(points, fit_profile(points, split.validation_end),
                                               split.validation_end, split.end)
        actual, predicted, predictions = apply_blend(evaluation, weight)
        saved_metrics = bundle['forecast']['test_metrics']['model']
        reproduced = metrics(actual, predicted)
        if any(abs(reproduced[key] - saved_metrics[key]) > 1e-5 for key in ('mae_kwh', 'rmse_kwh')):
            raise ValueError('Reproduced model differs from the frozen forecast model')
        by_time = {utc_text(row['timestamp']): row for row in predictions}
        items = []
        for reading in bundle['readings']['items']:
            row = by_time[reading['timestamp']]
            if abs(row['actual'] - reading['consumption_kwh']) > 1e-5:
                raise ValueError('Local cohort does not match the frozen dashboard snapshot')
            origin = split.validation_end + timedelta(days=(row['timestamp'] - split.validation_end).days)
            items.append(dict(timestamp=reading['timestamp'],
                              source_local_timestamp=reading['source_local_timestamp'],
                              forecast_origin=utc_text(origin),
                              forecast_kwh=round(row['prediction'], 6)))
        buildings[bundle['asset']['source_asset_id']] = dict(
            seasonal_weight=weight, training_end_exclusive=utc_text(split.validation_end), items=items)
    return dict(model_version=MODEL_VERSION, readings_sha256=manifest['readings_sha256'],
                description='Historical rolling 24-hour forecasts; seasonal profile fitted before the test period; blend chosen on validation data; only prior observations used at each origin.',
                attribution='Building Data Genome Project 2 v1.0 (CC BY 4.0)', buildings=buildings)


if __name__ == '__main__':
    result = build()
    target = BACKEND / 'bdg2_history_forecasts.json'
    target.write_text(json.dumps(result, indent=2) + '\n', encoding='utf-8')
    print(f"Saved {sum(len(b['items']) for b in result['buildings'].values())} hourly backtest predictions to {target}")
