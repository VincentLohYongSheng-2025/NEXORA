# BDG2 provenance, schema and bounded import plan

**Plan date:** 13 October 2026 (Malaysia)
**Status:** Reviewed design only — no migration or data import executed
**Scope:** Four whole-building electricity series from BDG2 v1.0
**Required label:** `Public benchmark data — Building Data Genome Project 2 v1.0`

> **Lean implementation update:** The project owner subsequently authorised a
> time-limited hackathon implementation that retains this document's pinned
> source, cohort, hash, timestamp, DST, quality and count rules while deferring
> its composite foreign-key design and advanced rollback architecture. The
> current migration uses direct foreign keys, essential uniqueness/checks and a
> single bounded import manifest. See the implementation plan and migration for
> current built status; the detailed design below remains historical review
> context rather than a claim that every planned abstraction was implemented.

## Decision and hard boundaries

This plan defines the next additive database change and the following bounded
import. It does not authorise either operation. It preserves all existing
tables, rows, constraints unrelated to provenance, indexes, grants, RLS state
and policies. No table is renamed, dropped, truncated or recreated.

BDG2 is measured public benchmark data. It is not Sime Darby or Elmina
Lakeside Mall data. The selected series are represented by BDG2 as
whole-building electricity. They do not support township, mall, floor, room,
equipment, HVAC-cause, Malaysian tariff, carbon-savings or verified-savings
claims. Weather is outside this first import.

## Source identity and attribution

Every import run must match all of this pinned evidence before opening a
database transaction:

| Evidence | Required value |
| --- | --- |
| Provenance | `public_benchmark` |
| Dataset code | `bdg2_v1` |
| Dataset title | `Building Data Genome Project 2` |
| Display attribution | `Public benchmark data — Building Data Genome Project 2 v1.0` |
| Version/publication date | `v1.0` / `2020-06-10` |
| DOI | `10.5281/zenodo.3887306` |
| Official repository | `https://github.com/buds-lab/building-data-genome-project-2` |
| Pinned commit | `3d0cbaf7ba281029ce04887503ab56f3c8344575` |
| Data licence | `CC-BY-4.0` |
| Required citation | Miller et al., *Scientific Data* 7, 368 (2020), DOI `10.1038/s41597-020-00712-x` |
| Metadata SHA-256 | `992d0b29f24f96ad4332bc4dbb534b7bdd7dd2689aad093f94e93068ecddca02` |
| Cleaned electricity SHA-256 | `b01056f4ceec1992ce019297e674d6d6ecd0240e50a2aaeb6f958c65efdc282d` |
| Weather SHA-256 | `94dc014ebaf1b67488c8321936ad76e22628ed2ca9f30dfdbeda911b64026484` |
| Zenodo archive MD5 | `44393dc4cf61e84dec105e955368c890` |

The weather hash is retained as release evidence, although weather rows are
not part of this import. A mismatch in the pinned commit or either imported
file hash is a hard stop; do not accept a newer file under the same source code.

Current Supabase guidance reviewed for this plan:

- [Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security):
  enable RLS on every table in an exposed schema and grant only the privileges
  each role needs.
- [Data API table exposure change](https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically):
  grants and RLS are separate controls, and new public tables require explicit
  grants as the platform changes its auto-exposure defaults.

No current changelog item requires changing the additive-table design. The
plan nevertheless verifies the hosted Postgres version and Data API setting
immediately before migration because those platform facts can change.

## Existing schema preservation baseline

The current `backend/sql/001_demo_schema.sql` defines `assets`, `meters`,
`energy_readings`, `alerts` and `scenarios`. All five tables have RLS enabled,
no public policies, no `anon`/`authenticated` privileges and backend-only
`service_role` grants according to the hosted verification evidence.

The migration must preserve:

- every existing row and primary/foreign key;
- `meters_one_active_building_total`, `meters_asset_id_idx`, alert
  deduplication, scenario indexes and all non-provenance checks;
- the `synthetic_demo` defaults so historical internal fixtures remain
  distinguishable and valid;
- RLS enabled on all five tables, their policy count and their current grants;
- `ON DELETE RESTRICT` relationships and the existing reading primary key
  `(meter_id, recorded_at)`.

Only the three provenance checks may be replaced, expanding their allowed set
from `synthetic_demo` to `synthetic_demo` or `public_benchmark`. The defaults
remain `synthetic_demo`. The migration must discover and assert the existing
constraint definitions through `pg_catalog` before replacing them; unexpected
schema drift aborts the transaction.

## Additive schema design

The authorised migration should be generated later with the installed
Supabase CLI's `supabase migration new` command. The file must contain one
transaction and no seed rows.

### `public.data_sources` — new table

One immutable record describes the dataset release:

| Field | Planned type/rule |
| --- | --- |
| `id` | UUID primary key |
| `source_code` | Non-empty text, unique; `bdg2_v1` |
| `provenance` | Text constrained to `public_benchmark` |
| `title`, `version` | Non-empty text |
| `doi`, `publication_doi` | Non-empty text |
| `citation` | Non-empty text |
| `licence_spdx` | Non-empty text; `CC-BY-4.0` |
| `attribution_label` | Exact required display label |
| `repository_url` | HTTPS URL text |
| `pinned_commit` | Lowercase 40-character hexadecimal text |
| `metadata_sha256`, `electricity_sha256`, `weather_sha256` | Lowercase 64-character hexadecimal text |
| `archive_md5` | Lowercase 32-character hexadecimal text |
| `published_on` | Date |
| `limitations_json` | JSON object containing the non-Sime/Elmina and whole-building limits |
| `created_at` | `timestamptz`, default `now()` |

Source identity fields are immutable after insertion. The migration creates no
trigger or privileged function; the import process checks immutability and
uses insert-only source registration.

### `public.data_import_runs` — new table

This table makes partial loads and rollback traceable:

| Field | Planned type/rule |
| --- | --- |
| `id` | UUID primary key |
| `data_source_id` | Required FK to `data_sources`, `ON DELETE RESTRICT` |
| `cohort_code` | Non-empty text; `hog_four_buildings_v1` |
| `attempt_number` | Positive integer; unique with source and cohort |
| `status` | `loading`, `validated`, `completed`, `failed`, or `rolled_back` |
| `selection_rule_json` | JSON object containing the deterministic cohort rule and exact IDs |
| `timezone_rules_json` | JSON object containing source zone, canonical zone, tzdata version and DST policy |
| `source_cell_limit`, `expected_non_null`, `expected_accepted` | Non-negative integers |
| `observed_missing`, `observed_zero`, `observed_dst_quarantine`, `observed_invalid`, `observed_conflict` | Non-negative integer counters |
| `started_at`, `completed_at` | `timestamptz`; completion required only for terminal successful state |
| `error_summary` | Nullable sanitised text; never credentials or raw restricted data |

Only a `completed` run may later feed a backend endpoint or model. This
requirement must be enforced in application queries when those features are
separately implemented. A partial unique index permits at most one `completed`
run for a source/cohort while retaining failed or rolled-back attempts. Add a
unique key on `(id, data_source_id)` so imported rows can enforce that their run
belongs to the same source.

### Existing `assets` fields

Add nullable columns first so existing rows remain unchanged:

| Field | Purpose |
| --- | --- |
| `data_source_id` | FK to `data_sources`, `ON DELETE RESTRICT` |
| `import_run_id` | FK to `data_import_runs`, `ON DELETE RESTRICT` |
| `source_asset_id` | Exact BDG2 building ID |
| `source_site_id` | Exact BDG2 site ID (`Hog`) |
| `primary_space_usage` | Source category, without reinterpreting it as an EnergiOS asset type |

Add a partial unique index on `(data_source_id, source_asset_id)` where both
values are present. For `public_benchmark` rows, require the source/run/asset/
site fields, a valid IANA source timezone and null schematic coordinates. The
existing `floor_area_m2` stores source `sqm`; it is not inferred.

Use a composite FK `(import_run_id, data_source_id)` to
`data_import_runs(id, data_source_id)`. Add a unique key on
`(id, data_source_id)` for source-consistent meter references. Historical rows
with null source fields continue to satisfy the additive constraints.

### Existing `meters` fields

Add nullable columns first:

| Field | Purpose/value for this cohort |
| --- | --- |
| `data_source_id` | FK to `data_sources` |
| `import_run_id` | FK to `data_import_runs` |
| `source_meter_id` | `<building_id>:electricity` |
| `measurement_type` | `electricity` |
| `unit` | `kWh` |
| `reading_semantics` | `interval_sum` |
| `interval_minutes` | `60` |
| `source_scope` | `whole_building` |

Add a partial unique index on `(data_source_id, source_meter_id)`. BDG2 meters
use the existing `meter_role='building_total'`, `floor_label=NULL` and
`source_kind='public_benchmark'`. This describes the source representation; it
does not invent submeters or prove a separate authoritative utility meter.

Use composite FKs from `(import_run_id, data_source_id)` to the run and from
`(asset_id, data_source_id)` to the asset, preventing cross-source links. Add a
unique key on `(id, data_source_id)` for reading references.

### Existing `energy_readings` fields

Add nullable columns first:

| Field | Purpose |
| --- | --- |
| `data_source_id` | FK to `data_sources` |
| `import_run_id` | FK to `data_import_runs` |
| `source_local_timestamp` | Original `timestamp without time zone` from BDG2 |
| `source_timezone` | Original metadata value `US/Central` |
| `normalization_timezone` | Canonical IANA value `America/Chicago` |
| `source_record_key` | Stable source key described below |
| `quality_status` | `observed` or `observed_zero` for accepted rows |
| `quality_flags` | JSON object; no inferred values |

For `public_benchmark` rows these fields are required, `interval_minutes=60`,
`provenance='public_benchmark'`, and `consumption_kwh` is finite and
non-negative. Add a partial unique index on `(data_source_id,
source_record_key)`. Keep the existing primary key `(meter_id, recorded_at)`.
Use composite FKs from `(import_run_id, data_source_id)` to the run and from
`(meter_id, data_source_id)` to the meter so a reading cannot claim a different
source from its parent records.

No rejected or ambiguous source value enters `energy_readings`. Run-level
counters and a local, Git-ignored rejection manifest retain the reason and
source record key without creating public database rows.

## Selected cohort and hard import bounds

The cohort contains one building from four primary-use categories at the
single `Hog` site and `US/Central` source timezone. Selection is reproducible:

1. require electricity, timezone, floor area, at least 99% completeness and at
   least 180 days between first and last observation;
2. require one site to contain Office, Education, Entertainment/public assembly
   and Lodging/residential candidates;
3. within each site/category choose the candidate with the fewest missing plus
   zero values, then fewest missing values, then fewest zero values, then
   lexicographically smallest building ID;
4. choose the site with the lowest combined selected missing-plus-zero count,
   then lowest missing count, lowest zero count and lexicographically smallest
   site ID.

That rule selects:

| Source building ID | Category | Area m² | Non-null | Missing | Zeros |
| --- | --- | ---: | ---: | ---: | ---: |
| `Hog_office_Bill` | Office | 13,375.5 | 17,544 | 0 | 0 |
| `Hog_education_Donnie` | Education | 6,837.4 | 17,544 | 0 | 0 |
| `Hog_assembly_Dona` | Entertainment/public assembly | 15,501.4 | 17,536 | 8 | 0 |
| `Hog_lodging_Francisco` | Lodging/residential | 14,592.3 | 17,544 | 0 | 0 |

Hard limits for `hog_four_buildings_v1`:

- one data source and one import run;
- exactly four assets and four electricity meters;
- exactly 17,544 source timestamps per meter;
- no more than **70,176 source cells** scanned;
- exactly **70,168 non-null candidate values** for the pinned file;
- 16 non-null DST-edge values quarantined under the policy below;
- no more than **70,152 accepted reading rows**;
- at most 1,000 reading rows per write batch and at most 71 batches;
- no weather or other meter-type rows.

Any count over a limit, a different building ID, an additional meter or an
unexpected file hash aborts the run. Counts below the pinned expectations also
abort unless the source file itself is re-approved under a new source version.

## Timestamp conversion and daylight-saving time

Preserve `source_local_timestamp='YYYY-MM-DD HH:MM:SS'` and
`source_timezone='US/Central'`. Convert with the canonical IANA zone
`America/Chicago`; record the exact pinned `tzdata` package version in the
import run. Before import, verify that the installed tzdata maps the source
alias and canonical zone equivalently for 2016–2017.

For every naive local timestamp, construct both `fold=0` and `fold=1`
candidates, convert each to UTC and round-trip it to the canonical local zone:

- if neither candidate round-trips to the same naive time, the local time is
  nonexistent (spring-forward); quarantine it;
- if both round-trip and have different UTC offsets, the local time is
  ambiguous (fall-back); quarantine it because BDG2 has no fold indicator;
- otherwise use the single valid instant, store it in `recorded_at`, and retain
  the source-local fields.

Do not shift, duplicate or impute DST-edge values. For this pinned period the
four affected local timestamps are `2016-03-13 02:00:00`,
`2016-11-06 01:00:00`, `2017-03-12 02:00:00` and
`2017-11-05 01:00:00`. All four selected meters have values at all four times,
so the expected quarantine count is 16.

## Stable keys and repeatability

Asset key: `(data_source_id, source_asset_id)`.

Meter key: `(data_source_id, source_meter_id)`, where `source_meter_id` is the
exact building ID plus `:electricity`.

Reading source key is the UTF-8 canonical text:

`bdg2_v1|electricity|<building_id>|<YYYY-MM-DDTHH:MM:SS>`

The importer stores that exact text in `source_record_key`. Its uniqueness is
independent of UTC conversion and makes reruns stable. The existing
`(meter_id, recorded_at)` primary key remains a second guard.

On replay, an identical persisted row is counted as an idempotent duplicate and
left unchanged. If the same asset, meter or reading key has a different source
value, timezone, UTC instant, interval, provenance or source/run identity, mark
the run failed and change nothing from the conflicting batch. Never overwrite
teammate or earlier source data with an upsert.

## Value-quality policy

| Condition | Required handling |
| --- | --- |
| Missing/blank source cell | Insert no reading; increment `observed_missing`. Missing remains missing. Expected: 8. |
| Zero | Store `0` kWh, set `quality_status='observed_zero'` and a `source_zero` flag. Do not treat it as missing or proven shutdown. Expected in selected cohort: 0. |
| Negative, NaN, infinity, unparsable numeric | Hard-fail validation before database writes; increment/report invalid count locally. Do not coerce. Expected: 0. |
| Duplicate source key with identical value and metadata | Count as an idempotent replay; no insert/update. |
| Duplicate source key with conflicting value or metadata | Hard failure; no overwrite. Expected: 0. |
| Non-hourly or unexpected timestamp | Hard failure unless it is one of the four explicit DST quarantine timestamps. |
| Ambiguous/nonexistent DST time | Quarantine locally; no final reading row. Expected: 16. |
| Outlier or unusual positive value | Preserve as observed and flag only under a separately approved, documented quality rule; do not delete during this import. |

No interpolation, forward fill, zero substitution, outlier removal or synthetic
replacement is permitted.

## Planned migration verification

Before applying a future migration, capture schema-only definitions, table row
counts, constraint/index definitions, grants, RLS flags and policy lists. Apply
the migration first to an isolated local/branch database, never directly as an
untested production edit.

The migration passes only when:

- the original five tables and every original row still exist;
- all original non-provenance constraints and indexes are definition-identical;
- the three expanded provenance checks accept both existing
  `synthetic_demo` and new `public_benchmark` values;
- existing defaults still produce `synthetic_demo`;
- new source/run fields are nullable for historical rows but required by
  cross-field checks for public-benchmark rows;
- both new tables and all five existing public tables have RLS enabled;
- `anon`, `authenticated` and `PUBLIC` have no table privileges or policies;
- `service_role` has `SELECT, INSERT` on immutable `data_sources`,
  `SELECT, INSERT, UPDATE` on `data_import_runs`, and only the explicitly
  required existing-table privileges; it has no source-row update/delete grant
  and its key remains backend-only;
- no view, trigger or `SECURITY DEFINER` function is introduced;
- security and performance advisors have no new finding attributable to the
  migration.

Supabase's current Data API behavior requires explicit grants independently of
RLS. Do not rely on project defaults or automatic table exposure.

## Planned import validation

The later import task must stop before writes unless hashes, schema version,
cohort IDs, timezone mapping and all expected counts match. Insert the source,
run, assets and meters first, then reading batches under a run in `loading`
state. Direct reads remain denied and no API exists, so incomplete runs are not
publicly visible.

Before marking the run `completed`, verify:

- one source, one run, four source-linked assets and four source-linked meters;
- 70,152 accepted readings, 8 missing source cells, 16 DST quarantines, 0
  stored/flagged zeros, 0 invalid values and 0 conflicting duplicates;
- every accepted source record key and `(meter_id, recorded_at)` is unique;
- every UTC timestamp round-trips to its recorded source-local time;
- every value, per-meter count, minimum/maximum timestamp and per-meter/year
  kWh sum matches a pre-write local manifest built from the pinned file;
- no row has a null source/run/provenance/units/semantics field;
- no existing synthetic row or count changed;
- a second dry replay produces zero inserts/updates and 70,152 identical
  duplicate results;
- RLS, grants and policies still match the post-migration snapshot.

Only after all checks pass may the run change from `loading` to `completed`.
No model training, API response or frontend display is part of that import task.

## Failure recovery and rollback

Migration failure rolls back its single transaction automatically. A manual
migration rollback is permitted only when there are no `public_benchmark` rows:
drop the new partial indexes and cross-field checks, remove added nullable
columns, restore the three original `synthetic_demo`-only checks, then drop
`data_import_runs` and `data_sources` in dependency order. Recompare the full
pre-migration schema snapshot, RLS, policies, grants and row counts.

Import failure deletes rows owned by that run in this order:
`energy_readings`, `meters`, then `assets`; it then marks the run `failed` and
retains only counters and a sanitised summary. Retain the immutable
`data_sources` row and failed run for audit. Never delete by date range,
building name or unscoped provenance. Verify pre-existing row counts and
checksums after cleanup.

A completed-run rollback requires separate explicit authorisation and uses the
same `import_run_id` sequence. After deleting its readings, meters and assets,
mark the retained run `rolled_back`. It must never use `DROP`, `TRUNCATE`,
cascading deletes or a reset of the shared database. Before deletion, count
dependent alerts and scenarios; any dependency is a hard stop requiring a
separate preservation plan rather than a cascade or forced cleanup.

## Review outcome and unresolved decisions

The design is non-destructive and sufficiently bounded for a separate migration
implementation task. It deliberately does not resolve:

- the exact hosted Postgres version and Data API auto-exposure setting, which
  must be read before migration;
- the installed Supabase CLI version and generated migration filename;
- the exact pinned `tzdata` package version, which must be selected, locked and
  recorded before timestamp conversion;
- the backend persistence client/connection method for the later batch import;
- whether a later model should use all two years or a documented chronological
  subset; model work is outside this plan;
- source meaning of any zero encountered in a future approved cohort; the
  selected cohort contains none, and the policy must not reinterpret one as
  shutdown or missing data.

These decisions do not permit a migration or import to begin implicitly.
