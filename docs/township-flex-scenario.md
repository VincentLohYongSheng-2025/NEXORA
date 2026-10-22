# Township service flexibility: Malaysia-derived demo

The flagship alert coordinates **Nexora Galleria**, **The Garden Kitchen**,
**Nexora Residences**, and **Nexora Exchange**. Existing architectural models
and facility uses are retained. Garden Kitchen has a restaurant cold room,
Residences contributes assumed landscape irrigation, and Exchange contributes
an explicitly added car-park charging booking. No warehouse, municipal water
plant, industrial ammonia compressor, or DC charging plaza is asserted.

## Data boundary

The baseline is the current next-day CLEMD-derived synthetic facility forecast,
not six measured buildings. Source: `docs/malaysia-demo-data.md`. Each hourly
interval is split into two equal constant-power half-hours. These are **scenario
intervals**, not additional readings or a validated 30-minute forecast. The
scenario retains the source forecast date; it does not pretend the event is
happening today or on a Friday.

Equipment allocations, EV bookings, operating limits and connectivity are
additional synthetic inputs. The model uses a hypothetical common feeder over
all six facilities. It does not assume that this feeder is one revenue meter.
Baseline solar and previously approved actions are excluded from the standalone
comparison. Hospital care and essential water functions are never curtailed.

## Stress event and flexibility offers

- Common feeder limit: maximum next-day normal demand including the new EV
  booking, rounded up to 10 kW. This is a scenario design limit, not a TNB
  contract or transformer nameplate.
- Galleria event: 14:00–14:30 additional cooling = hourly building forecast ×
  existing 52% HVAC allocation × assumed 15% surge. All extra mall cooling is
  retained in both comparisons.
- Garden Kitchen: forecast × existing 50% plugs/services × assumed 50%
  refrigeration allocation. At most half this compressor load is flexible.
  Assumed cold-room air starts at 4°C, drifts at 0.6°C/hour at the maximum offered
  reduction, with a 5°C scenario review ceiling. This is not a food/product
  safety assessment; actual product type, temperatures and compressor controls
  require validation.
- Residences: forecast × existing 38% plugs/services × assumed 15% irrigation
  pump allocation. A scheduled nonessential irrigation cycle can be deferred
  with equal runtime by 18:00. Fire, potable and stormwater pumps are excluded.
- Exchange: six hypothetical 7.4 kW AC charging sessions at full requested
  load, 14:00–16:00: 44.4 kW and 88.8 kWh total. At most 50% can be throttled
  during the event; the group must receive the full booked energy before
  18:00. Recovery cannot exceed the 44.4 kW site budget. A production scheduler
  also needs individual session telemetry, departure deadlines and consent.

The current snapshot calculates approximately 35.1 kW extra mall cooling,
1,712.9 kW event feeder demand, and a 1,680 kW assumed limit. It selects 32.9 kW
of the available 35.8 kW flexibility, in proportion to each offer: 5.1 kW cold
room, 7.4 kW irrigation, 20.4 kW charging. These values are calculated on request,
not fixed UI claims.

## Recovery and outcome accounting

Deferred work = selected kW × 0.5 hours. One shared ledger reserves remaining
headroom for recovery, subject to each resource's power budget, earliest return
and deadline. Refrigeration recovery begins no earlier than 14:30 and completes
before 16:00; irrigation recovery starts from 15:00 and finishes before 18:00;
EV recovery starts from 15:30, within the site charging limit, before 18:00.
There is no assumed recovery efficiency benefit or loss: all deferred electrical
energy is repaid 1:1. Real compressor/pump performance may change this balance.

The chart also tests an independent response in which every deferred service
recovers at 14:30, creating a second peak. A plan is feasible only if the event
fits capacity, every task is repaid, and the entire after-profile stays at or
below the assumed limit. There is no uncertainty reserve in this deterministic
scenario; the simulated result can sit exactly on the design limit. Production
dispatch requires an uncertainty margin and closed-loop monitoring.

All calculations cover the full 24-hour horizon. Consequently net energy saved,
flat-rate cost savings and carbon reduction are zero in the feasible scenario.
The result is capacity release with service recovery, not verified bill savings.

TNB defines monthly maximum demand using 30-minute consumption. A separate mall
revenue meter is not reduced by curtailing another site's loads. Demand-charge
savings require verified revenue-meter topology, applicable tariff and monthly
demand data. No RM97.06/kW charge, RM63,000 penalty, or avoided fine is assumed.
Official reference: https://www.tnb.com.my/commercial-industrial/maximum-demand/what-is-md

## Reviews and scope

Simulation is read only. Each of the four participants has a revocable local
**demo review record**, tied to the scenario input signature. Changed relevant
forecasts invalidate those records. Only all four records plus a feasible plan
produce the approved demo status. These are not authenticated operator consents,
physical equipment commands, or credits to dashboard/report savings.

The existing local alerts and solar-sharing flows remain available. The new
township alert leads recommendations for each participating facility, and its
Simulation button opens the Action Simulator with the complete township twin,
resource offers, recovery schedule and capacity comparison.
