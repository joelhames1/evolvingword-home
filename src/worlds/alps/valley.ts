// The view from the window: a lake in an alpine valley at dusk. Snow peaks hold
// the last pink light while the valley goes blue, the lake mirrors everything,
// a village glows on the far shore, a little red train runs along the water and
// a gondola climbs the mountain. All of it generated here, nothing downloaded.
import * as THREE from 'three';
import { glow, rng } from '../../textures';
import type { Quality } from '../../world';

export const LAKE_Y = -12;
const LAKE_NEAR = -55;
const LAKE_FAR = -900;
/** Half the lake's width at a distance down the valley. */
const lakeHalf = (z: number) => 150 + THREE.MathUtils.clamp(-z - 60, 0, 840) * 0.42;

export interface Alps {
  group: THREE.Group;
  /** The light the sky throws through the window right now. */
  skyLight: THREE.Color;
  tick(t: number, dt: number, camera: THREE.Camera): void;
}

// ---------------------------------------------------------------------------------
// Terrain heights: gentle forested hills by the lake, a range of snow peaks at the
// end of the valley and one proud pyramid of a mountain in the middle of it.

function perlin(seed: number) {
  const r = rng(seed);
  const p = Array.from({ length: 256 }, (_, i) => i);
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [p[i], p[j]] = [p[j], p[i]];
  }
  const perm = new Uint8Array(512);
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  const grad = (h: number, x: number, y: number) => {
    const g = h & 7;
    const u = g < 4 ? x : y;
    const v = g < 4 ? y : x;
    return (g & 1 ? -u : u) + (g & 2 ? -2 * v : 2 * v);
  };
  const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
  return (x: number, y: number) => {
    const fx = Math.floor(x);
    const fy = Math.floor(y);
    const X = fx & 255;
    const Y = fy & 255;
    x -= fx;
    y -= fy;
    const u = fade(x);
    const v = fade(y);
    const a = perm[X] + Y;
    const b = perm[X + 1] + Y;
    const l1 = grad(perm[a], x, y) + (grad(perm[b], x - 1, y) - grad(perm[a], x, y)) * u;
    const l2 = grad(perm[a + 1], x, y - 1) + (grad(perm[b + 1], x - 1, y - 1) - grad(perm[a + 1], x, y - 1)) * u;
    return (l1 + (l2 - l1) * v) * 0.35;
  };
}

const noise = perlin(1987);
const fbm = (x: number, z: number, oct = 5) => {
  let s = 0;
  let a = 0.5;
  let f = 1;
  for (let i = 0; i < oct; i++) {
    s += a * noise(x * f, z * f);
    f *= 2.03;
    a *= 0.5;
  }
  return s;
};
const ridged = (x: number, z: number, oct = 6) => {
  let s = 0;
  let a = 0.55;
  let f = 1;
  let prev = 1;
  for (let i = 0; i < oct; i++) {
    let n = 1 - Math.abs(noise(x * f + i * 17.3, z * f - i * 9.1) * 1.6);
    n *= n;
    s += n * a * prev;
    prev = n;
    f *= 2.1;
    a *= 0.5;
  }
  return s;
};
const smooth = (a: number, b: number, x: number) => {
  const t = THREE.MathUtils.clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

/** Ground height at a point, in meters (the room's floor is at 0). */
export function heightAt(x: number, z: number): number {
  const half = lakeHalf(z);
  // How far outside the water this point is (negative: under it).
  const outside = Math.max(Math.abs(x) - half, (LAKE_FAR - z) * 1.1, (z - LAKE_NEAR) * 1.6);
  const hills = (55 + 85 * (fbm(x / 300, z / 300) + 0.5)) * smooth(-10, 260, outside);
  const dist = Math.hypot(x * 0.8, z);
  const range = smooth(820, 1350, dist) * smooth(0, 220, outside) * (26 + 215 * Math.pow(ridged(x / 380, z / 380), 1.4));
  // The hero peak, a crooked pyramid at the head of the valley.
  const px = x + 140;
  const pz = z + 1420;
  const c = Math.cos(0.5);
  const s = Math.sin(0.5);
  const rx = px * c - pz * s;
  const rz = px * s + pz * c;
  const pyr = Math.max(0, 1 - (Math.abs(rx) / 260 + Math.abs(rz) / 300 + Math.max(0, rx) * 0.0006));
  const peak = 265 * Math.pow(pyr, 1.5) * (0.94 + 0.12 * ridged(x / 120, z / 120, 4));
  let h = LAKE_Y + 0.4 + hills + Math.max(range, peak) + 6 * fbm(x / 60, z / 60, 3) * smooth(0, 60, outside);
  if (outside < 0) h = LAKE_Y - 3 + outside * 0.08;
  // Our own shore: the slope down from the chalet, kept below the floor.
  if (z > LAKE_NEAR - 20 && Math.abs(x) < 220) {
    const k = smooth(220, 140, Math.abs(x));
    const slope = LAKE_Y + (z - LAKE_NEAR) * 0.2 + 2 * fbm(x / 30, z / 30, 3);
    h = THREE.MathUtils.lerp(h, Math.min(slope, -2.5), k * smooth(LAKE_NEAR - 20, LAKE_NEAR + 5, z));
  }
  return h;
}

// ---------------------------------------------------------------------------------
// Shaders. Everything outside lights itself (the room's lamps would otherwise
// shine straight through the walls onto the mountains) and fades into the same
// haze as the sky.

const SHARED = /* glsl */ `
  uniform vec3 uSunDir;
  uniform vec3 uSunColor;
  uniform vec3 uSkyColor;
  uniform vec3 uShadowColor;
  uniform vec3 uHaze;
  uniform vec3 uHazeLow;
  uniform float uHazeDensity;
  uniform float uGlowLevel;
  uniform float uMirror;
  uniform float uTime;
  vec3 shade(vec3 albedo, vec3 n, float y, vec3 world) {
    float diff = max(dot(n, uSunDir), 0.0);
    // Only the heights still catch the sun; the valley is in the earth's shadow.
    float lit = smoothstep(uGlowLevel - 45.0, uGlowLevel + 45.0, y);
    vec3 amb = mix(uShadowColor, uSkyColor, n.y * 0.5 + 0.5);
    vec3 col = albedo * (amb + uSunColor * diff * lit);
    float d = length(world - cameraPosition);
    float fog = 1.0 - exp(-d * uHazeDensity);
    // Haze is dark and blue down by the water, rosier up high.
    vec3 haze = mix(uHazeLow, uHaze, smoothstep(${LAKE_Y.toFixed(1)} + 20.0, ${LAKE_Y.toFixed(1)} + 260.0, y));
    col = mix(col, haze, fog);
    // In the lake: a little darker and bluer than the real thing.
    if (uMirror > 0.5) col *= vec3(0.55, 0.62, 0.78);
    return col;
  }
`;

const TERRAIN_VERT = /* glsl */ `
  attribute vec3 color;
  varying vec3 vObj;
  varying vec3 vNrm;
  varying vec3 vColor;
  varying vec3 vWorld;
  void main() {
    vObj = position;
    vNrm = normal;
    vColor = color;
    vec4 w = modelMatrix * vec4(position, 1.0);
    vWorld = w.xyz;
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;
const TERRAIN_FRAG = /* glsl */ `
  ${SHARED}
  varying vec3 vObj;
  varying vec3 vNrm;
  varying vec3 vColor;
  varying vec3 vWorld;
  void main() {
    // Nothing under the water is drawn, and nothing under it is reflected either.
    if (vObj.y < ${LAKE_Y.toFixed(1)} - 0.5) discard;
    gl_FragColor = vec4(shade(vColor, normalize(vNrm), vObj.y, vWorld), 1.0);
  }
`;

const TREE_VERT = /* glsl */ `
  varying vec3 vNrm;
  varying vec3 vObjWorld;
  varying vec3 vWorld;
  varying float vSnow;
  void main() {
    vec4 local = instanceMatrix * vec4(position, 1.0);
    vObjWorld = local.xyz;
    vNrm = normalize(mat3(instanceMatrix) * normal);
    vSnow = smoothstep(0.55, 1.0, position.y) * step(0.0, normal.y);
    vec4 w = modelMatrix * local;
    vWorld = w.xyz;
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;
const TREE_FRAG = /* glsl */ `
  ${SHARED}
  varying vec3 vNrm;
  varying vec3 vObjWorld;
  varying vec3 vWorld;
  varying float vSnow;
  void main() {
    vec3 albedo = mix(vec3(0.018, 0.04, 0.026), vec3(0.75, 0.78, 0.85), vSnow * 0.55);
    gl_FragColor = vec4(shade(albedo, normalize(vNrm), vObjWorld.y, vWorld), 1.0);
  }
`;

const SKY_VERT = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = position;
    vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    gl_Position = vec4(p.xy, p.w * 0.99999, p.w);
  }
`;
// Blue hour: the earth's shadow low on the horizon, the pink Belt of Venus above
// it, deepening blue overhead, stars coming out and a thin moon.
const SKY_FRAG = /* glsl */ `
  varying vec3 vDir;
  uniform float uTime;
  uniform vec3 uZenith;
  uniform vec3 uHigh;
  uniform vec3 uBelt;
  uniform vec3 uShadowBand;
  uniform vec3 uMoonDir;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5); }
  float noise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
  float fbm(vec2 p) { float v = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; } return v; }
  void main() {
    vec3 d = normalize(vDir);
    bool below = d.y < 0.0;
    // Below the horizon is the lake's reflection of the sky.
    if (below) d.y = -d.y;
    float e = d.y;
    vec3 col = mix(uShadowBand, uBelt, smoothstep(0.0, 0.07, e));
    col = mix(col, uHigh, smoothstep(0.08, 0.32, e));
    col = mix(col, uZenith, smoothstep(0.32, 0.9, e));
    // A few long clouds catching the light.
    vec2 cuv = d.xz / (e + 0.08) * 0.9 + vec2(uTime * 0.004, 0.0);
    float c = smoothstep(0.52, 0.8, fbm(cuv * vec2(0.6, 2.2)));
    vec3 cloud = mix(uBelt * 1.25, uHigh * 0.7, smoothstep(0.05, 0.3, e));
    col = mix(col, cloud, c * smoothstep(0.02, 0.08, e) * (1.0 - smoothstep(0.3, 0.6, e)) * 0.75);
    // Stars, brighter the higher and darker the sky.
    vec2 g = d.xz / (e + 0.6) * 220.0;
    vec2 cell = floor(g);
    float h = hash(cell);
    vec2 pos = fract(g) - 0.5 - (vec2(hash(cell + 3.1), hash(cell + 7.7)) - 0.5) * 0.6;
    float star = step(0.985, h) * smoothstep(0.08, 0.0, length(pos)) * (0.6 + 0.4 * sin(uTime * (1.0 + h * 3.0) + h * 40.0));
    col += vec3(0.9, 0.92, 1.0) * star * smoothstep(0.12, 0.45, e) * (1.0 - c);
    // A thin moon.
    float m = dot(d, normalize(uMoonDir));
    float disc = smoothstep(0.99975, 0.99985, m);
    vec3 shifted = normalize(uMoonDir + vec3(0.006, 0.004, 0.0));
    float bite = smoothstep(0.99975, 0.99985, dot(d, shifted));
    col += vec3(1.0, 0.95, 0.85) * max(disc - bite, 0.0) * 3.0;
    col += vec3(0.5, 0.45, 0.4) * pow(max(m, 0.0), 2000.0) * 0.4;
    if (below) col *= vec3(0.5, 0.58, 0.75);
    gl_FragColor = vec4(col, 1.0);
  }
`;

const WATER_VERT = /* glsl */ `
  varying vec3 vWorld;
  void main() {
    vec4 w = modelMatrix * vec4(position, 1.0);
    vWorld = w.xyz;
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;
// The water itself: see-through at a glance (so the mirrored world shows), darker
// looking down into it, with long ripples drifting across.
const WATER_FRAG = /* glsl */ `
  varying vec3 vWorld;
  uniform float uTime;
  uniform vec3 uDeep;
  uniform vec3 uSheen;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5); }
  float noise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
  void main() {
    vec3 v = normalize(cameraPosition - vWorld);
    float fres = 0.04 + 0.96 * pow(1.0 - max(v.y, 0.0), 5.0);
    float dist = length(cameraPosition - vWorld);
    vec2 p = vWorld.xz * vec2(0.012, 0.09) + vec2(uTime * 0.02, uTime * 0.05);
    float rip = noise(p) * 0.6 + noise(p * 2.7 + 3.0) * 0.4;
    float streak = smoothstep(0.62, 0.9, rip) * (1.0 - smoothstep(150.0, 900.0, dist));
    float a = clamp((1.0 - fres) * 0.9 + 0.12 + (rip - 0.5) * 0.18, 0.0, 1.0);
    vec3 col = uDeep + uSheen * streak * 0.6;
    gl_FragColor = vec4(col, a);
  }
`;

const SNOW_VERT = /* glsl */ `
  attribute vec3 aOffset;
  attribute float aSpeed;
  uniform float uTime;
  uniform vec3 uBox;
  uniform vec3 uBoxMin;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    vec3 o = aOffset;
    o.y = uBoxMin.y + mod(o.y - uBoxMin.y - uTime * aSpeed, uBox.y);
    o.x += sin(uTime * 0.6 + aOffset.z * 3.0) * 0.35;
    o.z += cos(uTime * 0.5 + aOffset.x * 2.0) * 0.25;
    vec4 mv = modelViewMatrix * vec4(o, 1.0);
    mv.xy += position.xy;
    gl_Position = projectionMatrix * mv;
  }
`;
const SNOW_FRAG = /* glsl */ `
  varying vec2 vUv;
  void main() {
    float a = smoothstep(0.5, 0.1, length(vUv - 0.5));
    gl_FragColor = vec4(vec3(0.85, 0.88, 1.0), a * 0.8);
  }
`;

// ---------------------------------------------------------------------------------

export function buildAlps(quality: Quality): Alps {
  const group = new THREE.Group();
  const r = rng(31);
  const c = (hex: string) => new THREE.Color(hex);

  const lightU = {
    uSunDir: { value: new THREE.Vector3(1, 0.2, 0.35).normalize() },
    uSunColor: { value: c('#ff9d86').multiplyScalar(1.7) },
    uSkyColor: { value: c('#3a4483') },
    uShadowColor: { value: c('#1d1f44') },
    uHaze: { value: c('#9a86b4') },
    uHazeLow: { value: c('#2c3160') },
    uHazeDensity: { value: 1 / 3600 },
    uGlowLevel: { value: LAKE_Y + 150 },
    uTime: { value: 0 },
  };
  const material = (vertexShader: string, fragmentShader: string, mirror: boolean) =>
    new THREE.ShaderMaterial({ vertexShader, fragmentShader, uniforms: { ...lightU, uMirror: { value: mirror ? 1 : 0 } } });

  // Sky.
  const skyU = {
    uTime: lightU.uTime,
    uZenith: { value: c('#0b1031') },
    uHigh: { value: c('#2a3474') },
    uBelt: { value: c('#e79aa6') },
    uShadowBand: { value: c('#5f6496') },
    uMoonDir: { value: new THREE.Vector3(-0.42, 0.24, -1).normalize() },
  };
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(2600, 48, 24),
    new THREE.ShaderMaterial({ vertexShader: SKY_VERT, fragmentShader: SKY_FRAG, uniforms: skyU, side: THREE.BackSide, depthWrite: false }),
  );
  sky.renderOrder = -10;
  sky.frustumCulled = false;
  group.add(sky);

  // Terrain: one height field, finer near the shore than at the far end.
  const cols = quality === 'high' ? 380 : 240;
  const rows = quality === 'high' ? 240 : 150;
  const xs = (i: number) => -1900 + (3800 * i) / cols;
  const zs = (j: number) => -6 - 1950 * Math.pow(j / rows, 1.65);
  const positions = new Float32Array((cols + 1) * (rows + 1) * 3);
  for (let j = 0; j <= rows; j++)
    for (let i = 0; i <= cols; i++) {
      const k = (j * (cols + 1) + i) * 3;
      const x = xs(i);
      const z = zs(j);
      positions[k] = x;
      positions[k + 1] = heightAt(x, z);
      positions[k + 2] = z;
    }
  const index: number[] = [];
  for (let j = 0; j < rows; j++)
    for (let i = 0; i < cols; i++) {
      const a = j * (cols + 1) + i;
      const b = a + 1;
      const d = a + cols + 1;
      const e = d + 1;
      index.push(a, b, d, b, e, d);
    }
  const terrainGeo = new THREE.BufferGeometry();
  terrainGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  terrainGeo.setIndex(index);
  terrainGeo.computeVertexNormals();
  // Paint it: forest low, rock on the steeps, snow up high.
  const normals = terrainGeo.attributes.normal;
  const colors = new Float32Array(positions.length);
  const snow = c('#eef1fa');
  const rockA = c('#6d6670');
  const rockB = c('#4a4550');
  const forest = c('#14281d');
  const meadow = c('#3b4a2c');
  const shore = c('#5a5546');
  const tmp = new THREE.Color();
  for (let v = 0; v < positions.length / 3; v++) {
    const x = positions[v * 3];
    const y = positions[v * 3 + 1];
    const z = positions[v * 3 + 2];
    const rel = y - LAKE_Y;
    const steep = 1 - normals.getY(v);
    const n = fbm(x / 80, z / 80, 3);
    tmp.copy(rockA).lerp(rockB, THREE.MathUtils.clamp(0.5 + n * 2, 0, 1));
    const treeLine = 105 + 30 * n;
    const forestK = smooth(treeLine + 15, treeLine - 15, rel) * smooth(0.62, 0.42, steep);
    tmp.lerp(forest.clone().lerp(meadow, THREE.MathUtils.clamp(0.4 + n * 3, 0, 0.6)), forestK);
    const snowLine = 120 + 30 * fbm(x / 150, z / 150, 3);
    const snowK = smooth(snowLine - 20, snowLine + 25, rel) * smooth(0.62, 0.42, steep);
    tmp.lerp(snow, snowK);
    // A dusting on the high forest.
    tmp.lerp(snow, smooth(treeLine - 25, treeLine + 5, rel) * forestK * 0.25);
    tmp.lerp(shore, smooth(4, 0.5, rel));
    colors[v * 3] = tmp.r;
    colors[v * 3 + 1] = tmp.g;
    colors[v * 3 + 2] = tmp.b;
  }
  terrainGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const terrain = new THREE.Mesh(terrainGeo, material(TERRAIN_VERT, TERRAIN_FRAG, false));
  terrain.frustumCulled = false;
  group.add(terrain);

  // Pines on the lower slopes.
  const treeGeo = (() => {
    const parts: THREE.BufferGeometry[] = [0, 1, 2].map((i) => {
      const g = new THREE.ConeGeometry(0.42 - i * 0.1, 0.5, 7, 1, true);
      g.translate(0, 0.3 + i * 0.24, 0);
      return g;
    });
    const trunk = new THREE.CylinderGeometry(0.04, 0.05, 0.2, 5);
    trunk.translate(0, 0.08, 0);
    parts.push(trunk);
    const pos: number[] = [];
    const nrm: number[] = [];
    for (const p of parts) {
      const g = p.toNonIndexed();
      pos.push(...(g.attributes.position.array as Float32Array));
      nrm.push(...(g.attributes.normal.array as Float32Array));
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
    return g;
  })();
  const treeCount = quality === 'high' ? 9000 : 4500;
  const trees = new THREE.InstancedMesh(treeGeo, material(TREE_VERT, TREE_FRAG, false), treeCount);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  let placed = 0;
  for (let tries = 0; placed < treeCount && tries < treeCount * 12; tries++) {
    const x = (r() - 0.5) * 1500;
    const z = -40 - Math.pow(r(), 1.5) * 950;
    const y = heightAt(x, z);
    const rel = y - LAKE_Y;
    if (rel < 1.5 || rel > 100 + 25 * fbm(x / 80, z / 80, 3)) continue;
    const slope = Math.abs(heightAt(x + 4, z) - y) + Math.abs(heightAt(x, z + 4) - y);
    if (slope > 5) continue;
    // Clumps rather than an even carpet.
    if (fbm(x / 90, z / 90, 3) < -0.12 && r() < 0.85) continue;
    if (Math.abs(x) < 26 && z > -70) continue; // keep the dock clear
    const s = 5 + r() * 7;
    m.compose(new THREE.Vector3(x, y - 0.5, z), q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), r() * 6), new THREE.Vector3(s * (0.8 + r() * 0.3), s, s * (0.8 + r() * 0.3)));
    trees.setMatrixAt(placed++, m);
  }
  trees.count = placed;
  trees.frustumCulled = false;
  group.add(trees);

  // The village on the far shore: chalets with lit windows, a church, a pier.
  const village = new THREE.Group();
  const lights: THREE.Vector3[] = [];
  const houseMat = new THREE.MeshBasicMaterial({ color: '#141017' });
  const roofMat = new THREE.MeshBasicMaterial({ color: '#2c2a38' });
  for (let i = 0; i < 22; i++) {
    const z = -430 - r() * 160;
    const shoreX = lakeHalf(z);
    const x = shoreX + 6 + r() * 70;
    const y = heightAt(x, z);
    if (y - LAKE_Y > 40) continue;
    const w = 7 + r() * 6;
    const h = 5 + r() * 4;
    const house = new THREE.Mesh(new THREE.BoxGeometry(w, h, w * 0.8), houseMat);
    house.position.set(x, y + h / 2, z);
    house.rotation.y = r() * 0.6 - 0.3;
    village.add(house);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(w * 0.78, 3.2, 4, 1), roofMat);
    roof.position.set(x, y + h + 1.5, z);
    roof.rotation.y = Math.PI / 4 + house.rotation.y;
    roof.scale.z = 0.8;
    village.add(roof);
    for (let k = 0; k < 1 + Math.floor(r() * 3); k++) if (r() < 0.8) lights.push(new THREE.Vector3(x - w / 2 + 1.5 + r() * (w - 3), y + 1.4 + (k % 2) * 2.2, z + w * 0.42));
  }
  {
    const z = -505;
    const x = lakeHalf(z) + 30;
    const y = heightAt(x, z);
    const nave = new THREE.Mesh(new THREE.BoxGeometry(10, 8, 18), houseMat);
    nave.position.set(x, y + 4, z);
    village.add(nave);
    const tower = new THREE.Mesh(new THREE.BoxGeometry(5, 22, 5), houseMat);
    tower.position.set(x, y + 11, z + 10);
    village.add(tower);
    const spire = new THREE.Mesh(new THREE.ConeGeometry(3.8, 12, 4), roofMat);
    spire.position.set(x, y + 28, z + 10);
    spire.rotation.y = Math.PI / 4;
    village.add(spire);
    lights.push(new THREE.Vector3(x, y + 18, z + 12.6));
  }
  // Street lamps along the promenade.
  for (let z = -420; z > -610; z -= 14) lights.push(new THREE.Vector3(lakeHalf(z) + 3, LAKE_Y + 3, z));
  group.add(village);

  const warmGlow = glow('rgba(255,190,110,1)', 64);
  const lightPos: number[] = [];
  for (const p of lights) lightPos.push(p.x, p.y, p.z);
  const lampGeo = new THREE.BufferGeometry();
  lampGeo.setAttribute('position', new THREE.Float32BufferAttribute(lightPos, 3));
  const lamps = new THREE.Points(lampGeo, new THREE.PointsMaterial({ color: new THREE.Color(2.4, 1.6, 0.8), size: 6, map: warmGlow, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  group.add(lamps);
  // Their reflections: long wobbly streaks down the water.
  const streakTex = (() => {
    const cv = document.createElement('canvas');
    cv.width = 32;
    cv.height = 256;
    const g = cv.getContext('2d')!;
    for (let y = 0; y < 256; y += 3) {
      const a = (1 - y / 256) * (0.5 + Math.random() * 0.5);
      const w = 6 + Math.random() * 14;
      g.fillStyle = `rgba(255,200,130,${a})`;
      g.fillRect(16 - w / 2, y, w, 2);
    }
    const t = new THREE.CanvasTexture(cv);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();
  const streakMat = new THREE.SpriteMaterial({ map: streakTex, color: new THREE.Color(1.3, 0.95, 0.6), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.55 });
  for (const p of lights) {
    if (p.y - LAKE_Y > 12) continue;
    const s = new THREE.Sprite(streakMat);
    s.center.set(0.5, 1);
    s.position.set(p.x, LAKE_Y + 0.2, p.z);
    s.scale.set(4, 26 + (p.y - LAKE_Y) * 4, 1);
    group.add(s);
  }

  // A little red train along the far end of the lake.
  const railZ = LAKE_FAR + 22;
  const train = new THREE.Group();
  const [tc, tg] = (() => {
    const cv = document.createElement('canvas');
    cv.width = 256;
    cv.height = 32;
    return [cv, cv.getContext('2d')!] as const;
  })();
  tg.fillStyle = '#9a1b1b';
  tg.fillRect(0, 0, 256, 32);
  for (let i = 0; i < 10; i++) {
    tg.fillStyle = '#ffd99a';
    tg.fillRect(10 + i * 24, 9, 16, 10);
  }
  const trainTex = new THREE.CanvasTexture(tc);
  trainTex.colorSpace = THREE.SRGBColorSpace;
  const trainMat = new THREE.MeshBasicMaterial({ map: trainTex, color: new THREE.Color(1.6, 1.4, 1.2) });
  for (let i = 0; i < 4; i++) {
    const car = new THREE.Mesh(new THREE.BoxGeometry(22, 3.6, 3.4), trainMat);
    car.position.x = -i * 23.5;
    train.add(car);
  }
  const head = new THREE.Sprite(new THREE.SpriteMaterial({ map: warmGlow, color: new THREE.Color(3, 2.6, 2), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  head.position.set(12, 0, 1.8);
  head.scale.setScalar(9);
  train.add(head);
  train.position.set(-900, LAKE_Y + 4.5, railZ);
  group.add(train);
  const trainMirror = train.clone();
  trainMirror.scale.y = -1;
  group.add(trainMirror);
  let trainStart = 8;

  // A gondola climbing from the village to a ridge.
  const cableFrom = new THREE.Vector3(lakeHalf(-560) + 50, heightAt(lakeHalf(-560) + 50, -560) + 12, -560);
  const cableTo = new THREE.Vector3(720, heightAt(720, -820) + 14, -820);
  const cable = new THREE.Line(new THREE.BufferGeometry().setFromPoints([cableFrom, cableTo]), new THREE.LineBasicMaterial({ color: '#3a3646', transparent: true, opacity: 0.8 }));
  group.add(cable);
  const cabin = new THREE.Group();
  const cabinBox = new THREE.Mesh(new THREE.BoxGeometry(5, 4, 4), new THREE.MeshBasicMaterial({ color: '#c0392b' }));
  cabin.add(cabinBox);
  const cabinLight = new THREE.Sprite(new THREE.SpriteMaterial({ map: warmGlow, color: new THREE.Color(2.4, 2, 1.4), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  cabinLight.scale.setScalar(8);
  cabin.add(cabinLight);
  group.add(cabin);

  // A rowing boat with a lantern, drifting.
  const boat = new THREE.Group();
  const hull = new THREE.Mesh(new THREE.BoxGeometry(4.5, 0.8, 1.6), new THREE.MeshBasicMaterial({ color: '#1a1412' }));
  boat.add(hull);
  const lantern = new THREE.Sprite(new THREE.SpriteMaterial({ map: warmGlow, color: new THREE.Color(3, 2.2, 1.2), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  lantern.position.set(1.4, 1.6, 0);
  lantern.scale.setScalar(5);
  boat.add(lantern);
  const boatStreak = new THREE.Sprite(streakMat);
  boatStreak.center.set(0.5, 1);
  boatStreak.scale.set(2.5, 16, 1);
  boatStreak.position.set(1.4, -0.4, 0);
  boat.add(boatStreak);
  boat.position.set(-60, LAKE_Y + 0.3, -230);
  group.add(boat);

  // Our dock below the window, with its own lamp.
  const dockMat = new THREE.MeshBasicMaterial({ color: '#1a1512' });
  const dock = new THREE.Mesh(new THREE.BoxGeometry(3, 0.4, 26), dockMat);
  dock.position.set(8, LAKE_Y + 0.9, LAKE_NEAR - 8);
  group.add(dock);
  for (let k = 0; k < 6; k++) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.3, 3, 0.3), dockMat);
    post.position.set(8 + (k % 2 ? 1.3 : -1.3), LAKE_Y, LAKE_NEAR - 8 - 12 + Math.floor(k / 2) * 12);
    group.add(post);
  }
  const dockLamp = new THREE.Sprite(new THREE.SpriteMaterial({ map: warmGlow, color: new THREE.Color(3, 2.2, 1.3), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  dockLamp.position.set(9.3, LAKE_Y + 4, LAKE_NEAR - 20);
  dockLamp.scale.setScalar(4);
  group.add(dockLamp);
  const dockStreak = new THREE.Sprite(streakMat);
  dockStreak.center.set(0.5, 1);
  dockStreak.position.set(9.3, LAKE_Y + 0.2, LAKE_NEAR - 20);
  dockStreak.scale.set(1.6, 18, 1);
  group.add(dockStreak);

  // Everything above the water, mirrored below it. The lake on top lets it show.
  const mirror = new THREE.Group();
  mirror.scale.y = -1;
  mirror.position.y = LAKE_Y * 2;
  const terrainM = new THREE.Mesh(terrainGeo, material(TERRAIN_VERT, TERRAIN_FRAG, true));
  terrainM.frustumCulled = false;
  const treesM = new THREE.InstancedMesh(treeGeo, material(TREE_VERT, TREE_FRAG, true), placed);
  treesM.instanceMatrix = trees.instanceMatrix;
  treesM.count = placed;
  treesM.frustumCulled = false;
  const villageM = village.clone();
  mirror.add(terrainM, treesM, villageM);
  group.add(mirror);

  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(5000, 3000),
    new THREE.ShaderMaterial({
      vertexShader: WATER_VERT,
      fragmentShader: WATER_FRAG,
      uniforms: { uTime: lightU.uTime, uDeep: { value: c('#0b1426') }, uSheen: { value: c('#8b86b8') } },
      transparent: true,
      depthWrite: false,
    }),
  );
  water.rotation.x = -Math.PI / 2;
  water.position.set(0, LAKE_Y, -1400);
  water.renderOrder = 1;
  group.add(water);

  // Snow drifting past the window.
  const flakes = quality === 'high' ? 900 : 450;
  const snowGeo = new THREE.InstancedBufferGeometry();
  snowGeo.copy(new THREE.PlaneGeometry(0.05, 0.05) as unknown as THREE.InstancedBufferGeometry);
  snowGeo.instanceCount = flakes;
  const off = new Float32Array(flakes * 3);
  const spd = new Float32Array(flakes);
  const boxMin = new THREE.Vector3(-14, -6, -26);
  const boxSize = new THREE.Vector3(28, 16, 23.4);
  for (let i = 0; i < flakes; i++) {
    off[i * 3] = boxMin.x + r() * boxSize.x;
    off[i * 3 + 1] = boxMin.y + r() * boxSize.y;
    off[i * 3 + 2] = boxMin.z + r() * boxSize.z;
    spd[i] = 0.5 + r() * 0.6;
  }
  snowGeo.setAttribute('aOffset', new THREE.InstancedBufferAttribute(off, 3));
  snowGeo.setAttribute('aSpeed', new THREE.InstancedBufferAttribute(spd, 1));
  const snowMat = new THREE.ShaderMaterial({
    vertexShader: SNOW_VERT,
    fragmentShader: SNOW_FRAG,
    uniforms: { uTime: lightU.uTime, uBox: { value: boxSize }, uBoxMin: { value: boxMin } },
    transparent: true,
    depthWrite: false,
  });
  const snowfall = new THREE.Mesh(snowGeo, snowMat);
  snowfall.frustumCulled = false;
  group.add(snowfall);

  const skyLight = c('#8c8fd0');
  const coolLight = c('#7d86d8');
  const pinkLight = c('#d99ab8');

  return {
    group,
    skyLight,
    tick(t, dt, camera) {
      lightU.uTime.value = t;
      sky.position.copy(camera.position);
      // The light slides slowly up the peaks and back, a long sunset.
      const glowK = 0.5 + 0.5 * Math.sin(t * 0.018);
      lightU.uGlowLevel.value = LAKE_Y + 95 + glowK * 80;
      skyLight.copy(coolLight).lerp(pinkLight, (1 - glowK) * 0.5);
      // The train: along the far shore every minute or so.
      const tt = t - trainStart;
      if (tt > 0) {
        const x = -900 + tt * 22;
        train.position.x = x;
        trainMirror.position.set(x, LAKE_Y * 2 - train.position.y, railZ);
        if (x > 900) trainStart = t + 30 + Math.random() * 40;
      }
      // The gondola goes up, pauses, comes down.
      const g = (t * 0.012) % 2;
      const k = g < 1 ? g : 2 - g;
      cabin.position.lerpVectors(cableFrom, cableTo, THREE.MathUtils.smoothstep(k, 0, 1)).add(new THREE.Vector3(0, -3.5, 0));
      // The boat drifts back and forth across the lake.
      boat.position.x = -80 + Math.sin(t * 0.01) * 70;
      boat.position.y = LAKE_Y + 0.3 + Math.sin(t * 1.3) * 0.08;
      boat.rotation.z = Math.sin(t * 0.9) * 0.03;
      streakMat.opacity = 0.5 + Math.sin(t * 1.7) * 0.05;
      void dt;
    },
  };
}
