export const PANEL_MODELS=[
  {id:'mono615',name:'High-Efficiency Mono 615 W',watts:615,ratio:82,cost:3400},
  {id:'bifacial600',name:'Bifacial Mono 600 W',watts:600,ratio:84,cost:3700},
  {id:'mono550',name:'Standard Mono 550 W',watts:550,ratio:79,cost:2900},
];
export const BATTERY_MODELS=[
  {id:'lfp500',name:'LFP Cabinet 250 kW / 500 kWh',capacity:500,power:250,cost:1200},
  {id:'lfp250',name:'LFP Cabinet 125 kW / 250 kWh',capacity:250,power:125,cost:1300},
  {id:'lfp100',name:'LFP Cabinet 50 kW / 100 kWh',capacity:100,power:50,cost:1450},
];
export function pvDesign(d){
  const model=PANEL_MODELS.find(m=>m.id===d.panel)||PANEL_MODELS[1];
  const panels=Math.floor(d.area*d.utilisation/100/2.6),nameplate=panels*model.watts/1000;
  const orientation={South:1,'South-east':.99,'South-west':.99,East:.94,West:.94,North:.96}[d.orientation]??1;
  const tilt=Math.max(.6,1-Math.abs(d.tilt-10)*.003);
  return {panels,nameplate,effective:nameplate*d.ratio/100*(1-d.shade/100)*orientation*tilt*d.selfUse/100};
}
export function simulatorTotals(p,c,d,caseName='expected'){
  if(!p)return null;
  // Annual projections remove the one-off credit from depleting initial charge.
  const credit=Math.max(0,(p.initial_stored_kwh||0)-(p.ending_stored_kwh||0))*.95;
  const direct=p.items.reduce((s,r)=>s+r.direct_solar_kwh,0),battery=Math.max(0,p.items.reduce((s,r)=>s+r.discharge_kwh,0)-credit);
  const grid=p.simulated_grid_kwh+credit,baseline=p.building_energy_kwh??p.forecast_energy_kwh,avoided=baseline-grid;
  const annualEnergy=avoided*365,annualCost=c.tariff_myr_per_kwh==null?null:annualEnergy*c.tariff_myr_per_kwh;
  const annualCarbon=c.carbon_kg_per_kwh==null?null:annualEnergy*c.carbon_kg_per_kwh/1000;
  const equipment=(d.solar?pvDesign(d).nameplate*d.pvCost:0)+(d.battery?c.battery_kwh*d.batteryCost:0)+(d.ev?d.evCount*d.evUnitCost:0);
  const install=equipment*d.installPercent/100,capex=equipment+install+d.gridUpgrade,opex=capex*d.opex/100;
  const evRevenue=(p.ev_energy_kwh||0)*365*d.evPrice,factor={conservative:.8,expected:1,optimistic:1.2}[caseName]||1;
  const solarAndStorageBenefit=c.tariff_myr_per_kwh==null?null:(annualEnergy+(p.ev_energy_kwh||0)*365)*c.tariff_myr_per_kwh;
  const evElectricityCost=c.tariff_myr_per_kwh==null?null:(p.ev_energy_kwh||0)*365*c.tariff_myr_per_kwh;
  const cash=Array.from({length:20},(_,i)=>annualCost==null?null:(solarAndStorageBenefit*(1-(d.solar?d.degradation:0)/100)**i-evElectricityCost+evRevenue)*factor-opex);
  let cumulative=0,payback=null;
  cash.forEach((value,i)=>{if(value==null||payback!=null)return;const before=cumulative;cumulative+=value;if(cumulative>=capex&&value>0)payback=i+(capex-before)/value;});
  return {grid,direct,battery,total:p.forecast_energy_kwh,baseline,annualEnergy,annualCost,annualCarbon,
    reduction:baseline?avoided/baseline*100:0,annualEV:(p.ev_energy_kwh||0)*365,
    contribution:p.forecast_energy_kwh?(direct+battery)/p.forecast_energy_kwh*100:0,
    equipment,install,capex,opex,evRevenue,net:cash[0],payback,
    roi:cash[0]==null?null:(cash.slice(0,10).reduce((a,b)=>a+b,0)-capex)/Math.max(capex,1)*100,
    npv:cash[0]==null?null:cash.reduce((s,v,i)=>s+v/(1+d.discount/100)**(i+1),0)-capex};
}
