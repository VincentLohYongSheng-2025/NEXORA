# Day 1, Task 2: demo schema

## Scope and status

`backend/sql/001_demo_schema.sql` is the versioned schema for the five PRD tables.
It contains no seed rows, credentials, database client or API routes. Scenarios
have a storage table because this task explicitly requests it; scenario storage
and calculation remain planned. The existing FastAPI health/docs contract is
unchanged. Hosted application and the security inspection passed according to
the user's report on 2026-10-13; the agent has not independently queried that project.

The latest accessible remote commit inspected was
`9f071d9d5eb5036de373ae60b73dc8053d90527b` on
`origin/codex/phase-0-scaffold`. That tree has no frontend code or frontend branch.
Frontend request/field/unit/status compatibility therefore remains unverified.
The current OpenAPI schema advertises only `/health`; the PRD's `/v1` endpoints
are planned. No frontend files, API contracts or source planning documents change.

## Decisions

- UUID primary keys; readings use `(meter_id, recorded_at)` as their primary key.
  Foreign keys use `ON DELETE RESTRICT` to preserve dependent evidence.
- `timestamptz` stores instants; equivalent timezone representations deduplicate.
  Readings have 60-minute intervals and non-negative numeric kWh. NaN is denied.
  Alert observed/baseline kWh also cannot be negative or NaN. Missing readings
  remain absent; no zero-filled rows are generated.
- Alert uniqueness is `(meter_id, window_start, window_end, rule_code)`.
  Windows must have a positive duration. Status is `open` or `acknowledged`.
  Acknowledgement workflow/timestamp handling remains a later API task.
- One active building-total meter per asset; floor meters require a floor label.
  Summaries and prevention of double-counting remain a later backend task.
- Assets/meters/readings accept only `synthetic_demo` provenance. Schematic
  coordinates are an optional finite pair, not latitude/longitude. Floor area is
  supplied explicitly and must be positive. No tariff or carbon defaults exist.
- Asset type and severity are nonempty text because the PRD has no fixed enums
  for them. JSON evidence/assumptions/results must be objects. Scenario
  `result_status` is always `estimated` (Assumption-based estimates). Its optional
  alert foreign key ensures existence; validation that the alert belongs to the
  selected asset remains required before implementing the P1 storage endpoint.
- RLS is enabled on all five tables with **no client policies**. All table grants
  to `PUBLIC`, `anon` and `authenticated` are revoked, including defaults from
  older projects. Direct public reads and writes are denied. Future public demo
  reads go through FastAPI with a backend-only service credential. `service_role`
  receives only SELECT/INSERT/UPDATE/DELETE and uses Supabase's BYPASSRLS. This is
  not user authentication or an implemented backend write authorization check.
- No global default privilege changes, triggers, functions or extensions.
  The migration runs as one transaction and deliberately fails if any target
  table already exists. Do not replace this with `IF NOT EXISTS` or drop tables;
  inspect conflicts and prepare a separate reviewed migration instead.

Supabase's [API security guide](https://supabase.com/docs/guides/api/securing-your-api)
explains that grants control table access independently of
[RLS](https://supabase.com/docs/guides/database/postgres/row-level-security).
Both controls are verified here. Current Supabase changelog was checked; the
announced TLS/legacy cipher/index changes do not change this schema's decisions.

## Local verification

The focused test uses a disposable in-memory PostgreSQL engine,
`@electric-sql/pglite@0.5.9`, isolated in ignored `.tools/`. It is not a FastAPI
runtime dependency. From the repository root in PowerShell:

```powershell
npm.cmd install --prefix .tools/schema-check --no-save --package-lock=false '@electric-sql/pglite@0.5.9'
node --test backend/tests/schema.test.mjs
```

The test models Supabase roles and legacy default grants, then applies the actual
SQL. It checks keys, deduplication, foreign keys, invalid energy/window/provenance
values, read/write denial as both `anon` and `authenticated`, service-role access,
RLS denial even when grants are temporarily restored, and safe failure on reapply.
Fixtures are synthetic and exist only in the disposable test database. Local
PostgreSQL checks do not prove hosted Supabase/PostgREST integration.

Run the existing FastAPI tests from `backend/` with `uv run --locked pytest`.
Test the deployed health endpoint separately; no redeployment is needed.

Recorded on 2026-10-13:

- `node --test backend/tests/schema.test.mjs`: **8 passed, 0 failed**.
- `uv run --locked pytest`: **3 passed**, with the existing Starlette/httpx
  TestClient deprecation warning.
- Actual public GET `https://energios-backend.vercel.app/health`: **HTTP 200**,
  body exactly `{"status":"ok","version":"1"}`.
- `git diff --check`: passed. Existing uncommitted
  `docs/preflight-status.md` work was preserved.

The first schema test run had an error-code assertion mismatch for PostgreSQL's
RESTRICT violation; the database correctly prevented deleting a referenced
parent. The assertion now recognizes both restrict and foreign-key violation
codes, and the complete suite passes.

## Hosted security evidence

On 2026-10-13 the user reported that the hosted security query returned all five
tables (`assets`, `meters`, `energy_readings`, `alerts`, `scenarios`) with:

| Check | Reported result for every table |
| --- | --- |
| `rls_enabled` | `true` |
| `anon_access` | `false` |
| `authenticated_access` | `false` |
| `service_read` | `true` |
| `policy_count` | `0` |

This is user-provided hosted catalogue evidence, not an agent-run API request.
It confirms the reported RLS/grant configuration. A real backend database read
and an actual hosted anonymous write request have not been demonstrated here.
No project identifiers or credentials are recorded in these notes.

## Apply instructions (reference for a new project only)

The user reports the current hosted schema is already applied. Do not rerun the
creation migration there. The instructions below are retained for a new project.

1. In Supabase Dashboard, select the intended **synthetic demo project**. No
   project ID or credentials have been chosen or added by this change.
2. Open **SQL Editor → New query**. First check for existing target tables:

   ```sql
   SELECT table_name FROM information_schema.tables
   WHERE table_schema = 'public'
     AND table_name IN ('assets','meters','energy_readings','alerts','scenarios');
   ```

   If any rows exist, stop and inspect them; preserve existing work.
3. Paste the complete contents of `backend/sql/001_demo_schema.sql` into a new
   query and click **Run** as the default database owner (`postgres`). Apply once.
   On an error, roll back the transaction before further SQL and report the error.
4. Inspect hosted security with this read-only query. Expect five rows with
   `rls_enabled=true`, both client privilege flags false, `service_read=true`
   and `policy_count=0`:

   ```sql
   SELECT c.relname AS table_name, c.relrowsecurity AS rls_enabled,
     has_table_privilege('anon', c.oid, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE') AS anon_access,
     has_table_privilege('authenticated', c.oid, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE') AS authenticated_access,
     has_table_privilege('service_role', c.oid, 'SELECT') AS service_read,
     (SELECT count(*) FROM pg_policy p WHERE p.polrelid=c.oid) AS policy_count
   FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
   WHERE n.nspname='public' AND c.relname IN
     ('assets','meters','energy_readings','alerts','scenarios')
   ORDER BY c.relname;
   ```

A real backend database read and a hosted anonymous write attempt remain
unverified. No Supabase credentials are required in Git, the frontend or chat.
The user has now authorized Day 1 Task 3 (synthetic seed generation) only;
read APIs and other later tasks remain planned.
