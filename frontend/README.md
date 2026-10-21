# EnergiOS — Frontend Dashboard (v2)

Modern, Bento-grid energy monitoring, 24-hour forecasting, and unusual-consumption-pattern dashboard for the EnergiOS BDG2 public benchmark.

The frontend also includes clearly separated demonstration modules:

- `energy.html` uses the selected asset's calculated 24-hour forecast with user-visible simulated solar, battery, price, and flexible-load assumptions. It performs no live control action.
- `digital-twin.html` is an illustrative portfolio navigator for the four BDG2 benchmark assets. It is not measured geometry or a verified digital twin.
- `methodology.html` records the BDG2 dataset and paper citations, CC BY 4.0 licence, data classifications, limitations, and simulation assumptions.

Every page carries the disclosure: “Demo uses BDG2 public benchmark data and clearly labelled simulations. It does not use Sime Darby Property operational data.”

## Architecture & Visual Design
- **Bento-Grid Layout:** Rounded cards with subtle shadows, soft warm background (`#F6F5F0`), clean typography (`Outfit`, `Space Grotesk`, `Inter`).
- **Building presentation:** Illustrative images for the four source-labelled BDG2 buildings. They are not verified geometry or spatial data.
- **Operational radial gauge:** Latest observed hourly interval kWh relative to the selected 24-hour observed maximum.
- **Bento KPI Cards:**
  - **Latest observed interval:** Latest observed interval kWh with 24-hour trend.
  - **24h Total Energy:** Cumulative sum with hourly average draw.
  - **Forecast Accuracy:** Displays the selected asset's held-out MAE and its backend-provided previous-day baseline when available.
- **Time-Series Chart:** Historical observed hourly readings (kWh) with continuous handoff to the 24-hour ML forecast curve and flagged anomaly markers.
- **Anomaly Detection Triage Panel:** Filterable list of unusual consumption patterns detected by the backend (`above_expected` / `below_expected`) with "Locate on Chart" navigation. Strictly compliant with PRD rules: labeled `unusual_consumption_pattern` without unsubstantiated HVAC or waste claims.
- **Scope-gated views:** Equipment diagnostics, microgrid, digital twin, and operational settings remain visibly unavailable because BDG2 does not support those claims.

## Live Backend API Integration
The browser calls the same-origin `/api` prefix. Vite and Vercel proxy it to `https://energios-backend.vercel.app`:
- `GET /health` — Application health & liveness.
- `GET /assets` — Catalogue of 4 BDG2 whole-building assets.
- `GET /assets/{asset_id}/readings?limit=168` — Historical observed hourly interval-kWh readings.
- `GET /assets/{asset_id}/forecast` — 24-hour multi-step forecast with model evaluation metrics.
- `GET /assets/{asset_id}/anomalies?limit=100` — Statistical unusual pattern detections via validation MAD threshold.

There is no snapshot or synthetic fallback. API failures produce an explicit unavailable state.

## How to Run Locally

Install the pinned frontend dependency and start the Vite proxy:

```bash
npm install
npm run dev
```

Then open the URL printed by Vite. Use `npm test` and `npm run build` for verification.
