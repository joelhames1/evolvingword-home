// The city outside the window: wet street five floors down, a block of
// buildings across the road with the evolving billboard, an elevated railway,
// towers to the horizon, rain, searchlights and the odd flying car.
import * as THREE from 'three';
import { ALPHABET, Evolver } from './evolve';
import { STREET_Y } from './room';
import { canvas, glow, rng, texture } from './textures';
import type { Quality } from './world';

export const PHRASES = ['EVOLVING WORD', 'DESIGN TOGETHER', 'PRINT TOGETHER', 'MAKE SOMETHING', 'OUR STUDIO', 'STAY CURIOUS'];

export interface City {
  group: THREE.Group;
  /** Where the billboard is, for camera shots. */
  billboardCenter: THREE.Vector3;
  /** The light the billboard throws, easing between its colors. */
  billboardColor: THREE.Color;
  /** The billboard itself, for clicking on. */
  billboard: THREE.Mesh;
  /** Latest billboard state, for the CRT and anyone curious. */
  evolution(): { text: string; target: string; generation: number; fitness: number; done: boolean; custom: boolean };
  /** Breeds someone's own phrase on the billboard, then goes back to ours. */
  evolve(text: string): void;
  tick(t: number, dt: number, camera: THREE.Camera): void;
}

const BUILDING_VERT = /* glsl */ `
  attribute float aSeed;
  attribute float aNeon;
  varying vec3 vWorld;
  varying vec3 vNormal;
  varying vec3 vLocal;
  varying float vSeed;
  varying float vNeon;
  void main() {
    vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0);
    vWorld = wp.xyz;
    vNormal = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal);
    vLocal = position;
    vSeed = aSeed;
    vNeon = aNeon;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const BUILDING_FRAG = /* glsl */ `
  uniform vec3 uFogColor;
  uniform float uFogDensity;
  uniform float uTime;
  varying vec3 vWorld;
  varying vec3 vNormal;
  varying vec3 vLocal;
  varying float vSeed;
  varying float vNeon;
  float hash(vec2 p) { p = fract(p * vec2(234.34, 435.345)); p += dot(p, p + 34.23); return fract(p.x * p.y); }
  void main() {
    // The seed is a whole number per building; rounding undoes the tiny drift a
    // varying picks up across a face, which the hash would blow up into speckle.
    float seed = floor(vSeed + 0.5);
    vec3 n = abs(vNormal);
    vec3 col = vec3(0.018, 0.02, 0.032);
    if (n.y < 0.5) {
      vec2 p = n.x > 0.5 ? vWorld.zy : vWorld.xy;
      vec2 cell = vec2(1.9, 3.1);
      vec2 q = p / cell;
      vec2 id = floor(q);
      vec2 f = fract(q);
      // Soft window edges sized to the pixel, and a fade to the average glow once
      // a window is smaller than a couple of pixels, so far towers don't shimmer.
      vec2 fw = fwidth(q);
      float far = smoothstep(0.18, 0.5, max(fw.x, fw.y));
      vec2 e = clamp(fw, 0.002, 0.2);
      float win = smoothstep(0.16 - e.x, 0.16 + e.x, f.x) * smoothstep(0.84 + e.x, 0.84 - e.x, f.x)
        * smoothstep(0.22 - e.y, 0.22 + e.y, f.y) * smoothstep(0.78 + e.y, 0.78 - e.y, f.y);
      float h = hash(id + seed * 13.1);
      float lit = step(0.6, h);
      // A few windows change over the night.
      lit = mix(lit, step(0.5, fract(h * 7.0 + floor(uTime * 0.05 + h * 9.0) * 0.37)), step(0.93, hash(id * 3.7 + seed)));
      vec3 warm = vec3(1.0, 0.66, 0.34);
      vec3 cool = vec3(0.45, 0.68, 1.0);
      vec3 pink = vec3(1.0, 0.35, 0.75);
      float pick = hash(id * 1.7 + seed);
      vec3 wcol = pick < 0.62 ? warm : pick < 0.9 ? cool : pink;
      vec3 near = win * lit * wcol * (0.55 + 0.9 * hash(id + 3.3));
      near += win * (1.0 - lit) * vec3(0.012, 0.014, 0.02);
      // Floors read as faint bands.
      near += vec3(0.01, 0.012, 0.02) * step(0.94, f.y);
      // Far away: the lit windows blur into a speckled warm glow.
      vec3 blur = vec3(0.16, 0.11, 0.08) * (0.55 + 0.9 * hash(floor(q * 0.25) + seed));
      col += mix(near, blur, far);
      // Neon strips up the corners of some towers.
      float corner = step(0.485, abs(vLocal.x)) * step(0.485, abs(vLocal.z));
      vec3 neon = vNeon > 1.5 ? vec3(0.1, 0.9, 1.0) : vec3(1.0, 0.18, 0.6);
      col += corner * step(0.5, vNeon) * neon * 2.2;
    }
    // Haze lit from the street below.
    col += vec3(0.35, 0.08, 0.22) * exp(-(vWorld.y - ${STREET_Y.toFixed(1)}) / 9.0) * 0.18;
    float d = length(vWorld - cameraPosition);
    float fog = 1.0 - exp(-uFogDensity * uFogDensity * d * d);
    gl_FragColor = vec4(mix(col, uFogColor, fog), 1.0);
  }
`;

const SKY_FRAG = /* glsl */ `
  varying vec3 vDir;
  uniform float uTime;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5); }
  float noise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
  float fbm(vec2 p) { float v = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; } return v; }
  void main() {
    vec3 d = normalize(vDir);
    float h = clamp(d.y, -0.2, 1.0);
    vec3 top = vec3(0.012, 0.014, 0.035);
    vec3 horizon = vec3(0.16, 0.06, 0.2);
    vec3 col = mix(horizon, top, smoothstep(-0.02, 0.45, h));
    // Low cloud, lit pink-orange from underneath by the city.
    vec2 uv = d.xz / max(d.y + 0.25, 0.05) * 1.6 + vec2(uTime * 0.01, 0.0);
    float c = fbm(uv);
    col += vec3(0.32, 0.1, 0.22) * smoothstep(0.45, 0.85, c) * (1.0 - smoothstep(0.05, 0.6, h)) * 0.9;
    col += vec3(0.08, 0.05, 0.12) * smoothstep(0.5, 0.9, c) * smoothstep(0.1, 0.7, h) * 0.4;
    gl_FragColor = vec4(col, 1.0);
  }
`;

const RAIN_VERT = /* glsl */ `
  attribute vec3 aOffset;
  attribute float aSpeed;
  uniform float uTime;
  uniform vec3 uBox;
  uniform vec3 uBoxMin;
  varying float vFade;
  void main() {
    vec3 p = aOffset;
    p.y = uBoxMin.y + mod(p.y - uTime * aSpeed, uBox.y);
    p.x += (p.y - uBoxMin.y) * 0.08;
    vec3 pos = position * vec3(1.0, 0.7 + aSpeed * 0.04, 1.0) + p;
    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    vFade = smoothstep(0.5, 6.0, -mv.z) * (1.0 - smoothstep(30.0, 60.0, -mv.z));
    gl_Position = projectionMatrix * mv;
  }
`;
const RAIN_FRAG = /* glsl */ `
  varying float vFade;
  void main() { gl_FragColor = vec4(0.7, 0.78, 1.0, 0.22 * vFade); }
`;

const BEAM_FRAG = /* glsl */ `
  varying vec2 vUv;
  uniform vec3 uColor;
  void main() {
    float a = pow(1.0 - vUv.y, 1.6) * 0.16 * smoothstep(0.0, 0.25, vUv.x) * smoothstep(1.0, 0.75, vUv.x);
    gl_FragColor = vec4(uColor, a);
  }
`;
const UV_VERT = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vDir;
  void main() { vUv = uv; vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;

function neonText(text: string, color: string, vertical = false, font = '"Archivo Black"') {
  const chars = vertical ? text.split('') : [text];
  const w = vertical ? 160 : 160 + text.length * 96;
  const h = vertical ? 60 + chars.length * 120 : 220;
  const [c, g] = canvas(w, h);
  g.fillStyle = 'rgba(8,6,14,0.92)';
  g.fillRect(0, 0, w, h);
  g.font = `700 ${vertical ? 104 : 140}px ${font}`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.shadowColor = color;
  g.shadowBlur = 24;
  g.fillStyle = color;
  chars.forEach((ch, i) => g.fillText(ch, w / 2, vertical ? 90 + i * 120 : h / 2));
  g.shadowBlur = 0;
  g.fillStyle = 'rgba(255,255,255,0.75)';
  g.font = `700 ${vertical ? 96 : 128}px ${font}`;
  chars.forEach((ch, i) => g.fillText(ch, w / 2, vertical ? 90 + i * 120 : h / 2));
  const mat = new THREE.MeshBasicMaterial({ map: texture(c), color: new THREE.Color(1.6, 1.6, 1.6) });
  return { mesh: new THREE.Mesh(new THREE.PlaneGeometry(w / 100, h / 100), mat), mat };
}

export function buildCity(quality: Quality): City {
  const group = new THREE.Group();
  const r = rng(77);
  const fogColor = new THREE.Color('#0b0f22');

  // Sky.
  const skyMat = new THREE.ShaderMaterial({ vertexShader: UV_VERT, fragmentShader: SKY_FRAG, uniforms: { uTime: { value: 0 } }, side: THREE.BackSide, depthWrite: false, fog: false });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(700, 32, 16), skyMat);
  group.add(sky);

  // Buildings, all one instanced mesh with windows drawn by the shader.
  type B = { x: number; z: number; w: number; d: number; h: number; neon: number };
  const list: B[] = [];
  const add = (b: B) => list.push(b);
  // Our neighbors on either side, flush with our wall.
  add({ x: -22.5, z: 6, w: 17, d: 16, h: 31, neon: 0 });
  add({ x: 22.5, z: 6, w: 17, d: 16, h: 24, neon: 2 });
  // Across the street: a row of low and mid buildings; the billboard building on the left.
  add({ x: -9, z: -26, w: 16, d: 12, h: 44, neon: 0 });
  for (let x = 1; x < 70; x += 9 + r() * 4) add({ x, z: -24 - r() * 3, w: 7 + r() * 4, d: 9, h: 8 + r() * 12, neon: r() < 0.2 ? 1 + Math.round(r()) : 0 });
  for (let x = -20; x > -70; x -= 9 + r() * 4) add({ x, z: -24 - r() * 3, w: 7 + r() * 4, d: 9, h: 10 + r() * 16, neon: r() < 0.2 ? 1 + Math.round(r()) : 0 });
  // Towers stepping back to the horizon, taller the further they are.
  const rows = quality === 'high' ? 15 : 9;
  for (let row = 0; row < rows; row++) {
    const z = -70 - row * 26 - r() * 10;
    const spread = 90 + row * 40;
    for (let x = -spread; x < spread; x += 10 + r() * 14) {
      const tall = r() < 0.12 ? 2.4 : 1;
      add({ x: x + r() * 6, z: z - r() * 12, w: 7 + r() * 10, d: 7 + r() * 10, h: (16 + r() * (30 + row * 9)) * tall, neon: r() < 0.08 ? 1 + Math.round(r()) : 0 });
    }
  }
  const bMat = new THREE.ShaderMaterial({
    vertexShader: BUILDING_VERT,
    fragmentShader: BUILDING_FRAG,
    uniforms: { uFogColor: { value: fogColor }, uFogDensity: { value: 0.0065 }, uTime: { value: 0 } },
  });
  const bGeo = new THREE.BoxGeometry(1, 1, 1);
  const seeds = new Float32Array(list.length);
  const neons = new Float32Array(list.length);
  const buildings = new THREE.InstancedMesh(bGeo, bMat, list.length);
  const m = new THREE.Matrix4();
  list.forEach((b, i) => {
    m.compose(new THREE.Vector3(b.x, STREET_Y + b.h / 2, b.z), new THREE.Quaternion(), new THREE.Vector3(b.w, b.h, b.d));
    buildings.setMatrixAt(i, m);
    seeds[i] = Math.floor(r() * 100);
    neons[i] = b.neon;
  });
  bGeo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seeds, 1));
  bGeo.setAttribute('aNeon', new THREE.InstancedBufferAttribute(neons, 1));
  buildings.frustumCulled = false;
  group.add(buildings);

  // Rooftop warning lights, blinking slowly.
  const roofGeo = new THREE.BufferGeometry();
  const roofPts: number[] = [];
  list.forEach((b) => b.h > 40 && roofPts.push(b.x, STREET_Y + b.h + 0.5, b.z));
  roofGeo.setAttribute('position', new THREE.Float32BufferAttribute(roofPts, 3));
  const roofMat = new THREE.PointsMaterial({ color: new THREE.Color(3, 0.2, 0.2), size: 1.4, map: glow('rgba(255,60,60,1)', 64), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true });
  group.add(new THREE.Points(roofGeo, roofMat));

  // The street: wet asphalt, and smeared reflections of the neon above it.
  const street = new THREE.Mesh(new THREE.PlaneGeometry(220, 22), new THREE.MeshStandardMaterial({ color: '#07080c', roughness: 0.18, metalness: 0.7 }));
  street.rotation.x = -Math.PI / 2;
  street.position.set(0, STREET_Y, -13);
  group.add(street);
  const smear = (color: string, x: number, wid: number) => {
    const [c, g] = canvas(64, 256);
    const grad = g.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(0.5, color);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grad;
    for (let i = 0; i < 64; i += 3) {
      g.globalAlpha = 0.3 + Math.random() * 0.7;
      g.fillRect(i, 0, 2, 256);
    }
    const s = new THREE.Mesh(new THREE.PlaneGeometry(wid, 14), new THREE.MeshBasicMaterial({ map: texture(c), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    s.rotation.x = -Math.PI / 2;
    s.position.set(x, STREET_Y + 0.02, -14);
    group.add(s);
  };
  smear('rgba(80,230,255,0.9)', -6, 10);
  smear('rgba(255,60,170,0.8)', 0, 5);
  smear('rgba(255,170,80,0.6)', 14, 4);
  const sidewalk = new THREE.Mesh(new THREE.PlaneGeometry(220, 3), new THREE.MeshStandardMaterial({ color: '#111216', roughness: 0.4, metalness: 0.4 }));
  sidewalk.rotation.x = -Math.PI / 2;
  sidewalk.position.set(0, STREET_Y + 0.15, -3.6);
  group.add(sidewalk);

  // Traffic: pairs of headlights one way, tail lights the other.
  const carGlow = glow('rgba(255,255,255,1)', 64);
  const cars: { obj: THREE.Group; speed: number; lane: number }[] = [];
  for (let i = 0; i < 10; i++) {
    const dir = i % 2 ? 1 : -1;
    const car = new THREE.Group();
    const color = dir > 0 ? new THREE.Color(4, 3.6, 3) : new THREE.Color(4, 0.3, 0.25);
    for (const off of [-0.7, 0.7]) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: carGlow, color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
      s.position.set(0, 0, off);
      s.scale.setScalar(1.1);
      car.add(s);
    }
    const body = new THREE.Mesh(new THREE.BoxGeometry(4.2, 1.2, 1.9), new THREE.MeshStandardMaterial({ color: '#0d0e12', roughness: 0.3, metalness: 0.8 }));
    body.position.x = -dir * 2;
    car.add(body);
    car.rotation.y = Math.PI / 2 - (Math.PI / 2) * dir;
    car.position.set(r() * 200 - 100, STREET_Y + 0.7, dir > 0 ? -9 : -16);
    cars.push({ obj: car, speed: (9 + r() * 7) * dir, lane: dir });
    group.add(car);
  }

  // Rain.
  const count = quality === 'high' ? 14000 : 5000;
  const rainGeo = new THREE.InstancedBufferGeometry();
  rainGeo.copy(new THREE.PlaneGeometry(0.012, 0.55) as unknown as THREE.InstancedBufferGeometry);
  rainGeo.instanceCount = count;
  const offsets = new Float32Array(count * 3);
  const speeds = new Float32Array(count);
  const boxMin = new THREE.Vector3(-30, STREET_Y, -42);
  const boxSize = new THREE.Vector3(60, 46, 39.6);
  for (let i = 0; i < count; i++) {
    offsets[i * 3] = boxMin.x + r() * boxSize.x;
    offsets[i * 3 + 1] = boxMin.y + r() * boxSize.y;
    offsets[i * 3 + 2] = boxMin.z + r() * boxSize.z;
    speeds[i] = 14 + r() * 8;
  }
  rainGeo.setAttribute('aOffset', new THREE.InstancedBufferAttribute(offsets, 3));
  rainGeo.setAttribute('aSpeed', new THREE.InstancedBufferAttribute(speeds, 1));
  const rainMat = new THREE.ShaderMaterial({
    vertexShader: RAIN_VERT,
    fragmentShader: RAIN_FRAG,
    uniforms: { uTime: { value: 0 }, uBox: { value: boxSize }, uBoxMin: { value: boxMin } },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const rain = new THREE.Mesh(rainGeo, rainMat);
  rain.frustumCulled = false;
  group.add(rain);

  // Searchlights sweeping the cloud.
  const beams: THREE.Mesh[] = [];
  for (const [x, z, color] of [
    [-140, -260, '#9fc4ff'],
    [120, -300, '#ffd2f0'],
    [30, -420, '#b8fff6'],
  ] as const) {
    const beamGeo = new THREE.CylinderGeometry(0.6, 16, 260, 24, 1, true);
    beamGeo.translate(0, 130, 0);
    const beam = new THREE.Mesh(
      beamGeo,
      new THREE.ShaderMaterial({ vertexShader: UV_VERT, fragmentShader: BEAM_FRAG, uniforms: { uColor: { value: new THREE.Color(color) } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }),
    );
    beam.position.set(x, STREET_Y, z);
    beam.userData.phase = r() * 10;
    beams.push(beam);
    group.add(beam);
  }

  // The elevated railway, and a train that comes through every so often.
  const railZ = -48;
  const railY = -4;
  const concrete = new THREE.MeshStandardMaterial({ color: '#1b1c22', roughness: 0.8 });
  const track = new THREE.Mesh(new THREE.BoxGeometry(400, 0.8, 5), concrete);
  track.position.set(0, railY, railZ);
  group.add(track);
  for (let x = -190; x <= 190; x += 22) {
    const pillar = new THREE.Mesh(new THREE.BoxGeometry(1.4, railY - STREET_Y, 1.4), concrete);
    pillar.position.set(x, (railY + STREET_Y) / 2, railZ);
    group.add(pillar);
  }
  const [tc, tg] = canvas(512, 64);
  tg.fillStyle = '#20232c';
  tg.fillRect(0, 0, 512, 64);
  for (let i = 0; i < 12; i++) {
    tg.fillStyle = i % 5 === 3 ? '#2a2c35' : '#ffe2b0';
    tg.fillRect(12 + i * 42, 16, 30, 24);
  }
  tg.fillStyle = '#ff4fa3';
  tg.fillRect(0, 50, 512, 4);
  const carTex = texture(tc);
  const train = new THREE.Group();
  for (let i = 0; i < 6; i++) {
    const car = new THREE.Mesh(new THREE.BoxGeometry(18, 3.2, 3.2), [
      concrete,
      concrete,
      new THREE.MeshStandardMaterial({ color: '#1a1c22' }),
      concrete,
      new THREE.MeshBasicMaterial({ map: carTex, color: new THREE.Color(1.5, 1.5, 1.5) }),
      new THREE.MeshBasicMaterial({ map: carTex, color: new THREE.Color(1.5, 1.5, 1.5) }),
    ]);
    car.position.x = i * 18.6;
    train.add(car);
  }
  const trainLight = new THREE.PointLight('#ffd9a0', 0, 40, 1.5);
  trainLight.position.set(50, 0, 4);
  train.add(trainLight);
  train.position.set(-400, railY + 2.1, railZ);
  group.add(train);
  let trainAt = 6;

  // Flying cars on their lanes.
  const spinners: { obj: THREE.Group; speed: number; y: number; z: number; bob: number }[] = [];
  for (let i = 0; i < 7; i++) {
    const s = new THREE.Group();
    const hull = new THREE.Mesh(new THREE.CapsuleGeometry(0.9, 2.6, 6, 12), new THREE.MeshStandardMaterial({ color: '#16171c', roughness: 0.35, metalness: 0.8 }));
    hull.rotation.z = Math.PI / 2;
    s.add(hull);
    for (const [px, col, sc] of [
      [2.2, 'rgba(255,240,220,1)', 2.2],
      [-2.2, 'rgba(255,40,40,1)', 1.2],
      [0, 'rgba(80,200,255,1)', 1.0],
    ] as const) {
      const l = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow(col, 64), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
      l.position.set(px, px === 0 ? -0.9 : 0, 0);
      l.scale.setScalar(sc);
      s.add(l);
    }
    const dir = i % 2 ? 1 : -1;
    s.scale.x = dir;
    spinners.push({ obj: s, speed: (14 + r() * 18) * dir, y: 6 + r() * 30, z: -30 - r() * 120, bob: r() * 10 });
    s.position.set(r() * 300 - 150, 0, 0);
    group.add(s);
  }

  // Neon signs on the buildings across the street.
  const signs: { mat: THREE.MeshBasicMaterial; seed: number }[] = [];
  for (const [text, color, x, y, z, vertical] of [
    ['NOODLES', '#ff4f8b', 18, -4, -19.4, true],
    ['TAPES', '#4fe3ff', 31, -8, -19.4, false],
    ['HOTEL', '#ffb84f', -24, 3, -19.4, true],
    ['INK 24H', '#9b6bff', 47, -6, -19.6, false],
    ['ARCADE', '#4fffa1', 8, -9, -19.2, false],
  ] as const) {
    const { mesh, mat } = neonText(text, color, vertical);
    mesh.position.set(x, y, z);
    mesh.scale.setScalar(vertical ? 1.3 : 1);
    group.add(mesh);
    signs.push({ mat, seed: r() * 100 });
  }

  // The billboard: words evolving out of noise.
  const [bc, bg] = canvas(1536, 576);
  const billboardTex = texture(bc);
  const bbW = 15;
  const bbH = 5.6;
  const billboard = new THREE.Mesh(new THREE.PlaneGeometry(bbW, bbH), new THREE.MeshBasicMaterial({ map: billboardTex, color: new THREE.Color(1.7, 1.7, 1.7) }));
  const billboardCenter = new THREE.Vector3(-9, 6, -19.9);
  billboard.position.copy(billboardCenter);
  group.add(billboard);
  const frame = new THREE.Mesh(new THREE.BoxGeometry(bbW + 0.6, bbH + 0.6, 0.4), new THREE.MeshStandardMaterial({ color: '#0e0f13', roughness: 0.5, metalness: 0.7 }));
  frame.position.copy(billboardCenter).add(new THREE.Vector3(0, 0, -0.25));
  group.add(frame);
  // The color the billboard is throwing right now. The room picks it up through
  // the window (an area light here would shine through every wall in the city).
  const billboardColor = new THREE.Color('#ff4fb0');
  const billboardAim = new THREE.Color('#ff4fb0');

  const evolver = new Evolver();
  let phrase = 0;
  evolver.aim(PHRASES[0]);
  evolver.scramble();
  let state = evolver.state();
  let holdUntil = 0;
  let nextStep = 0;
  let custom = false;
  let lastDraw = -1;
  const cyan = '#5ff3ff';
  const pink = '#ff4fb0';
  const drawBillboard = (t: number) => {
    bg.fillStyle = '#05060c';
    bg.fillRect(0, 0, 1536, 576);
    // Dot-matrix glow: a faint grid behind the letters.
    bg.fillStyle = 'rgba(80,120,255,0.06)';
    for (let x = 0; x < 1536; x += 12) bg.fillRect(x, 0, 1, 576);
    for (let y = 0; y < 576; y += 12) bg.fillRect(0, y, 1536, 1);
    const text = state.text;
    const size = Math.min(200, 1400 / Math.max(text.length, 1) / 0.62);
    bg.font = `400 ${size}px "VT323", monospace`;
    bg.textBaseline = 'middle';
    bg.textAlign = 'center';
    const step = size * 0.6;
    const startX = 768 - (step * (text.length - 1)) / 2;
    for (let i = 0; i < text.length; i++) {
      const right = text[i] === state.target[i];
      const ch = right ? text[i] : t % 0.3 < 0.15 && Math.random() < 0.3 ? ALPHABET[Math.floor(Math.random() * 26)] : text[i];
      bg.shadowColor = right ? cyan : pink;
      bg.shadowBlur = right ? 30 : 18;
      bg.fillStyle = right ? (state.done ? '#e6fdff' : cyan) : pink;
      bg.fillText(ch, startX + i * step, 270);
    }
    bg.shadowBlur = 0;
    bg.font = '400 44px "VT323", monospace';
    bg.textAlign = 'left';
    bg.fillStyle = 'rgba(160,190,255,0.85)';
    bg.fillText(`GENERATION ${String(state.generation).padStart(4, '0')}`, 60, 500);
    bg.textAlign = 'right';
    bg.fillText(`FITNESS ${Math.round(state.fitness * 100)}%`, 1476, 500);
    bg.textAlign = 'center';
    bg.fillStyle = 'rgba(255,120,200,0.8)';
    bg.fillText('MUTATE · SELECT · REPEAT', 768, 80);
    billboardTex.needsUpdate = true;
  };
  drawBillboard(0);

  return {
    group,
    billboardCenter,
    billboardColor,
    billboard,
    evolution: () => ({ ...state, custom }),
    evolve(text) {
      custom = true;
      holdUntil = 0;
      evolver.aim(text);
      state = evolver.state();
    },
    tick(t, dt, camera) {
      billboardColor.lerp(billboardAim, Math.min(1, dt * 2.5));
      skyMat.uniforms.uTime.value = t;
      bMat.uniforms.uTime.value = t;
      rainMat.uniforms.uTime.value = t;
      sky.position.copy(camera.position);
      roofMat.opacity = 0.35 + 0.65 * (Math.sin(t * 2.2) > 0.6 ? 1 : 0);
      for (const c of cars) {
        c.obj.position.x += c.speed * dt;
        if (c.obj.position.x > 110) c.obj.position.x = -110;
        if (c.obj.position.x < -110) c.obj.position.x = 110;
      }
      for (const b of beams) {
        const p = b.userData.phase as number;
        b.rotation.z = Math.sin(t * 0.13 + p) * 0.45;
        b.rotation.x = Math.cos(t * 0.09 + p * 2) * 0.25;
      }
      // The train: comes through, then a quiet spell.
      if (t > trainAt) {
        train.position.x += 38 * dt;
        trainLight.intensity = 30;
        if (train.position.x > 260) {
          train.position.x = -380;
          trainAt = t + 30 + Math.random() * 25;
          trainLight.intensity = 0;
        }
      }
      for (const s of spinners) {
        s.obj.position.x += s.speed * dt;
        if (Math.abs(s.obj.position.x) > 220) s.obj.position.x = -Math.sign(s.speed) * 220;
        s.obj.position.y = s.y + Math.sin(t * 0.7 + s.bob) * 0.8;
        s.obj.position.z = s.z;
      }
      for (const s of signs) {
        const flick = Math.sin(t * 50 + s.seed) > 0.97 || Math.sin(t * 0.7 + s.seed) > 0.995 ? 0.2 : 1;
        s.mat.color.setScalar(1.6 * flick);
      }
      // Evolve: a generation every 70ms, a pause on each finished phrase. A slow
      // frame catches up on the generations it missed (a few at most).
      for (let n = 0; t >= nextStep && n < 6; n++) {
        nextStep = Math.max(nextStep + 0.07, t - 0.3);
        if (state.done) {
          // Someone's own phrase stays up a while longer.
          if (!holdUntil) holdUntil = t + (custom ? 14 : 3.8);
          if (t > holdUntil) {
            holdUntil = 0;
            custom = false;
            phrase = (phrase + 1) % PHRASES.length;
            evolver.aim(PHRASES[phrase]);
          }
        }
        state = state.done && holdUntil ? state : evolver.step();
      }
      // Redrawing the board means re-uploading it to the GPU; 25 times a second is plenty.
      if (t - lastDraw > 0.04) {
        lastDraw = t;
        drawBillboard(t);
      }
      billboardAim.set(state.done ? '#9ff6ff' : state.fitness > 0.6 ? '#4fd9ff' : '#ff4fb0');
    },
  };
}
