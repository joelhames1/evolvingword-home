// The peak at night: a snowy summit with the observatory on top, two smaller
// domes on the shoulders below, rocks breaking through the snow, the mountain
// falling away into a sea of cloud, and far-off snow peaks standing out of it,
// lit only by the sky. Somewhere under the clouds a town makes a faint glow.
import * as THREE from 'three';
import { rng } from '../../textures';
import type { Quality } from '../../world';
import { DAYLIGHT, daylightUniforms, outdoor, pointLights, type DaylightUniforms } from '../outdoor';
import { dir } from './sky';

/** The middle of the observatory, on the summit. */
export const CENTER = new THREE.Vector3(0, 0, 1.95);
/** The sea of cloud lies this far below the observatory floor. */
export const CLOUDS = -720;
/** The town under the clouds, as a direction. */
export const CITY = dir(232, 0).setY(0).normalize();

// --- the shape of the land -----------------------------------------------------------
// A little seeded value noise, so the mountain is the same on every visit.
const perm = (() => {
  const r = rng(4242);
  return Array.from({ length: 512 }, () => r());
})();
const lattice = (x: number, y: number) => perm[((x * 73856093) ^ (y * 19349663)) & 511];
function noise2(x: number, y: number) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const a = lattice(ix, iy);
  const b = lattice(ix + 1, iy);
  const c = lattice(ix, iy + 1);
  const d = lattice(ix + 1, iy + 1);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}
const fbm2 = (x: number, y: number, n = 5) => {
  let v = 0;
  let a = 0.5;
  for (let i = 0; i < n; i++) {
    v += a * noise2(x, y);
    x = x * 2.03 + 17.1;
    y = y * 2.03 + 5.7;
    a *= 0.5;
  }
  return v;
};
/** Sharp-crested noise, for ridges and arêtes. */
const ridged = (x: number, y: number, n = 5) => {
  let v = 0;
  let a = 0.5;
  for (let i = 0; i < n; i++) {
    v += a * (1 - Math.abs(noise2(x, y) * 2 - 1)) ** 2;
    x = x * 2.1 + 3.3;
    y = y * 2.1 + 9.1;
    a *= 0.5;
  }
  return v;
};

/** The ground's height at a point, relative to the observatory floor. */
export function height(x: number, z: number) {
  const dx = x - CENTER.x;
  const dz = z - CENTER.z;
  const r = Math.hypot(dx, dz);
  const a = Math.atan2(dx, -dz);
  // The summit: a small level pad of trodden snow round the building, then the
  // mountain rolling over and falling away, slower down its ridges.
  const ridges = Math.pow(Math.max(Math.cos(a * 3 + 0.6), 0), 3) * 0.5 + Math.pow(Math.max(Math.cos(a * 2 - 1.9), 0), 4) * 0.35;
  const pad = -0.35 + (fbm2(x * 0.15, z * 0.15, 3) - 0.5) * 0.25;
  let h = pad;
  if (r > 6.5) {
    const k = r - 6.5;
    const shoulder = k < 22 ? 0.011 * k * k : 5.3 + (k - 22) * 0.6;
    h -= shoulder * (1 - 0.42 * ridges) * (0.85 + 0.3 * fbm2(x * 0.004, z * 0.004, 3));
    h += (fbm2(x * 0.03, z * 0.03, 4) - 0.5) * Math.min(r * 0.12, 26);
  }
  // Far off, a ring of other peaks standing out of the clouds, none quite as high
  // as this one; the biggest of them off to the south, beyond the desk.
  if (r > 1300) {
    const ring = THREE.MathUtils.smoothstep(r, 1300, 2000) * (1 - THREE.MathUtils.smoothstep(r, 2950, 3250));
    const range = ridged(x * 0.0021, z * 0.0021, 5);
    const big = Math.pow(fbm2(x * 0.0009 + 4, z * 0.0009, 3), 2.2) * 2.2;
    const south = Math.exp(-(((a + 0.08) / 0.55) ** 2)) * Math.exp(-(((r - 2450) / 420) ** 2));
    const peaks = CLOUDS - 180 + ring * (range * (560 + south * 420) + big * 620 + south * 260);
    h = Math.max(h, Math.min(peaks, -40 - (1 - range) * 120));
  }
  return h;
}

// --- the night light, for everything outside ---------------------------------------------
/** Starlight: no moon, so a little light from the whole sky and a touch more from the Milky Way's heart in the south. */
export function nightLight(): DaylightUniforms {
  return daylightUniforms({
    sunDir: dir(170, 62),
    sunColor: new THREE.Color(0.011, 0.0115, 0.015),
    sky: new THREE.Color(0.012, 0.015, 0.026),
    ground: new THREE.Color(0.004, 0.0045, 0.007),
    haze: new THREE.Color(0.016, 0.02, 0.03),
    hazeDensity: 0.0006,
    mist: 0,
    mistLevel: CLOUDS,
  });
}

const GROUND_VERT = /* glsl */ `
  varying vec3 vWorld;
  varying vec3 vNrm;
  void main() {
    vec4 w = modelMatrix * vec4(position, 1.0);
    vWorld = w.xyz;
    vNrm = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;
// Snow where it can lie, rock where it's too steep; faintly blue under the stars,
// warm where light from the dome's slit falls on it, red by the door.
const GROUND_FRAG = /* glsl */ `
  ${DAYLIGHT}
  uniform vec3 uSpill;
  uniform vec3 uSpillColor;
  uniform vec3 uLamp;
  uniform vec3 uLampColor;
  varying vec3 vWorld;
  varying vec3 vNrm;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5); }
  float noise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
  void main() {
    vec3 n = normalize(vNrm);
    float d = length(vWorld.xz);
    // Detail that suits the distance: drifts close by, streaks of rock far off.
    float nn = noise(vWorld.xz * 0.6) * 0.5 + noise(vWorld.xz * 0.07) * 0.5;
    float far = noise(vWorld.xz * 0.012) * 0.6 + noise(vWorld.xz * 0.05) * 0.4;
    float detail = mix(nn, far, smoothstep(60.0, 400.0, d));
    float snow = smoothstep(0.42, 0.7, n.y + (detail - 0.5) * 0.5);
    // Wind ripples in the snow close by: long low ridges, lit on one side.
    vec2 q = vWorld.xz * vec2(1.6, 0.45) + noise(vWorld.xz * 0.3) * 2.5;
    float ripple = sin(q.x + sin(q.y) * 0.8) * 0.5 + 0.5;
    n = normalize(n + vec3(0.18, 0.0, 0.06) * (ripple - 0.5) * snow * (1.0 - smoothstep(10.0, 60.0, d)));
    vec3 rock = vec3(0.05, 0.047, 0.045) * (0.7 + 0.6 * detail);
    vec3 white = vec3(0.66, 0.71, 0.82) * (0.85 + 0.15 * detail);
    vec3 albedo = mix(rock, white, snow);
    vec3 col = daylight(albedo, n, vWorld);
    // Light from the slit, and the door's red lamp: points, falling off with distance.
    vec3 toS = uSpill - vWorld;
    float ds = length(toS);
    col += albedo * uSpillColor * max(dot(n, toS / ds), 0.0) / (1.0 + ds * ds * 0.06);
    vec3 toL = uLamp - vWorld;
    float dl = length(toL);
    col += albedo * uLampColor * max(dot(n, toL / dl), 0.0) / (1.0 + dl * dl * 0.5);
    // A glint off the snow now and then, like frost.
    float spark = step(0.9965, hash(floor(vWorld.xz * 9.0))) * snow * (1.0 - smoothstep(4.0, 30.0, d));
    col += vec3(0.25, 0.3, 0.4) * spark * 0.12;
    gl_FragColor = vec4(fade(col, vWorld), 1.0);
  }
`;

const CLOUD_FRAG = /* glsl */ `
  ${DAYLIGHT}
  uniform vec3 uCity;
  varying vec3 vWorld;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5); }
  float noise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
  float fbm(vec2 p) { float v = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { v += a * noise(p); p = p * 2.02 + 3.1; a *= 0.5; } return v; }
  void main() {
    vec2 p = vWorld.xz * 0.0022;
    vec2 drift = vec2(uTime * 0.004, uTime * 0.0015);
    vec2 warp = vec2(fbm(p * 0.7 + drift), fbm(p * 0.7 + 5.2 - drift));
    float c = fbm(p * 1.3 + warp * 1.6 + drift * 2.0);
    // Billows: tops catch the starlight, the hollows between stay dark.
    float tops = smoothstep(0.3, 0.75, c);
    vec3 col = mix(vec3(0.006, 0.008, 0.013), vec3(0.03, 0.036, 0.05), tops);
    // The town, glowing up through the cloud from underneath.
    vec2 dir = normalize(vWorld.xz + 1e-3);
    float toward = pow(max(dot(dir, uCity.xz), 0.0), 14.0);
    float far = smoothstep(800.0, 2600.0, length(vWorld.xz));
    col += vec3(0.05, 0.026, 0.01) * toward * far * (0.4 + 0.8 * (1.0 - tops));
    gl_FragColor = vec4(fade(col, vWorld), 1.0);
  }
`;

export interface Peak {
  group: THREE.Group;
  /** The starlight, for anything else outside. */
  night: DaylightUniforms;
  /** Where the light through the slit comes from (moves as the dome turns). */
  spill: THREE.Vector3;
  /** The red lamp over the observatory's door. */
  lamp: THREE.Vector3;
  tick(t: number, camera: THREE.PerspectiveCamera, renderer: THREE.WebGLRenderer): void;
}

export function buildPeak(quality: Quality): Peak {
  const group = new THREE.Group();
  const night = nightLight();
  const r = rng(808);

  // --- the ground: one polar grid, fine near the top, coarse out at the far peaks -----
  const rings = quality === 'high' ? 170 : 110;
  const segs = quality === 'high' ? 288 : 168;
  const inner = 0.4;
  const outer = 3300;
  const positions: number[] = [];
  const index: number[] = [];
  for (let i = 0; i < rings; i++) {
    const rad = inner * Math.pow(outer / inner, i / (rings - 1));
    for (let j = 0; j <= segs; j++) {
      const a = (j / segs) * Math.PI * 2;
      const x = CENTER.x + Math.sin(a) * rad;
      const z = CENTER.z - Math.cos(a) * rad;
      positions.push(x, height(x, z), z);
    }
  }
  for (let i = 0; i < rings - 1; i++)
    for (let j = 0; j < segs; j++) {
      const a = i * (segs + 1) + j;
      const b = a + segs + 1;
      index.push(a, a + 1, b, a + 1, b + 1, b);
    }
  const groundGeo = new THREE.BufferGeometry();
  groundGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  groundGeo.setIndex(index);
  groundGeo.computeVertexNormals();
  const spill = new THREE.Vector3(0, 2.5, CENTER.z - 4.8);
  const lamp = new THREE.Vector3(0, -50, 0);
  const groundUniforms = {
    ...night,
    uSpill: { value: spill },
    uSpillColor: { value: new THREE.Color(1.6, 0.95, 0.5) },
    uLamp: { value: lamp },
    uLampColor: { value: new THREE.Color(1.4, 0.05, 0.03) },
  };
  const ground = new THREE.Mesh(groundGeo, new THREE.ShaderMaterial({ vertexShader: GROUND_VERT, fragmentShader: GROUND_FRAG, uniforms: groundUniforms }));
  ground.frustumCulled = false;
  group.add(ground);

  // --- the sea of cloud ----------------------------------------------------------------
  const sea = new THREE.Mesh(
    new THREE.CircleGeometry(outer, 96),
    new THREE.ShaderMaterial({ vertexShader: GROUND_VERT, fragmentShader: CLOUD_FRAG, uniforms: { ...night, uCity: { value: CITY } } }),
  );
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(CENTER.x, CLOUDS, CENTER.z);
  group.add(sea);

  // --- rocks through the snow, snow lying on their tops ----------------------------------
  const rockGeo = new THREE.IcosahedronGeometry(1, 3);
  const rp = rockGeo.attributes.position;
  const rockColors: number[] = [];
  for (let i = 0; i < rp.count; i++) {
    const v = new THREE.Vector3().fromBufferAttribute(rp, i);
    v.multiplyScalar(0.8 + noise2(v.x * 1.5 + 9, v.z * 1.5 + v.y) * 0.35 + noise2(v.x * 5, v.y * 5 + v.z) * 0.08);
    v.y *= 0.62;
    rp.setXYZ(i, v.x, v.y, v.z);
  }
  rockGeo.computeVertexNormals();
  const rn = rockGeo.attributes.normal;
  for (let i = 0; i < rn.count; i++) {
    const snowy = THREE.MathUtils.smoothstep(rn.getY(i), 0.55, 0.85);
    const c = new THREE.Color(0.07, 0.065, 0.06).lerp(new THREE.Color(0.75, 0.8, 0.88), snowy);
    rockColors.push(c.r, c.g, c.b);
  }
  rockGeo.setAttribute('color', new THREE.Float32BufferAttribute(rockColors, 3));
  const rockCount = quality === 'high' ? 46 : 24;
  const rocks = new THREE.InstancedMesh(rockGeo, outdoor(night, { vertexColors: true }), rockCount);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  for (let i = 0; i < rockCount; i++) {
    // Not on the pad, and not in the way of the view in.
    let x = 0;
    let z = 0;
    let rad = 0;
    do {
      const a = r() * Math.PI * 2;
      rad = 24 + Math.pow(r(), 1.2) * 80;
      x = CENTER.x + Math.sin(a) * rad;
      z = CENTER.z - Math.cos(a) * rad;
    } while (x > -6 && x < 14 && z > 6 && z < 36);
    const s = (0.4 + r() * 1.4) * (1 + rad / 60);
    q.setFromEuler(new THREE.Euler(r() * 0.4, r() * 6.28, r() * 0.4));
    m.compose(new THREE.Vector3(x, height(x, z) + s * 0.1, z), q, new THREE.Vector3(s, s * (0.6 + r() * 0.6), s * (0.8 + r() * 0.4)));
    rocks.setMatrixAt(i, m);
  }
  group.add(rocks);

  // --- the neighbors: two smaller domes lower down, shut tight ---------------------------
  const white = outdoor(night, { color: '#d8dde6' });
  const seam = outdoor(night, { color: '#8e96a4' });
  const lights: { pos: THREE.Vector3; color: THREE.Color; size?: number; blink?: number; phase?: number; duty?: number }[] = [];
  const red = new THREE.Color(3, 0.12, 0.08);
  for (const [x, z, size, turn] of [
    [-31, 27, 2.4, 0.7],
    [52, -46, 1.7, 2.3],
  ] as const) {
    const y = height(x, z);
    const d = new THREE.Group();
    d.position.set(x, y, z);
    d.rotation.y = turn;
    const drum = new THREE.Mesh(new THREE.CylinderGeometry(size, size, size * 1.1, 40), white);
    drum.position.y = size * 0.45;
    d.add(drum);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(size * 0.98, 40, 16, 0, Math.PI * 2, 0, Math.PI / 2), white);
    cap.position.y = size;
    d.add(cap);
    // The closed slit: a raised band up over the top.
    const band = new THREE.Mesh(new THREE.TorusGeometry(size, size * 0.06, 6, 30, Math.PI), seam);
    band.position.y = size;
    band.scale.set(1, 1, 3);
    d.add(band);
    group.add(d);
    lights.push({ pos: new THREE.Vector3(x + Math.sin(turn) * size * 1.02, y + size * 0.6, z + Math.cos(turn) * size * 1.02), color: red, size: 0.5 });
  }
  // A radio mast down the ridge, its beacon blinking slow, and a far observatory's lamp on another summit.
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.14, 14, 6), seam);
  const mastAt = new THREE.Vector3(-70, 0, -40);
  mastAt.y = height(mastAt.x, mastAt.z) + 7;
  mast.position.copy(mastAt);
  group.add(mast);
  lights.push({ pos: mastAt.clone().setY(mastAt.y + 7.2), color: new THREE.Color(4, 0.15, 0.08), size: 0.9, blink: 2.4, phase: 0.2, duty: 0.4 });
  const farSummit = new THREE.Vector3(-1500, 0, -2100);
  for (let k = 0; k < 3; k++) {
    const p = farSummit.clone().add(new THREE.Vector3(k * 30, 0, k * 12));
    p.y = height(p.x, p.z) + 6;
    lights.push({ pos: p, color: new THREE.Color(2.5, 0.2, 0.1), size: 7 });
  }
  // Small red lamps along the path up to the door, so nobody needs a torch.
  for (let k = 0; k < 8; k++) {
    const az = 170 - k * 0.8 + Math.sin(k * 0.9) * 2.5;
    const rad = 6.4 + k * 3.1;
    const p = new THREE.Vector3(CENTER.x + Math.sin(az * THREE.MathUtils.DEG2RAD) * rad, 0, CENTER.z - Math.cos(az * THREE.MathUtils.DEG2RAD) * rad);
    p.y = height(p.x, p.z) + 0.22;
    lights.push({ pos: p, color: new THREE.Color(2.4, 0.1, 0.06), size: 0.16 });
  }
  const glows = pointLights(lights, night);
  group.add(glows);

  return {
    group,
    night,
    spill,
    lamp,
    tick(t, camera, renderer) {
      night.uTime.value = t;
      glows.fit(camera, renderer);
    },
  };
}
