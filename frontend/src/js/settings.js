import './theme.js';
import {ready,assets,esc,status} from './screen_common.js';
import {loadPreferences,savePreferences,resetPreferences,validatePreferences} from './demo_preferences.js';
import {loadScenarioProfile,mountScenarioPanel,resetScenarioProfile,saveScenarioProfile} from './scenario_profile.js';
class DemoSettings {
 constructor(){this.values=loadPreferences();}
 async init(){
  this.bind();
  for(const [id,key] of [['input-currency-symbol','currency_code'],['input-peak-rate','tariff_myr_per_kwh'],['input-offpeak-rate','carbon_kg_per_kwh'],['tariff-source','tariff_source'],['carbon-source','carbon_source'],['assumption-reference','assumption_reference'],['capex-input','capex_myr'],['annual-reduction-input','annual_energy_reduction_kwh'],['maintenance-input','annual_maintenance_myr']])document.getElementById(id).value=this.values[key]??'';
  document.getElementById('toggle-island-alert-badges').checked=this.values.aiPanelVisible;
  document.getElementById('toggle-notify-inapp').checked=this.values.notificationBadges;
  document.getElementById('toggle-autonomous-insights').checked=this.values.scenarioSuggestions;
  document.getElementById('toggle-notify-email').checked=this.values.emailDigestPreview;
  document.getElementById('toggle-notify-webhook').checked=this.values.webhookPreview;
  document.getElementById('toggle-benchmark-lines').checked=this.values.benchmarkOverlay;
  this.selectChoice('.op-mode-btn',this.values.assistantMode);
  this.selectChoice('.poll-interval-btn',this.values.refreshPreview);
  this.renderLocalPreferenceState();
  this.selectChoice('.sensitivity-btn',this.values.anomalyDisplay);
  status('Loading available BDG2 building preferences...');
  try{this.assets=await assets();const select=document.getElementById('select-default-building');select.innerHTML=this.assets.map(a=>`<option value="${a.id}">${esc(a.source_asset_id)}</option>`).join('');if(this.assets.some(a=>a.id===this.values.defaultAssetId))select.value=this.values.defaultAssetId;select.onchange=()=>this.loadScenario(select.value);await this.loadScenario(select.value);status('Local preferences and versioned demonstration assumptions loaded. Backend thresholds, credentials and equipment remain unchanged.','success');}
  catch(e){status(e.message,'error',()=>this.init());}
 }
 async loadScenario(assetId){
  this.scenario=await loadScenarioProfile(assetId);const a=this.scenario.assumptions,i=a.impact;
  const set=(id,value)=>{const node=document.getElementById(id);if(node)node.value=value??'';};
  set('input-currency-symbol',i.currency_code);set('input-peak-rate',i.tariff_myr_per_kwh);set('input-offpeak-rate',i.carbon_kg_per_kwh);set('tariff-source',i.assumption_reference);set('carbon-source',i.assumption_reference);
  const candidates=a.investments;for(const [index,prefix] of ['a','b'].entries()){const candidate=candidates[index],impact=a.impact;set(`investment-${prefix}-name`,candidate.name);set(`investment-${prefix}-capex`,candidate.capex_myr);set(`investment-${prefix}-energy`,candidate.expected_annual_energy_change_kwh);set(`investment-${prefix}-tariff`,impact.tariff_myr_per_kwh);set(`investment-${prefix}-carbon`,impact.carbon_kg_per_kwh);set(`investment-${prefix}-opex`,candidate.annual_operating_cost_change_myr);set(`investment-${prefix}-reference`,impact.assumption_reference);}
  this.renderScenarioEditor();mountScenarioPanel(this.scenario);await Promise.allSettled([this.calculate(),this.compareInvestments()]);
 }
 renderScenarioEditor(){
  const a=this.scenario.assumptions,l=a.load_allocations_percent,h=a.hvac,f=a.floors,m=a.microgrid,s=a.operating_schedule,x=a.flexible_load;
  const input=(id,label,value,unit,min=0,max='')=>`<label>${label}<span>${unit}</span><input id="${id}" class="module-input" type="number" value="${value}" min="${min}" ${max!==''?`max="${max}"`:''} step="any"></label>`;
  document.getElementById('scenario-profile-editor').innerHTML=`<div class="scenario-panel-head"><div><p class="eyebrow">${esc(this.scenario.scenario_version)}</p><h2 id="scenario-profile-editor-title">EnergiOS Demonstration Scenario editor</h2></div><span class="data-classification" data-kind="simulated">Simulated demonstration assumption</span></div><p class="scope-note">Edit values for this selected BDG2 building. Values stay in this browser and never change BDG2 readings, backend calculations, equipment or hosted data.</p><div class="scenario-editor-groups">
  <fieldset><legend>Building-load allocation · must total 100%</legend><div class="scenario-editor-grid">${input('sp-load-hvac','HVAC',l.hvac,'%',0,100)}${input('sp-load-lighting','Lighting',l.lighting,'%',0,100)}${input('sp-load-it','IT / plug',l.it_plug,'%',0,100)}${input('sp-load-other','Other',l.other,'%',0,100)}</div></fieldset>
  <fieldset><legend>HVAC/chiller/AHU · must total 100%</legend><div class="scenario-editor-grid">${input('sp-hvac-chiller','Chiller share',h.chiller_share_percent,'%',0,100)}${input('sp-hvac-ahu','AHU share',h.ahu_share_percent,'%',0,100)}${input('sp-hvac-other','Other HVAC',h.other_hvac_percent,'%',0,100)}${input('sp-hvac-cop','Illustrative COP',h.illustrative_cop,'ratio',1,7)}${input('sp-hvac-setpoint','Cooling setpoint',h.cooling_setpoint_c,'°C',16,30)}${input('sp-hvac-fan','Fan command preview',h.fan_command_percent,'%',0,100)}</div></fieldset>
  <fieldset><legend>Illustrative floors · must total 100%</legend><div class="scenario-editor-grid">${f.map((row,index)=>input(`sp-floor-${index}`,row.label,row.allocation_percent,'%',0,100)).join('')}</div></fieldset>
  <fieldset><legend>Schedule and flexible load</legend><div class="scenario-editor-grid">${input('sp-open','Weekday open',s.weekday_open_hour,'hour',0,23)}${input('sp-close','Weekday close',s.weekday_close_hour,'hour',1,24)}${input('sp-flex','Flexible load',x.energy_kwh,'kWh',0)}${input('sp-flex-from','Shift from interval',x.from_interval,'0–23',0,23)}${input('sp-flex-to','Shift to interval',x.to_interval,'0–23',0,23)}</div></fieldset>
  <fieldset><legend>Solar and battery</legend><div class="scenario-editor-grid">${input('sp-solar','Solar capacity',m.solar_capacity_kw,'kW',0)}${input('sp-battery-capacity','Battery capacity',m.battery_capacity_kwh,'kWh',0)}${input('sp-battery-power','Battery power',m.battery_power_kw,'kW',0)}${input('sp-soc','Starting state of charge',m.starting_soc_percent,'%',0,100)}${input('sp-efficiency','Per-leg efficiency',m.round_trip_leg_efficiency,'0–1',.5,1)}</div></fieldset></div><p class="scope-note"><strong>Source:</strong> ${esc(this.scenario.source.reference)} Formulas and limitations appear in the panel below. Use Save Changes to persist edits or Reset to Defaults to restore this version.</p>`;
 }
 syncScenario(){
  const n=id=>Number(document.getElementById(id).value),a=this.scenario.assumptions;
  Object.assign(a.load_allocations_percent,{hvac:n('sp-load-hvac'),lighting:n('sp-load-lighting'),it_plug:n('sp-load-it'),other:n('sp-load-other')});
  Object.assign(a.hvac,{chiller_share_percent:n('sp-hvac-chiller'),ahu_share_percent:n('sp-hvac-ahu'),other_hvac_percent:n('sp-hvac-other'),illustrative_cop:n('sp-hvac-cop'),cooling_setpoint_c:n('sp-hvac-setpoint'),fan_command_percent:n('sp-hvac-fan')});
  a.floors.forEach((row,index)=>row.allocation_percent=n(`sp-floor-${index}`));Object.assign(a.operating_schedule,{weekday_open_hour:n('sp-open'),weekday_close_hour:n('sp-close')});Object.assign(a.flexible_load,{energy_kwh:n('sp-flex'),from_interval:n('sp-flex-from'),to_interval:n('sp-flex-to')});Object.assign(a.microgrid,{solar_capacity_kw:n('sp-solar'),battery_capacity_kwh:n('sp-battery-capacity'),battery_power_kw:n('sp-battery-power'),starting_soc_percent:n('sp-soc'),round_trip_leg_efficiency:n('sp-efficiency')});
  const values=this.read();Object.assign(a.impact,{currency_code:values.currency_code,tariff_myr_per_kwh:values.tariff_myr_per_kwh,carbon_kg_per_kwh:values.carbon_kg_per_kwh,assumption_reference:[values.tariff_source,values.carbon_source].filter(Boolean).join('; ')});a.investments=['a','b'].map(prefix=>{const item=this.investmentCandidate(prefix);return {name:item.name,capex_myr:item.capex_myr,expected_annual_energy_change_kwh:item.expected_annual_energy_change_kwh,annual_operating_cost_change_myr:item.annual_operating_cost_change_myr};});
  return saveScenarioProfile(this.scenario);
 }
 read(){
  const number=id=>{const value=document.getElementById(id).value;return value===''?null:Number(value);};
  return {defaultAssetId:document.getElementById('select-default-building').value,
   currency_code:document.getElementById('input-currency-symbol').value.trim().toUpperCase(),
   tariff_myr_per_kwh:number('input-peak-rate'),carbon_kg_per_kwh:number('input-offpeak-rate'),
   tariff_source:document.getElementById('tariff-source').value.trim(),carbon_source:document.getElementById('carbon-source').value.trim(),
   assumption_reference:document.getElementById('assumption-reference').value.trim(),capex_myr:number('capex-input'),
   annual_energy_reduction_kwh:number('annual-reduction-input'),annual_maintenance_myr:number('maintenance-input'),
   aiPanelVisible:document.getElementById('toggle-island-alert-badges').checked,
   notificationBadges:document.getElementById('toggle-notify-inapp').checked,
   anomalyDisplay:document.querySelector('.sensitivity-btn.active')?.dataset.value||'all',
   assistantMode:document.querySelector('.op-mode-btn.active')?.dataset.value||'on_demand',
   refreshPreview:document.querySelector('.poll-interval-btn.active')?.dataset.value||'30s',
   scenarioSuggestions:document.getElementById('toggle-autonomous-insights').checked,
   emailDigestPreview:document.getElementById('toggle-notify-email').checked,
   webhookPreview:document.getElementById('toggle-notify-webhook').checked,
   benchmarkOverlay:document.getElementById('toggle-benchmark-lines').checked};
 }
 selectChoice(selector,value){document.querySelectorAll(selector).forEach(button=>{const selected=button.dataset.value===value;button.classList.toggle('active',selected);button.setAttribute('aria-checked',String(selected));});}
 markChanged(message){document.getElementById('save-status-text').textContent='Unsaved local changes';this.renderLocalPreferenceState();status(message,'info');}
 renderLocalPreferenceState(){
  const output=document.getElementById('local-demo-preference-state');if(!output)return;
  const values=this.read();const enabled=[];
  if(values.scenarioSuggestions)enabled.push('scenario suggestions');
  if(values.emailDigestPreview)enabled.push('email digest preview');
  if(values.webhookPreview)enabled.push('webhook payload preview');
  if(values.benchmarkOverlay)enabled.push('derived benchmark overlay');
  const mode=values.assistantMode==='advisory_demo'?'Advisory demo':'On-demand only';
  const rows=[
   ['Assistant response',mode,'Changes the local AI panel prompt mode; responses remain read-only.'],
   ['Dashboard refresh',`${values.refreshPreview} preview`,'Sets the browser-local refresh preference; historical BDG2 data is never treated as live telemetry.'],
   ['Scenario suggestions',values.scenarioSuggestions?'Preview cards shown':'Preview cards hidden','Only local suggestions from user-entered assumptions.'],
   ['Email digest',values.emailDigestPreview?'Preview enabled':'Preview disabled','No email is sent.'],
   ['Webhook payload',values.webhookPreview?'Preview enabled':'Preview disabled','No BACnet, MQTT, BMS, or SCADA request is sent.'],
   ['Benchmark overlay',values.benchmarkOverlay?'Derived comparison shown':'Derived comparison hidden','BDG2 comparison only; not a certified rating.'],
  ];
  output.innerHTML=`<strong>Applied local demo preferences</strong><div class="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">${rows.map(([name,value,detail])=>`<article class="rounded-xl border border-amber-200 bg-white/70 p-3"><span class="block text-[10px] font-black uppercase tracking-wider text-[#71767B]">${esc(name)}</span><strong class="mt-1 block text-xs text-[#1E2022]">${esc(value)}</strong><span class="mt-1 block text-[10px] leading-4 text-[#5F6469]">${esc(detail)}</span></article>`).join('')}</div><p class="mt-3">These are browser-local previews. No email, webhook, telemetry request, setting change, or equipment command is sent.</p>`;
  window.dispatchEvent(new CustomEvent('energios:demo-preferences-preview',{detail:values}));
 }
 async calculate(){
  const output=document.getElementById('impact-results');output.textContent='Calculating from observed BDG2 intervals...';
  try{const values=this.read();const validation=validatePreferences(values);if(validation.errors.length)throw new Error(validation.errors.join('. '));
   const {defaultAssetId,...assumptions}=values;assumptions.assumption_reference=[values.tariff_source&&`Tariff: ${values.tariff_source}`,values.carbon_source&&`Carbon: ${values.carbon_source}`,values.assumption_reference].filter(Boolean).join('; ');
   delete assumptions.currency_code;delete assumptions.tariff_source;delete assumptions.carbon_source;delete assumptions.aiPanelVisible;delete assumptions.notificationBadges;delete assumptions.anomalyDisplay;delete assumptions.assistantMode;delete assumptions.refreshPreview;delete assumptions.scenarioSuggestions;delete assumptions.emailDigestPreview;delete assumptions.webhookPreview;delete assumptions.benchmarkOverlay;
   const result=await window.apiClient.post('/demo/impact',{asset_id:defaultAssetId,basis:'observed',...assumptions});
   window.energiosAssistantScenario={kind:'impact',inputs:{asset_id:defaultAssetId,basis:'observed',...assumptions}};
   const fmt=(v,unit)=>v==null?'Not calculated':`${v.toLocaleString(undefined,{maximumFractionDigits:2})} ${unit}`;
   output.innerHTML=`<div class="estimate-grid"><article><small>Observed source energy</small><strong>${fmt(result.energy_kwh,'kWh / 24 h')}</strong></article><article><small>Simulated flat-rate cost</small><strong>${fmt(result.cost_myr,'MYR')}</strong></article><article><small>Simulated emissions estimate</small><strong>${fmt(result.emissions_kg_co2e,'kg CO2e')}</strong></article><article><small>Assumed annual net benefit</small><strong>${fmt(result.annual_net_benefit_myr,'MYR / year')}</strong></article><article><small>Simulated simple payback</small><strong>${fmt(result.simple_payback_years,'years')}</strong></article></div><p class="scope-note">User assumptions, not an applicable Malaysian tariff, official carbon factor, investment recommendation or verified savings. Annual reduction is entered separately; the benchmark day is never annualised. No ranking without comparable investment candidates.</p>`;
  }catch(e){output.textContent=e.message;}
 }
 investmentCandidate(prefix){
  const number=id=>{const value=document.getElementById(id).value;return value===''?null:Number(value);};
  return {
   name:document.getElementById(`investment-${prefix}-name`).value.trim(),
   capex_myr:number(`investment-${prefix}-capex`),
   expected_annual_energy_change_kwh:number(`investment-${prefix}-energy`),
   tariff_myr_per_kwh:number(`investment-${prefix}-tariff`),
   carbon_kg_per_kwh:number(`investment-${prefix}-carbon`),
   annual_operating_cost_change_myr:number(`investment-${prefix}-opex`),
   assumption_reference:document.getElementById(`investment-${prefix}-reference`).value.trim(),
  };
 }
 async compareInvestments(){
  const output=document.getElementById('investment-comparison-results');
  output.textContent='Calculating illustrative scenario comparison...';
  try{
   const candidates=['a','b'].map(prefix=>this.investmentCandidate(prefix));
   if(candidates.some(candidate=>!candidate.name))throw new Error('Give each candidate a project name.');
   const result=await window.apiClient.post('/demo/investment-comparison',{
    asset_id:document.getElementById('select-default-building').value,
    candidates,
   });
   const fmt=(value,unit)=>value==null?'Not calculated':`${value.toLocaleString(undefined,{maximumFractionDigits:2})} ${unit}`;
   const rows=result.items.map(item=>`<tr>
    <td><strong>${esc(item.name)}</strong><br><small>${item.complete?'Complete user assumptions':`Missing: ${item.missing_inputs.map(v=>esc(v.replaceAll('_',' '))).join(', ')}`}</small></td>
    <td>${item.ranking_position==null?'Not ranked':`#${item.ranking_position}`}</td>
    <td>${fmt(item.annual_cost_change_myr,'MYR/year')}</td>
    <td>${fmt(item.annual_carbon_change_kg_co2e,'kg CO2e/year')}</td>
    <td>${fmt(item.annual_net_benefit_myr,'MYR/year')}</td>
    <td>${fmt(item.simple_payback_years,'years')}</td>
   </tr>`).join('');
   output.innerHTML=`<div class="table-scroll"><table><thead><tr><th>Candidate</th><th>Illustrative rank</th><th>Cost change</th><th>Carbon change</th><th>Net benefit</th><th>Simple payback</th></tr></thead><tbody>${rows}</tbody></table></div>
    <div class="mt-4 grid gap-3 md:grid-cols-2"><article class="module-card p-4"><strong>Formulas</strong><ul class="mt-2 list-disc pl-5 text-[11px] leading-5">${Object.entries(result.formulas).map(([name,formula])=>`<li><code>${esc(name)}</code>: ${esc(formula)}</li>`).join('')}</ul></article><article class="module-card p-4"><strong>Limits</strong><ul class="mt-2 list-disc pl-5 text-[11px] leading-5">${result.limitations.map(limit=>`<li>${esc(limit)}</li>`).join('')}</ul></article></div>
    <p class="scope-note">${esc(result.ranking_method)} Source: user-entered assumptions for ${esc(result.asset_label)}; BDG2 identifies the selected public-benchmark asset but does not validate candidate performance.</p>`;
  }catch(e){output.textContent=e.message;}
 }
 saveSettings(){
  const values=this.read();
  if([values.capex_myr,values.annual_energy_reduction_kwh].some(value=>value!=null)&&!values.assumption_reference){status('Describe the investment source or hypothetical assumption before saving.','error');return;}
  try{const scenario=this.syncScenario();if(scenario.errors.length){status(scenario.errors.join('. '),'error');return;}const result=savePreferences(values);if(result.errors.length){status(result.errors.join('. '),'error');return;}this.values=result.preferences;mountScenarioPanel(this.scenario);this.renderLocalPreferenceState();document.getElementById('save-status-text').textContent='Saved in this browser';window.dispatchEvent(new CustomEvent('energios:preferences-changed',{detail:this.values}));status('Preferences and demonstration assumptions saved in this browser only. No external service or equipment setting was changed.','success');}catch{status('Browser storage is unavailable.','error');}
 }
 resetDefaults(){
  if(this.scenario)resetScenarioProfile(this.scenario.asset_id);this.values=resetPreferences();document.getElementById('save-status-text').textContent='Defaults restored locally';this.init();window.dispatchEvent(new CustomEvent('energios:preferences-changed',{detail:this.values}));status('Local preferences reset to versioned demonstration defaults. Backend settings and equipment were not changed.','success');
 }
 bind(){if(this.bound)return;this.bound=true;
  document.getElementById('btn-save-settings').onclick=()=>this.saveSettings();
  document.getElementById('btn-reset-defaults').onclick=()=>this.resetDefaults();
  document.getElementById('impact-form').onsubmit=e=>{e.preventDefault();this.calculate();};
  document.getElementById('investment-comparison-form').onsubmit=e=>{e.preventDefault();this.compareInvestments();};
  document.querySelectorAll('.theme-option-btn').forEach(button=>button.onclick=()=>{window.themeManager.setTheme(button.dataset.theme);status('Appearance saved in this browser.','success');});
  document.querySelectorAll('.op-mode-btn').forEach(button=>button.onclick=()=>{this.selectChoice('.op-mode-btn',button.dataset.value);this.markChanged(button.dataset.value==='advisory_demo'?'Advisory demo selected locally. The assistant remains read-only.':'On-demand assistant mode selected locally.');});
  document.querySelectorAll('.poll-interval-btn').forEach(button=>button.onclick=()=>{this.selectChoice('.poll-interval-btn',button.dataset.value);this.markChanged(`Refresh preview set to ${button.dataset.value}. This does not poll SCADA or equipment.`);});
  document.querySelectorAll('.sensitivity-btn').forEach(button=>button.onclick=()=>{this.selectChoice('.sensitivity-btn',button.dataset.value);document.getElementById('save-status-text').textContent='Unsaved local changes';status('Local anomaly display filter changed. The backend detection rule is unchanged.','info');});
  const messages={
   'toggle-autonomous-insights':'Scenario suggestion preview changed locally. No autonomous action is enabled.',
   'toggle-notify-email':'Email digest preview changed locally. No email will be sent.',
   'toggle-notify-webhook':'Webhook payload preview changed locally. No webhook, BACnet, or MQTT request will be sent.',
   'toggle-benchmark-lines':'Derived benchmark overlay preference changed locally. It is not a certified building rating.',
   'toggle-island-alert-badges':'AI panel visibility changed locally.',
   'toggle-notify-inapp':'Browser-local alert badge preference changed.',
  };
  document.querySelectorAll('main input:not(:disabled), main select:not(:disabled)').forEach(control=>control.addEventListener('input',()=>{document.getElementById('save-status-text').textContent='Unsaved local changes';this.renderLocalPreferenceState();}));
  for(const [id,message] of Object.entries(messages))document.getElementById(id).addEventListener('change',()=>this.markChanged(message));
 }
 showToast(message){status(message,'info');}
}
window.settingsManager=new DemoSettings();ready(()=>window.settingsManager.init());
