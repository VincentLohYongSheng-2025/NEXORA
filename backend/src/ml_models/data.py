"""Model input contracts and timestamp validation; preserves missing measurements."""
from __future__ import annotations

from pathlib import Path
import numpy as np
import pandas as pd


def aware_time(value) -> pd.Timestamp:
    result = pd.Timestamp(value)
    if result.tzinfo is None:
        raise ValueError('Supply a timezone-aware timestamp.')
    return result.tz_convert('UTC')


def numeric_frame(frame: pd.DataFrame, columns: tuple[str, ...]) -> pd.DataFrame:
    if not isinstance(frame.index, pd.DatetimeIndex) or frame.index.tz is None:
        raise ValueError('Use a timezone-aware DatetimeIndex, with interval-start timestamps.')
    if frame.index.hasnans or frame.index.has_duplicates or not frame.index.is_monotonic_increasing:
        raise ValueError('Timestamps must be present, distinct and sorted.')
    if frame.empty or not set(columns).issubset(frame.columns):
        raise ValueError(f'Required columns: {columns}')
    values = frame.loc[:, list(columns)].astype(float)
    if not np.isfinite(values.to_numpy()).all():
        raise ValueError('Missing or non-finite telemetry must be resolved explicitly.')
    return values


def interval_series(series: pd.Series, minutes: int) -> pd.Series:
    if minutes <= 0 or 1440 % minutes:
        raise ValueError('Interval minutes must divide one day.')
    result = numeric_frame(series.to_frame('value'), ('value',))['value']
    if (result < 0).any():
        raise ValueError('Meter values must be nonnegative.')
    step = pd.Timedelta(minutes=minutes)
    if any(t.value % step.value for t in result.index):
        raise ValueError('Meter timestamps must align with the declared interval grid.')
    return result


def past_features(series: pd.Series, origin, minutes: int) -> dict[str, float] | None:
    """Only completed intervals before origin; require a full preceding day.

    Timestamp is the start of an interval, which becomes available at its end.
    Calendar gaps prevent a sample instead of becoming fabricated readings.
    """
    origin = aware_time(origin)
    step = pd.Timedelta(minutes=minutes)
    day = 1440 // minutes
    past = series.reindex(pd.date_range(origin - day * step, periods=day, freq=step))
    if past.isna().any():
        return None
    return {
        'last': float(past.iloc[-1]),
        'lag_day': float(past.iloc[0]),
        'lag_week': float(series.get(origin - 7 * day * step, np.nan)),
        'mean_day': float(past.mean()),
        'max_day': float(past.max()),
        'std_day': float(past.std(ddof=0)),
        'recent_change': float(past.iloc[-1] - past.iloc[-2]),
    }


def calendar(timestamp) -> dict[str, float]:
    """Caller passes local time, preserving the site's operating calendar."""
    hour = timestamp.hour + timestamp.minute / 60
    return {'hour_sin': float(np.sin(2 * np.pi * hour / 24)),
            'hour_cos': float(np.cos(2 * np.pi * hour / 24)),
            'weekday': float(timestamp.weekday()),
            'weekend': float(timestamp.weekday() >= 5)}


def load_clemd_reference(path: str | Path) -> pd.Series:
    """Read an explicitly chosen CSV; never run automatically or modify it.

    Single institutional building, hourly kWh only. This adapter provides no
    equipment telemetry, feeder labels, weather or 30-minute measurements.
    """
    table = pd.read_csv(path)
    required = {'timestamp_local', 'samples', 'energy_kwh'}
    if not required.issubset(table.columns) or not (table['samples'] == 3600).all():
        raise ValueError('Expected CLEMD complete-hour export columns and 3600 samples/hour.')
    timestamps = pd.DatetimeIndex(pd.to_datetime(table['timestamp_local'], utc=True))
    series = pd.Series(table['energy_kwh'].to_numpy(), index=timestamps).sort_index()
    return interval_series(series, 60).tz_convert('Asia/Kuala_Lumpur')
