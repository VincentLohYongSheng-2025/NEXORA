> Migration update: the gap-aware Malaysia v2 adapter is now implemented. See [Malaysia demo data](malaysia-demo-data.md). The original source audit and initial drop-in assessment below are retained as evidence.

# Malaysian benchmark candidate: CLEMD

Audited 22 October 2026. **Audit complete; application source not switched.**

## Decision

CLEMD passes the Malaysian location, public access, and reuse licence checks.
It is suitable for an explicitly limited Malaysian institutional-building demo
benchmark. It is **not a direct replacement** for the current four-building
BDG2 snapshot: it has one measured building, limited history, and recurring
gaps. The current workbench selects the last 168 readings rather than a calendar
window, so substituting these files directly would misrepresent seven days.

A replacement requires an adapter that preserves absent calendar hours/days,
updates chart missing-data rendering and totals/coverage labels, introduces one
measured Malaysian reference asset, and keeps all six township profiles clearly
identified as simulated derivatives. It must also update source citations in
exports and reports, replace every displayed forecast evaluation, and keep
existing simulation approvals separate from the newly sourced baseline.

No missing readings were invented or filled. The existing app and source
snapshots remain intact. This audit does not claim independent measurements for
the demo hospital, mall, residences, restaurant, office, or solar park.

## Primary sources and licence

- [Research paper](https://doi.org/10.1038/s41597-024-03433-7): Al-Khadher et al., Scientific Data 11, 594 (2024).
- [Original dataset collection](https://doi.org/10.6084/m9.figshare.c.6946581).
- [Public collection metadata API](https://api.figshare.com/v2/collections/6946581/articles).
- All six dataset archive records return **CC BY 4.0**, independently of the paper licence.
- Attribution must identify the authors, collection and relevant archive DOIs,
  link the licence, and disclose aggregation/cleaning changes.
- Location verified in the paper: Faculty of Medicine and Defence Health,
  Universiti Pertahanan Nasional Malaysia; an institutional setting, not an
  operating hospital dataset. Table 8 specifies real power in **watts**.
- Local naive timestamps are interpreted as Malaysia time, Asia/Kuala_Lumpur
  (UTC+8). The files do not themselves carry timezone offsets.

## Download and integrity

Only the aggregate CSV member from each available weekly ZIP was downloaded,
using HTTP byte ranges; unrelated circuits were not downloaded. ZIP CRC32 was
verified on extraction. The upstream ZIP MD5 is preserved in source metadata,
but is **not verified**, since whole archives were not downloaded. Extracted
CSV SHA-256 hashes are recorded in the audit result.

| Archive DOI | Aggregate export | Coverage at source-local time |
| --- | --- | --- |
| 10.6084/m9.figshare.24523558.v1 | Absent | First advertised week, 16–21 Sep |
| 10.6084/m9.figshare.24523555.v1 | Aggregate.csv | 21 Sep 23:55–27 Sep 00:05 |
| 10.6084/m9.figshare.24523552.v1 | Aggregate.csv | 27 Sep 23:55–4 Oct 00:05 |
| 10.6084/m9.figshare.24523567.v1 | Aggregtae.csv (source spelling) | 4 Oct 23:55–11 Oct 00:05 |
| 10.6084/m9.figshare.24523564.v1 | Aggregate.csv | 11 Oct 23:55–18 Oct 00:05 |
| 10.6084/m9.figshare.24523561.v1 | Aggregate.csv | 18 Oct 23:55–25 Oct 00:05 |

All dates above are 2023. Two exports use day/month/year; three use
month/day/year. The importer pins formats per archive rather than inferring
ambiguous dates. The 11–18 October CSV contains 32,771 rows without timestamps;
these are excluded and counted, not treated as duplicate observations.

## Observed quality results

| Check | Result |
| --- | ---: |
| Aggregate CSV files downloaded | 5 |
| CSV rows including export padding | 2,541,376 |
| Timestamped observations | 2,508,605 |
| Invalid power observations among timestamped rows | 0 |
| Duplicate timestamped observations | 0 |
| Complete 3,600-sample hours | 696 |
| Full 24-hour days | 29 |
| Partial/absent hours within aggregate file coverage | 98 |
| Longest consecutive complete interval | 144 hours / 6 days |

Three-phase real power is summed, multiplied by the 1-second recording interval,
and divided by 3,600,000 to obtain kWh. Only hours with 3,600 valid, unique samples
are accepted. Partial hours are excluded, with coverage retained separately.
The 98 partial/absent hours do not include the first advertised week for which
there is no aggregate file.

## Chronological forecast experiment

Uses the existing app's seasonal hour-of-week model with trailing 24-hour
residual correction and a validation-selected blend with previous-day demand.
Seasonal features use Malaysian local time. This experiment reuses the numerical
forecast functions; it does not bypass or alter the BDG2 provenance validator.

- Training ends 11 October 2023 00:00 MYT, exclusive.
- Validation ends 17 October 2023 00:00 MYT, exclusive.
- Test ends 25 October 2023 00:00 MYT, exclusive.
- Validation RMSE selects seasonal weight 1.0.
- Both methods score exactly the same 144 test hours for which target and
  previous-day observations exist; missing targets remain excluded.
- Test data never selects the model weight or fits the seasonal profile.
- Prior observations may update the residual correction at each daily origin.

| Method | Test hours | MAE (kWh per hourly interval) | RMSE (kWh) |
| --- | ---: | ---: | ---: |
| Forecast model | 144 | 6.741485 | 9.491690 |
| Previous-day same-hour baseline | 144 | 8.236971 | 16.109850 |

Approximately 18.2% lower MAE in this short experiment. This is not an accuracy
percentage, a production result, a cross-building validation, or a transferable
BDG2 result. The time span and number of comparable test intervals are small.
No annual, seasonal, solar-generation, tariff, occupancy or carbon-factor
accuracy is established.

## Reproduce

From the repository root, using a Python environment with the optional audit
dependencies (application runtime dependencies are unchanged):

```powershell
python -m pip install -r backend/scripts/requirements-clemd-audit.txt
python backend/scripts/audit_clemd_download.py
python backend/scripts/audit_clemd.py
python -m pytest backend/tests/test_clemd_audit.py -q --disable-warnings
```

Raw licensed inputs and metadata: `data/source/clemd/` (Git-ignored).
Hourly values, calendar coverage and full result: `data/local/clemd-audit/`
(Git-ignored). A reviewable result and source licence manifest are stored beside
this document. Six audit tests pass: W-to-kWh conversion, missing-second handling,
invalid phases, identical duplicates, conflicting duplicates, and blank export
padding.
