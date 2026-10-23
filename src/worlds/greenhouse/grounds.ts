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

/** Below this height the bank's face eases out into the lawn; above this it rolls over onto the top. Between, a true plane: the bedding lies there. */
const TOE = 0.45;
const CREST = 2.85;
/** Where the bank falls away at either end, and where the ground behind it comes down again, far off. */
const ENDS: [number, number] = [10.4, 13.6];
const BEHIND: [number, number] = [36, 46];

/**
 * The height of the ground at (x, z): the lawn at 0, and the bank across it,
 * its face the plane at BANK.tilt through BANK.center, with a soft toe where
 * it meets the lawn (a mown edge) and a soft crest where it rolls over onto
 * the level ground behind, whose trees stand at BANK.top. At either end it
 * comes down to the lawn in a long curve rather than stopping in a wall.
 */
export function ground(x: number, z: number) {
  const top = BANK.top;
  const lin = (bankFoot() - z) * Math.tan(BANK.tilt);
  let h: number;
  if (lin < TOE) h = TOE * Math.exp((lin - TOE) / TOE);
  else if (lin > CREST) h = CREST + (top - CREST) * (1 - Math.exp(-(lin - CREST) / (top - CREST)));
  else h = lin;
  const ends = 1 - THREE.MathUtils.smoothstep(Math.abs(x), ENDS[0], ENDS[1]);
  const back = 1 - THREE.MathUtils.smoothstep(-z, BEHIND[0], BEHIND[1]);
  return h * ends * back;
}

/** How far the ground stands below its true height where it's all but level: a lawn plane lies there, a hair above. */
const sink = (h: number) => h - 0.06 * (1 - THREE.MathUtils.smoothstep(h, 0, 0.06));

/**
 * The bank and the level ground behind it, as one sheet over the lawn: rows
 * close together over the toe, the face and the crest, and far apart behind,
 * where it's all flat. Normals from the ground's own slope. Where the ground
 * is level the sheet dips just under the lawn's plane, so the two never fight.
 */
export function bankGeometry(high: boolean) {
  const nx = high ? 124 : 62;
  const x0 = -ENDS[1] - 1.6;
  const x1 = ENDS[1] + 1.6;
  const front = bankFoot() + 2.8;
  const crestBack = bankTop() - 2.6;
  const zs: number[] = [];
  const nFace = high ? 64 : 30;
  for (let i = 0; i <= nFace; i++) zs.push(front + ((crestBack - front) * i) / nFace);
  for (let i = 1; i <= 10; i++) zs.push(crestBack + (-BEHIND[1] - 1 - crestBack) * Math.pow(i / 10, 1.4));
  const pos: number[] = [];
  const nrm: number[] = [];
  const e = 0.05;
  const n = new THREE.Vector3();
  for (const z of zs)
    for (let i = 0; i <= nx; i++) {
      const x = x0 + ((x1 - x0) * i) / nx;
      pos.push(x, sink(ground(x, z)), z);
      n.set(-(ground(x + e, z) - ground(x - e, z)) / (2 * e), 1, -(ground(x, z + e) - ground(x, z - e)) / (2 * e)).normalize();
      nrm.push(n.x, n.y, n.z);
    }
  const index: number[] = [];
  for (let r = 0; r + 1 < zs.length; r++)
    for (let i = 0; i < nx; i++) {
      const a = r * (nx + 1) + i;
      const b = a + nx + 1;
      // (Rows run away from the house, so this winding faces up.)
      index.push(a, a + 1, b, a + 1, b + 1, b);
    }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  geo.setIndex(index);
  return geo;
}

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
// The lawn and the bank: one shader for both, and for the gravel walk and the
// border along the front of the house. Mown in stripes that lighten and darken
// with the way you look along them, turned in a headland by the bank and by the
// border; broad greens, drifts of darker clover and daisies in the grass; the
// bank cut longer, with a crisp mown edge at its foot; the walk raked gravel
// with stone edging. The long shadows of the trees, the hedges, the yews and the
// balustrade are painted once into a map of the ground (see shadeMap), and
// looking toward the low sun the grass shines, dew catching here and there.
// Detail that would come out smaller than a pixel fades away rather than shimmer.
const LAWN_FRAG = /* glsl */ `
  ${DAYLIGHT}
  uniform vec4 uWalk;
  uniform vec4 uBeds;
  uniform sampler2D uShade;
  uniform vec4 uShadeBox;
  varying vec3 vWorld;
  varying vec3 vNrm;
  float hash(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
  }
  /** A soft-edged square wave: +1 in one half of each period, -1 in the other, the edges w wide. */
  float bands(float x, float period, float w) {
    float tri = abs(fract(x / period) - 0.5) * 4.0 - 1.0;
    return clamp(tri * period / max(w * 4.0, 1e-4), -1.0, 1.0);
  }
  /** Between lo and hi, edges a soft aa wide. */
  float within(float x, float lo, float hi, float aa) { return smoothstep(lo - aa, lo + aa, x) * (1.0 - smoothstep(hi - aa, hi + aa, x)); }
  /** Little round things scattered in cells: 1 inside one, 0 outside, the edge a pixel soft. */
  float dots(vec2 p, float cell, float chance, float r, float aa, float seed) {
    vec2 c = floor(p / cell);
    vec2 at = (c + 0.2 + 0.6 * vec2(hash(c + seed), hash(c + seed + 7.1))) * cell;
    float there = step(hash(c + seed + 3.3), chance);
    return there * (1.0 - smoothstep(r - aa, r + aa, length(p - at)));
  }
  void main() {
    vec2 p = vWorld.xz;
    vec3 toEye = cameraPosition - vWorld;
    float dist = length(toEye);
    vec3 v = toEye / max(dist, 1e-3);
    float nl = length(vNrm);
    vec3 n = nl > 1e-5 ? vNrm / nl : vec3(0.0, 1.0, 0.0);
    // Meters to a pixel here, and how much fine pattern can show without shimmering.
    float px = max(length(fwidth(p)), 1e-5);
    float aa = max(0.004, px * 0.75);
    float fine = 1.0 - smoothstep(0.006, 0.03, px);
    float mid = 1.0 - smoothstep(0.02, 0.09, px);
    float far = smoothstep(18.0, 60.0, length(p));
    // Height over the lawn (the lawn's plane sits a few centimeters under the house's floor).
    float y = vWorld.y + 0.04;

    // --- the grass ---
    float broad = noise(p * 0.19) * 0.6 + noise(p * 0.71 + 3.0) * 0.4;
    float blades = noise(p * 9.0) * 0.55 + noise(p * 31.0) * 0.45;
    vec3 grass = mix(vec3(0.095, 0.2, 0.04), vec3(0.2, 0.32, 0.075), smoothstep(0.15, 0.85, broad));
    float clover = smoothstep(0.6, 0.78, noise(p * 1.1 + 4.0)) * (0.55 + 0.45 * noise(p * 5.0));
    grass = mix(grass, vec3(0.075, 0.19, 0.075), clover * 0.6);
    grass *= mix(1.0, 0.8 + 0.4 * blades, mix(0.3, 1.0, fine));
    // The bank is cut longer: a little yellower and rougher, no stripes, and a crisp edge at its foot
    // where the mower stopped, a shadowed line along it.
    float ay = max(fwidth(y), 1e-4);
    float bank = smoothstep(0.14 - ay, 0.14 + ay, y);
    grass = mix(grass, grass * vec3(1.08, 1.04, 0.86) * (0.9 + 0.2 * noise(p * 3.0 + 9.0)), bank);
    grass *= 1.0 - 0.3 * within(y, 0.115, 0.14, ay) * mid;
    // Mown stripes between the border and the bank, a mower's width each, the grass laid one way
    // then the other (lighter looking along the lay); turned at either end in a headland.
    vec2 look = normalize(p - cameraPosition.xz + 1e-4);
    float stripes = within(abs(p.x), -1.0, 13.4, aa) * within(p.y, uBeds.y + 0.25, uBeds.x - 0.04, aa) * (1.0 - bank) * (1.0 - far);
    float head = max(within(p.y, uBeds.x - 1.25, uBeds.x, aa), within(p.y, uBeds.y, uBeds.y + 2.4, aa));
    float lay = mix(bands(p.x, 2.4, aa) * look.y, bands(p.y, 2.4, aa) * look.x, head);
    grass *= 1.0 + 0.2 * lay * stripes;
    grass = mix(grass, vec3(0.3, 0.29, 0.12), far * 0.55);
    vec3 albedo = grass;
    #if LAWN_DETAIL
      // Daisies (more on the bank, and among the clover), half shut at this hour: white, a gold eye.
      if (mid > 0.0) {
        // (A daisy smaller than a pixel fades out rather than showing as a white speck.)
        float chance = mix(0.018, 0.07, bank) * (0.4 + clover);
        float seen = mid * clamp(0.011 / px, 0.0, 1.0);
        seen *= seen;
        float daisy = dots(p, 0.17, chance, 0.011, aa, 1.7) * seen;
        float eye = dots(p, 0.17, chance, 0.004, aa, 1.7) * seen;
        albedo = mix(albedo, vec3(0.86, 0.84, 0.78), daisy);
        albedo = mix(albedo, vec3(0.85, 0.62, 0.12), eye);
      }
    #endif

    // --- the walk along the house, round the end to the door, and out through the border ---
    float onGrass = 1.0;
    if (p.y > uBeds.x - 0.3 && p.y < 1.8 && abs(p.x) < 12.0) {
      float gapPath = within(abs(p.x), -1.0, uBeds.z, aa) * within(p.y, uBeds.x, uWalk.x, aa);
      float walk = max(within(p.y, uWalk.x, uWalk.y + 0.2, aa) * within(abs(p.x), -1.0, uWalk.z, aa), within(p.x, uWalk.w, uWalk.w + 1.3, aa) * within(p.y, uWalk.x, 1.6, aa));
      walk = max(walk, gapPath);
      // The border between the walk and the lawn: dark earth under the plants, its lawn edge cut clean.
      float border = within(p.y, uBeds.x, uWalk.x, aa) * within(abs(p.x), -1.0, uWalk.z - 0.2, aa) * (1.0 - gapPath);
      // Raked gravel: buff, pebbles you can see close to, the rake's lines along the walk.
      vec2 g = p * 34.0;
      float pebble = noise(g) * 0.55 + noise(g * 2.3 + 5.0) * 0.45;
      #if LAWN_DETAIL
        vec2 cell = floor(g);
        vec2 f = fract(g) - 0.5 + 0.15 * (vec2(hash(cell + 2.0), hash(cell + 5.0)) - 0.5);
        float stone = 0.5 * hash(cell) + 0.5 * (1.0 - smoothstep(0.2, 0.5, length(f)));
        pebble = mix(pebble, stone, fine * 0.8);
      #endif
      float rake = 0.5 + 0.5 * sin(p.y * 70.0 + noise(p * 3.0) * 4.0);
      vec3 gravel = mix(vec3(0.3, 0.26, 0.2), vec3(0.5, 0.44, 0.34), pebble) * (0.94 + 0.06 * rake * mid);
      vec3 earth = mix(vec3(0.1, 0.07, 0.05), vec3(0.17, 0.12, 0.08), noise(p * 14.0));
      // Stone edging between the gravel and the border (and along the path through it), a dark joint beside it.
      float inBorder = within(p.y, uBeds.x, uWalk.x + 0.06, aa);
      float dz = min(abs(p.y - uWalk.x), mix(1e3, abs(abs(p.x) - uBeds.z), inBorder));
      float kerb = (1.0 - smoothstep(0.05 - aa, 0.05 + aa, dz)) * within(abs(p.x), -1.0, uWalk.z, aa);
      float dj = abs(fract(p.x / 0.6 + 0.5) - 0.5) * 0.6;
      float joint = (1.0 - smoothstep(0.003, 0.003 + aa, dj)) * mid;
      vec3 stoneCol = vec3(0.63, 0.58, 0.48) * (0.9 + 0.1 * noise(p * 20.0)) * (1.0 - 0.4 * joint);
      float lip = within(dz, 0.05, 0.068, aa) * within(abs(p.x), -1.0, uWalk.z, aa);
      // The border's lawn edge: cut clean, a little shadowed where the turf stands above the earth.
      float cut = within(p.y, uBeds.x - 0.035, uBeds.x, aa) * within(abs(p.x), -1.0, uWalk.z - 0.2, aa) * (1.0 - gapPath);
      albedo = mix(albedo, earth, border);
      albedo = mix(albedo, gravel, walk);
      albedo = mix(albedo, stoneCol, kerb);
      albedo *= 1.0 - 0.45 * lip * mid - 0.35 * cut * mid;
      onGrass = (1.0 - walk) * (1.0 - border) * (1.0 - kerb);
    }

    // --- the light ---
    // The long shadows, looked up where the sun's ray through this point meets the level ground.
    vec2 base = p - uSunDir.xz * (max(vWorld.y, 0.0) / max(uSunDir.y, 0.05));
    vec2 suv = (base - uShadeBox.xy) * uShadeBox.zw;
    float inMap = step(0.0, suv.x) * step(suv.x, 1.0) * step(0.0, suv.y) * step(suv.y, 1.0);
    vec2 sh2 = texture2D(uShade, clamp(suv, 0.0, 1.0)).rg;
    float shade = mix(sh2.r, sh2.g, smoothstep(1.2, 2.6, vWorld.y)) * inMap;
    float lit = 1.0 - shade * 0.88;
    vec3 amb = mix(uGround, uSky, n.y * 0.5 + 0.5);
    vec3 col = albedo * (amb + uSunColor * max(dot(n, uSunDir), 0.0) * lit);
    // Looking toward the low sun the grass glows gold, light through the blades and off their edges,
    // with a broad sheen off the lawn; and close by, dew catches it here and there.
    float toward = pow(max(dot(-v, uSunDir), 0.0), 3.0);
    col += uSunColor * albedo * vec3(1.0, 0.9, 0.5) * toward * onGrass * (0.35 + 0.3 * blades) * lit;
    vec3 refl = reflect(-v, n);
    col += uSunColor * vec3(0.9, 0.75, 0.45) * pow(max(dot(refl, uSunDir), 0.0), 12.0) * 0.06 * onGrass * lit;
    #if LAWN_DETAIL
      float dew = smoothstep(0.9, 0.97, noise(p * 47.0 + 11.0)) * fine * onGrass;
      col += uSunColor * vec3(1.0, 0.95, 0.8) * dew * toward * toward * 1.4 * lit;
    #endif
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

/**
 * A clipped yew cone two meters tall, its foot on the ground: tucked in at the
 * bottom, its flanks a little full, its tip rounded, and its whole surface
 * just uneven from the shears, leaning a touch, each its own (by seed).
 * Shaded darker toward its foot (vertex colors).
 */
export function yewGeometry(seed: number, high: boolean) {
  const H = 2.0;
  const R = 0.58;
  const steps = high ? 18 : 10;
  const profile: THREE.Vector2[] = [new THREE.Vector2(0, 0)];
  for (let k = 0; k <= steps; k++) {
    const t = k / steps;
    const r = R * Math.pow(1 - t, 0.78) * (0.82 + 0.18 * THREE.MathUtils.smoothstep(t, 0, 0.07));
    profile.push(new THREE.Vector2(Math.max(r, 1e-3), H * t));
  }
  profile.push(new THREE.Vector2(0, H));
  // Turned by hand, so the seam round the back shares its vertices (smooth all the way round).
  const seg = high ? 28 : 16;
  const lean = Math.sin(seed) * 0.04;
  const pos: number[] = [];
  const col: number[] = [];
  for (const pr of profile)
    for (let j = 0; j < seg; j++) {
      const th = (j / seg) * Math.PI * 2;
      const k = 1 + 0.035 * Math.sin(th * 5 + pr.y * 3 + seed) + 0.025 * Math.sin(th * 11 - pr.y * 7 + seed * 2) + 0.015 * Math.sin(th * 23 + pr.y * 13);
      pos.push(Math.cos(th) * pr.x * k + lean * pr.y, pr.y, Math.sin(th) * pr.x * k);
      const shade = 0.7 + 0.3 * THREE.MathUtils.smoothstep(pr.y, 0, 1.4);
      col.push(shade, shade, shade);
    }
  const index: number[] = [];
  for (let i = 0; i + 1 < profile.length; i++)
    for (let j = 0; j < seg; j++) {
      const a = i * seg + j;
      const b = i * seg + ((j + 1) % seg);
      index.push(a, a + seg, b, b, a + seg, b + seg);
    }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.setIndex(index);
  geo.computeVertexNormals();
  return geo.toNonIndexed();
}

/**
 * The stone balustrade along the top of the bank, its foot at height y on the
 * line z: a moulded plinth and handrail, turned balusters (bellied, a waist,
 * a collar), and at either end a pedestal with an urn on it. Weathered in its
 * vertex colors: darker toward the foot where the damp gets in, a bloom of
 * lichen here and there.
 */
export function balustradeGeometry(high: boolean, z: number, y: number) {
  const half = BANK.width / 2;
  const parts: THREE.BufferGeometry[] = [];
  const P = (pts: number[][]) => pts.map(([a, b]) => new THREE.Vector2(a, b));
  /** A moulding along the balustrade: its section (across, up) run the whole length. */
  const moulding = (section: number[][], len: number, at: number) => {
    const geo = new THREE.ExtrudeGeometry(new THREE.Shape(P(section)), { depth: len, bevelEnabled: false, steps: 1 });
    geo.rotateY(Math.PI / 2);
    geo.translate(-len / 2, y + at, z);
    return geo;
  };
  parts.push(
    moulding([[-0.15, 0], [0.15, 0], [0.15, 0.07], [0.12, 0.1], [-0.12, 0.1], [-0.15, 0.07]], half * 2, 0),
    moulding([[-0.11, 0], [0.11, 0], [0.11, 0.025], [0.135, 0.045], [0.135, 0.075], [0.105, 0.105], [0.05, 0.12], [-0.05, 0.12], [-0.105, 0.105], [-0.135, 0.075], [-0.135, 0.045], [-0.11, 0.025]], half * 2, 0.65),
  );
  // The balusters: one turned, and copied all along (quicker than turning each).
  const one = plain(new THREE.LatheGeometry(P([[0, 0], [0.065, 0], [0.065, 0.045], [0.045, 0.06], [0.04, 0.08], [0.055, 0.13], [0.068, 0.2], [0.062, 0.26], [0.044, 0.32], [0.032, 0.37], [0.036, 0.4], [0.05, 0.43], [0.05, 0.47], [0.062, 0.5], [0.062, 0.55], [0, 0.55]]), high ? 10 : 6));
  const xs: number[] = [];
  for (let x = -half + 0.3; x <= half - 0.3 + 1e-6; x += 0.24) xs.push(x);
  const n1 = one.attributes.position.count;
  const pos = new Float32Array(n1 * 3 * xs.length);
  const nrm = new Float32Array(n1 * 3 * xs.length);
  const src = one.attributes.position.array as Float32Array;
  const srcN = one.attributes.normal.array as Float32Array;
  xs.forEach((x, k) => {
    for (let i = 0; i < n1; i++) {
      const o = (k * n1 + i) * 3;
      pos[o] = src[i * 3] + x;
      pos[o + 1] = src[i * 3 + 1] + y + 0.1;
      pos[o + 2] = src[i * 3 + 2] + z;
    }
    nrm.set(srcN, k * n1 * 3);
  });
  const row = new THREE.BufferGeometry();
  row.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  row.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  parts.push(row);
  const urn = P([[0, 0], [0.15, 0], [0.15, 0.04], [0.1, 0.06], [0.065, 0.1], [0.07, 0.14], [0.17, 0.2], [0.25, 0.3], [0.27, 0.38], [0.29, 0.4], [0.28, 0.43], [0.22, 0.44], [0.18, 0.47], [0.1, 0.52], [0.04, 0.55], [0.05, 0.6], [0, 0.63]]);
  for (const x of [-half, half]) {
    parts.push(new THREE.BoxGeometry(0.4, 0.1, 0.4).translate(x, y + 0.05, z), new THREE.BoxGeometry(0.34, 0.74, 0.34).translate(x, y + 0.47, z), new THREE.BoxGeometry(0.42, 0.07, 0.42).translate(x, y + 0.875, z));
    parts.push(new THREE.LatheGeometry(urn, high ? 22 : 12).translate(x, y + 0.91, z));
  }
  const geo = mergeGeometries(parts.map((g) => plain(g)));
  // (A lathe leaves its end normals unscaled.)
  geo.normalizeNormals();
  const p = geo.attributes.position;
  const c = geo.attributes.color;
  for (let i = 0; i < p.count; i++) {
    const px = p.getX(i);
    const py = p.getY(i) - y;
    const pz = p.getZ(i);
    const damp = 0.78 + 0.22 * THREE.MathUtils.smoothstep(py, -0.05, 0.8);
    const lichen = THREE.MathUtils.smoothstep(Math.sin(px * 3.1 + py * 5.0) * Math.sin(px * 1.7 - py * 2.3 + pz * 4.0), 0.45, 0.85);
    c.setXYZ(i, damp * (1 - lichen * 0.08), damp * (1 - lichen * 0.04), damp * (1 - lichen * 0.3));
  }
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

/** The level ground the shadow map covers (x and z, meters): the lawn and the ground behind the bank, and as far as the low sun throws a shadow from them. */
export const SHADE = { x0: -34, x1: 42, z0: -50, z1: 6 };

/** Something that throws a shadow: a ball of leaves, a pole (a trunk), or a solid (any convex shape, by its corners). `top` for what stands on the level ground behind the bank. */
export interface Casters {
  balls: { at: THREE.Vector3; r: number; a: number; top?: boolean }[];
  poles: { from: THREE.Vector3; to: THREE.Vector3; r: number; top?: boolean }[];
  solids: { corners: THREE.Vector3[]; a: number }[];
  /** The balustrade along the top of the bank: where it stands, and how far it runs either way. */
  rail: { z: number; y: number; half: number };
}

/** Where a point's shadow falls on the level ground, along the sun's ray (x, z). */
const castOnGround = (p: THREE.Vector3): [number, number] => [p.x - (SUN.x * p.y) / SUN.y, p.z - (SUN.z * p.y) / SUN.y];

/** Convex hull of points in the plane (monotone chain), counterclockwise. */
function hull(pts: [number, number][]) {
  const s = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o: number[], a: number[], b: number[]) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower: [number, number][] = [];
  for (const p of s) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper: [number, number][] = [];
  for (let i = s.length - 1; i >= 0; i--) {
    const p = s[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  return lower.slice(0, -1).concat(upper.slice(0, -1));
}

/**
 * The garden's long shadows, painted once onto a map of the level ground: in
 * the first channel what falls on the lawn (the bank's own, the balustrade's
 * with a stripe for every baluster, the hedges', the yews', the fruit trees'
 * dappled through their leaves), in the second what falls on the ground behind
 * the bank (its trees'). A point higher up looks itself up where the sun's ray
 * through it meets the ground (see the lawn's shader). Drawn straight into the
 * numbers (no canvas: quick, and the same everywhere), each shape's edge a
 * pixel soft, then softened once more; the bank's own shadow worked out ray by
 * ray against its shape. Returns the two channels, each 0 (sunlit) to 1.
 */
export function shadePixels(high: boolean, casters: Casters) {
  const W = high ? 768 : 384;
  const H = high ? 576 : 288;
  const { x0, x1, z0, z1 } = SHADE;
  const sx = W / (x1 - x0);
  const sy = H / (z1 - z0);
  const cell = 1 / Math.min(sx, sy);
  const layers = [new Float32Array(W * H), new Float32Array(W * H)];
  // The sun's way across the ground, and square to it.
  const dx = -SUN.x / Math.hypot(SUN.x, SUN.z);
  const dz = -SUN.z / Math.hypot(SUN.x, SUN.z);
  /** Darkens the pixels in a box by what `cover` says for each one's middle (0..1), at `alpha`. */
  const paint = (layer: Float32Array, minX: number, maxX: number, minZ: number, maxZ: number, alpha: number, cover: (x: number, z: number) => number) => {
    const i0 = Math.max(0, Math.floor((minX - x0) * sx));
    const i1 = Math.min(W - 1, Math.ceil((maxX - x0) * sx));
    const j0 = Math.max(0, Math.floor((minZ - z0) * sy));
    const j1 = Math.min(H - 1, Math.ceil((maxZ - z0) * sy));
    for (let j = j0; j <= j1; j++) {
      const z = z0 + (j + 0.5) / sy;
      for (let i = i0; i <= i1; i++) {
        const c = cover(x0 + (i + 0.5) / sx, z);
        if (c <= 0) continue;
        const k = j * W + i;
        layer[k] = 1 - (1 - layer[k]) * (1 - alpha * Math.min(1, c));
      }
    }
  };
  for (const b of casters.balls) {
    const [cx, cz] = castOnGround(b.at);
    const A = b.r / SUN.y;
    const B = b.r;
    // (The ellipse's own box, turned with it; nothing at all if it's off the map.)
    const hx = Math.hypot(A * dx, B * dz);
    const hz = Math.hypot(A * dz, B * dx);
    if (cx + hx < x0 || cx - hx > x1 || cz + hz < z0 || cz - hz > z1) continue;
    // (Written out rather than through paint(): there are hundreds of these.)
    const layer = layers[b.top ? 1 : 0];
    const i0 = Math.max(0, Math.floor((cx - hx - x0) * sx));
    const i1 = Math.min(W - 1, Math.ceil((cx + hx - x0) * sx));
    const j0 = Math.max(0, Math.floor((cz - hz - z0) * sy));
    const j1 = Math.min(H - 1, Math.ceil((cz + hz - z0) * sy));
    const edge = B / cell;
    for (let j = j0; j <= j1; j++) {
      const rz = z0 + (j + 0.5) / sy - cz;
      for (let i = i0; i <= i1; i++) {
        const rx = x0 + (i + 0.5) / sx - cx;
        const u = (rx * dx + rz * dz) / A;
        const w = (rz * dx - rx * dz) / B;
        const q = u * u + w * w;
        if (q >= 1.3) continue;
        const c = Math.min(1, (1 - Math.sqrt(q)) * edge + 0.5);
        if (c <= 0) continue;
        const k = j * W + i;
        layer[k] = 1 - (1 - layer[k]) * (1 - b.a * c);
      }
    }
  }
  for (const p of casters.poles) {
    const [ax, az] = castOnGround(p.from);
    const [bx, bz] = castOnGround(p.to);
    const ex = bx - ax;
    const ez = bz - az;
    const len2 = Math.max(ex * ex + ez * ez, 1e-6);
    paint(layers[p.top ? 1 : 0], Math.min(ax, bx) - p.r, Math.max(ax, bx) + p.r, Math.min(az, bz) - p.r, Math.max(az, bz) + p.r, 0.85, (x, z) => {
      const t = Math.max(0, Math.min(1, ((x - ax) * ex + (z - az) * ez) / len2));
      return (p.r - Math.hypot(x - ax - ex * t, z - az - ez * t)) / cell + 0.5;
    });
  }
  for (const solid of casters.solids) {
    const pts = hull(solid.corners.map(castOnGround));
    const edges = pts.map((p, i) => {
      const q = pts[(i + 1) % pts.length];
      const l = Math.hypot(q[0] - p[0], q[1] - p[1]) || 1;
      // Inward normal (the hull runs counterclockwise).
      return [p[0], p[1], -(q[1] - p[1]) / l, (q[0] - p[0]) / l];
    });
    const xs = pts.map((p) => p[0]);
    const zs = pts.map((p) => p[1]);
    paint(layers[0], Math.min(...xs), Math.max(...xs), Math.min(...zs), Math.max(...zs), solid.a, (x, z) => {
      let d = Infinity;
      for (const [px, pz, nx, nz] of edges) d = Math.min(d, (x - px) * nx + (z - pz) * nz);
      return d / cell + 0.5;
    });
  }
  // The bank's own shadow, and the balustrade's beyond it: for each point of the lawn in front of the
  // bank, follow the ray toward the sun back over the bank and see whether the ground (or the rail, a
  // baluster, a post) stands in its way. The bank's shape across, from a table; its ends, worked out.
  const { rail } = casters;
  const toSun = -SUN.z;
  const rise = SUN.y / toSun;
  const step = 0.08;
  const zBack = bankTop() - 3.5;
  const profile: number[] = [];
  for (let zz = bankFoot() + 3.5; zz > zBack; zz -= step) profile.push(ground(0, zz));
  const zFront = bankFoot() + 3.5;
  const balusterR = (yy: number) => (yy < 0.18 ? 0.06 : yy < 0.3 ? 0.035 + (yy - 0.18) * 0.25 : yy < 0.45 ? 0.065 - (yy - 0.3) * 0.17 : 0.045);
  const low = layers[0];
  const j0 = Math.max(0, Math.floor((bankFoot() - 1.5 - z0) * sy));
  const j1 = Math.min(H - 1, Math.ceil((bankFoot() + 3.2 - z0) * sy));
  // (Two by two pixels: the edge is softened after anyway.)
  for (let j = j0; j <= j1; j += 2) {
    const z = z0 + (j + 1) / sy;
    for (let i = 0; i < W; i += 2) {
      const x = x0 + (i + 1) / sx;
      let dark = 0;
      for (let k = Math.max(0, Math.ceil((zFront - z) / step)); k < profile.length; k++) {
        const zz = zFront - k * step;
        const ray = (z - zz) * rise;
        if (ray > BANK.top + 0.05) break;
        const h = profile[k];
        if (h <= ray) continue;
        const ends = 1 - THREE.MathUtils.smoothstep(Math.abs(x + (SUN.x * (z - zz)) / toSun), ENDS[0], ENDS[1]);
        if (h * ends > ray) {
          dark = 1;
          break;
        }
      }
      if (!dark && z > rail.z) {
        // Where the ray crosses the balustrade's line, and how high it is there.
        const bx = x + (SUN.x * (z - rail.z)) / toSun;
        const yy = (z - rail.z) * rise - rail.y;
        const ax = Math.abs(bx);
        if (ax < rail.half + 0.3 && yy > 0 && yy < 1.55) {
          const post = ax > rail.half - 0.17;
          if (post && (yy < 0.91 || (yy < 1.54 && ax > rail.half - 0.26 && ax < rail.half + 0.26))) dark = 1;
          else if (ax <= rail.half && (yy < 0.1 || (yy > 0.65 && yy < 0.77))) dark = 1;
          else if (ax <= rail.half && yy < 0.65) {
            const kk = (bx + rail.half - 0.3) / 0.24;
            if (Math.abs(kk - Math.round(kk)) * 0.24 < balusterR(yy - 0.1)) dark = 1;
          }
        }
      }
      if (!dark) continue;
      low[j * W + i] = 1;
      if (i + 1 < W) low[j * W + i + 1] = 1;
      if (j + 1 < H) {
        low[(j + 1) * W + i] = 1;
        if (i + 1 < W) low[(j + 1) * W + i + 1] = 1;
      }
    }
  }
  // The lawn's softened once: a penumbra, and the leaves' dapple run together a little (the ground
  // behind the bank is only ever seen from far off, where the texture's own filtering does it).
  for (const layer of [low]) {
    const tmp = new Float32Array(W * H);
    for (let j = 0; j < H; j++)
      for (let i = 0; i < W; i++) {
        const k = j * W + i;
        tmp[k] = (layer[k] * 2 + layer[i > 0 ? k - 1 : k] + layer[i < W - 1 ? k + 1 : k]) * 0.25;
      }
    for (let j = 0; j < H; j++)
      for (let i = 0; i < W; i++) {
        const k = j * W + i;
        layer[k] = (tmp[k] * 2 + tmp[j > 0 ? k - W : k] + tmp[j < H - 1 ? k + W : k]) * 0.25;
      }
  }
  return { W, H, low: layers[0], top: layers[1] };
}

/** The shadow map as a texture for the lawn's shader: the lawn's shadows in red, the ground behind the bank's in green. */
export function shadeMap(high: boolean, casters: Casters) {
  const { W, H, low, top } = shadePixels(high, casters);
  const data = new Uint8Array(W * H * 4);
  for (let k = 0; k < W * H; k++) {
    data[k * 4] = Math.round(low[k] * 255);
    data[k * 4 + 1] = Math.round(top[k] * 255);
  }
  const tex = new THREE.DataTexture(data, W, H, THREE.RGBAFormat);
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return { texture: tex };
}

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
  // (The shadow map is painted at the end, once everything that throws one is placed.)
  const shadeTex = { value: null as THREE.Texture | null };
  const shadeBox = { value: new THREE.Vector4(SHADE.x0, SHADE.z0, 1 / (SHADE.x1 - SHADE.x0), 1 / (SHADE.z1 - SHADE.z0)) };
  const walkZ = HOUSE.kneeOut - 1.2;
  const lawnMat = new THREE.ShaderMaterial({
    vertexShader: LAWN_VERT,
    fragmentShader: LAWN_FRAG,
    uniforms: {
      ...daylight,
      uWalk: { value: new THREE.Vector4(walkZ, HOUSE.kneeOut + 0.02, 9.5, HOUSE.x0 - 1.6) },
      // The border's lawn edge, the foot of the bank, and half the width of the path through the border.
      uBeds: { value: new THREE.Vector4(walkZ - 1.15, bankFoot(), 0.55, 0) },
      uShade: shadeTex,
      uShadeBox: shadeBox,
    },
    defines: { LAWN_DETAIL: high ? 1 : 0 },
  });
  const lawn = new THREE.Mesh(new THREE.PlaneGeometry(1400, 1400, 1, 1), lawnMat);
  lawn.rotation.x = -Math.PI / 2;
  // Well under the house's floor: a depth buffer can't tell two surfaces a few millimeters apart.
  lawn.position.y = -0.04;
  group.add(lawn);
  const casters: Casters = { balls: [], poles: [], solids: [], rail: { z: 0, y: 0, half: BANK.width / 2 } };

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
    const corners: THREE.Vector3[] = [];
    for (const cx of [-0.7, 0.7]) for (const cy of [0, 2.42]) for (const cz of [-10, 10]) corners.push(v(s * 14.5 + cx, cy, -13.5 + cz));
    casters.solids.push({ corners, a: 0.95 });
  }
  // Yew cones and balls along the walk: clipped, but not by a machine.
  for (const x of [-8.6, -3.2, 3.2, 8.6]) {
    put(solidLeaf, yewGeometry(7 + x * 5, high), x, 0, -4.35, '#253d1d');
    put(solidLeaf, clump(0.36, 7 + x * 3, 3), x, 0.25, -4.35, '#253d1d');
    const corners = [v(x, 2.0, -4.35)];
    for (let k = 0; k < 10; k++) corners.push(v(x + Math.cos(k * 0.628) * 0.58, 0.3, -4.35 + Math.sin(k * 0.628) * 0.58));
    casters.solids.push({ corners, a: 0.9 });
  }
  // Every tree's crown: a few dark masses of leaves at its heart, and round them sprays of leaves
  // (cards painted with a cluster of leaves), all lit as one crown: each knows the middle of its
  // crown, so the side toward the sun is gold and the far side and the heart of it fall into shade.
  type Blob = { at: THREE.Vector3; s: THREE.Vector3; color: THREE.Color; crown: THREE.Vector4 };
  const blobs: Blob[] = [];
  const sprays: { m: THREE.Matrix4; color: THREE.Color; crown: THREE.Vector4 }[] = [];
  const crown = (x: number, y: number, z: number, rad: number, height: number, color: string, n: number, top = false, R = r) => {
    const base = new THREE.Color(color);
    const middle = new THREE.Vector4(x, y, z, Math.max(rad, height * 0.5));
    // The masses that give the crown its shape (not a ball: lobed, a little lopsided).
    const masses = Array.from({ length: 3 + Math.floor(R() * 3) }, () => {
      const d = v(R() - 0.5, (R() - 0.4) * 0.9, R() - 0.5).normalize();
      return { at: v(x + d.x * rad * 0.4, y + d.y * height * 0.28, z + d.z * rad * 0.4), s: rad * (0.42 + R() * 0.16) };
    });
    for (const m of masses) {
      blobs.push({ at: m.at, s: v(m.s, m.s * height * 0.5 / rad * 0.85, m.s), color: base.clone().multiplyScalar(0.8), crown: middle });
      // Its shadow: dense at the heart of each mass, dappled by the sprays round it.
      casters.balls.push({ at: m.at, r: m.s * 0.8, a: 0.5, top });
    }
    // The sprays, mostly out at the surface of the masses, facing every which way.
    for (let i = 0; i < n; i++) {
      const m = masses[i % masses.length];
      const d = v(R() - 0.5, R() - 0.45, R() - 0.5).normalize();
      const k = 0.55 + Math.pow(R(), 0.5) * 0.6;
      const at = v(m.at.x + d.x * m.s * k, m.at.y + d.y * m.s * (height * 0.5 / rad) * k, m.at.z + d.z * m.s * k);
      const size = rad * (0.42 + R() * 0.3);
      const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(R() * 6.28, R() * 6.28, R() * 6.28));
      sprays.push({ m: new THREE.Matrix4().compose(at, q, v(size, size, size)), color: base.clone().offsetHSL((R() - 0.5) * 0.03, (R() - 0.5) * 0.1, (R() - 0.5) * 0.06), crown: middle });
      // (Every other spray is enough for the dapple in its shadow.)
      if (i % 2 === 0) casters.balls.push({ at, r: size * 0.38, a: 0.42, top });
    }
  };
  const trunkShade = (x: number, y: number, z: number, h: number, rad: number, top = false) => casters.poles.push({ from: v(x, y, z), to: v(x, y + h, z), r: rad, top });
  // Fruit trees on the lawn to the left, toward the sun.
  for (let i = 0; i < 5; i++) {
    const x = -17.5 + (i % 2) * 2.6 + r() * 0.6;
    const z = -5.5 - i * 2.8 + r();
    put(wood, trunk(1.6, 0.09), x, 0, z, '#4a3a2c');
    trunkShade(x, 0, z, 1.7, 0.09);
    crown(x, 2.3, z, 1.25 + r() * 0.3, 1.8, ['#56732e', '#5e782c', '#4d6a2a'][i % 3], high ? 44 : 30);
  }
  // An old tree on the lawn itself, toward the sun: out of the way of the view across to the bank,
  // but its long shadow reaches right across the stripes toward the house. (Its own dice, so the
  // rest of the garden comes out as it always has.)
  {
    const R = rng(1911);
    const [x, z] = [-11.8, -9.3];
    put(wood, trunk(2.6, 0.2), x, 0, z, '#463628');
    trunkShade(x, 0, z, 2.8, 0.2);
    crown(x, 3.7, z, 2.3, 3.0, '#4e6c28', high ? 70 : 44, false, R);
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
    // Standing on the ground behind the bank (or, past its ends, on the lawn).
    const gy = ground(x, z);
    put(wood, trunk(h * 0.6, 0.18), x, gy, z, '#3e3228');
    trunkShade(x, gy, z, h * 0.7, 0.18, gy > 1.5);
    crown(x, gy + h * 0.85, z, 1.9 + r() * 1.3, 2.6 + r() * 1.2, ['#4a6a28', '#3e5c24', '#56722e', '#44622a'][i % 4], high ? 48 : 32, gy > 1.5);
  }
  // And further back on that ground, bigger trees filling the gaps: a wood behind the balustrade
  // rather than a row of single trees against the sky. (Their own dice again.)
  {
    const R = rng(2207);
    for (let i = 0; i < 8; i++) {
      const x = -22 + i * 6.2 + (R() - 0.5) * 2.5;
      const z = bankTop() - 17 - R() * 9;
      const h = 4.5 + R() * 3;
      const gy = ground(x, z);
      put(wood, trunk(h * 0.55, 0.26), x, gy, z, '#3a2f26');
      trunkShade(x, gy, z, h * 0.6, 0.26, gy > 1.5);
      crown(x, gy + h * 0.9, z, 3.0 + R() * 1.2, 3.8 + R() * 1.5, ['#40602a', '#4a6a2c', '#3a5824', '#52702e'][i % 4], high ? 56 : 36, gy > 1.5, R);
    }
  }
  // The borders along the front of the house: mounds of green, flowering.
  const mounds: Blob[] = [];
  for (let x = -9; x <= 9; x += 0.26) {
    if (Math.abs(x) < 0.55) continue;
    const s = 0.2 + r() * 0.16;
    const at = v(x + (r() - 0.5) * 0.12, s * 0.7, HOUSE.kneeOut - 1.5 - r() * 0.55);
    const tall = 1.1 + r() * 0.5;
    // A dark heart of leaves, and over it sprays of leaves on every side, so the shrub reads as leaves, not a ball.
    const mound = { at, s: v(s, s * tall, s).multiplyScalar(0.82), color: new THREE.Color(['#33501f', '#3e5a24', '#4a6428'][Math.floor(r() * 3)]), crown: new THREE.Vector4(at.x, at.y - s * 0.3, at.z, s * tall) };
    mounds.push(mound);
    casters.balls.push({ at: at.clone(), r: s * 0.95, a: 0.55 });
    for (let k = 0; k < (high ? 15 : 8); k++) {
      const d = v(r() - 0.5, -0.25 + r(), r() - 0.5).normalize();
      const p = at.clone().add(v(d.x * s, d.y * s * tall, d.z * s).multiplyScalar(0.8));
      const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(r() * 6.28, r() * 6.28, r() * 6.28));
      const size = s * (1.0 + r() * 0.6);
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
    mounds.map((b) => ({ m: m4.clone().compose(b.at, turned(), b.s), color: b.color.clone().multiplyScalar(0.72), crown: b.crown })),
  );
  leafy(
    new THREE.IcosahedronGeometry(1, 1),
    blobs.map((b) => ({ m: m4.clone().compose(b.at, turned(), b.s), color: b.color, crown: b.crown })),
  );
  // The sprays: cards, told apart from the clumps by a reach given negative.
  leafy(sprayCard(), sprays.map((b) => ({ ...b, crown: b.crown.clone().setW(-b.crown.w) })));

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
      const at = b.at.clone().add(v(d.x * b.s.x, d.y * b.s.y, d.z * b.s.z).multiplyScalar(1.12));
      const face = d.clone().add(v(0, 0.6, 0)).normalize();
      const q = new THREE.Quaternion().setFromUnitVectors(v(0, 1, 0), face).multiply(new THREE.Quaternion().setFromAxisAngle(v(0, 1, 0), r() * 6.28));
      const sc = 0.8 + r() * 0.5;
      heads.push({ m: m4.clone().compose(at, q, v(sc, sc, sc)), color: new THREE.Color(r() < 0.75 ? tint : palette[Math.floor(r() * palette.length)]).multiplyScalar(0.85) });
    }
  }
  leafy(daisyGeometry(), heads);

  // --- the bank across the lawn, where the word is bedded out, and its balustrade -----------------
  // One sheet of ground with the lawn's own grass on it (and the lawn's program): the face, a soft
  // crest, the level ground behind, the ends falling away.
  const bank = new THREE.Mesh(bankGeometry(high), lawnMat);
  group.add(bank);
  // A stone balustrade along the top, set back a little behind the crest.
  const railZ = bankTop() - 0.7;
  const railY = ground(0, railZ);
  casters.rail = { z: railZ, y: railY, half: BANK.width / 2 };
  const balustrade = new THREE.Mesh(balustradeGeometry(high, railZ, railY), outdoor(daylight, { color: '#d8ccb0', vertexColors: true }));
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

  // --- the long shadows, now that everything that throws one is in its place --------------------------
  shadeTex.value = shadeMap(high, casters).texture;

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
 * outline is ragged with leaves rather than round. A spray of leaves (a card
 * painted with them; aCrown's reach given negative) is cut out where there's
 * no leaf and lit only as its crown. All of it one program.
 */
function foliageMaterial(u: DaylightUniforms) {
  return new THREE.ShaderMaterial({
    vertexShader: /* glsl */ `
      attribute vec4 aCrown;
      varying vec3 vWorld;
      varying vec3 vNrm;
      varying vec3 vColor;
      varying vec4 vCrown;
      varying vec2 vUv;
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
        vUv = uv;
        gl_Position = projectionMatrix * viewMatrix * w;
      }
    `,
    fragmentShader: /* glsl */ `
      ${DAYLIGHT}
      uniform sampler2D uLeaves;
      varying vec3 vWorld;
      varying vec3 vNrm;
      varying vec3 vColor;
      varying vec4 vCrown;
      varying vec2 vUv;
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
        float reachOf = abs(vCrown.w);
        vec3 fromMid = vWorld - vCrown.xyz;
        float reach = length(fromMid);
        float back = max(dot(-v, uSunDir), 0.0);
        if (vCrown.w < -1e-3) {
          // A spray of leaves: cut out where the painting has none, and lit only as its crown (no noise to work out).
          vec4 painted = texture2D(uLeaves, vUv);
          if (painted.a < 0.45) discard;
          vec3 n = reach > 1e-4 ? fromMid / reach : vec3(0.0, 1.0, 0.0);
          float heart = mix(0.32, 1.0, smoothstep(0.25, 0.95, reach / max(reachOf, 1e-3)));
          vec3 albedo = vColor * painted.rgb;
          float lit = max(dot(n, uSunDir), 0.0);
          vec3 amb = mix(uGround, uSky, n.y * 0.5 + 0.5) * vec3(0.8, 0.88, 0.8);
          vec3 col = albedo * (amb * heart + uSunColor * lit * mix(1.0, heart, 0.5));
          col += uSunColor * albedo * pow(1.0 - max(dot(n, v), 0.0), 2.0) * lit * 0.85;
          col += uSunColor * albedo * vec3(0.95, 1.0, 0.45) * (pow(back, 4.0) * 0.55 * heart + pow(1.0 - abs(dot(n, v)), 2.0) * back * back * 1.1);
          gl_FragColor = vec4(fade(col, vWorld), 1.0);
          return;
        }
        float nl = length(vNrm);
        vec3 nb = nl > 1e-5 ? vNrm / nl : vec3(0.0, 1.0, 0.0);
        float far = smoothstep(15.0, 60.0, dist);
        float leaves = vn(vWorld * 9.0) * 0.55 + vn(vWorld * 23.0) * 0.45;
        // Up close, single leaves: small crisp flecks, lit or in shade, gone to an average further off.
        float near = 1.0 - smoothstep(3.0, 12.0, dist);
        if (near > 0.0) {
          float fleck = smoothstep(0.38, 0.62, vn(vWorld * 47.0 + leaves * 2.0));
          leaves = mix(leaves, leaves * (0.7 + 0.6 * fleck), near);
        }
        leaves = mix(leaves, 0.5, far * 0.7);
        float inCrown = step(1e-3, reachOf);
        // A ragged edge on a clump: where it turns away from the eye, sprays of leaves with sky between
        // (only near enough for a leaf to be a few pixels; further off it would shimmer).
        float ragged = inCrown * (1.0 - abs(dot(nb, v))) * (1.0 - smoothstep(22.0, 40.0, dist));
        if (ragged > 0.42) {
          float sprays = vn(vWorld * 6.5 + 3.1) * 0.65 + vn(vWorld * 17.0) * 0.35;
          if (ragged > 0.42 + 0.75 * sprays) discard;
        }
        // The leafy unevenness of the surface, fading out where it's too far off to see.
        float bumpK = 1.0 - smoothstep(20.0, 34.0, dist);
        vec3 bump = bumpK > 0.0 ? (vec3(vn(vWorld * 4.0 + 1.7), vn(vWorld * 4.0 + 4.1), vn(vWorld * 4.0 + 8.3)) - 0.5) * bumpK : vec3(0.0);
        // Lit as part of its crown: the clump's own roundness leaning out from the crown's middle.
        vec3 outward = reach > 1e-4 ? fromMid / reach : nb;
        vec3 n = normalize(mix(nb, outward, 0.62 * inCrown) + bump * mix(1.1, 0.75, inCrown));
        float heart = mix(1.0, mix(0.32, 1.0, smoothstep(0.25, 0.95, reach / max(reachOf, 1e-3))), inCrown);
        vec3 albedo = vColor * (0.58 + 0.66 * leaves);
        float lit = max(dot(n, uSunDir), 0.0);
        // The shade side stays green and deep: less of the sky's blue in it than on open ground.
        vec3 amb = mix(uGround, uSky, n.y * 0.5 + 0.5) * vec3(0.8, 0.88, 0.8);
        vec3 col = albedo * (amb * heart + uSunColor * lit * mix(1.0, heart, 0.5));
        // Gold on the edges toward the sun, and with the sun behind, a glow through the leaves, brightest round the crown's edge.
        col += uSunColor * albedo * pow(1.0 - max(dot(n, v), 0.0), 2.0) * lit * 0.85;
        col += uSunColor * albedo * vec3(0.95, 1.0, 0.45) * (pow(back, 4.0) * 0.55 * heart + pow(1.0 - abs(dot(n, v)), 2.0) * back * back * 0.8 * inCrown);
        // The hollows between clumps of leaves stay dark.
        col *= 0.62 + 0.38 * smoothstep(0.2, 0.6, leaves);
        gl_FragColor = vec4(fade(col, vWorld), 1.0);
      }
    `,
    uniforms: { ...u, uLeaves: { value: sprayTexture() } },
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

/** A card for a spray of leaves, a meter square, with a back to it (wound the other way) so it's seen from either side. */
function sprayCard() {
  const front = new THREE.PlaneGeometry(1, 1).toNonIndexed();
  const back = front.clone();
  const p = back.attributes.position;
  const n = back.attributes.normal;
  const uv = back.attributes.uv;
  for (let k = 0; k < p.count; k += 3)
    for (const a of [p, n, uv]) {
      const t = [a.getX(k + 1), a.getY(k + 1), a.itemSize > 2 ? a.getZ(k + 1) : 0];
      a.setXY(k + 1, a.getX(k + 2), a.getY(k + 2));
      if (a.itemSize > 2) a.setZ(k + 1, a.getZ(k + 2));
      a.setXY(k + 2, t[0], t[1]);
      if (a.itemSize > 2) a.setZ(k + 2, t[2]);
    }
  for (let k = 0; k < n.count; k++) n.setXYZ(k, -n.getX(k), -n.getY(k), -n.getZ(k));
  return whiteColors(mergeGeometries([front, back]));
}
