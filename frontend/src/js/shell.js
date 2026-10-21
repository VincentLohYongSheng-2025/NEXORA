import './api.js';
import './dynamic_island.js';
import {createPersistentDisclosure} from './data_classification.js';
import {ready,esc,status} from './screen_common.js';
import {filterAssetsForSearch} from './interaction_helpers.js';
import {loadPreferences} from './demo_preferences.js';

function applyLocalDisplayPreferences(values=loadPreferences()) {
  document.documentElement.classList.toggle('demo-ai-panel-hidden',!values.aiPanelVisible);
  document.documentElement.classList.toggle('demo-alert-badges-hidden',!values.notificationBadges);
}

function keyboardButton(node, action) {
  if (!node) return;
  node.setAttribute('role', node.getAttribute('role') || 'button');
  if (!node.hasAttribute('tabindex')) node.tabIndex = 0;
  node.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); action(); }
  });
}

function selectAssetOnCurrentPage(assetId) {
  if (window.veloraApp?.selectBuilding) return window.veloraApp.selectBuilding(assetId);
  if (window.diagApp?.selectBuilding) return window.diagApp.selectBuilding(assetId);
  if (window.energyApp?.selectAsset) return window.energyApp.selectAsset(assetId);
  if (window.twinApp?.loadSelection) return window.twinApp.loadSelection(assetId);
  const select = document.getElementById('select-default-building');
  if (select) { select.value = assetId; select.dispatchEvent(new Event('change', {bubbles:true})); return; }
  location.href = `index.html?asset=${encodeURIComponent(assetId)}`;
}

function setupAssetSearch() {
  const trigger=document.querySelector('header button[title="Search"]');
  const headerInput=document.querySelector('header input[placeholder*="search" i]');
  if(!trigger&&!headerInput)return;
  const dialog=document.createElement('div');dialog.id='asset-search-dialog';dialog.className='asset-search-dialog hidden';dialog.setAttribute('role','dialog');dialog.setAttribute('aria-modal','true');dialog.setAttribute('aria-label','Search BDG2 benchmark buildings');
  dialog.innerHTML='<div class="asset-search-card"><div class="asset-search-heading"><div><strong>Find a benchmark building</strong><p>Public benchmark data — Building Data Genome Project 2 v1.0</p></div><button type="button" aria-label="Close asset search">×</button></div><input class="module-input" type="search" placeholder="Search building name or use…" aria-label="Search BDG2 buildings"><div class="asset-search-results" role="listbox"></div><p class="scope-note">Selecting a result changes only the current demo view. BDG2 is not Sime Darby or Elmina telemetry.</p></div>';
  document.body.appendChild(dialog);
  const input=dialog.querySelector('input');const results=dialog.querySelector('.asset-search-results');let catalogue=[];
  const close=()=>dialog.classList.add('hidden');
  const render=()=>{const matches=filterAssetsForSearch(catalogue,input.value);results.replaceChildren();if(!matches.length){results.textContent='No matching BDG2 benchmark building.';return;}for(const asset of matches){const button=document.createElement('button');button.type='button';button.className='asset-search-result';button.innerHTML=`<strong>${esc(asset.source_asset_id)}</strong><span>${esc(asset.primary_space_usage||'Whole-building electricity')}</span>`;button.onclick=()=>{selectAssetOnCurrentPage(asset.id);close();status(`Selected ${asset.source_asset_id} from the BDG2 public benchmark catalogue.`,'success');};results.appendChild(button);}};
  const open=async()=>{dialog.classList.remove('hidden');input.value='';results.textContent='Loading BDG2 catalogue…';input.focus();try{catalogue=(await window.apiClient.getAssets()).items||[];render();}catch(error){results.textContent=error.message||'Building catalogue unavailable. Retry search.';}};
  dialog.querySelector('button').onclick=close;dialog.addEventListener('click',event=>{if(event.target===dialog)close();});input.addEventListener('input',render);
  if(trigger){trigger.removeAttribute('onclick');trigger.onclick=open;}
  if(headerInput){headerInput.readOnly=true;headerInput.setAttribute('aria-label','Open BDG2 building search');headerInput.onclick=open;headerInput.onfocus=open;}
  document.addEventListener('keydown',event=>{if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='k'){event.preventDefault();open();}else if(event.key==='Escape'&&!dialog.classList.contains('hidden'))close();});
}
ready(()=>{
  applyLocalDisplayPreferences();
  window.addEventListener('energios:preferences-changed',event=>applyLocalDisplayPreferences(event.detail));
  const disclosure=createPersistentDisclosure();
  document.querySelector('header')?.insertAdjacentElement('afterend',disclosure);
  const aside=document.querySelector('.velora-sidebar');
  if(aside){const mobile=document.createElement('nav');mobile.className='mobile-navigation';mobile.setAttribute('aria-label','Main navigation');
    for(const link of aside.querySelectorAll('a')){const clone=link.cloneNode(true);clone.setAttribute('aria-label',link.title);mobile.appendChild(clone);}document.body.appendChild(mobile);}
  const island=document.getElementById('dynamic-island');
  if(island){
    document.getElementById('island-collapsed')?.setAttribute('role','button');
    const collapsed=document.getElementById('island-collapsed');if(collapsed){collapsed.tabIndex=0;collapsed.onkeydown=e=>{if(e.key==='Enter')window.dynamicIsland.expand();};}

  }
  document.querySelectorAll('#island-expanded button[title="Settings"]').forEach(button=>{button.onclick=()=>{location.href='settings.html';};button.setAttribute('aria-label','Open settings');});
  const profile=document.querySelector('[title="Operator Profile"]');
  if(profile){const action=()=>status('Demo operator profile only. Authentication and personnel records are not connected.','info');profile.onclick=action;keyboardButton(profile,action);profile.setAttribute('aria-label','Demo operator profile information');}
  const notifications=document.querySelector('[title="Alerts & Notifications"]');
  if(notifications){const action=notifications.onclick?()=>notifications.click():()=>{location.href='diagnostics.html?openAlerts=1';};keyboardButton(notifications,action);notifications.setAttribute('aria-label','Open unusual-consumption-pattern evidence');}
  setupAssetSearch();
  document.querySelectorAll('img').forEach(i=>{if(i.src.includes('assets/'))i.alt='Illustrative design image; not source-site geometry';});
  const trace=document.createElement('details');trace.className='network-trace';trace.innerHTML='<summary>API request status</summary><ol id="request-trace"></ol>';document.body.appendChild(trace);
  window.addEventListener('energios:request',e=>{const pill=document.getElementById('api-connection-status');if(pill){pill.textContent=e.detail.status===200?'API response received':'API request failed';}const list=document.getElementById('request-trace');const row=document.createElement('li');row.textContent=`${e.detail.status||'Network error'} · ${e.detail.ms} ms · ${e.detail.path}`;list.prepend(row);while(list.children.length>12)list.lastChild.remove();});
});
