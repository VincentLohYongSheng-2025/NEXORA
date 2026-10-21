import assert from 'node:assert/strict';
import test from 'node:test';
import {estimateImpact,filterDetectedPatterns,loadPreferences,resetPreferences,savePreferences} from '../src/js/demo_preferences.js';

function storage(){const values=new Map();return {getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)};}

test('cost and carbon remain unavailable until each required user assumption is disclosed',()=>{
  assert.equal(estimateImpact(100,{}).cost,null);
  assert.match(estimateImpact(100,{currency_code:'MYR',tariff_myr_per_kwh:.5}).errors.join(' '),/tariff source/);
  const result=estimateImpact(100,{currency_code:'MYR',tariff_myr_per_kwh:.5,tariff_source:'User assumption',carbon_kg_per_kwh:.4,carbon_source:'User assumption'});
  assert.equal(result.cost,50);assert.equal(result.carbon,40);assert.deepEqual(result.errors,[]);
});

test('preferences save, load and reset only browser-local values',()=>{
  const local=storage();const saved=savePreferences({aiPanelVisible:false,notificationBadges:false,anomalyDisplay:'large',assistantMode:'advisory_demo',refreshPreview:'1m',scenarioSuggestions:true,emailDigestPreview:true,webhookPreview:true,benchmarkOverlay:true},local);
  assert.deepEqual(saved.errors,[]);const loaded=loadPreferences(local);assert.equal(loaded.aiPanelVisible,false);assert.equal(loaded.anomalyDisplay,'large');assert.equal(loaded.assistantMode,'advisory_demo');assert.equal(loaded.refreshPreview,'1m');assert.equal(loaded.emailDigestPreview,true);assert.equal(loaded.webhookPreview,true);assert.equal(loaded.benchmarkOverlay,true);
  resetPreferences(local);const reset=loadPreferences(local);assert.equal(reset.aiPanelVisible,true);assert.equal(reset.tariff_myr_per_kwh,null);assert.equal(reset.assistantMode,'on_demand');assert.equal(reset.refreshPreview,'30s');assert.equal(reset.webhookPreview,false);
});

test('invalid local demo choices fall back to safe read-only defaults',()=>{
  const local=storage();local.setItem('ENERGIOS_DEMO_PREFERENCES',JSON.stringify({assistantMode:'autonomous',refreshPreview:'continuous'}));
  const loaded=loadPreferences(local);assert.equal(loaded.assistantMode,'on_demand');assert.equal(loaded.refreshPreview,'30s');
});

test('local anomaly sensitivity only filters already detected patterns',()=>{
  const items=[{forecast_kwh:100,residual_kwh:10},{forecast_kwh:100,residual_kwh:30},{forecast_kwh:100,residual_kwh:60}];
  assert.equal(filterDetectedPatterns(items,'all').length,3);assert.equal(filterDetectedPatterns(items,'medium').length,2);assert.equal(filterDetectedPatterns(items,'large').length,1);
});
