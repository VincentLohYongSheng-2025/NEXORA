# Day 1, Task 3: deterministic synthetic seed

## Built and synthetic

`backend/seed_manifest.json` is the versioned fixture specification, not a real
dataset. `backend/src/seed.py` generates the dataset, a run manifest with SHA-256
and expected event metadata, and an insert-only SQL export. All three output
files live under ignored `data/generated/seed-v1/`; generated readings are not
committed. No external dataset, tariff, carbon factor or credentials are used.
The generator is standard-library Python, with no dependency or app changes.
It never reads environment variables or makes a network/database connection.
It does not run on app import, web requests or deployment startup.

The four fictional assets are Demo Meridian House (focus commercial building),
Demo Lantern Arcade, Demo Willow Hall and Demo Pebble Library. All positions,
areas and consumption profiles are illustrative. Every asset/meter/reading uses
`synthetic_demo`; the manifest label is **Synthetic demonstration data**.

- Four assets, seven meters: three focus floor submeters, one focus building
  total, and one building-total meter for each other asset.
- 28 days, 672 intervals per meter, **4,704 readings**. Range:
  `2026-09-11T16:00:00Z` inclusive to `2026-10-09T16:00:00Z` exclusive,
  corresponding to 12 September through 9 October in Malaysia.
- Stable explicit UUIDs, fixed seed `20261013`, generator version `1`, UTC
  timestamps and 60-minute interval kWh. No dependency on today's date or host
  timezone. The fixture's Malaysia timezone uses an explicit UTC+08:00 offset.
- One deliberately injected event on Floor 2 on 8 October, 20:00–21:00 Malaysia
  (`2026-10-08T12:00:00Z` to `13:00:00Z`), adding 60.0 kWh to that interval.
  The run manifest records the original and injected consumption. The fictional
  operating schedule is Monday–Friday, 08:00–18:00; prior comparable weekday
  hours remain uncontaminated by the injection.
- Focus building total equals the sum of its three floors at **every** interval,
  including the injected hour. Its mirrored excess is the same event, not a
  second injection. Asset/portfolio consumption must use building totals without
  adding diagnostic floor readings again.
- The expected future alert target is the injected floor interval, rule code
  `AFTER_HOURS_EXCESS`. The expected count is fixture metadata, **not a detected
  or persisted alert**. Alerts/scenarios remain empty; analysis is a later task.
  Synthetic excess does not prove waste, HVAC cause or savings.

## Generate and verify offline

From `backend/` in PowerShell:

```powershell
uv run --locked python -m src.seed
uv run --locked python -m src.seed
uv run --locked pytest
```

The second generation is an unchanged no-op. If existing output differs or is
incomplete, generation fails without overwriting it. Use a new output directory
with `--output` after inspecting the difference. No force/delete option exists.
Review generated `manifest.json`, `dataset.json` and `seed.sql` locally.

From the repository root, using the existing isolated PostgreSQL verifier:

```powershell
npm.cmd install --prefix .tools/schema-check --no-save --package-lock=false '@electric-sql/pglite@0.5.9'
node --test backend/tests/schema.test.mjs backend/tests/seed.test.mjs
```

Python tests check repeatable values/counts, complete unique hourly keys,
provenance, every-hour total reconciliation, expected event metadata and output
preservation. PostgreSQL tests apply the exported SQL twice, compare all stored
rows, verify counts and numeric reconciliation, and prove that a conflicting
existing reading rolls back the entire transaction. Existing RLS/grants are
unchanged. These checks use disposable local databases only.

Recorded on 2026-10-13:

- Two CLI runs: `created`, then `unchanged`; 4 assets, 7 meters, 4,704 readings.
- `uv run --locked pytest`: **8 passed**, including 5 seed tests and the existing
  3 API tests; one existing Starlette/httpx TestClient deprecation warning.
- Combined PostgreSQL schema/seed suite: **10 passed, 0 failed**. The actual SQL
  was applied twice locally; conflicting existing data was preserved on rollback.
- Injected floor interval: 65.1 kWh; uninjected value: 5.1 kWh; excess: 60.0 kWh.
- Actual public GET `https://energios-backend.vercel.app/health`: HTTP 200, body
  exactly `{"status":"ok","version":"1"}`. No redeployment was performed.
- Generated output is ignored by Git. No hosted database writes were performed.

## Loading and remaining work

**No hosted seed insertion has been performed.** Do not apply the export until
`SUPABASE_URL` and `SUPABASE_SECRET_KEY` are configured privately for the intended
backend synthetic-demo project. These are the existing environment names; do
not paste their values into chat, logs, Git or frontend settings. No environment
file is read or changed by this generator. A runtime Supabase client is still
planned; this task provides a reviewed SQL load path, not a second application
persistence strategy.

After private configuration and review of project capacity, the manual load
action is: select that same project → SQL Editor → New query → paste the generated
`data/generated/seed-v1/seed.sql` → Run as the database owner. The SQL locks only
the three seeded tables for its bounded transaction, compares existing matching
keys, inserts missing rows and leaves identical rows untouched. Differing rows
raise a safe error and require rollback; unrelated rows are never deleted or
updated. A concurrent write waits for the transaction. Hosted idempotency and
capacity remain unverified until this is run there. Do not apply again to an
already-modified fixture without inspecting conflicts.

Check counts scoped to the manifest's IDs/time range after loading; unrelated
project rows can make global table counts larger. Do not include diagnostic
floor readings in a building/portfolio total.

## Frontend compatibility

Remote branches were refreshed before coding on 2026-10-13. The only accessible
branch is `codex/phase-0-scaffold`, at
`9f071d9d5eb5036de373ae60b73dc8053d90527b`, and contains no frontend code.
Frontend API expectations therefore cannot yet be compared. OpenAPI still
documents only `/health`; the PRD `/v1` APIs remain planned. No frontend files,
API contract, PRD, implementation plan or deployment configuration changed.
