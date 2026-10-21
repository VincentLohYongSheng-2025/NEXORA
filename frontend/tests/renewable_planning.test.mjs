import test from 'node:test';
import assert from 'node:assert/strict';
import {pvDesign,simulatorTotals} from '../src/js/simulator_planning.js';
const d={solar:true,battery:true,ev:true,panel:'bifacial600',area:260,utilisation:100,orientation:'South',tilt:10,shade:0,ratio:100,selfUse:100,degradation:.5,pvCost:3000,batteryCost:1000,evCount:2,evUnitCost:8000,evPrice:1.2,installPercent:10,gridUpgrade:2000,opex:1,discount:6};
test('roof design responds to orientation, tilt and available solar with fixed panel footprint',()=>{
 const p=pvDesign(d);assert.equal(p.panels,100);assert.equal(p.nameplate,60);assert.equal(p.effective,60);
 assert.ok(pvDesign({...d,orientation:'North'}).effective<p.effective);
 assert.ok(pvDesign({...d,tilt:60}).effective<p.effective);
 assert.equal(pvDesign({...d,selfUse:50}).effective,30);
});
test('annual projection removes initial stored energy and keeps EV revenue distinct from bill savings',()=>{
 const p={forecast_energy_kwh:1100,building_energy_kwh:1000,ev_energy_kwh:100,simulated_grid_kwh:800,initial_stored_kwh:100,ending_stored_kwh:0,items:[{direct_solar_kwh:200,discharge_kwh:100}]};
 const c={tariff_myr_per_kwh:.5,carbon_kg_per_kwh:.55,battery_kwh:200};
 const m=simulatorTotals(p,c,d);assert.equal(m.grid,895);assert.equal(m.battery,5);
 assert.equal(m.annualEnergy,105*365);assert.equal(m.annualEV,36500);assert.equal(m.evRevenue,36500*1.2);
 assert.equal(m.annualCost,105*365*.5);assert.ok(simulatorTotals(p,c,d,'optimistic').net>m.net);
 assert.equal(simulatorTotals(p,{...c,tariff_myr_per_kwh:null,carbon_kg_per_kwh:null},d).npv,null);
});
