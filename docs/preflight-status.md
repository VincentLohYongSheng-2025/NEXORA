# Preflight evidence — 13 October 2026 (Malaysia)

**Milestone status: locally verified; deployment gate incomplete. Do not start the next major task.**

## Inspection

- Read both supplied Markdown documents completely before writing code. Copies in this directory match their originals in Downloads by SHA-256.
- Initial workspace `C:\Users\Vincent Loh\Desktop\EnergyOS` contained zero entries, including hidden files. No local `.git`, `AGENTS.md`, frontend/backend source, packages or deployment files existed. No ancestor `AGENTS.md` was found in the inspected path through `C:\`.
- Git inspection failed with `fatal: cannot change to 'C:/Users/Vincent Loh'`; no repository, owner, default branch or collaborator access was inferred. No Git repository was initialised, created remotely, moved, committed or pushed.
- Frontend framework is unknown. No frontend directory or competing app was generated.
- Read-only Vercel discovery found the team `vincentlohys-8109s-projects` and two unrelated projects (`vincent-portfolio`, `jejakspm-malaysia`); no EnergiOS project. They were not modified. Intended destination and plan eligibility remain unconfirmed.

## Exact source changes

All files are additions; nothing was overwritten or deleted.

| File | Purpose |
| --- | --- |
| `.gitignore` | Exclude secrets, environments, caches, tools, local Vercel state and generated/model artifacts. |
| `AGENTS.md` | Scope, authority, commands, test and deployment gates, data labels and prohibited claims. |
| `README.md` | Setup, built/synthetic/estimated/planned boundary, health sample, deployment procedure and limitations. |
| `docs/EnergiOS_PRD.md` | Unchanged copy of product/API authority. |
| `docs/EnergiOS_Backend_Implementation_Plan.md` | Unchanged copy of engineering workflow; unchecked items remain unchecked. |
| `docs/preflight-status.md` | This evidence and outstanding-decision record. |
| `backend/app.py` | Stateless FastAPI entrypoint, typed exact `/health` response, automatic `/docs` and `/openapi.json`. |
| `backend/pyproject.toml` | Python 3.12 constraint, exact runtime/dev package pins and test configuration. |
| `backend/uv.lock` | Resolved transitive versions and package hashes from public PyPI. |
| `backend/.python-version` | Python 3.12 selection. |
| `backend/.env.example` | Blank, unused names reserved for later backend settings. No credentials. |
| `backend/.vercelignore` | Exclude local environments, test files, caches and environment files from uploads. |
| `backend/src/__init__.py` | Namespace reserved for later authorised backend modules. |
| `backend/tests/test_api.py` | Three tests for the health contract, docs/OpenAPI and absent planned routes. |

Local generated tooling, excluded by `.gitignore`: `.tools/` holds uv 0.13.0, Python 3.12.15 and download/cache files; `backend/.venv/` holds installed dependencies; Python/pytest generated their usual caches. System Python 3.13 was not replaced.

## Verification

- Python **3.12.15**.
- `backend/.venv/Scripts/python.exe -m pytest`, executed from `backend/`: **3 passed in 2.12s**, one upstream Starlette deprecation warning about its `httpx` test-client integration. No failed tests; the warning is not suppressed.
- `uv pip check`: all **23 installed packages compatible**.
- Actual Uvicorn HTTP requests at `http://127.0.0.1:8000`:
  - `/health`: **200**, exact body `{"status":"ok","version":"1"}`; first observed request 546 ms, repeat 6 ms. These are local client timings, not Vercel cold-start measurements.
  - `/docs`: **200**, Swagger HTML (8 ms).
  - `/openapi.json`: **200**, only `/health` in `paths` (16 ms).
- In-app browser rendered **EnergiOS API / Swagger UI** with the health route, response schema and explicit planned-feature disclaimer. Browser warning/error log was empty. The documentation tab was left open.
- Initial sandboxed Python test/server processes stalled and loopback requests were denied. Those processes were interrupted. Tests and server smoke checks succeeded outside the sandbox; this was an execution-environment restriction, not a claimed application pass from the failed attempts.
- The successfully verified local Uvicorn server was left running on loopback port 8000 for the documentation tab.

## Still incomplete

- Confirm shared repository URL, owner, branch/collaborators and Vercel import access. Confirm intended Vercel team/project and applicable plan/hackathon eligibility. A clarification was requested; no destination was invented.
- Create/import the dedicated backend project with Root Directory `backend/`, deploy a Preview, inspect build/runtime logs and verify public HTTPS `/health` and `/docs`. **No deployment was attempted; no deployed base URL exists.** Local tests do not establish platform compatibility.
- Supabase project/account/region and free-plan capacity checks are deferred. No database project, credentials, schema, RLS, seeds or connection was created. The minimal app does not need them.
- Frontend owner/framework, separate frontend Vercel project, API URL variable, exact CORS origins and teammate handoff remain unconfirmed.
- All `/v1` data routes, synthetic generation, analytics, financial/carbon estimates, protected writes and final end-to-end demo remain planned. No synthetic or estimated outputs are served at this stage.

## Current platform references

Checked the official [FastAPI entrypoint guide](https://vercel.com/docs/frameworks/backend/fastapi) and [Python runtime guide](https://vercel.com/docs/functions/runtimes/python): standard `app.py` is supported, Python 3.12 is available and a `uv.lock` can accompany `pyproject.toml`. The root-directory design follows the PRD and [monorepo guide](https://vercel.com/docs/monorepos).

The [fair-use guidelines](https://vercel.com/docs/limits/fair-use-guidelines) retain the non-commercial personal-use restriction for Hobby and direct uncertain cases to Vercel Support. No conclusion about this competition's eligibility was invented, and no support message was sent.

## Git handoff preparation — 13 October 2026 (Malaysia)

- The user confirmed and authorised pushing to `https://github.com/VincentLohYongSheng-2025/EnergiOS.git`. GitHub metadata identifies it as public, owned by the user account `VincentLohYongSheng-2025`; remote inspection found no existing refs or commits before initialisation.
- Git inspection outside the sandbox discovered an unrelated ancestor repository at `C:\Users\Vincent Loh\.git`. A separate repository was initialised in this project on `codex/phase-0-scaffold`; the ancestor repository was not modified.
- `origin` points to the authorised shared repository. Only the 14 scaffold files listed above are intended for this commit. Local tooling, virtual environments, caches and actual environment files are ignored; the example settings remain blank.
- Pre-commit verification: the API suite passed again, **3 passed in 1.05s**, with the same single upstream deprecation warning.
- This section records preparation for the initial commit/push. The final handoff reports the actual commit hash and verifies the remote branch after pushing. The original PRD and implementation plan remain unchanged.
- The next outstanding backend deployment task is Preflight item 3: deploy this minimal app as a separate Vercel project with Root Directory `backend/`, then test public `/health` and `/docs`. The deployment gate remains incomplete. The current authorisation covers Git handoff only; Vercel creation, credentials and Supabase work are deferred.

## Minimal deployment verification — 13 October 2026 (Malaysia)

This update supersedes the earlier deployment blocker. The user authorised a best-effort temporary demo deployment while explicitly acknowledging that Vercel Hobby eligibility remains unconfirmed. No support confirmation or eligibility claim is made.

- Team: `vincentlohys-8109s-projects`.
- Created project: `energios-backend` (`prj_kyOkrLnMczkJaul3djhsyGGzeqZK`), linked to `VincentLohYongSheng-2025/EnergiOS` with FastAPI framework and Root Directory `backend`.
- Deployed source: `9f071d9d5eb5036de373ae60b73dc8053d90527b`, branch `codex/phase-0-scaffold`.
- Deployment: `dpl_2ec4WzptU2HCM9sYTEuLXEWu7amW`, Vercel status **READY**, target **production** (selected by Vercel for the default branch).
- Public base URL: `https://energios-backend.vercel.app`.
- Build logs confirm Python **3.12** from `backend/.python-version`, dependencies installed from `uv.lock`, and build completed in **4 seconds**. No application source or dependency changes were needed.
- Unauthenticated requests with redirects disabled verified:
  - `https://energios-backend.vercel.app/health`: **200**, exact raw body `{"status":"ok","version":"1"}` on both requests (376 ms and 305 ms).
  - `https://energios-backend.vercel.app/docs`: **200**, Swagger UI HTML referencing `/openapi.json` (300 ms). The in-app browser rendered the health operation and schema, with an empty warning/error log.
  - `https://energios-backend.vercel.app/openapi.json`: **200**, API version `1`, only `/health` advertised, literal `ok`/`1` response schema (328 ms).
- These are observed request timings; they do not establish a Vercel cold start.
- Deployment-specific hostname `energios-backend-c6ltblmaj-vincentlohys-8109s-projects.vercel.app` and team alias `energios-backend-vincentlohys-8109s-projects.vercel.app` returned **302** with `Protected by Vercel Authentication` for all three endpoints. No protection settings or bypass credentials were changed. The automatically assigned production domain above is publicly accessible.
- The most recent local test run before deployment passed **3 tests**, with one existing upstream Starlette deprecation warning. No application code changed afterward.
- No Vercel payment/upgrade request was returned, no plan upgrade or paid add-on was selected, and no application secrets/environment variables were added.
- Frontend teammate can use the public base URL for API documentation and health checks. Browser cross-origin integration still needs the teammate's exact frontend origin and CORS configuration; no frontend framework or origin has been invented. `/v1` functionality and all data/savings features remain unavailable.
- A separate Preview deployment has not been verified; this evidence is for the public production deployment. Supabase, database, AI and frontend work remain unstarted.

## Day 1 Task 2/3 evidence — 13 October 2026 (Malaysia)

This update supersedes the earlier statement that schema/seed work is unstarted.
The deployment remains unchanged.

- The user reports hosted Supabase security verification passed for all five
  tables: RLS true, anon/authenticated access false, service read true, no policies.
  This is user-provided catalogue evidence, not an agent-run hosted request.
  Details are in `docs/schema-verification.md`, committed separately as
  `251a765a121819a534b37db44f520dfdb80afcbc` (documentation only).
- Day 1 Task 3 is built offline: a versioned fictional fixture specification,
  standard-library generator, run manifest and insert-only SQL export. Four
  assets, seven meters, 28 days and 4,704 hourly readings use `synthetic_demo`.
  One Floor 2 event adds 60.0 kWh at `2026-10-08T12:00:00Z`; building totals
  reconcile exactly with all floors. Repeated generation is an unchanged no-op.
- Verification: 8 Python tests and 10 local PostgreSQL tests passed. Actual seed
  SQL was applied twice to a disposable database; conflicting existing readings
  caused complete rollback without overwriting rows. RLS/grants stayed unchanged.
- Public `/health` was tested again: HTTP 200, exact body
  `{"status":"ok","version":"1"}`. No app, dependency or Vercel changes.
- Remote branch inspection still finds only `codex/phase-0-scaffold` at
  `9f071d9d5eb5036de373ae60b73dc8053d90527b`, with no frontend code.
  Frontend compatibility remains unverified; `/v1` endpoints remain planned.
- No hosted seed writes or credential inspection occurred. Configure backend-only
  Supabase variables privately before applying the reviewed export. Hosted seed
  idempotency/capacity and real backend database reads remain unverified.
- See `docs/seed-verification.md` for exact generation/test commands, provenance
  boundaries and the gated manual load action. No later task has started.

## Minimal BDG2 migration and isolated import — 13 October 2026 (Malaysia)

- Official files were fetched from pinned commit
  `3d0cbaf7ba281029ce04887503ab56f3c8344575` and kept under the Git-ignored
  `data/source/` directory. SHA-256 verification matched the assessment:
  metadata `992d0b29f24f96ad4332bc4dbb534b7bdd7dd2689aad093f94e93068ecddca02`;
  cleaned electricity `b01056f4ceec1992ce019297e674d6d6ecd0240e50a2aaeb6f958c65efdc282d`.
- The additive migration was reduced to the hackathon-safe minimum: one source
  table, one import-run table, direct source/run identifiers, source-scoped
  unique keys and essential public-benchmark validation. It adds no composite
  foreign keys, triggers, views, cascading deletes or advanced rollback layer.
- The migration and import ran only in disposable PGlite 0.5.9 (PostgreSQL
  18.6-compatible). Hosted `energios-demo` PostgreSQL 17.11 was not modified;
  the project has no Supabase branch and the local Docker daemon is stopped.
- The imported cohort contains four `Hog` whole-building electricity meters and
  **70,152** accepted hourly interval-kWh readings. The extractor verified
  17,544 source timestamps, 70,176 bounded cells, 70,168 non-null values,
  8 missing values, 16 quarantined ambiguous/nonexistent DST values, 0 zeros
  and 0 invalid values. UTC coverage is `2016-01-01T06:00:00Z` through
  `2018-01-01T05:00:00Z`; source timezone is `US/Central`, normalisation uses
  `America/Chicago`, and `tzdata==2026.5` is locked.
- A second complete import produced unchanged counts and aggregates: one source,
  one run, four assets, four meters and 70,152 readings. Stable source keys,
  per-meter counts/sums/ranges, units and provenance reconciled to the manifest.
- Security/catalogue checks passed: all seven tables have RLS, no public-client
  policies or grants exist, and every original row, non-provenance constraint,
  index, grant, RLS flag and policy remains unchanged in the isolated test.
- Final verification: 15 Node/PostgreSQL tests passed; 9 Python tests passed with
  one existing Starlette/httpx deprecation warning. No frontend, API, model,
  deployment, hosted database, credential, commit or push operation occurred.

## BDG2 forecast and unusual-pattern evaluation — 13 October 2026 (Malaysia)

- The evaluator reads only the verified local `bdg2_v1` import bundle, checks
  its `public_benchmark` provenance, accepted count and canonical reading hash,
  and uses all four whole-building electricity meters. No synthetic fixture is
  used for training or reported performance.
- Calendar boundaries are chronological: train starts
  `2016-01-01T06:00:00Z`, validation starts `2017-03-14T06:00:00Z`, test starts
  `2017-08-07T06:00:00Z`, and test ends `2018-01-01T06:00:00Z` exclusive.
  Validation fits use only train observations; the final test fit uses train
  plus validation. Rolling origins forecast the next 24 hours using only prior
  observations.
- The small standard-library model blends a 168-hour seasonal profile with the
  previous-day same-hour value. The blend weight and robust residual threshold
  are selected on validation only. The held-out test has 14,081 comparable
  readings: model MAE **24.223073 kWh** and RMSE **37.903324 kWh**, versus
  baseline MAE **27.180704 kWh** and RMSE **47.311611 kWh**.
- Validation MAD thresholds detected **144** held-out observations, all labelled
  `unusual_consumption_pattern` with no asserted cause. The generated report
  includes 24 future hourly forecasts per meter and is retained only under the
  ignored `data/local/` path.
- `docs/bdg2-model-evaluation.md` records per-meter metrics, method evidence and
  limitations. No schedule, after-hours, HVAC, waste, tariff, savings,
  Sime Darby or Elmina claim is made.
- Locked-environment verification passed: **12/12** analytics/import/seed tests
  using a workspace-local pytest temp directory, plus **3/3** existing API
  contract tests outside the sandbox's loopback restriction. The API tests emit
  the existing Starlette/httpx deprecation warning. Two consecutive evaluator
  runs returned `status: unchanged`; the generated report SHA-256 is
  `78c37bec07b47d1de9c8b3d152cd0661c5971c9efd6cb72884700eecdb47af79`.
- No API, frontend, chatbot, hosted Supabase, deployment, credential, commit or
  push operation occurred. The next P0 task is the bounded DB-backed readings
  and forecast/anomaly API.

## Read-only BDG2 API — 13 October 2026 (Malaysia)

- Four unversioned routes are implemented locally: `GET /assets`,
  `GET /assets/{asset_id}/readings`, `GET /assets/{asset_id}/forecast` and
  `GET /assets/{asset_id}/anomalies`. OpenAPI advertises these routes plus the
  unchanged `/health` contract; `/v1` routes remain absent.
- The service accepts only a completed `bdg2_v1` `public_benchmark` import whose
  source/run IDs and accepted reading count match the stored manifest. It reads
  assets, meters and all observations through the backend-only Supabase Data
  API and prepares the already validated deterministic analytics before serving
  data requests. Missing credentials, incomplete imports, lineage mismatches and
  database failures return an explicit 503; no synthetic or file fallback exists.
- IDs use UUID validation. Reading ranges require paired timezone-aware `from`
  and `to` values, are half-open and capped at 31 days; reading limits are
  1–1,000. Anomaly ranges are capped at 366 days and limits at 1–500. Asset list
  limits are 1–100. Unknown valid asset IDs return 404.
- Responses retain UTC and source-local timestamps, interval kWh units,
  `public_benchmark` provenance and the BDG2 attribution. Readings are labelled
  `observed`, forecast values `forecast`, and detections only
  `unusual_consumption_pattern` with a null cause.
- Route tests use an isolated in-memory SQLite database populated with all
  70,152 verified local BDG2 import readings. The complete locked Python suite
  passed **26 tests** in 26.31 seconds. It emits the existing Starlette/httpx
  deprecation warning. The focused PGlite import/replay/security suite passed
  **3 tests** in 17.35 seconds. Lock validation, Python compilation and `git
  diff --check` also passed.
- Current official Supabase guidance was rechecked: Data API table exposure and
  grants are separate from RLS. The existing migration explicitly grants the
  backend `service_role` its required reads while public clients remain denied.
  No grant, policy or schema change was made in this API task.
- The latest accessible local and remote Git trees contain no frontend code, so
  frontend request compatibility remains unverified. The PRD now records the
  owner-approved unversioned route contract.
- Hosted Supabase and Vercel were not modified or queried. Since the hosted
  database does not yet contain this verified import, no deployed data endpoint
  success is claimed. No credential, commit or push operation occurred.


## Isolated full-stack design integration — 16 October 2026 (Malaysia)

- New branch/worktree: `codex/full-stack-design-integration` at `C:/Users/Vincent Loh/.codex/worktrees/full-stack-design-integration/EnergyOS`, based exactly on feature commit `2aeeea2b33cee657c3deda1f1791d7f4ff35b9c9`. Norman frontend reference `39593d2` and integration baseline `f3c6a93` were inspected; no branch was merged or moved.
- Restored Norman's diagnostics, storage/energy, township scene/drawer and settings page frames instead of full-page guards/replacement pages. Existing dashboard and methodology remain. Real assets/readings/forecasts/anomalies are fetched through `/api`, with source IDs, historical years/timezone, units, errors/loading/empty states, stale-selection protection and mobile navigation. Images/geometry/equipment graphics are explicitly illustrative.
- Added local stateless `/demo/energy-scenario`, `/demo/peak-shift`, `/demo/impact`, `/demo/portfolio`, `/demo/assistant/status`. Existing five routes, DB schema/RLS/import/analytics and frontend React directory are unchanged. The local calculation backend reads the prepared approved data service or fixed public BDG2 API, never operational mocks. No new endpoints are deployed.
- Verification passed: **36/36 Python backend tests** (26.78 s), **17/17 isolated PostgreSQL schema/RLS/import/replay tests**, **18/18 frontend tests**, frontend production build, and final `git diff --check`. Internal synthetic fixtures remain isolated legacy tests only; they never supply application observations, forecasts, charts or hosted rows.
- Actual public and same-origin proxy smoke calls returned HTTP 200: health exactly `{"status":"ok","version":"1"}`; assets count 4; office readings count 24; forecast count 24; anomalies total 118, all `bdg2_v1` and kWh. Normal browser traces showed successful GET calls around 0.3–0.6 s and local scenario/portfolio POST/GET calls around 0.8–0.9 s on the observed warm run. No fixed latency guarantee is implied.
- Real browser checks covered desktop 1440x1000 and mobile 390x844: all six pages, building switching, 24-hour forecast, actual anomaly audit and zero-pattern empty state, source citations, energy/storage/peak scenarios, 3D scene/building drawer, illustrative 2D plan, appearance/local preferences and impact assumptions. Mobile overflow found in loading metrics/header was corrected and retested without hiding horizontal overflow. Missing Chart.js on the township page was fixed using the existing version.
- Browser calculation checks: zero solar plus zero starting SOC produced zero solar/discharge and unchanged grid demand; a 20 kWh shift conserved energy. Identical shift intervals yielded a visible validation error and `Not calculated`, then valid inputs recovered. Missing tariff/factor/investment inputs withheld estimates. Explicit hypothetical 0.5 MYR/kWh and 0.2 kg CO2e/kWh applied to 4,264.69 observed kWh yielded 2,132.34 MYR and 852.94 kg CO2e. Explicit 1,000 MYR CAPEX, 2,000 kWh/year reduction, 100 MYR/year maintenance yielded 900 MYR/year and 1.11-year simple payback. These are test assumptions, not sourced tariffs, verified savings or investment advice.
- No application JavaScript console errors occurred in normal screen checks. An intentional invalid-scenario HTTP 422 is an expected validation test, not a passing operational response. Existing Tailwind CDN warning, Starlette/httpx deprecation, large Three.js build chunk and inherited npm audit findings (one moderate, one high in the development toolchain) remain disclosed limitations.
- Credential-pattern scans of tracked text, changed/new files and built JS/HTML found no credential-pattern matches. No snapshot JSON is bundled; all four dynamic building-image paths are preserved in build output. Gemini key-presence checks in the process and expected local project env files were false; values were never printed. AI remains explicitly unavailable, with no fake conversations, agent logs or autonomous control.
- Review remains local at `http://127.0.0.1:4175/`; calculation backend runs on `127.0.0.1:8001`. No hosted Supabase, production deployment, secret setting, commit, push or merge was changed. Equipment-level diagnosis, actual site/network geometry, verified savings, investment ranking and a real Gemini assistant remain unbuilt/unavailable as documented.


## Read-only Gemini assistant verification — 17 October 2026

- Isolated branch remains `codex/full-stack-design-integration` at `2aeeea2b33cee657c3deda1f1791d7f4ff35b9c9`; prior integration changes preserved. No commit, push, merge, hosted database/secret/deployment change.
- Key present: **no**. Automated success-path responses are mocked; no real Gemini answer or provider access/quota has been verified. No key value was printed or stored. Configure the key privately for the local backend process, restart it and retry availability before a live question/answer check.
- Full Python suite: **62 passed**, one inherited Starlette/httpx deprecation warning. Includes 26 focused assistant cases for selected-asset evidence, headers-only key transmission, request bounds, simulations, invalid/blocked provider responses, unsupported numbers/citations, secret-shaped output, timeouts, quota/rate/concurrency limits and safe errors.
- Full frontend suite: **28 passed**, including 10 assistant contract/state tests. Success-path answers are mocked. Existing readings, forecast, anomalies, simulations and compliance checks pass.
- Existing isolated PostgreSQL schema/import suite: **17 passed**. These tests use the local disposable harness only; no hosted Supabase access or writes.
- Production frontend build: **passed**, with the inherited Three.js chunk-size warning. No dependencies or lockfiles changed. Frontend built-text credential-pattern scan and new assistant-file whitespace checks passed; `git diff --check` passed.
- Actual local smoke checks: backend `/health` 200 with exactly `{"status":"ok","version":"1"}`; existing public backend `/health` 200 with the same body; same-origin `/api/health` 200; `/api/demo/assistant/status` 200 with available=false/read_only=true; `/api/demo/assistant/chat` 503 explicit unavailable. An initial 10-second proxy health request timed out; subsequent direct and proxy checks passed. No fallback data or AI answer was substituted.
- Actual public BDG2 evidence assembly (without contacting Gemini) passed: four approved catalogue assets, selected asset verified, 24 observed intervals and 24 forecast intervals; zero anomaly examples for the checked first asset, not a fabricated anomaly. The assistant includes actual detector count/rule and bounded examples when present.
- Earlier in this task, actual desktop and 390×844 browser checks showed Norman's panel, four real API-returned building options, current dashboard selection, missing-key status, retry and disabled sending; mobile panel width about 367 px with no horizontal overflow, and no browser console errors were reported. Dashboard asset switching was exercised. The later final browser recheck was **blocked by the browser URL policy** before page observation; it was not bypassed and is not claimed as a fresh pass. Live chat cannot be browser-verified without private key setup. Final code's asset-refresh/loading/error paths are additionally covered by frontend tests.
- Original workspace still shows only the pre-existing untracked `frontend/` and `docs/backend-frontend-integration-contract.md`. All task edits are in the isolated worktree. The exact assistant file list and API contract are in `full-stack-demo-integration.md`.

## Final local full-stack review — 17 October 2026

- Work remained on uncommitted branch `codex/full-stack-design-integration` at baseline commit `2aeeea2b33cee657c3deda1f1791d7f4ff35b9c9`. No commit, push, merge, deployment, hosted Supabase change or environment-file change occurred.
- Local health returned exactly status `ok`, version `1`. Assistant status returned available=true and read_only=true; no key value was requested, printed, logged or returned. A real selected-asset Gemini response was rendered in Norman's panel with observation, forecast, anomaly and limitation citations. It identified the source as BDG2 public benchmark data and withheld unsupported Sime Darby, equipment, cause, measured solar/battery, tariff, savings and control claims.
- Browser review covered dashboard asset switching and labelled export; diagnostics data and asset switching; microgrid assumptions; valid and invalid peak shifts; derived four-building peer metrics; illustrative township/building context; Green CFO missing and complete candidate inputs; methodology citations; Gemini; loading/error recovery; and navigation. All six routes had zero horizontal overflow at 390×844. Browser console errors were zero; the inherited Tailwind development-CDN warning remains.
- Verification passed: **63 Python tests**, **15 relevant disposable PGlite schema/import/security tests**, **30 frontend tests**, frontend production build and `git diff --check`. The existing Starlette/httpx deprecation and large Three.js chunk warnings remain. The validated BDG2 import and historical readings were not altered.
- Remaining data gaps are unchanged: no authorised Sime Darby/Elmina telemetry, operating schedules, occupancy, equipment/floor/room mapping, BMS/SCADA, measured solar/battery/EV data, applicable commercial tariff, official project carbon factor, vendor CAPEX/OPEX, intervention baseline/post-action measurements or control authority. Corresponding visuals stay illustrative and all scenario outputs require disclosed user assumptions.

## Daily and monthly observed-history fix — 17 October 2026

- Root cause confirmed in code: the dashboard fetched 168 readings, displayed only the latest 24 hourly points and rejected non-hourly controls. The existing readings API supports UTC `from`/`to` filters, but one request is limited to 31 days and 1,000 readings.
- Added the local read-only `GET /demo/assets/{asset_id}/history` contract. It uses the existing date-filtered reading route in bounded month windows, aggregates observed hourly interval kWh by the asset's IANA timezone, and reports complete/partial totals plus expected, observed and missing interval counts. Existing endpoint contracts and database records are unchanged.
- Real BDG2 check for `Hog_office_Bill`: Daily 1–31 December 2017, 31/31 complete days and 744/744 intervals; Monthly January–December 2017, 11/12 complete months and 8,758/8,760 intervals. The two missing November intervals were reported and not filled. Asset switching in Monthly refreshed `Hog_assembly_Dona` to 10/12 complete months and 8,750/8,760 intervals.
- Automated verification: **71 backend tests passed**, **32 frontend tests passed**, production build passed, and `git diff --check` passed. Focused tests cover spring/fall DST boundaries, month length, missing/empty periods, duplicate/invalid inputs and bounded range/limit calls.
- Desktop 1440×1000 and mobile 390×844 checks showed functional Daily and Monthly controls, observed labels, local date ranges, coverage text and zero document-level horizontal overflow after layout settled. Asset switching worked while Monthly remained active. No new browser application errors occurred; the inherited Tailwind development-CDN warning remains. No database, hosted Supabase, credential, deployment, commit, push or merge change occurred.

## Township HVAC and floor simulation tabs — 17 October 2026

- The inaccessible tabs were caused by literal disabled buttons in the drawer renderer plus the absence of tab state or handlers. Existing backend contracts correctly expose whole-building evidence only and remain unchanged.
- The drawer now separates Building evidence, HVAC simulation and Floor simulation with accessible tab roles. The top floor selector opens the same local floor simulation. HVAC share/setpoint/fan/mode/enabled inputs and the three illustrative floor allocations live only in browser memory; no control request or database write exists.
- Browser checks used the real `Hog_office_Bill` observed 185.0 kWh interval. Changing the simulated HVAC share from 35% to 50% updated the labelled allocation from 64.7 to 92.5 kWh. Changing Ground from 34% to 50% produced a 116% invalid total and `Not calculated`; reset restored 100% and the simulated allocation. These are assumptions, not measured HVAC/floor values or savings.
- Desktop and 390×844 drawer checks passed after constraining the mobile drawer to the viewport; mobile document-level horizontal overflow was zero. No application console errors were recorded. The inherited Tailwind development-CDN warning remains.
