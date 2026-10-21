import test from 'node:test';
import assert from 'node:assert/strict';
import {carbonSolarRecommendation} from '../src/js/carbon_recommendation.js';
import {pvDesign} from '../src/js/simulator_planning.js';

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
