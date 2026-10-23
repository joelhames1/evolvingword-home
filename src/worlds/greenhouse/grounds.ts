// Outside the glass: a walled garden at golden hour. A striped lawn running out
// from a gravel walk, borders along the front of the house, clipped yew,
// fruit trees and the tall trees beyond the wall, all going gold in the low sun,
// and across the lawn a grass bank where the bedding spells out the word. The
// sky is warm at the horizon and the sun sits low over the garden's far corner.
// Everything out here lights itself (see outdoor.ts), so the lamps in the house
// don't shine through the glass onto the lawn.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { rng } from '../../textures';
import { DAYLIGHT, daylightUniforms, outdoor, type DaylightUniforms } from '../outdoor';
import { HOUSE, SUN } from './plan';
import { brick } from './surfaces';

const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

/** The bank the word is bedded out on: the middle of the letters, how steep it is, and how far it runs. */
export const BANK = { center: v(0, 2.3, -12.6), tilt: (50 * Math.PI) / 180, width: 19, top: 3.2 };
/** Where the bank's face meets the lawn, and its top edge. */
export const bankFoot = () => BANK.center.z + BANK.center.y / Math.tan(BANK.tilt);
export const bankTop = () => BANK.center.z - (BANK.top - BANK.center.y) / Math.tan(BANK.tilt);

export interface Grounds {
  group: THREE.Group;
  daylight: DaylightUniforms;
  sky: THREE.ShaderMaterial;
  /** 0 clear, 1 the height of a shower: the sky greys a little and the sun dims. */
  setRain(k: number): void;
  tick(t: number, camera: THREE.PerspectiveCamera, renderer: THREE.WebGLRenderer): void;
}

const SKY_VERT = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = position;
    vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    // Pinned to the far plane, so nothing is ever behind the sky.
    gl_Position = p.xyww;
  }
`;

// Golden hour: peach and gold low down, a clear soft blue overhead, the sun low
// with a wide warm glow, and long thin clouds lit from below. A shower greys it.
const SKY_FRAG = /* glsl */ `
  uniform vec3 uSunDir;
  uniform float uRain;
  uniform float uTime;
  varying vec3 vDir;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
  }
  float fbm(vec2 p) {
    float s = 0.0;
    float a = 0.5;
    for (int i = 0; i < 5; i++) { s += a * noise(p); p = p * 2.03 + 17.1; a *= 0.5; }
    return s;
  }
  void main() {
    vec3 d = normalize(vDir);
    float h = d.y;
    float toSun = max(dot(d, uSunDir), 0.0);
    // Toward the sun the low sky is gold; away from it, a rosy band under clear blue.
    float sunSide = pow(max(dot(normalize(d.xz + 1e-4), normalize(uSunDir.xz)), 0.0), 1.5);
    vec3 zenith = vec3(0.22, 0.38, 0.66);
    vec3 high = vec3(0.42, 0.58, 0.82);
    vec3 band = mix(vec3(0.92, 0.66, 0.62), vec3(1.15, 0.72, 0.36), sunSide);
    vec3 horizon = mix(vec3(1.0, 0.76, 0.56), vec3(1.35, 0.86, 0.42), sunSide);
    vec3 col = mix(horizon, band, smoothstep(0.0, 0.1, h));
    col = mix(col, high, smoothstep(0.08, 0.32, h));
    col = mix(col, zenith, smoothstep(0.3, 0.85, h));
    // Warmer all round the sun's side of the sky.
    col += vec3(0.6, 0.3, 0.06) * pow(toSun, 3.0) * (1.0 - smoothstep(0.0, 0.5, h));
    // Below the horizon, the haze over the far country.
    col = mix(col, vec3(0.95, 0.72, 0.5), smoothstep(0.0, -0.08, h));
    // Long thin clouds, lit gold underneath on the sun's side.
    vec2 cp = d.xz / max(h + 0.12, 0.05);
    float c = fbm(cp * vec2(0.35, 1.4) + vec2(uTime * 0.004, 0.0));
    float clouds = smoothstep(0.55 - uRain * 0.25, 0.85, c) * smoothstep(0.0, 0.08, h) * (1.0 - smoothstep(0.35, 0.8, h));
    vec3 cloudCol = mix(vec3(0.95, 0.66, 0.5), vec3(1.4, 0.95, 0.55), pow(toSun, 2.0));
    cloudCol = mix(cloudCol, vec3(0.55, 0.55, 0.58), uRain * 0.7);
    col = mix(col, cloudCol, clouds * 0.75);
    // The sun, and its glow.
    float disc = smoothstep(0.99955, 0.99975, toSun);
    col += vec3(1.4, 0.95, 0.55) * pow(toSun, 60.0) * 0.6 + vec3(4.0, 2.9, 1.7) * disc * (1.0 - uRain * 0.7);
    col += vec3(0.6, 0.35, 0.12) * pow(toSun, 12.0) * 0.35;
    // A shower greys and darkens it.
    col = mix(col, vec3(dot(col, vec3(0.3, 0.5, 0.2))) * vec3(0.78, 0.8, 0.86), uRain * 0.45);
    gl_FragColor = vec4(min(col, vec3(16.0)), 1.0);
  }
`;

const LAWN_VERT = /* glsl */ `
  varying vec3 vWorld;
  varying vec3 vNrm;
  void main() {
    vec4 w = modelMatrix * vec4(position, 1.0);
    vWorld = w.xyz;
    vNrm = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;
// The lawn: mown in stripes near the house, rougher and more golden further off,
// a gravel walk along the front of the glass and round to the door.
const LAWN_FRAG = /* glsl */ `
  ${DAYLIGHT}
  uniform vec4 uWalk;
  varying vec3 vWorld;
  varying vec3 vNrm;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
  }
  void main() {
    vec2 p = vWorld.xz;
    float far = smoothstep(18.0, 60.0, length(p));
    float n = noise(p * 1.7) * 0.5 + noise(p * 7.0) * 0.3 + noise(p * 0.3) * 0.4;
    // Mown stripes, a couple of meters wide, running out from the house.
    float stripe = step(0.5, fract(p.x / 2.4)) * (1.0 - far);
    vec3 grass = mix(vec3(0.16, 0.25, 0.07), vec3(0.24, 0.32, 0.1), n);
    grass *= 0.9 + stripe * 0.16;
    grass = mix(grass, vec3(0.33, 0.3, 0.12), far * 0.6);
    // The walk: gravel along the front, and round the end to the door.
    float walk = step(uWalk.x, p.y) * step(p.y, uWalk.y) * step(abs(p.x), uWalk.z);
    walk = max(walk, step(uWalk.w, p.x) * step(p.x, uWalk.w + 1.3) * step(uWalk.x, p.y) * step(p.y, 1.6));
    vec3 gravel = mix(vec3(0.56, 0.48, 0.38), vec3(0.7, 0.62, 0.5), noise(p * 40.0));
    vec3 albedo = mix(grass, gravel, walk);
    vec3 col = daylight(albedo, normalize(vNrm), vWorld);
    gl_FragColor = vec4(fade(col, vWorld), 1.0);
  }
`;

/** A rounded clump of leaves (a tree's crown, a shrub, a clipped ball), lumpy, with darker hollows. */
function clump(r: number, seed: number, detail = 2) {
  const geo = new THREE.IcosahedronGeometry(r, detail);
  const p = geo.attributes.position;
  const rand = rng(seed);
  const bumps = Array.from({ length: 7 }, () => [v(rand() - 0.5, rand() - 0.3, rand() - 0.5).normalize(), 0.12 + rand() * 0.18] as const);
  const col: number[] = [];
  const t = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    t.fromBufferAttribute(p, i);
    const n = t.clone().normalize();
    let k = 1;
    for (const [d, a] of bumps) k += a * Math.max(0, n.dot(d)) ** 3;
    k += Math.sin(n.x * 9 + seed) * Math.sin(n.y * 7) * 0.04;
    t.multiplyScalar(k);
    p.setXYZ(i, t.x, t.y * 0.92, t.z);
    // Darker underneath and in the hollows; a little lighter on top.
    const shade = 0.55 + 0.45 * THREE.MathUtils.clamp(n.y * 0.5 + 0.5, 0, 1) * (0.8 + 0.25 * (k - 1));
    col.push(shade, shade, shade);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.computeVertexNormals();
  return geo;
}

/** A trunk from the ground to `h`. */
function trunk(h: number, r: number) {
  const geo = new THREE.CylinderGeometry(r * 0.7, r, h, 7, 1);
  geo.translate(0, h / 2, 0);
  const col = new Float32Array(geo.attributes.position.count * 3).fill(0.6);
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return geo;
}

/** Ready to merge: no index, and the same attributes every time. */
const plain = (g: THREE.BufferGeometry) => {
  const out = g.index ? g.toNonIndexed() : g;
  for (const k of Object.keys(out.attributes)) if (!['position', 'normal', 'color'].includes(k)) out.deleteAttribute(k);
  if (!out.attributes.color) out.setAttribute('color', new THREE.BufferAttribute(new Float32Array(out.attributes.position.count * 3).fill(1), 3));
  return out;
};

/** A geometry's colors multiplied by a tint. */
const tinted = (g: THREE.BufferGeometry, c: THREE.Color) => {
  const a = g.attributes.color;
  for (let i = 0; i < a.count; i++) a.setXYZ(i, a.getX(i) * c.r, a.getY(i) * c.g, a.getZ(i) * c.b);
  return g;
};

export function buildGrounds(quality: 'high' | 'low'): Grounds {
  const group = new THREE.Group();
  const high = quality === 'high';
  const sunColor = new THREE.Color(2.3, 1.45, 0.7);
  const daylight = daylightUniforms({
    sunDir: SUN.clone(),
    sunColor,
    sky: new THREE.Color(0.42, 0.42, 0.5),
    ground: new THREE.Color(0.4, 0.28, 0.14),
    haze: new THREE.Color(1.0, 0.74, 0.48),
    hazeDensity: 0.0032,
    mist: 0.06,
    mistLevel: 0,
  });
  const sunBase = sunColor.clone();

  // --- the sky ---------------------------------------------------------------------------------
  const sky = new THREE.ShaderMaterial({
    vertexShader: SKY_VERT,
    fragmentShader: SKY_FRAG,
    uniforms: { uSunDir: { value: SUN.clone() }, uRain: { value: 0 }, uTime: daylight.uTime },
    side: THREE.BackSide,
    depthWrite: false,
  });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(1500, 48, 24), sky);
  dome.frustumCulled = false;
  dome.renderOrder = -1;
  group.add(dome);

  // --- the lawn and the walk --------------------------------------------------------------------------
  const lawn = new THREE.Mesh(
    new THREE.PlaneGeometry(1400, 1400, 1, 1),
    new THREE.ShaderMaterial({ vertexShader: LAWN_VERT, fragmentShader: LAWN_FRAG, uniforms: { ...daylight, uWalk: { value: new THREE.Vector4(HOUSE.kneeOut - 1.2, HOUSE.kneeOut + 0.02, 9.5, HOUSE.x0 - 1.6) } } }),
  );
  lawn.rotation.x = -Math.PI / 2;
  lawn.position.y = -0.002;
  group.add(lawn);

  // --- the garden wall, on from the house's back wall either way --------------------------------------
  const wallBrick = brick(23, { moss: true });
  wallBrick.map.repeat.set(12, 3.2);
  const wallMat = outdoor(daylight, { map: wallBrick.map });
  const stoneMat = outdoor(daylight, { color: '#cfc3a6' });
  for (const s of [-1, 1]) {
    const len = 26;
    const w = new THREE.Mesh(new THREE.BoxGeometry(len, 3.2, 0.4), wallMat);
    w.position.set(s * (HOUSE.x1 + 0.3 + len / 2), 1.6, HOUSE.back + 0.25);
    group.add(w);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(len, 0.08, 0.5), stoneMat);
    cap.position.set(w.position.x, 3.24, w.position.z);
    group.add(cap);
  }

  // --- greenery: hedges, topiary, trees, the borders --------------------------------------------------
  const r = rng(808);
  const solidLeaf: THREE.BufferGeometry[] = [];
  const wood: THREE.BufferGeometry[] = [];
  const put = (list: THREE.BufferGeometry[], g: THREE.BufferGeometry, x: number, y: number, z: number, color = '#ffffff') => {
    g.translate(x, y, z);
    list.push(tinted(plain(g), new THREE.Color(color)));
  };
  // Clipped yew hedges down either side of the lawn.
  for (const s of [-1, 1]) {
    const hedge = new THREE.BoxGeometry(1.4, 2.4, 20, 3, 6, 40);
    const hp = hedge.attributes.position;
    for (let i = 0; i < hp.count; i++) hp.setXYZ(i, hp.getX(i) + Math.sin(hp.getZ(i) * 3.1) * 0.04, hp.getY(i) + (hp.getY(i) > 1.1 ? Math.sin(hp.getZ(i) * 1.7) * 0.05 : 0), hp.getZ(i));
    hedge.computeVertexNormals();
    put(solidLeaf, hedge, s * 14.5, 1.2, -13.5, '#2e4a22');
  }
  // Yew cones and balls along the walk.
  for (const x of [-8.6, -3.2, 3.2, 8.6]) {
    put(solidLeaf, new THREE.ConeGeometry(0.55, 1.9, 18, 6), x, 0.95, -4.35, '#2c4a22');
    put(solidLeaf, clump(0.36, 7 + x * 3, 3), x, 0.25, -4.35, '#2c4a22');
  }
  // Every tree's crown is a cloud of leafy blobs; the borders' plants are blobs too.
  const blobs: { at: THREE.Vector3; s: THREE.Vector3; color: THREE.Color }[] = [];
  const crown = (x: number, y: number, z: number, rad: number, height: number, color: string, n: number) => {
    const base = new THREE.Color(color);
    for (let i = 0; i < n; i++) {
      // Spread through an egg shape, bigger blobs inside, small ones at the edge.
      const d = v(r() - 0.5, r() - 0.5, r() - 0.5).normalize();
      const k = Math.pow(r(), 0.6);
      const at = v(x + d.x * rad * k, y + d.y * height * k * 0.5, z + d.z * rad * k);
      const s = rad * (0.32 + (1 - k) * 0.3) * (0.8 + r() * 0.4);
      blobs.push({ at, s: v(s, s * 0.85, s), color: base.clone().offsetHSL((r() - 0.5) * 0.03, 0, (r() - 0.5) * 0.06) });
    }
  };
  // Fruit trees on the lawn to the left, toward the sun.
  for (let i = 0; i < 5; i++) {
    const x = -17.5 + (i % 2) * 2.6 + r() * 0.6;
    const z = -5.5 - i * 2.8 + r();
    put(wood, trunk(1.6, 0.09), x, 0, z, '#5a4a38');
    crown(x, 2.3, z, 1.25 + r() * 0.3, 1.8, ['#5c7a2e', '#6a8434', '#567028'][i % 3], 22);
  }
  // Tall trees beyond the wall behind the house, and far off beyond the bank across the lawn.
  for (let i = 0; i < 14; i++) {
    const x = -26 + i * 4 + r() * 2;
    const z = 7 + r() * 6;
    const h = 5 + r() * 4;
    put(wood, trunk(h * 0.6, 0.25), x, 0, z, '#4a3c30');
    crown(x, h, z, 2.6 + r() * 1.2, 4.2 + r() * 1.5, ['#4a6a2a', '#56722e', '#3e5e26', '#627a32'][i % 4], 28);
  }
  for (let i = 0; i < 12; i++) {
    const x = -26 + i * 4.8 + r() * 2;
    const z = bankTop() - 9 - r() * 12;
    const h = 2.6 + r() * 2.5;
    put(wood, trunk(h * 0.6, 0.18), x, BANK.top, z, '#4a3c30');
    crown(x, BANK.top + h, z, 1.5 + r(), 2.6, ['#55722c', '#4a6828', '#64803a'][i % 3], 18);
  }
  // The borders along the front of the house: mounds of green, flowering.
  for (let x = -9; x <= 9; x += 0.26) {
    if (Math.abs(x) < 0.55) continue;
    const s = 0.2 + r() * 0.16;
    blobs.push({ at: v(x + (r() - 0.5) * 0.12, s * 0.7, HOUSE.kneeOut - 1.5 - r() * 0.55), s: v(s, s * (1.2 + r() * 0.7), s), color: new THREE.Color(['#3e5a26', '#4a6a2c', '#56702e'][Math.floor(r() * 3)]) });
  }
  const foliage = foliageMaterial(daylight);
  group.add(new THREE.Mesh(mergeGeometries(solidLeaf), foliage));
  group.add(new THREE.Mesh(mergeGeometries(wood), outdoor(daylight, { vertexColors: true })));
  // The near blobs (the borders) rounder than the far ones.
  const m4 = new THREE.Matrix4();
  for (const [list, detail] of [
    [blobs.filter((b) => b.at.z < HOUSE.kneeOut - 1 && b.at.z > HOUSE.kneeOut - 2.2), 2],
    [blobs.filter((b) => !(b.at.z < HOUSE.kneeOut - 1 && b.at.z > HOUSE.kneeOut - 2.2)), 1],
  ] as const) {
    const crowns = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, detail), foliage, list.length);
    list.forEach((b, i) => {
      crowns.setMatrixAt(i, m4.compose(b.at, new THREE.Quaternion().setFromEuler(new THREE.Euler(r() * 3, r() * 3, r() * 3)), b.s));
      crowns.setColorAt(i, b.color);
    });
    crowns.frustumCulled = false;
    group.add(crowns);
  }

  // Flowers in the borders and on the lawn's edge: points of color that stay a few pixels across.
  const blooms: { pos: THREE.Vector3; color: THREE.Color; size: number }[] = [];
  const palette = ['#f2c14e', '#e8743b', '#d94f70', '#f4efe2', '#9b6fd0', '#f7a8c4', '#ffd98a'];
  for (let i = 0; i < (high ? 900 : 500); i++) {
    const x = -9 + r() * 18;
    if (Math.abs(x) < 0.6) continue;
    const z = HOUSE.kneeOut - 1.3 - r() * 0.95;
    const c = new THREE.Color(palette[Math.floor(r() * palette.length)]);
    blooms.push({ pos: v(x, 0.35 + r() * 0.75, z), color: c.multiplyScalar(0.9), size: 0.05 + r() * 0.03 });
  }
  const flowerPts = flowerPoints(blooms, daylight);
  group.add(flowerPts);

  // --- the bank across the lawn, where the word is bedded out, and its balustrade -----------------
  const foot = bankFoot();
  const top = bankTop();
  const bankShape = new THREE.Shape([new THREE.Vector2(foot + 0.6, 0), new THREE.Vector2(foot, 0), new THREE.Vector2(top, BANK.top), new THREE.Vector2(top - 6, BANK.top), new THREE.Vector2(top - 6, 0)]);
  const bankGeo = new THREE.ExtrudeGeometry(bankShape, { depth: BANK.width, bevelEnabled: false });
  bankGeo.rotateY(-Math.PI / 2);
  bankGeo.translate(BANK.width / 2, 0, 0);
  const bank = new THREE.Mesh(bankGeo, new THREE.ShaderMaterial({ vertexShader: LAWN_VERT, fragmentShader: LAWN_FRAG, uniforms: { ...daylight, uWalk: { value: new THREE.Vector4(1e4, 1e4, 0, 1e4) } } }));
  group.add(bank);
  // A stone balustrade along the top of the bank, and steps up it at either end.
  const balusters: THREE.BufferGeometry[] = [];
  const balProfile = [
    [0, 0],
    [0.06, 0],
    [0.06, 0.05],
    [0.035, 0.1],
    [0.065, 0.3],
    [0.04, 0.45],
    [0.06, 0.5],
    [0.06, 0.55],
    [0, 0.55],
  ].map(([a, b]) => new THREE.Vector2(a, b));
  for (let x = -BANK.width / 2 + 0.3; x <= BANK.width / 2 - 0.3; x += 0.24) {
    const b = new THREE.LatheGeometry(balProfile, 8);
    b.translate(x, BANK.top + 0.08, top - 0.35);
    balusters.push(plain(b));
  }
  const rail = new THREE.BoxGeometry(BANK.width, 0.1, 0.22);
  rail.translate(0, BANK.top + 0.68, top - 0.35);
  const plinth = new THREE.BoxGeometry(BANK.width, 0.1, 0.26);
  plinth.translate(0, BANK.top + 0.05, top - 0.35);
  balusters.push(plain(rail), plain(plinth));
  for (const x of [-BANK.width / 2, BANK.width / 2]) {
    const post = new THREE.BoxGeometry(0.34, 0.9, 0.34);
    post.translate(x, BANK.top + 0.45, top - 0.35);
    balusters.push(plain(post));
    const urn = new THREE.LatheGeometry(
      [
        [0, 0],
        [0.12, 0],
        [0.08, 0.08],
        [0.22, 0.25],
        [0.24, 0.4],
        [0.2, 0.42],
        [0, 0.42],
      ].map(([a, b]) => new THREE.Vector2(a, b)),
      14,
    );
    urn.translate(x, BANK.top + 0.9, top - 0.35);
    balusters.push(plain(urn));
  }
  const balustrade = new THREE.Mesh(mergeGeometries(balusters), outdoor(daylight, { color: '#d8ccb0', vertexColors: true }));
  group.add(balustrade);

  // --- far off: low hills in the haze ----------------------------------------------------------
  const hillGeo = new THREE.PlaneGeometry(1600, 140, 160, 8);
  const hp = hillGeo.attributes.position;
  for (let i = 0; i < hp.count; i++) {
    const x = hp.getX(i);
    const top = hp.getY(i) > 0;
    const h = 22 + Math.sin(x * 0.006) * 14 + Math.sin(x * 0.017 + 1.3) * 7 + Math.sin(x * 0.041) * 3;
    hp.setY(i, top ? h : -10);
  }
  hillGeo.computeVertexNormals();
  const hills = new THREE.Mesh(hillGeo, outdoor(daylight, { color: '#6d7a52' }));
  hills.position.set(0, 0, -420);
  group.add(hills);

  return {
    group,
    daylight,
    sky,
    setRain(k) {
      sky.uniforms.uRain.value = k;
      sunColor.copy(sunBase).multiplyScalar(1 - k * 0.45);
      (daylight.uHazeDensity as { value: number }).value = 0.0032 + k * 0.008;
    },
    tick(t, camera, renderer) {
      (daylight.uTime as { value: number }).value = t;
      // The flowers' points keep their size in meters whatever the lens.
      (flowerPts.material as THREE.ShaderMaterial).uniforms.uScale.value = renderer.domElement.height / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
    },
  };
}

/**
 * Leaves in the low sun: a leafy dapple broken up by noise (so a box of yew or
 * a ball of a crown reads as a mass of leaves, not a solid), the edges toward
 * the sun catching it, and a glow through them with the sun behind.
 */
function foliageMaterial(u: DaylightUniforms) {
  return new THREE.ShaderMaterial({
    vertexShader: /* glsl */ `
      varying vec3 vWorld;
      varying vec3 vNrm;
      varying vec3 vColor;
      void main() {
        vec4 local = vec4(position, 1.0);
        vec3 nrm = normal;
        vColor = vec3(1.0);
        #ifdef USE_INSTANCING
          local = instanceMatrix * local;
          nrm = mat3(instanceMatrix) * nrm;
        #endif
        #ifdef USE_INSTANCING_COLOR
          vColor *= instanceColor;
        #endif
        #ifdef USE_COLOR
          vColor *= color;
        #endif
        vec4 w = modelMatrix * local;
        vWorld = w.xyz;
        vNrm = normalize(mat3(modelMatrix) * nrm);
        gl_Position = projectionMatrix * viewMatrix * w;
      }
    `,
    fragmentShader: /* glsl */ `
      ${DAYLIGHT}
      varying vec3 vWorld;
      varying vec3 vNrm;
      varying vec3 vColor;
      float h13(vec3 p) { p = fract(p * 0.1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
      float vn(vec3 p) {
        vec3 i = floor(p);
        vec3 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(mix(mix(h13(i), h13(i + vec3(1, 0, 0)), f.x), mix(h13(i + vec3(0, 1, 0)), h13(i + vec3(1, 1, 0)), f.x), f.y),
                   mix(mix(h13(i + vec3(0, 0, 1)), h13(i + vec3(1, 0, 1)), f.x), mix(h13(i + vec3(0, 1, 1)), h13(i + vec3(1, 1, 1)), f.x), f.y), f.z);
      }
      void main() {
        vec3 toEye = cameraPosition - vWorld;
        vec3 v = normalize(toEye);
        float far = smoothstep(15.0, 60.0, length(toEye));
        float leaves = vn(vWorld * 9.0) * 0.55 + vn(vWorld * 23.0) * 0.45;
        leaves = mix(leaves, 0.5, far * 0.7);
        vec3 bump = vec3(vn(vWorld * 4.0 + 1.7), vn(vWorld * 4.0 + 4.1), vn(vWorld * 4.0 + 8.3)) - 0.5;
        vec3 n = normalize(normalize(vNrm) + bump * 1.1);
        vec3 albedo = vColor * (0.5 + 0.85 * leaves);
        vec3 col = daylight(albedo, n, vWorld);
        float lit = max(dot(n, uSunDir), 0.0);
        col += uSunColor * albedo * pow(1.0 - max(dot(n, v), 0.0), 2.0) * lit * 0.7;
        col += uSunColor * albedo * vec3(0.9, 1.0, 0.5) * pow(max(dot(-v, uSunDir), 0.0), 4.0) * 0.45;
        // The hollows between clumps of leaves stay dark.
        col *= 0.55 + 0.45 * smoothstep(0.2, 0.6, leaves);
        gl_FragColor = vec4(fade(col, vWorld), 1.0);
      }
    `,
    uniforms: { ...u },
    vertexColors: true,
  });
}

/** Flowers far enough off to be a few pixels: points that keep a size in meters, lit like the rest outside. */
function flowerPoints(list: { pos: THREE.Vector3; color: THREE.Color; size: number }[], u: DaylightUniforms) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(list.flatMap((b) => b.pos.toArray()), 3));
  geo.setAttribute('aColor', new THREE.Float32BufferAttribute(list.flatMap((b) => b.color.toArray()), 3));
  geo.setAttribute('aSize', new THREE.Float32BufferAttribute(list.map((b) => b.size), 1));
  const mat = new THREE.ShaderMaterial({
    vertexShader: /* glsl */ `
      ${DAYLIGHT}
      attribute vec3 aColor;
      attribute float aSize;
      uniform float uScale;
      varying vec3 vColor;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vec3 world = (modelMatrix * vec4(position, 1.0)).xyz;
        // Lit from the sun and the sky, as if facing up and a little toward the light.
        vColor = fade(daylight(aColor, normalize(vec3(uSunDir.x, 1.5, uSunDir.z)), world), world);
        gl_PointSize = clamp(aSize * uScale / max(-mv.z, 0.1), 1.0, 24.0);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec3 vColor;
      void main() {
        float r = length(gl_PointCoord - 0.5) * 2.0;
        if (r > 1.0) discard;
        gl_FragColor = vec4(vColor * (1.0 - r * r * 0.35), 1.0);
      }
    `,
    uniforms: { ...u, uScale: { value: 900 } },
  });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  return pts;
}
