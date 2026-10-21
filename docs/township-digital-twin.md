# Township digital twin

Overview now starts with a Three.js township masterplan. The scene contains six separately modelled architectural concepts: Nexora Galleria (shopping mall), Nexora Medical Centre (hospital), The Garden Kitchen (restaurant), Nexora Exchange (commercial), Nexora Residences (residential), and Nexora Solar Park (solar farm).

Select a model, its floating map label, or its facility directory button. A camera animation approaches that facility, followed by a detailed 3D model and the existing KPI, energy trend and action workspace. The “Back to township” buttons return to the masterplan by reversing the entry camera path over the same 950 ms duration. The previously selected township camera angle, pan and zoom are restored; the scene does not crossfade. Orbit, zoom, reset and day/night controls are available; animation respects reduced motion. The selected architecture carries into the Digital Twin and AI Control model views during the current page session.

The models are illustrative. They do not establish new measured sites, floor geometry, equipment telemetry, alerts or physical control. The four original BDG2 benchmarks remain separately selectable. Each township facility now has its own demo asset identity, configuration, approved plan and results, based on a documented historical source profile and illustrative multiplier. These multipliers are demo inputs, not calibrated estimates of these facility types.

The energy, electricity cost and CO2e KPI row appears above both the township and selected-building 3D views. Township totals sum all six facility profiles for the selected day/week; selected-building cards use only that facility. The same facility state supplies its charts, simulations, controls and report export. Returning to the township restores the combined scope. Cost and carbon are summed after applying each facility's own tariff/factor; a missing input produces an unavailable total rather than an incomplete subtotal.

Version `nexora-township-v1` inputs:

| Facility | Historical source | Load multiplier |
| --- | --- | --- |
| Shopping mall | Hog_assembly_Dona | 1.4 |
| Hospital | Hog_lodging_Francisco | 1.65 |
| Restaurant | Hog_assembly_Dona | 0.12 |
| Commercial | Hog_office_Bill | 1.0 |
| Residential | Hog_lodging_Francisco | 0.85 |
| Solar farm | Hog_office_Bill | 0.015 |

Profile energy = source interval kWh × multiplier. The solar farm profile represents auxiliary consumption, not solar generation. Source timestamps and timezone remain historical (25–31 December 2017, US/Central); no current or Malaysian operational measurements are claimed. Source benchmark model evaluation remains labeled separately from facility results. The calculation basis is expandable below the township.

Implementation: `frontend/src/js/spatial_twin.js`, integrated with `workbench.js`, styled by `spatial_twin.css`. The additive `/api/workbench/township` endpoint calculates scope totals, and facility demo identities reuse the existing calculation and plan logic. Original benchmark profiles and trained model results are preserved. Static geometry is batched by material and picking identity; shadows are calculated once, and the renderer pauses when idle. Rendering resources, WebGL contexts and event handlers are disposed when changing views.

Browser verification: all six named map selections opened the corresponding facility heading, model and energy chart; direct hospital mesh selection also opened the hospital view. The selected office Bill benchmark survived selection and return. Mobile township and hospital detail layouts were inspected at 390 px without horizontal overflow; mobile selection worked. Desktop framing was inspected at 1440 px. Day/night mode was exercised, and no browser runtime errors were reported during the six-facility journey. JavaScript syntax checks and the Vite build passed. No commit, push or deployment was performed.

After the rendering optimization, the hospital transition and cross-page model state were checked again. The seven-day office Bill result displayed 33,229 kWh, and Digital Twin retained both office Bill and Last 7 days while displaying the selected hospital concept. A 768 px tablet check also reported no horizontal overflow.

KPI scope verification (21 October 2026): five township backend tests and five existing workbench tests passed. These cover day/week sums, distinct facility results, independent configuration and approvals, dismissal preserving the plan, missing inputs, original snapshot preservation, API responses and demo report export. A DOM interaction check using real backend fixtures passed all six facility selections, both return controls, day/week changes, KPI placement and cross-page building context. JavaScript syntax validation and Vite production build passed; the existing large Three.js bundle warning remains. The new KPI changes have not been visually rechecked in a real browser.

Reverse camera verification: eight deterministic checks using the actual Three.js camera and geometry passed. All six facilities retrace their entry camera positions and targets at the start, midpoint and end. Direct selection restores full mobile framing, reduced motion skips the travel, and controls/labels are enabled again after completion. These checks use a render sink rather than a GPU and do not claim browser visual verification.
