import '../vendor/three.min.js';
import '../vendor/OrbitControls.js';
import { floorZones, floorOptions, facilityAlerts } from './floor_conditions.js?v=alert-approval-16';

export const FACILITIES = [
  {id:'mall',name:'Nexora Galleria',type:'Shopping mall',color:'#e96b12',x:-23,z:-13,w:18,d:13},
  {id:'hospital',name:'Nexora Medical Centre',type:'Hospital',color:'#d95c10',x:23,z:-13,w:16,d:13},
  {id:'restaurant',name:'The Garden Kitchen',type:'Restaurant',color:'#f2a13a',x:-40,z:-31,w:10,d:7},
  {id:'commercial',name:'Nexora Exchange',type:'Commercial buildings',color:'#c94e08',x:-23,z:22,w:15,d:13},
  {id:'residential',name:'Nexora Residences',type:'Residential buildings',color:'#e58a35',x:23,z:22,w:16,d:13},
  {id:'solar',name:'Nexora Solar Park',type:'Solar farm',color:'#b85a1d',x:35,z:-32,w:23,d:9},
];

/** Concept geometry, independent of the selected historical benchmark data. */
export function mountSpatialTwin(container,{facility=null,night=false,selectedFloor='whole',initialView=null,onRoom=()=>{},onEnter=()=>{},onFloor=()=>{},returnFrom=null,returnView=null}={}) {
  if(!container||!window.THREE)return null;
  const T=window.THREE, detail=!!facility, spec=FACILITIES.find(f=>f.id===facility)||FACILITIES[0];
  let renderer;
  try{renderer=new T.WebGLRenderer({antialias:true,alpha:false});}catch{return null;}
  const scene=new T.Scene();scene.background=new T.Color(night?0x34261f:0xfff8f1);
  renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.7));renderer.outputEncoding=T.sRGBEncoding;
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate=false;renderer.shadowMap.needsUpdate=true;
  renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=night?1.05:.9;
  container.appendChild(renderer.domElement);renderer.domElement.setAttribute('aria-label',detail?`${spec.type} 3D model; drag to rotate, scroll to zoom`:'Interactive 3D township. Select a building to explore.');
  const camera=new T.PerspectiveCamera(detail?34:37,1,.1,500);
  const home=detail?new T.Vector3(31,29,36):new T.Vector3(0,105,112);
  const look=detail?new T.Vector3(0,4,0):new T.Vector3(0,0,-2);
  camera.position.copy(home);
  const controls=new T.OrbitControls(camera,renderer.domElement);controls.target.copy(look);controls.enableDamping=true;controls.dampingFactor=.075;
  let dirty=true;const changed=()=>{dirty=true};controls.addEventListener('change',changed);
  controls.enablePan=!detail;controls.minDistance=detail?16:65;controls.maxDistance=detail?85:340;controls.maxPolarAngle=Math.PI*.47;
  const hemisphere=new T.HemisphereLight(night?0xaac8ee:0xe4f3ff,night?0x293629:0xb4bbaa,night ? .18 : .65);scene.add(hemisphere);
  const sun=new T.DirectionalLight(night?0xa2beeb:0xfff8e7,night ? .22 : .85);sun.position.set(-35,70,38);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);
  Object.assign(sun.shadow.camera,{left:-75,right:75,top:75,bottom:-75,near:1,far:180});sun.shadow.bias=-.0004;sun.shadow.normalBias=.06;scene.add(sun);
  const geometries=[],materials=[],hits=[],labels=[],buildings=[];
  const mat=(color,opts={})=>{const m=new T.MeshStandardMaterial({color,roughness:.72,...opts});materials.push(m);return m;};
  const M={ivory:mat(0xfffcf8),concrete:mat(0xd8cfc5),stone:mat(0xa99a8c),dark:mat(0x5e4c3d),glass:mat(night?0x513d31:0x9f7559,{metalness:.25,roughness:.28,emissive:night?0x9e5422:0x000000,emissiveIntensity:.38}),warm:mat(0xffc078,{emissive:night?0xff9d3c:0x000000,emissiveIntensity:.55}),teal:mat(0xe96b12),wood:mat(0x926947),grass:mat(0xa6b18a),leaf:mat(0x698c5d),leaf2:mat(0x95a978),trunk:mat(0x93745b),road:mat(0x82776d),line:mat(0xfff7e9),panel:mat(0x174766,{metalness:.42,roughness:.3}),metal:mat(0xb8aa9d,{metalness:.45,roughness:.5}),water:mat(0xe3a66d,{metalness:.2,roughness:.3}),white:mat(0xffffff),selection:mat(0xffbb80)};
  function mesh(g,m,x,y,z,parent=scene){geometries.push(g);const o=new T.Mesh(g,m);o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o;}
  const box=(w,h,d,x,y,z,m,parent=scene)=>mesh(new T.BoxGeometry(w,h,d),m,x,y,z,parent);
  const cylinder=(r,h,x,y,z,m,parent=scene)=>mesh(new T.CylinderGeometry(r,r,h,24),m,x,y,z,parent);
  function tree(x,z,s=1,parent=scene){cylinder(.12*s,1.35*s,x,.7*s,z,M.trunk,parent);mesh(new T.IcosahedronGeometry(.92*s,1),M.leaf,x,1.8*s,z,parent);mesh(new T.IcosahedronGeometry(.72*s,1),M.leaf2,x+.32*s,2.3*s,z,parent);}
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
    box(siteW,.16,siteD,0,.02,0,M.grass,group);box(f.w+4,.2,f.d+4,0,.13,0,M.concrete,group);
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
    }
    architecture.traverse(o=>{if(o.isMesh){o.userData.facility=f.id;hits.push(o);}});
    if(f.id!=='solar'){for(const x of [-siteW/2+1.2,siteW/2-1.2])for(const z of [-siteD/2+1.2,siteD/2-1.2])tree(x,z,.9,group);
      for(let i=0;i<5;i++){const x=(i-2)*2.2,z=siteD/2-1.5;box(.04,.02,2,x+1,.25,z,M.white,group);if(i%2===0)car(x,z,[0xe9e7db,0x526c83,0x97b3b1][i/2],false,group);}}
    const halo=box(siteW+.5,.08,siteD+.5,0,-.02,0,mat(0x24b7a2,{transparent:true,opacity:0}),group);
    halo.userData.keepSeparate=true;
    buildings.push({group,halo,spec:f});return group;
  }
  if(detail){box(44,.2,38,0,-.25,0,M.concrete);build({...spec,x:0,z:0});camera.position.multiplyScalar(spec.id==='restaurant'?.8:spec.id==='commercial'?1.2:1);home.copy(camera.position);}
  else{
    box(110,.3,92,0,-.4,0,mat(night?0x49382d:0xfff1e3));const grid=new T.GridHelper(110,55,night?0x805735:0xe4c9b0,night?0x674b38:0xf0ddca);grid.position.y=-.22;scene.add(grid);geometries.push(grid.geometry);materials.push(grid.material);
    box(8,.07,92,0,-.12,0,M.road);box(110,.07,7,0,-.1,4,M.road);
    for(const x of [-4.5,4.5])box(.8,.09,92,x,-.06,0,M.concrete);for(const z of [-.2,8.2])box(110,.09,.8,0,-.03,z,M.concrete);
    for(const x of [-.15,.15])box(.07,.015,92,x,-.065,0,M.line);for(let z=-44;z<45;z+=5){box(.12,.02,2.4,-2,-.06,z,M.white);box(.12,.02,2.4,2,-.06,z,M.white);}
    for(let x=-53;x<54;x+=5)if(Math.abs(x)>7)box(2.5,.02,.12,x,-.04,4,M.white);
    for(const z of [-1.4,9.5])for(let x=-3.2;x<=3.2;x+=.8)box(.5,.03,1.4,x,.03,z,M.white);
    for(const x of [-6,6])for(let z=1;z<7;z+=.8)box(1.5,.03,.45,x,.03,z,M.white);
    // Quiet central park, paths and a shallow landscaped pond.
    cylinder(9,.1,0,.04,-28,M.grass);const pond=cylinder(6.3,.1,0,.14,-28,M.water);pond.scale.z=.7;
    for(let i=0;i<12;i++){const a=i*Math.PI/6;tree(Math.cos(a)*8,-28+Math.sin(a)*8,.75);}
    FACILITIES.forEach(f=>{const g=build(f);g.position.set(f.x,0,f.z);});
    for(const z of [-39,-8,15,38]){car(-1.05,z,0x466a79);car(1.1,z+6,0xf1efe7);}
    for(const x of [-45,-9,12,43])car(x,5.6,0xd2b9a1,true);
    for(const x of [-7,7])for(let z=-12;z<43;z+=8)tree(x,z,.65);
    for(const z of [-1.2,9.2])for(let x=-49;x<50;x+=10)if(Math.abs(x)>8){cylinder(.045,2.7,x,1.35,z,M.stone);box(.65,.13,.28,x,2.7,z,M.ivory);}
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
  const overlay=container.parentElement.querySelector('.township-labels');
  if(!detail&&overlay)FACILITIES.forEach(f=>{const b=document.createElement('button');b.className=`township-pin pin-${f.id}`;b.style.setProperty('--facility-color',f.color);b.innerHTML=`<i></i><span><span class="pin-name">${f.name}</span><small class="pin-type">${f.type}</small></span><b>↗</b>`;b.setAttribute('aria-label',`Explore ${f.type}: ${f.name}`);b.onclick=()=>enter(f.id);overlay.appendChild(b);const point=new T.Vector3(f.x,f.id==='commercial'?17:f.id==='residential'?12:f.id==='hospital'?10:f.id==='mall'?8:4,f.z);labels.push({element:b,point});const alerts=facilityAlerts(f.id);if(alerts.length){const marker=document.createElement('button');marker.className='township-alert-marker';marker.innerHTML='<span aria-hidden="true">⚠</span><small>'+alerts.length+'</small>';marker.setAttribute('aria-label',`${f.name}: ${alerts.length} alerts. Open ${alerts[0].floorLabel}, ${alerts[0].name}`);marker.title=`${alerts[0].floorLabel} · ${alerts[0].issue}`;marker.onclick=()=>enter(f.id,true);overlay.appendChild(marker);labels.push({element:marker,point:point.clone()});b.classList.add('has-alert');}});
  let transition=null,disposed=false,frame,down=null,hover=null;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const focusPose=f=>({position:new T.Vector3(f.x+19,23,f.z+22),target:new T.Vector3(f.x,4,f.z)});
  function enter(id,focusAlert=false){if(transition||disposed)return;const f=FACILITIES.find(x=>x.id===id);if(!f)return;
    controls.enabled=false;container.parentElement.classList.add('entering');labels.forEach(l=>l.element.disabled=true);
    const pose=focusPose(f);
    transition={kind:'enter',start:performance.now(),from:camera.position.clone(),fromTarget:controls.target.clone(),to:pose.position,toTarget:pose.target,id,focusAlert};
  }
  const ray=new T.Raycaster(),pointer=new T.Vector2();
  function intersect(e){const rect=renderer.domElement.getBoundingClientRect();pointer.set((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);ray.setFromCamera(pointer,camera);return ray.intersectObjects(hits).find(hit=>hit.object.visible&&(!renderer.clippingPlanes.length||renderer.clippingPlanes.every(p=>p.distanceToPoint(hit.point)>=0)));}
  const downHandler=e=>{down=[e.clientX,e.clientY];};
  const upHandler=e=>{if(transition||floorMotion||!down||Math.hypot(e.clientX-down[0],e.clientY-down[1])>6)return;const hit=intersect(e);if(hit){if(detail){const data=hit.object.userData;if(data.zone)onRoom(data.zone);else if(data.floor)onFloor(data.floor);}else enter(hit.object.userData.facility);}};
  const moveHandler=e=>{if(transition)return;const hit=intersect(e),id=hit?.object.userData.facility;renderer.domElement.style.cursor=hit?'pointer':'grab';if(id!==hover){hover=id;buildings.forEach(b=>b.halo.material.opacity=b.spec.id===id ? .45 : 0);dirty=true;}};
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
    if(dirty){for(const l of labels){const p=l.point.clone().project(camera);l.element.style.left=`${(p.x+1)*50}%`;l.element.style.top=`${(1-p.y)*50}%`;l.element.style.visibility=p.z>1||Math.abs(p.x)>1||Math.abs(p.y)>1?'hidden':'visible';}renderer.render(scene,camera);dirty=false;}frame=requestAnimationFrame(animate);
  }
  frame=requestAnimationFrame(animate);
  return {enter,setFloor,getView(){return {facility,position:camera.position.toArray(),target:controls.target.toArray(),wholePosition:wholePose.position.toArray(),wholeTarget:wholePose.target.toArray()}},zoom(f){if(transition||floorMotion)return;camera.position.sub(controls.target).multiplyScalar(f).add(controls.target);controls.update();},reset(){if(floorMotion)return;if(detail&&activeFloor!=='whole'){onFloor('whole');return;}if(transition)return;camera.position.copy(home);controls.target.copy(look);resize();controls.update();},rotate(){if(transition||floorMotion)return;controls.autoRotate=!controls.autoRotate;controls.autoRotateSpeed=.65;},dispose(){disposed=true;cancelAnimationFrame(frame);observer.disconnect();controls.dispose();renderer.domElement.removeEventListener('pointerdown',downHandler);renderer.domElement.removeEventListener('pointerup',upHandler);renderer.domElement.removeEventListener('pointermove',moveHandler);labels.forEach(l=>l.element.remove());geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());renderer.dispose();renderer.forceContextLoss();renderer.domElement.remove();}};
}
