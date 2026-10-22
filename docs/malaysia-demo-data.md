# Malaysia v2: data and calculation review

The active workbench now uses CLEMD rather than the BDG2 snapshot. Legacy BDG2
import tools and archived evidence remain separate. All four main tabs, the
Action Simulator, Copilot evidence and report exports use the workbench source.

## Source and missing data

One measured incoming supply at the Faculty of Medicine and Defence Health,
Universiti Pertahanan Nasional Malaysia. Source: [CLEMD collection](https://doi.org/10.6084/m9.figshare.c.6946581),
[Scientific Data paper](https://doi.org/10.1038/s41597-024-03433-7), CC BY 4.0.
The packaged normalized input is hash checked and requires no raw-data download
or pandas installation at application startup.

Phase real power is summed and integrated: W × seconds / 3,600,000 = kWh.
Only complete 3,600-sample hours are accepted. There are 696 valid hours in the
audited September–October 2023 subset. The latest seven-calendar-day view is
18–24 October 2023 with 144/168 hours available. Missing 18 October readings are
left as a gap. Totals exclude missing hours and coverage is disclosed in the UI
and PDFs. Annual projections use available complete days, not missing-day zeros.

## Six synthetic building profiles

These are scenario inputs, not measurements or official building benchmarks.

| Facility | Assumed area m² | Training-average intensity target kWh/m²/year | HVAC share | PV nameplate kWp | Battery kWh / kW |
|---|---:|---:|---:|---:|---:|
| Galleria | 6,600 | 220 | 52% | 180 | 250 / 100 |
| Medical Centre | 7,000 | 260 | 55% | 160 | 250 / 100 |
| Garden Kitchen | 450 | 320 | 32% | 24 | 30 / 15 |
| Exchange | 8,580 | 180 | 50% | 108 | 250 / 100 |
| Residences | 6,720 | 100 | 38% | 132.6 | 200 / 80 |
| Solar Park auxiliary load | not applicable | 40 kWh/day target | 0% | 1,000 | 500 / 250 |

Hourly derivative = source kWh × operating-schedule weight × calibration factor.
The factor is fitted only to complete days before 11 October, targeting area ×
annual intensity / 365. Mall and restaurant schedules favour trading hours,
office weekends reduce demand, hospital retains a high 24-hour base, and
residential demand favours evenings. The six profiles retain source variability.
Floor HVAC weights total 100% including a 10% roof allocation. End-use shares
total 100%; default EV consumption is zero until chargers enter a simulation.

## Forecast

Seasonal local hour-of-week expectations plus correction from prior residuals.
For unsupported weekdays (recurring Wednesday source gaps), predictions use
prior same-hour observations across other weekdays. This never creates observed
readings. Historical daily origins use a fixed model fitted before 17 October
and only prior residuals. The next-day 25 October forecast fits available history
through 24 October.

The audited 144 paired test hours have model MAE 6.741485 kWh/hour versus
8.236971 for the previous-day baseline, about 18.2% lower error. This evaluates
one institutional source; it is not facility-specific accuracy. No confidence
band is asserted for the synthetic building profiles.

## Cost, carbon, solar and battery

- Flat RM0.45/kWh is an editable **planning assumption**, not an applicable TNB
  invoice or tariff. AFA, demand charges, retail fees and taxes are excluded.
- Default factor: **0.760 kgCO2e/kWh**, the Energy Commission's provisional
  **2023 Peninsular Malaysia** grid factor. Source-year matching is deliberate.
  [Official release, 23 February 2026](https://myenergystats.st.gov.my/documents/d/guest/grid-emission-factor-gef-in-malaysia-2022-2024-provisional-).
- Cost = available electricity kWh × configured rate. Carbon = electricity ×
  configured factor. User changes remain assumptions requiring review.
- PV: 07:00–19:00 Malaysia-local sine shape normalized to **4.5 equivalent
  sun-hours/day**, an assumed daily irradiation input. Nameplate × 4.5 ×
  performance ratio × shading/orientation factors gives daily generation.
  Default PR 84%, shading loss 5%; roof bounds and panel counts constrain sizing.
- Storage starts at **0% SOC**. It charges only from solar surplus; power,
  capacity and 95% efficiency per leg constrain dispatch. Final replay maintains
  physical energy balance rather than crediting quantized SOC rounding.
- Annual financial results repeat a modelled day; they are not weather-based
  annual production forecasts or supplier quotations. Starting stored-energy
  depletion is removed from repeated annual savings.
- Solar sharing reserves each source's own use/storage first, deducts 3% assumed
  transfer loss, and allocates from one common ledger. Savings use the same flat
  rate as the dashboards; the old 40% premium has been removed. Approved sharing
  changes grid imports, cost and carbon consistently in building and township
  metrics. Total building consumption is unchanged by a source transfer.

## Other demo inputs and reporting

3D HVAC/grid/solar overlays now read calculated state; the fixed overlay kWh
table was removed. Floor allocations, zone shares and alert savings reconcile
to the same building forecasts. Room temperatures, occupancy and outdoor weather
remain labelled scenarios. Occupancy uses floor area / assumed m² per person / room shares; unoccupied alerts and cold stores have zero occupants. Restaurant cold storage uses a 4°C scenario, separate from occupied-room comfort conditions. Alerts describe plausible symptoms and review actions,
not unverified actuator faults or precise control commands.

Invented GITA 14.4% and GBI 72-point statements were removed. ESG remains a draft
with missing governance/social/assurance evidence disclosed. Exports include the
CLEMD attribution, coverage, configured factors and consistent load allocations.
Carbon evidence checkboxes have a new storage namespace so old source reviews
cannot imply that this source was already reviewed.

Malaysia v2 uses `data/local/workbench-malaysia-v2-session.json`. Old BDG2
configurations, scenarios and approvals remain in the previous session file;
they are not silently applied to the new baseline. Re-review the new plans.
