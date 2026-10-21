# EnergiOS — Backend Implementation Plan

**Version:** 1.2 provisional public-benchmark workflow · **Date:** 13 October 2026 (Malaysia)
**Companion:** `EnergiOS_PRD.md` · **Owner:** Backend engineer
**Goal:** Deliver FastAPI + Supabase + evaluated real-data energy analytics on Vercel, connected to the actual frontend. This ordered plan does not claim its capabilities are built or can fit within two days without the data gate.

## Authority, build rule and release gate

The PRD controls product scope, API intent and claims. This plan controls task order. Code, tests, real data and deployment evidence determine completion. Inspect the repository and `git status` before each task, preserve teammate work, and implement only the next unchecked P0 task unless explicitly directed otherwise. Do not begin P1/P2 features automatically.

The organiser's real-data requirement, reported by the user, supersedes the synthetic-demo workflow. **Do not load Task 3's deterministic synthetic seed into the submitted Supabase database.** Synthetic, fabricated or AI-generated operational data must never power submitted ML training, frontend charts or demo. Preserve Task 3 files as historical internal test-fixture evidence only.

When authorised Sime Darby data is unavailable, an explicitly approved, licensed and traceable public measured dataset may temporarily support backend and energy-model work. BDG2 v1.0 is the approved provisional fallback. It is **not Sime Darby or Elmina Lakeside Mall data** and supports whole-building public-benchmark claims only. Keep its source identity visible and leave unsupported township, floor, room, equipment, HVAC-cause, tariff and verified-savings outputs unavailable.

Build the hackathon vertical slice in this order: authorised data/dictionary → inspection and permission gate → minimal additive provenance migration plus validated bounded real import → evaluated forecast and detected anomalies → small DB-backed API response → real frontend/deployment tests. Cost/CO₂, opportunity ranking, human review and the grounded chatbot remain gated follow-on work and are not part of the current task.

Release gate: permitted real observations, correctly labelled forecasts/detections/estimates, source-backed opportunity evidence and human review work against actual APIs and the real frontend. The chatbot explains approved results without inventing facts. Conditional equipment-level features and verified savings require their own real evidence; carbon neutrality is not guaranteed.

## Existing evidence (historical; preserve)

| Work | Evidence/status | Limit for submitted MVP |
| --- | --- | --- |
| Phase 0 FastAPI scaffold | Python 3.12 app, locked dependencies, health/docs/OpenAPI; public backend previously tested at `https://energios-backend.vercel.app`. | Only `/health` is implemented in OpenAPI. Separate Preview and DB-backed API remain unverified. |
| Task 2 schema/RLS | Five-table SQL and offline tests exist. User reported hosted results: RLS true, anon/authenticated access false, service read true, no policies on all five tables. Notes committed locally in `251a765a121819a534b37db44f520dfdb80afcbc`. | User-reported catalogue evidence, not a demonstrated real backend read. Existing schema permits only `synthetic_demo` provenance; real import is blocked pending reviewed migration. |
| Task 3 internal fixture | Four fictional assets, seven meters, 4,704 hourly readings over 28 days, one Floor 2 after-hours event and `synthetic_demo`; eight Python and ten PostgreSQL tests passed offline. Files remain in the working tree. | Historical internal tests only. No hosted seed insertion occurred. Cannot power submitted database, ML training, charts, demo or product. |
| Frontend inspection | Last accessible inspection found no frontend code. | Compatibility remains unverified; framework/API expectations/CORS origin cannot be invented. |
| Public measured benchmark | BDG2 v1.0 official metadata, weather and cleaned electricity files were inspected read-only; source/citation/licence, hashes and limitations are in `docs/bdg2-data-assessment.md`. | No database import or model training. Not Sime Darby/Elmina data; no township, floor, room, equipment, schedule, HVAC-cause, Malaysian tariff or verified-savings claims. |
| Real-data features | The bounded BDG2 import, evaluated model and four read-only routes are verified locally against an isolated database harness. | Hosted import/data routes, frontend integration, ranking, intervention/review tracking and chatbot remain unverified or planned. |

Read `docs/schema-verification.md`, `docs/seed-verification.md` and `docs/preflight-status.md` as dated evidence. This plan and the PRD supersede their older synthetic seed-loading instructions for submission. Do not delete those notes/files or execute their fixture SQL in the submitted database.

## Next unchecked P0 task and order

**Next P0 task: review and apply the already tested migration/import to an explicitly approved Supabase target, configure backend-only credentials, and deploy/smoke-test the four data routes before frontend integration.** Hosted Supabase remains unchanged in the current task. Do not expose credentials, import synthetic fixtures, or start frontend, chatbot, tariff or live-control work.

The following replaces the original Day 1/Day 2 synthetic workflow. Steps 1–2 are complete only for the provisional BDG2 benchmark; they remain open for future Sime Darby data. Do not skip to import or APIs.

| P0 order | Task | Acceptance evidence / stop condition |
| --- | --- | --- |
| 1 | [x] Approve and pin a provisional public measured dataset for hackathon benchmark use. | BDG2 v1.0 official Zenodo/GitHub source, CC BY 4.0 data licence, citation, tagged commit and file hashes documented. Public-benchmark label and non-Sime/Elmina boundary required. |
| 2 | [x] Inspect BDG2 metadata, weather and cleaned electricity files read-only. | `docs/bdg2-data-assessment.md` records structure, local timestamps, interval kWh, missing/duplicate/zero values, building-level mapping, usable-cohort criteria and unsupported claims. |
| 3 | [x] Write and review the non-destructive provenance/schema and bounded import plan. | `docs/bdg2-provenance-schema-import-plan.md` defines additive fields/tables, the four-meter Hog cohort, a 70,176-cell scan cap, UTC/DST and quality policies, idempotency, validation, RLS and rollback. No migration/import ran. |
| 4 | [x] Implement the minimal additive provenance migration and import the bounded BDG2 cohort in an isolated database. | One source table, one import-run table, direct source/run identifiers, essential uniqueness/checks and preserved existing RLS/data. Verified import: four assets, four meters, 70,152 readings, 8 missing source values, 16 quarantined DST values, zero invalid/zero values and an identical replay. Hosted Supabase remains unchanged. |
| 5 | [x] Train and evaluate the smallest reproducible forecast and schedule-independent anomaly detector. | The real four-meter BDG2 cohort uses chronological train/validation/test periods and rolling 24-hour forecasts. Held-out model MAE/RMSE are 24.223073/37.903324 kWh versus 27.180704/47.311611 for the previous-day baseline across 14,081 comparable readings. Validation-only MAD thresholds label 144 test observations as unusual patterns; no schedule or cause claim is made. |
| 6 | [x] Build a small DB-backed API for real readings plus validated forecast/anomaly results. | `/assets`, `/assets/{id}/readings`, `/forecast` and `/anomalies` use only a completed `bdg2_v1` database import, backend-held credentials and validated analytics. IDs, date ranges and limits are bounded; missing credentials/data fail explicitly. Route/contract tests pass against an isolated database containing the 70,152 verified readings. |
| 7 | [ ] Calculate cost from documented tariff rules and CO₂ from an approved official emission factor. | Applicable source/date/version, units/components and assumptions, independently recomputed examples. Tariff is not an ML prediction target; absent inputs mean unavailable outputs. |
| 8 | [ ] Add opportunity ranking and human review only where source-backed inputs exist. | Agreed ranking factors/weights for estimated savings, cost, carbon and confidence; review states, authorised action records and evidence. No invented savings/confidence/equipment advice. |
| 9 | [ ] Add chatbot only after backend data/results exist; keep API keys server-side. | Traceable approved data/forecast/alert/calculation references, access enforcement, unknown-data refusal and no secret leakage or autonomous control. |
| 10 | [ ] Test actual frontend integration after frontend code is available. | Inspect latest accessible frontend commit, compare requests/fields/units/statuses to PRD/OpenAPI, report mismatches and preserve teammate work; real permitted data/labels and actual deployed/browser calls pass. |

Within an authorised step, implement the smallest reviewable slice, run relevant tests and report exact changes/unfinished work. Failed data/security/deployment gates stop subsequent tasks. An unavailable dependency is not permission to invent data, silently change scope or switch hosts.

## Dataset request and inspection

**Essential ML inputs:**

1. Historical timestamped electricity readings: timestamp, meter ID, kWh, and kW if available.
2. Meter mapping: what building, floor, zone, or equipment each meter measures, plus units and reading interval.
3. Operating schedule for schedule-based or after-hours detection: opening hours, holidays, closures, and unusual operating periods.

**Helpful when available:**

4. Timestamped weather: outdoor temperature and humidity.
5. HVAC/BMS runtime, schedule, or energy data.

Request **12–24 months** of real history where possible; **6 months is the minimum acceptable hackathon starting point**. Historical readings plus correct building/meter mapping can support an initial forecast benchmark; schedule-based/after-hours detection remains blocked without actual schedules. Validate coverage/quality before training; optional weather/BMS does not replace the target/mapping evidence.

For BDG2, use the official v1.0 release and retain the source identity `bdg2_v1`, CC BY 4.0 attribution, tagged commit and selected-file checksums. The inspected electricity file contains whole-building hourly interval energy in `kWh_sum` with naive timestamps in each site's local timezone. Do not treat it as kW, a cumulative register or an Elmina meter. The weather file is optional context and contains documented gaps/duplicates. Other meter-type files are inventoried but not yet profiled for ingestion.

Inspect source version/checksum through an approved private channel, column definitions, timezone, units/scales, interval boundaries, duplicates, negative/outlier values, cumulative register resets/rollovers, gaps and mapping resolution. Preserve original semantics and transformations. Never fill unknown readings with invented values or infer rooms/floors/equipment from a building meter. Inspection reports must not expose restricted raw rows or keys.

## Schema, import and operational contract

Existing `backend/sql/001_demo_schema.sql` remains the preserved baseline. The minimal additive migration adds source/import identity and only the validation required for the verified four-building cohort; it deliberately omits composite foreign-key architecture, triggers, views, cascading deletes and production-scale rollback machinery. Preserve primary/foreign keys, non-negative interval kWh, meter/time uniqueness, alert deduplication, existing data and RLS. Do not relabel fixtures as real or bypass constraints.

Future real import requires approved backend access, privately configured environment variables, validated bounds and permission checks. Choose one documented pinned persistence strategy. Never request or print secrets in chat/logs or expose them in Git/frontend. No automatic seed/import on app startup, web requests or deployment imports.

Follow PRD §6 route intent and agree exact measured-data field/access contracts after the gate. Only implemented routes belong in OpenAPI. Normalise timestamps to UTC while preserving source-local timestamp/timezone and documenting DST handling; expose explicit kWh/kW, quality and provenance. Missing intervals remain missing; DB errors fail explicitly. Use authoritative building totals without inventing or adding floors. Restricted corporate readings are not automatically publishable; BDG2 display must retain its public-benchmark label and attribution.

ML predicts energy consumption or supported demand; tariff rules calculate cost. Chronological holdout and simple baseline comparison precede forecast claims. BDG2 benchmark results do not establish Sime Darby/Elmina performance. Schedule-based anomalies need actual operating schedules, which BDG2 does not provide; detections never prove HVAC cause. Cost/carbon estimates require documented applicable tariffs and an approved official factor. Ranking inputs/weights/confidence criteria remain to be agreed.

Human review distinguishes observed, forecast, detected, estimated, proposed, approved and verified results. Intervention tracking records actual authorised action. Verified savings require a documented intervention, baseline and post-action measurements with relevant adjustments. Carbon neutrality is a long-term ambition, never a guarantee.

## Conditional capabilities and lean triage

Digital twin, room/floor performance, indoor/outdoor conditions, HVAC/BMS, solar, batteries, EV coordination and verified savings are conditional on real authorised measurements, actual plans/mapping and approval. None is already built. Whole-building data supports building-level claims only. Live control is outside this MVP and needs separate explicit authorisation.

The former 20-item checklist remains triage, not a mandate:

| Area | Current workflow decision |
| --- | --- |
| PRD, plan, AGENTS | Maintain real-data scope/task order; actual evidence determines completion. |
| Git and teammate work | Shared repo exists; inspect status/preserve work. Coherent commits only when authorised; no commit/push in this task. |
| Ignore rules/environment names | Existing `.gitignore` and blank `.env.example`; no restricted raw data or real values in Git. |
| Backend/persistence/hosting stack | Preserve pinned scaffold, Supabase and separate Vercel roots; no deployment/architecture change here. |
| Frontend brand/design | Frontend owner; no code found. Formal design-system document deferred unless requested. |
| Authentication/data access | Implement access required by approved use before release; no automatic full-auth project or blanket public access. |
| Staging | Separate Preview remains unverified; separate staging infrastructure deferred unless requested. Never mutate production real data through tests. |
| Sentry, plugins/MCP, multi-agent setup | Deferred unless requested; do not displace the real-data gate. |
| README/status notes | Existing docs are historical where incompatible; update other files in a separately authorised task. Old seed steps are not submission instructions. |
| Forecast/chatbot | Explicit agreed P0 scope, gated by real data and approved backend results. |
| Investment/equipment features | Conditional on real data and separately authorised scope; no automatic P1/P2 work. |

## Deployment and verification checklist

- [x] Provisional BDG2 source, licence, permitted public-benchmark use and limitations are documented; no synthetic operational data is authorised for submitted database/training/charts/demo.
- [x] Minimal provenance migration and bounded import are non-destructive and tested in isolated PGlite; hosted application remains separately review-gated.
- [x] Isolated post-import checks confirm RLS remains enabled, no public-client policies exist and public writes remain denied.
- [ ] Supabase/admin/chatbot keys and restricted data stay out of frontend, Git history, logs and chat; errors/public payloads are sanitised.
- [ ] Imports, analysis and review writes require bounded authorised backend access; missing data/errors fail explicitly.
- [ ] Forecast holdout/baseline metrics and anomaly evidence use real sources; tariffs/carbon factors are approved/documented, never invented.
- [ ] Actual frontend requests, units, statuses and origins are checked against PRD/implemented OpenAPI.
- [ ] `/health` remains exactly `{"status":"ok","version":"1"}` and `/docs` lists implemented routes only; actual deployed calls pass before new deployment claims.
- [ ] Vercel roots stay `backend/` and `frontend/`; recheck build/plan constraints when deploying. Hobby eligibility remains unconfirmed; no paid change or architecture switch without approval.
- [ ] Submitted pitch/demo shows permitted real results and forecast/detected/estimated labels without unsupported verified savings.

| Verification | Required result |
| --- | --- |
| Source inspection | Dictionary, permission, minimum history, timezone/units/semantics and mapping verified before import. |
| Repeated real import | Stable source-scoped counts/keys, explicit duplicate/conflict handling and preserved lineage. |
| API tests | Normal/unknown asset, invalid IDs/dates, bounds, gaps and permitted/restricted access handled explicitly. |
| Forecast evaluation | Time-based split, simple baseline comparison, reproducible model/metric, no synthetic training or future leakage. |
| Repeated detection | Real evidence deduplicates; ordinary/missing data does not become invented findings. |
| Cost/carbon checks | Documented tariff rules/official factor independently reproduce estimates. |
| Chatbot checks | Approved references, correct explanations, unsupported-data refusal, access checks and no exposed keys. |
| Deployment/frontend | Actual endpoints and real frontend tested; no hardcoded operational mocks or unverified compatibility claim. |
| Verified savings, if supported later | Documented intervention, baseline, post-action data and method; otherwise unavailable. |

Internal synthetic fixtures may exercise isolated software tests. Their success is not proof of real-data readiness, model performance or submitted product success. Keep them separate from submitted database, ML training and display.

## Handoff and pending decisions

Handoff provides approved source/dictionary references without restricted rows, permitted audience, actual endpoint/OpenAPI shapes, units/timezone/completeness, evaluated forecasts/detections/calculations, versions, limitations and deployment/frontend evidence. Never send keys or describe conditional features as complete.

BDG2 clears the source/licence/history gate for provisional whole-building electricity benchmarking only. The minimal migration and four-building Hog import passed in isolated PGlite with `tzdata==2026.5`; source hashes, UTC/DST handling, counts, units, provenance and idempotent replay match the bounded manifest. The deterministic energy-history model emits 24 hourly values, improves aggregate held-out MAE and RMSE over the previous-day baseline, and labels only validation-thresholded unusual patterns; details and limitations are in `docs/bdg2-model-evaluation.md`. The four read-only routes pass locally against an isolated database populated from the verified import and expose no synthetic fallback. Hosted PostgreSQL 17.11 remains unchanged and has no Supabase branch, so deployed data routes remain unavailable until a separately approved import/configuration task. Operating schedules, floor/room/equipment mapping, Sime Darby/Elmina identity, applicable Malaysian tariffs, official emission factor, actual township maps/plans and intervention evidence remain unavailable. Ranking, review workflow and chatbot decisions remain deferred.

This completed task authorises no hosted migration, deployment change, frontend work, credential disclosure, commit or push. The next implementation request should explicitly approve the target database/import and deployment verification before frontend integration.


## Approved isolated full-stack demo scope — 16 October 2026

The owner now explicitly approves preserving Norman's `norman_frontend_v2/frontend-v2` product design and adding stateless, clearly labelled solar/storage, load-shift, impact, peer-comparison and Green CFO scenario calculations in an isolated branch from `feature/simulated-energy-modules`. This approval permits hypothetical scenario assumptions; it does not permit synthetic operational observations, inferred equipment readings, live control, hosted database changes or deployment changes. The existing five health/data contracts, import, RLS and analytics remain authoritative and unchanged.

Observed BDG2 readings, calculated forecasts, detected unusual patterns, derived comparisons, simulated assumptions/results and illustrative geometry must remain visually distinct. Optional cost/carbon use explicit user-entered prices/factors with a disclosed source or hypothetical-assumption reference. Payback also requires CAPEX, separately entered annual energy reduction and annual maintenance; a benchmark day is never annualised. Missing inputs mean `Not calculated`. No verified savings, causal diagnosis, actual township geometry, investment recommendation or corporate-site performance is implied.

The owner later approved local-only HVAC and floor simulation tabs in the existing township drawer. They use no new backend contract: the only measured input is the already-returned whole-building BDG2 interval. Floor allocations, floor names, equipment identity, enabled state, mode, setpoint, fan command and HVAC share are visibly declared illustrative assumptions. Invalid floor percentages return `Not calculated`; no BMS/SCADA write, equipment command, causal diagnosis or savings calculation is permitted.

Only local additive `/demo` routes support this review: `GET /demo/assets/{id}/history`, `POST /demo/energy-scenario`, `POST /demo/peak-shift`, `POST /demo/impact`, `POST /demo/investment-comparison`, `GET /demo/portfolio`, `GET /demo/assistant/status`, and `POST /demo/assistant/chat`. The history route aggregates bounded, date-filtered observed readings by source-local day or month and reports missing-interval coverage without filling gaps. Existing health and BDG2 data routes and response schemas are unchanged. The local browser uses `/api`: existing data calls reach the public backend, and `/api/demo` reaches the isolated local backend. No new production availability is claimed. See `docs/full-stack-demo-integration.md` for screen inventory, contracts, formulas and evidence.


## Explicit isolated-demo assistant task — 16 October 2026

The user explicitly authorized extending the existing Norman panel with a bounded, backend-only, read-only Gemini integration. Implement `/demo/assistant/chat` and configuration status without changing existing data contracts, analytics, imports, hosted database, production settings or protected branches. Gate responses on selected-asset BDG2 evidence and optional validated/recomputed simulation inputs; preserve labels, citations, unavailable states, request/rate/time bounds and safe errors. Use mocked provider responses in automated tests and verify the actual local unavailable state if the key is absent. See `full-stack-demo-integration.md` for contract/setup/verification. The live Gemini verification gate remains unchecked until private local key setup and an actual provider response succeed. No commit, push, merge or deployment is authorized by this task.
