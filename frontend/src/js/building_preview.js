import '../vendor/three.min.js';
import '../vendor/OrbitControls.js';

/** Illustrative geometry only. No floor dimensions or telemetry are inferred. */
export function mountBuildingPreview(container, {floor='roof', tall=false, onSelect=()=>{}}={}) {
  if (!container || !window.THREE) return null;
  const T=window.THREE;
  let renderer;
  try { renderer=new T.WebGLRenderer({antialias:true,alpha:false}); }
  catch { return null; }
  const scene=new T.Scene();scene.background=new T.Color(0xf7fafc);
  const camera=new T.PerspectiveCamera(36,1,.1,200);
  const initial=tall?[19,18,24]:[16,17,20];camera.position.set(...initial);
  const levels=tall?7:3, levelHeight=tall?1.15:1.2, roofY=levels*levelHeight+.35;
  const target=new T.Vector3(0,roofY/2,0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));
  renderer.outputEncoding=T.sRGBEncoding;
  renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);container.classList.add('ready');
  renderer.domElement.setAttribute('aria-label','Drag to rotate the illustrative building; scroll to zoom');
  const controls=new T.OrbitControls(camera,renderer.domElement);controls.target.copy(target);
  controls.enableDamping=true;controls.dampingFactor=.08;controls.minDistance=13;controls.maxDistance=45;
  controls.maxPolarAngle=Math.PI*.48;controls.enablePan=false;
  scene.add(new T.AmbientLight(0xffffff,.8));
  const sun=new T.DirectionalLight(0xffffff,.7);sun.position.set(-12,23,15);sun.castShadow=true;
  sun.shadow.mapSize.set(1024,1024);sun.shadow.camera.left=-18;sun.shadow.camera.right=18;sun.shadow.camera.top=18;sun.shadow.camera.bottom=-18;scene.add(sun);
  const mats=[],geometries=[],interactive=[];
  const material=(color,extra={})=>{const m=new T.MeshStandardMaterial({color,roughness:.76,...extra});m.color.convertSRGBToLinear();mats.push(m);return m;};
  const white=material(0xf9fbfc), side=material(0xe3e9ef), base=material(0xd4dce6), panel=material(0x203e9a,{roughness:.45,metalness:.18}), panelEdge=material(0xd5deeb);
  const windowMat=material(0x3989ac,{roughness:.2,metalness:.3});
  const box=(w,h,d,x,y,z,mat,parent=scene)=>{const geometry=new T.BoxGeometry(w,h,d);geometries.push(geometry);const mesh=new T.Mesh(geometry,mat);mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;};
  const ground=box(20,.12,18,0,-.25,0,material(0xe4eaf0));ground.receiveShadow=true;
  box(10.6,.35,8.6,0,.03,0,base);
  for(let i=0;i<levels;i++){
    const y=.3+i*levelHeight;
    const id=i===0?'ground':'level_1';
    const slabMat=material(id===floor?0xffdfbf:0xfffcf8);
    const slab=box(9.7,.23,7.7,0,y,0,slabMat);slab.userData.floor=id;interactive.push(slab);
    box(9.1,levelHeight-.23,7.1,0,y+levelHeight/2,0,side);
    const glass=box(9.17,.43,7.17,0,y+.63,0,id===floor?material(0xf0a05a):windowMat);glass.userData.floor=id;interactive.push(glass);
    // Structural white edges preserve the quiet, architectural reference style.
    for(const x of [-4.55,4.55])for(const z of [-3.55,3.55])box(.16,levelHeight,.16,x,y+.6,z,white);
    for(const x of [-2.3,0,2.3])for(const z of [-3.59,3.59])box(.055,.5,.055,x,y+.64,z,side);
  }
  const roof=box(9.9,.28,7.9,0,roofY,0,floor==='roof'?material(0xffdfbf):white);roof.userData.floor='roof';interactive.push(roof);
  for(const x of [-4.7,4.7])box(.16,.35,7.7,x,roofY+.25,0,white);
  for(const z of [-3.7,3.7])box(9.4,.35,.16,0,roofY+.25,z,white);
  for(let row=0;row<3;row++)for(let col=0;col<4;col++){
    const group=new T.Group();group.position.set((col-1.5)*1.75,roofY+.35,(row-1)*1.7);group.rotation.x=-.12;scene.add(group);
    box(1.62,.1,1.5,0,0,0,panelEdge,group);box(1.54,.12,1.42,0,.035,0,panel,group);
    box(.018,.015,1.4,0,.105,0,panelEdge,group);
    box(1.5,.015,.018,0,.105,0,panelEdge,group);
  }
  // Small landscape markers are decorative, not mapped assets.
  for(const [x,z] of [[-6,4],[6,4],[-6,-4],[6,-4]]){
    box(.55,.35,.55,x,.03,z,white);const g=new T.SphereGeometry(.23,8,6);geometries.push(g);const tree=new T.Mesh(g,material(0x91d4b9));tree.position.set(x,.45,z);scene.add(tree);
  }
  const ray=new T.Raycaster(),pointer=new T.Vector2();let down=null;
  const pointerDown=e=>{down=[e.clientX,e.clientY]};
  const pointerUp=e=>{if(!down||Math.hypot(e.clientX-down[0],e.clientY-down[1])>5)return;const rect=renderer.domElement.getBoundingClientRect();pointer.set((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);ray.setFromCamera(pointer,camera);const hit=ray.intersectObjects(interactive)[0];if(hit)onSelect(hit.object.userData.floor);};
  renderer.domElement.addEventListener('pointerdown',pointerDown);renderer.domElement.addEventListener('pointerup',pointerUp);
  const resize=()=>{const width=container.clientWidth,height=container.clientHeight;if(!width||!height)return;camera.aspect=width/height;camera.updateProjectionMatrix();renderer.setSize(width,height,false);};
  const observer=new ResizeObserver(resize);observer.observe(container);resize();
  let frame,disposed=false;const animate=()=>{if(disposed)return;controls.update();renderer.render(scene,camera);frame=requestAnimationFrame(animate)};animate();
  return {
    zoom(factor){camera.position.sub(target).multiplyScalar(factor).add(target);controls.update()},
    reset(){camera.position.set(...initial);controls.target.copy(target);controls.update()},
    rotate(){controls.autoRotate=!controls.autoRotate;controls.autoRotateSpeed=1.3},
    dispose(){disposed=true;cancelAnimationFrame(frame);observer.disconnect();controls.dispose();renderer.domElement.removeEventListener('pointerdown',pointerDown);renderer.domElement.removeEventListener('pointerup',pointerUp);geometries.forEach(g=>g.dispose());mats.forEach(m=>m.dispose());renderer.dispose();renderer.domElement.remove();},
  };
}
