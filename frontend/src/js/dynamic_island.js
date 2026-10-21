/** Norman AI panel: real backend requests only; no scripted responses or agent actions. */
import {pageAssetId, chatBody} from './assistant_context.js';
class DynamicIslandController {
  constructor() { this.assets=[]; this.available=false; this.pending=false; this.sequence=0; }
  init() {
    if (this.initialized || !document.getElementById('dynamic-island')) return;
    this.initialized=true;
    this.bubble=document.getElementById('island-agent-bubble-text');
    this.bubble.setAttribute('aria-live','polite');
    const parent=this.bubble.parentElement;
    this.question=document.createElement('p');this.question.className='assistant-question';parent.insertBefore(this.question,this.bubble);
    this.citations=document.createElement('div');this.citations.className='assistant-citations';parent.appendChild(this.citations);
    const right=document.getElementById('island-agent-logs-list');right.replaceChildren();right.style.maxHeight='330px';
    this.state=document.createElement('p');this.state.setAttribute('role','status');right.appendChild(this.state);
    const label=document.createElement('label');label.textContent='Selected BDG2 building';right.appendChild(label);
    this.picker=document.createElement('select');this.picker.id='assistant-asset';this.picker.setAttribute('aria-label','Assistant building');this.picker.className='assistant-select';label.appendChild(this.picker);
    this.picker.onchange=()=>this.changeAsset();
    const assumed=document.createElement('label');assumed.className='assistant-assumptions';
    this.include=document.createElement('input');this.include.type='checkbox';this.include.id='assistant-include-scenario';assumed.appendChild(this.include);
    assumed.appendChild(document.createTextNode(' Include latest successful simulation assumptions (same building only)'));right.appendChild(assumed);
    this.availabilityButton=document.createElement('button');this.availabilityButton.textContent='Retry availability';this.availabilityButton.className='assistant-retry';this.availabilityButton.onclick=()=>this.checkAvailability();right.appendChild(this.availabilityButton);
    this.retryButton=document.createElement('button');this.retryButton.textContent='Retry message';this.retryButton.className='assistant-retry';this.retryButton.hidden=true;this.retryButton.onclick=()=>{if(this.lastRequest?.asset_id===this.picker.value)this.send(this.lastRequest.message);};right.appendChild(this.retryButton);
    const disclosure=document.createElement('p');disclosure.className='assistant-disclosure';disclosure.textContent='Historical BDG2 public benchmark data, not Sime Darby or Elmina. Forecast = calculated; anomaly = unusual pattern, no confirmed cause; scenario = simulated assumptions. AI may be incorrect. No tools, settings changes or equipment control. Questions and selected evidence are sent to Google Gemini only when you send. Do not enter secrets or personal data.';right.appendChild(disclosure);
    this.input=document.getElementById('island-user-input');this.input.maxLength=1500;this.input.setAttribute('aria-label','Question for read-only energy assistant');this.input.placeholder='Ask about this building’s evidence…';
    this.bubble.textContent='Ask about observed BDG2 readings, calculated forecasts, unusual patterns or explicitly included simulation assumptions.';
    this.setStatus('Open the panel to check assistant availability.');this.controls();
    document.addEventListener('keydown',e=>{if(e.key==='Escape')this.collapse();});
    document.addEventListener('click',e=>{const root=document.getElementById('dynamic-island');if(root&&!root.contains(e.target))this.collapse();});
  }
  setStatus(text) {this.state.textContent=text;}
  controls() {
    const root=document.getElementById('dynamic-island');
    const disabled=!this.available||!this.picker.value||this.pending;
    root.querySelectorAll('form button, button[onclick*="sendQuickPrompt"]').forEach(n=>{n.disabled=disabled;});
    this.input.disabled=this.pending;this.picker.disabled=this.pending;this.include.disabled=this.pending;
    this.availabilityButton.disabled=this.pending||this.checking;this.retryButton.disabled=disabled;
    this.include.parentElement.title='Only inputs from a successful calculation are sent; the server recomputes results.';
  }
  async checkAvailability() {
    if(this.checking||this.pending)return;
    this.checking=true;this.available=false;this.setStatus('Checking read-only assistant and BDG2 catalogue…');this.controls();
    const results=await Promise.allSettled([window.apiClient.request('/demo/assistant/status'),window.apiClient.getAssets()]);
    const [status,catalogue]=results;
    if(catalogue.status==='fulfilled') {
      this.assets=catalogue.value.items.filter(a=>a.provenance?.source_code==='bdg2_v1'&&a.provenance?.kind==='public_benchmark');
      const previous=this.picker.value;this.picker.replaceChildren();
      for(const asset of this.assets){const option=document.createElement('option');option.value=asset.id;option.textContent=asset.source_asset_id;this.picker.appendChild(option);}
      this.pageAsset=pageAssetId(window,document);
      const wanted=this.pageAsset||previous;if(this.assets.some(a=>a.id===wanted))this.picker.value=wanted;
      if(previous&&previous!==this.picker.value)this.changeAsset();
    }
    this.available=status.status==='fulfilled'&&status.value.available===true&&catalogue.status==='fulfilled'&&this.assets.length>0;
    if(catalogue.status==='rejected')this.setStatus('Building evidence unavailable. Retry availability.');
    else if(!this.assets.length)this.setStatus('No approved BDG2 buildings available. Retry after data access is restored.');
    else if(status.status==='rejected')this.setStatus('Assistant backend unavailable. Retry availability.');
    else this.setStatus(this.available?'Read-only Gemini configured. Provider access is checked when you send.':'AI unavailable. A private Gemini key must be configured in the backend. Retry availability after setup.');
    this.checking=false;this.controls();
  }
  changeAsset() {
    ++this.sequence;this.abort?.abort();this.pending=false;this.lastRequest=null;this.retryButton.hidden=true;
    this.question.textContent='';this.citations.replaceChildren();this.bubble.textContent='Building changed. Ask a new question about the selected building.';this.controls();
  }
  expand() {this.init();document.getElementById('island-expanded')?.classList.remove('hidden');document.getElementById('island-collapsed')?.classList.add('hidden');this.checkAvailability();}
  collapse() {document.getElementById('island-expanded')?.classList.add('hidden');document.getElementById('island-collapsed')?.classList.remove('hidden');}
  sendQuickPrompt(message) {return this.send(message);}
  handleUserSubmit(event) {event?.preventDefault();return this.send(this.input.value);}
  async send(message) {
    if(this.pending)return;
    if(!this.available){this.setStatus('AI unavailable. Retry availability after private backend setup.');return;}
    const page=pageAssetId(window,document);
    if(page!==this.pageAsset){this.pageAsset=page;if(this.assets.some(a=>a.id===page)){this.picker.value=page;this.changeAsset();}}
    let body;
    try{body=chatBody(message,this.picker.value,this.assets,this.include.checked?window.energiosAssistantScenario:null);}catch(error){this.setStatus(error.message);return;}
    const token=++this.sequence;this.lastRequest=body;this.pending=true;this.abort=new AbortController();this.retryButton.hidden=true;this.controls();
    this.question.textContent=`You: ${body.message}`;this.citations.replaceChildren();this.bubble.textContent='Waiting for Gemini’s evidence-based explanation…';
    this.setStatus(body.scenario?'Sending selected-building evidence and declared simulation assumptions…':'Sending selected-building BDG2 evidence; no simulation assumptions included…');
    try {
      const result=await window.apiClient.post('/demo/assistant/chat',body,{signal:this.abort.signal,timeoutMs:50000});
      if(token!==this.sequence)return;
      if(pageAssetId(window,document)!==page){this.bubble.textContent='Page building changed. This response was discarded; ask again for the current building.';this.setStatus('Building changed during the request.');return;}
      if(result.asset_id!==body.asset_id||result.read_only!==true||typeof result.answer!=='string'||result.answer.length>5000)throw new Error('Assistant returned an invalid response. Retry your question.');
      this.bubble.textContent=result.answer;
      for(const citation of result.citations||[]){const item=document.createElement('p');item.textContent=`[${citation.id}] ${citation.label}`;this.citations.appendChild(item);}
      this.setStatus('Gemini explanation received. Review cited evidence. Read-only; no action performed.');this.input.value='';
    } catch(error) {
      if(token!==this.sequence)return;
      this.bubble.textContent='No assistant answer was generated or substituted.';
      this.setStatus(error.status===429?'Assistant busy or rate limit reached. Wait one minute, then retry.':error.message||'Assistant unavailable. Retry your question.');this.retryButton.hidden=false;
    } finally {if(token===this.sequence){this.pending=false;this.controls();}}
  }
}
window.dynamicIsland=new DynamicIslandController();
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>window.dynamicIsland.init(),{once:true});else window.dynamicIsland.init();
