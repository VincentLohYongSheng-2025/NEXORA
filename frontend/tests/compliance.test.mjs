import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = async (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('methodology visibly cites BDG2, its paper, licence, scope, and missing-data rule', async () => {
  const methodology = await read('../methodology.html');
  assert.match(methodology, /Building Data Genome Project 2 v1\.0/);
  assert.match(methodology, /https:\/\/doi\.org\/10\.5281\/zenodo\.3887306/);
  assert.match(methodology, /https:\/\/doi\.org\/10\.1038\/s41597-020-00712-x/);
  assert.match(methodology, /CC BY 4\.0/);
  assert.match(methodology, /This is public benchmark data and is not Sime Darby Property operational data\./);
  assert.match(methodology, /Missing source readings remain missing and are not replaced with synthetic observations\./);
});

test('persistent disclosure and all six classifications are present', async () => {
  const classifications = await read('../src/js/data_classification.js');
  const methodology = await read('../methodology.html');
  assert.match(classifications, /Demo uses BDG2 public benchmark data and clearly labelled simulations\./);
  assert.match(classifications, /It does not use Sime Darby Property operational data\./);
  for (const label of [
    'Observed public benchmark data',
    'Calculated forecast',
    'Detected unusual consumption pattern',
    'Derived benchmark comparison',
    'Simulated assumption',
    'Illustrative visual',
  ]) assert.match(methodology, new RegExp(label));
});

test('simulation and portfolio outputs carry explicit non-measured labels', async () => {
  const energy = await read('../src/js/energy_simulator.js');
  const portfolio = await read('../src/js/portfolio_view.js');
  assert.match(energy, /Simulated demonstration assumption/);
  assert.match(energy, /Calculated from observed BDG2 data and simulation assumptions/);
  assert.match(energy, /No live control action is performed/);
  assert.match(energy, /Illustrative estimate based on user-entered tariff/);
  assert.match(energy, /microgrid-assumption-summary/);
  assert.match(energy, /classificationBadge\('simulated', 'Simulated demonstration assumption'\)/);
  assert.match(portfolio, /Illustrative portfolio view — not a measured digital twin/);
  assert.match(portfolio, /Illustrative visual — not measured spatial data/);
  assert.doesNotMatch(energy, /Observed (solar|battery|tariff)/i);
  assert.match(portfolio, /do not represent Sime Darby assets/i);
  assert.match(portfolio, /not measured (geometry|spatial data)/i);
});

test('empty anomaly wording is honest and avoids unsupported cause claims', async () => {
  const dashboard = await read('../src/js/velora_app.js');
  const energy = await read('../src/js/energy_simulator.js');
  const required = 'No unusual consumption patterns were detected for this asset and selected period.';
  assert.match(dashboard, new RegExp(required.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(energy, new RegExp(required.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(dashboard, /not proof that the building has no inefficiency/i);
  assert.match(energy, /do not establish HVAC, lighting, ghost-load, equipment, waste, or other causes/i);
});


test('restored screens retain teammate components and never load full-page scope gates or static operational data', async()=>{
  for(const name of ['index','diagnostics','energy','digital-twin','settings']){
    const html=await read(`../${name}.html`);
    assert.match(html,/velora-sidebar/);
    assert.match(html,/id="dynamic-island"/);
    assert.match(html,/src\/js\/shell.js/);
    assert.doesNotMatch(html,/src\/js\/scope_guard.js|src\/data\/bdg2_data.js|src\/data\/township_data.js/);
    assert.doesNotMatch(html,/>100% Monitored<|>BDG2 SCADA Active<|RM 13,210\.08/);
  }
});

test('AI panel provides no fake conversation, agent actions or browser provider key', async()=>{
  const ai=await read('../src/js/dynamic_island.js');
  const shell=await read('../src/js/shell.js');
  assert.doesNotMatch(ai,/fetch\(|apiKey|GEMINI_API_KEY|Optimized whole-building/);
  assert.match(ai,/apiClient.post\('\/demo\/assistant\/chat'/);
  assert.match(ai,/AI unavailable/);
  assert.match(ai,/No tools, settings changes or equipment control/);
  assert.doesNotMatch(ai,/innerHTML/);
  assert.doesNotMatch(shell,/No agent activity/);
});

test('peer comparison, export and Green CFO flows preserve sources and claim boundaries', async()=>{
  const dashboard=await read('../src/js/velora_app.js');
  const peer=await read('../src/js/digital_twin_app.js');
  const settings=await read('../src/js/settings.js');
  const settingsHtml=await read('../settings.html');
  assert.match(dashboard,/EnergiOS labelled evidence export/);
  assert.match(dashboard,/https:\/\/doi\.org\/10\.5281\/zenodo\.3887306/);
  assert.match(dashboard,/This is not Sime Darby or Elmina telemetry/);
  assert.match(peer,/Derived comparison/);
  assert.match(peer,/candidate for investigation only/);
  assert.match(peer,/not confirmed ghost load, waste or a fault/);
  assert.match(settings,/\/demo\/investment-comparison/);
  assert.match(settings,/Not calculated/);
  assert.match(settingsHtml,/Illustrative scenario ranking/);
  assert.match(settingsHtml,/Assumption source/);
  assert.match(settingsHtml,/Missing inputs remain “Not calculated”/);
});

test('daily and monthly dashboard controls use observed bounded history with coverage labels', async()=>{
  const dashboard=await read('../index.html');
  const app=await read('../src/js/velora_app.js');
  assert.doesNotMatch(dashboard,/Daily and monthly views are unavailable/);
  assert.doesNotMatch(dashboard,/cursor-not-allowed[^>]*data-timeframe="(?:Daily|Monthly)"/);
  assert.match(dashboard,/Latest 31 source-local calendar days/);
  assert.match(dashboard,/Latest 12 source-local calendar months/);
  assert.match(app,/getObservedHistory/);
  assert.match(app,/complete_total_kwh/);
  assert.match(app,/Partial sums are labelled in tooltips; missing intervals are not filled/);
  assert.match(app,/label!=='observed'/);
});

test('township drawer exposes labelled local HVAC and floor simulations without control claims', async()=>{
  const app=await read('../src/js/digital_twin_app.js');
  const simulation=await read('../src/js/digital_twin_simulation.js');
  assert.match(app,/role="tablist"/);
  assert.match(app,/HVAC simulation/);
  assert.match(app,/Floor simulation/);
  assert.doesNotMatch(app,/<button class="velora-pill" disabled>HVAC<\/button>/);
  assert.doesNotMatch(app,/<button class="velora-pill" disabled>Floor controls<\/button>/);
  assert.match(app,/Observed BDG2/);
  assert.match(app,/Simulated demonstration assumption/);
  assert.match(app,/No BMS\/SCADA connection, equipment command, fault diagnosis or measured HVAC value is available/);
  assert.match(app,/not BDG2 floor meters, actual plans or measured floor consumption/);
  assert.match(app,/No external factor is used/);
  assert.match(simulation,/label: 'simulated'/);
  assert.doesNotMatch(simulation,/fetch\(|apiClient|savings|fault|cause/);
});

test('2D portfolio uses observed comparison data and makes the absence of CAD explicit', async()=>{
  const app=await read('../src/js/digital_twin_app.js');
  const html=await read('../digital-twin.html');
  const css=await read('../src/css/demo.css');
  assert.match(app,/2D benchmark portfolio/);
  assert.match(app,/No CAD or floorplan data is connected/);
  assert.match(app,/matching observed BDG2 intervals/);
  assert.match(app,/selectPortfolioBuilding/);
  assert.match(app,/township-metrics-overlay/);
  assert.doesNotMatch(app,/assets\/spatial\/floorplan\.svg/);
  assert.match(html,/id="township-scene-controls"/);
  assert.match(html,/2D Portfolio/);
  assert.match(css,/\.portfolio-map-workspace/);
  assert.match(css,/\.portfolio-map-grid/);
});

test('diagnostics keeps the selected subsystem aligned with its rendered panel', async () => {
  const app = await read('../src/js/diagnostics_app.js');
  assert.match(app, /subsystem:this\.state\.subsystem\|\|'whole'/);
  assert.match(app, /button\.id===`diag-tab-\$\{kind\}`/);
});

test('system preferences remain clickable browser-local previews without operational claims', async()=>{
  const app=await read('../src/js/settings.js');
  const preferences=await read('../src/js/demo_preferences.js');
  const html=await read('../settings.html');
  assert.doesNotMatch(app,/n\.disabled=true/);
  assert.match(app,/No email will be sent/);
  assert.match(app,/No webhook, BACnet, or MQTT request will be sent/);
  assert.match(app,/The assistant remains read-only/);
  assert.match(preferences,/assistantMode/);
  assert.match(preferences,/refreshPreview/);
  assert.match(html,/Advisory demo/);
  assert.match(html,/Local preference; no email is sent/);
  assert.match(html,/Local preview; no BACnet\/MQTT dispatch/);
  assert.match(html,/not a certified rating or GBI benchmark/);
  assert.match(app,/Applied local demo preferences/);
  assert.match(app,/Preview cards shown/);
  assert.match(app,/No BACnet, MQTT, BMS, or SCADA request is sent/);
});

test('exclusive Settings choices use one active selection and radio semantics', async()=>{
  const settings=await read('../settings.html');
  const app=await read('../src/js/settings.js');
  const theme=await read('../src/js/theme.js');
  assert.doesNotMatch(settings,/active bg-white text=\[#1E2022\] shadow-xs font-semibold/);
  assert.match(settings,/role="radiogroup" aria-label="Assistant response mode"/);
  assert.match(settings,/role="radiogroup" aria-label="Dashboard refresh preview"/);
  assert.match(settings,/role="radiogroup" aria-label="Detected-pattern display threshold"/);
  assert.match(app,/button\.setAttribute\('aria-checked',String\(selected\)\)/);
  assert.match(theme,/btn\.setAttribute\('aria-checked', String\(isSelected\)\)/);
});
