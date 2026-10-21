# Building Data Genome Project 2 provisional data assessment

**Assessment date:** 13 October 2026 (Malaysia)
**Dataset:** Building Data Genome Project 2 (BDG2), v1.0
**Decision:** Suitable for a bounded, whole-building electricity benchmark after a reviewed provenance/schema/import plan
**Current state:** Read-only inspection complete; no database import, model training, API implementation or frontend change performed

## Identity and permitted use

BDG2 is a public measured building-energy benchmark. It is **not Sime Darby
data and is not Elmina Lakeside Mall data**. The project owner has approved its
temporary use for EnergiOS backend and energy-model benchmarking while the
authorised corporate dataset is unavailable. Any displayed result must be
labelled `Public benchmark data — Building Data Genome Project 2 v1.0`.

- **Official archive:** Building and Urban Data Science (BUDS) Group,
  [BDG2 v1.0 on Zenodo](https://doi.org/10.5281/zenodo.3887306), published
  10 June 2020. The archive contains 1,636 non-residential buildings, 3,053
  meter series, 19 sites and two years of hourly observations.
- **Official source repository:**
  [`buds-lab/building-data-genome-project-2`, tag `v1.0`](https://github.com/buds-lab/building-data-genome-project-2/tree/v1.0),
  pinned for this inspection at commit
  `3d0cbaf7ba281029ce04887503ab56f3c8344575`.
- **Dataset citation:** Miller, C. et al. “The Building Data Genome Project 2,
  energy meter data from the ASHRAE Great Energy Predictor III competition.”
  *Scientific Data* 7, 368 (2020),
  [doi:10.1038/s41597-020-00712-x](https://doi.org/10.1038/s41597-020-00712-x).
- **Licence:** the official Zenodo v1.0 record declares **CC BY 4.0** for the
  archived release, so reuse and public display require attribution. The tagged
  Git repository separately includes an MIT licence for its software and
  associated documentation. Preserve the data citation and CC BY 4.0 notice;
  preserve the MIT notice if repository software is reused.
- **Privacy/identity boundary:** building identifiers are pseudonymous, but the
  paper identifies some contributing sites and metadata contains site/location
  fields. Do not call the dataset fully anonymous, attempt re-identification or
  present any record as a Sime Darby/Elmina asset.

Proposed future lineage values are `provenance=public_benchmark`,
`source_dataset=bdg2`, and `source_version=v1.0`. These values are planned and
have not been added to the schema or database.

## Files and provenance evidence

The v1.0 repository inventories:

- `data/metadata/metadata.csv`;
- `data/weather/weather.csv`;
- raw and cleaned files for electricity, hot water, chilled water, steam, gas,
  water, irrigation and solar;
- `data/meters/kaggle/kaggle.csv`, a separate 2017 competition-compatible form.

This assessment downloaded and profiled only the metadata, weather and cleaned
electricity files. Other meter types were inventoried from the official release
but were not downloaded or declared ingestion-ready.

| Inspected file | Bytes | SHA-256 |
| --- | ---: | --- |
| `data/metadata/metadata.csv` | 272,024 | `992d0b29f24f96ad4332bc4dbb534b7bdd7dd2689aad093f94e93068ecddca02` |
| `data/weather/weather.csv` | 19,457,782 | `94dc014ebaf1b67488c8321936ad76e22628ed2ca9f30dfdbeda911b64026484` |
| `data/meters/cleaned/electricity_cleaned.csv` | 177,466,613 | `b01056f4ceec1992ce019297e674d6d6ecd0240e50a2aaeb6f958c65efdc282d` |

The Zenodo v1.0 archive reports MD5
`44393dc4cf61e84dec105e955368c890` for the 595.3 MB release ZIP. The local
inspection checkout lives under ignored `.tools/`; no BDG2 data file was added
to Git.

## Metadata and available meters

`metadata.csv` has 1,636 unique building rows and 32 columns across 19 sites.
Every row has a building ID, site ID, floor area and one of six documented
timezones (`Europe/Dublin`, `Europe/London`, and four continental US zones).
Meter-presence flags account for all 3,053 published series:

| Meter type | Building-meter series |
| --- | ---: |
| Electricity | 1,578 |
| Chilled water | 555 |
| Steam | 370 |
| Hot water | 185 |
| Gas | 177 |
| Water | 146 |
| Irrigation | 37 |
| Solar | 5 |

The cleaned electricity file has one column per represented building, and all
1,578 columns link to a metadata row with an electricity flag and timezone.
This supports **whole-building electricity series as represented by BDG2**. It
does not provide EnergiOS meter IDs from Sime Darby, floor/room/equipment
submeter mappings, circuits, BMS points or authoritative building-total versus
submeter relationships.

Metadata quality is uneven: primary space use is missing for 21 buildings
(1.28%), latitude/longitude for 237 (14.49%), year built for 819 (50.06%),
number of floors for 1,195 (73.04%) and occupants for 1,406 (85.94%). Only 12
rows are categorised as `Retail`; that category does not identify a shopping
mall and must not be used to imply Elmina similarity. No operating-hours,
holiday, closure or intervention fields were found.

## Electricity timestamps, units and quality

The official paper defines energy-related meter values as `kWh_sum`: interval
energy summed across each hour. They are not cumulative register readings and
are not instantaneous kW. A derived one-hour average kW would need an explicit
derived label and valid interval assumptions.

The cleaned electricity file contains 17,544 hourly timestamp rows from
`2016-01-01 00:00:00` through `2017-12-31 23:00:00`, inclusive. Its timestamp
axis has no invalid, duplicate or non-hourly values. The timestamps have no UTC
offset; the source documentation says they are in each building site's local
timezone. A future import must join building → site → timezone before UTC
normalisation, retain the source-local timestamp, and explicitly resolve/test
daylight-saving folds and gaps. A global timezone assumption is invalid.

Across 1,578 electricity series (27,684,432 possible values):

| Quality measure | Observed result |
| --- | ---: |
| Non-missing values | 26,180,235 |
| Missing values | 1,504,197 (5.4334%) |
| Numeric zero values | 1,115,924 |
| Negative values | 0 |
| Series with at least 99% completeness | 722 |
| Series with at least 95% completeness | 1,267 |
| Series with at least 90% completeness | 1,440 |
| Series with at least 80% completeness | 1,474 |
| Fully complete series | 82 |
| Series spanning at least 180 days | 1,570 |

Two series are entirely missing and several others have very low coverage. The
paper describes additional cleaning that removes prolonged zeros and electricity
zeros, but this exact official cleaned file still contains numeric zero values.
Therefore ingestion must not assume that `cleaned` means complete or zero-free;
zeros must be retained or quality-flagged according to a reviewed rule, never
silently converted to missing or imputed.

A conservative provisional cohort is the 1,440 electricity series that link to
metadata, have a timezone, span at least 180 days and are at least 90% complete.
That is an assessment threshold, not an approved import selection. The next
plan must choose a smaller capacity-bounded cohort and record exclusions before
any database write or model training.

## Weather fields and quality

`weather.csv` contains 331,166 rows for the same 19 sites and 2016–2017 period.
The source defines timestamps as local site time and documents these fields:

| Field | Unit/meaning | Missing in inspected file |
| --- | --- | ---: |
| `airTemperature` | °C | 128 (0.0387%) |
| `cloudCoverage` | oktas | 170,987 (51.6318%) |
| `dewTemperature` | °C | 328 (0.0990%) |
| `precipDepth1HR` | mm over one hour | 133,186 (40.2173%) |
| `precipDepth6HR` | mm over six hours | 313,004 (94.5157%) |
| `seaLvlPressure` | mbar/hPa | 21,624 (6.5297%) |
| `windDirection` | degrees clockwise from true north | 13,005 (3.9270%) |
| `windSpeed` | m/s | 574 (0.1733%) |

There are 37 extra duplicate site/timestamp rows. After deduplication, 2,207 of
the 333,336 expected site-hours are absent. Site coverage varies; weather must
be deduplicated and left missing where absent. Air temperature and wind speed
are comparatively complete; cloud and precipitation fields are not suitable
as mandatory features without an explicit missing-data strategy. No weather
value may be invented.

## Suitability and claim limits

BDG2 v1.0 is suitable for the **next planning step** toward a measured,
whole-building electricity ingestion and forecast benchmark because it has an
official version/citation/licence, two years of hourly interval energy, stable
building/site identifiers, timezone metadata and many sufficiently complete
series. It is not yet approved for database import: the current schema permits
only `synthetic_demo`, the import cohort/capacity is undecided, and local-time,
DST, duplicate, missing and zero-value rules need review.

BDG2 does not support these EnergiOS claims or features:

- Sime Darby, Elmina Lakeside Mall or township-specific performance;
- floor-level, room-level, circuit-level or equipment-level energy;
- confirmed HVAC operation, schedule violations or HVAC causation;
- Malaysian tariffs, electricity cost, Malaysian carbon factors or carbon
  savings;
- interventions, implementation costs, opportunity rankings or verified
  savings;
- final submission readiness or frontend compatibility.

The exact next P0 backend task is to write and review a non-destructive
provenance/schema and bounded import plan for a selected BDG2 electricity
cohort. It must preserve existing tables and RLS, define public-benchmark
lineage/attribution, local-time-to-UTC and DST handling, idempotent keys,
missing/duplicate/zero policies, volume limits, validation and rollback. It must
not execute a migration or insert data until separately authorised.
