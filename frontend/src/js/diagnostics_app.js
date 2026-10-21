import {ready,assets,bundle,esc,stamp,imageFor,status,chart,audit} from './screen_common.js';
import {allocationFromObserved,loadScenarioProfile,mountScenarioPanel,saveScenarioProfile} from './scenario_profile.js';
class Diagnostics {
  constructor(){this.assets=[];this.state={subsystem:'whole'};this.sequence=0;}
  async init(){
    status('Loading BDG2 asset catalogue...');
    document.querySelectorAll('.diag-callout').forEach((node,index)=>{const labels=['Illustrative solar location only. BDG2 contains no measured PV, roof or generation data.','Illustrative chiller location only. BDG2 contains no equipment mapping, chiller telemetry or fault cause.'];const action=()=>status(labels[index]||'Illustrative architectural callout; no measured subsystem data.','info');node.setAttribute('role','button');node.setAttribute('tabindex','0');node.setAttribute('aria-label',labels[index]);node.onclick=action;node.onkeydown=event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();action();}};});
    try{this.assets=await assets();const requested=new URLSearchParams(location.search).get('asset');await this.selectBuilding(this.assets.some(asset=>asset.id===requested)?requested:this.assets[0].id);}catch(e){status(e.message,'error',()=>this.init());}
  }
  picker(){document.getElementById('building-picker-container').innerHTML=this.assets.map(a=>`<button class="velora-pill ${a.id===this.state.activeBuildingId?'active':''}" onclick="diagApp.selectBuilding('${a.id}')">${esc(a.source_asset_id.replace('Hog_','').replaceAll('_',' '))}</button>`).join('');}
  async selectBuilding(id){
    const asset=this.assets.find(a=>a.id===id);if(!asset)return;
    const sequence=++this.sequence;this.state={activeBuildingId:id,currentBuilding:asset,subsystem:this.state.subsystem||'whole'};this.picker();
    status('Loading observed history and unusual-pattern evidence...');
    document.getElementById('hero-building-name').textContent=asset.source_asset_id;
    document.getElementById('diag-building-photo').src=imageFor(asset);
    for(const key of ['diag-latest','diag-mae','metric-prod-kw'])document.getElementById(key).textContent='Loading...';
    try{
      const [data,scenario]=await Promise.all([bundle(id),loadScenarioProfile(id)]);if(sequence!==this.sequence)return;Object.assign(this.state,data,{scenario});
      const rows=data.readings.items;const latest=rows.at(-1);
      document.getElementById('diag-latest').textContent=`${latest.consumption_kwh.toFixed(1)} kWh`;
      document.getElementById('diag-latest-time').textContent=stamp(latest.timestamp,asset.timezone);
      document.getElementById('diag-mae').textContent=`${data.forecast.test_metrics.model.mae_kwh.toFixed(2)} kWh`;
      document.getElementById('metric-prod-kw').textContent=`${data.anomalies.count} patterns`;
      const expected=Math.round((new Date(rows.at(-1).timestamp)-new Date(rows[0].timestamp))/3600000)+1;
      document.getElementById('diag-coverage').textContent=`${rows.length}/${expected} returned intervals`;
      document.getElementById('diag-coverage').style.width=`${rows.length/expected*100}%`;
      const grouped=new Map();for(const r of rows){const date=new Date(r.timestamp).toLocaleDateString('en-GB',{timeZone:asset.timezone});const d=grouped.get(date)||{kwh:0,count:0};d.kwh+=r.consumption_kwh;d.count++;grouped.set(date,d);}
      chart(document.getElementById('site-breakdown-chart'),[...grouped].map(([day,r])=>`${day} (${r.count} h)`),[{label:'Observed interval sum',data:[...grouped.values()].map(r=>r.kwh),backgroundColor:'#0284C7',borderColor:'#0284C7',borderRadius:4}], 'kWh returned intervals','bar');
      this.renderSubsystem();mountScenarioPanel(scenario);
      status(`Observed BDG2 evidence plus ${scenario.scenario_version} demonstration assumptions loaded.`,'success');
      if(new URLSearchParams(location.search).get('openAlerts')==='1'){this.openAlertDetails();history.replaceState(null,'',location.pathname);}
    }catch(e){if(sequence===this.sequence){this.state.anomalies=null;status(e.message,'error',()=>this.selectBuilding(id));}}
  }
  latest(){return this.state.readings?.items?.at(-1);}
  setSubsystem(kind){
    if(!['whole','chiller','ahu'].includes(kind)||!this.state.scenario)return;
    this.state.subsystem=kind;
    document.querySelectorAll('.diag-subsystem-tab').forEach(button=>{const active=button.id===`diag-tab-${kind}`;button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));});
    this.renderSubsystem();
    status(`${kind==='whole'?'Whole-building evidence and allocations':`${kind} demonstration simulation`} opened. No equipment connection or control is present.`,'info');
  }
  persist(){const result=saveScenarioProfile(this.state.scenario);if(result.errors.length){status(result.errors.join('. '),'error');return false;}mountScenarioPanel(this.state.scenario);return true;}
  updateLoad(key,value){const loads=this.state.scenario.assumptions.load_allocations_percent;loads[key]=Number(value);loads.other=Math.max(0,100-loads.hvac-loads.lighting-loads.it_plug);if(this.persist())this.renderSubsystem();}
  updateHvac(key,value){const hvac=this.state.scenario.assumptions.hvac;hvac[key]=Number(value);if(key==='chiller_share_percent'||key==='ahu_share_percent')hvac.other_hvac_percent=Math.max(0,100-hvac.chiller_share_percent-hvac.ahu_share_percent);if(this.persist())this.renderSubsystem();}
  renderSubsystem(){
    const host=document.getElementById('equipment-mapping-content'),latest=this.latest(),profile=this.state.scenario;if(!host||!latest||!profile)return;
    const a=profile.assumptions,loads=a.load_allocations_percent,allocated=allocationFromObserved(latest.consumption_kwh,loads),label='<span class="data-classification" data-kind="simulated">Simulated demonstration assumption</span>';
    if(this.state.subsystem==='whole'){
      const controls=[['hvac','HVAC/chiller/AHU'],['lighting','Lighting'],['it_plug','IT / plug load']].map(([key,name])=>`<label class="allocation-control"><span>${name}<strong>${loads[key]}% · ${allocated[key].toFixed(1)} kWh</strong></span><input aria-label="${name} simulated allocation" type="range" min="0" max="${100-Object.entries(loads).filter(([k])=>k!==key&&k!=='other').reduce((sum,[,v])=>sum+Number(v),0)}" value="${loads[key]}" oninput="diagApp.updateLoad('${key}',this.value)"></label>`).join('');
      host.innerHTML=`<div class="scenario-card-title"><div><h2>Equipment Mapping</h2><p>Editable allocation of one observed whole-building interval.</p></div>${label}</div><strong class="scenario-total">${latest.consumption_kwh.toFixed(1)} kWh observed</strong>${controls}<div class="allocation-remainder"><span>Other building load</span><strong>${loads.other}% · ${allocated.other.toFixed(1)} kWh</strong></div><p class="scope-note">Calculated from observed BDG2 data and simulation assumptions. Allocations reconcile to the observed interval and do not represent equipment meters or confirmed causes.</p>`;
      return;
    }
    const hvac=a.hvac,hvacKwh=allocated.hvac;
    if(this.state.subsystem==='chiller'){
      const chiller=hvacKwh*hvac.chiller_share_percent/100;
      host.innerHTML=`<div class="scenario-card-title"><div><h2>Chiller demonstration</h2><p>No measured chiller telemetry is used.</p></div>${label}</div><strong class="scenario-total">${chiller.toFixed(1)} kWh simulated allocation</strong><label class="allocation-control"><span>Share of HVAC allocation<strong>${hvac.chiller_share_percent}%</strong></span><input aria-label="Chiller share of simulated HVAC allocation" type="range" min="0" max="${100-hvac.ahu_share_percent}" value="${hvac.chiller_share_percent}" oninput="diagApp.updateHvac('chiller_share_percent',this.value)"></label><label class="allocation-control"><span>Illustrative COP<strong>${Number(hvac.illustrative_cop).toFixed(1)}</strong></span><input aria-label="Illustrative chiller COP" type="range" min="1" max="7" step="0.1" value="${hvac.illustrative_cop}" oninput="diagApp.updateHvac('illustrative_cop',this.value)"></label><div class="drawer-result-grid"><article><small>ILLUSTRATIVE COOLING OUTPUT</small><strong>${(chiller*hvac.illustrative_cop).toFixed(1)} kWh-thermal</strong></article><article><small>OTHER HVAC ALLOCATION</small><strong>${(hvacKwh-chiller).toFixed(1)} kWh</strong></article></div><p class="scope-note">Calculated from observed BDG2 data and simulation assumptions. COP and allocation are editable demonstration assumptions, not measured efficiency or fault diagnosis.</p>`;
      return;
    }
    const ahu=hvacKwh*hvac.ahu_share_percent/100;
    host.innerHTML=`<div class="scenario-card-title"><div><h2>AHU demonstration</h2><p>Local preview only; no BMS command is sent.</p></div>${label}</div><strong class="scenario-total">${ahu.toFixed(1)} kWh simulated allocation</strong><label class="allocation-control"><span>Share of HVAC allocation<strong>${hvac.ahu_share_percent}%</strong></span><input aria-label="AHU share of simulated HVAC allocation" type="range" min="0" max="${100-hvac.chiller_share_percent}" value="${hvac.ahu_share_percent}" oninput="diagApp.updateHvac('ahu_share_percent',this.value)"></label><label class="allocation-control"><span>Cooling setpoint<strong>${Number(hvac.cooling_setpoint_c).toFixed(1)} °C</strong></span><input aria-label="Simulated AHU cooling setpoint" type="range" min="16" max="30" step="0.5" value="${hvac.cooling_setpoint_c}" oninput="diagApp.updateHvac('cooling_setpoint_c',this.value)"></label><label class="allocation-control"><span>Fan command preview<strong>${hvac.fan_command_percent}%</strong></span><input aria-label="Simulated AHU fan command" type="range" min="0" max="100" value="${hvac.fan_command_percent}" oninput="diagApp.updateHvac('fan_command_percent',this.value)"></label><p class="scope-note">Calculated from observed BDG2 data and simulation assumptions. Values change only this browser demo; actual AHU state, comfort, airflow, faults and controls remain unavailable.</p>`;
  }
  openAlertDetails(){if(!this.state.anomalies)return status('Anomaly evidence is not loaded.','error');audit(this.state.anomalies,this.state.currentBuilding.timezone);}
  closeAlertDetails(){document.getElementById('velora-alert-modal').classList.add('hidden');}
  describeWindow(){status('Chart window: returned observed whole-building hourly BDG2 readings, grouped by source-local calendar day. Partial days show their returned-hour count; gaps are not filled.','info');}
  showToast(message){status(message,'info');}
}
window.diagApp=new Diagnostics();ready(()=>window.diagApp.init());
