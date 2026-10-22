# Action Simulator

## Workflow
Overview's Action recommendations now includes alerts and calculated AI suggestions. Every item has a Simulation button, including settled alerts. Sharing recommendations are included in that same panel.

Simulation opens a dedicated Action Simulator page. It reuses the renewable workspace layout and complete township geometry, with the same theme and navigation. The selected building/floor is highlighted, source buildings are outlined, and sharing routes appear in the After preview. The right column has only an AI recommendation and the selected action details; there is no manual editing mode.

Run simulator calculates a next-24-hour before/after chart and three results: money saved, energy (or grid energy) saved, and carbon emissions reduced. Running a simulation does not approve, settle, persist or physically execute the action. Previously approved items are standalone comparisons.

## Calculations
- Alerts use the existing alert reduction fractions and configured price/carbon factors.
- Sharing uses available hourly surplus, local use/storage reservation, 3% losses, and a single shared allocation ledger. Rooftop surplus is considered before Solar Park backup. Multiple source buildings can jointly supply one floor when their actual configured profiles have surplus.
- PV/storage uses the current dispatch result. It replaces grid energy without reducing total consumption.
- Efficiency uses the existing configured reduction target.
- Load shifting preserves total energy; the flat-rate comparison correctly reports zero energy/bill savings while showing any peak reduction.
- Missing price or carbon factors stay unavailable.
- Chart times retain the forecast's true local date/time. Estimates remain benchmark-derived, not live readings.

The current profiles have surplus at Solar Park. The simulator does not invent rooftop surplus for Galleria or Residences; their use as providers depends on the configured generation and remaining demand.

## Verification
57 frontend regression tests passed. Backend tests cover all three simulation kinds, invalid/mismatched actions, missing factors, no approval mutation, sharing conservation/losses, multi-source allocation and approval/reset behavior. Browser checks cover opening from an AI suggestion and settled alert, running results, source-local tooltips, before/after hybrid preview and mobile layouts. Browser console showed no errors.

Existing legacy compliance and PDF wording failures documented in township-energy-sharing.md remain outside this change.

Preview: http://127.0.0.1:8009/#overview
