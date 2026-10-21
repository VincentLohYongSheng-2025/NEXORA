import './api.js';
export const ready = (fn) => document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', fn, { once: true }) : fn();
export const esc = (value) => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const stamp = (value, zone='UTC') => new Date(value).toLocaleString('en-GB',{timeZone:zone,year:'numeric',month:'short',day:'2-digit',hour:'2-digit',minute:'2-digit'})+' '+zone;
export const imageFor = (asset) => asset.source_asset_id === 'Hog_office_Bill' ? 'assets/idea_crops/exact_building_perfect.jpeg' : `assets/buildings/${asset.source_asset_id}.jpg`;
export function status(message, kind='loading', retry) {
  let node=document.getElementById('screen-status');
  if (!node) { node=document.createElement('div'); node.id='screen-status';node.setAttribute('role','status');document.querySelector('h1')?.parentElement.appendChild(node); }
  node.className=`screen-status ${kind}`; node.replaceChildren(document.createTextNode(message));
  if (retry) { const button=document.createElement('button');button.textContent='Retry';button.onclick=retry;node.appendChild(button); }
}
export async function assets() {
  const response=await window.apiClient.getAssets();
  if (!Array.isArray(response.items) || !response.items.length) throw new Error('No BDG2 assets were returned. No substitute data is shown.');
  return response.items;
}
export async function bundle(id, limit=168) {
  const [readings,forecast,anomalies]=await Promise.all([window.apiClient.getReadings(id,{limit}),window.apiClient.getForecast(id),window.apiClient.getAnomalies(id,{limit:500})]);
  if (!readings.items?.length) throw new Error('No observed readings exist for the selected asset and period.');
  return {readings,forecast,anomalies};
}
export function chart(canvas, labels, datasets, unit='kWh', type='line') {
  if (!canvas) return null;
  const old=Chart.getChart(canvas);if(old) old.destroy();
  return new Chart(canvas,{type,data:{labels,datasets:datasets.map(d=>({borderWidth:2,pointRadius:0,tension:.25,...d}))},options:{responsive:true,maintainAspectRatio:false,interaction:{mode:'index',intersect:false},plugins:{legend:{display:datasets.length>1,labels:{boxWidth:8,font:{size:10}}}},scales:{x:{grid:{display:false},ticks:{maxTicksLimit:7}},y:{beginAtZero:true,title:{display:true,text:unit}}}}});
}
export function audit(anomalies, zone='UTC') {
  const list=document.getElementById('modal-anomalies-list');
  if (list) list.innerHTML=anomalies?.items?.length ? anomalies.items.slice(0,40).map(a=>`<article class="audit-row"><strong>${esc(a.direction.replaceAll('_',' '))}</strong><time>${esc(stamp(a.timestamp,zone))}</time><p>Observed ${a.observed_kwh.toFixed(1)} kWh · Expected ${a.forecast_kwh.toFixed(1)} kWh</p><small>Unusual consumption pattern · no confirmed cause</small></article>`).join('') : '<p>No unusual consumption patterns were detected for this asset and selected period. This is not proof that the building has no inefficiency.</p>';
  document.getElementById('velora-alert-modal')?.classList.remove('hidden');
}
