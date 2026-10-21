# EnergiOS isolated full-stack design integration

## Scope and branch evidence

- Working branch: `codex/full-stack-design-integration`.
- Worktree: `C:/Users/Vincent Loh/.codex/worktrees/full-stack-design-integration/EnergyOS`.
- Starting commit: `2aeeea2b33cee657c3deda1f1791d7f4ff35b9c9` from `feature/simulated-energy-modules`.
- Reviewed frontend reference: `origin/norman_frontend_v2` at `39593d2`; integration reference `integration/final-energios-app` at `f3c6a93`.
- The three requested remote refs were fetched. No merge, commit, push, deployment, hosted import, schema/policy change or secret configuration is part of this work.
- Original workspace has untracked `frontend/` and `docs/backend-frontend-integration-contract.md`; those are outside this worktree and untouched.

## Screen inventory recorded before edits

| Screen | Starting implementation | Required contract and input | Approved classification |
| --- | --- | --- | --- |
| Dashboard | Norman layout already API-fed | Existing assets/readings/forecast/anomalies | Observed history, calculated forecasts, detected patterns, derived totals |
| Diagnostics | Original layout hidden by scope gate; controller had invented subsystem percentages | Whole-building history and actual anomaly evidence only | Observed chart/audit; illustrative image and pins; equipment unavailable |
| Energy/storage | Original layout replaced by generic Scenario Lab; original controller had random/static battery charts | API-returned asset ID and complete forecast plus displayed/user-entered assumptions | Simulated solar, storage, grid flow and load shift |
| Township | Norman's Three.js township scene and building drawer | Real assets and shared observed timestamps, no real network/geometry | Derived common-window energy, mean/peak interval-average kW, descriptive kWh/m² and overnight share; illustrative scene, floor plates, equipment and 2D plan |
| Settings | Norman's settings layout with disabled operational controls | Local browser preferences; explicit price/factor/investment assumptions | Local preferences, simulated impact estimates and an illustrative two-candidate Green CFO ranking |
| AI panel | Styled panel plus scripted local explainer | Secure provider and actual approved data | Unavailable in this isolated runtime; no fake conversation/logs |
| Methodology | Existing BDG2 citation and classification page | Source/lineage/units/limitations and actual formulas | Source reference, not completion evidence |

## Compatibility findings and corrections

The original frontend had hardcoded UUIDs, snapshot fallback, invented subsystem shares, random storage profiles, fixed solar/grid allocations, tariff/carbon defaults, fictional township/HVAC readings and claims of SCADA/monitoring. The integration/feature branches protected data by hiding or replacing pages. This work retains the existing HTML page frames, imagery, navigation, CSS and Three.js scene while replacing those active behaviours with API-backed building evidence or explicit simulations. Static historical frontend data modules and legacy controllers remain in the repository but are not loaded by the restored screens.

All data calls resolve `/assets` first, use returned IDs, and keep the existing field names. Energy remains interval kWh. Any one-hour average demand is derived kW; timestamps expose source timezone and historical year. Anomaly counts refer to the API's held-out detection period, not to the latest day. No cause, floor/equipment split or current operational feed is inferred.

The Energy Scenario Lab's empty selector was observed during initial loading, but a permanent stuck state was not reproduced: the original eventually loaded four assets without a JavaScript error. The restored version explicitly imports the API client, handles already-fired DOM readiness, retains the original page, exposes request status/timing, bounds requests, supplies retry/error/empty states and rejects stale selections. Actual browser requests after restoration returned four assets and 24 forecast points; the local calculation requests succeeded. The request trace records actual browser HTTP status and duration, without headers or credentials.

## Additive local endpoints

| Endpoint | Input | Result |
| --- | --- | --- |
| `GET /demo/assets/{asset_id}/history` | Returned asset UUID, `granularity=daily|monthly`, daily periods 1–31 or monthly periods 1–12 | Observed source-local calendar sums with expected/observed/missing hourly interval counts; incomplete periods retain a partial sum and a null complete total |
| `POST /demo/energy-scenario` | `asset_id`, solar kW, battery kWh, power kW, initial SOC %, optional efficiency/target, optional flat price and reference | Simulated hourly solar, charge/discharge, stored energy/SOC, grid demand, peaks, horizon totals and optional assumed-price comparison |
| `POST /demo/peak-shift` | `asset_id`, flexible kWh, different source/destination interval indices 0–23 | Simulated before/after, signed peak change and energy balance; excessive source load is rejected |
| `POST /demo/impact` | Asset, observed/forecast basis, optional disclosed flat price/carbon factor, optional CAPEX/annual reduction/maintenance | Simulated estimates or null (`Not calculated`); no invented defaults |
| `POST /demo/investment-comparison` | Asset plus 2–6 candidates with optional CAPEX, annual energy change, tariff, carbon factor, operating-cost change and source | Deterministic illustrative ranking for complete positive-net-benefit scenarios; incomplete outputs remain null/`Not calculated` |
| `GET /demo/portfolio` | None | Four assets, their returned observations, shared-timestamp totals, mean/peak interval-average kW, descriptive area intensity, overnight share and comparison limits |
| `GET /demo/assistant/status` | None | Backend key-presence/read-only status; does not certify provider access |
| `POST /demo/assistant/chat` | Bounded message, returned asset UUID, optional same-asset simulation inputs | Gemini explanation with server-approved BDG2/assumption citations, or explicit unavailable/retry error |

The original `/health`, `/assets`, `/assets/{asset_id}/readings`, `/forecast` and `/anomalies` routes and response schemas are preserved. `/health` remains exactly `{"status":"ok","version":"1"}`. No database write is implemented by the new routes. When the existing prepared DB service is present, calculations read it; otherwise local demo calculations read only the fixed, already-public `https://energios-backend.vercel.app` endpoints. Failure returns an explicit error, never file/mock/synthetic data. The new routes have no arbitrary upstream URL or privileged browser credential.

### Dashboard calendar history

- Root cause: the dashboard always requested only 168 readings, plotted the latest 24 hourly points, and explicitly rejected Daily and Monthly button clicks. The existing readings route supports date filters but limits one request to 31 days and 1,000 rows, so a twelve-month chart cannot be derived from that short response or one request.
- Daily requests the latest 31 complete source-local calendar-day buckets. Monthly requests the latest 12 source-local calendar-month buckets. The additive history route splits those ranges into existing-contract calendar-month requests, each no longer than 31 days and at most 1,000 readings, then aggregates only `observed` 60-minute interval kWh.
- Period boundaries use each asset's IANA timezone. Expected interval counts therefore include 23-hour and 25-hour daylight-saving days. Duplicate timestamps, invalid labels/intervals and negative values fail explicitly.
- A period is complete only when every expected hourly interval is present. `complete_total_kwh` remains null for an incomplete period; `observed_sum_kwh`, coverage and missing count stay visible as partial evidence. Empty periods remain null. No gap is interpolated or filled.
- Browser evidence for `Hog_office_Bill`: Daily showed 1–31 December 2017 with 744/744 intervals and 31/31 complete days. Monthly showed January–December 2017 with 8,758/8,760 intervals, 11/12 complete months and two missing November intervals. Switching to `Hog_assembly_Dona` while Monthly remained selected refreshed the chart to 8,750/8,760 intervals and 10/12 complete months.

### Township HVAC and floor simulations

- Root cause: the building drawer emitted literal disabled HVAC and Floor controls buttons and provided no tab state or handler. This accurately blocked unsupported telemetry, but it also prevented review of a clearly labelled prototype interaction.
- Building evidence remains a separate tab and retains the observed whole-building BDG2 interval, calculated forecast and detected unusual-pattern count. The simulation tabs add no backend route and send no request or command when an input changes.
- HVAC simulation inputs are local assumptions: whole-building allocation percentage, illustrative cooling setpoint, fan command, operating mode and enabled state. The only arithmetic output is the selected percentage of the observed whole-building interval; it is labelled simulated and makes no savings, fault, cause, sensor or equipment-state claim.
- Floor simulation defaults to illustrative Ground 34%, Level 1 33% and Roof 33% allocations. It calculates only when the assumptions total exactly 100%; otherwise every floor result and total display `Not calculated`. The floor names and allocations are not BDG2 meters or plans.
- Required real integration is stated in the drawer: authorised floor meters, timestamps and plans for floor analysis; equipment mapping, HVAC/BMS telemetry and separate control approval for real equipment status or commands. No external factor is used.

## Calculation formulas and bounds

- Exactly 24 consecutive timezone-aware forecast intervals, finite non-negative kWh, `bdg2_v1` provenance. A one-hour interval means average kW = kWh / 1 hour.
- Solar input = entered capacity × max(0, sin(pi × (source-local hour − 6) / 12)) during 06:00–18:00 local. This is a hypothetical profile, not irradiance or measured PV. Source-local clock conversion uses the asset IANA timezone, including DST; the forecast axis remains UTC and consecutive.
- Direct solar = min(load, generation). Solar-only charge = min(surplus, power limit, remaining capacity / charging efficiency). Delivered discharge = min(max(remaining load − peak target, 0), power limit, stored energy × discharge efficiency). Stored energy changes by charge × efficiency − discharge / efficiency. Grid import = load − direct solar − discharge. Curtailed solar = surplus − charge. No export credit, grid charging or battery degradation is modelled.
- Displayed defaults are hypothetical: 120 kW solar, 250 kWh storage, 75 kW limit, 50% initial SOC; 95% per-leg efficiency and target 85% of baseline peak. Inputs and limits are validated. Starting energy is not free energy savings; final SOC and initial energy are reported. Horizon cost difference is never annual or verified savings.
- Load shift subtracts the entered kWh from one interval and adds it to another. Input cannot exceed source energy. Signed peak reduction = max(before) − max(after); negative means worse. Sum(after) − sum(before) must be zero within floating-point tolerance.
- Portfolio aggregation uses intersection of returned timestamps only. An incomplete common window is labelled by its actual interval count, never silently filled. Different uses/areas prevent interpreting this as an efficiency ranking or real network load.
- Complete-day energy estimates require 24 consecutive readings. Flat assumed cost = kWh × entered MYR/kWh; assumed carbon = kWh × entered kg CO2e/kWh. Simple payback = CAPEX / (separately entered annual reduction × entered price − entered annual maintenance), only for positive net benefit with every required input. Green CFO candidates repeat those user-entered calculations independently and rank only complete positive-net-benefit scenarios by shortest payback then annual net benefit. No extrapolation from one benchmark day, verified savings or investment recommendation.
- Peer metrics use the common timestamp intersection. Mean/peak interval-average kW, common-window kWh/m² and source-local 00:00–05:59 share are descriptive. The highest overnight share is a candidate for investigation only, not confirmed ghost load, waste or a fault.
- Unavailable: actual floor/room/AHU/chiller data, schedules, fault causes, SCADA/control, actual PV/storage/EV, official applicable tariffs/factors, verified interventions/savings, certified building ratings and measured investment candidates. Real authorised measurements, mapping, plans and/or separately sourced assumptions/integrations are required.

## Local run and deployment boundary

From `backend/`, use the existing Python 3.12 environment to run `uv run --locked uvicorn app:app --host 127.0.0.1 --port 8001`. From `frontend-v2/`, run `npm ci` then `npm run dev -- --host 127.0.0.1 --port 4175 --strictPort`. Open `http://127.0.0.1:4175/`.

The same-origin Vite proxy sends `/api/demo` to the isolated backend at port 8001, and other `/api` calls to the existing live backend. No Supabase credentials are required for this local read-only demo path. Production Vercel settings are unchanged and the new endpoints are not deployed. A production build passing does not claim those local routes exist remotely. Dynamic design image paths are explicitly copied into the build output; no raw dataset/snapshot is bundled by that copy.

## Sources

BDG2 v1.0 data: BUDS Group, https://doi.org/10.5281/zenodo.3887306 (CC BY 4.0). Citation: Miller et al., Scientific Data 7, 368 (2020), https://doi.org/10.1038/s41597-020-00712-x. Official source pinned at `3d0cbaf7ba281029ce04887503ab56f3c8344575`; hashes/normalisation evidence remain in `bdg2-data-assessment.md` and the import plan. Dataset identity, import and analytics code are unchanged. Illustrative building photographs/renders, plan and Three.js design are reused from Norman's branch, not asserted to be source-site photographs or surveyed geometry. The fixed solar profile and all scenario capacities/prices are disclosed assumptions, not another measured dataset.

## Verification

Final check results are recorded in `preflight-status.md`. Baseline: 26 Python tests, 17 isolated PostgreSQL tests, 11 frontend tests. Legacy test fixture absence in the new worktree was resolved by copying the existing ignored internal fixture, never by loading it into the app or hosted database. The existing dependency audit reported one moderate and one high issue in the inherited development toolchain; no force-upgrade is part of this scope. The existing Starlette/httpx deprecation and bundled Three.js size warning are recorded limitations.


## Exact review file list

- `AGENTS.md`
- `backend/app.py`
- `backend/src/demo_routes.py`
- `backend/src/demo_scenarios.py`
- `backend/tests/test_api.py`
- `backend/tests/test_demo_scenarios.py`
- `docs/EnergiOS_Backend_Implementation_Plan.md`
- `docs/EnergiOS_PRD.md`
- `docs/full-stack-demo-integration.md`
- `docs/preflight-status.md`
- `frontend-v2/diagnostics.html`
- `frontend-v2/digital-twin.html`
- `frontend-v2/energy.html`
- `frontend-v2/index.html`
- `frontend-v2/methodology.html`
- `frontend-v2/settings.html`
- `frontend-v2/src/css/demo.css`
- `frontend-v2/src/js/api.js`
- `frontend-v2/src/js/diagnostics_app.js`
- `frontend-v2/src/js/digital_twin_app.js`
- `frontend-v2/src/js/dynamic_island.js`
- `frontend-v2/src/js/energy_app.js`
- `frontend-v2/src/js/energy_simulator.js`
- `frontend-v2/src/js/screen_common.js`
- `frontend-v2/src/js/settings.js`
- `frontend-v2/src/js/shell.js`
- `frontend-v2/src/js/velora_app.js`
- `frontend-v2/tests/api.test.mjs`
- `frontend-v2/tests/compliance.test.mjs`
- `frontend-v2/vite.config.js`

Ignored dependency directories, copied local test fixtures, production build output and runtime caches are excluded. No `.env` file, source dataset, generated bundle or database file is in the review diff.


## Read-only Gemini assistant (16 October 2026)

The initial unavailable AI panel has been extended in this isolated worktree only. Norman's panel and page layouts are retained. No provider key was found in the checked local process or expected local environment files. No secret was requested, printed, set or copied. The panel is currently unavailable for live Gemini answers; mocked automated responses are not live provider evidence.

### Contract and evidence

- Browser: same-origin `POST /api/demo/assistant/chat`; backend: `POST /demo/assistant/chat`. `GET /demo/assistant/status` reports configuration presence only. A configured key may still fail provider authorization, model access or quota.
- JSON input: `message` (trimmed, 1–1500 characters), `asset_id` (UUID returned by `/assets`), optional `scenario: {kind: "energy" | "peak_shift" | "impact", inputs: {...}}`. Inputs must match the selected asset and the existing validated calculation contract. Extra fields, client-supplied results, mismatched assets and non-finite scenario values are rejected.
- The backend resolves the asset against the approved BDG2 catalogue and reads only that asset's latest 24 returned observed intervals, 24-hour forecast, model metrics/method/split and at most 10 unusual-pattern examples plus the full detected count/rule. Counts and timestamps remain explicit; 24 returned observations are not assumed to form a complete day. Missing values are never invented. No other asset's readings, database configuration, raw headers, settings or private environment values are sent to Gemini.
- The user explicitly checks inclusion of the latest successful simulation's inputs for the same building. The backend recomputes its result with existing deterministic formulas and fresh verified evidence; it never trusts browser-supplied result values. No observed solar/storage/HVAC data is inferred.
- Output: `{asset_id, answer, label: "ai_explanation", provider: "Gemini", read_only: true, citations: [{id,label,url?,inputs?}], disclosure, limitations}`. Inline references identify observations, forecast, unusual patterns, simulation assumptions or limitations. BDG2 citations retain the official dataset/paper DOI; simulation citations contain the declared inputs. The prompt requires separate classifications and unavailability for unsupported information. Replies are plain text, rendered with `textContent`; no model HTML, links, scripts or tool calls execute.
- Questions are single-turn. The panel shows the latest actual question/answer; no chat history or fabricated conversation/logs are supplied. Asset changes clear old answers and stale responses are discarded. Questions and selected evidence are sent to Google Gemini only when Send/one of the question chips is used. The panel discloses that transfer and warns against personal data or secrets.

### Bounds and safe failures

- JSON only; 12,288-byte streamed request cap, 48,000-byte evidence cap, 65,536-byte provider response cap and 5,000-character answer cap. No automatic provider retries. A structured answer must cite supplied references; missing/invalid citations, unsupported numeric values, credential-shaped output, incomplete/blocked results and tool/code requests fail closed.
- Existing `httpx` is reused. The fixed Google HTTPS endpoint receives the private key only in `x-goog-api-key`, never the URL, prompt, frontend, logs or response. `GEMINI_MODEL` is an optional backend-only model override; default `gemini-3.5-flash-lite`. No new dependencies or lockfile changes.
- Limits per backend process: 5 requests per direct peer per minute, 20 total per minute and 2 concurrent requests. Forwarded IP headers are ignored. These intentionally conservative local-demo budgets aggregate Vite proxy users. They are not distributed production abuse protection and reset on process restart; public deployment requires separate review.
- Provider timeout 25 seconds (5-second connect), overall evidence/provider timeout 45 seconds, browser timeout 50 seconds. Validation/body errors: 400/413/415/422; absent key/evidence/provider access: 503; quota/busy: 429 with Retry-After; malformed/ungrounded/blocked output: 502; timeout: 504. Error bodies never echo provider payloads, submitted text or credentials. Clear unavailable/loading/retry states are shown; no fabricated answer replaces a failure.
- Gemini has no tools, browsing, database writes, setting changes or equipment-control interface. Prompt instructions, evidence citations and numeric checks reduce unsupported claims; they do not prove all model prose correct. Replies must be reviewed against evidence. No live quality or prompt-injection-resistance claim is made without provider evaluation.

### Private setup and local verification

Configure `GEMINI_API_KEY` privately for the **local backend process** using a secure environment mechanism, then restart that backend on port 8001 and click **Retry availability** at `http://127.0.0.1:4175/`. Do not put the value in chat, terminal command history, frontend/VITE-prefixed variables, source, logs or this document. An optional `GEMINI_MODEL` must name a model the key can access. No hosted secret/deployment change is authorized. A real question/answer and provider access/quota can only be verified after private setup.

Official API references: [GenerateContent REST contract](https://ai.google.dev/api/generate-content), [model catalogue](https://ai.google.dev/gemini-api/docs/models), [structured output](https://ai.google.dev/gemini-api/docs/structured-output). API/model availability is subject to the provider account; current configuration presence is not a successful live test.

### Files changed for this assistant task

- Backend: `backend/app.py`, `backend/src/demo_routes.py`, new `backend/src/gemini_assistant.py`, `backend/tests/test_demo_scenarios.py`, new `backend/tests/test_gemini_assistant.py`.
- Panel/layout: `frontend-v2/index.html`, `diagnostics.html`, `energy.html`, `digital-twin.html`, `settings.html`, `methodology.html`; `frontend-v2/src/css/demo.css`; `frontend-v2/src/js/dynamic_island.js`, new `assistant_context.js`, `shell.js`, `energy_simulator.js`, `settings.js`.
- Frontend tests: `frontend-v2/package.json`, new `frontend-v2/tests/assistant.test.mjs`, `frontend-v2/tests/compliance.test.mjs`.
- Documentation: `docs/EnergiOS_PRD.md`, `docs/EnergiOS_Backend_Implementation_Plan.md`, `docs/full-stack-demo-integration.md`, `docs/preflight-status.md`.

All earlier integration changes remain uncommitted. No original workspace, protected branch, hosted database or production deployment was modified.


### Assistant final verification — 17 October 2026

62 backend Python tests, 17 isolated PostgreSQL tests and 28 frontend tests passed; production build and whitespace/credential-pattern checks passed. Public/isolated health and the same-origin proxy were checked; the missing-key status returned 200 and chat returned explicit 503. Earlier desktop/mobile missing-key panel checks passed. The final browser recheck was blocked by the browser URL policy and was not bypassed; no fresh browser success or live Gemini answer is claimed. Detailed evidence and remaining private-key setup are recorded in `preflight-status.md`.

## Coherent demo verification — 17 October 2026

- The dashboard, diagnostics, Energy Scenario Lab, township comparison, settings, methodology and Norman AI panel were exercised against the local same-origin `/api` proxy. Asset switching, observed readings, calculated forecast, detected-pattern empty/non-empty states and the real read-only Gemini response were visible. The Gemini answer cited observations, forecast, anomalies and limitations, identified BDG2 as public benchmark data and made no Sime Darby, HVAC-cause, measured solar/battery, tariff, savings or control claim.
- `GET /demo/portfolio` now keeps the original response fields and adds common-window mean/peak interval-average kW, kWh/m² and source-local 00:00–05:59 share. The largest overnight share is labelled only as an investigation candidate. Different uses, weather, schedules and occupancy prevent a normalized efficiency ranking or confirmed ghost-load claim.
- `POST /demo/investment-comparison` compares two to six user-entered candidates. Missing CAPEX, annual energy change, tariff, carbon factor, annual operating-cost change or assumption source yields `Not calculated`. Complete positive-net-benefit candidates receive an `illustrative_scenario_ranking` ordered by simple payback, then annual net benefit. No BDG2 interval is treated as project performance or annualized savings.
- The labelled dashboard JSON export includes the selected API response, classifications, BDG2 DOI/licence and limitations. It contains no credential. The township assistant shortcut now asks the real read-only assistant about selected-building unusual-pattern evidence rather than calling a nonexistent floor/asset control.
- Browser calculations passed with changed 150 kW solar and 300 kWh storage assumptions. A 20 kWh peak shift returned zero energy-balance difference; a 100,000 kWh shift failed visibly because it exceeded the source interval, and a valid value recovered. Green CFO missing inputs remained `Not calculated`; illustrative inputs ranked two candidates and showed formulas, units, sources and limitations.
- All six routes were checked at 390×844 with zero document-level horizontal overflow. Desktop checks retained Norman's layout, imagery, charts, navigation and illustrative township scene. Browser console errors: zero. The inherited Tailwind CDN development warning remains; it is not an application runtime error.
- Final automated checks: **63 backend tests passed** (one inherited Starlette/httpx deprecation warning), **15 relevant disposable PostgreSQL schema/import/security tests passed**, **30 frontend tests passed**, production build passed, and `git diff --check` passed. The inherited 641 kB Three.js chunk warning remains. No `.env`, credential, raw BDG2 file, local database, generated import bundle or deployment change is included.

## Versioned demonstration scenario layer — 18 October 2026

- `GET /demo/scenario-profile/{asset_id}` returns `energios-demo-1.0.0`, a read-only central profile resolved only for the approved four-building BDG2 cohort. Browser edits are stored per building in local storage; they never change imported readings, hosted Supabase, or equipment.
- Whole-building BDG2 readings remain observed public benchmark data. Forecasts are calculated outputs and unusual patterns are statistical detections. HVAC/chiller/AHU, floor allocations, operating schedules, solar, battery, flexible load, tariff, carbon and investment values are user-editable simulated demonstration assumptions. Norman's building and township graphics remain illustrative visuals.
- Default load allocation varies by BDG2 use: office 45/18/27/10, education 42/24/22/12, lodging 48/16/20/16 and public assembly 50/22/18/10 percent for HVAC/lighting/IT-plug/other. HVAC defaults are 60/25/15 percent chiller/AHU/other HVAC, 23 C setpoint, 60 percent fan preview and illustrative COP 3.2. Floors default to 34/33/33 percent. Schedules are editable source-local demonstration hours.
- Microgrid defaults are use-specific 110–160 kW illustrative solar, 250 kWh battery, 75 kW power limit, 50 percent starting SOC, 0.95 per-leg efficiency and 0.85 target peak fraction. Flexible load defaults to 40 kWh shifted from interval 18 to 3. Tariff 0.50 MYR/kWh and carbon 0.55 kg CO2e/kWh are explicitly hypothetical editable assumptions, not Malaysian market facts. Green CFO defaults are two illustrative user-editable candidates; their calculations and ranking are not measured performance, verified savings or investment advice.
- Diagnostics Whole/Chiller/AHU, township HVAC/floor/cost, Energy Scenario Lab, dashboard cost/carbon and Green CFO now consume the same scenario profile. Allocation percentages must reconcile to 100 percent. Solar/battery and peak-shift calculations preserve the existing deterministic energy-balance rules. Daily and Monthly controls on the Energy screen show, respectively, the representative 24-hour scenario and a clearly labelled 30-day repetition; neither is presented as observed history or a monthly forecast.
- Live BMS/SCADA commands, measured equipment/floor/room telemetry, confirmed HVAC causes, real tariffs, official carbon factors and verified savings remain unavailable. Controls for these integrations stay disabled with a specific explanation.

Final verification for this layer: 73 Python tests passed; 17 disposable PostgreSQL migration/import/security tests passed; 48 frontend tests passed; the Vite production build and `git diff --check` passed. Desktop interaction checks covered observed dashboard history, diagnostics subsystem simulations, township building drawer, Energy scenarios and Green CFO. All six routes had no document-level overflow at a 390 px mobile viewport and no browser console errors. The inherited Tailwind CDN development warning and the 655.89 kB Three.js production chunk warning remain.