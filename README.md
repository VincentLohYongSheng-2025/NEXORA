# NEXORA EnergiOS

**Township energy intelligence for better building operations.**

NEXORA is a prototype that brings building energy profiles, forecasts, renewable planning, and coordinated township recommendations into one workspace. It is designed to help a township manager understand estimated demand, explore possible actions, and review their projected effects before making an operational decision.

> **Prototype status:** The application uses historical benchmark data and clearly labelled estimates. It is not connected to live building meters or equipment controls. Recommendations and reported impacts are for demonstration and planning only.

## Product features

- **Township overview:** Explore six illustrative facilities in an interactive 3D township and review estimated energy, cost, and emissions alongside alerts and AI suggestions.
- **Real-Time & Forecast:** Review historical energy profiles, a calculated next-day forecast, 24-hour and seven-day views, and estimated energy, cost, and CO₂e trends.
- **Township recommendations:** Review building alerts and AI suggestions, preview individual actions, and explore a cross-sector flexibility scenario involving refrigeration, irrigation, and EV charging schedules.
- **Action Simulator:** Compare scenario outcomes across the township, including demand before and after the proposed actions. Demo approvals do not send equipment commands.
- **Renewable Simulator:** Explore illustrative rooftop solar PV and battery configurations and their estimated energy and investment outcomes.
- **Carbon Dashboard:** Review estimated electricity-related emissions, planning assumptions, and carbon actions. Download a carbon report or an **ESG report draft** with the available evidence and limitations disclosed.
- **NEXORA Copilot:** Ask questions about the selected building’s calculations and plans using the built-in deterministic, read-only results explainer.

## Data and prototype boundaries

The app packages a normalized, audited subset of the **CLEMD** Malaysian electricity dataset. It contains 696 complete hourly observations from one institutional building at the Faculty of Medicine and Defence Health, Universiti Pertahanan Nasional Malaysia. The source measurements are historical (September–October 2023); incomplete hours remain missing.

The six NEXORA township facilities are illustrative profiles derived from that single reference dataset using assumed building areas, schedules, load shares, and calibration factors. They are not measured NEXORA, Sime Darby Property, or township buildings. Their floor and room conditions, alerts, and equipment flexibility are also simulated.

Electricity cost, emissions, solar generation, battery dispatch, savings, and financial outcomes depend on configurable planning assumptions. The default rate is RM 0.45/kWh and the default emissions factor is 0.760 kgCO₂e/kWh. The ESG report is a draft: the application does not provide a complete corporate ESG inventory, Scope 1 and Scope 3 evidence, independent assurance, or regulatory compliance certification.

See [Malaysia demo data](docs/malaysia-demo-data.md), [township digital twin](docs/township-digital-twin.md), and [township flexibility scenario](docs/township-flex-scenario.md) for calculation details and limitations.

**Dataset attribution:** CLEMD, [Figshare collection](https://doi.org/10.6084/m9.figshare.c.6946581), described by Al-Khadher et al. in [*Scientific Data* (2024)](https://doi.org/10.1038/s41597-024-03433-7). Dataset archives are licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Additional attribution and transformation details are in [docs/malaysia-demo-data.md](docs/malaysia-demo-data.md).

## Technology

- Python 3.12, FastAPI, and Pydantic
- HTML, CSS, and JavaScript modules
- Three.js for the interactive township and building views
- Vite for optional frontend hot reload and production build

## Run locally

### Requirements

- Git
- Python 3.12
- [`uv`](https://docs.astral.sh/uv/getting-started/installation/)

Install `uv` on Windows with WinGet:

```powershell
winget install --id=astral-sh.uv -e
```

Clone the repository and install the backend dependencies:

```powershell
git clone https://github.com/VincentLohYongSheng-2025/NEXORA.git
cd NEXORA\backend
uv python install 3.12
uv sync --locked
```

Start NEXORA:

```powershell
uv run --locked uvicorn app:app --host 127.0.0.1 --port 8009
```

Open [http://127.0.0.1:8009](http://127.0.0.1:8009). The FastAPI server serves the prototype UI and local API together; Node.js is not required for this setup. Stop the server with **Ctrl+C**.

Useful local endpoints:

- `/health` — application process health
- `/docs` — interactive API documentation
- `/api/workbench/assets` — available demo facilities and reference asset
- `/api/workbench/township?period=day` — township summary and recommendations

### Optional: frontend development server

For frontend hot reload, start the backend on port **8001** in one terminal from `backend/`:

```powershell
uv run --locked uvicorn app:app --host 127.0.0.1 --port 8001
```

In a second terminal, from the repository root:

```powershell
cd frontend
npm ci
npm run dev
```

Open the local URL printed by Vite. The Vite proxy is configured to forward API requests to the backend on port 8001.

## Tests and build

Run backend tests from `backend/`:

```powershell
uv run --locked pytest
```

Run frontend tests and build from `frontend/`:

```powershell
npm ci
npm test
npm run build
```

## Local demo state

Configuration, saved scenarios, reviews, and activity are stored in the ignored local file `data/local/workbench-malaysia-v2-session.json`. Carbon Dashboard preferences and evidence-review selections are stored in the browser. Neither is committed to Git by default.

## Repository layout

```text
backend/
  app.py                    FastAPI application and local UI server
  data/                     Packaged Malaysian reference data
  src/workbench.py          Workbench API and demo calculations
  src/malaysia_benchmark.py Data validation, forecast, and profile preparation
  src/township_flex.py      Township flexibility scenario calculations
  tests/                    Backend tests
frontend/
  index.html                Main prototype entry point
  src/js/                   Application, charts, simulators, and 3D views
  src/css/                  Application styles
  tests/                    Frontend tests
  vite.config.js             Optional Vite server and API proxy
docs/
  malaysia-demo-data.md
  township-digital-twin.md
  township-flex-scenario.md
```
