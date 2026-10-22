import test from 'node:test';
import assert from 'node:assert/strict';
import {carbonSolarRecommendation} from '../src/js/carbon_recommendation.js';
import {pvDesign} from '../src/js/simulator_planning.js';
import {recommendedSettings,ensureSimulatorSettings,setSimulatorSettingsMode} from '../src/js/simulator_settings.js';
import {simulatorPage,simulatorUI} from '../src/js/renewable_workspace.js';

test('settings tabs render a locked recommendation and enable the identical manual form',()=>{
  const state=fixture();state.assetId='render-fixture';state.data.asset.id='render-fixture';
  let html=simulatorPage(state,{heading:()=>''});
  assert.match(html,/role="tablist" aria-label="Configuration mode"/);
  assert.match(html,/data-renew-setting="tilt"[^>]*disabled/);
  assert.match(html,/data-renew-toggle="battery" disabled/);
  setSimulatorSettingsMode(state,simulatorUI,'manual');
  html=simulatorPage(state,{heading:()=>''});
  assert.doesNotMatch(html,/data-renew-setting="tilt"[^>]*disabled/);
  assert.match(html,/data-renew-setting="tilt"[^>]*value="10"/);
  delete simulatorUI.settings['render-fixture'];delete simulatorUI.designs['render-fixture'];
});

const fixture=()=>({assetId:'hospital',data:{asset:{id:'hospital',facility_id:'hospital',floor_area_m2:1000},metrics:{forecast_energy_kwh:10000},config:{pv_kw:100,battery_kwh:250,battery_power_kw:125,starting_soc_percent:50,tariff_myr_per_kwh:.5,carbon_kg_per_kwh:.55}}});

test('recommended simulator settings reproduce the carbon suggestion and include all equipment and financial defaults',()=>{
  const state=fixture(),settings=recommendedSettings(state.data),suggestion=carbonSolarRecommendation(state.data);
  assert.deepEqual(pvDesign(settings.design),pvDesign(suggestion.design));
  assert.equal(settings.config.pv_kw,Number(suggestion.effective.toFixed(3)));
  assert.equal(settings.technology,'pv');
  assert.equal(settings.design.battery,false);
  assert.equal(settings.design.ev,false);
  for(const key of ['evPower','batteryModel','installPercent','discount','opex'])assert.notEqual(settings.design[key],undefined);
});

test('manual starts identical to AI and edits and results survive switching without changing the recommendation',()=>{
  const state=fixture(),ui={designs:{}};
  const entry=ensureSimulatorSettings(state,ui),original=structuredClone(entry.ai);
  setSimulatorSettingsMode(state,ui,'manual');
  assert.deepEqual(ui.designs.hospital,original.design);
  assert.deepEqual(state.scenarioDraft,original.config);
  ui.designs.hospital.tilt=25;ui.designs.hospital.battery=true;
  state.scenarioDraft.battery_kwh=500;
  state.preview={simulated_grid_kwh:12};
  setSimulatorSettingsMode(state,ui,'ai');
  assert.deepEqual(ui.designs.hospital,original.design);
  assert.deepEqual(state.scenarioDraft,original.config);
  assert.equal(state.preview,null);
  setSimulatorSettingsMode(state,ui,'manual');
  assert.equal(ui.designs.hospital.tilt,25);
  assert.equal(ui.designs.hospital.battery,true);
  assert.equal(state.scenarioDraft.battery_kwh,500);
  assert.deepEqual(state.preview,{simulated_grid_kwh:12});
});

test('recommendations recalculate for new demand and isolate manual drafts between buildings',()=>{
  const state=fixture(),ui={designs:{}};
  setSimulatorSettingsMode(state,ui,'manual');
  ui.designs.hospital.tilt=23;
  setSimulatorSettingsMode(state,ui,'ai');
  const originalPanels=pvDesign(ui.designs.hospital).panels;
  state.data={...state.data,metrics:{forecast_energy_kwh:100}};
  ensureSimulatorSettings(state,ui);
  assert.ok(pvDesign(ui.designs.hospital).panels<originalPanels);
  state.assetId='mall';state.data={...state.data,asset:{id:'mall',facility_id:'mall',floor_area_m2:5000}};
  ensureSimulatorSettings(state,ui);
  assert.equal(ui.designs.mall.tilt,10);
  assert.equal(ui.settings.hospital.manual.design.tilt,23);
  setSimulatorSettingsMode(state,ui,'manual');
  ui.designs.mall.tilt=30;state.scenarioDraft.battery_kwh=800;
  state.assetId='hospital';state.data=fixture().data;
  ensureSimulatorSettings(state,ui);
  assert.equal(ui.settings.mall.manual.design.tilt,30);
  assert.equal(ui.settings.mall.manual.config.battery_kwh,800);
});

test('solar suggestion respects building roof space and transfers a reproducible solar-only design',()=>{
  const building={asset:{id:'hospital',facility_id:'hospital',floor_area_m2:1000},metrics:{forecast_energy_kwh:10000}};
  const suggestion=carbonSolarRecommendation(building);
  assert.equal(suggestion.assetId,'hospital');
  assert.equal(suggestion.panels,46);
  assert.equal(suggestion.nameplate,27.6);
  assert.equal(suggestion.design.solar,true);
  assert.equal(suggestion.design.battery,false);
  assert.equal(suggestion.design.ev,false);
  assert.deepEqual(pvDesign(suggestion.design),{panels:suggestion.panels,nameplate:suggestion.nameplate,effective:suggestion.effective});
  const smaller=carbonSolarRecommendation({...building,metrics:{forecast_energy_kwh:300}});
  assert.ok(smaller.panels<suggestion.panels);
  assert.ok(smaller.effective*7.595754>=60);
});
