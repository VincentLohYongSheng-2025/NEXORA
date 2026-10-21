import {pvDesign} from './simulator_planning.js?v=renewable-workspace-26';

// A starting design targeting 20% of forecast daily demand, bounded by estimated roof space.
export function carbonSolarRecommendation(data){
  const floors={mall:3,hospital:5,restaurant:1,commercial:11,residential:7,solar:1};
  const demand=Math.max(0,Number(data.metrics.forecast_energy_kwh)||0);
  const targetPanels=Math.max(1,Math.ceil(demand*.2/(7.595754*.6*.84*.95)));
  const roof=Number(data.asset.floor_area_m2)/(floors[data.asset.facility_id]||1);
  const roofLimit=roof>0?Math.max(1,Math.floor(roof*.6/2.6)):targetPanels;
  const panels=Math.min(targetPanels,roofLimit);
  const design={solar:true,battery:false,ev:false,area:Math.ceil(panels*2.6/.72),utilisation:72,
    panel:'bifacial600',orientation:'South',tilt:10,shade:5,ratio:84,degradation:.5,selfUse:100,pvCost:3700};
  const pv=pvDesign(design);
  return {assetId:data.asset.id,name:'Carbon action · Rooftop solar',design,...pv};
}
