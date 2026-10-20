// Outside the cell: a walled garden on a terrace, cloister arcades down either
// side, olive trees and cypresses, a stone fountain, sparrows on the parapet and
// in the gravel, swallows wheeling below. Past the parapet the hill falls away to
// the valley in its afternoon haze, the bell tower and the church a little way
// down the slope, far hills layered blue beyond, and a pale moon already up.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { ROOM } from '../../layout';
import { canvas, rng, texture } from '../../textures';
import type { Quality } from '../../world';
import { DAYLIGHT, daylightUniforms, outdoor, type DaylightUniforms } from '../outdoor';
import { SUN, stone, T } from './room';

/** The parapet at the end of the garden, where the hill drops away. */
export const PARAPET_Z = -14.6;
/** The garden lies a few steps down from the cell's floor, so you look out over the parapet. */
export const GY = -1.4;
const VALLEY_Y = -170;
const GARDEN_Z0 = ROOM.z0 - T;

export interface Valley {
  group: THREE.Group;
  daylight: DaylightUniforms;
  tick(t: number, dt: number, camera: THREE.Camera): void;
  debug: Record<string, unknown>;
}

// --- the land ---------------------------------------------------------------------

function hash(x: number, z: number) {
  const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
  return s - Math.floor(s);
}
function noise(x: number, z: number) {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fz = z - iz;
  const ux = fx * fx * (3 - 2 * fx);
  const uz = fz * fz * (3 - 2 * fz);
  const a = hash(ix, iz);
  const b = hash(ix + 1, iz);
  const c = hash(ix, iz + 1);
  const d = hash(ix + 1, iz + 1);
  return a + (b - a) * ux + (c - a) * uz + (a - b - c + d) * ux * uz;
}
function fbm(x: number, z: number, oct = 4) {
  let v = 0;
  let a = 0.5;
  for (let i = 0; i < oct; i++) {
    v += a * noise(x, z);
    x *= 2.03;
    z *= 2.03;
    a *= 0.5;
  }
  return v;
}
const smooth = (a: number, b: number, x: number) => {
  const t = THREE.MathUtils.clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

/**
 * The ground: the garden terrace flat at the floor, the mountain rising behind,
 * the hillside below the parapet falling to the valley, and hills across it.
 */
export function heightAt(x: number, z: number): number {
  // The town and the hill run along the slope either side of us, a little lower.
  const along = -Math.max(0, Math.abs(x) - 40) * 0.06;
  if (z > PARAPET_Z) {
    // The mountain rising behind the house; the garden in front of it flat, a little lower.
    const behind = Math.max(0, z - 26) * 0.24 + smooth(26, 120, z) * fbm(x / 60, z / 60) * 10;
    return behind + GY * (1 - smooth(GARDEN_Z0 - 0.5, GARDEN_Z0 + 1.5, z)) + along * smooth(-2, -6, z);
  }
  // Below the parapet: a short drop, then the long olive slope down to the plain.
  const d = PARAPET_Z - z;
  const slope = GY - 3.5 + (VALLEY_Y - GY + 3.5) * Math.pow(smooth(0, 520, d), 0.85) + fbm(x / 90, z / 90) * 14 * smooth(0, 60, d) * (1 - smooth(300, 520, d));
  let h = Math.max(slope, VALLEY_Y) + along;
  // The plain: nearly flat, with the odd low rise.
  h += smooth(500, 900, d) * (fbm(x / 400, z / 400) - 0.5) * 18;
  // Hills across the valley, ridge behind ridge.
  const far = smooth(4500, 9000, d);
  h += far * (220 + 260 * fbm(x / 1400, z / 1400, 5) + 120 * Math.sin(x / 1900));
  return h;
}

const TERRAIN_VERT = /* glsl */ `
  attribute vec3 color;
  varying vec3 vWorld;
  varying vec3 vNrm;
  varying vec3 vColor;
  void main() {
    vColor = color;
    vNrm = normal;
    vec4 w = modelMatrix * vec4(position, 1.0);
    vWorld = w.xyz;
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;
// Paints the land as it goes: garden grass, olive groves in terraced rows down the
// slope, a patchwork of fields on the plain with hedgerows between, woods on the hills.
const TERRAIN_FRAG = /* glsl */ `
  ${DAYLIGHT}
  varying vec3 vWorld;
  varying vec3 vNrm;
  varying vec3 vColor;
  float h2(vec2 p) { return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5); }
  float n2(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(h2(i), h2(i + vec2(1, 0)), f.x), mix(h2(i + vec2(0, 1)), h2(i + vec2(1, 1)), f.x), f.y); }
  void main() {
    vec2 p = vWorld.xz;
    float n = n2(p * 0.05) * 0.5 + n2(p * 0.3) * 0.3 + n2(p * 2.0) * 0.2;
    vec3 col = vColor * (0.85 + 0.3 * n);
    float y = vWorld.y;
    // The olive slope: rows of round gray-green trees on their terraces.
    float slope = smoothstep(-2.0, -10.0, y) * smoothstep(${(VALLEY_Y + 4).toFixed(1)}, ${(VALLEY_Y + 25).toFixed(1)}, y);
    vec2 cell = p / vec2(7.0, 6.0);
    vec2 f = fract(cell) - 0.5;
    float tree = smoothstep(0.32, 0.18, length(f + (vec2(h2(floor(cell)), h2(floor(cell) + 2.0)) - 0.5) * 0.25)) * step(0.25, h2(floor(cell) + 7.0));
    col = mix(col, vec3(0.3, 0.34, 0.24), tree * slope * 0.85);
    // The plain: fields, each its own crop, hedges along the edges.
    float plain = smoothstep(${(VALLEY_Y + 20).toFixed(1)}, ${(VALLEY_Y + 6).toFixed(1)}, y) * (1.0 - smoothstep(-5500.0, -7000.0, vWorld.z));
    vec2 fc = p / vec2(220.0, 150.0) + vec2(n2(p * 0.003) * 0.6, 0.0);
    vec2 fid = floor(fc);
    float pick = h2(fid);
    vec3 crop = pick < 0.25 ? vec3(0.42, 0.48, 0.2) : pick < 0.45 ? vec3(0.72, 0.6, 0.3) : pick < 0.6 ? vec3(0.55, 0.42, 0.26) : pick < 0.8 ? vec3(0.34, 0.42, 0.2) : vec3(0.62, 0.58, 0.38);
    vec2 ff = abs(fract(fc) - 0.5);
    float hedge = smoothstep(0.47, 0.495, max(ff.x, ff.y));
    crop = mix(crop * (0.9 + 0.2 * n), vec3(0.2, 0.26, 0.14), hedge * 0.8);
    col = mix(col, crop, plain);
    vec3 c2 = daylight(col, normalize(vNrm), vWorld);
    gl_FragColor = vec4(fade(c2, vWorld), 1.0);
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
// A soft afternoon sky: pale and warm at the horizon, clear blue overhead, a few
// high wisps, and the moon already up over the valley, pale in the daylight.
const SKY_FRAG = /* glsl */ `
  varying vec3 vDir;
  uniform vec3 uSunDir;
  uniform vec3 uHaze;
  uniform vec3 uMoonDir;
  uniform float uTime;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5); }
  float noise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
  float fbm(vec2 p) { float v = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; } return v; }
  void main() {
    vec3 d = normalize(vDir);
    float e = max(d.y, -0.1);
    vec3 col = mix(uHaze, vec3(0.5, 0.64, 0.86), smoothstep(0.0, 0.25, e));
    col = mix(col, vec3(0.24, 0.42, 0.78), smoothstep(0.25, 0.9, e));
    float s = max(dot(d, uSunDir), 0.0);
    col += vec3(1.0, 0.9, 0.7) * pow(s, 8.0) * 0.35;
    vec2 cuv = d.xz / (e + 0.15) * 0.8 + vec2(uTime * 0.002, 0.0);
    float c = smoothstep(0.58, 0.85, fbm(cuv * vec2(0.7, 1.8)));
    col = mix(col, vec3(0.96, 0.94, 0.92), c * smoothstep(0.02, 0.12, e) * 0.55);
    // Sister Moon: a waxing gibbous, chalky against the blue.
    vec3 m = normalize(uMoonDir);
    float md = dot(d, m);
    float disc = smoothstep(0.99988, 0.99993, md);
    vec3 side = normalize(cross(m, vec3(0.0, 1.0, 0.0)));
    vec3 lit = normalize(m + side * 0.012);
    float shade = smoothstep(0.99982, 0.99992, dot(d, lit));
    vec2 q = vec2(dot(d, side), d.y - m.y) * 900.0;
    float maria = smoothstep(0.55, 0.75, noise(q * 0.9 + 3.0)) * 0.25;
    col = mix(col, vec3(0.93, 0.94, 0.96) * (1.0 - maria), disc * (0.35 + 0.5 * shade));
    gl_FragColor = vec4(col, 1.0);
  }
`;

const WATER_VERT = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vWorld;
  void main() {
    vUv = uv;
    vec4 w = modelMatrix * vec4(position, 1.0);
    vWorld = w.xyz;
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;
// Water in the basin: the sky in it, darker looking down, rings spreading from
// where the spout falls.
const WATER_FRAG = /* glsl */ `
  uniform float uTime;
  uniform vec2 uDrop;
  varying vec2 vUv;
  varying vec3 vWorld;
  void main() {
    vec2 p = vUv - 0.5;
    float r = length(p - uDrop);
    float rings = sin(r * 90.0 - uTime * 6.0) * exp(-r * 6.0);
    vec3 v = normalize(cameraPosition - vWorld);
    float fres = pow(1.0 - max(v.y, 0.0), 3.0);
    vec3 col = mix(vec3(0.07, 0.1, 0.1), vec3(0.62, 0.72, 0.86), 0.25 + fres * 0.7);
    col += vec3(0.5, 0.55, 0.6) * max(rings, 0.0) * 0.35;
    gl_FragColor = vec4(col, 1.0);
  }
`;

const BIRD_VERT = /* glsl */ `
  uniform float uTime;
  attribute float aPhase;
  varying float vShade;
  void main() {
    vec3 p = position;
    // Wings beat: the tips (|x| large) swing up and down.
    float beat = sin(uTime * 14.0 + aPhase * 6.28);
    p.y += abs(p.x) * beat * 0.9;
    vShade = 0.7 + 0.3 * beat;
    vec4 w = modelMatrix * instanceMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;
const BIRD_FRAG = /* glsl */ `
  varying float vShade;
  void main() { gl_FragColor = vec4(vec3(0.11, 0.1, 0.12) * vShade, 1.0); }
`;

/** A wall of round arches on a low base: n bays along `length`, `height` tall. */
function arcade(length: number, height: number, n: number, depth: number) {
  const shape = new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(length, 0), new THREE.Vector2(length, height), new THREE.Vector2(0, height)]);
  const bay = length / n;
  const pier = 0.36;
  for (let i = 0; i < n; i++) {
    const a = i * bay + pier / 2;
    const b = (i + 1) * bay - pier / 2;
    const r = (b - a) / 2;
    const spring = height - 0.5 - r;
    const p = new THREE.Path();
    p.moveTo(a, 0.5);
    p.lineTo(b, 0.5);
    p.lineTo(b, spring);
    p.absarc((a + b) / 2, spring, r, 0, Math.PI, false);
    p.lineTo(a, 0.5);
    shape.holes.push(p);
  }
  return new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 16 });
}

/** A flat roof plane `width` across by `length` along, centered at `at`, its width running along `across` and its length along `along`. */
function slab(width: number, length: number, at: THREE.Vector3, across: THREE.Vector3, along: THREE.Vector3, mat: THREE.Material) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(width, length), mat);
  const xa = across.clone().normalize();
  const ya = along.clone().normalize();
  m.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(xa, ya, xa.clone().cross(ya)));
  m.position.copy(at);
  return m;
}

/** A terracotta roof tile texture, rows of curved coppi. */
function tiles(seed: number) {
  const [c, g] = canvas(256, 256);
  const r = rng(seed);
  g.fillStyle = '#8f4528';
  g.fillRect(0, 0, 256, 256);
  for (let x = 0; x < 256; x += 16)
    for (let y = -24; y < 256; y += 24) {
      const col = new THREE.Color(['#b5603d', '#a9522f', '#c27048', '#9c4a2c'][Math.floor(r() * 4)]);
      g.fillStyle = `#${col.getHexString()}`;
      g.fillRect(x + 1, y + ((x / 16) % 2) * 12, 14, 23);
      g.fillStyle = 'rgba(0,0,0,0.22)';
      g.fillRect(x, y + ((x / 16) % 2) * 12, 2, 23);
    }
  return texture(c);
}

export function buildValley(quality: Quality): Valley {
  const group = new THREE.Group();
  const r = rng(1226);
  const c = (hex: string) => new THREE.Color(hex);
  const u = daylightUniforms({
    sunDir: SUN,
    sunColor: c('#fff0d6').multiplyScalar(1.75),
    sky: c('#9fb2d4'),
    ground: c('#8a6e55'),
    haze: c('#dcd5cb'),
    hazeDensity: 1 / 7500,
    mist: 0.22,
    mistLevel: VALLEY_Y,
  });

  const moonDir = new THREE.Vector3(-0.42, 0.36, -1).normalize();
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(5000, 48, 24),
    new THREE.ShaderMaterial({ vertexShader: SKY_VERT, fragmentShader: SKY_FRAG, uniforms: { uSunDir: u.uSunDir, uHaze: u.uHaze, uTime: u.uTime, uMoonDir: { value: moonDir } }, side: THREE.BackSide, depthWrite: false }),
  );
  sky.renderOrder = -10;
  sky.frustumCulled = false;
  group.add(sky);

  // The land: one height field, fine near the house and coarse out across the valley.
  const cols = quality === 'high' ? 260 : 170;
  const rows = quality === 'high' ? 220 : 140;
  const xs = (i: number) => {
    const k = (i / cols) * 2 - 1;
    return Math.sign(k) * 9000 * Math.pow(Math.abs(k), 2.2);
  };
  const zs = (j: number) => 160 - 12000 * Math.pow(j / rows, 2.3);
  const positions = new Float32Array((cols + 1) * (rows + 1) * 3);
  const colors = new Float32Array(positions.length);
  const tmp = new THREE.Color();
  const garden = c('#6a7a3e');
  const meadow = c('#8f8a52');
  const dry = c('#a8945e');
  const woods = c('#46553a');
  for (let j = 0; j <= rows; j++)
    for (let i = 0; i <= cols; i++) {
      const k = (j * (cols + 1) + i) * 3;
      const x = xs(i);
      const z = zs(j);
      const y = heightAt(x, z);
      positions[k] = x;
      positions[k + 1] = y;
      positions[k + 2] = z;
      // Base colors; the shader paints the groves and fields over them.
      if (z > PARAPET_Z && z < 26 && Math.abs(x) < 40) tmp.copy(garden);
      else if (z > PARAPET_Z) tmp.copy(meadow).lerp(woods, smooth(60, 300, z) * 0.6);
      else tmp.copy(dry).lerp(woods, smooth(3500, 7000, PARAPET_Z - z) * 0.85);
      tmp.toArray(colors, k);
    }
  const index: number[] = [];
  for (let j = 0; j < rows; j++)
    for (let i = 0; i < cols; i++) {
      const a = j * (cols + 1) + i;
      index.push(a, a + 1, a + cols + 1, a + 1, a + cols + 2, a + cols + 1);
    }
  const terrainGeo = new THREE.BufferGeometry();
  terrainGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  terrainGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  terrainGeo.setIndex(index);
  terrainGeo.computeVertexNormals();
  const terrain = new THREE.Mesh(terrainGeo, new THREE.ShaderMaterial({ vertexShader: TERRAIN_VERT, fragmentShader: TERRAIN_FRAG, uniforms: u }));
  terrain.frustumCulled = false;
  group.add(terrain);

  // --- the garden -------------------------------------------------------------------
  const stoneTex = stone(29);
  stoneTex.wrapS = stoneTex.wrapT = THREE.RepeatWrapping;
  stoneTex.repeat.set(0.5, 0.5);
  const stoneMat = outdoor(u, { map: stoneTex, color: '#f6e8dc', side: THREE.DoubleSide });
  const plainStone = outdoor(u, { color: '#e9d6c6' });
  const tileTex = tiles(5);
  tileTex.wrapS = tileTex.wrapT = THREE.RepeatWrapping;

  // The garden ground itself: grass in its beds, and gravel paths out to the parapet and across.
  const [gc, gg] = canvas(256, 256);
  gg.fillStyle = '#d6c8ae';
  gg.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 4000; i++) {
    gg.fillStyle = `rgba(${r() < 0.5 ? '255,250,240' : '110,90,70'},${r() * 0.3})`;
    gg.fillRect(r() * 256, r() * 256, 2, 2);
  }
  const gravelTex = texture(gc);
  gravelTex.wrapS = gravelTex.wrapT = THREE.RepeatWrapping;
  const gravel = outdoor(u, { map: gravelTex });
  const path = (x0: number, x1: number, z0: number, z1: number) => {
    const geo = new THREE.PlaneGeometry(x1 - x0, z0 - z1);
    const uv = geo.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * (x1 - x0)) / 1.5, (uv.getY(i) * (z0 - z1)) / 1.5);
    const m = new THREE.Mesh(geo, gravel);
    m.rotation.x = -Math.PI / 2;
    m.position.set((x0 + x1) / 2, GY + 0.02, (z0 + z1) / 2);
    group.add(m);
  };
  path(-0.9, 0.9, GARDEN_Z0, PARAPET_Z + 0.2);
  path(-6.3, 6.3, -8, -9.6);
  // The parapet, with a coping to lean on (and for the sparrows to sit on).
  const parapet = new THREE.Mesh(new THREE.BoxGeometry(32, 0.9, 0.45), stoneMat);
  parapet.position.set(0, GY + 0.45, PARAPET_Z);
  group.add(parapet);
  const coping = new THREE.Mesh(new THREE.BoxGeometry(32.2, 0.08, 0.58), plainStone);
  coping.position.set(0, GY + 0.94, PARAPET_Z);
  group.add(coping);
  // A retaining wall down from the parapet to the slope.
  const retain = new THREE.Mesh(new THREE.BoxGeometry(32, 7, 0.6), stoneMat);
  retain.position.set(0, GY - 3.5, PARAPET_Z - 0.1);
  group.add(retain);

  // The cloister arcades down either side of the garden, each with its tiled walk behind.
  const arcLen = GARDEN_Z0 - (PARAPET_Z + 0.4);
  const arcH = 3.6;
  for (const sx of [-1, 1]) {
    const face = new THREE.Mesh(arcade(arcLen, arcH, 5, 0.4), stoneMat);
    face.rotation.y = -Math.PI / 2;
    face.position.set(sx < 0 ? -6.6 : 7.0, GY, PARAPET_Z + 0.4);
    group.add(face);
    const backWall = new THREE.Mesh(new THREE.BoxGeometry(0.5, 4.6, arcLen), stoneMat);
    backWall.position.set(sx * 9.8, GY + 2.3, PARAPET_Z + 0.4 + arcLen / 2);
    group.add(backWall);
    const rt = tileTex.clone();
    rt.repeat.set(arcLen / 2, 1.6);
    rt.needsUpdate = true;
    // A lean-to roof from the top of the arches up to the back wall.
    const run = 3.4;
    const rise = 1.05;
    const at = new THREE.Vector3(sx * (6.6 + run / 2), GY + arcH + rise / 2, PARAPET_Z + 0.4 + arcLen / 2);
    group.add(slab(Math.hypot(run, rise), arcLen + 0.4, at, new THREE.Vector3(sx * run, rise, 0), new THREE.Vector3(0, 0, 1), outdoor(u, { map: rt, side: THREE.DoubleSide })));
  }

  // The bell tower and the church, a little way down the hill to the right.
  const towerAt = new THREE.Vector3(15, 0, -42);
  towerAt.y = heightAt(towerAt.x, towerAt.z) - 1;
  const tw = 3.4;
  const shaftH = 15;
  const towerStone = outdoor(u, { map: stoneTex, color: '#f6e8dc' });
  const shaft = new THREE.Mesh(new THREE.BoxGeometry(tw, shaftH, tw), towerStone);
  shaft.position.copy(towerAt).add(new THREE.Vector3(0, shaftH / 2, 0));
  group.add(shaft);
  // The belfry: an open round arch on each face, the bell hanging inside.
  const belfryH = 3.6;
  const belfryGeo = (() => {
    const s = new THREE.Shape([new THREE.Vector2(-tw / 2, 0), new THREE.Vector2(tw / 2, 0), new THREE.Vector2(tw / 2, belfryH), new THREE.Vector2(-tw / 2, belfryH)]);
    s.holes.push(
      (() => {
        const p = new THREE.Path();
        p.moveTo(-0.95, 0.4);
        p.lineTo(0.95, 0.4);
        p.lineTo(0.95, 2.3);
        p.absarc(0, 2.3, 0.95, 0, Math.PI, false);
        p.lineTo(-0.95, 0.4);
        return p;
      })(),
    );
    return new THREE.ExtrudeGeometry(s, { depth: 0.35, bevelEnabled: false, curveSegments: 16 });
  })();
  for (let k = 0; k < 4; k++) {
    const face = new THREE.Mesh(belfryGeo, towerStone);
    face.position.copy(towerAt).add(new THREE.Vector3(0, shaftH, 0));
    face.rotation.y = (k * Math.PI) / 2;
    face.translateZ(tw / 2 - 0.35);
    group.add(face);
  }
  const bronze = outdoor(u, { color: '#6b5232' });
  const bellProfile = [
    [0.05, 0.9],
    [0.3, 0.85],
    [0.36, 0.6],
    [0.42, 0.25],
    [0.55, 0.0],
    [0.5, -0.03],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  const bell = new THREE.Mesh(new THREE.LatheGeometry(bellProfile, 20), bronze);
  const bellPivot = new THREE.Group();
  bellPivot.position.copy(towerAt).add(new THREE.Vector3(0, shaftH + 2.9, 0));
  bell.position.y = -0.95;
  bellPivot.add(bell);
  group.add(bellPivot);
  const cap = new THREE.Mesh(new THREE.BoxGeometry(tw + 0.3, 0.3, tw + 0.3), plainStone);
  cap.position.copy(towerAt).add(new THREE.Vector3(0, shaftH + belfryH + 0.15, 0));
  group.add(cap);
  const spire = new THREE.Mesh(new THREE.ConeGeometry((tw + 0.4) * 0.72, 2.2, 4, 1), outdoor(u, { map: tileTex }));
  spire.rotation.y = Math.PI / 4;
  spire.position.copy(towerAt).add(new THREE.Vector3(0, shaftH + belfryH + 1.4, 0));
  group.add(spire);
  // The church beside it: a plain nave with a tiled roof.
  const naveAt = towerAt.clone().add(new THREE.Vector3(9, 0, -6));
  const nave = new THREE.Mesh(new THREE.BoxGeometry(9, 10, 24), towerStone);
  nave.position.copy(naveAt).add(new THREE.Vector3(0, 4, 0));
  group.add(nave);
  const naveRoofTex = tileTex.clone();
  naveRoofTex.repeat.set(4, 6);
  naveRoofTex.needsUpdate = true;
  const naveRoofMat = outdoor(u, { map: naveRoofTex, side: THREE.DoubleSide });
  for (const sx of [-1, 1]) group.add(slab(5.9, 25, naveAt.clone().add(new THREE.Vector3(sx * 2.45, 10.5, 0)), new THREE.Vector3(sx * 4.9, -3.1, 0), new THREE.Vector3(0, 0, 1), naveRoofMat));
  const naveGable = new THREE.Mesh(new THREE.ShapeGeometry(new THREE.Shape([new THREE.Vector2(-4.5, 0), new THREE.Vector2(4.5, 0), new THREE.Vector2(0, 3)])), towerStone);
  naveGable.position.copy(naveAt).add(new THREE.Vector3(0, 9, 12.01));
  group.add(naveGable);

  // The town strung along the hill either side, and villages out on the plain and the far hills.
  const houseGeo = new THREE.BoxGeometry(1, 1, 1);
  houseGeo.translate(0, 0.5, 0);
  const roofGeo = new THREE.ConeGeometry(0.75, 0.35, 4, 1);
  roofGeo.rotateY(Math.PI / 4);
  roofGeo.translate(0, 1.17, 0);
  const houseCount = quality === 'high' ? 900 : 500;
  const houses = new THREE.InstancedMesh(houseGeo, outdoor(u, { color: '#ffffff' }), houseCount);
  const roofs = new THREE.InstancedMesh(roofGeo, outdoor(u, { color: '#ffffff' }), houseCount);
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  let built = 0;
  const place = (x: number, z: number, size: number, rot: number) => {
    if (built >= houseCount) return;
    const y = heightAt(x, z) - 0.5;
    const w = size * (0.8 + r() * 0.8);
    const d = size * (0.8 + r() * 0.6);
    const h = size * (0.7 + r() * 0.6);
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rot);
    m4.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(w, h, d));
    houses.setMatrixAt(built, m4);
    roofs.setMatrixAt(built, m4);
    houses.setColorAt(built, c(['#efd9c8', '#e6cdb9', '#f2e4d4', '#dcc0a9'][Math.floor(r() * 4)]));
    roofs.setColorAt(built, c(['#b4603e', '#a65638', '#c0714c'][Math.floor(r() * 3)]));
    built++;
  };
  // Along the hill: rows stepping down either side of the monastery.
  for (let i = 0; i < 260; i++) {
    const sx = r() < 0.5 ? -1 : 1;
    const x = sx * (30 + r() * 420);
    const z = PARAPET_Z - 25 - r() * 130 - Math.max(0, Math.abs(x) - 200) * 0.2;
    place(x, z, 5 + r() * 3, (r() - 0.5) * 0.3);
  }
  // Villages: tight clusters out on the plain and up on the far hills.
  const villages = Array.from({ length: 12 }, () => ({ x: -6000 + r() * 12000, z: -900 - r() * 8500 }));
  for (const v of villages)
    for (let i = 0; i < 45; i++) {
      const a = r() * Math.PI * 2;
      const d = Math.sqrt(r()) * (60 + Math.abs(v.z) * 0.02);
      place(v.x + Math.cos(a) * d, v.z + Math.sin(a) * d, 9 + r() * 5, r() * 3);
    }
  houses.count = built;
  roofs.count = built;
  group.add(houses, roofs);

  // Trees: olive trees in the garden and down the slope, cypresses standing guard.
  const oliveBlob = new THREE.IcosahedronGeometry(1, 1);
  const trunkGeo = new THREE.CylinderGeometry(0.12, 0.22, 1.8, 7, 4);
  {
    // Twist the trunks a little.
    const tp = trunkGeo.attributes.position;
    for (let i = 0; i < tp.count; i++) {
      const y = tp.getY(i);
      tp.setX(i, tp.getX(i) + Math.sin(y * 2.4) * 0.12);
      tp.setZ(i, tp.getZ(i) + Math.cos(y * 1.7) * 0.08);
    }
    trunkGeo.computeVertexNormals();
    trunkGeo.translate(0, 0.9, 0);
  }
  // In the garden they stand to the sides, framing the view, not in it.
  const olives: { x: number; z: number; s: number }[] = [
    { x: -4.9, z: -6.2, s: 0.8 },
    { x: 4.7, z: -6.8, s: 0.85 },
    { x: -5.3, z: -12, s: 0.75 },
    { x: 5.1, z: -12.3, s: 0.8 },
  ];
  for (let i = 0; i < (quality === 'high' ? 70 : 40); i++) {
    const x = -60 + r() * 120;
    const z = PARAPET_Z - 8 - r() * 160;
    if (Math.abs(x - towerAt.x) < 14 && Math.abs(z - towerAt.z) < 18) continue;
    olives.push({ x, z, s: 0.9 + r() * 0.5 });
  }
  const canopy = new THREE.InstancedMesh(oliveBlob, outdoor(u, { color: '#ffffff' }), olives.length * 5);
  const trunks = new THREE.InstancedMesh(trunkGeo, outdoor(u, { color: '#5b4a3b' }), olives.length);
  let blob = 0;
  olives.forEach((o, i) => {
    const y = heightAt(o.x, o.z);
    m4.compose(new THREE.Vector3(o.x, y, o.z), q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), r() * 6), new THREE.Vector3(o.s, o.s, o.s));
    trunks.setMatrixAt(i, m4);
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2 + r();
      const rad = k === 0 ? 0 : 0.9 * o.s;
      const size = (0.9 + r() * 0.5) * o.s;
      m4.compose(new THREE.Vector3(o.x + Math.cos(a) * rad, y + (1.9 + r() * 0.6) * o.s, o.z + Math.sin(a) * rad), q.identity(), new THREE.Vector3(size * 1.2, size * 0.75, size * 1.2));
      canopy.setMatrixAt(blob, m4);
      canopy.setColorAt(blob++, c(r() < 0.5 ? '#7c8a62' : '#909c78'));
    }
  });
  group.add(canopy, trunks);
  const cypressGeo = new THREE.LatheGeometry(
    [
      [0, 0],
      [0.5, 0.3],
      [0.75, 1.8],
      [0.7, 4.5],
      [0.45, 7],
      [0.15, 8.6],
      [0, 9],
    ].map(([x, y]) => new THREE.Vector2(x, y)),
    10,
  );
  const cypresses: [number, number, number][] = [
    [-15.2, PARAPET_Z + 0.8, 1.2],
    [15.2, PARAPET_Z + 0.8, 1.15],
    [-11.2, -3.5, 1.1],
    [11.4, -3.2, 1.0],
    [towerAt.x - 3.5, towerAt.z + 4, 1.3],
    [towerAt.x - 5.5, towerAt.z + 1, 1.05],
    [towerAt.x + 4, towerAt.z + 8, 1.2],
  ];
  for (let i = 0; i < 26; i++) cypresses.push([-140 + r() * 280, PARAPET_Z - 15 - r() * 220, 0.9 + r() * 0.6]);
  for (let i = 0; i < 18; i++) cypresses.push([-60 + r() * 120, 30 + r() * 80, 1 + r() * 0.5]);
  const cyp = new THREE.InstancedMesh(cypressGeo, outdoor(u, { color: '#ffffff' }), cypresses.length);
  cypresses.forEach(([x, z, s], i) => {
    m4.compose(new THREE.Vector3(x, heightAt(x, z) - 0.2, z), q.identity(), new THREE.Vector3(s, s * (0.9 + r() * 0.3), s));
    cyp.setMatrixAt(i, m4);
    cyp.setColorAt(i, c(r() < 0.5 ? '#2c3a22' : '#34432a'));
  });
  group.add(cyp);
  // Lavender and rosemary along the path.
  const herbGeo = new THREE.IcosahedronGeometry(0.17, 1);
  herbGeo.scale(1, 0.6, 1);
  const herbs = new THREE.InstancedMesh(herbGeo, outdoor(u, { color: '#ffffff' }), 44);
  for (let i = 0; i < 44; i++) {
    const side = i % 2 ? 1 : -1;
    const z = GARDEN_Z0 - 0.6 - Math.floor(i / 2) * 0.55;
    // A gap where the cross path runs.
    if (z < -7.6 && z > -10) {
      m4.makeScale(0, 0, 0);
    } else m4.compose(new THREE.Vector3(side * (1.15 + r() * 0.1), GY + 0.08, z), q.identity(), new THREE.Vector3(1, 1, 1));
    herbs.setMatrixAt(i, m4);
    herbs.setColorAt(i, c(i % 4 < 2 ? '#8b7aa6' : '#7d8a70'));
  }
  group.add(herbs);

  // The fountain: a round stone basin, a little bowl on a stem, water spilling.
  const fountainAt = new THREE.Vector3(-3.4, GY, -9.0);
  const basinGeo = new THREE.LatheGeometry(
    [
      [0.95, 0],
      [1.05, 0.05],
      [1.05, 0.55],
      [1.12, 0.6],
      [1.12, 0.66],
      [0.95, 0.66],
      [0.95, 0.12],
    ].map(([x, y]) => new THREE.Vector2(x, y)),
    40,
  );
  const fountainStone = outdoor(u, { map: stoneTex, color: '#f0e2d6', side: THREE.DoubleSide });
  const basin = new THREE.Mesh(basinGeo, fountainStone);
  basin.position.copy(fountainAt);
  group.add(basin);
  const stemGeo = new THREE.LatheGeometry(
    [
      [0, 0],
      [0.16, 0],
      [0.12, 0.3],
      [0.1, 0.9],
      [0.14, 1.0],
      [0.42, 1.12],
      [0.44, 1.2],
      [0, 1.2],
    ].map(([x, y]) => new THREE.Vector2(x, y)),
    24,
  );
  const stem = new THREE.Mesh(stemGeo, fountainStone);
  stem.position.copy(fountainAt);
  group.add(stem);
  const waterMat = new THREE.ShaderMaterial({ vertexShader: WATER_VERT, fragmentShader: WATER_FRAG, uniforms: { uTime: u.uTime, uDrop: { value: new THREE.Vector2(0.18, 0.05) } } });
  const water = new THREE.Mesh(new THREE.CircleGeometry(0.96, 40), waterMat);
  water.rotation.x = -Math.PI / 2;
  water.position.copy(fountainAt).add(new THREE.Vector3(0, 0.5, 0));
  group.add(water);
  const spill = new THREE.Mesh(
    new THREE.CylinderGeometry(0.012, 0.02, 0.62, 6, 1, true),
    new THREE.MeshBasicMaterial({ color: '#cfe0ea', transparent: true, opacity: 0.55, depthWrite: false }),
  );
  spill.position.copy(fountainAt).add(new THREE.Vector3(0.38, 0.85, 0.1));
  group.add(spill);

  // --- birds -------------------------------------------------------------------------
  // Swallows wheeling out over the drop, below the garden.
  const swallowGeo = new THREE.BufferGeometry();
  swallowGeo.setAttribute(
    'position',
    new THREE.Float32BufferAttribute([0, 0, 0.18, -0.45, 0.02, -0.05, 0, 0, -0.08, 0, 0, 0.18, 0, 0, -0.08, 0.45, 0.02, -0.05, 0, 0, -0.08, -0.06, 0, -0.32, 0.06, 0, -0.32], 3),
  );
  const flock = quality === 'high' ? 34 : 22;
  const phases = new Float32Array(flock);
  for (let i = 0; i < flock; i++) phases[i] = r();
  swallowGeo.setAttribute('aPhase', new THREE.InstancedBufferAttribute(phases, 1));
  const birdMat = new THREE.ShaderMaterial({ vertexShader: BIRD_VERT, fragmentShader: BIRD_FRAG, uniforms: { uTime: u.uTime }, side: THREE.DoubleSide });
  const swallows = new THREE.InstancedMesh(swallowGeo, birdMat, flock);
  swallows.frustumCulled = false;
  const orbits = Array.from({ length: flock }, () => ({
    cx: -14 + r() * 28,
    cz: -60 - r() * 60,
    rx: 14 + r() * 30,
    rz: 10 + r() * 22,
    y: -10 + r() * 12,
    speed: (0.25 + r() * 0.35) * (r() < 0.5 ? -1 : 1),
    phase: r() * Math.PI * 2,
    bob: r() * 6,
  }));
  group.add(swallows);

  // Sparrows: some along the parapet, some down in the gravel by the fountain, come
  // to the water and to listen.
  const sparrowParts: THREE.BufferGeometry[] = [];
  const tint = (g: THREE.BufferGeometry, hex: string) => {
    const geo = g.index ? g.toNonIndexed() : g;
    geo.deleteAttribute('uv');
    const col = new Float32Array(geo.attributes.position.count * 3);
    const cc = c(hex);
    for (let i = 0; i < geo.attributes.position.count; i++) cc.toArray(col, i * 3);
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    sparrowParts.push(geo);
  };
  const body = new THREE.SphereGeometry(0.06, 10, 8);
  body.scale(1, 0.85, 1.5);
  body.translate(0, 0.07, 0);
  tint(body, '#7a5a3e');
  const breast = new THREE.SphereGeometry(0.05, 10, 8);
  breast.scale(1, 0.8, 1.1);
  breast.translate(0, 0.055, 0.03);
  tint(breast, '#cdbba0');
  const head = new THREE.SphereGeometry(0.04, 10, 8);
  head.translate(0, 0.13, 0.07);
  tint(head, '#6a4c34');
  const beak = new THREE.ConeGeometry(0.01, 0.03, 6);
  beak.rotateX(Math.PI / 2);
  beak.translate(0, 0.125, 0.115);
  tint(beak, '#2a2420');
  const tail = new THREE.BoxGeometry(0.05, 0.01, 0.09);
  tail.rotateX(-0.4);
  tail.translate(0, 0.08, -0.12);
  tint(tail, '#5a412c');
  const sparrowGeo = mergeGeometries(sparrowParts)!;
  sparrowGeo.scale(1.3, 1.3, 1.3);
  const perches: { pos: THREE.Vector3; yaw: number; next: number; hop: number; peck: number }[] = [];
  for (let i = 0; i < 7; i++) perches.push({ pos: new THREE.Vector3(-4 + i * 1.35 + r() * 0.4, GY + 0.98, PARAPET_Z + (r() - 0.5) * 0.2), yaw: r() * 6, next: r() * 5, hop: -1, peck: 0 });
  for (let i = 0; i < 6; i++) {
    const a = -0.6 + i * 0.35;
    perches.push({ pos: fountainAt.clone().add(new THREE.Vector3(Math.cos(a) * 1.7 + 0.6, 0.02, Math.sin(a) * 1.6 + 0.4)), yaw: r() * 6, next: r() * 5, hop: -1, peck: 0 });
  }
  const sparrows = new THREE.InstancedMesh(sparrowGeo, outdoor(u, { vertexColors: true }), perches.length);
  group.add(sparrows);

  const birdM = new THREE.Matrix4();
  const birdQ = new THREE.Quaternion();
  const one = new THREE.Vector3(1, 1, 1);
  const up = new THREE.Vector3(0, 1, 0);
  const tilt = new THREE.Quaternion();
  const fwdQ = new THREE.Quaternion();
  return {
    group,
    daylight: u,
    tick(t, _dt, camera) {
      u.uTime.value = t;
      sky.position.copy(camera.position);
      // The swallows: each on its own loop, banking round.
      orbits.forEach((o, i) => {
        const a = o.phase + t * o.speed;
        const x = o.cx + Math.cos(a) * o.rx;
        const z = o.cz + Math.sin(a) * o.rz;
        const y = o.y + Math.sin(t * 0.7 + o.bob) * 2;
        const dx = -Math.sin(a) * o.rx * Math.sign(o.speed);
        const dz = Math.cos(a) * o.rz * Math.sign(o.speed);
        birdQ.setFromAxisAngle(up, Math.atan2(dx, dz));
        tilt.setFromAxisAngle(new THREE.Vector3(0, 0, 1), -0.5 * Math.sign(o.speed));
        birdQ.multiply(tilt);
        birdM.compose(new THREE.Vector3(x, y, z), birdQ, one);
        swallows.setMatrixAt(i, birdM);
      });
      swallows.instanceMatrix.needsUpdate = true;
      // The sparrows: still, then a hop and a turn, or a peck at the ground.
      perches.forEach((p, i) => {
        if (t > p.next) {
          if (r() < 0.55) p.hop = t;
          else p.peck = t;
          p.next = t + 1.5 + r() * 5;
          if (p.hop === t) p.yaw += (r() - 0.5) * 2.2;
        }
        const hopK = p.hop >= 0 ? Math.min(1, (t - p.hop) / 0.22) : 1;
        const lift = hopK < 1 ? Math.sin(hopK * Math.PI) * 0.06 : 0;
        const peckK = Math.max(0, 1 - Math.abs(t - p.peck - 0.15) / 0.15);
        fwdQ.setFromAxisAngle(up, p.yaw);
        tilt.setFromAxisAngle(new THREE.Vector3(1, 0, 0), peckK * 0.7);
        fwdQ.multiply(tilt);
        birdM.compose(p.pos.clone().add(new THREE.Vector3(0, lift, 0)), fwdQ, one);
        sparrows.setMatrixAt(i, birdM);
      });
      sparrows.instanceMatrix.needsUpdate = true;
      bellPivot.rotation.z = Math.sin(t * 0.6) * 0.02;
    },
    debug: { heightAt, towerAt, fountainAt },
  };
}
