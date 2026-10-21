/** Populate Norman's energy/storage cards exclusively from labelled backend simulations. */
import {chart,stamp,imageFor} from './screen_common.js';
export function clearDesignedEnergy(){
 for(const id of ['gauge-percent','metric-current-power','metric-duration','metric-capacity','flow-val-solar','flow-val-battery','flow-val-home','flow-val-grid']){const node=document.getElementById(id);if(node)node.textContent='Not calculated';}
 for(const id of ['battery-level-chart','usage-pattern-chart','charge-discharge-chart']){const canvas=document.getElementById(id);if(canvas)Chart.getChart(canvas)?.destroy();}
}
export function renderDesignedEnergy(result,asset){
 const rows=result.items,labels=rows.map(r=>stamp(r.timestamp,asset.timezone));
 const set=(id,value)=>{const n=document.getElementById(id);if(n)n.textContent=value;};
 document.getElementById('energy-building-photo').src=imageFor(asset);
 set('building-name-tag',asset.source_asset_id);set('building-area-tag',`${asset.floor_area_m2??'Area unavailable'} m2 | ${asset.primary_space_usage} | illustrative image`);
 set('gauge-percent',`${rows.at(-1).soc_percent.toFixed(0)}%`);
 const circle=document.querySelector('circle[stroke-dasharray]');if(circle)circle.setAttribute('stroke-dashoffset',String(339.29*(1-rows.at(-1).soc_percent/100)));
 set('metric-current-power',`${result.simulated_peak_kw.toFixed(1)} kW avg`);
 set('metric-duration',`${result.ending_stored_kwh.toFixed(1)} kWh`);
 set('metric-capacity',`${result.assumptions.battery_capacity_kwh.toFixed(1)} kWh assumed`);
 set('flow-val-solar',`${rows.reduce((s,r)=>s+r.solar_kwh,0).toFixed(1)} kWh`);
 set('flow-val-battery',`${rows.reduce((s,r)=>s+r.discharge_kwh,0).toFixed(1)} kWh out`);
 set('flow-val-home',`${result.baseline_energy_kwh.toFixed(1)} kWh`);
 set('flow-val-grid',`${result.simulated_grid_energy_kwh.toFixed(1)} kWh`);
 chart(document.getElementById('battery-level-chart'),labels,[{label:'Simulated stored state',data:rows.map(r=>r.soc_percent),backgroundColor:'#FF7A00',borderColor:'#FF7A00',borderRadius:3}],'% assumed capacity','bar');
 chart(document.getElementById('usage-pattern-chart'),labels,[{label:'Calculated forecast',data:rows.map(r=>r.baseline_kwh),borderColor:'#FF7A00'},{label:'Simulated grid import',data:rows.map(r=>r.grid_kwh),borderColor:'#FACC15'}],'kWh / hourly interval');
 chart(document.getElementById('charge-discharge-chart'),labels,[{label:'Simulated charge',data:rows.map(r=>r.charge_kwh),backgroundColor:'#FF7A00',borderColor:'#FF7A00'},{label:'Simulated discharge',data:rows.map(r=>r.discharge_kwh),backgroundColor:'#FACC15',borderColor:'#FACC15'}],'kWh / hourly interval','bar');
}
