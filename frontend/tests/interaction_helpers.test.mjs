import test from 'node:test';
import assert from 'node:assert/strict';
import {filterAssetsForSearch,buildEnergyScenarioExport} from '../src/js/interaction_helpers.js';

const assets=[
  {id:'a',source_asset_id:'Hog_office_Bill',name:'Hog office Bill',primary_space_usage:'Office',timezone:'US/Central',provenance:{source_code:'bdg2_v1'}},
  {id:'b',source_asset_id:'Hog_education_Donnie',name:'Hog education Donnie',primary_space_usage:'Education',timezone:'US/Central',provenance:{source_code:'bdg2_v1'}},
];

test('asset search matches identifiers and usage without inventing results',()=>{
  assert.deepEqual(filterAssetsForSearch(assets,'office').map(asset=>asset.id),['a']);
  assert.deepEqual(filterAssetsForSearch(assets,'education').map(asset=>asset.id),['b']);
  assert.deepEqual(filterAssetsForSearch(assets,'missing'),[]);
});

test('scenario export preserves explicit classifications, source and limitations',()=>{
  const forecast={items:[{timestamp:'2018-01-01T00:00:00Z',forecast_kwh:1}]};
  const anomalies={items:[],count:0};
  const microgrid={items:[{timestamp:'2018-01-01T00:00:00Z',grid_kwh:1}],assumptions:{solar_capacity_kw:1}};
  const peakShift={items:[{timestamp:'2018-01-01T00:00:00Z',before_kwh:1,after_kwh:1}],assumptions:{flexible_load_kwh:0}};
  const payload=buildEnergyScenarioExport(assets[0],forecast,anomalies,microgrid,peakShift);
  assert.equal(payload.asset.provenance.source_code,'bdg2_v1');
  assert.equal(payload.classifications.forecast,'calculated_output');
  assert.equal(payload.classifications.microgrid,'simulated_user_assumptions');
  assert.match(payload.limitations.join(' '),/not Sime Darby Property/);
  assert.match(payload.citation.doi,/zenodo\.3887306/);
});

test('scenario export refuses incomplete results',()=>{
  assert.throws(()=>buildEnergyScenarioExport(assets[0],{items:[]},{items:[]},null,null),/Complete selected-building/);
});
