const PREFIX='energios:scenario-profile:';

const clone=value=>JSON.parse(JSON.stringify(value));
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const merge=(base,overlay)=>{
  if(Array.isArray(base))return Array.isArray(overlay)?clone(overlay):clone(base);
  if(!base||typeof base!=='object')return overlay===undefined?base:overlay;
  const out=clone(base);for(const [key,value] of Object.entries(overlay||{}))out[key]=key in out?merge(out[key],value):clone(value);return out;
};

export function scenarioStorageKey(assetId){return `${PREFIX}${assetId}`;}

export function validateScenarioAssumptions(assumptions){
  const errors=[];
  const loads=assumptions?.load_allocations_percent||{};
  const loadTotal=['hvac','lighting','it_plug','other'].reduce((sum,key)=>sum+Number(loads[key]??0),0);
  if(Math.abs(loadTotal-100)>.001)errors.push('Building load allocations must total 100%');
  if(Object.values(loads).some(value=>!Number.isFinite(Number(value))||Number(value)<0||Number(value)>100))errors.push('Building load allocations must stay between 0 and 100%');
  const floorTotal=(assumptions?.floors||[]).reduce((sum,row)=>sum+Number(row.allocation_percent??0),0);
  if(Math.abs(floorTotal-100)>.001)errors.push('Floor allocations must total 100%');
  if((assumptions?.floors||[]).some(row=>!Number.isFinite(Number(row.allocation_percent))||Number(row.allocation_percent)<0||Number(row.allocation_percent)>100))errors.push('Floor allocations must stay between 0 and 100%');
  const hvac=assumptions?.hvac||{};
  const hvacTotal=['chiller_share_percent','ahu_share_percent','other_hvac_percent'].reduce((sum,key)=>sum+Number(hvac[key]??0),0);
  if(Math.abs(hvacTotal-100)>.001)errors.push('HVAC subsystem allocations must total 100%');
  if(['chiller_share_percent','ahu_share_percent','other_hvac_percent'].some(key=>!Number.isFinite(Number(hvac[key]))||Number(hvac[key])<0||Number(hvac[key])>100))errors.push('HVAC subsystem allocations must stay between 0 and 100%');
  for(const [label,value] of [['tariff',assumptions?.impact?.tariff_myr_per_kwh],['carbon factor',assumptions?.impact?.carbon_kg_per_kwh]])if(!Number.isFinite(Number(value))||Number(value)<0)errors.push(`${label} must be a non-negative number`);
  return errors;
}

export async function loadScenarioProfile(assetId,storage=localStorage){
  const profile=await window.apiClient.request(`/demo/scenario-profile/${encodeURIComponent(assetId)}`);
  let saved={};try{saved=JSON.parse(storage.getItem(scenarioStorageKey(assetId))||'{}');}catch{saved={};}
  profile.assumptions=merge(profile.assumptions,saved);
  profile.validation_errors=validateScenarioAssumptions(profile.assumptions);
  return profile;
}

export function saveScenarioProfile(profile,storage=localStorage){
  const errors=validateScenarioAssumptions(profile.assumptions);if(errors.length)return {profile,errors};
  storage.setItem(scenarioStorageKey(profile.asset_id),JSON.stringify(profile.assumptions));
  return {profile,errors:[]};
}

export function resetScenarioProfile(assetId,storage=localStorage){storage.removeItem(scenarioStorageKey(assetId));}

export function mountScenarioPanel(profile,host=document.querySelector('main')||document.querySelector('.flex-1.min-w-0')){
  if(!host||!profile)return;let panel=document.getElementById('scenario-assumptions-panel');
  if(!panel){panel=document.createElement('section');panel.id='scenario-assumptions-panel';panel.className='velora-card scenario-profile-panel';host.appendChild(panel);}
  const a=profile.assumptions,l=a.load_allocations_percent,m=a.microgrid,i=a.impact,s=a.operating_schedule;
  panel.innerHTML=`<div class="scenario-panel-head"><div><p class="eyebrow">ENERGIOS DEMONSTRATION SCENARIO</p><h2>Scenario assumptions and sources</h2></div><span class="data-classification" data-kind="simulated">Simulated demonstration assumption</span></div>
  <p class="scope-note"><strong>${esc(profile.scenario_version)}</strong> · ${esc(profile.source.reference)} Users can edit these assumptions in Settings or the relevant simulation panel.</p>
  <div class="scenario-summary-grid"><span>Loads: HVAC ${l.hvac}% · lighting ${l.lighting}% · IT/plug ${l.it_plug}% · other ${l.other}%</span><span>Schedule: ${s.weekday_open_hour}:00–${s.weekday_close_hour}:00 ${esc(s.timezone)}</span><span>Solar ${m.solar_capacity_kw} kW · battery ${m.battery_capacity_kwh} kWh / ${m.battery_power_kw} kW</span><span>Tariff MYR ${i.tariff_myr_per_kwh}/kWh · carbon ${i.carbon_kg_per_kwh} kg CO2e/kWh</span></div>
  <details><summary>Formulas, source and limitations</summary><ul>${Object.values(profile.formulas).map(value=>`<li>${esc(value)}</li>`).join('')}${profile.limitations.map(value=>`<li>${esc(value)}</li>`).join('')}</ul></details>
  <div class="scenario-panel-actions"><a class="module-button secondary" href="settings.html#scenario-assumptions">Edit all assumptions</a><button class="module-button secondary" type="button" id="scenario-reset-defaults">Reset to demo defaults</button></div>`;
  panel.querySelector('#scenario-reset-defaults').onclick=()=>{resetScenarioProfile(profile.asset_id);location.reload();};
}

export function allocationFromObserved(observedKwh,allocations){
  const value=Number(observedKwh);if(!Number.isFinite(value)||value<0)throw new Error('Observed energy must be non-negative');
  const total=Object.values(allocations).reduce((sum,item)=>sum+Number(item),0);if(Math.abs(total-100)>.001)throw new Error('Allocations must total 100%');
  return Object.fromEntries(Object.entries(allocations).map(([key,percent])=>[key,value*Number(percent)/100]));
}
