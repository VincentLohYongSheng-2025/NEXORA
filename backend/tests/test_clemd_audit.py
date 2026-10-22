"""Physical-unit and missing-data checks for the Malaysian source audit."""
import pytest

pd = pytest.importorskip('pandas', reason='Install scripts/requirements-clemd-audit.txt for source-audit checks')

from scripts.audit_clemd import aggregate


def samples():
    return pd.DataFrame({'Real Power1': 10000., 'Real Power2': 20000., 'Real Power3': 30000.},
                        index=pd.date_range('2023-10-01', periods=3600, freq='s', tz='Asia/Kuala_Lumpur'))


def test_three_phase_watts_integrated_into_kwh():
    _, _, complete, _ = aggregate(samples())
    assert len(complete) == 1
    assert complete.iloc[0].energy_kwh == pytest.approx(60.)


def test_missing_second_never_becomes_full_hour():
    _, hourly, complete, _ = aggregate(samples().iloc[:-1])
    assert hourly.iloc[0].samples == 3599
    assert complete.empty


def test_invalid_phase_does_not_become_zero_load():
    frame = samples()
    frame.iloc[0, 0] = float('nan')
    _, _, complete, quality = aggregate(frame)
    assert quality['invalid_samples'] == 1
    assert complete.empty


def test_identical_duplicates_not_double_counted():
    frame = samples()
    _, _, complete, quality = aggregate(pd.concat([frame, frame.iloc[:1]]))
    assert quality['duplicate_rows'] == 2
    assert complete.iloc[0].energy_kwh == pytest.approx(60.)


def test_conflicting_duplicates_fail_closed():
    frame = samples()
    other = frame.iloc[:1].copy()
    other.iloc[0, 0] = 999.
    with pytest.raises(ValueError, match='conflicting'):
        aggregate(pd.concat([frame, other]))


def test_blank_export_padding_is_not_a_timestamp_duplicate():
    frame = samples()
    padding = pd.DataFrame({'Real Power1': [None, None], 'Real Power2': [None, None], 'Real Power3': [None, None]},
                           index=pd.DatetimeIndex([pd.NaT, pd.NaT], tz='Asia/Kuala_Lumpur'))
    _, _, complete, quality = aggregate(pd.concat([frame, padding]))
    assert quality['rows_without_timestamp'] == 2
    assert quality['duplicate_rows'] == 0
    assert complete.iloc[0].energy_kwh == pytest.approx(60.)
