// The look of the inside of the cell, shared by everything in it: a warm haze
// that only fills the cell (so from outside it reads as a lantern, and inside
// the far side melts into it), glassy membranes that glow at their edges, and
// pearly, ribbed solids for the filaments and the proteins. All of it lights
// itself with one made-up light through the wall, so the room's few real lights
// are left for the studio's own pieces.
import * as THREE from 'three';

/** The cell: a sphere of this radius round this point. */
export const CELL = { center: new THREE.Vector3(0, 2, -4), radius: 15 };
/** Where the brightest light comes through the wall from. */
export const SUN = new THREE.Vector3(0.45, 0.8, 0.4).normalize();
/** The haze, low down and up high. */
export const HAZE_LOW = new THREE.Color(0.026, 0.009, 0.014);
export const HAZE_HIGH = new THREE.Color(0.1, 0.042, 0.028);

export type Uniforms = Record<string, THREE.IUniform>;

/** One set for the whole cell: change the time or the haze here and everything follows. */
export const shared: Uniforms = {
  uTime: { value: 0 },
  uCenter: { value: CELL.center },
  uRadius: { value: CELL.radius },
  uHazeK: { value: 0.05 },
  uHazeLow: { value: HAZE_LOW },
  uHazeHigh: { value: HAZE_HIGH },
  uSun: { value: SUN },
};

export const NOISE = /* glsl */ `
  float hash13(vec3 p) { p = fract(p * 0.1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
  vec3 hash33(vec3 p) { p = fract(p * vec3(0.1031, 0.1030, 0.0973)); p += dot(p, p.yxz + 33.33); return fract((p.xxy + p.yxx) * p.zyx); }
  float vnoise(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(hash13(i), hash13(i + vec3(1, 0, 0)), f.x), mix(hash13(i + vec3(0, 1, 0)), hash13(i + vec3(1, 1, 0)), f.x), f.y),
      mix(mix(hash13(i + vec3(0, 0, 1)), hash13(i + vec3(1, 0, 1)), f.x), mix(hash13(i + vec3(0, 1, 1)), hash13(i + vec3(1, 1, 1)), f.x), f.y),
      f.z);
  }
  /** The nearest and next-nearest cell distances, and a number for the nearest cell. */
  vec3 voronoi(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    float d1 = 8.0;
    float d2 = 8.0;
    float id = 0.0;
    for (int z = -1; z <= 1; z++)
      for (int y = -1; y <= 1; y++)
        for (int x = -1; x <= 1; x++) {
          vec3 g = vec3(float(x), float(y), float(z));
          vec3 o = hash33(i + g);
          float d = length(g + o - f);
          if (d < d1) { d2 = d1; d1 = d; id = hash13(i + g + 17.0); }
          else if (d < d2) { d2 = d; }
        }
    return vec3(d1, d2, id);
  }
`;

/** The haze: thickest through the most cell, and none at all outside it. */
export const HAZE = /* glsl */ `
  uniform vec3 uCenter;
  uniform float uRadius;
  uniform float uHazeK;
  uniform vec3 uHazeLow;
  uniform vec3 uHazeHigh;
  uniform vec3 uSun;
  uniform float uTime;
  /** A normal that can't come out as not-a-number, even from a vertex that has none. */
  vec3 unit(vec3 x) {
    float l = length(x);
    return l > 1e-8 ? x / l : vec3(0.0, 1.0, 0.0);
  }
  /** How much of the way from o to p runs inside the cell. */
  float insideLength(vec3 o, vec3 p) {
    vec3 d = p - o;
    float l = length(d);
    d /= max(l, 1e-4);
    vec3 oc = o - uCenter;
    float b = dot(oc, d);
    float h = b * b - (dot(oc, oc) - uRadius * uRadius);
    if (h <= 0.0) return 0.0;
    h = sqrt(h);
    return max(min(-b + h, l) - max(-b - h, 0.0), 0.0);
  }
  vec3 hazeColor(vec3 dir) {
    float s = max(dot(dir, uSun), 0.0);
    return mix(uHazeLow, uHazeHigh, smoothstep(-0.7, 0.8, dir.y)) + vec3(0.22, 0.1, 0.04) * pow(s, 5.0);
  }
  vec3 hazed(vec3 col, vec3 world) {
    float f = 1.0 - exp(-insideLength(cameraPosition, world) * uHazeK);
    return mix(col, hazeColor(normalize(world - cameraPosition)), f);
  }
  /** For things that only add light: how much of it gets through. */
  float through(vec3 world) {
    return exp(-insideLength(cameraPosition, world) * uHazeK * 1.15);
  }
`;

const VERT = /* glsl */ `
  varying vec3 vWorld;
  varying vec3 vNrm;
  varying vec2 vUv;
  varying vec3 vTint;
  void main() {
    vUv = uv;
    vTint = vec3(1.0);
    vec4 p = vec4(position, 1.0);
    vec3 n = normal;
    #ifdef USE_INSTANCING
      p = instanceMatrix * p;
      n = mat3(instanceMatrix) * n;
    #endif
    #ifdef USE_INSTANCING_COLOR
      vTint = instanceColor;
    #endif
    vec4 w = modelMatrix * p;
    vWorld = w.xyz;
    // Left as it is; the fragment shaders make it a unit (a zero normal here would be a NaN).
    vNrm = mat3(modelMatrix) * n;
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;

// Glass: a membrane seen edge-on is thick and bright, seen face-on it's almost
// clear. Adds light, so no sorting, and fades into the haze with distance.
const GLASS_FRAG = /* glsl */ `
  uniform vec3 uColor;
  uniform vec3 uEdge;
  uniform float uCore;
  uniform float uPower;
  uniform float uShimmer;
  uniform float uEdgeFade;
  varying vec3 vWorld;
  varying vec3 vNrm;
  varying vec2 vUv;
  varying vec3 vTint;
  ${HAZE}
  ${NOISE}
  void main() {
    vec3 toEye = cameraPosition - vWorld;
    vec3 v = normalize(toEye);
    // Clamped: a hair over 1 would make pow(1.0 - ndv, ...) a NaN, and NaNs flash black.
    float ndv = min(abs(dot(unit(vNrm), v)), 1.0);
    float rim = pow(1.0 - ndv, uPower);
    // A slow shimmer across the surface, like oil on water.
    float sh = 1.0 + uShimmer * (vnoise(vWorld * 2.3 + vec3(0.0, uTime * 0.12, 0.0)) - 0.5);
    vec3 col = (uColor * uCore + uEdge * rim) * sh * vTint;
    // Sheets fade out at their edges rather than stopping.
    if (uEdgeFade > 0.0) col *= smoothstep(0.0, uEdgeFade, min(min(vUv.x, 1.0 - vUv.x), min(vUv.y, 1.0 - vUv.y)));
    // Gone right up against the lens: a skin you pass through is seen edge-on all
    // round you, all rim, and would flare as you cross it.
    col *= smoothstep(0.08, 0.5, length(toEye));
    gl_FragColor = vec4(col * through(vWorld), 1.0);
  }
`;

export interface GlassOpts {
  color: THREE.ColorRepresentation;
  /** The rim's color, if it's not the body's. */
  edge?: THREE.ColorRepresentation;
  /** How much the face-on middle glows (0..1), and how bright the rim is. */
  core?: number;
  rim?: number;
  /** Higher keeps the glow to a thinner rim. */
  power?: number;
  shimmer?: number;
  /** For sheets: fade out over this much of the uv's at the edges. */
  edgeFade?: number;
}

/** A glassy membrane: additive, no depth writes, both sides. */
export function glass(o: GlassOpts) {
  const color = new THREE.Color(o.color);
  const edge = new THREE.Color(o.edge ?? o.color).multiplyScalar(o.rim ?? 1);
  return new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: GLASS_FRAG,
    uniforms: { ...shared, uColor: { value: color }, uEdge: { value: edge }, uCore: { value: o.core ?? 0.06 }, uPower: { value: o.power ?? 2.4 }, uShimmer: { value: o.shimmer ?? 0.5 }, uEdgeFade: { value: o.edgeFade ?? 0 } },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
}

// Pearl: an opaque, softly lit solid with a glowing rim, for filaments and the
// proteins that walk them. Optional ribs: around (protofilaments) and along
// (the dimers), from the uv's, which the builder scales to meters.
const PEARL_FRAG = /* glsl */ `
  uniform vec3 uColor;
  uniform vec3 uEdge;
  uniform float uGlow;
  uniform vec2 uRibs;
  uniform float uTwist;
  varying vec3 vWorld;
  varying vec3 vNrm;
  varying vec2 vUv;
  varying vec3 vTint;
  ${HAZE}
  void main() {
    vec3 n = unit(vNrm);
    vec3 v = normalize(cameraPosition - vWorld);
    if (dot(n, v) < 0.0) n = -n;
    float ndv = clamp(dot(n, v), 0.0, 1.0);
    float key = max(dot(n, uSun), 0.0);
    float wrap = 0.5 + 0.5 * n.y;
    vec3 base = uColor * vTint;
    float rib = 1.0;
    if (uRibs.x > 0.0) rib *= 0.72 + 0.28 * smoothstep(0.0, 0.6, abs(sin((vUv.y + vUv.x * uTwist) * 3.14159 * uRibs.x)));
    if (uRibs.y > 0.0) rib *= 0.8 + 0.2 * smoothstep(0.1, 0.9, abs(sin(vUv.x * 3.14159 * uRibs.y)));
    vec3 col = base * (0.22 * wrap + 0.75 * key) * rib;
    col += uEdge * pow(1.0 - ndv, 3.0) * (0.6 + 0.4 * rib);
    col += base * uGlow;
    gl_FragColor = vec4(hazed(col, vWorld), 1.0);
  }
`;

export interface PearlOpts {
  color: THREE.ColorRepresentation;
  edge?: THREE.ColorRepresentation;
  glow?: number;
  /** Ribs round the tube, and bumps along it (per uv unit). */
  ribs?: [number, number];
  /** How far the ribs wind round as they go (actin's twist). */
  twist?: number;
}

export function pearl(o: PearlOpts) {
  return new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: PEARL_FRAG,
    uniforms: {
      ...shared,
      uColor: { value: new THREE.Color(o.color) },
      uEdge: { value: new THREE.Color(o.edge ?? '#ffb27a') },
      uGlow: { value: o.glow ?? 0 },
      uRibs: { value: new THREE.Vector2(...(o.ribs ?? [0, 0])) },
      uTwist: { value: o.twist ?? 0 },
    },
  });
}

// Soft points of light drifting in the flow: each has a home and wanders round
// it, rising slowly and wrapping round at the top.
const MOTE_VERT = /* glsl */ `
  attribute float aSeed;
  uniform float uTime;
  uniform float uSize;
  uniform float uRise;
  uniform float uSpan;
  uniform vec3 uCenter;
  varying float vSeed;
  varying float vFade;
  void main() {
    vSeed = aSeed;
    vec3 p = position;
    float t = uTime * (0.6 + aSeed * 0.8);
    p += vec3(sin(t * 0.21 + aSeed * 40.0), 0.0, cos(t * 0.17 + aSeed * 23.0)) * 0.6;
    p.y = uCenter.y - uSpan + mod(p.y - (uCenter.y - uSpan) + uTime * uRise * (0.5 + aSeed), uSpan * 2.0);
    vec4 mv = viewMatrix * modelMatrix * vec4(p, 1.0);
    float d = -mv.z;
    // Nothing right up against the lens, and a soft fade in and out at the ends of the loop.
    vFade = smoothstep(0.3, 1.2, d) * smoothstep(0.0, 2.0, uSpan - abs(p.y - uCenter.y));
    gl_PointSize = uSize * (0.4 + aSeed) * 300.0 / max(d, 0.5);
    gl_Position = projectionMatrix * mv;
  }
`;
const MOTE_FRAG = /* glsl */ `
  uniform vec3 uColor;
  uniform vec3 uColor2;
  varying float vSeed;
  varying float vFade;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float r = length(c);
    float a = 1.0 - smoothstep(0.0, 0.5, r);
    a *= a;
    vec3 col = mix(uColor, uColor2, step(0.82, vSeed));
    gl_FragColor = vec4(col * a * vFade, 1.0);
  }
`;

/** A cloud of drifting motes in a ball round the cell's middle. */
export function motes(n: number, opts: { radius: number; size: number; rise: number; color: THREE.ColorRepresentation; color2: THREE.ColorRepresentation; seed: number }) {
  const pos = new Float32Array(n * 3);
  const seed = new Float32Array(n);
  let s = opts.seed;
  const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < n; i++) {
    // Evenly through the ball.
    const u = r() * 2 - 1;
    const a = r() * Math.PI * 2;
    const k = Math.cbrt(r()) * opts.radius;
    const q = Math.sqrt(1 - u * u);
    pos[i * 3] = CELL.center.x + Math.cos(a) * q * k;
    pos[i * 3 + 1] = CELL.center.y + u * k;
    pos[i * 3 + 2] = CELL.center.z + Math.sin(a) * q * k;
    seed[i] = r();
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
  const mat = new THREE.ShaderMaterial({
    vertexShader: MOTE_VERT,
    fragmentShader: MOTE_FRAG,
    uniforms: { ...shared, uSize: { value: opts.size }, uRise: { value: opts.rise }, uSpan: { value: opts.radius * 0.8 }, uColor: { value: new THREE.Color(opts.color) }, uColor2: { value: new THREE.Color(opts.color2) } },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  return points;
}

/**
 * Normals from the faces, with none left at zero. A sphere's or a lathe's pole
 * repeats one point, and a copy that only touches flattened triangles gets no
 * normal at all, which a shader turns into NaN, and a NaN into a flashing black
 * speck; such a copy borrows the normal its twins at the same point have.
 */
export function faceNormals(geo: THREE.BufferGeometry) {
  geo.computeVertexNormals();
  const p = geo.attributes.position;
  const n = geo.attributes.normal;
  const key = (i: number) => `${p.getX(i).toFixed(5)},${p.getY(i).toFixed(5)},${p.getZ(i).toFixed(5)}`;
  const sum = new Map<string, THREE.Vector3>();
  const t = new THREE.Vector3();
  for (let i = 0; i < n.count; i++) {
    t.fromBufferAttribute(n, i);
    if (t.lengthSq() < 1e-12) continue;
    const k = key(i);
    sum.set(k, (sum.get(k) ?? new THREE.Vector3()).add(t));
  }
  for (let i = 0; i < n.count; i++) {
    t.fromBufferAttribute(n, i);
    if (t.lengthSq() >= 1e-12) continue;
    const s = sum.get(key(i));
    t.copy(s && s.lengthSq() > 1e-12 ? s : new THREE.Vector3(0, 1, 0)).normalize();
    n.setXYZ(i, t.x, t.y, t.z);
  }
  n.needsUpdate = true;
  return geo;
}

/** Scales a tube's uv's to meters along (u) so ribs keep their size whatever its length. */
export function metersAlong(geo: THREE.BufferGeometry, length: number) {
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * length);
  uv.needsUpdate = true;
  return geo;
}
