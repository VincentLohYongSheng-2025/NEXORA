# BDG2 forecast and unusual-pattern evaluation

**Evaluated:** 13 October 2026 (Malaysia)
**Scope:** Four verified BDG2 `Hog` whole-building electricity meters
**Label:** `Public benchmark data — Building Data Genome Project 2 v1.0`

This benchmark uses only the validated `public_benchmark` readings in the local
BDG2 import bundle. It is not Sime Darby or Elmina Lakeside Mall evidence. The
input manifest contains 70,152 observed hourly interval-kWh readings and pins
the source as `bdg2_v1`; the evaluator verifies its reading count and content
hash before training.

## Method and leakage controls

- The shared calendar split is chronological: train
  `2016-01-01T06:00:00Z`–`2017-03-14T06:00:00Z`, validation through
  `2017-08-07T06:00:00Z`, and test through `2018-01-01T06:00:00Z`. End times
  are exclusive.
- The model is a 168-hour seasonal mean with a trailing 24-hour residual level
  correction. A validation-selected weight blends that estimate with the
  previous-day same-hour value. Candidate weights are fixed from 0.0 to 1.0 in
  0.1 steps and selected by validation RMSE.
- Validation fits use train readings only. Test fits use train plus validation.
  The selected weight and residual threshold come from validation; test values
  never tune them. Each rolling origin emits the next 24 hourly values and may
  use only observations before that origin.
- The comparison baseline is the observed value exactly 24 hours earlier.
  Metrics use the same 14,081 test targets for both methods; unavailable target
  or lag observations remain absent.
- An anomaly is an absolute centered forecast residual above
  `6 × 1.4826 × validation MAD`, calculated per meter. Its label is only
  `unusual_consumption_pattern`; no cause is inferred.

## Held-out test results

| Method | Comparable readings | MAE (kWh) | RMSE (kWh) |
| --- | ---: | ---: | ---: |
| Forecast model | 14,081 | 24.223073 | 37.903324 |
| Previous-day baseline | 14,081 | 27.180704 | 47.311611 |

| Meter | Seasonal weight | Model MAE | Baseline MAE | Model RMSE | Baseline RMSE | Unusual patterns |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| `Hog_assembly_Dona:electricity` | 0.7 | 43.994324 | 50.859772 | 57.906213 | 69.632062 | 0 |
| `Hog_education_Donnie:electricity` | 0.4 | 18.158417 | 15.536658 | 26.392558 | 28.446451 | 0 |
| `Hog_lodging_Francisco:electricity` | 0.3 | 12.756763 | 13.408260 | 18.953482 | 21.335268 | 26 |
| `Hog_office_Bill:electricity` | 1.0 | 22.066947 | 29.018915 | 36.686158 | 53.400809 | 118 |

The aggregate model improves both held-out MAE and RMSE, but performance is not
uniform: the education meter's baseline has lower MAE. The detector flags 144
test observations across two meters. These are statistical unusual patterns,
not confirmed waste, after-hours use, HVAC faults, or any other cause.

The deterministic local report contains 24 future hourly forecast values per
meter, per-meter thresholds and all detected test evidence at
`data/local/bdg2-analytics-v1/report.json`. That directory is Git-ignored because
it is a generated artifact. Re-running the evaluator produces byte-identical
JSON when the source bundle and code are unchanged.

## Limitations

BDG2 provides whole-building interval energy and no verified operating schedule
for this cohort. The model uses energy history only; it does not use weather,
holidays, occupancy, equipment telemetry or interventions. The selected cohort
is small, and one meter did not improve MAE over the baseline. Thresholds are a
transparent hackathon rule rather than calibrated operational severity. These
results do not establish Sime Darby performance, mall performance, causes,
tariffs, savings, floor/room behaviour, or production readiness.

Run from `backend/`:

```powershell
uv run --locked python -m src.bdg2_analytics
uv run --locked pytest tests/test_bdg2_analytics.py
```
