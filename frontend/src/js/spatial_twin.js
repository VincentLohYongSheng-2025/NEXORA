import {energySymbol} from './township_energy.js';
import '../vendor/three.min.js';
import '../vendor/OrbitControls.js';
import { floorZones, floorOptions, facilityAlerts } from './floor_conditions.js?v=malaysia-v2-43';

export const FACILITIES = [
  {id:'mall',name:'Nexora Galleria',type:'Shopping mall',color:'#e96b12',x:-23,z:-13,w:18,d:13},
  {id:'hospital',name:'Nexora Medical Centre',type:'Hospital',color:'#d95c10',x:23,z:-13,w:16,d:13},
  {id:'restaurant',name:'The Garden Kitchen',type:'Restaurant',color:'#f2a13a',x:-40,z:-31,w:10,d:7},
  {id:'commercial',name:'Nexora Exchange',type:'Commercial buildings',color:'#c94e08',x:-23,z:22,w:15,d:13},
  {id:'residential',name:'Nexora Residences',type:'Residential buildings',color:'#e58a35',x:23,z:22,w:16,d:13},
  {id:'solar',name:'Nexora Solar Park',type:'Solar farm',color:'#b85a1d',x:35,z:-32,w:23,d:9},
];

/** Concept geometry, independent of the selected historical benchmark data. */
export function mountSpatialTwin(container,{facility=null,night=false,selectedFloor='whole',initialView=null,installation=null,energyNetwork=null,actionFocus=null,navigation=true,onRoom=()=>{},onEnter=()=>{},onFloor=()=>{},returnFrom=null,returnView=null}={}) {
  if(!container||!window.THREE)return null;
  const T=window.THREE, detail=!!facility, spec=FACILITIES.find(f=>f.id===facility)||FACILITIES[0];
  let renderer;
  try{renderer=new T.WebGLRenderer({antialias:true,alpha:false});}catch{return null;}
  const scene=new T.Scene();scene.background=new T.Color(night?0x122339:0xf7fafc);
  renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.7));renderer.outputEncoding=T.sRGBEncoding;
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate=false;renderer.shadowMap.needsUpdate=true;
  renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;
  container.appendChild(renderer.domElement);renderer.domElement.setAttribute('aria-label',detail?`${spec.type} 3D model; drag to rotate, scroll to zoom`:'Interactive 3D township. Select a building to explore.');
  const camera=new T.PerspectiveCamera(detail?34:37,1,.1,500);
  const home=detail?new T.Vector3(31,29,36):new T.Vector3(0,105,112);
  const look=detail?new T.Vector3(0,4,0):new T.Vector3(0,0,-2);
  camera.position.copy(home);
  const controls=new T.OrbitControls(camera,renderer.domElement);controls.target.copy(look);controls.enableDamping=true;controls.dampingFactor=.075;
  let dirty=true;const changed=()=>{dirty=true};controls.addEventListener('change',changed);
  controls.enablePan=!detail;controls.minDistance=detail?16:65;controls.maxDistance=detail?85:340;controls.maxPolarAngle=Math.PI*.47;
  const hemisphere=new T.HemisphereLight(night?0xaac8ee:0xe6f3ff,night?0x172a24:0x718769,night ? .22 : .75);scene.add(hemisphere);
  const sun=new T.DirectionalLight(night?0xa2beeb:0xfff5e8,night ? .28 : 1.25);sun.position.set(-35,70,38);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);
  Object.assign(sun.shadow.camera,{left:-75,right:75,top:75,bottom:-75,near:1,far:180});sun.shadow.bias=-.0004;sun.shadow.normalBias=.06;scene.add(sun);
  const geometries=[],materials=[],hits=[],labels=[],buildings=[];
  // Hex palette values describe sRGB swatches; lighting operates in linear space.
  // Explicit conversion prevents the pale, washed-out materials of the old scene.
  const mat=(color,opts={})=>{const m=new T.MeshStandardMaterial({color,roughness:.72,...opts});m.color.convertSRGBToLinear();materials.push(m);return m;};
  const M={ivory:mat(0xf4f6f8),concrete:mat(0xcbd2d8),stone:mat(0x87939d),dark:mat(0x334452),glass:mat(night?0x204862:0x3989ac,{metalness:.3,roughness:.2,emissive:night?0x184c6a:0x000000,emissiveIntensity:.22}),warm:mat(0xffc078,{emissive:night?0xff9d3c:0x000000,emissiveIntensity:.55}),teal:mat(0x16887f),wood:mat(0x9c6543),grass:mat(0x71ad57),leaf:mat(0x2e8044),leaf2:mat(0x62aa48),trunk:mat(0x77543c),road:mat(0x4d5964),line:mat(0xffd761),panel:mat(0x12547b,{metalness:.35,roughness:.23}),metal:mat(0xafbfcb,{metalness:.55,roughness:.38}),water:mat(0x2aabd0,{metalness:.22,roughness:.18}),white:mat(0xffffff),selection:mat(0xffbb80)};
  Object.assign(M,{paving:mat(0xc9c3b7),curb:mat(0xe3dfd5),soil:mat(0x746650),hedge:mat(0x426b43),sandstone:mat(0xd9c9ad),roof:mat(0xaeb7b7),asphalt:mat(0x495057),rubber:mat(0x242b30)});
  function mesh(g,m,x,y,z,parent=scene){geometries.push(g);const o=new T.Mesh(g,m);o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o;}
  const box=(w,h,d,x,y,z,m,parent=scene)=>mesh(new T.BoxGeometry(w,h,d),m,x,y,z,parent);
  const cylinder=(r,h,x,y,z,m,parent=scene)=>mesh(new T.CylinderGeometry(r,r,h,24),m,x,y,z,parent);
  function tree(x,z,s=1,parent=scene){cylinder(.13*s,1.65*s,x,.85*s,z,M.trunk,parent);const a=mesh(new T.SphereGeometry(.95*s,10,8),M.leaf,x,2*s,z,parent);a.scale.set(1.05,1.18,.92);const b=mesh(new T.SphereGeometry(.75*s,10,8),M.leaf2,x+.4*s,2.5*s,z-.16*s,parent);b.scale.set(.9,1.12,1);}
  function palm(x,z,s=1,parent=scene){
    cylinder(.13*s,3.5*s,x,1.75*s,z,M.trunk,parent);
    for(let i=0;i<7;i++){const a=i*Math.PI*2/7,leaf=mesh(new T.SphereGeometry(1,8,5),i%2?M.leaf:M.leaf2,x+Math.cos(a)*.85*s,3.6*s,z+Math.sin(a)*.85*s,parent);leaf.scale.set(1.65*s,.13*s,.36*s);leaf.rotation.y=-a;leaf.rotation.z=.16;}
  }
  function ring(inner,outer,x,y,z,material,parent=scene){const o=mesh(new T.RingGeometry(inner,outer,64),material,x,y,z,parent);o.rotation.x=-Math.PI/2;return o;}
  function lamp(x,z,parent=scene){cylinder(.055,3.4,x,1.7,z,M.dark,parent);box(.75,.07,.1,x+.3,3.38,z,M.dark,parent);box(.5,.07,.28,x+.55,3.31,z,M.warm,parent);}
  function bench(x,z,turn=0,parent=scene){const g=new T.Group();g.position.set(x,.2,z);g.rotation.y=turn;parent.add(g);for(let i=0;i<3;i++)box(1.5,.07,.13,0,.45,(i-1)*.17,M.wood,g);box(1.5,.35,.08,0,.72,-.3,M.wood,g);for(const xx of [-.55,.55])box(.09,.45,.5,xx,.2,0,M.dark,g);}
  function person(x,z,color=0x687987,parent=scene){const shirt=mat(color);cylinder(.13,.55,x,.78,z,shirt,parent);mesh(new T.SphereGeometry(.14,8,6),M.sandstone,x,1.18,z,parent);for(const dx of [-.08,.08])box(.09,.45,.12,x+dx,.29,z,M.dark,parent);}
  function parapet(w,d,y,x,z,parent){box(w,.12,d,x,y+.08,z,M.roof,parent);for(const side of [-1,1]){box(w+.2,.36,.15,x,y+.24,z+side*d/2,M.ivory,parent);box(.15,.36,d,x+side*w/2,y+.24,z,M.ivory,parent);}}
  function car(x,z,color=0xf7f6ee,turn=false,parent=scene){const group=new T.Group();group.position.set(x,.22,z);group.rotation.y=turn?Math.PI/2:0;parent.add(group);box(.95,.36,1.85,0,.2,0,mat(color),group);box(.8,.3,.95,0,.5,-.12,M.glass,group);for(const a of [-.48,.48])for(const b of [-.58,.58])box(.12,.25,.34,a,.1,b,M.dark,group);}
  function panels(x,z,y,cols,rows,parent=scene){for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){const group=new T.Group();group.position.set(x+c*1.7,y,z+r*2.25);group.rotation.x=-.16;parent.add(group);box(1.55,.09,2,0,0,0,M.metal,group);box(1.46,.105,1.91,0,.035,0,M.panel,group);for(const xx of [-.36,0,.36])box(.013,.01,1.9,xx,.095,0,M.metal,group);for(const zz of [-.47,0,.47])box(1.45,.01,.012,0,.095,zz,M.metal,group);box(.12,.6,.12,0,-.28,.65,M.metal,group);}}
  function glazing(w,d,y,h,parent){box(w+.025,h,d+.025,0,y,0,M.glass,parent);let col=0;for(let x=-w/2+.25;x<w/2;x+=1.35){for(const z of [-d/2-.035,d/2+.035]){box(.07,h,.08,x,y,z,M.ivory,parent);if(night&&(col+Math.round(y))%3===0&&x+1.2<w/2)box(.9,h*.72,.025,x+.65,y,z+(z<0?-.02:.02),M.warm,parent);}col++;}for(let z=-d/2+.2;z<d/2;z+=1.4)for(const x of [-w/2-.04,w/2+.04])box(.08,h,.07,x,y,z,M.ivory,parent);}
  function floors(w,d,n,height,parent,start=0,offset=0){
    for(let i=0;i<n;i++){
      const y=start+i*height,index=i+offset,id=index===0?'ground':`level_${index}`,layer=new T.Group();parent.add(layer);
      const slab=box(w+.65,.22,d+.65,0,y+.15,0,M.ivory,layer);slab.userData.slab=true;
      const infill=box(w,height-.2,d,0,y+height/2,0,M.concrete,layer);infill.userData.infill=true;glazing(w,d,y+height*.57,height*.56,layer);
      if(detail){
        // Keep each floor's interior in this scene so selection never rebuilds WebGL.
        const firstInterior=layer.children.length;
        const zones=floorZones(facility,id);
        zones.forEach((zone,j)=>{
          const material=mat(zone.status==='Critical'?0xe78e86:zone.status==='Attention'?0xe7bc76:0x80cbb8);
          const room=box(w/3-.18,.12,d-.55,-w/3+j*w/3,y+.31,0,material,layer);room.userData.zone=zone.id;
          if(j<2)box(.09,.65,d-.55,-w/6+j*w/3,y+.62,0,M.ivory,layer);
          box(w/3-.65,.35,.65,-w/3+j*w/3,y+.55,-d*.22,M.teal,layer);
        });
        layer.children.slice(firstInterior).forEach(o=>o.userData.interior=true);
      }
      layer.traverse(o=>{if(o.isMesh)o.userData.floor=id;});
    }
    const roof=box(w+.8,.26,d+.8,0,start+n*height,0,detail&&selectedFloor==='roof'?M.selection:M.ivory,parent);roof.userData.floor='roof';roof.userData.slab=true;
  }

  function hvac(x,y,z,parent){box(1.7,.8,1.1,x,y,z,M.stone,parent);for(let i=0;i<5;i++)box(1.4,.035,.04,x,y+.42,z-.4+i*.2,M.dark,parent);}
  function canopy(w,d,x,y,z,parent){box(w,.15,d,x,y,z,M.ivory,parent);for(const dx of [-w/2+.2,w/2-.2])box(.12,y,.12,x+dx,y/2,z+d/2-.2,M.stone,parent);}
  function build(f,parent=scene){const group=new T.Group();parent.add(group);group.userData.facility=f.id;
    const scale=detail?1.1:1;group.scale.setScalar(scale);
    const siteW=f.w+9,siteD=f.d+10;
    box(siteW+.35,.18,siteD+.35,0,0,0,M.curb,group);box(siteW,.16,siteD,0,.04,0,M.grass,group);box(f.w+4,.2,f.d+4,0,.13,0,M.paving,group);
    if(f.id!=='solar'){
      const front=siteD/2-1.8;
      box(siteW-3,.05,3.5,0,.25,front,M.asphalt,group);
      for(const side of [-1,1]){box(.5,.25,siteD-5,side*(siteW/2-.65),.25,-.5,M.hedge,group);box(.75,.16,siteD-4,side*(siteW/2-1.7),.18,-.5,M.paving,group);}
      for(let x=-f.w/2;x<=f.w/2;x+=2.4){box(.07,.02,2.6,x,.29,front,M.white,group);box(2.2,.02,.07,x+1.1,.29,front-1.3,M.white,group);}
      for(let z=-f.d/2;z<f.d/2;z+=2)box(f.w+3,.012,.035,0,.24,z,M.curb,group);
      lamp(-siteW/2+2,front,group);bench(siteW/2-2,1,Math.PI/2,group);
      person(f.w/2+1.2,3,0xac6550,group);
    }
    const architecture=new T.Group();group.add(architecture);architecture.userData.facility=f.id;
    if(f.id==='mall'){
      floors(17,11,3,1.6,architecture);box(7,1.4,7,0,5.55,0,M.glass,architecture);box(7.5,.15,7.5,0,6.3,0,M.ivory,architecture);
      for(let x=-7;x<=7;x+=1.75)box(.25,4.6,.35,x,2.4,5.6,M.stone,architecture);
      canopy(8,3,0,2,7,architecture);box(5,.65,.22,0,3.5,5.75,M.teal,architecture);panels(-7,-4,5.15,3,3,architecture);hvac(6,5.4,-3,architecture);
    }else if(f.id==='hospital'){
      floors(14,8,5,1.5,architecture);const wing=new T.Group();wing.position.set(0,0,5);architecture.add(wing);floors(6,5,2,1.5,wing);
      canopy(7,2.6,0,2.6,8.5,architecture);box(1.5,.45,.12,0,5.6,4.15,mat(0xc7595a),architecture);box(.45,1.5,.13,0,5.6,4.16,mat(0xc7595a),architecture);
      cylinder(2.4,.05,3.8,7.7,0,M.teal,architecture);box(1.6,.035,.25,3.8,7.74,0,M.white,architecture);for(const x of [3.12,4.48])box(.25,.035,1.45,x,7.74,0,M.white,architecture);hvac(-5,8,-2,architecture);
    }else if(f.id==='restaurant'){
      floors(9,6,1,2.5,architecture);box(9.8,.35,7,0,2.75,0,M.wood,architecture);box(8.5,.12,5.5,0,3,0,M.ivory,architecture);
      canopy(9,4,0,2.5,5,architecture);for(let x=-3.7;x<4;x+=.6)box(.15,.18,4,x,2.7,5,M.wood,architecture);
      for(const x of [-2.4,0,2.4]){cylinder(.65,.1,x,.95,5,M.wood,architecture);cylinder(.08,.9,x,.45,5,M.dark,architecture);for(const z of [4,6])box(.5,.55,.5,x,.5,z,M.teal,architecture);}
      box(5,.4,.13,0,2,3.1,M.teal,architecture);hvac(-3,3.4,-1.8,architecture);
    }else if(f.id==='commercial'){
      floors(13,11,2,1.45,architecture);const tower=new T.Group();tower.position.set(-1.5,2.9,-.5);architecture.add(tower);floors(8.5,7.2,9,1.35,tower,0,2);
      for(const x of [-5.9,2.9])box(.38,12.4,7.6,x,9.1,-.5,M.ivory,architecture);
      box(9.6,.6,8.1,-1.5,15.4,-.5,M.dark,architecture);canopy(6,2.6,0,2.3,6.5,architecture);panels(4,-4,3.25,2,3,architecture);hvac(-3,15.9,-2,architecture);
    }else if(f.id==='residential'){
      for(const tx of [-4.4,4.4]){const block=new T.Group();block.position.set(tx,0,0);architecture.add(block);floors(5.6,8.5,7,1.45,block);
        for(let l=0;l<7;l++)for(const z of [-4.7,4.7]){box(6.2,.17,1.5,0,l*1.45+.25,z,M.ivory,block);box(6.1,.52,.08,0,l*1.45+.61,z+(z<0?-.65:.65),M.glass,block);}
        hvac(0,10.6,-2,block);panels(-1.7,0,10.4,3,2,block);}
      box(2.2,.14,6,0,.4,0,M.wood,architecture);cylinder(.85,.15,0,.5,0,M.water,architecture);
    }else{
      box(22,.15,10,0,.25,0,M.stone,architecture);panels(-9,-3.4,1,12,4,architecture);box(3,2.3,2.4,-7,1.3,7,M.ivory,architecture);box(3.2,.15,2.6,-7,2.55,7,M.teal,architecture);
      for(let x=-11;x<=11;x+=2.3){box(.07,1.3,.07,x,.75,-5.6,M.metal,architecture);box(.07,1.3,.07,x,.75,5.6,M.metal,architecture);}
      for(const z of [-5.6,5.6])for(const y of [.55,1.25])box(22,.04,.04,0,y,z,M.metal,architecture);
      for(const x of [-11.4,11.4])for(const y of [.55,1.25])box(.04,.04,11.2,x,y,0,M.metal,architecture);
      box(2.2,1.4,1.3,6,.85,7,M.teal,architecture);box(2,1.4,1.3,9,.85,7,M.stone,architecture);
    }
    if(f.id==='mall'){parapet(17,11,4.9,0,0,architecture);for(let x=-7;x<8;x+=2.3)box(.35,3.7,.3,x,2.6,5.75,M.sandstone,architecture);}
    if(f.id==='hospital'){parapet(14,8,7.55,0,0,architecture);box(3.2,1.1,2.8,-2,8.2,-1,M.ivory,architecture);}
    if(f.id==='commercial'){parapet(9,7.6,15.75,-1.5,-.5,architecture);box(2.2,1.1,2,-1.5,16.35,-1,M.stone,architecture);for(let z=-3;z<3;z+=1.4)box(.12,12.2,.2,-5.87,9,z,M.sandstone,architecture);}
    if(f.id==='residential'){for(const tx of [-4.4,4.4]){parapet(5.7,8.6,10.25,tx,0,architecture);box(1.5,.9,1.8,tx,10.8,-2.8,M.ivory,architecture);for(let l=0;l<7;l++)box(.32,1.1,.2,tx+2.3,l*1.45+.8,4.35,M.sandstone,architecture);}}
    architecture.traverse(o=>{if(o.isMesh){o.userData.facility=f.id;hits.push(o);}});
    if(f.id!=='solar'){for(const x of [-siteW/2+1.2,siteW/2-1.2])for(const z of [-siteD/2+1.2,siteD/2-1.2])tree(x,z,.9,group);
      for(let i=0;i<5;i++){const x=(i-2)*2.2,z=siteD/2-1.5;box(.04,.02,2,x+1,.25,z,M.white,group);if(i%2===0)car(x,z,[0xe9e7db,0x526c83,0x97b3b1][i/2],false,group);}}
    const halo=box(siteW+.5,.08,siteD+.5,0,-.02,0,mat(0x24b7a2,{transparent:true,opacity:0}),group);
    halo.userData.keepSeparate=true;
    buildings.push({group,halo,spec:f});return group;
  }
  if(detail){box(44,.2,38,0,-.25,0,M.concrete);build({...spec,x:0,z:0});camera.position.multiplyScalar(spec.id==='restaurant'?.8:spec.id==='commercial'?1.2:1);home.copy(camera.position);}
  else{
    // Connected streets and usable public space replace the presentation grid.
    box(126,.4,112,0,-.45,0,mat(night?0x263c46:0xb5c69f));
    box(121,.08,107,0,-.2,0,M.paving);
    box(8,.08,68,0,-.1,18,M.road);box(8,.08,12,0,-.1,-46,M.road);
    box(118,.08,7,0,-.09,4,M.road);
    for(const x of [-56,56]){box(5,.08,101,x,-.09,0,M.road);for(const side of [-1,1])box(.6,.13,102,x+side*2.8,-.02,0,M.curb);}
    for(const z of [-48,48]){box(117,.08,5,0,-.08,z,M.road);for(const side of [-1,1])box(118,.13,.6,0,-.01,z+side*2.8,M.curb);}
    for(const x of [-5,5]){box(1.5,.13,61,x,0,20.5,M.curb);box(1.5,.13,9,x,0,-45.5,M.curb);}
    for(const z of [-.4,8.4])box(110,.13,1.3,0,.01,z,M.curb);
    for(let z=-50;z<50;z+=4.5){if(z>-41&&z<-15||z>-.5&&z<9)continue;for(const x of [-2,2])box(.11,.018,2.1,x,-.045,z,M.white);box(.07,.018,2.8,-.13,-.045,z,M.line);box(.07,.018,2.8,.13,-.045,z,M.line);}
    for(let x=-51;x<52;x+=5)if(Math.abs(x)>8)box(2.5,.018,.1,x,-.03,4,M.white);
    for(const z of [-1.5,9.8])for(let x=-3.2;x<=3.2;x+=.8)box(.5,.03,1.35,x,.06,z,M.white);
    for(const x of [-6.8,6.8])for(let z=1;z<7;z+=.8)box(1.45,.03,.45,x,.06,z,M.white);
    // Roundabout: traffic goes around the landscaped island rather than through it.
    ring(8,12.1,0,-.09,-28,M.curb);ring(8.35,11.8,0,-.045,-28,M.road);
    ring(9.95,10.02,0,-.01,-28,M.white);cylinder(8,.16,0,.01,-28,M.grass);
    ring(6.6,7.7,0,.12,-28,M.paving);ring(5.2,5.45,0,.14,-28,M.curb);
    const pond=cylinder(5.2,.1,0,.16,-28,M.water);pond.scale.z=.73;
    for(let i=0;i<7;i++){const a=i*Math.PI*2/7;tree(Math.cos(a)*6,-28+Math.sin(a)*6,.72);}
    bench(-4.6,-24.2,.6);bench(4.6,-31.8,Math.PI+.6);
    // Paths and access drives meet the same road network as each building's parking.
    for(const f of FACILITIES){const side=Math.sign(f.x),edge=f.x-side*(f.w+9)/2;
      if(!['restaurant','solar'].includes(f.id)){const z=f.z+(f.d+10)/2-2;box(Math.abs(edge)-3.8,.08,3.2,(edge+side*3.8)/2,.16,z,M.asphalt);}
      else{const outer=f.x+side*(f.w+9)/2;box(56-Math.abs(outer),.08,3.2,(outer+side*56)/2,.16,f.z+2,M.asphalt);}
    }
    FACILITIES.forEach(f=>{const g=build(f);g.position.set(f.x,0,f.z);});
    for(const z of [-44,-10,18,36]){car(-1.1,z,0x496a79);if(z>-15)car(1.15,z+5,0xf1efe7);}
    for(const x of [-44,-14,18,44])car(x,5.6,[0xd5bda2,0xf0ede7,0x437c91,0xa64b42][Math.floor((x+44)/25)%4],true);
    car(-56,-10,0xb8bec4);car(56,30,0x455c6e);car(-18,48,0x916c53,true);
    for(const x of [-7,7])for(let z=-10;z<44;z+=9){palm(x,z,.8);lamp(x*1.12,z+3);}
    for(const z of [-2.5,11])for(let x=-45;x<47;x+=12)if(Math.abs(x)>9){tree(x,z,.8);lamp(x+3,z);}
    // Perimeter planting gives the district a believable edge and screens service access.
    for(const side of [-1,1]){
      box(2,.06,84,side*51,.01,0,M.grass);
      box(11,.08,15,side*44,.01,-12,M.grass);
      box(1.3,.12,16,side*44,.05,-12,M.curb);
      for(const z of [-18,-12,-6]){tree(side*47,z,1.1);bench(side*41,z,side*Math.PI/2);}
      // Visitor parking courts with an aisle, planted islands and marked stalls.
      box(12,.07,24,side*43,.04,28,M.asphalt);
      for(const row of [-1,1])for(let i=0;i<8;i++){
        const z=18.5+i*2.6,x=side*43+row*4;
        box(3.4,.018,.07,x,.09,z-1.2,M.white);
        box(.07,.018,2.5,x+row*1.65,.09,z,M.white);
        if(i%3!==1)car(x,z,[0xefece3,0x5a7180,0xaa6755,0x858c7c][(i+(row+1))%4],true);
      }
      for(const z of [15.4,40.6]){box(11,.18,1.8,side*43,.13,z,M.curb);box(10.4,.12,1.3,side*43,.24,z,M.grass);tree(side*46,z,.8);tree(side*40,z,.8);}
      box(3.5,.07,6,side*43,.04,12,M.asphalt);
    }
    for(let x=-50;x<=50;x+=7){tree(x,-53,.9+(Math.abs(x)%3)*.1);tree(x,53,.9);}
    for(const x of [-61,61])for(let z=-43;z<=43;z+=8)tree(x,z,.85);
    // Sheltered bus stop, pedestrian furniture and a small pocket plaza.
    box(6,.15,3,-43,.12,12,M.paving);box(5.5,.15,2.5,-43,2.5,12,M.dark);
    for(const x of [-45.4,-40.6])box(.1,2.4,.1,x,1.25,12.9,M.metal);
    box(5.3,1.7,.08,-43,1.4,13,M.glass);bench(-43,12.4);
    for(const [x,z] of [[-42,10.8],[-11,10],[8,-5],[30,-2]])person(x,z,0xa36452);
    for(const x of [-9,9])for(const z of [-1,9]){cylinder(.07,2.6,x,1.3,z,M.dark);box(.26,.85,.22,x,2.5,z,M.dark);box(.18,.15,.04,x,2.7,z+.13,mat(0xd98845));}
  }
  // Batch static architecture by material and picking identity. The township has
  // many facade/panel details; one draw call per component would block interaction.
  scene.updateMatrixWorld(true);
  const batches=new Map(),originals=[],retained=new Set(),floorMeshes=[];
  scene.traverse(o=>{if(!o.visible)return;if(!o.isMesh||o.userData.keepSeparate){if(o.geometry)retained.add(o.geometry);return;}originals.push(o);const key=[o.material.uuid,o.userData.facility||'',o.userData.floor||'',o.userData.zone||'',!!o.userData.infill,!!o.userData.interior,!!o.userData.slab].join('|');if(!batches.has(key))batches.set(key,{material:o.material,facility:o.userData.facility,floor:o.userData.floor,zone:o.userData.zone,infill:o.userData.infill,interior:o.userData.interior,slab:o.userData.slab,parts:[]});const g=(o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone()).applyMatrix4(o.matrixWorld);batches.get(key).parts.push(g);});
  hits.length=0;
  for(const batch of batches.values()){
    const geometry=new T.BufferGeometry();for(const name of ['position','normal','uv']){const attrs=batch.parts.map(g=>g.getAttribute(name));if(attrs.some(a=>!a))continue;const values=new Float32Array(attrs.reduce((sum,a)=>sum+a.array.length,0));let offset=0;for(const a of attrs){values.set(a.array,offset);offset+=a.array.length;}geometry.setAttribute(name,new T.BufferAttribute(values,attrs[0].itemSize));}
    const combined=new T.Mesh(geometry,batch.material);combined.castShadow=true;combined.receiveShadow=true;combined.userData={facility:batch.facility,floor:batch.floor,zone:batch.zone,infill:batch.infill,interior:batch.interior,slab:batch.slab};scene.add(combined);if(batch.floor)floorMeshes.push(combined);retained.add(geometry);if(batch.facility)hits.push(combined);batch.parts.forEach(g=>g.dispose());
  }
  originals.forEach(o=>o.parent.remove(o));geometries.forEach(g=>{if(!retained.has(g))g.dispose()});geometries.splice(0,geometries.length,...retained);batches.clear();originals.length=0;
  // The simulator uses this same facility scene, with only the proposed
  // equipment added. Keep its geometry separate from the static batch so the
  // Before/After control can toggle it without rebuilding the building.
  let setInstallation=()=>{};
  if(detail&&installation){
    const roof={
      mall:{y:6.5,xs:[-2.6,-1.1,.4,1.9],zs:[-2,0]},
      hospital:{y:7.7,xs:[-5.2,-3.7,-2.2],zs:[.3,2.1]},
      restaurant:{y:3.2,xs:[-2.4,-.9,.6,2.1],zs:[-1.5,.3]},
      commercial:{y:15.8,xs:[-4.2,-2.7,-1.2,.3],zs:[-2.8,-1]},
      residential:{y:10.4,xs:[3.3,4.8,6.3],zs:[-2.8,-1]},
      solar:{y:2.8,xs:[-8.2,-6.7],zs:[6.4]},
    }[facility];
    const layer=new T.Group(),solarLayer=new T.Group(),batteryLayer=new T.Group(),evLayer=new T.Group();
    layer.scale.setScalar(1.1);scene.add(layer);layer.add(solarLayer,batteryLayer,evLayer);
    const positions=roof.zs.flatMap(z=>roof.xs.map(x=>[x,z]));
    const solarPanels=positions.map(([x,z])=>{
      const panel=new T.Group();panel.position.set(x,roof.y,z);panel.rotation.x=-.12;solarLayer.add(panel);
      box(1.28,.09,1.5,0,0,0,M.metal,panel);
      box(1.18,.06,1.4,0,.07,0,M.panel,panel);
      box(.06,.17,.06,-.46,-.1,.5,M.stone,panel);
      box(.06,.17,.06,.46,-.1,.5,M.stone,panel);
      return panel;
    });
    const batteryX=facility==='solar'?13:spec.w/2+2;
    const batteryZ=facility==='restaurant'?3:facility==='mall'?5:facility==='residential'?6:spec.d/2+1;
    box(1.8,2.2,1.2,batteryX,1.15,batteryZ,M.teal,batteryLayer);
    box(1.5,.12,1.26,batteryX,2.32,batteryZ,M.dark,batteryLayer);
    for(let i=0;i<4;i++)box(1.4,.035,.035,batteryX,.6+i*.36,batteryZ+.63,M.ivory,batteryLayer);
    const chargers=Array.from({length:8},(_,i)=>{
      const charger=new T.Group();charger.position.set((i-3.5)*1.5,0,spec.d/2+2.7);evLayer.add(charger);
      box(.38,1.15,.26,0,.72,0,M.teal,charger);box(.25,.28,.03,0,.98,.15,M.panel,charger);
      box(.08,.8,.08,.28,.68,.12,M.dark,charger);box(.3,.08,.08,.17,1.1,.12,M.dark,charger);
      return charger;
    });
    setInstallation=next=>{
      solarLayer.visible=!!(next.after&&next.solar&&next.capacity>0);
      batteryLayer.visible=!!(next.after&&next.battery&&next.batteryKwh>0);
      evLayer.visible=!!(next.after&&next.ev&&next.evCount>0);
      const count=Math.min(solarPanels.length,Math.max(1,Math.ceil((Number(next.capacity)||0)/60)));
      solarPanels.forEach((panel,i)=>{panel.visible=i<count;panel.rotation.x=-(Number(next.tilt??10))*Math.PI/180;});
      chargers.forEach((charger,i)=>charger.visible=i<Math.min(next.evCount||0,8));
      dirty=true;renderer.shadowMap.needsUpdate=true;
    };
    setInstallation(installation);
  }
  const cutPlane=new T.Plane(new T.Vector3(0,-1,0),40);
  renderer.localClippingEnabled=true;
  let activeFloor=selectedFloor,floorMotion=null;
  const wholePose={position:initialView?.wholePosition?new T.Vector3().fromArray(initialView.wholePosition):home.clone(),target:initialView?.wholeTarget?new T.Vector3().fromArray(initialView.wholeTarget):look.clone()};
  const storeyY=id=>{
    if(id==='roof')return ({mall:6.3,hospital:7.7,restaurant:3,commercial:15.4,residential:10.6}[facility]||0)*1.1;
    const i=id==='ground'?0:Number(id.split('_')[1]);
    return (facility==='commercial'?(i<2?i*1.45:2.9+(i-2)*1.35):i*(facility==='mall'?1.6:facility==='hospital'?1.5:facility==='restaurant'?2.5:1.45))*1.1;
  };
  const cutHeight=id=>id==='whole'||id==='roof'?40:storeyY(id)+1.045;
  function showFloor(id){
    for(const mesh of floorMeshes){const d=mesh.userData;
      mesh.visible=d.interior?d.floor===id:d.infill?d.floor!==id:true;
      if(d.slab)mesh.material=d.floor===id?M.selection:M.ivory;
    }
    dirty=true;renderer.shadowMap.needsUpdate=true;
  }
  function setFloor(id){
    if(!detail||facility==='solar'||!floorOptions(facility).some(f=>f.id===id)||id===activeFloor)return;
    if(activeFloor==='whole'&&!floorMotion){wholePose.position.copy(camera.position);wholePose.target.copy(controls.target);}
    activeFloor=id;showFloor(id);controls.autoRotate=false;controls.enableDamping=false;controls.update();
    const target=id==='whole'?wholePose.target.clone():new T.Vector3(facility==='commercial'&&id!=='ground'&&id!=='level_1'?-1.65:0,storeyY(id)+.45,0);
    const offset=camera.position.clone().sub(controls.target);offset.y=0;if(offset.lengthSq()<.01)offset.set(1,0,1);offset.normalize();
    const width=facility==='commercial'&&id!=='ground'&&id!=='level_1'?9:spec.w;
    const distance=Math.max(width*1.55,18);
    const destination=id==='whole'?wholePose.position.clone():target.clone().add(new T.Vector3(offset.x*distance,distance*.85,offset.z*distance));
    floorMotion={start:performance.now(),from:camera.position.clone(),fromTarget:controls.target.clone(),to:destination,toTarget:target,fromCut:renderer.clippingPlanes.length?cutPlane.constant:40,toCut:cutHeight(id)};
    renderer.clippingPlanes=[cutPlane];controls.enabled=false;
  }
  if(detail){showFloor(activeFloor);cutPlane.constant=cutHeight(activeFloor);renderer.clippingPlanes=[cutPlane];}
  if(detail&&initialView){camera.position.fromArray(initialView.position);controls.target.fromArray(initialView.target);controls.update();}
  const energyFlows=[];let lastEnergyFrame=0;
  if(!detail&&energyNetwork){
    for(const link of energyNetwork.links){
      const from=FACILITIES.find(f=>f.id===link.source),to=FACILITIES.find(f=>f.id===link.target);
      if(!from||!to)continue;
      const start=new T.Vector3(from.x,3,from.z),end=new T.Vector3(to.x,5,to.z);
      const mid=start.clone().lerp(end,.5);mid.y=13;
      const curve=new T.QuadraticBezierCurve3(start,mid,end);
      if(actionFocus){
        // Mesh tubes retain their width on Windows/WebGL, where native line
        // widths are commonly restricted to one pixel. Core is about 3px at home.
        const tube=(radius,color,opacity)=>{
          const g=new T.TubeGeometry(curve,64,radius,8,false);geometries.push(g);
          const m=new T.MeshBasicMaterial({color,transparent:true,opacity,depthWrite:false});materials.push(m);
          const o=new T.Mesh(g,m);o.renderOrder=2;scene.add(o);return o;
        };
        tube(.44,0x53d995,.13);
        tube(.22,0x189d59,.95);
        const packets=Array.from({length:3},(_,i)=>{
          const head=mesh(new T.ConeGeometry(.43,1.35,8),mat(0x52efad,{emissive:0x21bf74,emissiveIntensity:.85}),0,0,0);
          const trails=[.22,.13].map((r,j)=>{
            const g=new T.SphereGeometry(r,8,6);geometries.push(g);
            const m=new T.MeshBasicMaterial({color:0x76f3bb,transparent:true,opacity:.6-j*.2,depthWrite:false});materials.push(m);
            const o=new T.Mesh(g,m);scene.add(o);return o;
          });
          const phase=(i+.5)/3;
          head.position.copy(curve.getPointAt(phase));head.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),curve.getTangentAt(phase));
          trails.forEach((o,j)=>o.position.copy(curve.getPointAt((phase-(j+1)*.022+1)%1)));
          return {head,trails,phase};
        });
        const rings=[start,end].flatMap((point,endpoint)=>[0,.5].map(offset=>{
          const g=new T.RingGeometry(.5,.66,32);geometries.push(g);
          const m=new T.MeshBasicMaterial({color:0x32bf7b,transparent:true,opacity:.4,side:T.DoubleSide,depthWrite:false});materials.push(m);
          const o=new T.Mesh(g,m);o.rotation.x=-Math.PI/2;o.position.copy(point);scene.add(o);
          return {object:o,offset:offset+endpoint*.2};
        }));
        energyFlows.push({curve,packets,rings});
        continue;
      }
      const g=new T.BufferGeometry().setFromPoints(curve.getPoints(48));geometries.push(g);
      const m=link.status==='approved'?new T.LineBasicMaterial({color:0x219653,transparent:true,opacity:.9}):new T.LineDashedMaterial({color:0x219653,dashSize:1,gapSize:.7,transparent:true,opacity:.65});materials.push(m);
      const line=new T.Line(g,m);line.computeLineDistances();scene.add(line);
      const bead=mesh(new T.SphereGeometry(.32,10,8),mat(0x43ce83,{emissive:0x176e36,emissiveIntensity:.4}),0,0,0);bead.userData.keepSeparate=true;bead.position.copy(curve.getPoint(.5));
      energyFlows.push({curve,bead});
    }
  }
  if(!detail&&actionFocus?.target&&actionFocus.floor!=='whole'){
    const f=FACILITIES.find(f=>f.id===actionFocus.target);
    if(f&&f.id!=='solar'){
      const i=actionFocus.floor==='ground'?0:Number(actionFocus.floor.split('_')[1]);
      const roof={mall:6.3,hospital:7.7,restaurant:3,commercial:15.4,residential:10.6};
      const y=actionFocus.floor==='roof'?roof[f.id]:f.id==='commercial'?(i<2?i*1.45:2.9+(i-2)*1.35):i*(f.id==='mall'?1.6:f.id==='hospital'?1.5:f.id==='restaurant'?2.5:1.45);
      const tower=f.id==='commercial'&&i>=2;
      const base=new T.BoxGeometry(tower?9.4:f.w+.9,.3,tower?8.1:f.d+.9);
      const edges=new T.EdgesGeometry(base);base.dispose();geometries.push(edges);
      const material=new T.LineBasicMaterial({color:actionFocus.after?0x228d4e:0xd6a00e,depthTest:false});materials.push(material);
      const outline=new T.LineSegments(edges,material);outline.position.set(f.x+(tower?-1.5:0),y+.35,f.z+(tower?-.5:0));outline.renderOrder=5;scene.add(outline);
    }
  }
  const overlay=container.parentElement.querySelector('.township-labels');
  if(!detail&&overlay)FACILITIES.forEach(f=>{const b=document.createElement('button');b.className=`township-pin pin-${f.id}${actionFocus?.target===f.id?' action-target'+(actionFocus.after?' action-preview-after':''):''}${actionFocus?.sources?.includes(f.id)?' action-source':''}`;b.style.setProperty('--facility-color',f.color);b.innerHTML=`<span class="township-energy-badge">${energySymbol(energyNetwork?.buildings.find(b=>b.facility_id===f.id)?.mode||'grid')}<span>${(energyNetwork?.buildings.find(b=>b.facility_id===f.id)?.mode||'grid').replace(/^./,c=>c.toUpperCase())}</span></span><i></i><span><span class="pin-name">${f.name}</span><small class="pin-type">${f.type}</small></span><b>↗</b>`;if(!navigation)b.setAttribute('aria-disabled','true');if(actionFocus?.target===f.id&&actionFocus.floor!=='whole'){const tag=document.createElement('small');tag.className='pin-action-floor';tag.textContent=(actionFocus.after?'Preview: ':'Target: ')+actionFocus.floor.replace('level_','Level ').replace('ground','Ground').replace('roof','Roof');b.querySelector('.pin-name').parentElement.appendChild(tag);}b.setAttribute('aria-label',`Explore ${f.type}: ${f.name}`);b.onclick=()=>enter(f.id);overlay.appendChild(b);const point=new T.Vector3(f.x,f.id==='commercial'?17:f.id==='residential'?12:f.id==='hospital'?10:f.id==='mall'?8:4,f.z);labels.push({element:b,point});const alerts=facilityAlerts(f.id);if(alerts.length){const marker=document.createElement('button');marker.className='township-alert-marker';marker.innerHTML='<span aria-hidden="true">⚠</span><small>'+alerts.length+'</small>';marker.setAttribute('aria-label',`${f.name}: ${alerts.length} alerts. Open ${alerts[0].floorLabel}, ${alerts[0].name}`);marker.title=`${alerts[0].floorLabel} · ${alerts[0].issue}`;marker.onclick=()=>enter(f.id,true);overlay.appendChild(marker);labels.push({element:marker,point:point.clone()});b.classList.add('has-alert');}});
  let transition=null,disposed=false,frame,down=null,hover=null;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const focusPose=f=>({position:new T.Vector3(f.x+19,23,f.z+22),target:new T.Vector3(f.x,4,f.z)});
  function enter(id,focusAlert=false){if(!navigation||transition||disposed)return;const f=FACILITIES.find(x=>x.id===id);if(!f)return;
    controls.enabled=false;container.parentElement.classList.add('entering');labels.forEach(l=>l.element.disabled=true);
    const pose=focusPose(f);
    transition={kind:'enter',start:performance.now(),from:camera.position.clone(),fromTarget:controls.target.clone(),to:pose.position,toTarget:pose.target,id,focusAlert};
  }
  const ray=new T.Raycaster(),pointer=new T.Vector2();
  function intersect(e){const rect=renderer.domElement.getBoundingClientRect();pointer.set((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);ray.setFromCamera(pointer,camera);return ray.intersectObjects(hits).find(hit=>hit.object.visible&&(!renderer.clippingPlanes.length||renderer.clippingPlanes.every(p=>p.distanceToPoint(hit.point)>=0)));}
  const downHandler=e=>{down=[e.clientX,e.clientY];};
  const upHandler=e=>{if(transition||floorMotion||!down||Math.hypot(e.clientX-down[0],e.clientY-down[1])>6)return;const hit=intersect(e);if(hit){if(detail){const data=hit.object.userData;if(data.zone)onRoom(data.zone);else if(data.floor)onFloor(data.floor);}else enter(hit.object.userData.facility);}};
  const moveHandler=e=>{if(transition)return;const hit=intersect(e),id=hit?.object.userData.facility;renderer.domElement.style.cursor=hit&&navigation?'pointer':'grab';if(id!==hover){hover=id;buildings.forEach(b=>b.halo.material.opacity=b.spec.id===id ? .45 : 0);dirty=true;}};
  renderer.domElement.addEventListener('pointerdown',downHandler);renderer.domElement.addEventListener('pointerup',upHandler);renderer.domElement.addEventListener('pointermove',moveHandler);
  const resize=()=>{const w=container.clientWidth,h=container.clientHeight;if(!w||!h)return;camera.aspect=w/h;camera.updateProjectionMatrix();renderer.setSize(w,h,false);dirty=true;if(!detail&&!transition){const distance=Math.max(88,125/camera.aspect)/(2*Math.tan(camera.fov*Math.PI/360));camera.position.copy(home).normalize().multiplyScalar(distance);controls.update();}};
  const observer=new ResizeObserver(resize);observer.observe(container);resize();
  // Recreate the township at the entry camera's close-up position, then retrace
  // its exact path to the saved overview pose. No DOM snapshot/fade is involved.
  if(!detail&&returnFrom){const f=FACILITIES.find(x=>x.id===returnFrom);if(f){
    const pose=focusPose(f),destination=returnView?.position?new T.Vector3().fromArray(returnView.position):camera.position.clone(),target=returnView?.target?new T.Vector3().fromArray(returnView.target):controls.target.clone();
    camera.position.copy(pose.position);controls.target.copy(pose.target);camera.lookAt(controls.target);
    controls.enabled=false;container.parentElement.classList.add('entering');labels.forEach(l=>l.element.disabled=true);
    transition={kind:'return',start:performance.now(),from:pose.position,fromTarget:pose.target,to:destination,toTarget:target,id:f.id};
  }}
  function animate(now){if(disposed)return;
    if(floorMotion){
      dirty=true;const motion=floorMotion,t=reduced?1:Math.min(1,(now-motion.start)/950),ease=t*t*t*(t*(t*6-15)+10);
      camera.position.lerpVectors(motion.from,motion.to,ease);controls.target.lerpVectors(motion.fromTarget,motion.toTarget,ease);camera.lookAt(controls.target);
      cutPlane.constant=motion.fromCut+(motion.toCut-motion.fromCut)*ease;
      if(t===1){floorMotion=null;controls.enabled=true;controls.update();controls.enableDamping=true;renderer.clippingPlanes=[cutPlane];renderer.shadowMap.needsUpdate=true;}
    }
    else if(transition){dirty=true;const t=reduced?1:Math.min(1,(now-transition.start)/950),ease=t*t*(3-2*t);camera.position.lerpVectors(transition.from,transition.to,ease);controls.target.lerpVectors(transition.fromTarget,transition.toTarget,ease);camera.lookAt(controls.target);if(t===1){const completed=transition;transition=null;if(completed.kind==='enter'){onEnter(completed.id,{position:completed.from.toArray(),target:completed.fromTarget.toArray()},completed.focusAlert);if(disposed)return;}else{controls.enabled=true;container.parentElement.classList.remove('entering');labels.forEach(l=>l.element.disabled=false);}}}
    else controls.update();
    if(energyFlows.length&&!reduced&&now-lastEnergyFrame>(actionFocus?33:50)){
      lastEnergyFrame=now;
      energyFlows.forEach(({curve,bead,packets,rings},i)=>{
        if(bead)bead.position.copy(curve.getPoint((now*.00016+i*.45)%1));
        packets?.forEach(({head,trails,phase})=>{
          const t=(now*.00024+phase)%1;
          head.position.copy(curve.getPointAt(t));head.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),curve.getTangentAt(t));
          trails.forEach((o,j)=>o.position.copy(curve.getPointAt((t-(j+1)*.022+1)%1)));
        });
        rings?.forEach(({object,offset})=>{const t=(now*.0006+offset)%1;object.scale.setScalar(.8+t*1.7);object.material.opacity=(1-t)*.4;});
      });
      dirty=true;
    }
    if(dirty){for(const l of labels){const p=l.point.clone().project(camera);l.element.style.left=`${(p.x+1)*50}%`;l.element.style.top=`${(1-p.y)*50}%`;l.element.style.visibility=p.z>1||Math.abs(p.x)>1||Math.abs(p.y)>1?'hidden':'visible';}renderer.render(scene,camera);dirty=false;}frame=requestAnimationFrame(animate);
  }
  frame=requestAnimationFrame(animate);
  return {enter,setFloor,setInstallation,getView(){return {facility,position:camera.position.toArray(),target:controls.target.toArray(),wholePosition:wholePose.position.toArray(),wholeTarget:wholePose.target.toArray()}},zoom(f){if(transition||floorMotion)return;camera.position.sub(controls.target).multiplyScalar(f).add(controls.target);controls.update();},reset(){if(floorMotion)return;if(detail&&activeFloor!=='whole'){onFloor('whole');return;}if(transition)return;camera.position.copy(home);controls.target.copy(look);resize();controls.update();},rotate(){if(transition||floorMotion)return;controls.autoRotate=!controls.autoRotate;controls.autoRotateSpeed=.65;},dispose(){disposed=true;cancelAnimationFrame(frame);observer.disconnect();controls.dispose();renderer.domElement.removeEventListener('pointerdown',downHandler);renderer.domElement.removeEventListener('pointerup',upHandler);renderer.domElement.removeEventListener('pointermove',moveHandler);labels.forEach(l=>l.element.remove());geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());renderer.dispose();renderer.forceContextLoss();renderer.domElement.remove();}};
}
