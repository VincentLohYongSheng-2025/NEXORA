# Video rebuild verification

Verified locally on 21 October 2026, Asia/Kuala_Lumpur. The application runs at `http://127.0.0.1:8001`.

## Result

The seven screens use the reference navigation, light surfaces, connected KPI strip, blue controls, teal accents, interactive building model, load chart and action-centre presentation. Forecasts and calculations retain the existing BDG2 source boundary instead of reproducing unsupported video numbers or live-control claims.

The initial Nexora folder was empty. Application source was copied from `C:/Users/Vincent Loh/Desktop/EnergyOS-solar-grid-model` into this workspace. Public benchmark import files were copied from `C:/Users/Vincent Loh/Desktop/EnergyOS/data` so the retained model and database regression checks could execute. Original application folders were not edited.

## Main implementation files

- Added `backend/src/workbench.py`, `backend/bdg2_live_snapshot.json`, and `backend/tests/test_workbench.py`.
- Extended `backend/app.py` with the local workbench API and explicit local frontend routes; existing health/database/demo/provider route contracts remain available.
- Added `frontend/src/js/workbench.js`, `frontend/src/js/building_preview.js`, and `frontend/src/css/workbench.css`.
- Replaced `frontend/index.html` and `frontend/vite.config.js`. Existing HTML entry paths redirect to the corresponding new screen. Retained source modules, assets, backend analytics and import files are preserved.
- Updated the frontend test command to run retained client/calculation tests. The old compliance file remains historical evidence of the retired sidebar/island DOM; it is not a current UI contract.
- Added responsive inspection pages `frontend/qa.html` and `frontend/qa-audit.html`, plus root setup notes and ignore rules.

## Evidence

- Browser: building and period changes produced separate results; the office snapshot totals were independently checked at 4,264.69 kWh for the last day and 33,229.23 kWh for the week. Both filters persist across screens; browser selection also persists on reload.
- Browser: approving the assembly building's solar proposal produced 1,334.9 kWh projected grid avoidance and RM 667.43 projected grid-cost difference. Dismissing the efficiency proposal preserved those values. Carbon displayed the corresponding 734.2 kg CO2e projected avoidance. These are scenario results, not measured savings.
- Browser: configuration edits changed cost calculations across pages; simulation preview and save worked; full-page and floating results chat used the selected context. Approval confirmation, activity history, chart metric toggles, model zoom and level selection were exercised.
- Browser: all seven screens loaded without horizontal overflow at 390, 768 and 1440 px: **21/21 checks**. Mobile navigation opened, selected Monitoring and closed after navigation. Mobile AI Control places recommendations before the decorative model.
- Browser: final application tab reported zero console errors. Two earlier errors were isolated to the responsive harness's initial empty iframe document; its observer now checks that a body exists before observing it.
- Export: the browser PDF request returned HTTP 200. The generated one-page PDF was parsed and rendered with PyMuPDF; source dates, units, assumptions, BEI, source attribution and separate projected results were readable.
- Backend: the full retained 80-test run passed all checks except the local file-server method-routing contract. That issue was corrected by serving explicit frontend paths. All four API contract checks and all five workbench checks then passed. Retained import/model tests passed using the restored measured benchmark fixtures and existing Python 3.12 environment.
- Frontend: **39 retained client/calculation tests passed**. JavaScript syntax checks and the final production build passed.

## Practical limits

The workbench uses a frozen, labelled public benchmark snapshot. It does not establish current site conditions. Demo state is held in the server process and resets on restart. The new Copilot operates in disclosed deterministic local-results mode; the separately preserved Gemini endpoint requires its existing private provider configuration. EV calculations and measured room telemetry are unavailable. No physical equipment controls, verified savings or official tariffs/factors are claimed.

The package registry was unavailable through this environment's DNS, so `npm ci` could not fetch Vite 5.4.21. The final build was verified with the existing Vite 7.3.7 runtime. A non-blocking 653 kB Three.js bundle warning remains. The local backend serves the app without requiring Node installation.

No commit, push, hosted database change or deployment was performed.
