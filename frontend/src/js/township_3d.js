/**
 * EnergiOS - Township 3D Microgrid Digital Twin Scene
 * Vanilla Three.js Controller with OrbitControls, Architectural 3-Stage Zoom,
 * Exploded Floor Stacking, HVAC Airflow Visuals, and Energy Conduits.
 */

class Township3DScene {
  constructor(options = {}) {
    this.container = options.container;
    this.onSelectBuilding = options.onSelectBuilding || (() => {});
    this.onSelectFloor = options.onSelectFloor || (() => {});
    this.data = window.BUILDINGS_DATA || {};

    // State
    this.selectedBuildingId = null;
    this.selectedFloorId = null;
    this.showEnergyFlow = true;
    this.isNightMode = false;
    this.wireframeMode = false;

    // Three.js Core Objects
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.controls = null;
    this.animFrameId = null;

    // Dynamic Elements
    this.buildingGroups = {};
    this.interactiveMeshes = [];
    this.flowCurves = [];
    this.pulseMarkers = [];
    this.airflowStreams = [];
    this.dirLight = null;
    this.hemiLight = null;

    // Camera Targets
    this.cameraTargetPos = new THREE.Vector3(0, 240, 310);
    this.cameraLookTarget = new THREE.Vector3(0, 0, 0);

    // Bindings
    this._onPointerMove = this._onPointerMove.bind(this);
    this._onClick = this._onClick.bind(this);
    this._handleResize = this._handleResize.bind(this);
    this._animate = this._animate.bind(this);

    if (this.container) {
      this.init();
    }
  }

  init() {
    if (!this.container) return;
    const width = this.container.clientWidth || 800;
    const height = this.container.clientHeight || 560;

    // 1. Scene
    this.scene = new THREE.Scene();
    const daylightSky = 0xe2e8f0; // Brighter modern architectural sky
    this.scene.background = new THREE.Color(daylightSky);
    this.scene.fog = new THREE.FogExp2(daylightSky, 0.0016);

    // 2. Camera
    this.camera = new THREE.PerspectiveCamera(45, width / height, 2, 2000);
    this.camera.position.set(0, 250, 320);

    // 3. Renderer with logarithmic depth buffer to eliminate z-fighting
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      logarithmicDepthBuffer: true
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.25;

    this.container.innerHTML = '';
    this.container.appendChild(this.renderer.domElement);

    // 4. OrbitControls
    const ControlsClass = THREE.OrbitControls || window.OrbitControls;
    if (ControlsClass) {
      this.controls = new ControlsClass(this.camera, this.renderer.domElement);
      this.controls.enableDamping = true;
      this.controls.dampingFactor = 0.06;
      this.controls.maxPolarAngle = Math.PI / 2.05;
      this.controls.minDistance = 25;
      this.controls.maxDistance = 650;
    }

    // 5. Lighting
    this.hemiLight = new THREE.HemisphereLight(0xffffff, 0xcfd8dc, 0.95);
    this.hemiLight.position.set(0, 200, 0);
    this.scene.add(this.hemiLight);

    this.dirLight = new THREE.DirectionalLight(0xfffbf0, 1.6);
    this.dirLight.position.set(180, 280, 150);
    this.dirLight.castShadow = true;
    this.dirLight.shadow.mapSize.width = 2048;
    this.dirLight.shadow.mapSize.height = 2048;
    this.dirLight.shadow.camera.near = 10;
    this.dirLight.shadow.camera.far = 800;
    const d = 300;
    this.dirLight.shadow.camera.left = -d;
    this.dirLight.shadow.camera.right = d;
    this.dirLight.shadow.camera.top = d;
    this.dirLight.shadow.camera.bottom = -d;
    this.dirLight.shadow.bias = -0.0004;
    this.scene.add(this.dirLight);

    const fillLight = new THREE.DirectionalLight(0xdbeafe, 0.6);
    fillLight.position.set(-150, 180, -100);
    this.scene.add(fillLight);

    // 6. Build Scene Objects
    this._buildTerrain();
    this._buildBuildings();
    this._buildSolarFarm();
    this._buildBessSubstation();
    this._buildEcoVillas();
    this._buildEnergyConduits();

    // 7. Raycasting & Events
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();

    window.addEventListener('pointermove', this._onPointerMove);
    this.renderer.domElement.addEventListener('click', this._onClick);
    window.addEventListener('resize', this._handleResize);

    // Start loop
    this._animate();
  }

  _buildTerrain() {
    const groundGeo = new THREE.PlaneGeometry(750, 750);
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0xf1f5f9,
      roughness: 0.85,
      metalness: 0.05
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);

    const grid = new THREE.GridHelper(660, 42, 0x006948, 0xcfd8dc);
    grid.position.y = 0.15;
    this.scene.add(grid);

    // Roads
    const createRoad = (w, l, x, z, rotY = 0) => {
      const roadGeo = new THREE.PlaneGeometry(w, l);
      const roadMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.7 });
      const road = new THREE.Mesh(roadGeo, roadMat);
      road.rotation.x = -Math.PI / 2;
      road.rotation.z = rotY;
      road.position.set(x, 0.25, z);
      road.receiveShadow = true;
      this.scene.add(road);

      const lineGeo = new THREE.PlaneGeometry(0.8, l * 0.95);
      const lineMat = new THREE.MeshBasicMaterial({ color: 0xf8fafc });
      const line = new THREE.Mesh(lineGeo, lineMat);
      line.rotation.x = -Math.PI / 2;
      line.rotation.z = rotY;
      line.position.set(x, 0.28, z);
      this.scene.add(line);
    };

    createRoad(24, 580, 0, 10);
    createRoad(24, 580, 10, 0, Math.PI / 2);

    // Green Lawns
    const createGreenLawn = (w, d, x, z) => {
      const lawnGeo = new THREE.BoxGeometry(w, 0.6, d);
      const lawnMat = new THREE.MeshStandardMaterial({ color: 0x22c55e, roughness: 0.9 });
      const lawn = new THREE.Mesh(lawnGeo, lawnMat);
      lawn.position.set(x, 0.3, z);
      lawn.receiveShadow = true;
      this.scene.add(lawn);
    };

    createGreenLawn(90, 70, -80, -40);
    createGreenLawn(85, 80, 75, -50);
    createGreenLawn(80, 70, -65, 75);
    createGreenLawn(95, 85, 75, 70);

    // Lake
    const shoreGeo = new THREE.CylinderGeometry(44, 46, 1.2, 32);
    const shoreMat = new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.9 });
    const shore = new THREE.Mesh(shoreGeo, shoreMat);
    shore.position.set(-10, 0.4, -130);
    this.scene.add(shore);

    const lakeGeo = new THREE.CylinderGeometry(41, 41, 1.4, 32);
    const lakeMat = new THREE.MeshStandardMaterial({
      color: 0x0284c7,
      roughness: 0.1,
      metalness: 0.85,
      transparent: true,
      opacity: 0.9
    });
    const lake = new THREE.Mesh(lakeGeo, lakeMat);
    lake.position.set(-10, 0.5, -130);
    this.scene.add(lake);

    // Trees
    const treeGeo = new THREE.ConeGeometry(3.5, 9, 7);
    const treeMat = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.8 });
    const trunkGeo = new THREE.CylinderGeometry(0.6, 0.8, 3, 6);
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.9 });

    const createTree = (tx, tz) => {
      const treeGroup = new THREE.Group();
      treeGroup.position.set(tx, 0, tz);
      const trunk = new THREE.Mesh(trunkGeo, trunkMat);
      trunk.position.y = 1.5;
      trunk.castShadow = true;
      treeGroup.add(trunk);
      const foliage = new THREE.Mesh(treeGeo, treeMat);
      foliage.position.y = 7;
      foliage.castShadow = true;
      treeGroup.add(foliage);
      this.scene.add(treeGroup);
    };

    const treeCoords = [
      [-30, -85], [-20, -95], [0, -90], [20, -100], [-35, -130], [25, -130],
      [-15, 25], [-15, 45], [-15, 65], [35, 25], [35, 45], [35, 65],
      [-110, -10], [-110, 10], [120, -10], [120, 10]
    ];
    treeCoords.forEach(([tx, tz]) => createTree(tx, tz));
  }

  _buildBuildings() {
    this.interactiveMeshes = [];
    this.buildingGroups = {};

    Object.values(this.data).forEach((bData) => {
      const bGroup = new THREE.Group();
      bGroup.position.set(bData.position[0], bData.position[1], bData.position[2]);
      bGroup.userData = { isBuildingGroup: true, buildingId: bData.id, bData };
      this.scene.add(bGroup);
      this.buildingGroups[bData.id] = bGroup;

      // Foundation Plinth
      const plinthGeo = new THREE.BoxGeometry(bData.dimensions.width + 6, 2.5, bData.dimensions.depth + 6);
      const plinthMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.5 });
      const plinth = new THREE.Mesh(plinthGeo, plinthMat);
      plinth.position.y = 1.25;
      plinth.receiveShadow = true;
      bGroup.add(plinth);

      const floorCount = bData.floors.length;
      const floorHeight = 7.0;
      const sortedFloors = [...bData.floors].sort((a, b) => a.levelNumber - b.levelNumber);

      sortedFloors.forEach((floor, idx) => {
        const floorGroup = new THREE.Group();
        floorGroup.position.y = 2.5 + idx * floorHeight;
        floorGroup.userData = {
          isFloor: true,
          floorId: floor.id,
          buildingId: bData.id,
          baseY: 2.5 + idx * floorHeight,
          explodedY: 2.5 + idx * 14.0
        };
        bGroup.add(floorGroup);

        const isRoof = floor.id === 'roof';
        const isGround = floor.id === 'g';
        const widthTaper = isRoof ? 0.90 : 1.0 - (floorCount - 1 - idx) * 0.02;
        const depthTaper = isRoof ? 0.90 : 1.0 - (floorCount - 1 - idx) * 0.02;
        const w = bData.dimensions.width * widthTaper;
        const d = bData.dimensions.depth * depthTaper;
        const h = isRoof ? 4.0 : floorHeight - 1.0;

        // 1. Authoritative Solid Slabs
        const slabCoreGeo = new THREE.BoxGeometry(w + 0.6, 1.2, d + 0.6);
        const slabCoreMat = new THREE.MeshStandardMaterial({
          color: isRoof ? 0x334155 : bData.primaryColor,
          roughness: 0.35,
          metalness: 0.15
        });
        const slabMesh = new THREE.Mesh(slabCoreGeo, slabCoreMat);
        slabMesh.position.y = 0.6;
        slabMesh.castShadow = true;
        slabMesh.receiveShadow = true;
        slabMesh.userData = {
          isFloorClickable: true,
          floorId: floor.id,
          buildingId: bData.id,
          originalColor: isRoof ? 0x334155 : bData.primaryColor
        };
        floorGroup.add(slabMesh);
        this.interactiveMeshes.push(slabMesh);

        // 2. Interior Floor Partitions & Rooms
        const interiorGroup = new THREE.Group();
        interiorGroup.userData = { isInteriorDetail: true };
        floorGroup.add(interiorGroup);

        if (!isRoof) {
          // Central Service Core
          const coreGeo = new THREE.BoxGeometry(w * 0.24, h, d * 0.26);
          const coreMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.6, metalness: 0.2 });
          const coreMesh = new THREE.Mesh(coreGeo, coreMat);
          coreMesh.position.y = h / 2;
          interiorGroup.add(coreMesh);

          // Elevator Door
          const doorGeo = new THREE.PlaneGeometry(3.2, 4.4);
          const doorMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.8, roughness: 0.25 });
          const doorMesh = new THREE.Mesh(doorGeo, doorMat);
          doorMesh.position.set(0, 2.2, d * 0.131);
          interiorGroup.add(doorMesh);

          // Thermostat
          const statBackGeo = new THREE.BoxGeometry(0.9, 1.2, 0.15);
          const statBackMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.3 });
          const statBack = new THREE.Mesh(statBackGeo, statBackMat);
          statBack.position.set(2.8, 2.8, d * 0.132);
          interiorGroup.add(statBack);

          const statScreenGeo = new THREE.PlaneGeometry(0.7, 0.7);
          const statScreenMat = new THREE.MeshBasicMaterial({ color: floor.anomaly ? 0xf43f5e : 0x0284c7 });
          const statScreen = new THREE.Mesh(statScreenGeo, statScreenMat);
          statScreen.position.set(2.8, 2.9, d * 0.134);
          interiorGroup.add(statScreen);

          // Interior Glass Partitions
          const wallGeoX = new THREE.BoxGeometry(w * 0.72, h * 0.75, 0.35);
          const wallGeoZ = new THREE.BoxGeometry(0.35, h * 0.75, d * 0.65);
          const wallMat = new THREE.MeshStandardMaterial({
            color: 0xbae6fd,
            transparent: true,
            opacity: 0.35,
            roughness: 0.15,
            metalness: 0.5
          });

          const partition1 = new THREE.Mesh(wallGeoX, wallMat);
          partition1.position.set(0, h * 0.38, -d * 0.2);
          interiorGroup.add(partition1);

          const partition2 = new THREE.Mesh(wallGeoZ, wallMat);
          partition2.position.set(w * 0.22, h * 0.38, 0);
          interiorGroup.add(partition2);

          // AHU Assembly
          const ahuX = -w * 0.30;
          const ahuZ = d * 0.24;
          const ahuW = w * 0.22;
          const ahuD = d * 0.22;
          const ahuH = h * 0.68;

          const isolatorGeo = new THREE.BoxGeometry(ahuW * 0.95, 0.35, ahuD * 0.95);
          const isolatorMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.9 });
          const isolator = new THREE.Mesh(isolatorGeo, isolatorMat);
          isolator.position.set(ahuX, 0.18, ahuZ);
          interiorGroup.add(isolator);

          const ahuGeo = new THREE.BoxGeometry(ahuW, ahuH, ahuD);
          const ahuMat = new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.7, roughness: 0.35 });
          const ahu = new THREE.Mesh(ahuGeo, ahuMat);
          ahu.position.set(ahuX, ahuH / 2 + 0.35, ahuZ);
          interiorGroup.add(ahu);

          // Blower
          const blowerGeo = new THREE.CylinderGeometry(1.5, 1.7, 1.4, 16);
          const blowerMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.75, roughness: 0.3 });
          const blower = new THREE.Mesh(blowerGeo, blowerMat);
          blower.rotation.z = Math.PI / 2;
          blower.position.set(ahuX + ahuW * 0.15, ahuH + 0.85, ahuZ);
          interiorGroup.add(blower);

          // Chilled Water Piping Loop
          const chwsPipeGeo = new THREE.CylinderGeometry(0.35, 0.35, Math.abs(ahuX) + 1, 12);
          const chwsPipeMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, metalness: 0.4, roughness: 0.25 });
          const chwsPipe = new THREE.Mesh(chwsPipeGeo, chwsPipeMat);
          chwsPipe.rotation.z = Math.PI / 2;
          chwsPipe.position.set(ahuX / 2, 2.0, ahuZ - 1.2);
          interiorGroup.add(chwsPipe);

          const chwrPipeGeo = new THREE.CylinderGeometry(0.35, 0.35, Math.abs(ahuX) + 1, 12);
          const chwrPipeMat = new THREE.MeshStandardMaterial({ color: 0x7c3aed, metalness: 0.4, roughness: 0.25 });
          const chwrPipe = new THREE.Mesh(chwrPipeGeo, chwrPipeMat);
          chwrPipe.rotation.z = Math.PI / 2;
          chwrPipe.position.set(ahuX / 2, 2.8, ahuZ - 1.2);
          interiorGroup.add(chwrPipe);

          // Air Ducts & Diffusers
          const ductY = h * 0.82;
          const trunkLen = w * 0.70;
          const ductGeo = new THREE.BoxGeometry(trunkLen, 1.0, 1.4);
          const ductMat = new THREE.MeshStandardMaterial({ color: 0xa1a1aa, metalness: 0.82, roughness: 0.25 });
          const trunkDuct = new THREE.Mesh(ductGeo, ductMat);
          trunkDuct.position.set(0, ductY, ahuZ);
          interiorGroup.add(trunkDuct);

          // Lateral Branches
          const branchDepth = d * 0.36;
          const branchGeo = new THREE.BoxGeometry(1.0, 0.8, branchDepth);
          const branch1 = new THREE.Mesh(branchGeo, ductMat);
          branch1.position.set(w * 0.22, ductY - 0.1, ahuZ - branchDepth / 2);
          interiorGroup.add(branch1);

          const branch2 = new THREE.Mesh(branchGeo, ductMat);
          branch2.position.set(-w * 0.05, ductY - 0.1, ahuZ - branchDepth / 2);
          interiorGroup.add(branch2);

          // Ceiling Diffusers with Animated Breeze
          const diffuserCoords = [
            [w * 0.22, ductY - 0.45, ahuZ - branchDepth + 1.2, 0],
            [-w * 0.05, ductY - 0.45, ahuZ - branchDepth + 1.2, 1.5],
            [w * 0.22, ductY - 0.45, ahuZ + branchDepth - 2.0, 3.0]
          ];

          const diffuserBezelGeo = new THREE.BoxGeometry(2.2, 0.16, 2.2);
          const diffuserBezelMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.4 });

          diffuserCoords.forEach(([dx, dy, dz, phaseOffset]) => {
            const bezel = new THREE.Mesh(diffuserBezelGeo, diffuserBezelMat);
            bezel.position.set(dx, dy, dz);
            interiorGroup.add(bezel);

            const breezeConeGeo = new THREE.ConeGeometry(2.0, 3.0, 12, 1, true);
            const breezeMat = new THREE.MeshBasicMaterial({
              color: 0x38bdf8,
              transparent: true,
              opacity: 0.26,
              side: THREE.DoubleSide,
              depthWrite: false
            });
            const breezeMesh = new THREE.Mesh(breezeConeGeo, breezeMat);
            breezeMesh.position.set(dx, dy - 1.5, dz);
            interiorGroup.add(breezeMesh);

            this.airflowStreams.push({
              mesh: breezeMesh,
              phase: phaseOffset,
              buildingId: bData.id,
              floorId: floor.id
            });
          });

          // Workstations
          const deskGeo = new THREE.BoxGeometry(4.0, 0.16, 2.2);
          const deskMat = new THREE.MeshStandardMaterial({ color: 0xf1ebe1, roughness: 0.6 });
          const monitorGeo = new THREE.BoxGeometry(1.5, 1.0, 0.12);
          const monitorMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.4 });
          const screenGeo = new THREE.PlaneGeometry(1.4, 0.9);
          const screenMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });

          const createWorkstation = (wx, wz) => {
            const wsGroup = new THREE.Group();
            wsGroup.position.set(wx, 1.25, wz);
            const desk = new THREE.Mesh(deskGeo, deskMat);
            desk.position.y = 1.3;
            desk.castShadow = true;
            wsGroup.add(desk);

            const mon = new THREE.Mesh(monitorGeo, monitorMat);
            mon.position.set(0, 2.15, -0.4);
            wsGroup.add(mon);

            const scr = new THREE.Mesh(screenGeo, screenMat);
            scr.position.set(0, 2.15, -0.33);
            wsGroup.add(scr);

            interiorGroup.add(wsGroup);
          };

          createWorkstation(w * 0.22, ahuZ - branchDepth + 1.2);
          createWorkstation(-w * 0.05, ahuZ - branchDepth + 1.2);

          // Thermal Heatmap Floor Tile Accent
          const zoneTileGeo = new THREE.PlaneGeometry(w * 0.80, d * 0.78);
          const zoneTileMat = new THREE.MeshStandardMaterial({
            color: floor.anomaly ? 0xfff1f2 : 0xf0fdf4,
            roughness: 0.9,
            polygonOffset: true,
            polygonOffsetFactor: -1,
            polygonOffsetUnits: -1
          });
          const zoneTile = new THREE.Mesh(zoneTileGeo, zoneTileMat);
          zoneTile.rotation.x = -Math.PI / 2;
          zoneTile.position.set(0, 1.23, 0);
          zoneTile.receiveShadow = true;
          interiorGroup.add(zoneTile);
        }

        // 3. Facade Windows
        if (!isRoof) {
          const glassGroup = new THREE.Group();
          glassGroup.userData = { isFacadeGlass: true };
          floorGroup.add(glassGroup);

          const glassWallMat = new THREE.MeshStandardMaterial({
            color: bData.glassColor,
            roughness: 0.1,
            metalness: 0.85,
            transparent: true,
            opacity: 0.55,
            depthWrite: false,
            side: THREE.DoubleSide
          });

          const glassH = h * 0.72;
          const glassY = h / 2;
          const gw = w + 0.4;
          const gd = d + 0.4;

          const fbGeo = new THREE.PlaneGeometry(gw, glassH);
          const fGlass = new THREE.Mesh(fbGeo, glassWallMat);
          fGlass.position.set(0, glassY, gd / 2);
          glassGroup.add(fGlass);

          const bGlass = new THREE.Mesh(fbGeo, glassWallMat);
          bGlass.position.set(0, glassY, -gd / 2);
          bGlass.rotation.y = Math.PI;
          glassGroup.add(bGlass);

          const lrGeo = new THREE.PlaneGeometry(gd, glassH);
          const lGlass = new THREE.Mesh(lrGeo, glassWallMat);
          lGlass.position.set(-gw / 2, glassY, 0);
          lGlass.rotation.y = -Math.PI / 2;
          glassGroup.add(lGlass);

          const rGlass = new THREE.Mesh(lrGeo, glassWallMat);
          rGlass.position.set(gw / 2, glassY, 0);
          rGlass.rotation.y = Math.PI / 2;
          glassGroup.add(rGlass);
        }

        // Ground Floor Entrance Canopy
        if (isGround) {
          const canopyGeo = new THREE.BoxGeometry(18, 0.8, 10);
          const canopyMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.2, metalness: 0.8 });
          const canopy = new THREE.Mesh(canopyGeo, canopyMat);
          canopy.position.set(0, h * 0.75, d / 2 + 5);
          canopy.castShadow = true;
          floorGroup.add(canopy);
        }

        // Rooftop Solar & Chillers
        if (isRoof) {
          // PV Panels
          for (let sx = -w / 2 + 6; sx <= w / 2 - 6; sx += 9.5) {
            for (let sz = -d / 2 + 6; sz <= d / 2 - 12; sz += 9.5) {
              const panelGeo = new THREE.BoxGeometry(7.5, 0.35, 6.5);
              const panelMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.15, metalness: 0.95 });
              const panel = new THREE.Mesh(panelGeo, panelMat);
              panel.position.set(sx, 1.6, sz);
              panel.rotation.x = -0.22;
              panel.castShadow = true;
              floorGroup.add(panel);
            }
          }

          // Rooftop Chillers
          const chillerGeo = new THREE.BoxGeometry(9.0, 3.5, 6.0);
          const chillerMat = new THREE.MeshStandardMaterial({ color: 0x006948, metalness: 0.5, roughness: 0.4 });
          const chiller1 = new THREE.Mesh(chillerGeo, chillerMat);
          chiller1.position.set(-w * 0.22, 2.9, d * 0.20);
          floorGroup.add(chiller1);

          const chiller2 = new THREE.Mesh(chillerGeo, chillerMat);
          chiller2.position.set(w * 0.22, 2.9, d * 0.20);
          floorGroup.add(chiller2);

          // Crown
          const crownGeo = new THREE.BoxGeometry(10, 5, 10);
          const crownMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.4 });
          const crown = new THREE.Mesh(crownGeo, crownMat);
          crown.position.set(0, 3.7, 0);
          crown.castShadow = true;
          floorGroup.add(crown);

          const beaconGeo = new THREE.SphereGeometry(1.4, 16, 16);
          const beaconMat = new THREE.MeshBasicMaterial({ color: 0x10b981 });
          const beacon = new THREE.Mesh(beaconGeo, beaconMat);
          beacon.position.set(0, 7.0, 0);
          floorGroup.add(beacon);
        }
      });
    });
  }

  _buildSolarFarm() {
    const solarFarmGroup = new THREE.Group();
    solarFarmGroup.position.set(160, 0, -140);
    this.scene.add(solarFarmGroup);

    const sfPlinthGeo = new THREE.BoxGeometry(90, 1.5, 70);
    const sfPlinthMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.7 });
    const sfPlinth = new THREE.Mesh(sfPlinthGeo, sfPlinthMat);
    sfPlinth.position.y = 0.75;
    sfPlinth.receiveShadow = true;
    solarFarmGroup.add(sfPlinth);

    for (let px = -35; px <= 35; px += 18) {
      for (let pz = -22; pz <= 22; pz += 15) {
        const pGeo = new THREE.BoxGeometry(14, 0.4, 9);
        const pMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.1, metalness: 0.95 });
        const panel = new THREE.Mesh(pGeo, pMat);
        panel.position.set(px, 4.2, pz);
        panel.rotation.x = -0.32;
        panel.castShadow = true;
        solarFarmGroup.add(panel);

        const poleGeo = new THREE.CylinderGeometry(0.4, 0.4, 3.5, 8);
        const poleMat = new THREE.MeshStandardMaterial({ color: 0x64748b });
        const pole = new THREE.Mesh(poleGeo, poleMat);
        pole.position.set(px, 1.8, pz);
        solarFarmGroup.add(pole);
      }
    }
  }

  _buildBessSubstation() {
    const bessGroup = new THREE.Group();
    bessGroup.position.set(-150, 0, -100);
    this.scene.add(bessGroup);

    const bPlinthGeo = new THREE.BoxGeometry(65, 1.5, 45);
    const bPlinthMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.8 });
    const bPlinth = new THREE.Mesh(bPlinthGeo, bPlinthMat);
    bPlinth.position.y = 0.75;
    bPlinth.receiveShadow = true;
    bessGroup.add(bPlinth);

    for (let c = -18; c <= 18; c += 18) {
      const boxGeo = new THREE.BoxGeometry(13, 9, 24);
      const boxMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.3, metalness: 0.7 });
      const containerBox = new THREE.Mesh(boxGeo, boxMat);
      containerBox.position.set(c, 4.5, 0);
      containerBox.castShadow = true;
      bessGroup.add(containerBox);

      const ledGeo = new THREE.BoxGeometry(0.4, 6, 1.0);
      const ledMat = new THREE.MeshBasicMaterial({ color: 0x10b981 });
      const led = new THREE.Mesh(ledGeo, ledMat);
      led.position.set(c + 6.6, 4.5, 7);
      bessGroup.add(led);
    }
  }

  _buildEcoVillas() {
    const resGroup = new THREE.Group();
    resGroup.position.set(-130, 0, 70);
    this.scene.add(resGroup);

    for (let vx = -25; vx <= 25; vx += 24) {
      for (let vz = -20; vz <= 20; vz += 22) {
        const villaGeo = new THREE.BoxGeometry(14, 7.5, 13);
        const villaMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 });
        const villa = new THREE.Mesh(villaGeo, villaMat);
        villa.position.set(vx, 3.75, vz);
        villa.castShadow = true;
        resGroup.add(villa);

        const roofGeo = new THREE.ConeGeometry(11, 4.5, 4);
        const roofMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.2, metalness: 0.7 });
        const vRoof = new THREE.Mesh(roofGeo, roofMat);
        vRoof.position.set(vx, 9.5, vz);
        vRoof.rotation.y = Math.PI / 4;
        vRoof.castShadow = true;
        resGroup.add(vRoof);
      }
    }
  }

  _buildEnergyConduits() {
    this.flowCurves = [];
    this.pulseMarkers = [];

    const createConduit = (start, end, colorHex) => {
      const mid = new THREE.Vector3(
        (start.x + end.x) / 2,
        Math.max(start.y, end.y) + 24,
        (start.z + end.z) / 2
      );
      const curve = new THREE.QuadraticBezierCurve3(start, mid, end);
      const points = curve.getPoints(36);
      const geom = new THREE.BufferGeometry().setFromPoints(points);
      const mat = new THREE.LineBasicMaterial({
        color: colorHex,
        transparent: true,
        opacity: 0.45,
        linewidth: 2
      });
      const line = new THREE.Line(geom, mat);
      this.scene.add(line);
      this.flowCurves.push(curve);

      const pulseGeo = new THREE.SphereGeometry(1.6, 8, 8);
      const pulseMat = new THREE.MeshBasicMaterial({ color: 0x006948 });
      const pulseMesh = new THREE.Mesh(pulseGeo, pulseMat);
      this.scene.add(pulseMesh);
      this.pulseMarkers.push({ mesh: pulseMesh, curve, t: Math.random() });
    };

    createConduit(new THREE.Vector3(160, 6, -140), new THREE.Vector3(-150, 7, -100), 0x0284c7);
    createConduit(new THREE.Vector3(-150, 7, -100), new THREE.Vector3(-80, 12, -40), 0x006948);
    createConduit(new THREE.Vector3(160, 6, -140), new THREE.Vector3(75, 12, -50), 0x006948);
    createConduit(new THREE.Vector3(-150, 7, -100), new THREE.Vector3(75, 12, 70), 0x006948);
  }

  _onPointerMove(e) {
    if (!this.container || !this.renderer || !this.camera) return;
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.intersectObjects(this.interactiveMeshes, false);
    if (intersects.length > 0) {
      this.container.style.cursor = 'pointer';
    } else {
      this.container.style.cursor = 'default';
    }
  }

  _onClick(e) {
    if (!this.container || !this.renderer || !this.camera) return;
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.intersectObjects(this.interactiveMeshes, false);

    if (intersects.length > 0) {
      const hit = intersects[0].object;
      const bId = hit.userData.buildingId;
      const fId = hit.userData.floorId;

      if (bId) {
        this.selectBuilding(bId);
        if (fId) {
          this.selectFloor(fId);
        }
      }
    }
  }

  _handleResize() {
    if (!this.container || !this.renderer || !this.camera) return;
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  _animate() {
    this.animFrameId = requestAnimationFrame(this._animate);

    if (this.camera && this.controls) {
      this.camera.position.lerp(this.cameraTargetPos, 0.05);
      this.controls.target.lerp(this.cameraLookTarget, 0.05);
      this.controls.update();
    }

    // Diffusers Airflow animation
    const time = performance.now() * 0.003;
    this.airflowStreams.forEach((stream) => {
      const pulse = Math.sin(time * 2.8 + stream.phase);
      if (stream.mesh && stream.mesh.material) {
        stream.mesh.scale.set(1.0 + pulse * 0.09, 1.0 + pulse * 0.12, 1.0 + pulse * 0.09);
        stream.mesh.material.opacity = 0.22 + pulse * 0.08;
      }
    });

    // Energy conduits pulses
    if (this.showEnergyFlow) {
      this.pulseMarkers.forEach((p) => {
        p.t += 0.007;
        if (p.t > 1) p.t = 0;
        const pos = p.curve.getPoint(p.t);
        p.mesh.position.copy(pos);
        p.mesh.visible = true;
      });
    } else {
      this.pulseMarkers.forEach((p) => (p.mesh.visible = false));
    }

    if (this.renderer && this.scene && this.camera) {
      this.renderer.render(this.scene, this.camera);
    }
  }

  // ==========================================
  // Public API Methods
  // ==========================================

  selectBuilding(buildingId) {
    this.selectedBuildingId = buildingId;
    this.selectedFloorId = null;
    this._updateCameraAndStages();
    this.onSelectBuilding(buildingId);
  }

  selectFloor(floorId) {
    this.selectedFloorId = floorId;
    this._updateCameraAndStages();
    this.onSelectFloor(floorId);
  }

  resetView() {
    this.selectedBuildingId = null;
    this.selectedFloorId = null;
    this._updateCameraAndStages();
    this.onSelectBuilding(null);
    this.onSelectFloor(null);
  }

  toggleEnergyFlow(bool) {
    this.showEnergyFlow = bool !== undefined ? bool : !this.showEnergyFlow;
    return this.showEnergyFlow;
  }

  toggleNightMode(bool) {
    this.isNightMode = bool !== undefined ? bool : !this.isNightMode;
    if (!this.scene || !this.dirLight || !this.hemiLight) return this.isNightMode;

    if (this.isNightMode) {
      this.scene.background = new THREE.Color(0x0a0f1d);
      this.scene.fog = new THREE.FogExp2(0x0a0f1d, 0.0022);
      this.dirLight.color = new THREE.Color(0x38bdf8);
      this.dirLight.intensity = 0.55;
      this.hemiLight.intensity = 0.35;
    } else {
      this.scene.background = new THREE.Color(0xe2e8f0);
      this.scene.fog = new THREE.FogExp2(0xe2e8f0, 0.0016);
      this.dirLight.color = new THREE.Color(0xfffbf0);
      this.dirLight.intensity = 1.6;
      this.hemiLight.intensity = 0.95;
    }
    return this.isNightMode;
  }

  toggleWireframe(bool) {
    this.wireframeMode = bool !== undefined ? bool : !this.wireframeMode;
    this.interactiveMeshes.forEach((mesh) => {
      if (mesh.material) {
        mesh.material.wireframe = this.wireframeMode;
      }
    });
    return this.wireframeMode;
  }

  _updateCameraAndStages() {
    const buildingGroups = this.buildingGroups;
    if (!buildingGroups) return;

    const setGlassOpacity = (glassObj, op) => {
      if (!glassObj) return;
      if (glassObj.material) {
        glassObj.material.opacity = op;
        glassObj.material.transparent = true;
      }
      if (glassObj.children) {
        glassObj.children.forEach((c) => {
          if (c.material) {
            c.material.opacity = op;
            c.material.transparent = true;
          }
        });
      }
    };

    if (this.selectedBuildingId && this.data[this.selectedBuildingId]) {
      const bData = this.data[this.selectedBuildingId];
      const bx = bData.position[0];
      const by = bData.position[1];
      const bz = bData.position[2];
      const targetBuildingGroup = buildingGroups[this.selectedBuildingId];

      let activeFloorY = 25;

      if (this.selectedFloorId && targetBuildingGroup) {
        // STAGE 3: FOCUSED ON A SPECIFIC FLOOR
        const activeFloorChild = targetBuildingGroup.children.find(
          (c) => c.userData.isFloor && c.userData.floorId === this.selectedFloorId
        );
        if (activeFloorChild) {
          activeFloorY = activeFloorChild.userData.explodedY;
        }

        this.cameraTargetPos.set(bx + 38, activeFloorY + 36, bz + 46);
        this.cameraLookTarget.set(bx, activeFloorY + 1.5, bz);

        Object.entries(buildingGroups).forEach(([bId, group]) => {
          const isTarget = bId === this.selectedBuildingId;
          group.children.forEach((child) => {
            if (child.userData.isFloor) {
              const isSelectedFloor = isTarget && child.userData.floorId === this.selectedFloorId;
              const isFloorAbove = isTarget && child.userData.explodedY > activeFloorY;
              const isFloorBelow = isTarget && child.userData.explodedY < activeFloorY;

              if (isSelectedFloor) {
                child.position.y = activeFloorY;
                child.visible = true;

                const interior = child.children.find((c) => c.userData.isInteriorDetail);
                if (interior) interior.visible = true;

                const glass = child.children.find((c) => c.userData.isFacadeGlass);
                setGlassOpacity(glass, 0.05);

                const slab = child.children.find((c) => c.userData.isFloorClickable);
                if (slab && slab.material) {
                  slab.material.color = new THREE.Color(0xffffff);
                  slab.material.emissive = new THREE.Color(0x003322);
                  slab.material.opacity = 1.0;
                }
              } else if (isFloorAbove) {
                child.position.y = child.userData.explodedY + 38;
                const interior = child.children.find((c) => c.userData.isInteriorDetail);
                if (interior) interior.visible = false;

                const slab = child.children.find((c) => c.userData.isFloorClickable);
                if (slab && slab.material) {
                  slab.material.color = new THREE.Color(0xcbd5e1);
                  slab.material.emissive = new THREE.Color(0x000000);
                  slab.material.opacity = 0.08;
                }
              } else if (isFloorBelow) {
                child.position.y = child.userData.explodedY;
                const interior = child.children.find((c) => c.userData.isInteriorDetail);
                if (interior) interior.visible = false;

                const slab = child.children.find((c) => c.userData.isFloorClickable);
                if (slab && slab.material) {
                  slab.material.color = new THREE.Color(0x94a3b8);
                  slab.material.emissive = new THREE.Color(0x000000);
                  slab.material.opacity = 0.25;
                }
              } else {
                child.position.y = child.userData.baseY;
                const slab = child.children.find((c) => c.userData.isFloorClickable);
                if (slab && slab.material) {
                  slab.material.color = new THREE.Color(0x94a3b8);
                  slab.material.opacity = 0.18;
                }
              }
            }
          });
        });
      } else {
        // STAGE 2: WHOLE BUILDING EXPLODED STACK
        this.cameraTargetPos.set(bx + 75, by + 58, bz + 88);
        this.cameraLookTarget.set(bx, by + 26, bz);

        Object.entries(buildingGroups).forEach(([bId, group]) => {
          const isTarget = bId === this.selectedBuildingId;
          group.children.forEach((child) => {
            if (child.userData.isFloor) {
              const targetY = isTarget ? child.userData.explodedY : child.userData.baseY;
              child.position.y = targetY;
              child.visible = true;

              const interior = child.children.find((c) => c.userData.isInteriorDetail);
              if (interior) interior.visible = isTarget;

              const glass = child.children.find((c) => c.userData.isFacadeGlass);
              setGlassOpacity(glass, 0.55);

              const slab = child.children.find((c) => c.userData.isFloorClickable);
              if (slab && slab.material) {
                if (isTarget) {
                  slab.material.color = new THREE.Color(slab.userData.originalColor);
                  slab.material.emissive = new THREE.Color(0x000000);
                  slab.material.opacity = 0.95;
                } else {
                  slab.material.color = new THREE.Color(0x94a3b8);
                  slab.material.emissive = new THREE.Color(0x000000);
                  slab.material.opacity = 0.22;
                }
              }
            }
          });
        });
      }
    } else {
      // STAGE 1: TOWNSHIP OVERVIEW
      this.cameraTargetPos.set(0, 240, 310);
      this.cameraLookTarget.set(0, 0, 0);

      Object.values(buildingGroups).forEach((group) => {
        group.children.forEach((child) => {
          if (child.userData.isFloor) {
            child.position.y = child.userData.baseY;
            child.visible = true;

            const interior = child.children.find((c) => c.userData.isInteriorDetail);
            if (interior) interior.visible = false;

            const glass = child.children.find((c) => c.userData.isFacadeGlass);
            setGlassOpacity(glass, 0.55);

            const slab = child.children.find((c) => c.userData.isFloorClickable);
            if (slab && slab.material) {
              slab.material.color = new THREE.Color(slab.userData.originalColor);
              slab.material.emissive = new THREE.Color(0x000000);
              slab.material.opacity = 0.95;
            }
          }
        });
      });
    }
  }

  destroy() {
    cancelAnimationFrame(this.animFrameId);
    window.removeEventListener('pointermove', this._onPointerMove);
    window.removeEventListener('resize', this._handleResize);
    if (this.renderer && this.renderer.domElement) {
      this.renderer.domElement.removeEventListener('click', this._onClick);
    }
    if (this.renderer) this.renderer.dispose();
    if (this.controls) this.controls.dispose();
  }
}

window.Township3DScene = Township3DScene;
