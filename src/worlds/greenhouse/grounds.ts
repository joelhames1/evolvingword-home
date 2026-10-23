// Outside the glass: a walled garden at golden hour. A striped lawn running out
// from a gravel walk, borders along the front of the house, clipped yew,
// fruit trees and the tall trees beyond the wall, all going gold in the low sun,
// and across the lawn a grass bank where the bedding spells out the word. The
// sky is warm at the horizon and the sun sits low over the garden's far corner.
// Everything out here lights itself (see outdoor.ts), so the lamps in the house
// don't shine through the glass onto the lawn.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { canvas, rng, texture } from '../../textures';
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
  tick(t: number): void;
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
    vec3 zenith = vec3(0.14, 0.28, 0.58);
    vec3 high = vec3(0.32, 0.48, 0.76);
    vec3 band = mix(vec3(0.82, 0.56, 0.58), vec3(1.1, 0.62, 0.28), sunSide);
    vec3 horizon = mix(vec3(0.95, 0.66, 0.46), vec3(1.25, 0.74, 0.32), sunSide);
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
    // The sun, and its glow: a hot disc, a gold halo round it, and a wide warm wash low along the horizon.
    float disc = smoothstep(0.99955, 0.99975, toSun);
    float dry = 1.0 - uRain * 0.7;
    col += vec3(4.0, 2.9, 1.7) * disc * dry;
    col += vec3(1.3, 0.75, 0.3) * pow(toSun, 90.0) * 0.9 * dry;
    col += vec3(1.0, 0.5, 0.14) * pow(toSun, 14.0) * 0.45 * dry;
    col += vec3(0.6, 0.28, 0.06) * pow(toSun, 4.0) * (1.0 - smoothstep(0.0, 0.3, h)) * 0.6 * dry;
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
    vec3 grass = mix(vec3(0.12, 0.24, 0.05), vec3(0.2, 0.32, 0.07), n);
    grass *= 0.9 + stripe * 0.16;
    grass = mix(grass, vec3(0.33, 0.3, 0.12), far * 0.6);
    // The walk: gravel along the front, and round the end to the door.
    float walk = step(uWalk.x, p.y) * step(p.y, uWalk.y) * step(abs(p.x), uWalk.z);
    walk = max(walk, step(uWalk.w, p.x) * step(p.x, uWalk.w + 1.3) * step(uWalk.x, p.y) * step(p.y, 1.6));
    // Gravel: buff, with a pebble's worth of light and dark in it.
    float pebble = noise(p * 55.0) * 0.6 + noise(p * 13.0) * 0.4;
    vec3 gravel = mix(vec3(0.3, 0.26, 0.2), vec3(0.46, 0.4, 0.31), pebble);
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

/**
 * White vertex colors for a geometry that has none. Every surface outside is
 * drawn with vertex colors on, so they all share one shader program (each
 * program is a compile, and compiles are most of the wait on the way in).
 */
export const whiteColors = <T extends THREE.BufferGeometry>(g: T) => {
  if (!g.attributes.color) g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 3).fill(1), 3));
  return g;
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
  const sunColor = new THREE.Color(3.0, 1.72, 0.66);
  const daylight = daylightUniforms({
    sunDir: SUN.clone(),
    sunColor,
    sky: new THREE.Color(0.3, 0.36, 0.52),
    ground: new THREE.Color(0.36, 0.24, 0.12),
    haze: new THREE.Color(0.95, 0.68, 0.42),
    hazeDensity: 0.0026,
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
  // Well under the house's floor: a depth buffer can't tell two surfaces a few millimeters apart.
  lawn.position.y = -0.04;
  group.add(lawn);

  // --- the garden wall, on from the house's back wall either way --------------------------------------
  const wallBrick = brick(23, { moss: true });
  const wallMat = outdoor(daylight, { map: wallBrick.map, vertexColors: true });
  const stoneMat = outdoor(daylight, { color: '#cfc3a6', vertexColors: true });
  for (const s of [-1, 1]) {
    const len = 26;
    // A tile of the brick is two meters by one (outdoor shaders take the uv's as they are).
    const wallGeo = new THREE.BoxGeometry(len, 3.2, 0.4);
    const uv = wallGeo.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * (len / 2), uv.getY(i) * 3.2);
    const w = new THREE.Mesh(whiteColors(wallGeo), wallMat);
    w.position.set(s * (HOUSE.x1 + 0.3 + len / 2), 1.6, HOUSE.back + 0.25);
    group.add(w);
    const cap = new THREE.Mesh(whiteColors(new THREE.BoxGeometry(len, 0.08, 0.5)), stoneMat);
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
    put(solidLeaf, hedge, s * 14.5, 1.2, -13.5, '#24391c');
  }
  // Yew cones and balls along the walk.
  for (const x of [-8.6, -3.2, 3.2, 8.6]) {
    put(solidLeaf, new THREE.ConeGeometry(0.55, 1.9, 18, 6), x, 0.95, -4.35, '#253d1d');
    put(solidLeaf, clump(0.36, 7 + x * 3, 3), x, 0.25, -4.35, '#253d1d');
  }
  // Every tree's crown: a few dark masses of leaves at its heart, and round them sprays of leaves
  // (cards painted with a cluster of leaves), all lit as one crown: each knows the middle of its
  // crown, so the side toward the sun is gold and the far side and the heart of it fall into shade.
  type Blob = { at: THREE.Vector3; s: THREE.Vector3; color: THREE.Color; crown: THREE.Vector4 };
  const blobs: Blob[] = [];
  const sprays: { m: THREE.Matrix4; color: THREE.Color; crown: THREE.Vector4 }[] = [];
  const crown = (x: number, y: number, z: number, rad: number, height: number, color: string, n: number) => {
    const base = new THREE.Color(color);
    const middle = new THREE.Vector4(x, y, z, Math.max(rad, height * 0.5));
    // The masses that give the crown its shape (not a ball: lobed, a little lopsided).
    const masses = Array.from({ length: 3 + Math.floor(r() * 3) }, () => {
      const d = v(r() - 0.5, (r() - 0.4) * 0.9, r() - 0.5).normalize();
      return { at: v(x + d.x * rad * 0.4, y + d.y * height * 0.28, z + d.z * rad * 0.4), s: rad * (0.42 + r() * 0.16) };
    });
    for (const m of masses) blobs.push({ at: m.at, s: v(m.s, m.s * height * 0.5 / rad * 0.85, m.s), color: base.clone().multiplyScalar(0.8), crown: middle });
    // The sprays, mostly out at the surface of the masses, facing every which way.
    for (let i = 0; i < n; i++) {
      const m = masses[i % masses.length];
      const d = v(r() - 0.5, r() - 0.45, r() - 0.5).normalize();
      const k = 0.55 + Math.pow(r(), 0.5) * 0.6;
      const at = v(m.at.x + d.x * m.s * k, m.at.y + d.y * m.s * (height * 0.5 / rad) * k, m.at.z + d.z * m.s * k);
      const size = rad * (0.42 + r() * 0.3);
      const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(r() * 6.28, r() * 6.28, r() * 6.28));
      sprays.push({ m: new THREE.Matrix4().compose(at, q, v(size, size, size)), color: base.clone().offsetHSL((r() - 0.5) * 0.03, (r() - 0.5) * 0.1, (r() - 0.5) * 0.06), crown: middle });
    }
  };
  // Fruit trees on the lawn to the left, toward the sun.
  for (let i = 0; i < 5; i++) {
    const x = -17.5 + (i % 2) * 2.6 + r() * 0.6;
    const z = -5.5 - i * 2.8 + r();
    put(wood, trunk(1.6, 0.09), x, 0, z, '#4a3a2c');
    crown(x, 2.3, z, 1.25 + r() * 0.3, 1.8, ['#56732e', '#5e782c', '#4d6a2a'][i % 3], high ? 44 : 30);
  }
  // Tall trees beyond the wall behind the house (a copper beech among them), and far off beyond the bank across the lawn.
  for (let i = 0; i < 14; i++) {
    const x = -26 + i * 4 + r() * 2;
    const z = 7 + r() * 6;
    const h = 5 + r() * 4;
    put(wood, trunk(h * 0.6, 0.25), x, 0, z, '#3e3228');
    crown(x, h, z, 2.6 + r() * 1.2, 4.2 + r() * 1.5, i === 9 ? '#5a2c2a' : ['#3e5e24', '#4a6828', '#365620', '#56702a'][i % 4], high ? 80 : 52);
  }
  for (let i = 0; i < 12; i++) {
    const x = -26 + i * 4.8 + r() * 2;
    const z = bankTop() - 9 - r() * 12;
    const h = 2.6 + r() * 2.5;
    put(wood, trunk(h * 0.6, 0.18), x, BANK.top, z, '#3e3228');
    crown(x, BANK.top + h, z, 1.9 + r() * 1.3, 2.6 + r() * 1.2, ['#4a6a28', '#3e5c24', '#56722e', '#44622a'][i % 4], high ? 48 : 32);
  }
  // The borders along the front of the house: mounds of green, flowering.
  const mounds: Blob[] = [];
  for (let x = -9; x <= 9; x += 0.26) {
    if (Math.abs(x) < 0.55) continue;
    const s = 0.2 + r() * 0.16;
    const at = v(x + (r() - 0.5) * 0.12, s * 0.7, HOUSE.kneeOut - 1.5 - r() * 0.55);
    const tall = 1.1 + r() * 0.5;
    const mound = { at, s: v(s, s * tall, s), color: new THREE.Color(['#33501f', '#3e5a24', '#4a6428'][Math.floor(r() * 3)]), crown: new THREE.Vector4(at.x, at.y - s * 0.3, at.z, s * tall) };
    mounds.push(mound);
    // Sprays of leaves standing out of it, so its outline is leafy, not round.
    for (let k = 0; k < (high ? 6 : 4); k++) {
      const d = v(r() - 0.5, 0.15 + r() * 0.7, r() - 0.5).normalize();
      const p = at.clone().add(v(d.x * s, d.y * s * tall, d.z * s).multiplyScalar(0.85));
      const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(r() * 6.28, r() * 6.28, r() * 6.28));
      const size = s * (0.9 + r() * 0.5);
      sprays.push({ m: new THREE.Matrix4().compose(p, q, v(size, size, size)), color: mound.color.clone().offsetHSL(0, (r() - 0.5) * 0.1, (r() - 0.5) * 0.06), crown: mound.crown });
    }
  }
  const foliage = foliageMaterial(daylight);
  /** Instances of a shape, lit as foliage: each its place, size, turn, color and (for a crown's clumps) the middle of its crown. */
  const leafy = (geo: THREE.BufferGeometry, list: { m: THREE.Matrix4; color: THREE.Color; crown?: THREE.Vector4 }[]) => {
    const mesh = new THREE.InstancedMesh(geo, foliage, list.length);
    const crowns = new Float32Array(list.length * 4);
    list.forEach((b, i) => {
      mesh.setMatrixAt(i, b.m);
      mesh.setColorAt(i, b.color);
      b.crown?.toArray(crowns, i * 4);
    });
    geo.setAttribute('aCrown', new THREE.InstancedBufferAttribute(crowns, 4));
    mesh.frustumCulled = false;
    group.add(mesh);
    return mesh;
  };
  // (One instance of the hedges and cones, so they share the crowns' program.)
  leafy(mergeGeometries(solidLeaf), [{ m: new THREE.Matrix4(), color: new THREE.Color(1, 1, 1) }]);
  group.add(new THREE.Mesh(mergeGeometries(wood), outdoor(daylight, { vertexColors: true })));
  const m4 = new THREE.Matrix4();
  const turned = () => new THREE.Quaternion().setFromEuler(new THREE.Euler(r() * 3, r() * 3, r() * 3));
  // The near clumps (the borders) rounder than the far ones.
  leafy(
    new THREE.IcosahedronGeometry(1, 2),
    mounds.map((b) => ({ m: m4.clone().compose(b.at, turned(), b.s), color: b.color, crown: b.crown })),
  );
  leafy(
    new THREE.IcosahedronGeometry(1, 1),
    blobs.map((b) => ({ m: m4.clone().compose(b.at, turned(), b.s), color: b.color, crown: b.crown })),
  );
  group.add(leafCards(sprays, daylight));

  // Spires rising out of the borders, planted in drifts of one color as a border is: delphiniums,
  // lupins and foxgloves, each a tapering spike of florets, open at the foot and in bud at the tip.
  const drift = ['#4a5ad0', '#7a4cc0', '#e6a2c4', '#f2ead8', '#c4486a', '#5a6ce0', '#efbe4a'];
  const spires: { m: THREE.Matrix4; color: THREE.Color }[] = [];
  for (let x = -9; x <= 9; x += high ? 0.15 : 0.22) {
    if (Math.abs(x) < 0.6 || r() < 0.3) continue;
    const c = new THREE.Color(drift[Math.floor((x + 9) / 1.2) % drift.length]).offsetHSL((r() - 0.5) * 0.02, -0.04, (r() - 0.5) * 0.08);
    const foot = v(x + (r() - 0.5) * 0.08, 0.36 + r() * 0.14, HOUSE.kneeOut - 1.4 - r() * 0.7);
    const h = 0.42 + r() * 0.5;
    const w = 0.75 + r() * 0.5;
    const lean = new THREE.Quaternion().setFromEuler(new THREE.Euler((r() - 0.5) * 0.16, r() * 6.28, (r() - 0.5) * 0.16, 'YXZ'));
    spires.push({ m: m4.clone().compose(foot, lean, v(w, h, w)), color: c });
  }
  leafy(spireGeometry(high), spires);
  // And flowers all over the mounds' tops: daisies, cosmos and the like, a few centimeters across.
  const palette = ['#f2c14e', '#e8743b', '#d94f70', '#f4efe2', '#9b6fd0', '#f7a8c4', '#ffd98a', '#f4efe2'];
  const heads: { m: THREE.Matrix4; color: THREE.Color }[] = [];
  for (const b of mounds) {
    const tint = palette[Math.floor(r() * palette.length)];
    for (let k = 0, n = high ? 5 : 3; k < n; k++) {
      // On the upper side of the mound, facing out of it (and up, toward the light).
      const d = v(r() - 0.5, 0.45 + r() * 0.6, r() - 0.65).normalize();
      const at = b.at.clone().add(v(d.x * b.s.x, d.y * b.s.y, d.z * b.s.z).multiplyScalar(0.97));
      const face = d.clone().add(v(0, 0.6, 0)).normalize();
      const q = new THREE.Quaternion().setFromUnitVectors(v(0, 1, 0), face).multiply(new THREE.Quaternion().setFromAxisAngle(v(0, 1, 0), r() * 6.28));
      const sc = 0.8 + r() * 0.5;
      heads.push({ m: m4.clone().compose(at, q, v(sc, sc, sc)), color: new THREE.Color(r() < 0.75 ? tint : palette[Math.floor(r() * palette.length)]).multiplyScalar(0.85) });
    }
  }
  leafy(daisyGeometry(), heads);

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
  const hills = new THREE.Mesh(whiteColors(hillGeo), outdoor(daylight, { color: '#6d7a52', vertexColors: true }));
  hills.position.set(0, 0, -420);
  group.add(hills);

  return {
    group,
    daylight,
    sky,
    setRain(k) {
      sky.uniforms.uRain.value = k;
      sunColor.copy(sunBase).multiplyScalar(1 - k * 0.45);
      (daylight.uHazeDensity as { value: number }).value = 0.0026 + k * 0.008;
    },
    tick(t) {
      (daylight.uTime as { value: number }).value = t;
    },
  };
}

/**
 * Leaves in the low sun: a leafy dapple broken up by noise (so a box of yew or
 * a ball of a crown reads as a mass of leaves, not a solid), the edges toward
 * the sun catching it, and a glow through them with the sun behind. A clump
 * that belongs to a crown (aCrown: its middle and reach; a reach of 0 for the
 * rest) is lit as part of the whole crown, darker toward its heart, and its
 * outline is ragged with leaves rather than round.
 */
function foliageMaterial(u: DaylightUniforms) {
  return new THREE.ShaderMaterial({
    vertexShader: /* glsl */ `
      attribute vec4 aCrown;
      varying vec3 vWorld;
      varying vec3 vNrm;
      varying vec3 vColor;
      varying vec4 vCrown;
      void main() {
        vec4 local = vec4(position, 1.0);
        vec3 nrm = normal;
        vColor = vec3(1.0);
        #ifdef USE_INSTANCING
          mat3 im = mat3(instanceMatrix);
          local = instanceMatrix * local;
          // A squashed clump's normals, turned and squashed the right way (never a zero scale here).
          nrm = im * (nrm / max(vec3(dot(im[0], im[0]), dot(im[1], im[1]), dot(im[2], im[2])), vec3(1e-8)));
        #endif
        #ifdef USE_INSTANCING_COLOR
          vColor *= instanceColor;
        #endif
        #ifdef USE_COLOR
          vColor *= color;
        #endif
        vec4 w = modelMatrix * local;
        vWorld = w.xyz;
        vec3 nw = mat3(modelMatrix) * nrm;
        vNrm = nw / max(length(nw), 1e-6);
        vCrown = aCrown;
        gl_Position = projectionMatrix * viewMatrix * w;
      }
    `,
    fragmentShader: /* glsl */ `
      ${DAYLIGHT}
      varying vec3 vWorld;
      varying vec3 vNrm;
      varying vec3 vColor;
      varying vec4 vCrown;
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
        float dist = length(toEye);
        vec3 v = toEye / max(dist, 1e-4);
        float nl = length(vNrm);
        vec3 nb = nl > 1e-5 ? vNrm / nl : vec3(0.0, 1.0, 0.0);
        if (!gl_FrontFacing) nb = -nb;
        float far = smoothstep(15.0, 60.0, dist);
        float leaves = vn(vWorld * 9.0) * 0.55 + vn(vWorld * 23.0) * 0.45;
        // Up close, single leaves: small crisp flecks, lit or in shade, gone to an average further off.
        float near = 1.0 - smoothstep(3.0, 12.0, dist);
        float fleck = smoothstep(0.38, 0.62, vn(vWorld * 47.0 + leaves * 2.0));
        leaves = mix(leaves, leaves * (0.7 + 0.6 * fleck), near);
        leaves = mix(leaves, 0.5, far * 0.7);
        float inCrown = step(1e-3, vCrown.w);
        // A ragged edge: where a clump turns away from the eye, sprays of leaves with sky between
        // (only near enough for a leaf to be a few pixels; further off it would shimmer).
        float edge = 1.0 - abs(dot(nb, v));
        float sprays = vn(vWorld * 6.5 + 3.1) * 0.65 + vn(vWorld * 17.0) * 0.35;
        if (inCrown * edge * (1.0 - smoothstep(22.0, 40.0, dist)) > 0.42 + 0.75 * sprays) discard;
        vec3 bump = vec3(vn(vWorld * 4.0 + 1.7), vn(vWorld * 4.0 + 4.1), vn(vWorld * 4.0 + 8.3)) - 0.5;
        // Lit as part of its crown: the clump's own roundness, leaning out from the crown's middle.
        vec3 fromMid = vWorld - vCrown.xyz;
        float reach = length(fromMid);
        vec3 outward = reach > 1e-4 ? fromMid / reach : nb;
        vec3 n = normalize(mix(nb, outward, 0.62 * inCrown) + bump * mix(1.1, 0.75, inCrown));
        float heart = mix(1.0, mix(0.32, 1.0, smoothstep(0.25, 0.95, reach / max(vCrown.w, 1e-3))), inCrown);
        vec3 albedo = vColor * (0.5 + 0.8 * leaves);
        float lit = max(dot(n, uSunDir), 0.0);
        // The shade side stays green and deep: less of the sky's blue in it than on open ground.
        vec3 amb = mix(uGround, uSky, n.y * 0.5 + 0.5) * vec3(0.8, 0.88, 0.8);
        vec3 col = albedo * (amb * heart + uSunColor * lit * mix(1.0, heart, 0.5));
        // Gold on the edges toward the sun, and a glow through the leaves with the sun behind.
        col += uSunColor * albedo * pow(1.0 - max(dot(n, v), 0.0), 2.0) * lit * 0.9;
        col += uSunColor * albedo * vec3(0.95, 1.0, 0.45) * pow(max(dot(-v, uSunDir), 0.0), 4.0) * 0.5 * heart;
        // The hollows between clumps of leaves stay dark.
        col *= 0.55 + 0.45 * smoothstep(0.2, 0.6, leaves);
        gl_FragColor = vec4(fade(col, vWorld), 1.0);
      }
    `,
    uniforms: { ...u },
    vertexColors: true,
  });
}

/**
 * A spire of florets, a meter tall at a scale of one: delphinium, lupin or
 * foxglove. A green stalk out of the mound, and up it, in a spiral, florets
 * that are open and pale at the foot and smaller, tighter and darker toward
 * the tip, where the last are still in bud. The vertex colors are a shade
 * (the instance color is the flower's); the stalk is drawn green-dark.
 */
export function spireGeometry(high: boolean) {
  const parts: THREE.BufferGeometry[] = [];
  const shadeOf = (g: THREE.BufferGeometry, r: number, gr: number, b: number) => {
    const out = plain(g);
    const c = out.attributes.color;
    for (let i = 0; i < c.count; i++) c.setXYZ(i, r, gr, b);
    return out;
  };
  parts.push(shadeOf(new THREE.CylinderGeometry(0.005, 0.008, 0.98, 5, 1, true).translate(0, 0.49, 0), 0.2, 0.34, 0.14));
  const n = high ? 34 : 20;
  const rand = rng(77);
  for (let i = 0; i < n; i++) {
    const k = i / (n - 1);
    const t = 0.14 + k * 0.84;
    const a = i * 2.39996;
    const size = 0.042 * (1 - k * 0.6) * (0.85 + rand() * 0.3);
    const out = (0.034 * (1 - k * 0.75) + 0.004) * (0.9 + rand() * 0.2);
    // A floret: a little cup facing out and a touch down, buds rounder.
    const f = new THREE.IcosahedronGeometry(1, 0);
    f.scale(size, size * (0.75 + k * 0.4), size * (0.55 + k * 0.45));
    f.rotateX(0.25);
    f.rotateY(-a + Math.PI / 2);
    f.translate(Math.cos(a) * out, t, Math.sin(a) * out);
    const shade = (1.12 - k * 0.5) * (0.88 + rand() * 0.24);
    // Buds at the tip are greener: less of the flower's color in them.
    parts.push(shadeOf(f, shade * (1 - k * 0.15), shade * (1 + k * 0.05), shade * (1 - k * 0.3)));
  }
  return mergeGeometries(parts);
}

/** A little open flower about five centimeters across, facing up: a ring of cupped petals (seen from either side) round a darker eye. */
export function daisyGeometry() {
  const parts: THREE.BufferGeometry[] = [];
  const n = 7;
  for (let i = 0; i < n; i++) {
    const petal = new THREE.CircleGeometry(0.018, 5);
    petal.scale(0.55, 1, 1);
    petal.translate(0, 0.018, 0);
    petal.rotateX(-Math.PI / 2 + 0.3);
    petal.rotateY((i / n) * Math.PI * 2);
    const front = plain(petal);
    // Its back: the same triangles wound the other way, facing down.
    const back = front.clone();
    const bp = back.attributes.position;
    const bn = back.attributes.normal;
    for (let k = 0; k < bp.count; k += 3) {
      for (const a of [bp, bn]) {
        const x = a.getX(k + 1), y = a.getY(k + 1), z = a.getZ(k + 1);
        a.setXYZ(k + 1, a.getX(k + 2), a.getY(k + 2), a.getZ(k + 2));
        a.setXYZ(k + 2, x, y, z);
      }
    }
    for (let k = 0; k < bn.count; k++) bn.setXYZ(k, -bn.getX(k), -bn.getY(k), -bn.getZ(k));
    parts.push(front, back);
  }
  const eye = plain(new THREE.SphereGeometry(0.007, 6, 3, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.6, 1));
  // The eye darker than the petals (the instance color is the petals').
  const ec = eye.attributes.color;
  for (let i = 0; i < ec.count; i++) ec.setXYZ(i, 0.35, 0.25, 0.08);
  parts.push(eye);
  return mergeGeometries(parts);
}

/** A spray of leaves, painted: dozens of small leaves round a few twigs, thicker in the middle, ragged at the edge. Grey, for tinting. */
function sprayTexture() {
  const S = 256;
  const [c, g] = canvas(S, S);
  const r = rng(4242);
  g.clearRect(0, 0, S, S);
  g.lineCap = 'round';
  // Twigs out from the middle.
  g.strokeStyle = 'rgba(70,58,44,1)';
  for (let k = 0; k < 5; k++) {
    const a = r() * Math.PI * 2;
    g.lineWidth = 2.5;
    g.beginPath();
    g.moveTo(S / 2, S / 2);
    g.quadraticCurveTo(S / 2 + Math.cos(a + 0.4) * 40, S / 2 + Math.sin(a + 0.4) * 40, S / 2 + Math.cos(a) * 100, S / 2 + Math.sin(a) * 100);
    g.stroke();
  }
  // Leaves: the deep ones first and darkest, the outer ones last and lightest.
  const N = 420;
  for (let k = 0; k < N; k++) {
    const depth = k / N;
    const a = r() * Math.PI * 2;
    const d = Math.pow(r(), 0.75) * (S * 0.44) * (0.55 + depth * 0.45);
    const x = S / 2 + Math.cos(a) * d;
    const y = S / 2 + Math.sin(a) * d * 0.92;
    const len = 9 + r() * 9;
    const lum = 0.42 + depth * 0.45 + (r() - 0.5) * 0.2;
    const warm = (r() - 0.5) * 0.12;
    g.fillStyle = `rgb(${Math.round(255 * Math.min(1, lum * (1 + warm)))},${Math.round(255 * Math.min(1, lum))},${Math.round(255 * Math.min(1, lum * (0.85 - warm)))})`;
    g.save();
    g.translate(x, y);
    g.rotate(a + (r() - 0.5) * 1.6);
    g.beginPath();
    g.ellipse(0, 0, len * 0.5, len * 0.24, 0, 0, Math.PI * 2);
    g.fill();
    // The midrib catching the light.
    g.strokeStyle = `rgba(255,255,230,${0.12 + depth * 0.15})`;
    g.lineWidth = 0.8;
    g.beginPath();
    g.moveTo(-len * 0.4, 0);
    g.lineTo(len * 0.4, 0);
    g.stroke();
    g.restore();
  }
  const t = texture(c, { aniso: 4 });
  return t;
}

/**
 * The trees' sprays of leaves: cards with a painted cluster on them, cut out
 * where there's no leaf, lit as part of their crown (the middle and reach in
 * aCrown) so the whole tree has a sunny side, a shaded side and a dark heart.
 */
function leafCards(list: { m: THREE.Matrix4; color: THREE.Color; crown: THREE.Vector4 }[], u: DaylightUniforms) {
  const geo = new THREE.PlaneGeometry(1, 1);
  const mat = new THREE.ShaderMaterial({
    vertexShader: /* glsl */ `
      attribute vec4 aCrown;
      varying vec2 vUv;
      varying vec3 vWorld;
      varying vec3 vColor;
      varying vec4 vCrown;
      void main() {
        vec4 w = modelMatrix * instanceMatrix * vec4(position, 1.0);
        vUv = uv;
        vWorld = w.xyz;
        vColor = instanceColor;
        vCrown = aCrown;
        gl_Position = projectionMatrix * viewMatrix * w;
      }
    `,
    fragmentShader: /* glsl */ `
      ${DAYLIGHT}
      uniform sampler2D uLeaves;
      varying vec2 vUv;
      varying vec3 vWorld;
      varying vec3 vColor;
      varying vec4 vCrown;
      void main() {
        vec4 leaf = texture2D(uLeaves, vUv);
        if (leaf.a < 0.45) discard;
        vec3 toEye = cameraPosition - vWorld;
        float dist = length(toEye);
        vec3 v = toEye / max(dist, 1e-4);
        vec3 fromMid = vWorld - vCrown.xyz;
        float reach = length(fromMid);
        vec3 n = reach > 1e-4 ? fromMid / reach : vec3(0.0, 1.0, 0.0);
        // Deeper in, darker: the leaves round the outside shade the ones inside.
        float heart = mix(0.3, 1.0, smoothstep(0.3, 1.0, reach / max(vCrown.w, 1e-3)));
        vec3 albedo = vColor * leaf.rgb;
        float lit = max(dot(n, uSunDir), 0.0);
        vec3 amb = mix(uGround, uSky, n.y * 0.5 + 0.5) * vec3(0.8, 0.88, 0.8);
        vec3 col = albedo * (amb * heart + uSunColor * lit * mix(1.0, heart, 0.6));
        col += uSunColor * albedo * pow(1.0 - max(dot(n, v), 0.0), 2.0) * lit * 0.8;
        // The sun through the leaves, from behind.
        col += uSunColor * albedo * vec3(0.95, 1.0, 0.45) * pow(max(dot(-v, uSunDir), 0.0), 4.0) * 0.6 * heart;
        gl_FragColor = vec4(fade(col, vWorld), 1.0);
      }
    `,
    uniforms: { ...u, uLeaves: { value: sprayTexture() } },
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.InstancedMesh(geo, mat, list.length);
  const crowns = new Float32Array(list.length * 4);
  list.forEach((b, i) => {
    mesh.setMatrixAt(i, b.m);
    mesh.setColorAt(i, b.color);
    b.crown.toArray(crowns, i * 4);
  });
  geo.setAttribute('aCrown', new THREE.InstancedBufferAttribute(crowns, 4));
  mesh.frustumCulled = false;
  return mesh;
}
