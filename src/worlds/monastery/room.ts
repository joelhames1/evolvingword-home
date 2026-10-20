// The cell: thick walls of the pale pink Assisi stone, a terracotta floor, chestnut
// beams overhead, two plain round arches open onto the garden and the valley, and
// high in the back wall a small round window of colored glass with the afternoon
// sun coming through it. Candles on the walls, a wooden Tau by the window.
import * as THREE from 'three';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import { ROOM } from '../../layout';
import { canvas, glow, rng, texture, wood } from '../../textures';
import { outdoor, type DaylightUniforms } from '../outdoor';

/** The cell is taller than the other rooms: the round window sits above the bookshelf. */
export const H = 3.9;
/** How thick the walls are. */
export const T = 0.5;
/** The two arches in the window wall: sill, the top of the round, and the pier between them. */
export const ARCH = { sill: 0.85, top: 2.55, x0: -1.85, x1: 1.85, pier: 0.22 };
/** The round window in the back wall. */
export const OCULUS = { x: 0.35, y: 3.05, r: 0.45 };
/** Toward the sun: high behind the house, a little to the right. Its light comes through the round window onto the floor by the desk. */
export const SUN = new THREE.Vector3(0.7, 3.05, 3.55).normalize();

export interface Cell {
  group: THREE.Group;
  /** The candles' lights, for their flicker. */
  candles: THREE.PointLight[];
  tick(t: number): void;
}

/** Ashlar of the pink Subasio stone: courses of squared blocks, each its own shade. */
export function stone(seed: number) {
  const [c, g] = canvas(1024, 1024);
  const r = rng(seed);
  const palette = ['#e6cbbb', '#dcb9a6', '#efdccc', '#d6b2a0', '#e9d3c2', '#cfa996', '#f1e4d6', '#e0c0ad'];
  g.fillStyle = '#c9b8a8';
  g.fillRect(0, 0, 1024, 1024);
  let y = 0;
  while (y < 1024) {
    const ch = 90 + Math.floor(r() * 70);
    let x = -Math.floor(r() * 200);
    while (x < 1024) {
      const cw = 150 + Math.floor(r() * 220);
      const col = palette[Math.floor(r() * palette.length)];
      g.fillStyle = col;
      g.fillRect(x + 4, y + 4, cw - 8, Math.min(ch, 1024 - y) - 8);
      // Each block: worn edges, a little speckle, a darker vein or two.
      const grad = g.createLinearGradient(0, y, 0, y + ch);
      grad.addColorStop(0, 'rgba(255,250,240,0.12)');
      grad.addColorStop(1, 'rgba(80,50,30,0.12)');
      g.fillStyle = grad;
      g.fillRect(x + 4, y + 4, cw - 8, ch - 8);
      for (let k = 0; k < cw * ch * 0.004; k++) {
        g.fillStyle = `rgba(${r() < 0.5 ? '255,245,235' : '110,70,50'},${r() * 0.12})`;
        g.fillRect(x + 4 + r() * (cw - 8), y + 4 + r() * (ch - 8), 2 + r() * 3, 2 + r() * 3);
      }
      if (r() < 0.4) {
        g.strokeStyle = 'rgba(150,90,70,0.18)';
        g.lineWidth = 1.5;
        g.beginPath();
        g.moveTo(x + r() * cw, y + 4);
        g.quadraticCurveTo(x + r() * cw, y + ch / 2, x + r() * cw, y + ch - 4);
        g.stroke();
      }
      // Each wraps round, so the texture tiles.
      if (x + cw > 1024) {
        g.drawImage(c, 1024, y, x + cw - 1024, ch, 0, y, x + cw - 1024, ch);
      }
      x += cw;
    }
    y += ch;
  }
  return texture(c);
}

/** Cotto: square terracotta tiles, every one a slightly different fire. */
function cotto() {
  const [c, g] = canvas(1024, 1024);
  const r = rng(71);
  g.fillStyle = '#8a6250';
  g.fillRect(0, 0, 1024, 1024);
  const n = 8;
  const s = 1024 / n;
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++) {
      const base = new THREE.Color(['#b5603d', '#a8553a', '#c06b45', '#9e4f34', '#b8694a', '#c47a52'][Math.floor(r() * 6)]);
      g.fillStyle = `#${base.getHexString()}`;
      g.fillRect(i * s + 3, j * s + 3, s - 6, s - 6);
      // Worn paler toward the middle of the room, waxed dark at the edges.
      const grad = g.createRadialGradient(i * s + s / 2, j * s + s / 2, 4, i * s + s / 2, j * s + s / 2, s * 0.75);
      grad.addColorStop(0, 'rgba(255,220,190,0.08)');
      grad.addColorStop(1, 'rgba(60,20,10,0.18)');
      g.fillStyle = grad;
      g.fillRect(i * s + 3, j * s + 3, s - 6, s - 6);
      for (let k = 0; k < 120; k++) {
        g.fillStyle = `rgba(${r() < 0.5 ? '255,220,190' : '70,25,10'},${r() * 0.14})`;
        g.fillRect(i * s + 3 + r() * (s - 6), j * s + 3 + r() * (s - 6), 2, 2);
      }
    }
  return texture(c);
}

/** The glass in the round window: the sun in the middle, a ring of petals in sky and leaf colors, a band of amber. Plain shapes, lead between them. */
export function rose() {
  const [c, g] = canvas(512, 512);
  const cx = 256;
  g.fillStyle = '#2a2420';
  g.fillRect(0, 0, 512, 512);
  const lead = 7;
  const ring = (r0: number, r1: number, n: number, colors: string[], offset = 0) => {
    for (let k = 0; k < n; k++) {
      const a0 = ((k + offset) / n) * Math.PI * 2;
      const a1 = ((k + 1 + offset) / n) * Math.PI * 2;
      g.fillStyle = colors[k % colors.length];
      g.beginPath();
      g.arc(cx, cx, r1 - lead / 2, a0 + 0.012, a1 - 0.012);
      g.arc(cx, cx, r0 + lead / 2, a1 - 0.02, a0 + 0.02, true);
      g.closePath();
      g.fill();
    }
  };
  ring(196, 252, 16, ['#e3a85c', '#efe3c4', '#d98f4a', '#efe3c4']);
  // The petals: pointed ovals between the sun and the outer band.
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * Math.PI * 2;
    g.save();
    g.translate(cx + Math.cos(a) * 140, cx + Math.sin(a) * 140);
    g.rotate(a);
    g.fillStyle = k % 2 ? '#8fb6dc' : '#a6c98c';
    g.beginPath();
    g.moveTo(-50, 0);
    g.quadraticCurveTo(0, -30, 50, 0);
    g.quadraticCurveTo(0, 30, -50, 0);
    g.fill();
    g.restore();
  }
  // Clear-ish glass between the petals.
  g.globalCompositeOperation = 'destination-over';
  g.fillStyle = '#d9dcc8';
  g.beginPath();
  g.arc(cx, cx, 192, 0, Math.PI * 2);
  g.fill();
  g.globalCompositeOperation = 'source-over';
  // Brother Sun.
  g.fillStyle = '#f6c552';
  g.beginPath();
  g.arc(cx, cx, 56, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = '#2a2420';
  g.lineWidth = lead;
  g.beginPath();
  g.arc(cx, cx, 56, 0, Math.PI * 2);
  g.stroke();
  g.beginPath();
  g.arc(cx, cx, 192, 0, Math.PI * 2);
  g.stroke();
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * Math.PI * 2 + Math.PI / 12;
    g.beginPath();
    g.moveTo(cx + Math.cos(a) * 56, cx + Math.sin(a) * 56);
    g.lineTo(cx + Math.cos(a) * 192, cx + Math.sin(a) * 192);
    g.stroke();
  }
  // Round the edge, the stone.
  g.globalCompositeOperation = 'destination-in';
  g.beginPath();
  g.arc(cx, cx, 254, 0, Math.PI * 2);
  g.fill();
  g.globalCompositeOperation = 'source-over';
  return texture(c);
}

/** A wall: a rectangle of stone with holes cut in it, given thickness. UVs are in meters. */
function wall(w0: number, w1: number, h: number, holes: THREE.Path[]) {
  const shape = new THREE.Shape([new THREE.Vector2(w0, 0), new THREE.Vector2(w1, 0), new THREE.Vector2(w1, h), new THREE.Vector2(w0, h)]);
  shape.holes.push(...holes);
  return new THREE.ExtrudeGeometry(shape, { depth: T, bevelEnabled: false, curveSegments: 24 });
}

/** A round-headed opening from the sill up. */
function archPath(x0: number, x1: number, sill: number, top: number) {
  const r = (x1 - x0) / 2;
  const spring = top - r;
  const p = new THREE.Path();
  p.moveTo(x0, sill);
  p.lineTo(x1, sill);
  p.lineTo(x1, spring);
  p.absarc((x0 + x1) / 2, spring, r, 0, Math.PI, false);
  p.lineTo(x0, sill);
  return p;
}

const SHAFT_VERT = /* glsl */ `
  varying vec3 vNrm;
  varying vec3 vWorld;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    vec4 w = modelMatrix * vec4(position, 1.0);
    vWorld = w.xyz;
    vNrm = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;
// A shaft of sun through the round window: brightest through its middle, fading
// toward the floor, with dust turning slowly in it.
const SHAFT_FRAG = /* glsl */ `
  uniform float uTime;
  varying vec3 vNrm;
  varying vec3 vWorld;
  varying vec2 vUv;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5); }
  void main() {
    vec3 v = normalize(cameraPosition - vWorld);
    float core = pow(abs(dot(normalize(vNrm), v)), 1.5);
    float along = smoothstep(0.0, 0.15, vUv.y) * smoothstep(1.0, 0.55, vUv.y);
    vec2 g = vec2(vUv.x * 60.0, vUv.y * 40.0 + uTime * 0.25);
    float dust = step(0.985, hash(floor(g))) * smoothstep(0.4, 0.0, length(fract(g) - 0.5));
    float a = core * along * (0.022 + dust * 0.5);
    gl_FragColor = vec4(vec3(1.0, 0.88, 0.62) * a, 1.0);
  }
`;

export function buildCell(daylight: DaylightUniforms): Cell {
  RectAreaLightUniformsLib.init();
  const group = new THREE.Group();
  const { x0, x1, z0, z1 } = ROOM;

  const stoneTex = stone(19);
  stoneTex.wrapS = stoneTex.wrapT = THREE.RepeatWrapping;
  stoneTex.repeat.set(0.5, 0.5);
  const stoneMat = new THREE.MeshStandardMaterial({ map: stoneTex, roughness: 0.92 });
  const chestnut = new THREE.MeshStandardMaterial({ map: wood(41, '#5a3a24', '#2e1b0e'), roughness: 0.7 });

  const floorTex = cotto();
  floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping;
  floorTex.repeat.set((x1 - x0) / 2.4, (z1 - z0) / 2.4);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0), new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.75 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, 0, (z0 + z1) / 2);
  floor.receiveShadow = true;
  group.add(floor);

  // The walls. The window wall has the two arches; the back wall, the round window.
  const archA = archPath(ARCH.x0, -ARCH.pier / 2, ARCH.sill, ARCH.top);
  const archB = archPath(ARCH.pier / 2, ARCH.x1, ARCH.sill, ARCH.top);
  const front = new THREE.Mesh(wall(x0 - T, x1 + T, H, [archA, archB]), stoneMat);
  front.position.z = z0 - T;
  front.receiveShadow = true;
  front.castShadow = true;
  group.add(front);
  const ocPath = new THREE.Path();
  ocPath.absarc(OCULUS.x, OCULUS.y, OCULUS.r, 0, Math.PI * 2, false);
  const back = new THREE.Mesh(wall(x0 - T, x1 + T, H, [ocPath]), stoneMat);
  back.position.z = z1;
  back.receiveShadow = true;
  group.add(back);
  for (const x of [x0, x1 + T]) {
    const side = new THREE.Mesh(wall(z0, z1, H, []), stoneMat);
    side.rotation.y = -Math.PI / 2;
    side.position.x = x;
    side.receiveShadow = true;
    group.add(side);
  }
  // A stone string course round the room at 2.8m; the drying line hangs from it.
  const courseMat = new THREE.MeshStandardMaterial({ color: '#e2cbb9', roughness: 0.85 });
  for (const [w, x, z, ry] of [
    [z1 - z0, x0 + 0.03, (z0 + z1) / 2, Math.PI / 2],
    [z1 - z0, x1 - 0.03, (z0 + z1) / 2, Math.PI / 2],
    [x1 - x0, 0, z1 - 0.03, 0],
  ] as const) {
    const course = new THREE.Mesh(new THREE.BoxGeometry(w, 0.09, 0.06), courseMat);
    course.position.set(x, 2.83, z);
    course.rotation.y = ry;
    course.castShadow = true;
    group.add(course);
  }

  // The ceiling: chestnut beams across the room, planks over them.
  const plankTex = wood(43, '#6b4a30', '#3a2414');
  plankTex.wrapS = plankTex.wrapT = THREE.RepeatWrapping;
  plankTex.repeat.set(2, 5);
  const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0), new THREE.MeshStandardMaterial({ map: plankTex, color: '#a08070', roughness: 0.85 }));
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.set(0, H, (z0 + z1) / 2);
  group.add(ceiling);
  for (let z = z0 + 0.45; z < z1; z += 1.05) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, 0.24, 0.2), chestnut);
    b.position.set(0, H - 0.12, z);
    b.castShadow = true;
    group.add(b);
  }

  // The round window: its glass, a molding round it, and the sun coming through.
  const glassTex = rose();
  const glassIn = new THREE.Mesh(new THREE.CircleGeometry(OCULUS.r, 64), new THREE.MeshBasicMaterial({ map: glassTex, color: new THREE.Color(1.7, 1.6, 1.45) }));
  glassIn.position.set(OCULUS.x, OCULUS.y, z1 + T * 0.5);
  glassIn.rotation.y = Math.PI;
  group.add(glassIn);
  const glassOut = new THREE.Mesh(new THREE.CircleGeometry(OCULUS.r, 64), outdoor(daylight, { map: glassTex, color: '#7d8590' }));
  glassOut.position.set(OCULUS.x, OCULUS.y, z1 + T * 0.5 + 0.01);
  group.add(glassOut);
  const molding = new THREE.Mesh(new THREE.TorusGeometry(OCULUS.r + 0.05, 0.045, 10, 64), courseMat);
  molding.position.set(OCULUS.x, OCULUS.y, z1 - 0.01);
  group.add(molding);
  const ocAt = new THREE.Vector3(OCULUS.x, OCULUS.y, z1 + T * 0.5);
  const sunbeam = new THREE.SpotLight('#ffe7c4', 16, 16, Math.atan(OCULUS.r / 6) * 1.12, 0.3, 1);
  sunbeam.position.copy(ocAt).addScaledVector(SUN, 6);
  sunbeam.target.position.copy(ocAt).addScaledVector(SUN, -4);
  sunbeam.map = glassTex;
  group.add(sunbeam, sunbeam.target);
  // The beam itself, faintly, with dust in it.
  const shaftLen = 4.6;
  const shaftMat = new THREE.ShaderMaterial({
    vertexShader: SHAFT_VERT,
    fragmentShader: SHAFT_FRAG,
    uniforms: { uTime: { value: 0 } },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
  const shaftGeo = new THREE.CylinderGeometry(OCULUS.r * 0.95, OCULUS.r * 1.15, shaftLen, 32, 1, true);
  shaftGeo.translate(0, -shaftLen / 2, 0);
  const shaft = new THREE.Mesh(shaftGeo, shaftMat);
  shaft.position.copy(ocAt);
  shaft.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), SUN);
  group.add(shaft);

  // Light from the garden through the arches, and the room's own glow.
  for (const [a, b] of [
    [ARCH.x0, -ARCH.pier / 2],
    [ARCH.pier / 2, ARCH.x1],
  ]) {
    const w = b - a;
    const fill = new THREE.RectAreaLight('#f4e5d0', 1.5, w, ARCH.top - ARCH.sill);
    fill.position.set((a + b) / 2, (ARCH.sill + ARCH.top) / 2, z0 - 0.2);
    fill.lookAt((a + b) / 2, (ARCH.sill + ARCH.top) / 2, 1);
    group.add(fill);
  }
  group.add(new THREE.HemisphereLight('#dfe6f2', '#6b4a36', 0.22));
  // A little of the garden's daylight across the desk, for its shadows.
  const day = new THREE.SpotLight('#fff1dc', 12, 14, 0.5, 0.7, 1.2);
  day.position.set(-1.2, 4.5, -7);
  day.target.position.set(0.1, 0.76, -1.0);
  day.castShadow = true;
  day.shadow.mapSize.set(1024, 1024);
  day.shadow.bias = -0.0005;
  day.shadow.normalBias = 0.03;
  day.shadow.camera.near = 3;
  day.shadow.camera.far = 14;
  group.add(day, day.target);

  // Candles in iron sconces on the side walls and by the bookshelf.
  const iron = new THREE.MeshStandardMaterial({ color: '#2a2724', roughness: 0.6, metalness: 0.6 });
  const wax = new THREE.MeshStandardMaterial({ color: '#efe4cf', roughness: 0.6, emissive: '#ffb060', emissiveIntensity: 0.15 });
  const flameMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(3.2, 2.0, 0.8) });
  const haloTex = glow('rgba(255,190,110,1)', 64);
  const candles: THREE.PointLight[] = [];
  const flames: THREE.Object3D[] = [];
  for (const [x, z, ry] of [
    [x0 + 0.04, -0.95, Math.PI / 2],
    [x1 - 0.04, 1.2, -Math.PI / 2],
    [1.55, z1 - 0.04, Math.PI],
  ] as const) {
    const s = new THREE.Group();
    const plate = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.16, 0.012), iron);
    s.add(plate);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.014, 0.16), iron);
    arm.position.set(0, -0.05, 0.08);
    s.add(arm);
    const pan = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.035, 0.015, 16), iron);
    pan.position.set(0, -0.04, 0.16);
    s.add(pan);
    const candle = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.02, 0.14, 12), wax);
    candle.position.set(0, 0.04, 0.16);
    s.add(candle);
    const flame = new THREE.Mesh(new THREE.SphereGeometry(0.011, 10, 8), flameMat);
    flame.scale.set(1, 2.1, 1);
    flame.position.set(0, 0.13, 0.16);
    s.add(flame);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex, color: '#ffb066', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    halo.scale.setScalar(0.18);
    halo.position.copy(flame.position);
    s.add(halo);
    flames.push(flame);
    s.position.set(x, 1.85, z);
    s.rotation.y = ry;
    group.add(s);
    s.updateMatrixWorld();
    const light = new THREE.PointLight('#ffad5c', 1.8, 3.8, 1.6);
    light.position.copy(s.localToWorld(new THREE.Vector3(0, 0.16, 0.2)));
    group.add(light);
    candles.push(light);
  }

  // A plain wooden Tau on the pier by the window.
  const tauWood = new THREE.MeshStandardMaterial({ map: wood(47, '#7a5636', '#4a3020'), roughness: 0.7 });
  const tau = new THREE.Group();
  const stem = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.36, 0.025), tauWood);
  stem.position.y = -0.03;
  tau.add(stem);
  const bar = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.05, 0.025), tauWood);
  bar.position.y = 0.15;
  tau.add(bar);
  const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.002, 0.002, 0.16, 6), new THREE.MeshStandardMaterial({ color: '#8a7a60' }));
  cord.position.y = 0.25;
  tau.add(cord);
  tau.position.set(2.12, 1.95, z0 + 0.03);
  tau.traverse((o) => (o.castShadow = true));
  group.add(tau);

  // A plain bench under the diplomas, and a jug and basin on the sill.
  const bench = new THREE.Group();
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.05, 1.3), chestnut);
  seat.position.y = 0.44;
  bench.add(seat);
  for (const z of [-0.55, 0.55]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.42, 0.05), chestnut);
    leg.position.set(0, 0.21, z);
    bench.add(leg);
  }
  bench.position.set(x1 - 0.24, 0, -0.2);
  bench.traverse((o) => {
    o.castShadow = true;
    o.receiveShadow = true;
  });
  group.add(bench);
  const clay = new THREE.MeshStandardMaterial({ color: '#b86a44', roughness: 0.8 });
  const jugProfile = [
    [0, 0],
    [0.05, 0],
    [0.065, 0.04],
    [0.07, 0.1],
    [0.05, 0.17],
    [0.035, 0.2],
    [0.045, 0.23],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  const jug = new THREE.Mesh(new THREE.LatheGeometry(jugProfile, 24), clay);
  jug.position.set(-1.25, ARCH.sill, z0 - 0.28);
  jug.castShadow = true;
  group.add(jug);
  const basinProfile = [
    [0, 0],
    [0.07, 0],
    [0.13, 0.05],
    [0.14, 0.07],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  const basin = new THREE.Mesh(new THREE.LatheGeometry(basinProfile, 28), clay);
  basin.position.set(-0.95, ARCH.sill, z0 - 0.26);
  group.add(basin);
  const water = new THREE.Mesh(new THREE.CircleGeometry(0.125, 24), new THREE.MeshStandardMaterial({ color: '#4d6a78', roughness: 0.05, metalness: 0.3 }));
  water.rotation.x = -Math.PI / 2;
  water.position.set(-0.95, ARCH.sill + 0.055, z0 - 0.26);
  group.add(water);

  // --- outside: the house this room is part of ---------------------------------------
  const outStone = outdoor(daylight, { map: stoneTex, color: '#f4e4d8' });
  // Our back wall's outside face, with the round window.
  const backSkin = new THREE.Mesh(new THREE.ShapeGeometry((() => {
    const s = new THREE.Shape([new THREE.Vector2(x0 - T, 0), new THREE.Vector2(x1 + T, 0), new THREE.Vector2(x1 + T, H), new THREE.Vector2(x0 - T, H)]);
    const hole = new THREE.Path();
    hole.absarc(OCULUS.x, OCULUS.y, OCULUS.r, 0, Math.PI * 2, true);
    s.holes.push(hole);
    return s;
  })(), 32), outStone);
  backSkin.position.z = z1 + T + 0.004;
  group.add(backSkin);
  // The rest of the house: a lower wing on one side, a taller one on the other,
  // each under its own roof, all of it on a plinth a few steps up from the garden.
  const depth = z1 - z0 + 2 * T;
  const base = -1.6;
  const block = (x0b: number, x1b: number, y0: number, y1: number) =>
    new THREE.ExtrudeGeometry(new THREE.Shape([new THREE.Vector2(x0b, y0), new THREE.Vector2(x1b, y0), new THREE.Vector2(x1b, y1), new THREE.Vector2(x0b, y1)]), { depth, bevelEnabled: false });
  const winMat = outdoor(daylight, { color: '#2b2420' });
  const blocks = [
    { a: x0 - T - 6.5, b: x0 - T, top: H + 2.2, wins: [2.1, 4.6] },
    { a: x0 - T, b: x1 + T, top: H, wins: [] as number[] },
    { a: x1 + T, b: x1 + T + 7.5, top: H - 0.7, wins: [2.1] },
  ];
  for (const k of blocks) {
    if (k.wins.length) {
      const wing = new THREE.Mesh(block(k.a, k.b, base, k.top), outStone);
      wing.position.z = z0 - T;
      group.add(wing);
    }
    for (const y of k.wins)
      for (let i = 0; i < 2; i++) {
        const wx = k.a + (k.b - k.a) * (i + 1) / 3;
        for (const [z, ry] of [
          [z0 - T - 0.01, Math.PI],
          [z1 + T + 0.01, 0],
        ] as const) {
          const win = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.85), winMat);
          win.position.set(wx, y, z);
          win.rotation.y = ry;
          group.add(win);
        }
      }
  }
  const plinth = new THREE.Mesh(block(x0 - T, x1 + T, base, 0), outStone);
  plinth.position.z = z0 - T;
  group.add(plinth);
  // Terracotta roofs, the ridges running along the house.
  const [rc, rg] = canvas(512, 512);
  const rr = rng(83);
  rg.fillStyle = '#a4553a';
  rg.fillRect(0, 0, 512, 512);
  for (let x = 0; x < 512; x += 32)
    for (let y = -48; y < 512; y += 48) {
      const col = new THREE.Color(['#b5603d', '#ad5a36', '#bd6a45', '#a8553a', '#b86a3e'][Math.floor(rr() * 5)]);
      rg.fillStyle = `#${col.getHexString()}`;
      rg.fillRect(x + 2, y + ((x / 32) % 2) * 24, 28, 46);
      rg.fillStyle = 'rgba(60,20,10,0.12)';
      rg.fillRect(x, y + ((x / 32) % 2) * 24, 2, 46);
      // Lichen.
      if (rr() < 0.12) {
        rg.fillStyle = 'rgba(190,180,140,0.14)';
        rg.fillRect(x + 4, y + 10 + rr() * 20, 20, 8);
      }
    }
  const roofTex = texture(rc);
  roofTex.wrapS = roofTex.wrapT = THREE.RepeatWrapping;
  const eave = 0.6;
  const zf = z0 - T - eave;
  const zb = z1 + T + eave;
  const zr = (zf + zb) / 2;
  const rise = 1.6;
  outStone.side = THREE.DoubleSide;
  for (const k of blocks) {
    const w = k.b - k.a + 0.5;
    const tx = roofTex.clone();
    tx.repeat.set(w / 2.5, 2);
    tx.needsUpdate = true;
    const roofMat = outdoor(daylight, { map: tx, side: THREE.DoubleSide });
    for (const [za, zb_] of [
      [zf, zr],
      [zb, zr],
    ]) {
      const run = zb_ - za;
      const plane = new THREE.Mesh(new THREE.PlaneGeometry(w, Math.hypot(run, rise)), roofMat);
      plane.position.set((k.a + k.b) / 2, k.top + 0.25 + rise / 2, (za + zb_) / 2);
      // Tipped so its far edge rises from the eave up to the ridge.
      plane.rotation.x = Math.atan2(run, rise);
      group.add(plane);
    }
    // The gable ends.
    const gable = new THREE.Shape([new THREE.Vector2(zf + eave, 0), new THREE.Vector2(zb - eave, 0), new THREE.Vector2(zr, rise + 0.25)]);
    for (const x of [k.a, k.b]) {
      const gm = new THREE.Mesh(new THREE.ShapeGeometry(gable), outStone);
      gm.rotation.y = -Math.PI / 2;
      gm.position.set(x, k.top, 0);
      group.add(gm);
    }
  }

  return {
    group,
    candles,
    tick(t) {
      shaftMat.uniforms.uTime.value = t;
      candles.forEach((c, i) => {
        const f = 0.82 + 0.1 * Math.sin(t * 9.3 + i * 2.1) + 0.08 * Math.sin(t * 23.7 + i) * Math.sin(t * 1.3 + i * 4);
        c.intensity = 1.8 * f;
        flames[i].scale.y = 2.1 * (0.9 + 0.15 * f);
      });
    },
  };
}
