"""Chronological model assessment and baseline comparison helpers."""
from __future__ import annotations

import numpy as np
import pandas as pd
from .data import aware_time, interval_series


def chronological_slices(index: pd.DatetimeIndex, *, train_end, validation_end,
                         horizon_hours: int = 24) -> dict[str, pd.DatetimeIndex]:
    """Split ORIGINS, purging horizons that straddle train/validation boundaries.

    Model labels and all pre-processing must be fitted on training data only.
    Pick parameters on validation; reserve the test origins until choices freeze.
    """
    if index.tz is None or index.has_duplicates or not index.is_monotonic_increasing:
        raise ValueError('Supply distinct sorted timezone-aware forecast origins.')
    a, b = aware_time(train_end), aware_time(validation_end)
    if a >= b or horizon_hours < 1:
        raise ValueError('Invalid chronological cutoffs or horizon.')
    horizon = pd.Timedelta(hours=horizon_hours)
    return {'train': index[index + horizon <= a],
            'validation': index[(index >= a) & (index + horizon <= b)],
            'test': index[index >= b]}


def error_metrics(actual, predicted) -> dict:
    y, p = np.asarray(actual, dtype=float), np.asarray(predicted, dtype=float)
    if y.shape != p.shape or y.size == 0 or not np.isfinite(y).all() or not np.isfinite(p).all():
        raise ValueError('Metric inputs must be aligned, finite, nonempty arrays.')
    delta = p - y
    return {'n': int(y.size), 'mae_kwh': float(np.mean(np.abs(delta))),
            'rmse_kwh': float(np.sqrt(np.mean(delta ** 2))),
            'bias_kwh': float(delta.mean())}


def backtest_demand(model, asset_id: str, readings: pd.Series, origins) -> dict:
    """Fixed fitted model; previous-day baseline evaluated on exactly paired rows.

    The caller must use non-overlapping daily origins to avoid counting the same
    target repeatedly. Missing future observations stay missing, never filled.
    """
    series = interval_series(readings, 60)
    starts = sorted(aware_time(t) for t in origins)
    if any(b - a < pd.Timedelta(hours=24) for a, b in zip(starts, starts[1:])):
        raise ValueError('Use distinct non-overlapping daily evaluation origins.')
    actual, predicted, baseline = [], [], []
    skipped = 0
    for origin in starts:
        forecast = model.predict(asset_id, series, origin=origin)['forecast_kwh']
        y = series.reindex(forecast.index)
        prior = series.reindex(forecast.index - pd.Timedelta(days=1))
        for value, estimate, reference in zip(y.to_numpy(), forecast.to_numpy(), prior.to_numpy()):
            if not np.isfinite([value, estimate, reference]).all():
                skipped += 1
                continue
            actual.append(value); predicted.append(estimate); baseline.append(reference)
    result = {'model': error_metrics(actual, predicted),
              'previous_day': error_metrics(actual, baseline), 'skipped_unpaired_hours': skipped}
    ref = result['previous_day']['mae_kwh']
    result['mae_reduction_percent'] = None if ref == 0 else 100 * (1 - result['model']['mae_kwh'] / ref)
    return result


def peak_metrics(labels, scores, threshold: float = 0.7) -> dict:
    """Report false alerts and missed peaks; no unsupported accuracy percentage."""
    y, p = np.asarray(labels, dtype=int), np.asarray(scores, dtype=float)
    if y.shape != p.shape or y.size == 0 or not np.isin(y, [0, 1]).all():
        raise ValueError('Require paired binary labels and probability scores.')
    if not np.isfinite(p).all() or ((p < 0) | (p > 1)).any() or not 0 < threshold < 1:
        raise ValueError('Scores must be finite in [0,1]; threshold must be in (0,1).')
    alert = p >= threshold
    tp = int(((y == 1) & alert).sum()); fp = int(((y == 0) & alert).sum())
    fn = int(((y == 1) & ~alert).sum()); tn = int(((y == 0) & ~alert).sum())
    return {'true_peaks': tp, 'false_alerts': fp, 'missed_peaks': fn, 'true_nonpeaks': tn,
            'precision': None if tp + fp == 0 else tp / (tp + fp),
            'recall': None if tp + fn == 0 else tp / (tp + fn),
            'brier_score': float(np.mean((p - y) ** 2))}
