import assert from 'node:assert/strict';
import test from 'node:test';
import {allocationFromObserved,resetScenarioProfile,saveScenarioProfile,scenarioStorageKey,validateScenarioAssumptions} from '../src/js/scenario_profile.js';

function storage(){const values=new Map();return {getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key),values};}
function profile(){return {asset_id:'asset-1',assumptions:{load_allocations_percent:{hvac:45,lighting:18,it_plug:27,other:10},hvac:{chiller_share_percent:60,ahu_share_percent:25,other_hvac_percent:15},floors:[{allocation_percent:34},{allocation_percent:33},{allocation_percent:33}],impact:{tariff_myr_per_kwh:.5,carbon_kg_per_kwh:.55}}};}

test('scenario profile validation requires all editable allocations to reconcile',()=>{
 assert.deepEqual(validateScenarioAssumptions(profile().assumptions),[]);
 const broken=profile();broken.assumptions.load_allocations_percent.other=11;
 assert.match(validateScenarioAssumptions(broken.assumptions).join(' '),/total 100%/);
});

test('observed allocation is deterministic and energy-balanced',()=>{
 const result=allocationFromObserved(200,profile().assumptions.load_allocations_percent);
 assert.deepEqual(result,{hvac:90,lighting:36,it_plug:54,other:20});
 assert.equal(Object.values(result).reduce((a,b)=>a+b,0),200);
});

test('per-building edits persist and reset without changing backend data',()=>{
 const local=storage(),value=profile();
 assert.deepEqual(saveScenarioProfile(value,local).errors,[]);
 assert.ok(local.getItem(scenarioStorageKey('asset-1')).includes('tariff_myr_per_kwh'));
 resetScenarioProfile('asset-1',local);assert.equal(local.getItem(scenarioStorageKey('asset-1')),null);
});
