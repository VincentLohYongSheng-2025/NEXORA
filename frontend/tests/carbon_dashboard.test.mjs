import test from 'node:test';
import assert from 'node:assert/strict';
import { carbonModel, reportURL } from '../src/js/carbon_dashboard.js';

const data={asset:{floor_area_m2:1000},config:{carbon_kg_per_kwh:.55},observed:Array(168).fill({consumption_kwh:10}),metrics:{observed_energy_kwh:1680,observed_carbon_estimate_kg:924,forecast_energy_kwh:300,projected_avoided_carbon_kg:33}};
const settings={target:20,tree:22,checks:{energy:true,factor:true}};
test('carbon and ESG buttons request distinct PDFs and carry individual evidence reviews',()=>{
  const state={assetId:'building',period:'week'};
  const carbon=new URL(reportURL(state,settings),'http://localhost');
  const esg=new URL(reportURL(state,settings,'esg'),'http://localhost');
  assert.equal(carbon.searchParams.get('report_type'),'carbon');
  assert.equal(esg.searchParams.get('report_type'),'esg');
  assert.equal(esg.searchParams.get('reviewed_items'),'energy,factor');
  assert.equal(esg.searchParams.get('asset_id'),'building');
  assert.equal(esg.searchParams.get('period'),'week');
});
test('load allocation reconciles to the whole building and retains the selected history window',()=>{
  const all=carbonModel(data,'week',settings,'all'),hvac=carbonModel(data,'week',settings,'hvac');
  assert.equal(all.days,7);
  assert.equal(all.allocation.reduce((sum,row)=>sum+row.pct,0),100);
  assert.ok(Math.abs(all.allocation.reduce((sum,row)=>sum+row.kg,0)-all.emissions)<1e-9);
  assert.equal(hvac.energy,all.energy*.48);
  assert.ok(Math.abs(hvac.annualBei-87.6*.48)<1e-9);
  assert.equal(all.readiness,33);
});
test('next-day avoidance is not multiplied by the historical week and missing factors stay unavailable',()=>{
  assert.equal(carbonModel(data,'week',settings).trees,1.5);
  const missing=carbonModel({...data,config:{carbon_kg_per_kwh:null}},'week',settings);
  assert.equal(missing.emissions,null);
  assert.equal(missing.trees,null);
  assert.equal(missing.annualBei,87.6);
});
