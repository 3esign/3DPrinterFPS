import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { STLExporter } from 'three/addons/exporters/STLExporter.js';

// --- Global Variables ---
let camera, scene, renderer, fpsControls, orbitControls;
let buildVolumeSize = 200; // 200x200x200mm volume

// State
let moveForward = false;
let moveBackward = false;
let moveLeft = false;
let moveRight = false;
let isPrinting = false;
let isThirdPerson = false;
let isOrbitingCamera = false;
let allowOrbitPathing = false;
const velocity = new THREE.Vector3();

// Printing State
let currentColor = new THREE.Color(0xffffff);
let currentSize = 2; // Layer Width
let currentLayerHeight = 0.2;
let currentPrintHeight = 0.2; // The active vertical plane for printing
let printSpeed = 65;
let nozzleTemperature = 210;
let flowRate = 100;
let printAcceleration = 900;
let cameraDistance = 28;
const minCameraDistance = 10;
const maxCameraDistance = 80;
const cameraOffsetY = 8;
let lastPrintPos = new THREE.Vector3();
let time = performance.now();
let currentMotionSpeed = 0;
let activeAcceleration = 0;
let inputRampTime = 0;

// --- Printed Geometry ---
const MAX_PRINT_POINTS = 50000;
let printMesh, printGeometry;
let printPointCount = 0;
let depositedLength = 0;
let printStrokes = [];
let activeStroke = null;
const reusableZeroVector = new THREE.Vector3();

// 3rd Person Nozzle
let nozzleVisual;

init();
animate();

function init() {
  const container = document.getElementById('app');

  // Scene
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a0a0f);
  scene.fog = new THREE.Fog(0x0a0a0f, 100, 500);

  // Lighting
  const ambientLight = new THREE.AmbientLight(0x404040, 2); // Soft white light
  scene.add(ambientLight);
  
  const dirLight = new THREE.DirectionalLight(0xffffff, 3);
  dirLight.position.set(100, 200, 50);
  dirLight.castShadow = true;
  dirLight.shadow.camera.top = 200;
  dirLight.shadow.camera.bottom = -200;
  dirLight.shadow.camera.left = -200;
  dirLight.shadow.camera.right = 200;
  dirLight.shadow.mapSize.width = 2048;
  dirLight.shadow.mapSize.height = 2048;
  scene.add(dirLight);

  // Build Plate
  const plateGeometry = new THREE.BoxGeometry(buildVolumeSize, 2, buildVolumeSize);
  const plateMaterial = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.8 });
  const buildPlate = new THREE.Mesh(plateGeometry, plateMaterial);
  buildPlate.position.y = -1;
  buildPlate.receiveShadow = true;
  scene.add(buildPlate);

  // Build Volume Grid & Helper
  createBuildPlateScale();

  const boxHelperGeometry = new THREE.EdgesGeometry(new THREE.BoxGeometry(buildVolumeSize, buildVolumeSize, buildVolumeSize));
  const boxHelperMaterial = new THREE.LineBasicMaterial({ color: 0x33ccff, transparent: true, opacity: 0.2 });
  const boxHelper = new THREE.LineSegments(boxHelperGeometry, boxHelperMaterial);
  boxHelper.position.y = buildVolumeSize / 2;
  scene.add(boxHelper);

  // 3rd Person Nozzle Visual
  const nozzleGeo = new THREE.ConeGeometry(2, 6, 16);
  nozzleGeo.rotateX(Math.PI); // Point down
  nozzleGeo.translate(0, 3, 0); // Move tip to origin
  const nozzleMat = new THREE.MeshStandardMaterial({ color: 0xffcc00, metalness: 0.8, roughness: 0.2 });
  nozzleVisual = new THREE.Mesh(nozzleGeo, nozzleMat);
  nozzleVisual.position.set(0, currentPrintHeight, 0);
  nozzleVisual.visible = true;
  scene.add(nozzleVisual);

  // Camera
  camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.set(0, 10, 45); // Start closer and lower so the build plate and nozzle are visible
  camera.lookAt(0, 0, 0); // Point towards the center of the build plate

  // Controls
  fpsControls = new PointerLockControls(camera, document.body);

  const blocker = document.getElementById('blocker');

  blocker.addEventListener('click', () => {
    if (!isThirdPerson) {
      fpsControls.lock();
    } else {
      blocker.style.display = 'none';
    }
  });

  fpsControls.addEventListener('lock', () => {
    blocker.style.display = 'none';
  });

  fpsControls.addEventListener('unlock', () => {
    if (!isThirdPerson) blocker.style.display = 'flex';
  });

  // Renderer
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  container.appendChild(renderer.domElement);

  // Orbit Controls for 3rd Person
  orbitControls = new OrbitControls(camera, renderer.domElement);
  orbitControls.enabled = false;
  orbitControls.enableDamping = true;
  orbitControls.dampingFactor = 0.05;
  const lockedPolarAngle = Math.atan2(30, 20); // Maintain fixed vertical angle
  orbitControls.minPolarAngle = lockedPolarAngle; 
  orbitControls.maxPolarAngle = lockedPolarAngle;
  orbitControls.mouseButtons = {
    LEFT: THREE.MOUSE.NONE,
    MIDDLE: THREE.MOUSE.DOLLY,
    RIGHT: THREE.MOUSE.ROTATE
  };
  orbitControls.addEventListener('start', () => {
    if (!isThirdPerson) return;
    clearMovementMomentum();
  });
  orbitControls.addEventListener('end', () => {
    clearMovementMomentum();
  });

  // Input Mapping
  document.addEventListener('keydown', onKeyDown);
  document.addEventListener('keyup', onKeyUp);
  
  // Printing Input
  document.addEventListener('mousedown', (e) => {
    if (e.button === 2 && isThirdPerson && !e.target.closest('.panel') && !e.target.closest('#start-menu')) {
      isOrbitingCamera = true;
      clearMovementMomentum();
    }

    if (e.button === 0 && !e.target.closest('.panel') && !e.target.closest('#start-menu')) {
      if ((!isThirdPerson && fpsControls.isLocked) || (isThirdPerson && document.getElementById('blocker').style.display === 'none')) {
        isPrinting = true;
        lastPrintPos.copy(getNozzlePos());
        startPrintStroke(lastPrintPos);
      }
    }
  });
  document.addEventListener('mouseup', (e) => {
    if (e.button === 0) {
      isPrinting = false;
      activeStroke = null;
    }
    if (e.button === 2) {
      isOrbitingCamera = false;
      clearMovementMomentum();
    }
  });
  document.addEventListener('contextmenu', (e) => {
    if (isThirdPerson && !e.target.closest('.panel')) e.preventDefault();
  });

  // Resize Handler
  window.addEventListener('resize', onWindowResize);

  // Initialize Instanced Meshes for Printing
  setupInstancedMeshes();
  
  // UI Handlers
  setupUI();
}

function setupInstancedMeshes() {
  printGeometry = new THREE.BufferGeometry();
  const material = new THREE.MeshStandardMaterial({
    color: currentColor,
    roughness: 0.36,
    metalness: 0.04,
    flatShading: true,
    side: THREE.DoubleSide
  });

  printMesh = new THREE.Mesh(printGeometry, material);
  printMesh.castShadow = true;
  printMesh.receiveShadow = true;
  printMesh.frustumCulled = false;
  scene.add(printMesh);
}

function createTextSprite(text, color = '#d7f5ff') {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  canvas.width = 128;
  canvas.height = 48;

  context.font = '600 24px Outfit, Arial, sans-serif';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillStyle = 'rgba(0, 0, 0, 0.55)';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.strokeStyle = 'rgba(255, 255, 255, 0.14)';
  context.strokeRect(0.5, 0.5, canvas.width - 1, canvas.height - 1);
  context.fillStyle = color;
  context.fillText(text, canvas.width / 2, canvas.height / 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthWrite: false
  });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(8, 3, 1);
  return sprite;
}

function createBuildPlateScale() {
  const half = buildVolumeSize / 2;
  const linePositions = [];
  const lineColors = [];
  const minorColor = new THREE.Color(0x4e5560);
  const majorColor = new THREE.Color(0x8f98aa);
  const xAxisColor = new THREE.Color(0xff6688);
  const zAxisColor = new THREE.Color(0x33ccff);
  const y = 0.04;

  for (let value = -half; value <= half; value += 10) {
    let color = value === 0 ? zAxisColor : (value % 50 === 0 ? majorColor : minorColor);
    linePositions.push(-half, y, value, half, y, value);
    lineColors.push(color.r, color.g, color.b, color.r, color.g, color.b);

    color = value === 0 ? xAxisColor : (value % 50 === 0 ? majorColor : minorColor);
    linePositions.push(value, y, -half, value, y, half);
    lineColors.push(color.r, color.g, color.b, color.r, color.g, color.b);
  }

  const gridGeometry = new THREE.BufferGeometry();
  gridGeometry.setAttribute('position', new THREE.Float32BufferAttribute(linePositions, 3));
  gridGeometry.setAttribute('color', new THREE.Float32BufferAttribute(lineColors, 3));
  const gridMaterial = new THREE.LineBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0.76
  });
  const grid = new THREE.LineSegments(gridGeometry, gridMaterial);
  scene.add(grid);

  for (let value = -half; value <= half; value += 10) {
    const cm = value / 10;
    const labelText = cm === 0 ? '0 cm' : `${cm}`;
    const color = value === 0 ? '#ffffff' : (value % 50 === 0 ? '#d7f5ff' : '#9aa6b8');

    const xLabel = createTextSprite(labelText, color);
    xLabel.position.set(value, 0.25, half + 6);
    scene.add(xLabel);

    const zLabel = createTextSprite(labelText, color);
    zLabel.position.set(-half - 6, 0.25, value);
    scene.add(zLabel);
  }

  const xTitle = createTextSprite('X cm', '#ff99aa');
  xTitle.position.set(0, 0.25, half + 15);
  xTitle.scale.set(10, 3.5, 1);
  scene.add(xTitle);

  const zTitle = createTextSprite('Z cm', '#7fe6ff');
  zTitle.position.set(-half - 15, 0.25, 0);
  zTitle.scale.set(10, 3.5, 1);
  scene.add(zTitle);
}

function toggleView() {
  isThirdPerson = !isThirdPerson;
  const btn = document.getElementById('viewToggleBtn');
  const blocker = document.getElementById('blocker');
  clearMotionState();
  isOrbitingCamera = false;

  if (isThirdPerson) {
    // Switch to 3rd Person
    btn.innerText = "Switch to 1st Person (V)";
    fpsControls.unlock();
    fpsControls.disconnect();
    blocker.style.display = 'none';
    
    nozzleVisual.visible = true;
    
    orbitControls.enabled = true;
    orbitControls.target.copy(nozzleVisual.position);
    
    // Pull camera back
    const offset = new THREE.Vector3(0, 20, 30);
    offset.applyQuaternion(camera.quaternion);
    camera.position.copy(nozzleVisual.position).add(offset);
  } else {
    // Switch to 1st Person
    btn.innerText = "Switch to 3rd Person (V)";
    orbitControls.enabled = false;
    fpsControls.connect();
    blocker.style.display = 'flex';
    
    nozzleVisual.visible = true;
    updateCameraForNozzle();
  }
}

function clearMotionState() {
  moveForward = false;
  moveBackward = false;
  moveLeft = false;
  moveRight = false;
  isPrinting = false;
  activeStroke = null;
  isOrbitingCamera = false;
  clearMovementMomentum();
}

function hasMovementInput() {
  return moveForward || moveBackward || moveLeft || moveRight;
}

function clearMovementMomentum() {
  velocity.set(0, 0, 0);
  activeAcceleration = 0;
  inputRampTime = 0;
  currentMotionSpeed = 0;
}

function setupUI() {
  // Color Picker
  const swatches = document.querySelectorAll('.color-swatch');
  swatches.forEach(swatch => {
    swatch.addEventListener('click', (e) => {
      swatches.forEach(s => s.classList.remove('active'));
      e.target.classList.add('active');
      const hex = e.target.getAttribute('data-color');
      currentColor.set(hex);
      document.querySelector(':root').style.setProperty('--accent', hex);
      document.querySelector(':root').style.setProperty('--accent-glow', hex + '80');
      nozzleVisual.material.color.setHex(currentColor.getHex());
      if (printMesh) printMesh.material.color.setHex(currentColor.getHex());
    });
  });

  // Size Slider (Layer Width)
  const sizeSlider = document.getElementById('sizeSlider');
  const sizeValue = document.getElementById('sizeValue');
  sizeSlider.addEventListener('input', (e) => {
    currentSize = parseFloat(e.target.value);
    sizeValue.innerText = currentSize + 'mm';
    const s = Math.max(1, currentSize / 2);
    nozzleVisual.scale.set(s, s, s);
  });

  // Height Slider (Layer Height)
  const heightSlider = document.getElementById('heightSlider');
  const heightValue = document.getElementById('heightValue');
  heightSlider.addEventListener('input', (e) => {
    currentLayerHeight = parseFloat(e.target.value);
    heightValue.innerText = currentLayerHeight + 'mm';
  });


  bindRange('speedSlider', 'speedValue', value => {
    printSpeed = value;
    return `${Math.round(value)}mm/s`;
  });

  bindRange('tempSlider', 'tempValue', value => {
    nozzleTemperature = value;
    rebuildPrintGeometry();
    return `${Math.round(value)}C`;
  });

  bindRange('flowSlider', 'flowValue', value => {
    flowRate = value;
    rebuildPrintGeometry();
    return `${Math.round(value)}%`;
  });

  bindRange('accelSlider', 'accelValue', value => {
    printAcceleration = value;
    return `${Math.round(value)}mm/s2`;
  });
  document.getElementById('orbitPathToggle')?.addEventListener('change', (event) => {
    allowOrbitPathing = event.target.checked;
    document.getElementById('orbitPathLabel').innerText = allowOrbitPathing
      ? 'View Steers Path: On'
      : 'View Steers Path: Off';
    clearMovementMomentum();
  });
  document.getElementById('zoomInBtn')?.addEventListener('click', () => applyZoom(-5));
  document.getElementById('zoomOutBtn')?.addEventListener('click', () => applyZoom(5));
  document.addEventListener('wheel', (event) => {
    if (!event.target.closest('.panel')) applyZoom(Math.sign(event.deltaY) * 4);
  }, { passive: true });

  // Export
  document.getElementById('exportBtn').addEventListener('click', exportSTL);

  // Toggle View
  document.getElementById('viewToggleBtn').addEventListener('click', toggleView);

  // Reset
  document.getElementById('resetBtn').addEventListener('click', resetPrint);

  // Initialize display
  updateStatusPanel();
}

function bindRange(sliderId, valueId, formatter) {
  const slider = document.getElementById(sliderId);
  const value = document.getElementById(valueId);
  if (!slider || !value) return;

  const update = () => {
    const nextValue = parseFloat(slider.value);
    value.innerText = formatter(nextValue);
  };

  slider.addEventListener('input', update);
  update();
}
function applyZoom(delta) {
  if (isThirdPerson) {
    const toCamera = camera.position.clone().sub(nozzleVisual.position);
    const distance = THREE.MathUtils.clamp(toCamera.length() + delta, minCameraDistance, maxCameraDistance * 1.6);
    toCamera.setLength(distance);
    camera.position.copy(nozzleVisual.position).add(toCamera);
    orbitControls.update();
    return;
  }

  cameraDistance = THREE.MathUtils.clamp(cameraDistance + delta, minCameraDistance, maxCameraDistance);
  updateCameraForNozzle();
}

function updateCameraForNozzle() {
  if (isThirdPerson) return;
  const lookDirection = new THREE.Vector3();
  camera.getWorldDirection(lookDirection);
  if (lookDirection.lengthSq() < 0.0001) lookDirection.set(0, 0, -1);

  const cameraTarget = nozzleVisual.position.clone()
    .addScaledVector(lookDirection, -cameraDistance);
  cameraTarget.y += cameraOffsetY;
  camera.position.copy(cameraTarget);
}
function resetPrint() {
  if (confirm("Are you sure you want to clear your current print and reset the nozzle position?")) {
    // 1. Reset generated print geometry
    printPointCount = 0;
    depositedLength = 0;
    printStrokes = [];
    clearMotionState();
    rebuildPrintGeometry();

    // 2. Reset height
    currentPrintHeight = 0.2;

    // Reset camera or nozzle depending on view mode
    if (isThirdPerson) {
      nozzleVisual.position.set(0, currentPrintHeight, 0);
      orbitControls.target.copy(nozzleVisual.position);
      camera.position.set(0, 20.2, 30);
      orbitControls.update();
    } else {
      nozzleVisual.position.set(0, currentPrintHeight, 0);
      camera.position.set(0, 10, 45);
      camera.lookAt(nozzleVisual.position);
      updateCameraForNozzle();
    }

    lastPrintPos.copy(getNozzlePos());
    updateStatusPanel();
  }
}

function onKeyDown(event) {
  switch (event.code) {
    case 'KeyW': moveForward = true; break;
    case 'KeyA': moveLeft = true; break;
    case 'KeyS': moveBackward = true; break;
    case 'KeyD': moveRight = true; break;
    case 'Space': 
      if (!event.repeat) {
        currentPrintHeight = Math.min(buildVolumeSize, currentPrintHeight + currentLayerHeight);
        nozzleVisual.position.y = currentPrintHeight;
        if (!isThirdPerson) updateCameraForNozzle();
        updateStatusPanel();
      }
      break;
    case 'ShiftLeft':
    case 'ShiftRight': 
      if (!event.repeat) {
        currentPrintHeight = Math.max(0.1, currentPrintHeight - currentLayerHeight);
        nozzleVisual.position.y = currentPrintHeight;
        if (!isThirdPerson) updateCameraForNozzle();
        updateStatusPanel();
      }
      break;
    case 'Equal':
    case 'NumpadAdd': applyZoom(-5); break;
    case 'Minus':
    case 'NumpadSubtract': applyZoom(5); break;
    case 'KeyV': toggleView(); break;
    case 'Escape': 
      if (isThirdPerson) {
        document.getElementById('blocker').style.display = 'flex';
        clearMotionState();
      }
      break;
  }
}

function onKeyUp(event) {
  switch (event.code) {
    case 'KeyW': moveForward = false; break;
    case 'KeyA': moveLeft = false; break;
    case 'KeyS': moveBackward = false; break;
    case 'KeyD': moveRight = false; break;
  }

  if (!hasMovementInput()) clearMovementMomentum();
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

window.addEventListener('blur', clearMotionState);

function getNozzlePos() {
  nozzleVisual.position.y = currentPrintHeight;
  return nozzleVisual.position.clone();
}

function startPrintStroke(startPos) {
  activeStroke = [startPos.clone()];
  printStrokes.push(activeStroke);
}

function getPrinterProfile() {
  const temp01 = THREE.MathUtils.clamp((nozzleTemperature - 185) / 55, 0, 1);
  const speed01 = THREE.MathUtils.clamp((printSpeed - 25) / 115, 0, 1);
  const flow = THREE.MathUtils.clamp(flowRate / 100, 0.65, 1.45);
  const heatExpansion = THREE.MathUtils.lerp(0.92, 1.08, temp01);
  const speedNarrowing = THREE.MathUtils.lerp(1.08, 0.88, speed01);

  return {
    width: Math.max(0.1, currentSize * flow * heatExpansion * speedNarrowing),
    height: Math.max(0.05, currentLayerHeight * THREE.MathUtils.clamp(flow * THREE.MathUtils.lerp(0.95, 1.04, temp01), 0.7, 1.4)),
    sampleStep: Math.max(0.16, currentSize * THREE.MathUtils.clamp(0.22 + speed01 * 0.12 - temp01 * 0.08, 0.12, 0.42)),
    smoothing: THREE.MathUtils.clamp(0.2 + temp01 * 0.42 - speed01 * 0.22, 0.1, 0.58)
  };
}

function estimatePathLength(points) {
  let length = 0;
  for (let i = 1; i < points.length; i++) {
    length += points[i - 1].distanceTo(points[i]);
  }
  return length;
}

function smoothStrokePoints(points, profile) {
  if (points.length < 3) return points.map(point => point.clone());

  const length = estimatePathLength(points);
  const divisions = Math.max(2, Math.min(1600, Math.ceil(length / profile.sampleStep)));
  const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal', profile.smoothing);
  return curve.getSpacedPoints(divisions);
}

function appendBeadForStroke(points, profile, vertices, indices) {
  const smoothPoints = smoothStrokePoints(points, profile);
  if (smoothPoints.length < 2) return;

  const halfWidth = profile.width / 2;
  const halfHeight = profile.height / 2;
  const crossSection = [
    [-1, -1],
    [1, -1],
    [1, 0.62],
    [0.72, 1],
    [-0.72, 1],
    [-1, 0.62]
  ];
  const radialSegments = crossSection.length;
  const baseIndex = vertices.length / 3;

  for (let i = 0; i < smoothPoints.length; i++) {
    const point = smoothPoints[i];
    const prev = smoothPoints[Math.max(0, i - 1)];
    const next = smoothPoints[Math.min(smoothPoints.length - 1, i + 1)];
    const tangent = next.clone().sub(prev);
    if (tangent.lengthSq() < 0.0001) tangent.set(0, 0, 1);
    tangent.y = 0;
    tangent.normalize();

    const side = new THREE.Vector3(-tangent.z, 0, tangent.x);

    for (let j = 0; j < radialSegments; j++) {
      const sideOffset = crossSection[j][0] * halfWidth;
      const verticalOffset = crossSection[j][1] * halfHeight;

      vertices.push(
        point.x + side.x * sideOffset,
        Math.max(0, point.y + verticalOffset),
        point.z + side.z * sideOffset
      );
    }
  }

  for (let i = 0; i < smoothPoints.length - 1; i++) {
    const ringA = baseIndex + i * radialSegments;
    const ringB = ringA + radialSegments;

    for (let j = 0; j < radialSegments; j++) {
      const nextJ = (j + 1) % radialSegments;
      indices.push(
        ringA + j, ringB + j, ringA + nextJ,
        ringA + nextJ, ringB + j, ringB + nextJ
      );
    }
  }

  const startCap = vertices.length / 3;
  vertices.push(smoothPoints[0].x, smoothPoints[0].y, smoothPoints[0].z);
  for (let j = 0; j < radialSegments; j++) {
    indices.push(startCap, baseIndex + ((j + 1) % radialSegments), baseIndex + j);
  }

  const endRing = baseIndex + (smoothPoints.length - 1) * radialSegments;
  const endCap = vertices.length / 3;
  const lastPoint = smoothPoints[smoothPoints.length - 1];
  vertices.push(lastPoint.x, lastPoint.y, lastPoint.z);
  for (let j = 0; j < radialSegments; j++) {
    indices.push(endCap, endRing + j, endRing + ((j + 1) % radialSegments));
  }
}

function rebuildPrintGeometry() {
  if (!printGeometry) return;

  const profile = getPrinterProfile();
  const vertices = [];
  const indices = [];

  printStrokes.forEach(stroke => appendBeadForStroke(stroke, profile, vertices, indices));

  printGeometry.dispose();
  printGeometry = new THREE.BufferGeometry();
  printGeometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  printGeometry.setIndex(indices);
  printGeometry.computeVertexNormals();
  printMesh.geometry = printGeometry;
}

function printPoint() {
  if (printPointCount >= MAX_PRINT_POINTS) return;

  const currentPos = getNozzlePos();
  if (!activeStroke) startPrintStroke(lastPrintPos);

  const previousPos = activeStroke[activeStroke.length - 1];
  const distance = previousPos.distanceTo(currentPos);
  const profile = getPrinterProfile();

  if (distance < Math.max(0.12, profile.sampleStep * 0.55)) return;

  activeStroke.push(currentPos.clone());
  depositedLength += distance;
  printPointCount++;
  lastPrintPos.copy(currentPos);
  rebuildPrintGeometry();
  updateStatusPanel();
}

function updateStatusPanel() {
  const nozzleDisplay = document.getElementById('nozzleHeightValue');
  const filamentDisplay = document.getElementById('filamentUsedValue');
  if (nozzleDisplay) {
    nozzleDisplay.innerText = currentPrintHeight.toFixed(2) + 'mm';
  }
  if (filamentDisplay) {
    const usagePercent = Math.min(100, Math.floor((depositedLength / 4000) * 100));
    filamentDisplay.innerText = usagePercent + '%';
  }
}

function exportSTL() {
  if (depositedLength === 0 || !printMesh || !printMesh.geometry.attributes.position?.count) {
    alert("Nothing to export! Print something first.");
    return;
  }

  const exportGeometry = printMesh.geometry.clone();
  exportGeometry.applyMatrix4(new THREE.Matrix4().makeRotationX(Math.PI / 2));
  exportGeometry.computeVertexNormals();

  const exportMesh = new THREE.Mesh(exportGeometry, new THREE.MeshBasicMaterial());
  const exporter = new STLExporter();
  const stlString = exporter.parse(exportMesh);
  exportGeometry.dispose();

  const blob = new Blob([stlString], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.style.display = 'none';
  link.href = url;
  link.download = '3d-print.stl';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function moveVelocityToward(targetVelocity, maxDelta) {
  const deltaVelocity = targetVelocity.clone().sub(velocity);
  deltaVelocity.y = 0;
  const deltaLength = deltaVelocity.length();

  if (deltaLength <= maxDelta || deltaLength < 0.0001) {
    velocity.x = targetVelocity.x;
    velocity.z = targetVelocity.z;
    return;
  }

  deltaVelocity.multiplyScalar(maxDelta / deltaLength);
  velocity.add(deltaVelocity);
}

function moveValueToward(currentValue, targetValue, maxDelta) {
  if (Math.abs(targetValue - currentValue) <= maxDelta) return targetValue;
  return currentValue + Math.sign(targetValue - currentValue) * maxDelta;
}

function smoothStep01(value) {
  const t = THREE.MathUtils.clamp(value, 0, 1);
  return t * t * (3 - 2 * t);
}

function getFirstPersonInputDirection() {
  const inputForward = Number(moveForward) - Number(moveBackward);
  const inputRight = Number(moveRight) - Number(moveLeft);
  if (inputForward === 0 && inputRight === 0) return new THREE.Vector3();

  if (!allowOrbitPathing) return getBuildPlateInputDirection(inputForward, inputRight);

  return getCameraInputDirection(inputForward, inputRight);
}

function getThirdPersonInputDirection() {
  const inputForward = Number(moveForward) - Number(moveBackward);
  const inputRight = Number(moveRight) - Number(moveLeft);
  if (inputForward === 0 && inputRight === 0) return new THREE.Vector3();

  return allowOrbitPathing
    ? getCameraInputDirection(inputForward, inputRight)
    : getBuildPlateInputDirection(inputForward, inputRight);
}

function getBuildPlateInputDirection(inputForward, inputRight) {
  return new THREE.Vector3(inputRight, 0, -inputForward).normalize();
}

function getCameraInputDirection(inputForward, inputRight) {
  const forward = new THREE.Vector3();
  camera.getWorldDirection(forward);
  forward.y = 0;
  if (forward.lengthSq() < 0.0001) forward.set(0, 0, -1);
  forward.normalize();

  const right = new THREE.Vector3().crossVectors(forward, camera.up).normalize();
  return new THREE.Vector3()
    .addScaledVector(forward, inputForward)
    .addScaledVector(right, inputRight)
    .normalize();
}

function updateNozzleMotion(desiredDirection, delta) {
  const acceleration = printAcceleration * 0.32;
  const brakingAcceleration = printAcceleration * 1.55;
  const hasInput = desiredDirection.lengthSq() > 0.0001;
  const currentHorizontalVelocity = new THREE.Vector3(velocity.x, 0, velocity.z);
  const currentSpeed = currentHorizontalVelocity.length();
  const jerkLimit = Math.max(650, printAcceleration * 1.45);
  let targetAcceleration = acceleration;

  if (!hasInput) {
    clearMovementMomentum();
  } else {
    inputRampTime = Math.min(1.2, inputRampTime + delta);
    const launchRamp = smoothStep01(inputRampTime / 0.95);
    let targetSpeed = printSpeed * THREE.MathUtils.lerp(0.06, 1, launchRamp);
    targetAcceleration *= THREE.MathUtils.lerp(0.14, 1, launchRamp);

    if (currentSpeed > 0.01) {
      const currentDirection = currentHorizontalVelocity.normalize();
      const cornerDot = THREE.MathUtils.clamp(currentDirection.dot(desiredDirection), -1, 1);
      if (cornerDot < 0.98) {
        const turnSeverity = THREE.MathUtils.clamp((1 - cornerDot) / 2, 0, 1);
        const cornerRadius = THREE.MathUtils.lerp(8, 1.6, turnSeverity);
        const cornerLimit = Math.sqrt(acceleration * cornerRadius);
        targetSpeed = Math.min(targetSpeed, cornerLimit);
        targetAcceleration = THREE.MathUtils.lerp(acceleration, brakingAcceleration, turnSeverity);
      }
    }

    const targetVelocity = desiredDirection.clone().multiplyScalar(targetSpeed);
    if (currentSpeed > targetSpeed) targetAcceleration = brakingAcceleration;
    activeAcceleration = moveValueToward(activeAcceleration, targetAcceleration, jerkLimit * delta);
    moveVelocityToward(targetVelocity, activeAcceleration * delta);
  }

  if (velocity.lengthSq() < 0.0004) velocity.set(0, 0, 0);

  const attemptedX = nozzleVisual.position.x + velocity.x * delta;
  const attemptedZ = nozzleVisual.position.z + velocity.z * delta;
  nozzleVisual.position.addScaledVector(velocity, delta);
  nozzleVisual.position.y = currentPrintHeight;
  clampPosition(nozzleVisual.position);

  if (nozzleVisual.position.x !== attemptedX) velocity.x = 0;
  if (nozzleVisual.position.z !== attemptedZ) velocity.z = 0;

  currentMotionSpeed = Math.hypot(velocity.x, velocity.z);
}

function animate() {
  requestAnimationFrame(animate);

  const now = performance.now();
  const delta = Math.min((now - time) / 1000, 0.1); // clamp delta to prevent huge jumps
  time = now;

  if (!isThirdPerson && fpsControls.isLocked === true) {
    // 1st Person Movement
    updateNozzleMotion(getFirstPersonInputDirection(), delta);
    updateCameraForNozzle();

  } else if (isThirdPerson && document.getElementById('blocker').style.display === 'none') {
    // 3rd Person Movement (World Absolute)
    const cameraOnlyOrbit = isOrbitingCamera && !allowOrbitPathing;
    updateNozzleMotion(cameraOnlyOrbit ? reusableZeroVector : getThirdPersonInputDirection(), delta);
    orbitControls.target.copy(nozzleVisual.position);
    orbitControls.update();
  } else {
    currentMotionSpeed = Math.hypot(velocity.x, velocity.z);
  }

  const canDepositFilament = (!isThirdPerson && fpsControls.isLocked)
    || (isThirdPerson && document.getElementById('blocker').style.display === 'none' && (!isOrbitingCamera || allowOrbitPathing));

  if (isPrinting && canDepositFilament) {
    const currentPos = getNozzlePos();
    if (lastPrintPos.distanceTo(currentPos) > Math.max(0.12, getPrinterProfile().sampleStep * 0.55)) {
      printPoint();
    }
  }

  renderer.render(scene, camera);
}

function clampPosition(pos) {
  const bounds = buildVolumeSize / 2;
  if (pos.x < -bounds) pos.x = -bounds;
  if (pos.x > bounds) pos.x = bounds;
  if (pos.z < -bounds) pos.z = -bounds;
  if (pos.z > bounds) pos.z = bounds;
  if (pos.y < 0) pos.y = 0;
  if (pos.y > buildVolumeSize) pos.y = buildVolumeSize;
}
