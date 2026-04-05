/**
 * MuscleVerse — Three.js Presentation Engine
 * Each slide has its own Three.js scene rendered into its container.
 * Replace model paths with your downloaded GLB files.
 */

'use strict';

// ═══════════════════════════════════════════════════════
// GLOBAL STATE
// ═══════════════════════════════════════════════════════
let currentSlide = 0;
const TOTAL = 11;
let isTransitioning = false;
const scenes = {}; // active Three.js scenes per slide

// ═══════════════════════════════════════════════════════
// CURSOR
// ═══════════════════════════════════════════════════════
const cursor = document.getElementById('cursor');
const trail  = document.getElementById('cursor-trail');
let mx = 0, my = 0;
document.addEventListener('mousemove', e => {
  mx = e.clientX; my = e.clientY;
  cursor.style.left = mx + 'px'; cursor.style.top = my + 'px';
  setTimeout(() => { trail.style.left = mx + 'px'; trail.style.top = my + 'px'; }, 80);
});

// ═══════════════════════════════════════════════════════
// BACKGROUND THREE.JS — PARTICLE FIELD
// ═══════════════════════════════════════════════════════
function initBackground() {
  const canvas = document.getElementById('three-canvas');
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setClearColor(0x03070f, 1);
  renderer.setSize(innerWidth, innerHeight);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 1000);
  camera.position.z = 50;

  // Particle field
  const count = 3000;
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(count * 3);
  const col = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    pos[i*3]   = (Math.random() - .5) * 200;
    pos[i*3+1] = (Math.random() - .5) * 120;
    pos[i*3+2] = (Math.random() - .5) * 100;
    const r = Math.random();
    col[i*3]   = r > .6 ? 0   : r > .3 ? .5 : 0;
    col[i*3+1] = r > .6 ? .94 : r > .3 ? 0  : .12;
    col[i*3+2] = r > .6 ? 1   : r > .3 ? .5 : 1;
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color',    new THREE.BufferAttribute(col, 3));

  const mat = new THREE.PointsMaterial({
    size: 0.22, vertexColors: true, transparent: true, opacity: 0.6,
    sizeAttenuation: true
  });
  const points = new THREE.Points(geo, mat);
  scene.add(points);

  // Slow drift grid lines
  const gridMat = new THREE.LineBasicMaterial({ color: 0x003344, transparent: true, opacity: 0.3 });
  for (let i = -5; i <= 5; i++) {
    const g = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-100, i * 10, -20),
      new THREE.Vector3( 100, i * 10, -20)
    ]);
    scene.add(new THREE.Line(g, gridMat));
    const g2 = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(i * 20, -60, -20),
      new THREE.Vector3(i * 20,  60, -20)
    ]);
    scene.add(new THREE.Line(g2, gridMat));
  }

  function syncBackgroundViewport() {
    renderer.setSize(window.innerWidth, window.innerHeight, false);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
  }

  let t = 0;
  function animate() {
    requestAnimationFrame(animate);
    t += 0.004;
    points.rotation.y = Math.sin(t * 0.3) * 0.15;
    points.rotation.x = Math.sin(t * 0.2) * 0.08;
    // Mouse parallax
    const tx = (mx / innerWidth  - .5) * 3;
    const ty = (my / innerHeight - .5) * 2;
    camera.position.x += (tx - camera.position.x) * 0.04;
    camera.position.y += (-ty - camera.position.y) * 0.04;
    renderer.render(scene, camera);
  }
  animate();

  syncBackgroundViewport();
  window.addEventListener('resize', syncBackgroundViewport);
  window.addEventListener('pageshow', syncBackgroundViewport);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) syncBackgroundViewport();
  });
  canvas.addEventListener('webglcontextlost', e => {
    e.preventDefault();
  });
  canvas.addEventListener('webglcontextrestored', syncBackgroundViewport);
}

// ═══════════════════════════════════════════════════════
// HELPER: Create a mini Three.js renderer in a container
// ═══════════════════════════════════════════════════════
function makeScene(container, opts = {}) {
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const W = container.clientWidth  || 400;
  const H = container.clientHeight || 300;
  renderer.setSize(W, H);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(opts.fov || 45, W / H, 0.01, 1000);
  camera.position.set(...(opts.cam || [0, 0, 4]));

  // Lights
  const ambient = new THREE.AmbientLight(0x111133, 1.5);
  scene.add(ambient);

  const key = new THREE.DirectionalLight(0x00f0ff, 3);
  key.position.set(5, 8, 5);
  key.castShadow = true;
  scene.add(key);

  const fill = new THREE.DirectionalLight(0xff2070, 1.2);
  fill.position.set(-5, -3, 3);
  scene.add(fill);

  const rim = new THREE.DirectionalLight(0x8800ff, 0.8);
  rim.position.set(0, -8, -5);
  scene.add(rim);

  // Point glow lights
  const glow1 = new THREE.PointLight(0x00f0ff, 2, 20);
  glow1.position.set(3, 3, 3);
  scene.add(glow1);

  return { renderer, scene, camera, W, H };
}

// ═══════════════════════════════════════════════════════
// HELPER: Load GLB model (uses GLTFLoader from CDN)
// Falls back to procedural if model missing
// ═══════════════════════════════════════════════════════
function loadGLB(scene, path, onLoad, onFail) {
  // We'll use fetch to check if file exists then use dynamic import
  // Since we can't guarantee CDN GLTFLoader is loaded, we build it inline
  const script = document.createElement('script');
  script.src = 'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/GLTFLoader.js';
  script.onload = () => {
    const loader = new THREE.GLTFLoader();
    loader.load(path, gltf => onLoad(gltf.scene), undefined, onFail);
  };
  script.onerror = onFail;
  if (!window._gltfLoaderLoaded) {
    window._gltfLoaderLoaded = true;
    document.head.appendChild(script);
  } else if (window.THREE && THREE.GLTFLoader) {
    const loader = new THREE.GLTFLoader();
    loader.load(path, gltf => onLoad(gltf.scene), undefined, onFail);
  } else {
    setTimeout(() => {
      if (THREE.GLTFLoader) {
        const loader = new THREE.GLTFLoader();
        loader.load(path, gltf => onLoad(gltf.scene), undefined, onFail);
      } else onFail();
    }, 1200);
  }
}

function createAnatomyModelRoot(model, options = {}) {
  const {
    height = 5.2,
    position = [0, 0, 0],
    rotation = [0, 0, 0]
  } = options;

  model.traverse(node => {
    if (!node.isMesh) return;
    node.castShadow = false;
    node.receiveShadow = false;
    if (node.material) {
      node.material.transparent = true;
      node.material.opacity = 0.96;
    }
  });

  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const scale = size.y ? height / size.y : 1;

  model.scale.setScalar(scale);
  model.position.set(
    -center.x * scale,
    -center.y * scale,
    -center.z * scale
  );

  const root = new THREE.Group();
  root.add(model);
  root.position.set(...position);
  root.rotation.set(...rotation);
  return root;
}

// ═══════════════════════════════════════════════════════
// PROCEDURAL MODELS (beautiful fallbacks + supplements)
// ═══════════════════════════════════════════════════════

// Build a realistic-looking muscle body from geometry
function buildProceduralBody(scene) {
  const group = new THREE.Group();

  // Emissive skin material — glowing cyan anatomical look
  function muscleMat(color = 0xcc2244, emissive = 0x110011) {
    return new THREE.MeshPhysicalMaterial({
      color, emissive, emissiveIntensity: 0.3,
      roughness: 0.55, metalness: 0.05,
      clearcoat: 0.3, clearcoatRoughness: 0.4
    });
  }

  // Head
  const head = new THREE.Mesh(new THREE.SphereGeometry(.38, 32, 24), muscleMat(0xcc3355, 0x110011));
  head.position.y = 2.1; group.add(head);

  // Neck
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(.15,.18,.38,16), muscleMat(0xbb3344));
  neck.position.y = 1.78; group.add(neck);

  // Torso — using capsule-like shape
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(.55,.48,1.3,24), muscleMat(0xcc2233,0x220011));
  torso.position.y = 0.9; group.add(torso);

  // Chest muscles (pecs) — flattened spheres
  [-1,1].forEach(s => {
    const pec = new THREE.Mesh(new THREE.SphereGeometry(.35,20,16), muscleMat(0xdd3344,0x330011));
    pec.scale.set(1.1,.6,.55); pec.position.set(s*.28,1.1,.3); group.add(pec);
    // shoulder
    const shl = new THREE.Mesh(new THREE.SphereGeometry(.22,16,12), muscleMat(0xcc2244,0x220011));
    shl.position.set(s*.75,1.35,0); group.add(shl);
    // upper arm
    const ua = new THREE.Mesh(new THREE.CylinderGeometry(.13,.16,.75,12), muscleMat(0xcc3344));
    ua.position.set(s*.85,.85,0); ua.rotation.z = s*0.2; group.add(ua);
    // bicep bump
    const bic = new THREE.Mesh(new THREE.SphereGeometry(.17,14,10), muscleMat(0xdd2244,0x330011));
    bic.scale.set(.9,1.3,.7); bic.position.set(s*.9,.75,.1); group.add(bic);
    // forearm
    const fa = new THREE.Mesh(new THREE.CylinderGeometry(.1,.13,.65,12), muscleMat(0xbb3355));
    fa.position.set(s*.88,.2,0); fa.rotation.z = s*0.1; group.add(fa);
    // thigh
    const th = new THREE.Mesh(new THREE.CylinderGeometry(.2,.17,.85,16), muscleMat(0xcc2244,0x220011));
    th.position.set(s*.2,-.52,0); group.add(th);
    // quad bump
    const q = new THREE.Mesh(new THREE.SphereGeometry(.22,14,10), muscleMat(0xdd3344,0x330011));
    q.scale.set(.85,1.2,.65); q.position.set(s*.22,-.48,.12); group.add(q);
    // shin
    const sh = new THREE.Mesh(new THREE.CylinderGeometry(.11,.13,.75,12), muscleMat(0xbb3344));
    sh.position.set(s*.2,-1.3,0); group.add(sh);
  });

  // Abs — segmented
  for (let i=0;i<3;i++) {
    [-1,1].forEach(s => {
      const ab = new THREE.Mesh(new THREE.BoxGeometry(.16,.2,.12), muscleMat(0xdd3344,0x440011));
      ab.position.set(s*.11,.55-i*.22,.42); group.add(ab);
    });
  }

  // Pelvis
  const pelv = new THREE.Mesh(new THREE.CylinderGeometry(.42,.38,.32,20), muscleMat(0xbb2233));
  pelv.position.y = -.05; group.add(pelv);

  // Holographic overlay effect — wireframe shell
  const wfMat = new THREE.MeshBasicMaterial({
    color: 0x00f0ff, wireframe: true, transparent: true, opacity: 0.05
  });
  const wf = new THREE.Mesh(new THREE.CylinderGeometry(.65,.62,3.8,20,8), wfMat);
  wf.position.y = 0.3; group.add(wf);

  return group;
}

// Realistic sarcomere cross-section
function buildSarcomere(scene) {
  const group = new THREE.Group();

  // Z-line discs
  [-1.4, 1.4].forEach(x => {
    const zLine = new THREE.Mesh(
      new THREE.CylinderGeometry(1.1, 1.1, 0.08, 32),
      new THREE.MeshPhysicalMaterial({ color:0x00f0ff, emissive:0x00aacc, emissiveIntensity:.8, roughness:.2 })
    );
    zLine.rotation.z = Math.PI/2; zLine.position.x = x;
    group.add(zLine);
  });

  // Myosin thick filaments (central, magenta)
  const myoMat = new THREE.MeshPhysicalMaterial({
    color:0xff2070, emissive:0x880030, emissiveIntensity:.4, roughness:.3, metalness:.1
  });
  for (let i=0;i<7;i++) {
    const angle = (i/7)*Math.PI*2;
    const r = i===0 ? 0 : .55;
    const myo = new THREE.Mesh(new THREE.CylinderGeometry(.055,.055,2.0,12), myoMat);
    myo.rotation.z = Math.PI/2;
    myo.position.set(0, Math.sin(angle)*r, Math.cos(angle)*r);
    group.add(myo);
    // Myosin heads
    if (i > 0) {
      for (let h=0;h<4;h++) {
        const hd = new THREE.Mesh(new THREE.SphereGeometry(.04,8,6), myoMat);
        hd.position.set(-.6+h*.4, Math.sin(angle)*r+.12, Math.cos(angle)*r+.06);
        group.add(hd);
      }
    }
  }

  // Actin thin filaments (cyan)
  const actMat = new THREE.MeshPhysicalMaterial({
    color:0x00f0ff, emissive:0x005577, emissiveIntensity:.5, roughness:.25
  });
  [[-1.1,0],[-1.1,.5],[-1.1,-.5],[1.1,0],[1.1,.5],[1.1,-.5]].forEach(([xPos,zPos]) => {
    const act = new THREE.Mesh(new THREE.CylinderGeometry(.03,.03,.85,8), actMat);
    act.rotation.z = Math.PI/2;
    act.position.set(xPos*.8, .2, zPos);
    group.add(act);
    const act2 = new THREE.Mesh(new THREE.CylinderGeometry(.03,.03,.85,8), actMat);
    act2.rotation.z = Math.PI/2;
    act2.position.set(xPos*.8, -.2, zPos);
    group.add(act2);
  });

  // Glow halo
  const halo = new THREE.Mesh(
    new THREE.TorusGeometry(1.2, 0.04, 8, 40),
    new THREE.MeshBasicMaterial({ color:0x00f0ff, transparent:true, opacity:.2 })
  );
  group.add(halo);

  return group;
}

// Muscle fiber cylinder — healthy or sick
function buildFiber(sick = false) {
  const group = new THREE.Group();
  const length = 3.3;
  const radius = sick ? 0.98 : 1.02;
  const coreColor = sick ? 0xdb4b72 : 0xf05384;
  const sheathColor = sick ? 0x4fd7e3 : 0x63eeff;
  const endX = length / 2;

  const bodyMat = new THREE.MeshPhysicalMaterial({
    color: coreColor,
    emissive: sick ? 0x360813 : 0x541126,
    emissiveIntensity: sick ? 0.16 : 0.26,
    roughness: 0.42,
    metalness: 0.08,
    clearcoat: 0.24,
    clearcoatRoughness: 0.58
  });
  const sheathMat = new THREE.MeshPhysicalMaterial({
    color: sheathColor,
    emissive: 0x0d5e6b,
    emissiveIntensity: sick ? 0.28 : 0.45,
    transparent: true,
    opacity: sick ? 0.55 : 0.72,
    roughness: 0.18,
    metalness: 0.05,
    transmission: 0.08
  });
  const dividerMat = new THREE.MeshBasicMaterial({
    color: sheathColor,
    transparent: true,
    opacity: sick ? 0.45 : 0.72
  });
  const fascicleMat = new THREE.MeshPhysicalMaterial({
    color: sick ? 0xd54567 : 0xe84f79,
    emissive: sick ? 0x22070d : 0x3f0f1c,
    emissiveIntensity: 0.18,
    roughness: 0.52,
    metalness: 0.04
  });

  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius * (sick ? 1.03 : 1), length, 72, 1, true),
    bodyMat
  );
  body.rotation.z = Math.PI / 2;
  group.add(body);

  const innerCore = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 0.92, radius * 0.92, length * 0.985, 64, 1, true),
    new THREE.MeshPhysicalMaterial({
      color: sick ? 0xc83f65 : 0xd94772,
      emissive: sick ? 0x22060b : 0x300b15,
      emissiveIntensity: 0.12,
      roughness: 0.55,
      metalness: 0.02,
      transparent: true,
      opacity: 0.88
    })
  );
  innerCore.rotation.z = Math.PI / 2;
  group.add(innerCore);

  const ridgeCount = sick ? 28 : 40;
  for (let i = 0; i < ridgeCount; i++) {
    const angle = (i / ridgeCount) * Math.PI * 2;
    const r = radius * (sick ? 0.95 + Math.sin(i * 1.7) * 0.03 : 0.965);
    const ridge = new THREE.Mesh(
      new THREE.CylinderGeometry(0.042, 0.042, length * 0.985, 10),
      new THREE.MeshPhysicalMaterial({
        color: sick ? 0xf06b8a : 0xff7aa0,
        emissive: sick ? 0x4a0c1b : 0x6d1530,
        emissiveIntensity: sick ? 0.2 : 0.3,
        roughness: 0.28,
        metalness: 0.06
      })
    );
    ridge.rotation.z = Math.PI / 2;
    ridge.position.set(0, Math.cos(angle) * r, Math.sin(angle) * r);
    group.add(ridge);
  }

  const frontRing = new THREE.Mesh(
    new THREE.RingGeometry(radius * 0.89, radius * 1.03, 72),
    sheathMat
  );
  frontRing.position.x = endX + 0.012;
  frontRing.rotation.y = Math.PI / 2;
  group.add(frontRing);

  const backCap = new THREE.Mesh(
    new THREE.CircleGeometry(radius * 0.98, 64),
    new THREE.MeshPhysicalMaterial({
      color: sick ? 0xc13d64 : 0xd74772,
      emissive: sick ? 0x1f060b : 0x2d0a14,
      emissiveIntensity: 0.1,
      roughness: 0.64,
      metalness: 0.02,
      transparent: true,
      opacity: 0.82
    })
  );
  backCap.position.x = -endX - 0.002;
  backCap.rotation.y = -Math.PI / 2;
  group.add(backCap);

  const fascicleSpecs = sick ? [
    { y: 0.37, z: 0.41, ry: 0.29, rz: 0.42 },
    { y: -0.42, z: 0.32, ry: 0.3, rz: 0.33 },
    { y: 0.08, z: -0.43, ry: 0.25, rz: 0.45 },
    { y: -0.46, z: -0.18, ry: 0.18, rz: 0.23 },
    { y: 0.48, z: -0.16, ry: 0.2, rz: 0.23 }
  ] : [
    { y: 0.42, z: 0.34, ry: 0.31, rz: 0.42 },
    { y: -0.41, z: 0.33, ry: 0.31, rz: 0.39 },
    { y: 0.02, z: -0.43, ry: 0.26, rz: 0.45 },
    { y: -0.46, z: -0.02, ry: 0.19, rz: 0.24 },
    { y: 0.49, z: -0.03, ry: 0.19, rz: 0.24 }
  ];

  fascicleSpecs.forEach(({ y, z, ry, rz }, i) => {
    const fascicle = new THREE.Mesh(new THREE.CircleGeometry(1, 40), fascicleMat);
    fascicle.scale.set(ry, rz, 1);
    fascicle.position.set(endX + 0.006, y, z);
    fascicle.rotation.y = Math.PI / 2;
    group.add(fascicle);

    const fascicleOutline = new THREE.Mesh(
      new THREE.RingGeometry(0.96, 1.05, 40),
      dividerMat.clone()
    );
    fascicleOutline.scale.set(ry, rz, 1);
    fascicleOutline.position.set(endX + 0.01, y, z);
    fascicleOutline.rotation.y = Math.PI / 2;
    fascicleOutline.material.opacity = sick ? 0.34 : 0.62;
    group.add(fascicleOutline);

    for (let s = 0; s < (sick ? 7 : 10); s++) {
      const strand = new THREE.Mesh(
        new THREE.CylinderGeometry(0.005, 0.005, length * 0.94, 6),
        new THREE.MeshBasicMaterial({
          color: i % 2 === 0 ? 0xff97b4 : 0xff6f9b,
          transparent: true,
          opacity: sick ? 0.16 : 0.24
        })
      );
      strand.rotation.z = Math.PI / 2;
      strand.position.set(
        0,
        y + (s / Math.max(1, (sick ? 6 : 9)) - 0.5) * ry * 1.15,
        z + Math.sin(s * 1.7 + i) * rz * 0.18
      );
      group.add(strand);
    }
  });

  const dividerCurves = [
    [[endX + 0.014, 0.03, 0.06], [endX + 0.014, 0.22, 0.23], [endX + 0.014, 0.52, 0.62]],
    [[endX + 0.014, -0.05, 0.02], [endX + 0.014, -0.25, 0.22], [endX + 0.014, -0.56, 0.57]],
    [[endX + 0.014, 0.02, -0.06], [endX + 0.014, 0.03, -0.28], [endX + 0.014, 0.04, -0.76]],
    [[endX + 0.014, -0.06, -0.02], [endX + 0.014, -0.31, -0.02], [endX + 0.014, -0.71, -0.04]],
    [[endX + 0.014, 0.06, -0.02], [endX + 0.014, 0.35, -0.03], [endX + 0.014, 0.74, -0.05]]
  ];
  dividerCurves.forEach(points => {
    const curve = new THREE.CatmullRomCurve3(points.map(([x, y, z]) => new THREE.Vector3(x, y, z)));
    const divider = new THREE.Mesh(
      new THREE.TubeGeometry(curve, 20, sick ? 0.016 : 0.02, 8, false),
      dividerMat
    );
    group.add(divider);
  });

  const outerShell = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 1.05, radius * 1.05, length * 1.01, 72, 1, true),
    new THREE.MeshBasicMaterial({
      color: sheathColor,
      wireframe: true,
      transparent: true,
      opacity: sick ? 0.1 : 0.14
    })
  );
  outerShell.rotation.z = Math.PI / 2;
  group.add(outerShell);

  const aura = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 1.14, radius * 1.14, length * 0.98, 72, 1, true),
    new THREE.MeshBasicMaterial({
      color: 0x32eaff,
      transparent: true,
      opacity: sick ? 0.05 : 0.08,
      side: THREE.BackSide
    })
  );
  aura.rotation.z = Math.PI / 2;
  group.add(aura);

  group.rotation.y = sick ? -0.18 : -0.12;
  group.rotation.z = sick ? -0.08 : -0.04;
  return group;
}

// Scaffold 3D grid
function buildScaffold() {
  const group = new THREE.Group();
  const N = 5;
  const spacing = .7;

  const nodeMat = new THREE.MeshPhysicalMaterial({
    color:0x00f0ff, emissive:0x005566, emissiveIntensity:.6, roughness:.3
  });
  const barMat = new THREE.MeshBasicMaterial({ color:0x00f0ff, transparent:true, opacity:.2 });
  const cellMat = new THREE.MeshPhysicalMaterial({
    color:0xff2070, emissive:0x440011, emissiveIntensity:.5,
    roughness:.4, transparent:true, opacity:.7
  });

  for (let x=0;x<N;x++) for (let y=0;y<N;y++) for (let z=0;z<3;z++) {
    const px = (x-N/2)*spacing, py = (y-N/2)*spacing, pz = (z-1)*spacing;
    // Node sphere
    const node = new THREE.Mesh(new THREE.SphereGeometry(.045,8,6), nodeMat);
    node.position.set(px,py,pz); group.add(node);

    // Connecting bars X direction
    if (x < N-1) {
      const bar = new THREE.Mesh(new THREE.CylinderGeometry(.018,.018,spacing-.05,6), barMat);
      bar.rotation.z = Math.PI/2; bar.position.set(px+spacing/2,py,pz); group.add(bar);
    }
    // Y direction
    if (y < N-1) {
      const bar = new THREE.Mesh(new THREE.CylinderGeometry(.018,.018,spacing-.05,6), barMat);
      bar.position.set(px,py+spacing/2,pz); group.add(bar);
    }

    // Random cells (floating spheres = seeded cells)
    if (Math.random() > .55) {
      const cell = new THREE.Mesh(new THREE.SphereGeometry(.08+Math.random()*.04,10,8), cellMat);
      cell.position.set(px+(Math.random()-.5)*.3, py+(Math.random()-.5)*.3, pz+(Math.random()-.5)*.2);
      group.add(cell);
    }
  }

  return group;
}

// SMA — shape memory coil
function buildSMA() {
  const group = new THREE.Group();
  const mat = new THREE.MeshPhysicalMaterial({
    color:0xccddee, metalness:.9, roughness:.15, emissive:0x002244, emissiveIntensity:.3
  });
  const path = new THREE.CatmullRomCurve3(
    Array.from({length:40}, (_,i) => {
      const t = i/39, angle = t*Math.PI*8;
      const r = .6*(1-t*.3);
      return new THREE.Vector3(Math.cos(angle)*r, t*3-1.5, Math.sin(angle)*r*.5);
    })
  );
  const tube = new THREE.Mesh(new THREE.TubeGeometry(path, 120, .055, 12, false), mat);
  group.add(tube);
  // Glow halo around coil
  const glow = new THREE.Mesh(
    new THREE.TorusGeometry(.7,.02,8,60),
    new THREE.MeshBasicMaterial({color:0x00f0ff,transparent:true,opacity:.25})
  );
  glow.rotation.x = Math.PI/2; group.add(glow);
  return group;
}

// EAP — undulating polymer sheets
function buildEAP() {
  const group = new THREE.Group();
  const W=3,H=2,wSeg=40,hSeg=20;
  const geo = new THREE.PlaneGeometry(W,H,wSeg,hSeg);
  const mat = new THREE.MeshPhysicalMaterial({
    color:0x8844ff, emissive:0x220066, emissiveIntensity:.5,
    roughness:.3, metalness:.1, side:THREE.DoubleSide,
    transparent:true, opacity:.85
  });
  const mesh = new THREE.Mesh(geo,mat);
  mesh.userData.basePositions = geo.attributes.position.array.slice();
  mesh.userData.isEAP = true;
  // Second layer
  const mesh2 = mesh.clone();
  mesh2.position.z = .18;
  mesh2.material = mesh2.material.clone();
  mesh2.material.color.setHex(0x4400ff);
  mesh2.material.emissive.setHex(0x110044);
  group.add(mesh); group.add(mesh2);
  return group;
}

// CNT — nanotube bundle
function buildCNT() {
  const group = new THREE.Group();
  const mat = new THREE.MeshPhysicalMaterial({
    color:0x111111, metalness:.95, roughness:.05,
    emissive:0x002233, emissiveIntensity:.5
  });
  const glowMat = new THREE.MeshBasicMaterial({color:0x00f0ff,transparent:true,opacity:.4});

  const positions = [
    [0,0],[.3,.18],[-.3,.18],[.3,-.18],[-.3,-.18],[.6,0],[-.6,0],
    [0,.36],[0,-.36]
  ];
  positions.forEach(([ox,oz]) => {
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(.08,.08,3,12), mat);
    tube.position.set(ox,0,oz); group.add(tube);
    // Glow ring at midpoint
    const ring = new THREE.Mesh(new THREE.TorusGeometry(.09,.008,6,20),glowMat);
    ring.rotation.x=Math.PI/2; ring.position.set(ox,0,oz); group.add(ring);
  });
  // Connecting arcs
  const arcMat = new THREE.MeshBasicMaterial({color:0x00f0ff,transparent:true,opacity:.15});
  for (let i=0;i<8;i++) {
    const a = (i/8)*Math.PI*2, r=.65;
    const arc = new THREE.Mesh(new THREE.TorusGeometry(r,.01,4,30,Math.PI/4), arcMat);
    arc.rotation.set(Math.PI/2,a,0); arc.position.y=(Math.random()-.5)*2.4; group.add(arc);
  }
  return group;
}

// Prosthetic arm
function buildProsthetic() {
  const group = new THREE.Group();
  const frameMat = new THREE.MeshPhysicalMaterial({
    color:0x334455, metalness:.85, roughness:.1,
    emissive:0x001122, emissiveIntensity:.2
  });
  const glowMat = new THREE.MeshPhysicalMaterial({
    color:0x00f0ff, emissive:0x00ccee, emissiveIntensity:.8, roughness:.3
  });

  // Upper arm
  const ua = new THREE.Mesh(new THREE.CylinderGeometry(.22,.28,1.2,20), frameMat);
  ua.position.y=.8; group.add(ua);
  // Elbow joint
  const elbow = new THREE.Mesh(new THREE.SphereGeometry(.25,16,12), frameMat);
  elbow.position.y=.15; group.add(elbow);
  // Elbow glow ring
  const eg = new THREE.Mesh(new THREE.TorusGeometry(.27,.025,8,30), glowMat);
  eg.position.y=.15; group.add(eg);
  // Forearm
  const fa = new THREE.Mesh(new THREE.CylinderGeometry(.18,.22,.9,20), frameMat);
  fa.position.y=-.42; group.add(fa);
  // Wrist
  const wr = new THREE.Mesh(new THREE.SphereGeometry(.19,16,12), frameMat);
  wr.position.y=-.92; group.add(wr);
  const wg = new THREE.Mesh(new THREE.TorusGeometry(.21,.02,8,30), glowMat);
  wg.position.y=-.92; group.add(wg);
  // Fingers
  [-2,-1,0,1,2].forEach((f,i) => {
    const fLen = i===0||i===4 ? .45 : .6;
    const fing = new THREE.Mesh(new THREE.CylinderGeometry(.04,.055,fLen,8), frameMat);
    fing.position.set(f*.1,-1.18,0); fing.rotation.z=f*.15; group.add(fing);
    // Knuckle
    const kn = new THREE.Mesh(new THREE.SphereGeometry(.06,8,6), glowMat);
    kn.position.set(f*.1,-1.08,0); group.add(kn);
  });
  // Side actuators
  [-1,1].forEach(s => {
    const act = new THREE.Mesh(new THREE.CylinderGeometry(.04,.04,.7,8), glowMat);
    act.position.set(s*.3,.1,0); group.add(act);
    // Hydraulic line
    const line = new THREE.Mesh(new THREE.CylinderGeometry(.01,.01,.5,6), 
      new THREE.MeshBasicMaterial({color:0xff2070}));
    line.position.set(s*.25,-.3,0); group.add(line);
  });
  return group;
}

// ═══════════════════════════════════════════════════════
// SLIDE-SPECIFIC SCENE INITS
// ═══════════════════════════════════════════════════════

function initSlide1() {
  if (scenes[0]) return;
  // Body model fills left 55% of screen
  const container = document.createElement('div');
  container.style.cssText = 'position:absolute;left:0;top:0;width:55%;height:100%;z-index:5;pointer-events:none;';
  document.getElementById('s1').appendChild(container);

  const { renderer, scene, camera } = makeScene(container, { fov:40, cam:[0,1.5,7] });
  const body = buildProceduralBody(scene);
  scene.add(body);

  // Holographic edge lines on body
  const edgeMat = new THREE.MeshBasicMaterial({color:0x00f0ff,wireframe:true,transparent:true,opacity:.04});
  const edgeMesh = new THREE.Mesh(new THREE.SphereGeometry(2.8,12,8), edgeMat);
  scene.add(edgeMesh);

  // Floating scan rings
  const rings = [];
  for(let i=0;i<3;i++){
    const r = new THREE.Mesh(
      new THREE.TorusGeometry(.8+i*.4,.008,6,60),
      new THREE.MeshBasicMaterial({color:0x00f0ff,transparent:true,opacity:.15-i*.03})
    );
    r.userData.speed=.4+i*.2; r.userData.offset=i*1.2;
    scene.add(r); rings.push(r);
  }

  // Particle burst from fist
  const partGeo = new THREE.BufferGeometry();
  const pCount=150, pPos=new Float32Array(pCount*3), pVel=[];
  for(let i=0;i<pCount;i++){
    pPos[i*3]=(Math.random()-.5)*1.5+-.5;
    pPos[i*3+1]=(Math.random()-.5)*2+.5;
    pPos[i*3+2]=(Math.random()-.5);
    pVel.push(new THREE.Vector3((Math.random()-.5)*.02,(Math.random()-.5)*.02,(Math.random()-.5)*.01));
  }
  partGeo.setAttribute('position',new THREE.BufferAttribute(pPos,3));
  const partMat=new THREE.PointsMaterial({color:0x00f0ff,size:.04,transparent:true,opacity:.6});
  const parts=new THREE.Points(partGeo,partMat);
  scene.add(parts);

  let t=0;
  function loop(){
    requestAnimationFrame(loop);
    t+=.008;
    body.rotation.y=Math.sin(t*.4)*.15;
    body.position.y=Math.sin(t*.3)*.04;
    rings.forEach(r=>{r.rotation.x=t*r.userData.speed;r.rotation.y=t*r.userData.speed*.7+r.userData.offset;});
    edgeMesh.rotation.y=t*.05;
    // Particles drift
    const pos=partGeo.attributes.position.array;
    for(let i=0;i<pCount;i++){
      pos[i*3]+=pVel[i].x; pos[i*3+1]+=pVel[i].y; pos[i*3+2]+=pVel[i].z;
      if(Math.abs(pos[i*3])>2||Math.abs(pos[i*3+1])>3){
        pos[i*3]=(Math.random()-.5)*1.5; pos[i*3+1]=(Math.random()-.5)*2; pos[i*3+2]=(Math.random()-.5);
      }
    }
    partGeo.attributes.position.needsUpdate=true;
    renderer.render(scene, camera);
  }
  loop();
  scenes[0] = true;
}

function initSlide2() {
  if (scenes[1]) return;
  const container = document.createElement('div');
  container.style.cssText = 'position:absolute;left:0;top:0;width:52%;height:100%;z-index:5;pointer-events:none;';
  document.getElementById('s2').appendChild(container);

  const { renderer, scene, camera } = makeScene(container, { fov:38, cam:[0,0,8] });

  let body = null;
  const useFallbackBody = () => {
    if (body) return;
    body = buildProceduralBody(scene);
    scene.add(body);
  };

  loadGLB(
    scene,
    'human+anatomy+3d+model.glb',
    model => {
      body = createAnatomyModelRoot(model, {
        height: 4.8,
        position: [0, -0.15, 0],
        rotation: [0, -0.35, 0]
      });
      scene.add(body);
    },
    useFallbackBody
  );

  // Scan plane
  const scanMat = new THREE.MeshBasicMaterial({color:0x00f0ff,transparent:true,opacity:.06,side:THREE.DoubleSide});
  const scan = new THREE.Mesh(new THREE.PlaneGeometry(3,3), scanMat);
  scene.add(scan);

  // Anatomical label markers
  const markerMat = new THREE.MeshBasicMaterial({color:0x00f0ff});
  [[0,2.1,0],[.7,1.3,0],[0,.9,.5],[.22,-.5,0]].forEach(pos=>{
    const m=new THREE.Mesh(new THREE.SphereGeometry(.04,8,6),markerMat);
    m.position.set(...pos); scene.add(m);
    const linGeo=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(...pos),new THREE.Vector3(pos[0]+.6,pos[1]+.1,.1)]);
    scene.add(new THREE.Line(linGeo,new THREE.LineBasicMaterial({color:0x00f0ff,transparent:true,opacity:.3})));
  });

  let t=0, scanY=-2;
  function loop(){
    requestAnimationFrame(loop);
    t+=.016; scanY+=.04; if(scanY>2.5) scanY=-2;
    if (body) {
      body.rotation.y = -0.35 + t * 0.18 + Math.sin(t * 0.5) * 0.12;
      body.rotation.x = Math.sin(t * 0.28) * 0.03;
    }
    scan.position.y=scanY; scan.rotation.x=Math.PI/2;
    renderer.render(scene,camera);
  }
  loop();
  scenes[1]=true;
}

function initSlide3() {
  if (scenes[2]) return;
  // 3 mini scenes in card viewers
  const configs=[
    { id:'skel-viewer', build:()=>{
      const g=new THREE.Group();
      // Realistic skeletal fiber bundle
      for(let i=0;i<5;i++){
        const fib=new THREE.Mesh(new THREE.CylinderGeometry(.06,.06,2.5,12),
          new THREE.MeshPhysicalMaterial({color:0xcc2244,emissive:0x440011,emissiveIntensity:.4,roughness:.4}));
        fib.rotation.z=Math.PI/2; fib.position.set(0,(i-2)*.22,0); g.add(fib);
        // Striations
        for(let s=0;s<8;s++){
          const band=new THREE.Mesh(new THREE.CylinderGeometry(.07,.07,.04,12),
            new THREE.MeshBasicMaterial({color:0xff3355,transparent:true,opacity:.5}));
          band.rotation.z=Math.PI/2; band.position.set(-1.1+s*.31,(i-2)*.22,0); g.add(band);
        }
      }
      // Perimysium wrapping
      const wrap=new THREE.Mesh(new THREE.CylinderGeometry(.75,.75,2.5,24),
        new THREE.MeshBasicMaterial({color:0x00f0ff,wireframe:true,transparent:true,opacity:.1}));
      wrap.rotation.z=Math.PI/2; g.add(wrap);
      return g;
    }, cam:[0,0,3.5], rot:.008},
    { id:'smooth-viewer', build:()=>{
      const g=new THREE.Group();
      const mat=new THREE.MeshPhysicalMaterial({color:0xdd3355,emissive:0x330011,emissiveIntensity:.4,roughness:.5});
      // Spindle-shaped smooth muscle cells
      for(let i=0;i<6;i++){
        const path=new THREE.CatmullRomCurve3([
          new THREE.Vector3(-1.2,0,0),new THREE.Vector3(0,(Math.random()-.5)*.2,0),new THREE.Vector3(1.2,0,0)
        ]);
        const tube=new THREE.Mesh(new THREE.TubeGeometry(path,20,.055,8,false),mat);
        tube.position.set(0,(i-2.5)*.28,0); g.add(tube);
      }
      const wrap=new THREE.Mesh(new THREE.BoxGeometry(2.5,1.8,.2),
        new THREE.MeshBasicMaterial({color:0xff2070,wireframe:true,transparent:true,opacity:.08}));
      g.add(wrap);
      return g;
    }, cam:[0,0,3.5], rot:-.007},
    { id:'cardiac-viewer', build:()=>{
      const g=new THREE.Group();
      // Heart-like branched fibers
      const mat=new THREE.MeshPhysicalMaterial({color:0xcc1133,emissive:0x440011,emissiveIntensity:.5,roughness:.35});
      const paths=[
        [[-1.2,-.3,0],[0,0,0],[1.2,.3,0]],
        [[-1.2,.3,0],[0,0,0],[.8,-.5,0]],
        [[-.8,-.6,0],[0,0,0],[1.2,-.2,0]],
      ];
      paths.forEach(pts=>{
        const curve=new THREE.CatmullRomCurve3(pts.map(p=>new THREE.Vector3(...p)));
        const tube=new THREE.Mesh(new THREE.TubeGeometry(curve,30,.07,10,false),mat);
        g.add(tube);
      });
      // Intercalated discs
      [-0.6,0,.6].forEach(x=>{
        const disc=new THREE.Mesh(new THREE.CylinderGeometry(.1,.1,.015,12),
          new THREE.MeshBasicMaterial({color:0x00f0ff,transparent:true,opacity:.6}));
        disc.rotation.z=Math.PI/2; disc.position.set(x,0,0); g.add(disc);
      });
      // Pulsing glow
      const glow=new THREE.Mesh(new THREE.SphereGeometry(.4,12,8),
        new THREE.MeshBasicMaterial({color:0xff2070,transparent:true,opacity:.08,side:THREE.BackSide}));
      g.add(glow);
      return g;
    }, cam:[0,0,3.2], rot:.01, pulseGlow:true},
  ];

  configs.forEach(({id,build,cam,rot,pulseGlow})=>{
    const container=document.getElementById(id);
    if(!container)return;
    const {renderer,scene,camera}=makeScene(container,{fov:42,cam});
    const mesh=build();
    scene.add(mesh);
    let t=0;
    function loop(){
      requestAnimationFrame(loop);
      t+=.016; mesh.rotation.y+=rot; mesh.rotation.x=Math.sin(t*.5)*.06;
      if(pulseGlow){const g=mesh.children[mesh.children.length-1];if(g&&g.material)g.material.opacity=.05+Math.sin(t*2)*.05;}
      renderer.render(scene,camera);
    }
    loop();
  });
  // Reveal cards
  setTimeout(()=>document.getElementById('tc1').classList.add('show'),200);
  setTimeout(()=>document.getElementById('tc2').classList.add('show'),450);
  setTimeout(()=>document.getElementById('tc3').classList.add('show'),700);
  scenes[2]=true;
}

function initSlide4() {
  if(scenes[3])return;
  const container=document.createElement('div');
  container.style.cssText='position:absolute;right:0;top:0;width:52%;height:100%;z-index:5;pointer-events:none;';
  document.getElementById('s4').appendChild(container);

  const {renderer,scene,camera}=makeScene(container,{fov:42,cam:[0,0,6]});

  // Nested zoom-in rings representing each level
  const levels=['MUSCLE','FASCICLE','FIBER','MYOFIBRIL','SARCOMERE'];
  const colors=[0x00f0ff,0x0088ff,0x4400ff,0xff2070,0xff8800];
  const meshes=[];
  levels.forEach((lab,i)=>{
    const r=2.4-i*.42;
    const ring=new THREE.Mesh(
      new THREE.TorusGeometry(r,.025+i*.008,8,80),
      new THREE.MeshBasicMaterial({color:colors[i],transparent:true,opacity:.25+i*.08})
    );
    ring.userData={r,i,label:lab};
    scene.add(ring); meshes.push(ring);

    // Label sprite-like mesh (fake text with thin box)
    const labelMesh=new THREE.Mesh(
      new THREE.BoxGeometry(.6,.06,.01),
      new THREE.MeshBasicMaterial({color:colors[i],transparent:true,opacity:.5})
    );
    labelMesh.position.set(r+.1,.1,0); scene.add(labelMesh);

    // Inner filled disc
    const disc=new THREE.Mesh(
      new THREE.CircleGeometry(r,.64),
      new THREE.MeshBasicMaterial({color:colors[i],transparent:true,opacity:.015+i*.005,side:THREE.DoubleSide})
    );
    scene.add(disc);
  });

  // Central sarcomere geometry
  const core=buildSarcomere(scene);
  core.scale.setScalar(.5);
  scene.add(core);

  let t=0;
  function loop(){
    requestAnimationFrame(loop);
    t+=.01;
    meshes.forEach((m,i)=>{m.rotation.z=t*(.12+i*.04)*(i%2===0?1:-1);m.rotation.x=Math.sin(t*.4+i)*.15;});
    core.rotation.y=t*.3; core.rotation.x=Math.sin(t*.2)*.1;
    renderer.render(scene,camera);
  }
  loop();

  // Reveal chain list
  const rows=document.querySelectorAll('#chain-list .chain-row');
  rows.forEach((r,i)=>setTimeout(()=>r.classList.add('show'),300+i*200));
  scenes[3]=true;
}

function initSlide5() {
  if(scenes[4])return;
  const canvas=document.getElementById('sarcomereCanvas');
  const {renderer,scene,camera}=makeScene(canvas.parentElement,{fov:38,cam:[0,0,5]});
  canvas.parentElement.removeChild(canvas); // let Three.js own this container

  const sarc=buildSarcomere(scene);
  scene.add(sarc);

  let t=0,contracting=true;
  function loop(){
    requestAnimationFrame(loop);
    t+=.02;
    // Animate contraction — scale Z-lines in/out
    const squeeze=Math.sin(t*.8)*.15;
    sarc.children.forEach((c,i)=>{
      if(i<2){c.position.x=(i===0?-1.4:1.4)*(1-Math.abs(squeeze));}
      if(i>1&&i<9){c.scale.x=1+Math.sin(t*.8+i)*.05;} // myosin breathe
    });
    sarc.rotation.y=Math.sin(t*.2)*.3;
    sarc.rotation.x=.2;
    renderer.render(scene,camera);
  }
  loop();
  setTimeout(()=>document.getElementById('fb1').classList.add('show'),300);
  setTimeout(()=>document.getElementById('fb2').classList.add('show'),700);
  setTimeout(()=>document.getElementById('fb3').classList.add('show'),1100);
  scenes[4]=true;
}

function initSlide6() {
  if(scenes[5])return;
  const container=document.createElement('div');
  container.style.cssText='position:absolute;right:2%;top:50%;transform:translateY(-50%);width:48%;height:76%;z-index:5;pointer-events:none;';
  document.getElementById('s6').appendChild(container);

  const {renderer,scene,camera}=makeScene(container,{fov:32,cam:[0.4,0.08,6.8]});

  const displayGroup = new THREE.Group();
  displayGroup.position.set(0.42, 0.05, 0);
  scene.add(displayGroup);

  const backdrop = new THREE.Mesh(
    new THREE.PlaneGeometry(7.4, 5.4),
    new THREE.MeshBasicMaterial({ color: 0x06111e, transparent: true, opacity: 0.24 })
  );
  backdrop.position.set(0.22, 0, -1.35);
  scene.add(backdrop);

  const cyanGlow = new THREE.Mesh(
    new THREE.CircleGeometry(1.55, 48),
    new THREE.MeshBasicMaterial({ color: 0x42efff, transparent: true, opacity: 0.1 })
  );
  cyanGlow.position.set(0.78, 0.18, -0.9);
  scene.add(cyanGlow);

  const magentaGlow = new THREE.Mesh(
    new THREE.CircleGeometry(1.28, 48),
    new THREE.MeshBasicMaterial({ color: 0xff3a98, transparent: true, opacity: 0.08 })
  );
  magentaGlow.position.set(-0.05, -0.3, -0.82);
  scene.add(magentaGlow);

  const orbitRing = new THREE.Mesh(
    new THREE.TorusGeometry(1.72, 0.016, 8, 80),
    new THREE.MeshBasicMaterial({ color: 0x54eaff, transparent: true, opacity: 0.16 })
  );
  orbitRing.rotation.x = Math.PI * 0.52;
  orbitRing.rotation.y = 0.28;
  orbitRing.position.set(0.46, -0.04, -0.38);
  scene.add(orbitRing);

  let showing='healthy';
  const healthy=buildFiber(false);
  const sick=buildFiber(true);
  healthy.scale.setScalar(0.9);
  sick.scale.setScalar(0.9);
  healthy.visible=true;
  sick.visible=false;
  displayGroup.add(healthy);
  displayGroup.add(sick);

  // Swap timer
  let t=0, swap=0;
  function loop(){
    requestAnimationFrame(loop);
    t+=.015; swap+=.015;
    if(swap>6){swap=0;showing=showing==='healthy'?'sick':'healthy';healthy.visible=showing==='healthy';sick.visible=showing==='sick';}
    const active=showing==='healthy'?healthy:sick;
    displayGroup.rotation.y = 0.78 + t * 0.22;
    displayGroup.rotation.x = -0.22 + Math.sin(t * 0.35) * 0.03;
    displayGroup.rotation.z = 0.06 + Math.sin(t * 0.22) * 0.018;
    active.rotation.y = Math.sin(t * 0.7) * 0.025;
    active.rotation.x = Math.sin(t * 0.45) * 0.015;
    orbitRing.rotation.z += 0.0025;
    cyanGlow.material.opacity = 0.08 + Math.sin(t * 0.8) * 0.02;
    magentaGlow.material.opacity = 0.06 + Math.sin(t * 0.9 + 1.4) * 0.018;
    renderer.render(scene,camera);
  }
  loop();
  setTimeout(()=>document.getElementById('cb1').classList.add('show'),300);
  setTimeout(()=>document.getElementById('cb2').classList.add('show'),600);
  scenes[5]=true;
}

function initSlide7() {
  if(scenes[6])return;
  const container=document.createElement('div');
  container.style.cssText='position:absolute;left:36%;top:50%;transform:translateY(-50%);width:30%;height:78%;z-index:5;pointer-events:none;';
  document.getElementById('s7').appendChild(container);

  const {renderer,scene,camera}=makeScene(container,{fov:44,cam:[0,0,5]});
  const scaffold=buildScaffold();
  scene.add(scaffold);

  let t=0;
  function loop(){
    requestAnimationFrame(loop);
    t+=.012;
    scaffold.rotation.y=t*.25; scaffold.rotation.x=Math.sin(t*.3)*.1;
    // Animate cells pulsing
    scaffold.children.forEach((c,i)=>{
      if(c.geometry instanceof THREE.SphereGeometry&&c.geometry.parameters.radius<.15){
        const s=1+Math.sin(t*2+i)*.12; c.scale.setScalar(s);
      }
    });
    renderer.render(scene,camera);
  }
  loop();
  setTimeout(()=>document.getElementById('sr1').classList.add('show'),300);
  setTimeout(()=>document.getElementById('sr2').classList.add('show'),600);
  setTimeout(()=>document.getElementById('sr3').classList.add('show'),900);
  setTimeout(()=>document.getElementById('sr4').classList.add('show'),1200);
  scenes[6]=true;
}

function initSlide8() {
  if(scenes[7])return;
  const builds=[
    {wrap:'sma-wrap',build:buildSMA,cam:[0,0,3.5],rot:[.005,.01,0]},
    {wrap:'eap-wrap',build:buildEAP,cam:[0,0,4],rot:[.003,.008,0]},
    {wrap:'cnt-wrap',build:buildCNT,cam:[0,0,4.2],rot:[.008,.006,0]},
  ];
  builds.forEach(({wrap,build,cam,rot})=>{
    const container=document.getElementById(wrap);
    if(!container)return;
    const {renderer,scene,camera}=makeScene(container,{fov:42,cam});
    const mesh=build();
    scene.add(mesh);
    let t=0;
    function loop(){
      requestAnimationFrame(loop);
      t+=.016; mesh.rotation.x+=rot[0]; mesh.rotation.y+=rot[1];
      // EAP wave deformation
      if(mesh.userData&&mesh.children){
        mesh.children.forEach(c=>{
          if(c.userData&&c.userData.isEAP){
            const pos=c.geometry.attributes.position;
            const base=c.userData.basePositions;
            if(base){for(let i=0;i<pos.count;i++){pos.array[i*3+2]=base[i*3+2]+Math.sin(base[i*3]*2+t*2)*.15+Math.sin(base[i*3+1]*3+t*1.5)*.1;}}
            pos.needsUpdate=true; c.geometry.computeVertexNormals();
          }
        });
      }
      renderer.render(scene,camera);
    }
    loop();
  });
  setTimeout(()=>document.getElementById('am1').classList.add('show'),200);
  setTimeout(()=>document.getElementById('am2').classList.add('show'),500);
  setTimeout(()=>document.getElementById('am3').classList.add('show'),800);
  scenes[7]=true;
}

function initSlide9() {
  if(scenes[8])return;
  [
    {
      wrap:'pros-wrap',
      path:'arm1.glb',
      fallback:buildProsthetic,
      cam:[0.18,-0.1,5.35],
      model:{
        height:2.45,
        position:[0.08,-0.22,0],
        rotation:[-0.04,-0.92,0]
      }
    },
    {
      wrap:'exo-wrap',
      path:'arm2.glb',
      fallback:buildScaffold,
      cam:[0.15,-0.06,5.35],
      model:{
        height:2.45,
        position:[0.05,-0.16,0],
        rotation:[-0.05,-0.98,0]
      }
    }
  ].forEach(({wrap,path,fallback,cam,model})=>{
    const container=document.getElementById(wrap);
    if(!container)return;
    const {renderer,scene,camera}=makeScene(container,{fov:44,cam});
    let mesh=null;

    const useFallback=()=>{
      if(mesh)return;
      mesh=fallback();
      scene.add(mesh);
    };

    loadGLB(
      scene,
      path,
      glbModel => {
        mesh=createAnatomyModelRoot(glbModel, model);
        scene.add(mesh);
      },
      useFallback
    );

    let t=0;
    function loop(){
      requestAnimationFrame(loop);
      t+=.015;
      if(mesh){
        mesh.rotation.y = model.rotation[1] + Math.sin(t * 0.42) * 0.02;
        mesh.rotation.x = (model.rotation[0] || 0) + Math.sin(t * 0.3) * 0.014;
        mesh.position.y = model.position[1] + Math.sin(t * 0.7) * 0.035;
        mesh.position.x = model.position[0] + Math.sin(t * 0.55) * 0.05;
      }
      renderer.render(scene,camera);
    }
    loop();
  });
  setTimeout(()=>document.getElementById('ac1').classList.add('show'),300);
  setTimeout(()=>document.getElementById('ac2').classList.add('show'),700);
  scenes[8]=true;
}

function initSlide10() {
  if(scenes[9])return;
  const container=document.createElement('div');
  container.style.cssText='position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:28%;height:88%;z-index:5;pointer-events:none;';
  document.getElementById('s10').appendChild(container);

  const {renderer,scene,camera}=makeScene(container,{fov:40,cam:[0,.5,8]});
  let body = null;
  const useFallbackBody = () => {
    if (body) return;
    body = buildProceduralBody(scene);
    scene.add(body);
  };

  loadGLB(
    scene,
    'human+anatomy+3d+model.glb',
    model => {
      body = createAnatomyModelRoot(model, {
        height: 5.1,
        position: [0, -0.1, 0],
        rotation: [0, 0.45, 0]
      });
      scene.add(body);
    },
    useFallbackBody
  );

  // Orbiting data rings
  const orbitMat=new THREE.MeshBasicMaterial({color:0x8800ff,transparent:true,opacity:.2});
  const orbits=[];
  for(let i=0;i<3;i++){
    const orb=new THREE.Mesh(new THREE.TorusGeometry(2.5+i*.5,.01,6,60),orbitMat.clone());
    orb.rotation.x=(Math.random()-.5)*Math.PI; orb.rotation.z=(Math.random()-.5)*Math.PI;
    scene.add(orb); orbits.push(orb);
  }

  let t=0;
  function loop(){
    requestAnimationFrame(loop);
    t+=.01;
    if (body) {
      body.rotation.y = 0.45 + t * 0.3;
      body.rotation.x = Math.sin(t * 0.18) * 0.025;
    }
    orbits.forEach((o,i)=>{o.rotation.y=t*(.3+i*.1);o.rotation.x+=.005;});
    renderer.render(scene,camera);
  }
  loop();
  setTimeout(()=>document.getElementById('sum1').classList.add('show'),300);
  setTimeout(()=>document.getElementById('sum2').classList.add('show'),600);
  setTimeout(()=>document.getElementById('sum3').classList.add('show'),900);
  setTimeout(()=>document.getElementById('sum4').classList.add('show'),1200);
  scenes[9]=true;
}

function initSlide11() {
  if(scenes[10])return;
  const container=document.createElement('div');
  container.style.cssText='position:absolute;inset:0;z-index:3;pointer-events:none;';
  document.getElementById('s11').appendChild(container);

  const {renderer,scene,camera}=makeScene(container,{fov:60,cam:[0,0,8]});

  // Wave ribbons
  const ribbonMats=[0x00f0ff,0x8800ff,0xff2070].map(c=>new THREE.MeshBasicMaterial({color:c,transparent:true,opacity:.2,side:THREE.DoubleSide}));
  const ribbons=[];
  ribbonMats.forEach((mat,ri)=>{
    const geo=new THREE.PlaneGeometry(30,1.5,80,1);
    const mesh=new THREE.Mesh(geo,mat);
    mesh.position.z=-3+ri*.3; mesh.userData={ri,basePos:geo.attributes.position.array.slice()};
    scene.add(mesh); ribbons.push(mesh);
  });

  // Flying particles
  const pGeo=new THREE.BufferGeometry();
  const pN=500,pPos=new Float32Array(pN*3);
  for(let i=0;i<pN;i++){pPos[i*3]=(Math.random()-.5)*30;pPos[i*3+1]=(Math.random()-.5)*18;pPos[i*3+2]=(Math.random()-.5)*10;}
  pGeo.setAttribute('position',new THREE.BufferAttribute(pPos,3));
  scene.add(new THREE.Points(pGeo,new THREE.PointsMaterial({color:0x00f0ff,size:.05,transparent:true,opacity:.4})));

  // Thank you — reveal
  setTimeout(()=>{document.getElementById('thanksH1').classList.add('show');document.getElementById('thanksUrl').classList.add('show');},400);

  let t=0;
  function loop(){
    requestAnimationFrame(loop);
    t+=.008;
    ribbons.forEach(({geometry,userData:{ri,basePos}})=>{
      const pos=geometry.attributes.position;
      for(let i=0;i<pos.count;i++){
        const x=basePos[i*3];
        pos.array[i*3+1]=basePos[i*3+1]+Math.sin(x*.3+t*(1+ri*.3))*.8+Math.sin(x*.15-t*.5+ri)*.5;
      }
      pos.needsUpdate=true;
    });
    renderer.render(scene,camera);
  }
  loop();
  scenes[10]=true;
}

// ═══════════════════════════════════════════════════════
// SLIDE ENGINE
// ═══════════════════════════════════════════════════════
const slideInits=[initSlide1,initSlide2,initSlide3,initSlide4,initSlide5,initSlide6,initSlide7,initSlide8,initSlide9,initSlide10,initSlide11];
const slideEls=document.querySelectorAll('.slide');

function goTo(idx) {
  if(isTransitioning||idx<0||idx>=TOTAL)return;
  isTransitioning=true;

  const body=document.body;
  body.classList.add('transitioning');

  setTimeout(()=>{
    slideEls[currentSlide].classList.remove('active');
    currentSlide=idx;
    slideEls[currentSlide].classList.add('active');
    document.getElementById('counter').textContent=String(idx+1).padStart(2,'0')+' / '+String(TOTAL).padStart(2,'0');
    document.getElementById('progress').style.width=((idx+1)/TOTAL*100)+'%';
    if(idx>0)document.getElementById('tap-hint').style.opacity='0';

    body.classList.remove('transitioning');
    body.classList.add('transitioning-out');
    setTimeout(()=>{body.classList.remove('transitioning-out'); isTransitioning=false;},500);

    // Init this slide's 3D scenes
    if(slideInits[idx]) slideInits[idx]();
  },320);
}

// ═══════════════════════════════════════════════════════
// INPUT
// ═══════════════════════════════════════════════════════
function goNext() {
  goTo((currentSlide + 1) % TOTAL);
}

function goPrev() {
  if (currentSlide > 0) goTo(currentSlide - 1);
}

document.addEventListener('click', e => {
  const rightSide = e.clientX >= window.innerWidth / 2;
  if (rightSide) goNext();
  else goPrev();
});
document.addEventListener('keydown',e=>{
  if(['ArrowRight',' ','Enter'].includes(e.key)){e.preventDefault();goNext();}
  if(e.key==='ArrowLeft') goPrev();
});
let tX=0;
document.addEventListener('touchstart',e=>{tX=e.touches[0].clientX},{passive:true});
document.addEventListener('touchend',e=>{
  const dx=e.changedTouches[0].clientX-tX;
  if(dx<-50)goNext();
  if(dx>50)goPrev();
});

const navLeft = document.getElementById('nav-left');
const navRight = document.getElementById('nav-right');
if (navLeft) {
  navLeft.addEventListener('click', e => {
    e.stopPropagation();
    goPrev();
  });
}
if (navRight) {
  navRight.addEventListener('click', e => {
    e.stopPropagation();
    goNext();
  });
}

// ═══════════════════════════════════════════════════════
// BOOT
// ═══════════════════════════════════════════════════════
window.addEventListener('load',()=>{
  initBackground();
  initSlide1(); // pre-init first slide
});
