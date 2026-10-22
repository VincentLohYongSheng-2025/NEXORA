"""Audit CLEMD aggregate power without filling missing readings.

Audit-only dependency: pandas. Run audit_clemd_download.py first. The published
CSV power columns are watts (paper Table 8). Each 1-second observation represents
one second for this aggregation; only hours containing all 3,600 valid samples
are accepted. Local timestamps are interpreted in Asia/Kuala_Lumpur (UTC+8).
"""
import hashlib
import json
from pathlib import Path
import sys

import pandas as pd

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'backend'))
from src.bdg2_analytics import (Point, chronological_split, fit_profile,
                                evaluate_window, select_blend, apply_blend, metrics)

RAW = ROOT / 'data/source/clemd'
OUT = ROOT / 'data/local/clemd-audit'


def aggregate(frame):
    """Validate raw samples and retain complete hours only; never scale gaps."""
    missing_timestamps = int(frame.index.isna().sum())
    frame = frame.loc[~frame.index.isna()].copy()
    powers = frame[['Real Power1', 'Real Power2', 'Real Power3']].apply(pd.to_numeric, errors='coerce')
    valid = powers.notna().all(axis=1) & powers.ge(0).all(axis=1) & powers.lt(float('inf')).all(axis=1)
    frame = frame.copy()
    frame['valid'] = valid
    frame['watts'] = powers.sum(axis=1).where(valid)
    duplicate_count = int(frame.index.duplicated(keep=False).sum())
    # Conflicting copies must not be silently averaged.
    duplicate = frame.loc[frame.index.duplicated(keep=False)]
    conflicts = int((duplicate.groupby(level=0)['watts'].nunique(dropna=False) > 1).sum())
    if conflicts:
        raise ValueError(f'{conflicts} conflicting timestamp duplicates')
    frame = frame.loc[~frame.index.duplicated(keep='first')].sort_index()
    hourly = frame.resample('h').agg(samples=('watts', 'count'), energy_kwh=('watts', 'sum'))
    hourly['energy_kwh'] /= 3_600_000  # watts × 1 second -> kWh
    complete = hourly.loc[hourly.samples == 3600].copy()
    return frame, hourly, complete, {'duplicate_rows': duplicate_count,
                                    'conflicting_duplicates': conflicts,
                                    'rows_without_timestamp': missing_timestamps,
                                    'invalid_samples': int((~valid).sum())}


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    files = []
    frames = []
    for path in sorted(RAW.glob('*-incoming-0.csv')):
        columns = ['Date', 'Time', 'Real Power1', 'Real Power2', 'Real Power3']
        df = pd.read_csv(path, usecols=columns, dtype={'Date': 'string', 'Time': 'string'})
        # Source exports use different date orders; pin each to its archive's
        # documented week instead of guessing ambiguous dates such as 10/11.
        date_format = '%d/%m/%Y' if path.name.startswith(('24523552-', '24523561-')) else '%m/%d/%Y'
        timestamps = pd.to_datetime(df.Date + ' ' + df.Time, format=date_format + ' %I:%M:%S %p', errors='raise')
        df.index = pd.DatetimeIndex(timestamps).tz_localize('Asia/Kuala_Lumpur')
        frames.append(df)
        files.append({'file': path.name, 'sha256': hashlib.sha256(path.read_bytes()).hexdigest(),
                      'rows': len(df), 'date_format': date_format,
                      'rows_without_timestamp': int(df.index.isna().sum()),
                      'start_local': df.index.min().isoformat(), 'end_local': df.index.max().isoformat()})
        print(files[-1], flush=True)
    if len(files) != 5:
        raise ValueError(f'Expected five aggregate CSVs; found {len(files)}')
    frame, hourly, complete, quality = aggregate(pd.concat(frames))
    day_counts = complete.groupby(complete.index.date).size()
    full_days = day_counts[day_counts == 24]
    gaps = hourly.loc[hourly.samples != 3600]
    complete.to_csv(OUT / 'hourly-complete.csv', index_label='timestamp_local')
    hourly.to_csv(OUT / 'hourly-coverage.csv', index_label='timestamp_local')
    points = [Point(t.to_pydatetime(), float(row.energy_kwh)) for t, row in complete.iterrows()]
    # Use local-aware timestamps so the existing seasonal calendar uses MY hours.
    split = chronological_split({'clemd': points})
    _, _, _, validation = evaluate_window(points, fit_profile(points, split.train_end), split.train_end, split.validation_end)
    weight = select_blend(validation)
    _, _, baseline, test_rows = evaluate_window(points, fit_profile(points, split.validation_end), split.validation_end, split.end)
    actual, predictions, _ = apply_blend(test_rows, weight)
    max_run = run = 0
    previous = None
    for t in complete.index:
        run = run + 1 if previous is not None and t - previous == pd.Timedelta(hours=1) else 1
        max_run = max(max_run, run)
        previous = t
    report = {
        'dataset': 'CLEMD', 'collection_doi': '10.6084/m9.figshare.c.6946581',
        'licence': 'CC BY 4.0', 'timezone': 'Asia/Kuala_Lumpur',
        'building': 'Faculty of Medicine and Defence Health, Universiti Pertahanan Nasional Malaysia',
        'scope': 'One institutional building incoming supply; not multiple independent buildings',
        'aggregation': 'Sum three phase real power W × 1 second / 3,600,000; accept only complete 3600-sample hours',
        'files': files, 'quality': quality,
        'csv_rows': sum(f['rows'] for f in files), 'timestamped_rows': len(frame),
        'complete_hours': len(complete), 'incomplete_or_absent_hours': len(gaps),
        'full_days': len(full_days), 'maximum_consecutive_complete_hours': max_run,
        'excluded_hours': [{'timestamp_local': t.isoformat(), 'samples': int(r.samples)} for t, r in gaps.iterrows()],
        'daily_complete_hours': {str(day): int(count) for day, count in day_counts.items()},
        'evaluation': {
            'method': 'Existing seasonal hour-of-week + trailing residual, validation-selected blend with previous-day baseline',
            'train_end_exclusive': split.train_end.isoformat(), 'validation_end_exclusive': split.validation_end.isoformat(),
            'test_end_exclusive': split.end.isoformat(), 'seasonal_weight': weight,
            'model': metrics(actual, predictions), 'previous_day_baseline': metrics(actual, baseline),
            'note': 'Both methods scored on identical available targets with available previous-day readings; missing targets excluded, never imputed. Short single-building experiment, not production accuracy.',
        },
        'drop_in_replacement_pass': max_run >= 168,
        'decision': 'Current dashboard requires a continuous 7-day window. Do not substitute absent hours or duplicate one source as independently measured building types.',
    }
    (OUT / 'report.json').write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({k: v for k, v in report.items() if k not in ('files', 'excluded_hours', 'daily_complete_hours')}, indent=2))


if __name__ == '__main__':
    main()
