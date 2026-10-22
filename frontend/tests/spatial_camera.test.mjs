import {energySymbol} from '../src/js/township_energy.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {floorZones,floorOptions,facilityAlerts} from '../src/js/floor_conditions.js';

// Run the actual Three.js geometry, camera and animation code with a render sink.
// This verifies camera motion without requiring a GPU or claiming visual QA.
function harness({width=1200,height=690,reduced=false}={}) {
  let time=0,sequence=0;
  const frames=new Map(),renders=[],controls=[];
  function element(){return {children:[],style:{setProperty(){}},classList:{add(){},remove(){}},setAttribute(){},addEventListener(){},removeEventListener(){},appendChild(child){this.children.push(child);child.remove=()=>{this.children=this.children.filter(c=>c!==child)}},remove(){}}}
  const overlay=element(),parent=element(),container=element();
  parent.querySelector=()=>overlay;container.parentElement=parent;
  container.clientWidth=width;container.clientHeight=height;
  const context=vm.createContext({console,devicePixelRatio:1,energySymbol,floorZones,floorOptions,facilityAlerts,document:{createElement:element},
    performance:{now:()=>time},matchMedia:()=>({matches:reduced}),
    ResizeObserver:class{observe(){}disconnect(){}},
    requestAnimationFrame:callback=>{frames.set(++sequence,callback);return sequence},
    cancelAnimationFrame:id=>frames.delete(id)});
  vm.runInContext('window=globalThis;self=globalThis',context);
  vm.runInContext(readFileSync(new URL('../src/vendor/three.min.js',import.meta.url),'utf8'),context);
  const T=context.THREE;
  T.WebGLRenderer=class{constructor(){this.domElement=element();this.shadowMap={}}setPixelRatio(){}setSize(){}render(scene,camera){renders.push({position:camera.position.toArray(),target:controls.at(-1).target.toArray()})}dispose(){}forceContextLoss(){}};
  T.OrbitControls=class{constructor(camera){this.target=new T.Vector3();this.enabled=true;this.camera=camera;controls.push(this)}addEventListener(){}update(){this.camera.lookAt(this.target)}dispose(){}};
  const source=readFileSync(new URL('../src/js/spatial_twin.js',import.meta.url),'utf8').replace(/^import .*;\r?\n/gm,'').replaceAll('export ','');
  vm.runInContext(source+'\nglobalThis.mount=mountSpatialTwin;globalThis.facilities=FACILITIES',context);
  return {mount:options=>context.mount(container,options),facilities:context.facilities,renders,controls,overlay,
    step(ms){time=ms;const callbacks=[...frames.values()];frames.clear();callbacks.forEach(callback=>callback(time))}};
}
function near(actual,expected){assert.equal(actual.length,expected.length);actual.forEach((value,i)=>assert.ok(Math.abs(value-expected[i])<1e-7,`${actual} != ${expected}`))}

for(const id of ['mall','hospital','restaurant','commercial','residential','solar']) {
  test(`${id}: return camera exactly reverses entry at the same duration`,()=>{
    const h=harness();let saved;
    const enter=h.mount({onEnter:(selected,view)=>{assert.equal(selected,id);saved=view}});
    h.step(0);const home=h.renders.at(-1);
    enter.enter(id);h.step(475);const midpoint=h.renders.at(-1);
    h.step(950);const close=h.renders.at(-1);assert.ok(saved);
    enter.dispose();
    const back=h.mount({returnFrom:id,returnView:saved});
    h.step(950);near(h.renders.at(-1).position,close.position);near(h.renders.at(-1).target,close.target);
    assert.equal(h.controls.at(-1).enabled,false);
    h.step(1425);near(h.renders.at(-1).position,midpoint.position);near(h.renders.at(-1).target,midpoint.target);
    h.step(1900);near(h.renders.at(-1).position,home.position);near(h.renders.at(-1).target,home.target);
    assert.equal(h.controls.at(-1).enabled,true);
    assert.ok(h.overlay.children.every(button=>!button.disabled));back.dispose();
  });
}
test('direct selection returns to a complete mobile township framing',()=>{
  const h=harness({width:364,height:400});const initial=h.mount({});h.step(0);const home=h.renders.at(-1);initial.dispose();
  const back=h.mount({returnFrom:'hospital'});h.step(950);near(h.renders.at(-1).position,home.position);near(h.renders.at(-1).target,home.target);back.dispose();
});
test('saved township pan and zoom are restored; reduced motion skips travel',()=>{
  const h=harness({reduced:true}),view={position:[42,110,95],target:[-8,0,6]};
  const back=h.mount({returnFrom:'mall',returnView:view});h.step(0);
  near(h.renders.at(-1).position,view.position);near(h.renders.at(-1).target,view.target);
  assert.equal(h.controls.at(-1).enabled,true);back.dispose();
});
