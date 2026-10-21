# EnergiOS — Product Requirements Document

**Version:** 1.2 provisional public-benchmark scope · **Date:** 13 October 2026 (Malaysia)
**Theme:** Sime Darby Property University Hackathon 2026 — PLANET / Energy Efficiency  
**Release target:** Working MVP and 5-minute demo for the 23 October 2026, 11:59 p.m. submission
**Status:** Agreed requirements; planned capabilities are not completion claims

## 1. Product decision and data authority

EnergiOS monitors energy consumption across township assets and helps operators identify, locate, prioritise and review energy opportunities. The agreed MVP shows energy consumption, estimated electricity cost, estimated CO₂ emissions and load trends; predicts future energy consumption from real history; detects unusual consumption; and explains approved data/results through a grounded chatbot. Human review and intervention tracking support later comparison against a baseline.

The user reports that the organiser has confirmed the submitted MVP must use **real, reliable, traceable data**. Synthetic, fabricated, AI-generated or invented operational data is prohibited in the submitted database, ML training, frontend charts and demo. Forecasts and calculations derived from authorised observations are analytical outputs, never observed readings. This requirement supersedes version 1.0's synthetic-demo assumptions and older seed-loading instructions.

Real Sime Darby data has not yet been received or inspected in this repository. Confirm permission to use, retain and publish it before import or demo exposure. Do not assume an asset inventory, meter coverage, tariff, carbon factor, building plan or internal integration exists.

Until that source is available, the project owner has approved the official **Building Data Genome Project 2 (BDG2) v1.0** release as a provisional public measured benchmark. BDG2 is **not Sime Darby data and is not Elmina Lakeside Mall data**. It may support source-labelled whole-building backend ingestion and energy-model benchmarking; it cannot support claims about the mall, township, floors, rooms, equipment, HVAC causes, Malaysian tariffs, Malaysian carbon factors, interventions or verified savings. User-facing output derived from it must say `Public benchmark data — Building Data Genome Project 2 v1.0`.

The earlier sustainability-report context describes existing centralised monitoring and visibility limitations for some assets. It does not prove that all systems are disconnected or establish a particular floor-level integration gap. The actual operator workflow and integration need remain to be validated.

## 2. Users, journey and success

**Primary user:** Facilities/energy operator. **Secondary user:** Asset/sustainability manager. Proposed users, responsibilities and access remain to be validated.

**Core job:** Which monitored asset needs investigation, what evidence supports the finding, and which opportunity should be reviewed?

1. View permitted township assets, observed energy and load trends, with labelled cost/carbon estimates.
2. Locate issues on an approved township map. Drill into a selected building/floor only where actual plans and meter mappings support that resolution.
3. Inspect a forecast or detected anomaly with time window, units, provenance, baseline/comparison and model/rule evidence.
4. Compare opportunities ranked by estimated savings, cost, carbon impact and confidence, with documented inputs and limitations.
5. Review a proposed action, record approval and an actual intervention, then compare later measurements against a documented baseline where available.
6. Ask a grounded chatbot to explain approved data, forecasts, alerts and calculations with source references and refusal of unsupported claims.

Success requires approved real-data lineage, evaluated forecasts, traceable detections/calculations, actual API-fed frontend results and tested deployment. Missing data is a blocker, never permission to substitute synthetic observations. Verified savings and carbon neutrality are not submission promises.

## 3. Scope and priorities

| Priority | Capability | Acceptance condition |
| --- | --- | --- |
| P0 gate | Authorised real dataset and dictionary | Receive authorised corporate data or an explicitly approved public measured fallback; confirm licence/permitted publication use and inspect essential inputs before import, training, APIs or frontend claims. |
| P0 | Asset/meter catalogue and history | Source-backed IDs/mapping, timestamps, units, interval semantics, provenance and validated idempotent import. |
| P0 | Energy summaries, cost/CO₂ estimates and load trends | Real observations, explicit completeness, documented applicable tariff rules and approved official emission factor. |
| P0 | Township issue location | Approved map/asset positions and meter mapping; unavailable for BDG2 and any source without verified township identity/location. |
| P0 | Energy-consumption forecast | Real-history training, chronological holdout and simple baseline comparison; model version, horizon, error and limitations are reported. |
| P0 | Unusual-consumption detection | Measured readings, documented comparison basis/thresholds and deduplicated evidence. Schedule-based or after-hours findings require actual schedules; no unsupported cause claims. |
| P0, source gated | Opportunity ranking and human review | Source-backed candidates ranked by estimated savings, cost, carbon impact and confidence; proposed/approved states and actual intervention tracking. |
| P0, results gated | Grounded chatbot | Explains approved backend data/results with traceable references; server-side keys and access enforcement; no invented facts. |
| P0 | API/frontend integration and deployment | Implemented OpenAPI matches real frontend requests; permitted real data and honest labels render; deployed endpoints are tested. |
| Conditional | Digital twin and building/floor/room performance | Actual authorised plans, geometry, meter mappings and measurements support the displayed resolution. Not already built. |
| Conditional | HVAC/BMS, indoor/outdoor conditions, solar, batteries and EV coordination | Real authorised supporting measurements, equipment mapping and approval. Not already built. |
| Conditional | Verified savings | Documented intervention, baseline and sufficient post-action measurements with relevant adjustments. Not already built. |
| P1/P2, explicit request only | Additional models, investment simulations or multi-agent systems | Supporting data and a separately agreed task; no automatic expansion. |

The 20-item checklist is triage, not a mandate to build every item. Full authentication implementation, separate staging infrastructure, Sentry, plugins/MCP setup and a formal design-system document are deferred unless needed/requested. Appropriate real-data access control remains a release gate. Autonomous remediation and live equipment control are outside this MVP and require separate explicit approval.

For the isolated local review only, the owner has explicitly approved interactive HVAC and floor **simulation panels** inside Norman's township drawer. They may combine one clearly identified observed whole-building BDG2 interval with visible user-controlled allocation assumptions. Every floor, equipment, sensor, state, setpoint and control value remains labelled `Simulated` or `Illustrative`; no value is a measured floor/HVAC reading, inferred cause, equipment command, BMS/SCADA connection or savings claim. Production integration remains conditional on authorised meters, plans, equipment mapping, telemetry and control approval.

## 4. Locked technology and present implementation

- **Backend:** Python 3.12, FastAPI and Pydantic; `backend/app.py` exports `app`.
- **Persistence:** Supabase PostgreSQL; backend is the sole database-facing application component. Choose one documented pinned access strategy when implementation is authorised. No browser service credentials.
- **Analytics:** Python/scikit-learn where justified; time-based evaluation and a simple baseline precede model claims. Tariff/carbon calculations use deterministic documented rules. No training in normal GET requests.
- **Hosting:** One shared repository with separate Vercel projects rooted at `backend/` and `frontend/`; architecture remains unchanged.
- **UI:** Frontend team owns its React framework and any Three.js presentation. Backend supplies real source-backed data/IDs, not fabricated 3D geometry or readings.
- **Updates:** Bounded polling/refresh; no persistent worker or WebSocket requirement.

Health/docs/OpenAPI and four read-only, unversioned BDG2 routes are now implemented locally. The data routes require a completed verified import and backend-only database credentials; they return an explicit unavailable response without them. The tiny backend at `https://energios-backend.vercel.app` was previously tested before these routes existed, so no deployed data endpoint is claimed. Separate Preview verification and Vercel Hobby eligibility remain unconfirmed. Prior best-effort deployment permission did not confirm eligibility.

## 5. Exact real-data and ML input requirements

**Essential:**

1. Historical timestamped electricity readings: timestamp, meter ID, kWh, and kW if available.
2. Meter mapping: what building, floor, zone, or equipment each meter measures, plus units and reading interval.
3. Operating schedule for schedule-based or after-hours detection: opening hours, holidays, closures, and unusual operating periods.

**Helpful when available:**

4. Timestamped weather: outdoor temperature and humidity.
5. HVAC/BMS runtime, schedule, or energy data.

Request **12–24 months of real historical data** where possible; **6 months is the minimum acceptable hackathon starting point**. Historical readings plus correct building/meter mapping can support an initial consumption forecast benchmark; actual coverage, gaps, consistency and holdout evaluation determine whether it is usable. Operating schedules are required for schedule-based or after-hours detection. Weather/BMS inputs are helpful additions, not substitutes for required target/mapping evidence.

Preserve source identity/version, permitted use/publication restrictions, checksum or equivalent lineage, dictionary, units, timezone, reading interval, interval/cumulative semantics, meter scope and limitations. Keep restricted raw data outside Git, frontend bundles, logs and chat. Demand in kW is a separate measured input; any interval-average value derived from kWh requires valid interval semantics and an explicit derived label, not an instantaneous demand claim.

## 6. Data model and API contract

Retain the five-table conceptual model, but require a reviewed **non-destructive provenance/schema migration plan** after measured-dataset inspection. Existing `backend/sql/001_demo_schema.sql` permits only `synthetic_demo` provenance and 60-minute readings: it is **not compatible with BDG2 import as-is**. Do not relabel fixtures as measured, bypass constraints or execute a migration in this documentation task. The plan must define a source-scoped provenance value such as `public_benchmark`, preserve `bdg2_v1` source identity and checksums, and retain original local timezone plus any UTC conversion evidence.

| Table | Planned real-data direction |
| --- | --- |
| `assets` | Source-backed identity/type, approved map reference/position, documented area where available, timezone and quality/provenance limitations. |
| `meters` | Source meter ID, asset/building/floor/zone/equipment scope, units, interval and mapping evidence; no invented submeters. |
| `energy_readings` | Real timestamped energy, optional measured demand, original semantics/lineage and reviewed normalisation; non-negative interval kWh and unique meter/timestamp keys. |
| `alerts` | Meter/window/rule deduplication, observed/baseline energy, status, evidence and rule/source versions; detected findings, not confirmed causes. |
| `scenarios` | Source-backed action inputs, assumptions/results and estimate labels. Review/intervention tracking needs a later reviewed design; the existing schema does not prove it is implemented. |

Normalised API timestamps use UTC ISO 8601 (`...Z`), with original source timezone/transformation retained. UI uses the applicable asset timezone, including `Asia/Kuala_Lumpur` where appropriate. Energy is interval kWh, demand is kW, money is MYR and carbon units are explicit. Preserve source precision; display rounding must not imply accuracy. Validate cumulative registers before differencing; resets, rollovers and ambiguous periods need explicit handling. Missing readings stay missing.

**Aggregation:** Use an authoritative building-total meter for asset energy; never add its diagnostic floors again. Sum available floors only where mapping supports it and label partial coverage. Whole-building data supports building-level analytics only. Room, floor, HVAC, solar, battery, EV and indoor-condition claims require actual supporting measurements and mapping.

The owner explicitly approved the following smallest unversioned read contract for the BDG2 prototype. No accessible frontend code exists to compare against it yet. Real data is not automatically public because a demo is accessible; these routes use backend-held credentials and expose only the approved public benchmark cohort. Other `/v1` directions remain planned.

| Method/path | Purpose/status | Access direction |
| --- | --- | --- |
| `GET /health` | Implemented; exactly `{"status":"ok","version":"1"}`. | Public |
| `GET /assets` | Implemented locally; bounded catalogue for the four verified BDG2 whole-building assets, including meter, units and provenance. | Backend-mediated public benchmark read |
| `GET /assets/{id}/readings?from=...&to=...&limit=...` | Implemented locally; bounded observed interval-kWh history with UTC/source timestamps, quality and provenance. | Backend-mediated public benchmark read |
| `GET /assets/{id}/forecast` | Implemented locally; 24 hourly forecast values plus method, split, held-out metrics, provenance and limitations. | Backend-mediated public benchmark read |
| `GET /assets/{id}/anomalies?from=...&to=...&limit=...` | Implemented locally; validation-thresholded `unusual_consumption_pattern` detections with no cause claim. | Backend-mediated public benchmark read |
| `GET /demo/assets/{id}/history?granularity=daily|monthly&periods=...` | Implemented for the isolated demo; source-local calendar aggregation of observed hourly BDG2 readings, with bounded periods, interval coverage and incomplete totals kept explicit. | Local backend-mediated public benchmark read |
| `GET /v1/assets/{id}/summary` | Planned consumption, completeness, cost/CO₂ estimates and load trends with sources. | Approved data audience |
| `GET /v1/alerts` | Planned detected findings, status and evidence/lineage. | Approved data audience |
| `POST /v1/readings` | Planned bounded real import with accepted/duplicate/rejected counts and explicit conflicts. | Protected backend operation |
| `POST /v1/analysis/run` | Planned real-data rule evaluation and deduplicated findings. | Protected backend operation |
| `POST /v1/scenarios/preview` | Planned source-backed stateless estimate with inputs and caveats. | Approved audience; no privileged browser key |
| `POST /v1/scenarios`, `PATCH /v1/alerts/{id}` | Planned authorised review/storage where supported; state/timestamp contract needs review. | Protected backend operation |

Opportunity ranking, intervention tracking and chatbot route shapes are not yet agreed or implemented. Do not invent endpoints or advertise phantom functionality. The old synthetic alert example/fixture must not become production frontend data or a submitted demo response.

## 7. Analytics, calculations and labels

**Forecast:** ML predicts energy consumption or demand when measured inputs support that target. **Tariff is not an ML prediction target**; documented tariff rules calculate cost. Train on authorised measured history with valid mapping; use schedules/weather only when available and justified. Use a time-based split, prevent future-data leakage and compare with a simple seasonal-naive baseline. Record source, train/test periods, units, metric, model/version, horizon and limitations. A BDG2 benchmark result is not evidence of performance at Sime Darby or Elmina Lakeside Mall. Do not promise accuracy before evaluation.

**Detection:** Compare measured intervals with a documented comparable-hours baseline and, for after-hours claims, an actual schedule. Exclude the target interval from its reference, require sufficient comparisons, and record absolute/relative thresholds, quality exclusions and rule version. Deduplicate meter/window/rule findings. Detected unusual consumption prompts investigation; it does not establish waste or HVAC causation. BDG2 has no inspected operating schedule, so after-hours detection is unavailable for this fallback.

**Cost/carbon:** Calculate electricity cost from documented applicable tariff rules, including demand, time bands or fixed components only where supported. Calculate CO₂ from an approved official emission factor for the relevant region, period and accounting basis. Preserve source/date/version, units, scope, assumptions and limitations. A simple kWh multiplier is valid only where the approved rule supports it. Missing tariff/factor means unavailable output; never invent a default or ask the chatbot to supply one.

**Ranking and review:** Rank source-backed opportunities by estimated savings, cost, carbon impact and confidence with explicit evidence. Formula/weights and confidence method remain to be agreed; no fabricated score. Distinguish proposed, approved and implemented interventions with authorised records/timestamps. Savings estimates expose assumptions and are not verified savings.

**Verified savings:** Require a documented intervention, baseline and post-action measurements with relevant weather/operating adjustments and a stated comparison method. Conditional and unbuilt. Carbon neutrality is a long-term ambition; EnergiOS cannot guarantee it or equate an estimate with neutrality.

**Grounded chatbot:** Add only after approved backend readings/results exist. Explain approved observations, forecasts, alerts and calculations with traceable references and caller access enforcement. Keep API keys server-side. Refuse missing/unsupported facts; never generate operational readings, invent causes, override numerical calculations or control equipment.

Clearly label **observed**, **forecast**, **detected**, **estimated**, **proposed**, **approved** and **verified** results. Verified requires the relevant documented result evidence, not merely a successful API request.

## 8. Security and conditional claims

- Preserve RLS and deny direct public writes; keep privileged Supabase/admin/chatbot credentials backend-only. Approved real-data access and permitted publication are release gates; unmet requirements block public exposure.
- Keep restricted data/keys out of Git history, client bundles, screenshots, logs and chat. Sanitise errors and expose only permitted data/lineage metadata.
- Use exact known CORS origins, bounded queries/payloads and authorised write/review operations.
- Digital twin, room/floor performance, indoor/outdoor conditions, HVAC, solar, batteries, EV coordination and verified savings require real authorised data/plans/mapping and approval. None is already built.
- No unsupported equipment control, integrations, real-time guarantees or corporate savings claims. Do not substitute invented data when a source or database is unavailable.

## 9. Existing evidence and blockers

- Hosted Supabase security verification passed **as user-reported evidence**: five tables with `rls_enabled=true`, `anon_access=false`, `authenticated_access=false`, `service_read=true`, `policy_count=0`. Notes committed locally in `251a765a121819a534b37db44f520dfdb80afcbc`. This is catalogue evidence, not a demonstrated real backend read or agent-run hosted anonymous write attempt.
- Task 3 created a deterministic internal fixture: four fictional assets, seven meters, 4,704 hourly readings across 28 days, one Floor 2 after-hours event and `synthetic_demo` provenance. Eight Python and ten PostgreSQL tests passed offline. **No hosted seed insertion occurred.**
- Task 3 files and verification notes are preserved unchanged as historical internal test-fixture evidence only. They cannot power the submitted database, ML training, frontend charts, demo or product. Earlier seed-loading instructions are superseded by this scope.
- No accessible frontend code was found in the latest local or remote-tree inspection; compatibility remains unverified. The four unversioned BDG2 read routes are locally implemented but not deployed against a hosted imported database. Summary/cost/carbon, ranking, review/intervention tracking and chatbot routes remain planned.
- BDG2 v1.0 is approved only as a provisional public measured benchmark. The pinned official source and read-only profile are documented in `docs/bdg2-data-assessment.md`; no BDG2 rows have been imported into Supabase and no model has been trained.

**Next P0 task:** Produce a reviewed, non-destructive provenance/schema and import plan for the selected BDG2 electricity cohort. Preserve existing tables/RLS, define `public_benchmark` lineage, local-time-to-UTC handling, missing/duplicate policy, idempotent keys, capacity bounds and rollback/validation. Do not run the migration or import until that plan is approved.

Pending decisions: Sime Darby dataset delivery/permission/publication, BDG2 cohort selection and data-volume budget, applicable tariff rules, approved official emission factor, actual township mapping/plans, provenance migration, forecast horizon/evaluation criteria, ranking inputs/weights, review/access rules, chatbot provider/knowledge permissions, frontend contract/origins and Vercel Hobby eligibility.

## 10. Sources and change control

- Scope authority: user's report of organiser confirmation and agreed scope update on 13 October 2026. No real operational dataset was supplied with that confirmation.
- Provisional public benchmark: Building and Urban Data Science Group, [Building Data Genome Project 2 v1.0](https://doi.org/10.5281/zenodo.3887306), 10 June 2020. The Zenodo record declares `CC BY 4.0`; retain attribution. The tagged Git repository also contains an MIT licence for its software and associated documentation.
- Dataset citation: Miller, C. et al. “The Building Data Genome Project 2, energy meter data from the ASHRAE Great Energy Predictor III competition.” *Scientific Data* 7, 368 (2020), [doi:10.1038/s41597-020-00712-x](https://doi.org/10.1038/s41597-020-00712-x).
- Historical evidence: `docs/schema-verification.md`, `docs/seed-verification.md`, `docs/preflight-status.md`. This version governs current scope and supersedes incompatible historical seed instructions.
- Existing organiser briefing: PLANET theme, up to ten pitch slides, five-minute video/live demo and prototype/code link; submission deadline above.
- Existing contextual source: [Sime Darby Property Sustainability Report 2025](https://www.simedarbyproperty.com/sites/default/files/2026-04/SDP%20SR2025%20%28Mobile%29.pdf).
- Engineering references retained for future rechecking: [Vercel FastAPI](https://vercel.com/docs/frameworks/backend/fastapi), [Python runtime](https://vercel.com/docs/functions/runtimes/python), [monorepos](https://vercel.com/docs/monorepos), [fair use](https://vercel.com/docs/limits/fair-use-guidelines), [platform limits](https://vercel.com/docs/limits), [Supabase securing data](https://supabase.com/docs/guides/database/secure-data).

The PRD governs scope/claims/API intent; the plan governs task order. Code, tests, real data and deployment evidence determine completion. Coordinate document/frontend contract updates when scope, API shapes, stack or deployment architecture changes. This documentation-only update authorises no code edit, import, migration, training, credential handling, deployment, commit or push.


## Approved isolated full-stack demo scope — 16 October 2026

The owner now explicitly approves preserving Norman's `norman_frontend_v2/frontend-v2` product design and adding stateless, clearly labelled solar/storage, load-shift, impact, peer-comparison and Green CFO scenario calculations in an isolated branch from `feature/simulated-energy-modules`. This approval permits hypothetical scenario assumptions; it does not permit synthetic operational observations, inferred equipment readings, live control, hosted database changes or deployment changes. The existing five health/data contracts, import, RLS and analytics remain authoritative and unchanged.

Observed BDG2 readings, calculated forecasts, detected unusual patterns, derived comparisons, simulated assumptions/results and illustrative geometry must remain visually distinct. Optional cost/carbon use explicit user-entered prices/factors with a disclosed source or hypothetical-assumption reference. Payback also requires CAPEX, separately entered annual energy reduction and annual maintenance; a benchmark day is never annualised. Missing inputs mean `Not calculated`. No verified savings, causal diagnosis, actual township geometry, investment recommendation or corporate-site performance is implied.

Only local additive `/demo` routes support this review: `POST /demo/energy-scenario`, `POST /demo/peak-shift`, `POST /demo/impact`, `POST /demo/investment-comparison`, `GET /demo/portfolio`, `GET /demo/assistant/status`, and `POST /demo/assistant/chat`. Existing health and BDG2 data routes and response schemas are unchanged. The local browser uses `/api`: existing data calls reach the public backend, and `/api/demo` reaches the isolated local backend. No new production availability is claimed. See `docs/full-stack-demo-integration.md` for screen inventory, contracts, formulas and evidence.


## Approved isolated-demo assistant contract — 16 October 2026

The Norman AI panel may call the additive, read-only `POST /demo/assistant/chat` endpoint with a 1–1500-character message, API-returned asset UUID and optional validated simulation inputs for that same asset. `GET /demo/assistant/status` reports backend configuration presence only. Gemini receives only selected-asset verified historical BDG2 evidence and explicitly included, server-recomputed simulated results; citations and observed/forecast/detected/simulated distinctions are required. Missing equipment/corporate measurements, causes, applicable tariffs, official factors, verified savings and control capabilities remain unavailable. No tools or writes are exposed. Provider failures are explicit; no scripted answer is a fallback. The key remains exclusively in a private backend process environment. Request/rate/timeout bounds, response shape and current verification evidence are recorded in `full-stack-demo-integration.md`. This scope adds no deployment or hosted secret/database authorization. A local real-provider response using one approved BDG2 asset was verified on 17 October 2026; this is not deployment evidence or a blanket accuracy claim.
