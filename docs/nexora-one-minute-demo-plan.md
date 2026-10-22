# NEXORA: one-minute prototype demonstration

Prepared 22 October 2026 after reading all 11 pages of the supplied pitch deck, inspecting every slide visually, reviewing current application code, and recalculating two local simulator previews. This is a recording plan; no video or field validation was performed. No application settings, approvals or saved scenarios were changed for this audit.

## Purpose and story

Show one township manager making one coherent set of decisions for **Nexora Exchange**: see the township, anticipate demand, investigate a floor alert, approve an estimated improvement, assess a renewable investment, and produce a report.

This covers the four problem groups on slide 2 and the four innovations on slide 6 at prototype level. It cannot establish that field integration, physical optimisation, actual savings, verified emissions, certification or tax eligibility have already been achieved. Slides 9 and 10 support presenting those as subsequent validation and pilot work.

Use one selected building throughout. Switching between buildings would make the changing numbers harder to follow.

## Exact 60-second edit

| Time | Screen and recording actions | What the viewer must see | Problem / innovation demonstrated |
|---|---|---|---|
| **00–06** | **Overview.** Begin with the six-facility 3D township and total energy, cost and carbon cards. Allow one gentle orbit, then click **Nexora Exchange**. | The transition from the township to the same facility; six conceptual profiles in one dashboard. Caption: **One township management view**. | Fragmented information; township intelligence and spatial digital twin. |
| **06–17** | **Real-Time & Forecast.** Keep Exchange selected. Show **7-day view**, the orange historical profile and green next-24-hour forecast; crop closer to the forecast boundary, then the forecast-health panel. End with a very brief cut to the flexible-load planning chart. | Overlay: **Historical source-benchmark test: MAE 22.1 vs 29.0 kWh/hour · 24.0% lower error**. Show the peak-shift chart with a small caption: **Illustrative load shift; total energy conserved**. | Anticipating demand and bill pressure; evidence for the forecast; peak-shift planning. |
| **17–29** | Return to **Overview**, still on Exchange. Find **Cooling an unoccupied zone — Level 4 — Meeting rooms**. Click **View floor →**, show the selected floor/zone, then **Human approval**. Hold the savings popup for about three seconds, click **Confirm approval**, and briefly show its settled status. | The issue, its location, its suggested solution, and the manager's approval. Current incremental projected impact: **RM 26.81 · 53.6 kWh · 29.5 kg CO₂e over the next 24 hours**. Caption: **Manager approval updates the local plan**. | Manual review; locating an issue in the 3D model; human approval before action. |
| **29–36** | **Carbon Dashboard.** Show the electricity-linked emissions and approved-plan avoidance cards, then cut down to **AI Carbon Action Centre** and click **Open Simulator**. | **168 kWp rooftop solar · 280 × 600 W panels**. The recommendation transfers its settings and retains Exchange as the building. Caption: **Forecast-informed solar starting design**. | Carbon visibility and a concrete investment option; connected carbon-to-simulator workflow. |
| **36–50** | **Renewable Simulator.** Show **AI recommendation**, the proposed installation on the same Exchange model and **Before / After**. Use prepared cuts to **Edit manually**, a solar-plus-battery scenario, and **Investment Analysis / Saved scenarios** comparison. Include one short **Energy flow** view if it remains readable. | AI settings are prefilled; manual mode begins from the same settings. Compare solar alone with solar plus the configured battery. Hold **Estimated CAPEX** and **payback** long enough to read. Caption: **Compare investment choices before spending**. | Unclear ROI / green investment decisions; renewable simulator, shared geometry, financial and carbon planning. |
| **50–58** | Return to **Carbon Dashboard**. Click **Export Carbon Report** and show the actual downloaded report cover / inventory page. Use a short cut to **Prepare ESG Report** and its draft download / evidence register. | Building, reporting period, energy, electricity-linked emissions, factors, method and projected-plan labels. Caption: **Downloadable carbon report + ESG evidence draft**. | Manual reporting and missing calculation traceability; financial/carbon intelligence. |
| **58–60** | End on the NEXORA identity or the township. | **Forecast. Review. Plan.** Keep the prototype disclosure visible. | Reinforce the manager workflow and the pilot-ready direction. |

**Editing method:** record longer source clips first, then cut to 60 seconds. Use direct cuts and short cursor movements; remove loading and scrolling dead time. Save scenario examples before the final take, rather than typing their names inside the one-minute edit. Show real outputs, not invented counters or altered screenshots.

## Ready-to-read voiceover

> Using historical benchmarks, NEXORA brings township energy, cost and carbon into one management view.
>
> Select Nexora Exchange. Its next-day forecast helps anticipate demand, with twenty-four percent lower error than a simple baseline in source-benchmark testing.
>
> Open a floor alert. Review the solution and projected money, energy and carbon impact before approving the local plan.
>
> The carbon dashboard recommends rooftop solar. Open Simulator loads the suggested settings automatically.
>
> Visualise the installation on the same building. Keep the recommendation or edit it manually, compare battery storage, and review projected grid reduction, investment cost and payback.
>
> Finally, download the carbon report and prepare an ESG evidence draft with calculation assumptions included.
>
> Forecast. Review. Plan.

Read at a conversational pace, allowing pauses for the popup and comparison numbers. Keep these words as an unobtrusive footer throughout: **Prototype · historical benchmark-derived profiles · projected impacts**.

## Numbers verified for the recording

The following were recalculated from the current local code and configuration. They are reproducible prototype figures, not a meter reconciliation, supplier quotation or real-world performance guarantee. If inputs change before recording, use the newly calculated screen values.

### Exchange history, forecast and model evaluation

| Item | Verified figure and meaning |
|---|---|
| Historical source | BDG2 v1.0, source building `Hog_office_Bill`; township profile multiplier **1.0**. The source is a public historical building benchmark, not Sime Darby operational data. |
| Selected 7-day history | **25–31 December 2017**, source-local **US/Central** time. **33,229.232 kWh**, displayed approximately **33,229.2 kWh**. |
| Next 24-hour forecast | **1 January 2018**, source-local hours. **5,361.661908 kWh**, displayed approximately **5,361.7 kWh**. The green forecast is a subsequent day on the timeline. |
| Estimated historical bill | **RM 16,614.616**, displayed **RM 16,614.62**, calculated using the configured flat **RM 0.50/kWh** assumption. |
| Electricity-linked historical carbon | **18,276.0776 kg CO₂e**, approximately **18.276 tCO₂e**, using the configured **0.55 kg CO₂e/kWh** assumption. |
| Source model MAE | **22.066947 kWh per hourly interval**, displayed **22.1**. A source-benchmark error metric; not the selected facility's measured real-world accuracy. |
| Source baseline MAE | **29.018915 kWh per hourly interval**, displayed **29.0**. Baseline uses the previous day's same-hour reading. |
| Improvement | **23.9567% lower MAE**, displayed **24.0%**. Formula: `(29.018915 − 22.066947) / 29.018915 × 100`. This is not “76% accuracy” or “24% energy savings.” |
| Held-out test samples | **3,524 hourly intervals** for this source benchmark. Do not describe this number as 3,524 township buildings or days. |
| Forecast method | Seasonal hour-of-week profile with a trailing-24-hour level correction, blended with the previous day's value; blend selected using validation data. Forecast evaluation uses prior observations at each origin. |
| Green shaded chart guide | Plus/minus the source model's historical test MAE, scaled with the selected profile and selected cost/carbon factor when applicable. It is not a calibrated 95% confidence or prediction interval. |

The price and emission factor above are editable **demo assumptions**, not verified current utility tariff or official local emission factors. Source timezone and dates must remain historical; changing them to today's Malaysian dates would misrepresent the source.

### Specific alert example

At audit time, Exchange still had an open **Level 4 / Meeting rooms / Cooling an unoccupied zone** alert. Its illustrative reduction is **1% of the next-day forecast**:

- Energy: `5,361.661908 × 1%` = **53.61661908 kWh**.
- Money: `53.61661908 × RM 0.50` = **RM 26.80830954**.
- Carbon: `53.61661908 × 0.55` = **29.489140494 kg CO₂e**.

Show the rounded popup figures: **RM 26.81 / 53.6 kWh / 29.5 kg CO₂e**. These are assumed projected savings for this individual alert. Existing settled alerts may make the overall approved-plan total larger. Approval updates and persists the demo plan; it does not send a BMS command or establish that the fault was physically corrected.

Other alert types use configured illustrative fractions rather than sensor-derived savings estimates. Floor temperatures, occupancy, room alerts and geometry are demonstration conditions. Present them as an investigation and approval workflow, not verified room telemetry or proof that the model diagnosed an HVAC fault.

### Solar recommendation and investment comparison

The current recommendation is deterministic forecast-informed sizing: target **20% of daily forecast demand**, constrained by estimated roof area. It is not a global optimisation over all technologies and budgets, and it is not generated by a Gemini conversation.

Shared design: **280 × 600 W panels = 168 kWp nameplate**, **south-facing**, **10° tilt**, **5% shading loss**, **84% performance ratio**, **72% roof utilisation**. The internal effective dispatch input is **134.064 kW** after the selected derates; do not relabel this as installed nameplate capacity.

| Projection | AI solar starting design | Manual solar + configured battery |
|---|---:|---:|
| Solar nameplate | 168 kWp | 168 kWp |
| Battery | Excluded | 250 kWh / 75 kW |
| Estimated CAPEX | **RM 708,624** | **RM 1,050,624** |
| Projected annual grid electricity avoided | **371,685.8 kWh** | **371,970.9 kWh** |
| Projected annual electricity cost difference | **RM 185,842.89** | **RM 185,985.46** |
| Projected annual electricity-linked carbon difference | **204.427 tCO₂e** | **204.584 tCO₂e** |
| Displayed payback | **About 4.1 years** | **About 6.3 years** |

The extra battery adds CAPEX while producing little additional energy-cost benefit in this particular flat-price, solar configuration. This makes a useful comparison of the two options. Do not describe solar as a proven universal optimum or promise demand-charge savings from this result.

These annual figures repeat the same forecast day's demand and sunny-day solar profile over 365 days. Financial assumptions include PV equipment **RM 3,700/kW**, battery **RM 1,200/kWh**, installation **14%**, OPEX **1.5% of CAPEX/year**, PV degradation **0.5%/year**, and discount rate **6%** for NPV. Payback is computed from projected annual cash flows after OPEX and PV degradation. Tax, financing, replacement and export credits are excluded. One-off depletion of initial battery charge is removed from annualised savings.

The comparison uses the original building forecast for both scenarios. A saved simulator scenario does not automatically become the carbon dashboard's approved operating plan. Do not imply the exported approved-plan report includes a saved solar scenario unless that specific linkage is added and verified. Do not manually add HVAC and solar savings together and claim a combined validated total.

## Every slide reviewed: role in the demo and claim limits

| Slide | Contents reviewed | Demo decision |
|---|---|---|
| **1 — Brand and team** | NEXORA identity, Victory, the five named team members. | Use the existing identity. Team introductions remain in the pitch; avoid spending the one-minute demo on names. |
| **2 — Problem** | Bill surprises / missing anomaly detection / penalty tariffs; rigid manual schedules / peak shifting / disconnected systems; uncertain green investment / payback; manual reporting / outdated data / unverifiable decarbonisation. | Show a visible response to each of the four groups. Penalty-tariff calculation, actual field savings and verified decarbonisation remain gaps. |
| **3 — Solution** | Central platform, available township energy data, electricity cost forecasting, automated optimisation, prioritised ROI, verified carbon reductions. | Demonstrate centralised views, forecast and projections. Use “human-approved planning” and “projected carbon impact” for the current stage. |
| **4 — How it works** | BMS / smart meters / solar inverters / IoT -> data/ML -> forecast -> building twin -> BEMS / renewable simulator -> lower costs, waste and carbon. | Follow that decision chain using the data currently available. Meter/BMS/inverter ingestion and physical control are the future pilot integration, not live connections proven by the demo. |
| **5 — Demo video** | Placeholder slide. | Embed the completed 60-second edit here. Give the audience a brief cue: “Here is one manager's workflow, using benchmark-derived prototype data.” |
| **6 — Four innovations** | Township energy intelligence; financial/carbon intelligence; renewable/retrofit simulator; 1:1 township digital twin. | Show all four. Current evidence supports a conceptual shared 3D model, energy-derived estimates, investment comparisons and approvals. A measured 1:1 survey, actual savings audit, time-of-use/solar-netting tariff engine, automated multi-asset ROI ranking and fully costed HVAC/lighting retrofit designs are not established. |
| **7 — Benefits and impact** | 30.7% bill savings; “25% tonnes” carbon figure; ~17 trees per tonne; GBI categories / points; 14.4% corporate tax reduction; external references. | Do not turn these into prototype results. “25% tonnes” mixes a percentage and a unit: clarify which was intended and its evidence before presenting. The app does not verify those fixed savings, planting equivalents, tax outcome or GBI award. Use scenario-specific projected figures with their assumptions. |
| **8 — Target user** | Developers, property owners, facility managers, campus operators; residents benefit through potential cost relief, comfort and greener living. | Frame the user as a township/facility manager. Show comfort-related alert review without claiming measured occupant outcomes. |
| **9 — Feasibility** | Forecasts and simulation using existing data; cost/payback evaluation; human supervision; automatic control only after validation; scale from a cluster. | This is the accurate framing for the current demo. Keep human approval prominent and financial results explicitly projected. |
| **10 — Implementation plan** | Months 1–2: BDG2 forecast / HVAC / peak / cost / anomaly / twin validation. Months 3–4: mall and commercial-building pilots. Months 5–6: wider assets, grid/resource coordination and township dashboard expansion. | Close on readiness for validation and pilots. The roadmap supports deferring actual sensor integration, live control and measured post-installation outcomes. Streetlight/shared-infrastructure control and cross-building resource coordination are not demonstrated today. |
| **11 — Appendix** | Appendix divider only. | No extra feature or evidence is supplied on this slide. Keep source and calculation notes available as backup. |

## Feature coverage and what belongs outside the minute

| Feature | Current implementation | Treatment |
|---|---|---|
| Six-facility township and shared building architecture | Available; illustrative site models and profile scaling. | Main video. |
| 24-hour / 7-day historical windows, future forecast, cost and carbon chart modes, CSV export | Available; historical benchmark-derived estimates. | Show 7-day plus forecast; keep chart mode changes / CSV in backup. |
| Historical forecast performance and a peak-shift scenario | Available; source model evaluation and a modelled shift. Total energy is conserved; flat pricing means shifting alone is not evidence of bill savings. | Main forecast shot and a short scenario insert. |
| Floor / zone inspection, alert solution, savings popup, approval and settled state | Available; room conditions and proposed impacts are illustrative. | Main video. |
| Carbon inventory view and approved-plan avoidance | Electricity-linked calculations; Scope 1 and 3 not assessed. End-use shares are assumptions, not separate meter measurements. | Main video; crop around the relevant cards and recommendation. |
| Carbon action -> prefilled simulator | Available, forecast/roof-informed solar starting design. | Main video: show the actual click. |
| AI recommendation / Edit manually | Available; manual starts from the same recommendation and retains a separate editable draft. | Main video. |
| Solar, BESS, EV; panel/battery settings; 3D Before/After and Energy flow | Current source includes calculations for all three technologies, including added EV demand and separately modelled charging revenue. These are simulations. | Solar and BESS in the main comparison. EV is a backup demonstration, not a reason to claim field-connected EV hardware. |
| Investment cases, CAPEX, OPEX, payback, ROI, NPV | Available, assumption-driven annual projections. | Hold CAPEX/payback in the main cut; details in backup. |
| Save, edit, duplicate, delete and compare up to three scenarios | Available in current handlers. | Pre-save two examples for the comparison shot. Recording does not need to show typing. |
| Installation partner profiles / support request / brief | Generic planning profiles and local request workflow; not proof of a contracted supplier or a completed external booking. | Backup only. |
| NEXORA Copilot / Gemini | Backend route and UI exist. Actual use depends on private backend configuration and successful provider responses; not verified in this read-only audit. | Optional backup only after testing. No AI answer should be fabricated or called live without a successful request. |
| Carbon PDF and ESG PDF | Separate five-page carbon and six-page ESG management drafts, with methods, assumptions, scope gaps and review register. | Main reporting shot. “Evidence reviewed” checkboxes do not verify supporting files or provide assurance. |
| Certification / incentive review | Evidence and preparation checklists. | Backup; no certification, compliance or tax eligibility claim. |

## Before recording

1. Use a desktop browser at 1920 × 1080, keep the existing orange/white UI and top navigation, and close distracting tabs and notifications.
2. Keep **Nexora Exchange** selected across every page. Set **7-day view** for history. Do not call a historical forecast “today's live forecast.”
3. Recheck that **Level 4 / Meeting rooms** is still open. Approve it only when recording the approval shot. Several alerts on other buildings were already settled at audit time. If someone has approved this one meanwhile, choose another pending alert and use its actual popup values.
4. Keep tariff, factor, equipment and financial assumptions consistent. The values in this plan are a reproducible example, not values to force into the UI after inputs change.
5. Prepare and save the two simulator scenarios for Exchange: **168 kWp Solar** and **168 kWp Solar + 250 kWh BESS / 75 kW**. Use Expected case for both. Compare only after each has calculated successfully.
6. Preserve a shot of the original solar recommendation before editing the manual copy. Show that manual starts with the same values; then show the battery difference.
7. Prepare the actual downloaded PDFs and use their real contents for the final report insert. Do not tick assurance or other evidence items merely to make the readiness ring appear complete.
8. Keep projected annual simulator impact separate from the selected historical inventory and next-24-hour approved-plan impact. These periods and bases are different.
9. Use large crops so the selected building, popup figures, model-error comparison and CAPEX/payback remain readable. Keep source dates and labels intact.
10. Capture a longer version first. Cut navigation waits, not evidence labels. If extra time is needed, remove the Energy flow insert and Copilot; retain the approval popup and financial comparison.

## Claim wording to use consistently

- **“Historical benchmark-derived township profiles”** instead of live smart-meter data.
- **“Conceptual township digital twin with shared building models”** instead of a measured 1:1 replica.
- **“24.0% lower MAE on the Exchange source benchmark”** instead of a general accuracy percentage.
- **“Illustrative alert and estimated next-24-hour impact”** instead of a sensor-confirmed fault or measured savings.
- **“Forecast-informed solar starting design”** instead of a proven best or globally optimised configuration.
- **“Projected grid reduction / payback under these assumptions”** instead of guaranteed electricity bill savings or a supplier investment promise.
- **“Carbon and ESG evidence drafts for review”** instead of audited ESG compliance, verified carbon reduction or certification.

## Evidence used for this plan

- Supplied PDF: all 11 slides, text and rendered visuals; slide 10 required visual reading because most of its content is embedded as an image.
- Current code: `backend/src/workbench.py`, `frontend/src/js/workbench.js`, `floor_conditions.js`, `carbon_dashboard.js`, `carbon_recommendation.js`, `simulator_settings.js`, `renewable_workspace.js`, `simulator_planning.js`, and `backend/src/report_documents.py`.
- Calculation evidence: `tmp/pdfs/pitch-review/prototype-evidence.json`, `exchange-state.json`, `preview-payloads.json`, `preview-results.json`, and `demo-scenario-results.json`. These are local read-only audit outputs, not recording assets or field measurements.
- Existing project notes were checked against current source; older README statements about unavailable EV simulation and process-only state are stale relative to the current handlers. This plan follows the current implementation.
