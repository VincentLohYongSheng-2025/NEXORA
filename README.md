# EnergiOS local workbench

Seven application screens recreated from the supplied video references: Overview, Monitoring, Renewable Simulator, Carbon, Digital Twin, AI Control and Copilot. The local server is available at http://127.0.0.1:8001 while it is running.

Overview opens with an interactive Three.js township and combined energy, cost and carbon cards above it. Select one of six concept facilities to zoom into its model and open its individual demo results; use Back to township to return to the totals. Each facility has an independent configuration and plan, using documented illustrative load profiles derived from historical benchmarks. The four measured benchmark datasets remain separately selectable. See [township calculation basis and verification](docs/township-digital-twin.md).

## Run

From `backend/`, use the project's Python 3.12 environment:

```powershell
uv sync --locked
uv run --locked uvicorn app:app --host 127.0.0.1 --port 8001
```

The backend serves the frontend directly; Node installation is optional. For a separate Vite development server, run `npm ci` and `npm run dev` from `frontend/` while the backend is running on port 8001.

## Data and demo state

- The workbench uses the existing frozen public BDG2 API snapshot, fetched 14 October 2026. Its observed source window is 25–31 December 2017; the saved 24-hour forecast is for 1 January 2018. The original database-backed endpoints, import pipeline, analytics, Gemini integration and calculation modules are preserved.
- All four source buildings retain separate observations, forecast evaluation, configuration and demo plans. The browser remembers the selected building and period.
- Cost, carbon, PV, battery, efficiency targets and equipment settings are explicitly hypothetical, editable demo assumptions. Defaults include RM 0.50/kWh, 0.55 kg CO2e/kWh and a 5% efficiency planning target. They are not official factors, tariffs or measured savings.
- Approvals, dismissals, configurations, scenarios and activity are held in the local server process. Restarting the server resets this demo state. Dismissing a proposal never removes an approved action.
- Copilot's new **local results mode** is a deterministic results explainer over the selected building and current calculations. It does not claim to be a Gemini response. The original provider-backed assistant API is preserved separately and requires its existing private backend configuration.
- The model geometry and room selections are illustrative. No room telemetry or physical equipment command is connected. EV simulation is unavailable because no supported calculation is implemented.
- The public measured cohort and source files were copied from the existing `EnergyOS/data` folder for retained import/model regression checks. No database migration, hosted configuration, deployment, commit or push was performed.

## Verification

`frontend/qa-audit.html` renders all seven screens at 390, 768 and 1440 px to check loading and horizontal overflow. `frontend/qa.html?width=390&height=844&route=overview` provides an inspectable responsive viewport.

Run backend checks with `uv run --locked pytest` from `backend/` and the retained frontend calculation/client checks with `npm test` from `frontend/`. The inherited `tests/compliance.test.mjs` describes the retired multi-page DOM and is retained as historical source; its old sidebar/island markup assertions are superseded by the browser checks for this rebuild.

Dataset: Building Data Genome Project 2 v1.0, CC BY 4.0, https://doi.org/10.5281/zenodo.3887306. Paper: Miller et al., Scientific Data 7, 368 (2020), https://doi.org/10.1038/s41597-020-00712-x. This is not Sime Darby or Elmina operational data.
