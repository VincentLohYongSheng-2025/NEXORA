# NEXORA

**Township energy intelligence for building operations.**

NEXORA is a local web prototype for exploring building energy profiles, forecasts, renewable planning, and coordinated township actions. This guide explains how to install and run the current prototype.

> **Prototype note:** The demo uses historical reference data and clearly identified assumptions. Building profiles, alerts, environmental conditions, and action impacts are illustrative. The prototype does not read live meters or control equipment.

## What you can explore

- **Overview:** View the illustrative 3D township, facility energy summaries, alerts, and recommendations.
- **Real-Time & Forecast:** Explore historical energy profiles, calculated forecasts, and estimated energy, cost, and emissions.
- **Action Simulator:** Preview a township flexibility scenario and compare its modelled effects.
- **Renewable Simulator:** Adjust rooftop solar and battery assumptions and review estimated output and investment results.
- **Carbon Dashboard:** Review electricity-related emissions and prepare a carbon report or an ESG report draft.
- **Copilot:** Ask questions about the selected building and its available calculations.

## Install and run

### Requirements

- Git
- `uv`, which installs and manages the required Python 3.12 environment
- An internet connection for the first dependency install

Node.js and npm are only needed for the optional frontend hot-reload workflow and frontend checks.

### 1. Install uv

Use the command for your operating system. See the [official uv installation guide](https://docs.astral.sh/uv/getting-started/installation/) for other methods.

**Windows (PowerShell):**

```powershell
winget install --id=astral-sh.uv -e
```

**macOS (Homebrew):**

```sh
brew install uv
```

**Linux:**

```sh
curl -LsSf https://astral.sh/uv/install.sh | sh
```

After installation, open a new terminal and check `uv --version`.

### 2. Download the project and install backend packages

Run these commands in a terminal:

```sh
git clone --branch main https://github.com/VincentLohYongSheng-2025/NEXORA.git
cd NEXORA/backend
uv python install 3.12
uv sync --locked
```

`uv sync --locked` creates the project environment and installs the locked packages.

### 3. Start NEXORA

From the `backend` folder, run:

```sh
uv run --locked uvicorn app:app --host 127.0.0.1 --port 8009
```

Open **http://127.0.0.1:8009** in your browser. The backend serves the prototype website and its local API together. No API key or database setup is needed for the standard demo. Stop the server with `Ctrl+C`.

Useful checks: [health](http://127.0.0.1:8009/health) and [API documentation](http://127.0.0.1:8009/docs).

## Optional frontend hot reload

Use this when editing frontend files. Keep both terminals running.

**Terminal 1:** from `NEXORA/backend`, start the API on port 8001:

```sh
uv run --locked uvicorn app:app --host 127.0.0.1 --port 8001
```

**Terminal 2:** from the repository root, start Vite:

```sh
cd frontend
npm ci
npm run dev
```

Open the local address printed by Vite. Its `/api` requests are proxied to the backend on port 8001. Install Node.js and npm before using this optional workflow.

## Run checks

From `backend/`:

```sh
uv run --locked pytest
```

From `frontend/` (after installing Node.js):

```sh
npm ci
npm test
npm run build
```

## Data and saved demo state

The packaged Malaysian electricity reference is CLEMD data from one institutional building at Universiti Pertahanan Nasional Malaysia, collected in 2023. The six named township facilities are illustrative profiles derived from this single source using NEXORA assumptions; they are not six measured buildings. Forecasts, alerts, room conditions, renewable output, costs, emissions, and action results are estimates or simulations.

See [the one-page data sources and assumptions document](output/documentation/NEXORA_Data_Sources_and_Assumptions.docx), [Malaysia demo data](docs/malaysia-demo-data.md), [digital twin notes](docs/township-digital-twin.md), and [township flexibility scenario](docs/township-flex-scenario.md) for details.

Local scenario and review state is saved in `data/local/workbench-malaysia-v2-session.json`. It is ignored by Git and can be removed to reset local demo changes. Carbon Dashboard preferences are saved in the browser.

## Project structure

```text
backend/
  app.py                 Local API and website server
  data/                  Packaged reference dataset and provenance
  src/                   Forecast, simulator, reporting, and API modules
  tests/                 Backend checks
frontend/
  index.html             Main prototype page
  src/js/                Application features and visualisations
  src/css/               Application styles
  tests/                 Frontend checks
  vite.config.js          Optional development server configuration
docs/                     Data, digital twin, and scenario notes
```

## Common setup fixes

- **`uv` is not recognized:** reopen the terminal after installing uv, then run `uv --version`.
- **Port 8009 is already in use:** change `--port 8009` to `--port 8010` and open `http://127.0.0.1:8010`.
- **Vite cannot reach the API:** confirm Terminal 1 is running the backend on port 8001.
- **Dependency installation fails:** check your internet connection, then rerun `uv sync --locked` from `backend/`.
