import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';
import {pageAssetId,chatBody} from '../src/js/assistant_context.js';
const ID='00000000-0000-4000-8000-000000000001';
const OTHER='00000000-0000-4000-8000-000000000002';
const assets=[ID,OTHER].map((id,i)=>({id,source_asset_id:'BDG2 building '+i,provenance:{source_code:'bdg2_v1',kind:'public_benchmark'}}));
const source=(await readFile(new URL('../src/js/dynamic_island.js',import.meta.url),'utf8')).replace(/^import .*;$/m,'');
class Element {
 constructor(tag='div'){this.tag=tag;this.children=[];this.style={};this._text='';this._value='';this.classList={add(){},remove(){}};this.parentElement=null;}
 set textContent(value){this._text=String(value);this.children=[];}
 get textContent(){return this._text+this.children.map(c=>c.textContent).join('');}
 set value(v){this._value=v;}
 get value(){return this._value||((this.tag==='select')?this.children[0]?.value||'':'');}
 appendChild(c){c.parentElement=this;this.children.push(c);return c;}
 insertBefore(c,b){c.parentElement=this;this.children.splice(this.children.indexOf(b),0,c);}
 replaceChildren(){this.children=[];this._text='';if(this.tag==='select')this._value='';}
 setAttribute(k,v){this[k]=v;}
 contains(){return true;}
 querySelectorAll(){return this.buttons||[];}
}
function setup({available=true,items=assets,post}={}){
 const ids=Object.fromEntries(['dynamic-island','island-agent-bubble-text','island-agent-logs-list','island-user-input','island-expanded','island-collapsed'].map(id=>[id,new Element()]));
 new Element().appendChild(ids['island-agent-bubble-text']);ids['dynamic-island'].buttons=[new Element('button'),new Element('button')];
 const document={readyState:'loading',addEventListener(){},getElementById:id=>ids[id]||null,createElement:tag=>new Element(tag),createTextNode:text=>{const e=new Element();e.textContent=text;return e;}};
 const calls=[];
 const window={veloraApp:{state:{activeBuildingId:ID}},apiClient:{request:async()=>({available}),getAssets:async()=>({items}),post:async(...args)=>{calls.push(args);return post?post(...args):{asset_id:args[1].asset_id,read_only:true,answer:'Observed BDG2 value [observations].',citations:[{id:'observations',label:'BDG2 public benchmark'}]};}}};
 vm.runInNewContext(source,{window,document,pageAssetId,chatBody,AbortController,console});
 window.dynamicIsland.init();return {ai:window.dynamicIsland,window,document,calls,ids};
}
test('request shaping bounds messages, requires a returned asset ID and excludes cross-asset scenarios',()=>{
 assert.throws(()=>chatBody('',ID,assets));assert.throws(()=>chatBody('x'.repeat(1501),ID,assets));assert.throws(()=>chatBody('Hi','hardcoded',assets));
 const body=chatBody('  Explain  ',ID,assets,{kind:'energy',inputs:{asset_id:OTHER},results:{fake:999}});
 assert.deepEqual(body,{message:'Explain',asset_id:ID});
 const matching=chatBody('Explain',ID,assets,{kind:'peak_shift',inputs:{asset_id:ID,flexible_load_kwh:2},results:{fake:999}});
 assert.equal(matching.scenario.results,undefined);
 assert.equal(pageAssetId({}, {getElementById:()=>null}),null);
});
test('absent key leaves an explicit unavailable/retry state and makes no chat call',async()=>{
 const {ai,calls,ids}=setup({available:false});await ai.checkAvailability();await ai.send('Explain');
 assert.match(ai.state.textContent,/unavailable/i);assert.match(ai.availabilityButton.textContent,/Retry availability/);
 assert.equal(ids['dynamic-island'].buttons[0].disabled,true);assert.equal(calls.length,0);
});
test('empty catalogue cannot send an invented asset',async()=>{
 const {ai,calls}=setup({items:[]});await ai.checkAvailability();assert.match(ai.state.textContent,/No approved BDG2/);
 await ai.send('Explain');assert.equal(calls.length,0);
});
test('real send uses backend proxy contract and displays plain text with citations',async()=>{
 const {ai,calls}=setup({post:async()=>({asset_id:ID,read_only:true,answer:'<img src=x onerror=alert(1)> [observations]',citations:[{id:'observations',label:'BDG2 benchmark'}]})});
 await ai.checkAvailability();ai.input.value='Explain';await ai.handleUserSubmit({preventDefault(){}});
 assert.equal(calls[0][0],'/demo/assistant/chat');assert.equal(calls[0][1].asset_id,ID);
 assert.equal(calls[0][2].timeoutMs,50000);assert.match(ai.bubble.textContent,/<img/);
 assert.equal(ai.bubble.children.length,0);assert.match(ai.citations.textContent,/BDG2/);assert.match(ai.state.textContent,/Read-only/);
});
test('pending requests prevent duplicate sends and show honest loading',async()=>{
 let resolve;const waiting=new Promise(r=>{resolve=r;});const {ai,calls}=setup({post:()=>waiting});
 await ai.checkAvailability();const request=ai.send('Explain');assert.equal(ai.pending,true);assert.match(ai.bubble.textContent,/Waiting for Gemini/);
 await ai.send('Duplicate');assert.equal(calls.length,1);
 resolve({asset_id:ID,read_only:true,answer:'Explanation [limitations].',citations:[]});await request;assert.equal(ai.pending,false);
});
test('provider quota failure offers explicit retry and never substitutes a conversation',async()=>{
 let failed=true;const {ai,calls}=setup({post:async()=>{if(failed)throw Object.assign(new Error('quota'),{status:429});return {asset_id:ID,read_only:true,answer:'Unavailable [limitations].',citations:[]};}});
 await ai.checkAvailability();await ai.send('Explain');assert.match(ai.state.textContent,/one minute/);assert.equal(ai.retryButton.hidden,false);
 assert.match(ai.bubble.textContent,/No assistant answer/);failed=false;await ai.retryButton.onclick();assert.equal(calls.length,2);
});
test('page switching chooses its actual asset, clears answers, and ignores stale responses',async()=>{
 let resolve;const {ai,window,calls}=setup({post:()=>new Promise(r=>{resolve=r;})});await ai.checkAvailability();
 const first=ai.send('Explain');window.veloraApp.state.activeBuildingId=OTHER;
 resolve({asset_id:ID,read_only:true,answer:'Stale answer',citations:[]});await first;assert.match(ai.bubble.textContent,/discarded/);
 const second=ai.send('Explain new building');assert.equal(calls[1][1].asset_id,OTHER);
 resolve({asset_id:OTHER,read_only:true,answer:'Explanation [limitations].',citations:[]});await second;
});
test('scenario inclusion is explicit and sends inputs only for the matching selected building',async()=>{
 const {ai,window,calls}=setup();await ai.checkAvailability();
 window.energiosAssistantScenario={kind:'peak_shift',inputs:{asset_id:ID,flexible_load_kwh:2,from_interval:0,to_interval:1},results:{notTrusted:999}};
 await ai.send('Explain');assert.equal(calls[0][1].scenario,undefined);
 ai.include.checked=true;await ai.send('Explain simulation');assert.equal(calls[1][1].scenario.kind,'peak_shift');assert.equal(calls[1][1].scenario.results,undefined);
});

test('catalogue refresh failures disable sending even if an old asset remains selected',async()=>{
 const {ai,window,calls}=setup();await ai.checkAvailability();
 window.apiClient.getAssets=async()=>{throw new Error('Data unavailable');};await ai.checkAvailability();
 assert.equal(ai.available,false);assert.match(ai.state.textContent,/Building evidence unavailable/);
 await ai.send('Explain');assert.equal(calls.length,0);
});
test('reopening after a page asset change clears the previous explanation',async()=>{
 const {ai,window}=setup();await ai.checkAvailability();await ai.send('Explain');
 window.veloraApp.state.activeBuildingId=OTHER;await ai.checkAvailability();
 assert.equal(ai.picker.value,OTHER);assert.equal(ai.question.textContent,'');assert.match(ai.bubble.textContent,/Building changed/);
});
