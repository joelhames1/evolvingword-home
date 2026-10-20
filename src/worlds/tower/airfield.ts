// The airport at first light, from the top of the tower: one long runway running
// away to the left, a parallel taxiway, an apron and a terminal with jet bridges,
// all its lights still on in the blue morning. Planes push back, taxi out, line up
// and take off; others come down out of the dawn, land and taxi in, on a loop.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { canvas, rng, texture } from '../../textures';
import type { Quality } from '../../world';
import { DAYLIGHT, daylightUniforms, outdoor, pointLights, type DaylightUniforms } from '../outdoor';
import { GROUND } from './cab';

// The airport's own coordinates: s along the runway (0 at the far threshold,
// increasing toward us), o across it (0 on the centerline, increasing to the
// left, toward the apron and the terminal). Everything is laid out in these.
// The tower stands past the near end of the runway, off to the side by the
// apron, so the whole field and the approach lie out in front of the glass.
const U = new THREE.Vector3(0.18, 0, 1).normalize();
const N = new THREE.Vector3(-U.z, 0, U.x);
const B = new THREE.Vector3(-148, GROUND, -2970);
export const RUNWAY = 2600;
const TAXIWAY = 180;
const LANE = 330;
const STAND = 420;
const GATES = [1850, 2000, 2150, 2300, 2450];
const SCALE = 1.25;

/** A point on the airfield, `alt` meters up. */
export const at = (s: number, o: number, alt = 0) => B.clone().addScaledVector(U, s).addScaledVector(N, o).setY(GROUND + alt);

export interface Airfield {
  group: THREE.Group;
  /** The morning's light, for anything else outside that should match. */
  daylight: DaylightUniforms;
  /** What the scope can see: every plane that's out, relative to the tower. */
  blips(): { bearing: number; range: number }[];
  /** Advances everything; returns what started this frame, for the sound. */
  tick(t: number, dt: number, camera: THREE.PerspectiveCamera, renderer: THREE.WebGLRenderer): { takeoff: boolean; landing: boolean };
  debug: Record<string, unknown>;
}

// ---------------------------------------------------------------------------------
// The sky at dawn: the sun just up, low on the right; gold and rose along the
// horizon, a clean pale blue overhead, a few long clouds lit from underneath.

const SKY_VERT = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = position;
    vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    gl_Position = vec4(p.xy, p.w * 0.99999, p.w);
  }
`;
const SKY_FRAG = /* glsl */ `
  varying vec3 vDir;
  uniform vec3 uSunDir;
  uniform vec3 uHaze;
  uniform float uTime;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5); }
  float noise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
  float fbm(vec2 p) { float v = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; } return v; }
  void main() {
    vec3 d = normalize(vDir);
    float e = max(d.y, -0.05);
    float s = max(dot(d, uSunDir), 0.0);
    // Toward the sun the horizon is gold; away from it, rose, then the earth's blue shadow.
    float toward = dot(normalize(d.xz + 1e-4), normalize(uSunDir.xz)) * 0.5 + 0.5;
    vec3 low = mix(vec3(0.42, 0.34, 0.5), vec3(1.05, 0.56, 0.24), pow(toward, 2.0));
    vec3 col = mix(uHaze, low, smoothstep(-0.03, 0.03, e));
    col = mix(col, mix(vec3(0.38, 0.45, 0.72), vec3(0.8, 0.62, 0.55), pow(toward, 3.0)), smoothstep(0.04, 0.2, e));
    col = mix(col, vec3(0.1, 0.18, 0.44), smoothstep(0.2, 0.8, e));
    // The glow round the sun, and the sun itself.
    col += vec3(1.0, 0.55, 0.22) * (pow(s, 10.0) * 0.45 + pow(s, 300.0) * 1.4);
    col += vec3(1.0, 0.82, 0.55) * smoothstep(0.99986, 0.99991, s) * 7.0;
    // Long thin clouds, gold underneath on the sun's side.
    vec2 cuv = d.xz / (e + 0.1) * 0.7 + vec2(uTime * 0.003, 0.0);
    float c = smoothstep(0.55, 0.85, fbm(cuv * vec2(0.5, 3.0)));
    vec3 cloud = mix(vec3(0.75, 0.55, 0.62), vec3(1.0, 0.72, 0.45), toward);
    col = mix(col, cloud, c * smoothstep(0.03, 0.1, e) * (1.0 - smoothstep(0.25, 0.55, e)) * 0.7);
    gl_FragColor = vec4(col, 1.0);
  }
`;

// The ground: grass in the airfield, mown in stripes, farmland beyond; a little
// dew catching the light toward the sun.
const GROUND_VERT = /* glsl */ `
  varying vec3 vWorld;
  void main() {
    vec4 w = modelMatrix * vec4(position, 1.0);
    vWorld = w.xyz;
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;
const GROUND_FRAG = /* glsl */ `
  ${DAYLIGHT}
  uniform vec3 uB;
  uniform vec3 uU;
  uniform vec3 uN;
  varying vec3 vWorld;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5); }
  float noise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
  void main() {
    vec2 rel = vWorld.xz - uB.xz;
    float s = dot(rel, uU.xz);
    float o = dot(rel, uN.xz);
    float n = noise(vWorld.xz * 0.01) * 0.6 + noise(vWorld.xz * 0.05) * 0.4;
    vec3 grass = mix(vec3(0.11, 0.16, 0.07), vec3(0.17, 0.22, 0.09), n);
    // Inside the fence: kept short, mown in long faint stripes along the runway.
    float field = step(-700.0, s) * step(s, ${(RUNWAY + 700).toFixed(1)}) * step(-450.0, o) * step(o, 1100.0);
    float mown = smoothstep(0.3, 0.7, fract(o / 24.0 + noise(vec2(s * 0.004, o * 0.01)) * 0.3));
    grass = mix(grass, grass * (0.94 + 0.08 * mown), field);
    // Outside it: farmland in patches, plowed brown, young wheat, stubble.
    vec2 cell = floor(vWorld.xz / vec2(260.0, 180.0));
    float pick = hash(cell);
    vec3 farm = pick < 0.3 ? vec3(0.22, 0.16, 0.1) : pick < 0.6 ? vec3(0.2, 0.25, 0.11) : pick < 0.8 ? vec3(0.33, 0.29, 0.16) : vec3(0.15, 0.2, 0.1);
    farm *= 0.85 + 0.3 * n;
    vec3 albedo = mix(farm, grass, field);
    vec3 col = daylight(albedo, vec3(0.0, 1.0, 0.0), vWorld);
    // Dew: a soft sheen looking toward the sun.
    vec3 v = normalize(cameraPosition - vWorld);
    vec3 r = reflect(-v, vec3(0.0, 1.0, 0.0));
    col += uSunColor * pow(max(dot(r, uSunDir), 0.0), 30.0) * 0.12;
    gl_FragColor = vec4(fade(col, vWorld), 1.0);
  }
`;

// Paving: the runway with its markings, the taxiways with their yellow lines,
// the apron's concrete slabs and lead-in lines, all drawn from where on the
// airfield each spot is, crisp at any distance.
const PAVE_FRAG = /* glsl */ `
  ${DAYLIGHT}
  uniform vec3 uB;
  uniform vec3 uU;
  uniform vec3 uN;
  uniform float uKind;
  varying vec3 vWorld;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5); }
  float noise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
  float band(float x, float a, float b) { float w = fwidth(x) * 0.8; return smoothstep(a - w, a + w, x) * (1.0 - smoothstep(b - w, b + w, x)); }
  void main() {
    vec2 rel = vWorld.xz - uB.xz;
    float s = dot(rel, uU.xz);
    float o = dot(rel, uN.xz);
    float n = noise(vWorld.xz * 0.2) * 0.5 + noise(vWorld.xz * 0.03) * 0.5;
    vec3 col;
    vec3 white = vec3(0.85);
    vec3 yellow = vec3(0.85, 0.62, 0.12);
    if (uKind < 0.5) {
      // The runway: dark asphalt, rubbered in at the touchdown zone.
      col = vec3(0.09, 0.09, 0.1) * (0.85 + 0.3 * n);
      float rubber = band(s, 250.0, 900.0) * smoothstep(9.0, 2.0, abs(o)) * noise(vec2(s * 0.02, o * 0.6));
      col *= 1.0 - rubber * 0.6;
      float ao = abs(o);
      float paint = band(ao, 21.4, 22.2);
      paint += band(ao, 0.0, 0.45) * step(0.5, fract(s / 60.0)) * band(s, 120.0, ${(RUNWAY - 120).toFixed(1)});
      // Piano keys at each end, aiming points, and touchdown bars.
      float sEnd = min(s, ${RUNWAY.toFixed(1)} - s);
      paint += band(sEnd, 6.0, 36.0) * band(ao, 3.0, 20.0) * step(fract((ao - 3.0) / 2.15), 0.62);
      paint += band(sEnd, 300.0, 360.0) * band(ao, 6.0, 15.0);
      paint += (band(sEnd, 150.0, 172.0) + band(sEnd, 450.0, 472.0) + band(sEnd, 600.0, 622.0)) * band(ao, 5.0, 14.0) * step(fract((ao - 5.0) / 3.0), 0.6);
      col = mix(col, white, clamp(paint, 0.0, 1.0) * 0.9);
    } else if (uKind < 1.5) {
      // Taxiways: a yellow centerline down the middle of each.
      col = vec3(0.13, 0.13, 0.13) * (0.85 + 0.3 * n);
      float c = band(abs(o - ${TAXIWAY.toFixed(1)}), 0.0, 0.3) + band(abs(o - ${LANE.toFixed(1)}), 0.0, 0.3);
      col = mix(col, yellow, clamp(c, 0.0, 1.0) * 0.9);
    } else {
      // The apron: pale concrete in slabs, a lead-in line to each stand.
      col = vec3(0.36, 0.35, 0.33) * (0.88 + 0.22 * n);
      vec2 slab = abs(fract(vec2(s, o) / 7.5) - 0.5);
      col *= 1.0 - 0.18 * (band(slab.x, 0.47, 0.5) + band(slab.y, 0.47, 0.5));
      float c = band(abs(o - ${LANE.toFixed(1)}), 0.0, 0.3);
      ${GATES.map((g) => `c += band(abs(s - ${g.toFixed(1)}), 0.0, 0.25) * band(o, ${LANE.toFixed(1)}, ${(STAND + 18).toFixed(1)});`).join('\n      ')}
      col = mix(col, yellow, clamp(c, 0.0, 1.0) * 0.85);
    }
    col = daylight(col, vec3(0.0, 1.0, 0.0), vWorld);
    vec3 v = normalize(cameraPosition - vWorld);
    vec3 r = reflect(-v, vec3(0.0, 1.0, 0.0));
    col += uSunColor * pow(max(dot(r, uSunDir), 0.0), 60.0) * 0.08;
    gl_FragColor = vec4(fade(col, vWorld), 1.0);
  }
`;

// ---------------------------------------------------------------------------------
// The planes.

/** A twin-jet airliner, nose along +x, about 40m long, painted white with a colored tail. */
function airliner(tail: THREE.Color) {
  const parts: THREE.BufferGeometry[] = [];
  const paint = (g: THREE.BufferGeometry, c: THREE.Color) => {
    const geo = g.index ? g.toNonIndexed() : g;
    geo.deleteAttribute('uv');
    const n = geo.attributes.position.count;
    const col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) c.toArray(col, i * 3);
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    parts.push(geo);
  };
  const white = new THREE.Color('#e9e8e4');
  const belly = new THREE.Color('#b9bcc2');
  const dark = new THREE.Color('#1b1e24');
  const fuse = new THREE.CylinderGeometry(2, 2, 30, 20);
  fuse.rotateZ(Math.PI / 2);
  paint(fuse, white);
  const nose = new THREE.SphereGeometry(2, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2);
  nose.rotateZ(-Math.PI / 2);
  nose.scale(2.1, 1, 1);
  nose.translate(15, 0, 0);
  paint(nose, white);
  const tailCone = new THREE.ConeGeometry(2, 9, 20);
  tailCone.rotateZ(Math.PI / 2);
  tailCone.translate(-19.5, 0.5, 0);
  paint(tailCone, white);
  // A dark stripe of windows down each side, and the cockpit glazing.
  const windows = new THREE.BoxGeometry(24, 0.35, 4.08);
  windows.translate(-1, 0.75, 0);
  paint(windows, dark);
  const cockpit = new THREE.BoxGeometry(1.6, 0.5, 3.0);
  cockpit.translate(17.6, 0.9, 0);
  paint(cockpit, dark);
  // Wings, swept back, and the tailplane.
  const planform = (pts: [number, number][], thick: number, y: number) => {
    const shape = new THREE.Shape(pts.map(([x, z]) => new THREE.Vector2(x, z)));
    const g = new THREE.ExtrudeGeometry(shape, { depth: thick, bevelEnabled: false });
    g.rotateX(Math.PI / 2);
    g.translate(0, y + thick / 2, 0);
    return g;
  };
  paint(
    planform(
      [
        [3, -1.8],
        [-5.5, -17],
        [-8, -17],
        [-5, -1.8],
        [-5, 1.8],
        [-8, 17],
        [-5.5, 17],
        [3, 1.8],
      ],
      0.45,
      -1.1,
    ),
    belly,
  );
  paint(
    planform(
      [
        [-14, -1],
        [-18.5, -6.5],
        [-20, -6.5],
        [-18, -1],
        [-18, 1],
        [-20, 6.5],
        [-18.5, 6.5],
        [-14, 1],
      ],
      0.3,
      1.0,
    ),
    white,
  );
  // The fin, in the airline's color.
  const finShape = new THREE.Shape([new THREE.Vector2(-12, 1.5), new THREE.Vector2(-18.5, 10), new THREE.Vector2(-20.5, 10), new THREE.Vector2(-20.5, 1.5)]);
  const fin = new THREE.ExtrudeGeometry(finShape, { depth: 0.4, bevelEnabled: false });
  fin.translate(0, 0, -0.2);
  paint(fin, tail);
  // Engines under the wings.
  for (const z of [-5.8, 5.8]) {
    const eng = new THREE.CylinderGeometry(1.15, 1.0, 4.6, 16);
    eng.rotateZ(Math.PI / 2);
    eng.translate(0.8, -2.2, z);
    paint(eng, belly);
    const intake = new THREE.CylinderGeometry(0.9, 0.9, 0.1, 16);
    intake.rotateZ(Math.PI / 2);
    intake.translate(3.15, -2.2, z);
    paint(intake, dark);
  }
  return mergeGeometries(parts)!;
}

type Light = 'off' | 'taxi' | 'runway';
interface Leg {
  pts: THREE.Vector3[];
  cum: number[];
  len: number;
  v0: number;
  v1: number;
  /** Pushed back: the plane faces against the way it's going. */
  reverse?: boolean;
  /** Seconds to wait (a hold) instead of moving. */
  hold?: number;
  lights: Light;
  hidden?: boolean;
  event?: 'takeoff' | 'landing';
}

/** A smooth path through airfield points [s, o, alt], sampled by distance. */
function route(points: [number, number, number][], v0: number, v1: number, lights: Light, extra: Partial<Leg> = {}): Leg {
  const curve = new THREE.CatmullRomCurve3(
    points.map(([s, o, a]) => at(s, o, a)),
    false,
    'centripetal',
  );
  const n = Math.max(8, Math.ceil(curve.getLength() / 6));
  const pts = curve.getSpacedPoints(n);
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + pts[i].distanceTo(pts[i - 1]));
  return { pts, cum, len: cum[cum.length - 1], v0, v1, lights, ...extra };
}
const hold = (point: [number, number, number], seconds: number, lights: Light, extra: Partial<Leg> = {}): Leg => ({ pts: [at(...point)], cum: [0], len: 0, v0: 0, v1: 0, hold: seconds, lights, ...extra });

/** How long a leg takes: the speed changes evenly over its length. */
const legTime = (l: Leg) => (l.hold !== undefined ? l.hold : Math.abs(l.v1 - l.v0) < 1e-3 ? l.len / l.v0 : (l.len / (l.v1 - l.v0)) * Math.log(l.v1 / l.v0));

/** Every plane's day: out to the runway, off into the morning, back in to land, and home to its gate. */
function day(gate: number, away: number, dwell: number): Leg[] {
  const g = GATES[gate];
  return [
    hold([g, STAND, 0], dwell, 'off'),
    // Pushed back off the stand and swung round to face along the lane.
    route([[g, STAND, 0], [g + 4, STAND - 45, 0], [g + 42, LANE + 4, 0]], 2.2, 2.2, 'off', { reverse: true }),
    hold([g + 42, LANE + 4, 0], 6, 'taxi'),
    route([[g + 42, LANE + 4, 0], [g - 20, LANE, 0], [1780, LANE, 0], [1750, LANE - 50, 0], [1745, TAXIWAY + 30, 0], [1700, TAXIWAY, 0], [1500, TAXIWAY, 0]], 7, 14, 'taxi'),
    route([[1500, TAXIWAY, 0], [300, TAXIWAY, 0], [0, TAXIWAY, 0], [-45, TAXIWAY - 40, 0], [-45, 40, 0], [-10, 2, 0], [30, 0, 0]], 14, 5, 'taxi'),
    hold([30, 0, 0], 8, 'runway'),
    // The roll, rotation, and the climb out over the right of the field.
    route([[30, 0, 0], [900, 0, 0], [1650, 0, 0]], 6, 78, 'runway', { event: 'takeoff' }),
    route([[1650, 0, 0], [2000, 0, 25], [2700, -20, 110], [4200, -260, 330], [9000, -1500, 1100]], 78, 120, 'runway'),
    hold([9000, -1500, 1100], away, 'off', { hidden: true }),
    // Down the glide slope out of the dawn, touching down by the aiming point.
    route([[-4200, 0, 240], [-1500, 0, 96], [200, 0, 8], [360, 0, 0]], 76, 70, 'runway'),
    route([[360, 0, 0], [1100, 0, 0], [1850, 0, 0]], 70, 20, 'runway', { event: 'landing' }),
    route([[1850, 0, 0], [2050, 40, 0], [2180, 140, 0], [2280, TAXIWAY, 0], [2560, TAXIWAY, 0], [2640, TAXIWAY + 50, 0], [2630, LANE - 10, 0], [2560, LANE, 0]], 18, 9, 'taxi'),
    route([[2560, LANE, 0], [g + 70, LANE, 0], [g + 25, LANE + 20, 0], [g, LANE + 60, 0], [g, STAND, 0]], 8, 2.5, 'taxi'),
  ];
}

interface Plane {
  mesh: THREE.Mesh;
  legs: Leg[];
  leg: number;
  d: number;
  held: number;
  quat: THREE.Quaternion;
  lights: { nav: THREE.Points; taxi: THREE.Points; runway: THREE.Points };
}

export function buildAirfield(quality: Quality): Airfield {
  const group = new THREE.Group();
  const r = rng(909);
  const c = (hex: string) => new THREE.Color(hex);

  // The sun just up over the far right of the field.
  const sunDir = new THREE.Vector3(0.47, 0.13, -0.87).normalize();
  const u = daylightUniforms({
    sunDir,
    sunColor: c('#ffb27a').multiplyScalar(1.6),
    sky: c('#5d6796'),
    ground: c('#2e2522'),
    haze: c('#8c7f93'),
    hazeDensity: 1 / 11000,
    mist: 0.32,
    mistLevel: GROUND,
  });

  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(3000, 48, 24),
    new THREE.ShaderMaterial({ vertexShader: SKY_VERT, fragmentShader: SKY_FRAG, uniforms: { uSunDir: u.uSunDir, uHaze: u.uHaze, uTime: u.uTime }, side: THREE.BackSide, depthWrite: false }),
  );
  sky.renderOrder = -10;
  sky.frustumCulled = false;
  group.add(sky);

  const airport = { uB: { value: B }, uU: { value: U }, uN: { value: N } };
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(10000, 10000), new THREE.ShaderMaterial({ vertexShader: GROUND_VERT, fragmentShader: GROUND_FRAG, uniforms: { ...u, ...airport } }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, GROUND, -1800);
  group.add(ground);

  // Low hills all round the horizon, blue with distance.
  const hillGeo = new THREE.CylinderGeometry(4300, 4300, 1, 128, 1, true);
  const hp = hillGeo.attributes.position;
  for (let i = 0; i < hp.count; i++) {
    const y = hp.getY(i);
    const ang = Math.atan2(hp.getZ(i), hp.getX(i));
    const hgt = 25 + 45 * Math.abs(Math.sin(ang * 3.0 + 1)) * (0.6 + 0.4 * Math.sin(ang * 11.0)) + 12 * Math.sin(ang * 23.0);
    hp.setY(i, y > 0 ? GROUND + hgt : GROUND - 5);
  }
  hillGeo.computeVertexNormals();
  const hills = new THREE.Mesh(hillGeo, outdoor(u, { color: '#4b5560', side: THREE.BackSide }));
  hills.position.z = -1600;
  group.add(hills);

  // Paving: runway, taxiways and connectors, the apron. Each a strip laid between two airfield points.
  const paveMat = (kind: number) =>
    new THREE.ShaderMaterial({
      vertexShader: GROUND_VERT,
      fragmentShader: PAVE_FRAG,
      uniforms: { ...u, ...airport, uKind: { value: kind } },
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });
  const strip = (s0: number, o0: number, s1: number, o1: number, width: number, mat: THREE.Material) => {
    const a = at(s0, o0, 0.05);
    const b = at(s1, o1, 0.05);
    const len = a.distanceTo(b);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(len, width), mat);
    m.rotation.x = -Math.PI / 2;
    m.rotation.z = Math.atan2(-(b.z - a.z), b.x - a.x);
    m.position.copy(a).add(b).multiplyScalar(0.5);
    group.add(m);
  };
  const m4Car = new THREE.Matrix4();
  const runwayMat = paveMat(0);
  const taxiMat = paveMat(1);
  strip(-10, 0, RUNWAY + 10, 0, 46, runwayMat);
  strip(-60, TAXIWAY, RUNWAY + 60, TAXIWAY, 24, taxiMat);
  for (const [s0, o0, s1, o1] of [
    [-45, TAXIWAY, -45, 0],
    [RUNWAY + 45, TAXIWAY, RUNWAY + 45, 0],
    [1850, 0, 2280, TAXIWAY],
    [1000, TAXIWAY, 1000, 0],
    [1750, TAXIWAY, 1750, LANE],
    [2620, TAXIWAY, 2620, LANE],
  ] as const)
    strip(s0, o0, s1, o1, 24, taxiMat);
  // The apron, from the taxilane to the terminal.
  const apronMat = paveMat(2);
  strip(1700, (LANE - 30 + 492) / 2, 2650, (LANE - 30 + 492) / 2, 492 - LANE + 30, apronMat);

  // The terminal: a long low hall of glass, lit inside, its roof catching the sun.
  const [tc, tg] = canvas(1024, 128);
  tg.fillStyle = '#1b1f26';
  tg.fillRect(0, 0, 1024, 128);
  for (let x = 0; x < 1024; x += 16) {
    for (let y = 0; y < 128; y += 42) {
      const lit = r();
      tg.fillStyle = lit < 0.6 ? `rgba(255,${200 + Math.floor(r() * 30)},150,${0.55 + r() * 0.4})` : '#2a3038';
      tg.fillRect(x + 2, y + 6, 12, 32);
    }
  }
  const termTex = texture(tc, { repeat: [6, 1] });
  const termFront = outdoor(u, { color: '#9aa3ad', emissive: c('#ffc890').multiplyScalar(0.9), map: termTex });
  const termRest = outdoor(u, { color: '#b8b4ac' });
  const tLen = 800;
  const terminal = new THREE.Mesh(new THREE.BoxGeometry(tLen, 16, 70), [termRest, termRest, termRest, termRest, termRest, termFront]);
  // Box faces: +x, -x, +y, -y, +z, -z. Turned so -z faces the apron.
  const tMid = at(2150, 525, 8);
  terminal.position.copy(tMid);
  terminal.rotation.y = Math.atan2(-U.z, U.x);
  group.add(terminal);
  const roofLip = new THREE.Mesh(new THREE.BoxGeometry(tLen + 10, 1.4, 80), outdoor(u, { color: '#d6d2c8' }));
  roofLip.position.copy(tMid).add(new THREE.Vector3(0, 8.7, 0));
  roofLip.rotation.y = terminal.rotation.y;
  group.add(roofLip);
  // Jet bridges, out to the stands.
  const bridgeMat = outdoor(u, { color: '#c9ccd0' });
  for (const g of GATES) {
    const a = at(g + 9, 490, 5);
    const b = at(g + 4, 440, 4.5);
    const len = a.distanceTo(b);
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(len, 3, 3.4), bridgeMat);
    bridge.position.copy(a).add(b).multiplyScalar(0.5);
    bridge.rotation.y = Math.atan2(-(b.z - a.z), b.x - a.x);
    group.add(bridge);
    const leg = new THREE.Mesh(new THREE.BoxGeometry(1, 4, 1), bridgeMat);
    leg.position.copy(b).add(new THREE.Vector3(0, -2.5, 0)).addScaledVector(N, 6);
    group.add(leg);
  }

  // At the foot of the tower: the base building, a car park, and the service road out to the apron.
  const baseMat = outdoor(u, { color: '#c4bfb5' });
  const base = new THREE.Mesh(new THREE.BoxGeometry(34, 9, 20), baseMat);
  base.position.set(0, GROUND + 4.5, 9);
  group.add(base);
  const baseRoof = new THREE.Mesh(new THREE.BoxGeometry(35, 0.8, 21), outdoor(u, { color: '#8d8a84' }));
  baseRoof.position.set(0, GROUND + 9.2, 9);
  group.add(baseRoof);
  const tarmac = paveMat(1);
  const lot = new THREE.Mesh(new THREE.PlaneGeometry(40, 26), tarmac);
  lot.rotation.x = -Math.PI / 2;
  lot.position.set(30, GROUND + 0.05, 24);
  group.add(lot);
  const carGeo = new THREE.BoxGeometry(4.3, 1.4, 1.9);
  const cars = new THREE.InstancedMesh(carGeo, outdoor(u, { color: '#ffffff' }), 14);
  for (let i = 0; i < 14; i++) {
    m4Car.compose(new THREE.Vector3(14 + (i % 7) * 5.2, GROUND + 0.8, 16 + Math.floor(i / 7) * 14), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2), new THREE.Vector3(1, 1, 1));
    cars.setMatrixAt(i, m4Car);
    cars.setColorAt(i, c(['#8a1f1f', '#1f2f4a', '#cfcfcf', '#2b2b2b', '#5a6a72', '#e0d8c8'][i % 6]));
  }
  group.add(cars);
  strip(2950, 380 - 60, 2620, LANE + 40, 9, tarmac);

  // Trees along the field boundary and out among the farms.
  const treeCount = quality === 'high' ? 900 : 400;
  const treeGeo = new THREE.IcosahedronGeometry(1, 1);
  treeGeo.scale(1, 1.3, 1);
  const trees = new THREE.InstancedMesh(treeGeo, outdoor(u, { color: '#ffffff' }), treeCount);
  const m4 = new THREE.Matrix4();
  let planted = 0;
  for (let i = 0; i < treeCount; i++) {
    let p: THREE.Vector3;
    if (i < treeCount * 0.35) p = at(-700 + r() * (RUNWAY + 1400), r() < 0.5 ? -470 - r() * 30 : 1120 + r() * 40, 0);
    else p = new THREE.Vector3(-3500 + r() * 7000, GROUND, -4200 + r() * 3600);
    // Keep the field itself clear.
    const rel = p.clone().sub(B);
    const s = rel.dot(U);
    const o = rel.dot(N);
    if (s > -650 && s < RUNWAY + 650 && o > -440 && o < 1090) continue;
    const size = 5 + r() * 6;
    m4.compose(p.setY(GROUND + size * 1.1), new THREE.Quaternion(), new THREE.Vector3(size, size, size));
    trees.setMatrixAt(planted, m4);
    trees.setColorAt(planted++, c(r() < 0.5 ? '#1f2b19' : '#2a3320'));
  }
  trees.count = planted;
  group.add(trees);

  // The windsock by the tower: striped orange and white, stirring in the morning air.
  const [wc, wg] = canvas(256, 64);
  for (let i = 0; i < 5; i++) {
    wg.fillStyle = i % 2 ? '#f2efe9' : '#ff6a1a';
    wg.fillRect(i * 51.2, 0, 52, 64);
  }
  const sockGeo = new THREE.CylinderGeometry(0.35, 0.9, 4.2, 16, 4, true);
  sockGeo.rotateZ(Math.PI / 2);
  sockGeo.translate(-2.1, 0, 0);
  const sock = new THREE.Mesh(sockGeo, outdoor(u, { map: texture(wc), side: THREE.DoubleSide }));
  const sockPivot = new THREE.Group();
  const sockAt = new THREE.Vector3(-40, GROUND + 7, -95);
  sockPivot.position.copy(sockAt);
  sockPivot.add(sock);
  group.add(sockPivot);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.15, 7, 8), outdoor(u, { color: '#d8d8d8' }));
  pole.position.copy(sockAt).add(new THREE.Vector3(0, -3.5, 0));
  group.add(pole);

  // Apron floodlight masts, still burning.
  const mastMat = outdoor(u, { color: '#9a9ea4' });
  const lamps: Parameters<typeof pointLights>[0] = [];
  for (const s of [1760, 2000, 2240, 2480]) {
    const base = at(s, 495, 0);
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.6, 30, 8), mastMat);
    mast.position.copy(base).add(new THREE.Vector3(0, 15, 0));
    group.add(mast);
    for (let k = -1; k <= 1; k++) lamps.push({ pos: base.clone().add(new THREE.Vector3(0, 30.5, 0)).addScaledVector(U, k * 1.4), color: c('#ffcf8a').multiplyScalar(2.2), size: 3.5 });
  }

  // --- the field's lights -----------------------------------------------------------
  const white = c('#fff4e0').multiplyScalar(2.4);
  const amber = c('#ffc35a').multiplyScalar(2.4);
  const green = c('#4dff7a').multiplyScalar(2.4);
  const red = c('#ff3b2a').multiplyScalar(2.4);
  const blue = c('#4a7dff').multiplyScalar(2.6);
  const ground_: Parameters<typeof pointLights>[0] = [...lamps];
  for (let s = 0; s <= RUNWAY; s += 60) for (const o of [-23, 23]) ground_.push({ pos: at(s, o, 0.4), color: s > RUNWAY - 600 ? amber : white, size: 2.4 });
  for (let s = 15; s < RUNWAY; s += 30) ground_.push({ pos: at(s, 0, 0.2), color: s > RUNWAY - 300 ? red : s > RUNWAY - 900 && (s / 30) % 2 < 1 ? red : white, size: 1.6 });
  for (let o = -21; o <= 21; o += 3) {
    ground_.push({ pos: at(-2, o, 0.3), color: green, size: 2.2 });
    ground_.push({ pos: at(RUNWAY + 2, o, 0.3), color: red, size: 2.2 });
  }
  // The approach lights out beyond the threshold, with the "rabbit" racing in along them.
  for (let k = 1; k <= 15; k++) {
    const s = -k * 60;
    for (let o = -6; o <= 6; o += 2) ground_.push({ pos: at(s, o, 1), color: white, size: 1.6 });
    ground_.push({ pos: at(s, 0, 1.5), color: c('#ffffff').multiplyScalar(6), size: 6, blink: 1.0, phase: k / 15, duty: 0.05 });
  }
  // PAPI: two white over two red, on the glide slope.
  for (let k = 0; k < 4; k++) ground_.push({ pos: at(320, -32 - k * 9, 0.8), color: k < 2 ? white : red, size: 2.6 });
  for (let s = -60; s <= RUNWAY + 60; s += 40) for (const o of [TAXIWAY - 13, TAXIWAY + 13]) ground_.push({ pos: at(s, o, 0.3), color: blue, size: 1.8 });
  for (let o = 0; o <= TAXIWAY; o += 15) for (const s of [-45, RUNWAY + 45, 1000]) ground_.push({ pos: at(s, o, 0.2), color: green, size: 1.4 });
  const fieldLights = pointLights(ground_, u);
  group.add(fieldLights);

  // A couple of tugs pottering round the apron, beacons flashing.
  const tugs: { obj: THREE.Group; s: number; o: number; phase: number; speed: number }[] = [];
  const tugMat = outdoor(u, { color: '#e7b43a' });
  for (let i = 0; i < 2; i++) {
    const obj = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(4, 1.8, 2.2), tugMat);
    body.position.y = 0.9;
    obj.add(body);
    obj.add(pointLights([{ pos: new THREE.Vector3(0, 2.1, 0), color: amber.clone().multiplyScalar(1.5), size: 3, blink: 0.8, phase: i * 0.4, duty: 0.3 }], u));
    group.add(obj);
    tugs.push({ obj, s: 2050 + i * 300, o: 375, phase: r() * 6, speed: 0.05 + r() * 0.03 });
  }

  // --- the planes ---------------------------------------------------------------------
  const liveries = ['#1f4e9c', '#d9622b', '#1f7a6d', '#7a2742'].map((h) => airliner(c(h)));
  const planeMat = outdoor(u, { vertexColors: true });
  const navPoints = (): THREE.Points =>
    pointLights(
      [
        { pos: new THREE.Vector3(-6.5, -0.6, -17.2), color: red, size: 2 },
        { pos: new THREE.Vector3(-6.5, -0.6, 17.2), color: green, size: 2 },
        { pos: new THREE.Vector3(-24, 0.6, 0), color: white, size: 1.6 },
        { pos: new THREE.Vector3(-2, 2.2, 0), color: red.clone().multiplyScalar(1.6), size: 2.6, blink: 1.1, phase: r(), duty: 0.18 },
        { pos: new THREE.Vector3(-2, -2.2, 0), color: red.clone().multiplyScalar(1.6), size: 2.6, blink: 1.1, phase: r(), duty: 0.18 },
      ],
      u,
    );
  const runwayPoints = (): THREE.Points =>
    pointLights(
      [
        // Strobes on the wingtips: a double flash.
        ...[-17.3, 17.3].flatMap((z) => [0, 0.11].map((ph) => ({ pos: new THREE.Vector3(-6.7, -0.6, z), color: c('#ffffff').multiplyScalar(6), size: 5, blink: 1.2, phase: ph, duty: 0.05 }))),
        // Landing lights in the wing roots.
        { pos: new THREE.Vector3(2, -1.2, -3), color: c('#fffaf0').multiplyScalar(5), size: 9 },
        { pos: new THREE.Vector3(2, -1.2, 3), color: c('#fffaf0').multiplyScalar(5), size: 9 },
      ],
      u,
    );
  const taxiPoints = (): THREE.Points => pointLights([{ pos: new THREE.Vector3(16, -2.6, 0), color: c('#fff6e6').multiplyScalar(3.5), size: 4 }], u);

  // Four planes on the loop, spaced evenly round it; the other stand has a plane parked all morning.
  const COUNT = 4;
  const sample = day(0, 0, 0);
  const busy = sample.reduce((sum, l) => sum + legTime(l), 0);
  // Landings come halfway between takeoffs, so the runway is never wanted twice at once.
  const iTakeoff = sample.findIndex((l) => l.event === 'takeoff');
  const iAway = sample.findIndex((l) => l.hidden);
  const iLanding = sample.findIndex((l) => l.event === 'landing');
  const between = (from: number, to: number) => sample.slice(from, to).reduce((sum, l) => sum + legTime(l), 0);
  const flying = between(iTakeoff, iAway) + between(iAway + 1, iLanding);
  let spacing = Math.ceil((busy + 60) / COUNT / 10) * 10;
  let away = 0;
  let dwell = 0;
  for (;;) {
    away = spacing / 2 - (flying % spacing);
    while (away < 40) away += spacing;
    dwell = spacing * COUNT - busy - away;
    if (dwell >= 30) break;
    spacing += 10;
  }
  const cycle = spacing * COUNT;

  const planes: Plane[] = [];
  for (let k = 0; k < COUNT; k++) {
    const mesh = new THREE.Mesh(liveries[k % liveries.length], planeMat);
    // A touch bigger than life, so they read from the tower.
    mesh.scale.setScalar(SCALE);
    const lights = { nav: navPoints(), taxi: taxiPoints(), runway: runwayPoints() };
    mesh.add(lights.nav, lights.taxi, lights.runway);
    group.add(mesh);
    planes.push({ mesh, legs: day(k, away, dwell), leg: 0, d: 0, held: 0, quat: new THREE.Quaternion(), lights });
  }
  const parked = new THREE.Mesh(liveries[3], planeMat);
  parked.scale.setScalar(SCALE);
  parked.position.copy(at(GATES[4], STAND, 0)).add(new THREE.Vector3(0, 3.3 * SCALE, 0));
  parked.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(N, new THREE.Vector3(0, 1, 0), N.clone().cross(new THREE.Vector3(0, 1, 0))));
  parked.add(navPoints());
  group.add(parked);

  const up = new THREE.Vector3(0, 1, 0);
  const fwd = new THREE.Vector3();
  const side = new THREE.Vector3();
  const lift = new THREE.Vector3();
  const basis = new THREE.Matrix4();
  const aim = new THREE.Quaternion();
  const pos = new THREE.Vector3();
  /** Where along its leg a plane is, and which way it's facing. */
  const place = (p: Plane, dt: number, snap: boolean) => {
    const leg = p.legs[p.leg];
    if (leg.hold !== undefined) pos.copy(leg.pts[0]);
    else {
      let i = 1;
      while (i < leg.cum.length - 1 && leg.cum[i] < p.d) i++;
      const k = THREE.MathUtils.clamp((p.d - leg.cum[i - 1]) / Math.max(leg.cum[i] - leg.cum[i - 1], 1e-6), 0, 1);
      pos.copy(leg.pts[i - 1]).lerp(leg.pts[i], k);
      fwd.subVectors(leg.pts[i], leg.pts[i - 1]).normalize();
      if (leg.reverse) fwd.negate();
      side.crossVectors(fwd, up).normalize();
      lift.crossVectors(side, fwd);
      basis.makeBasis(fwd, lift, side);
      aim.setFromRotationMatrix(basis);
      if (snap) p.quat.copy(aim);
      else p.quat.slerp(aim, 1 - Math.exp(-dt * 2.5));
    }
    // Wheels on the ground: the fuselage rides 3.3m up.
    p.mesh.position.copy(pos).add(new THREE.Vector3(0, 3.3 * SCALE, 0));
    p.mesh.quaternion.copy(p.quat);
    p.mesh.visible = !leg.hidden;
    p.lights.taxi.visible = leg.lights === 'taxi';
    p.lights.runway.visible = leg.lights === 'runway';
  };
  /** Moves a plane on through its day; returns any event of a leg it began. */
  const advance = (p: Plane, dt: number) => {
    let event: Leg['event'];
    let left = dt;
    while (left > 0) {
      const leg = p.legs[p.leg];
      if (leg.hold !== undefined) {
        const use = Math.min(left, leg.hold - p.held);
        p.held += use;
        left -= use;
        if (p.held < leg.hold - 1e-6) break;
      } else {
        const v = leg.v0 + (leg.v1 - leg.v0) * (p.d / Math.max(leg.len, 1e-6));
        const step = Math.max(v, 0.5) * left;
        if (p.d + step < leg.len) {
          p.d += step;
          break;
        }
        left -= (leg.len - p.d) / Math.max(v, 0.5);
      }
      p.leg = (p.leg + 1) % p.legs.length;
      p.d = 0;
      p.held = 0;
      event = p.legs[p.leg].event ?? event;
    }
    return event;
  };
  // Spread them round the loop before the first frame, with the first one about
  // to roll a little after a visitor has flown in.
  const toRoll = planes[0].legs.slice(0, iTakeoff).reduce((sum, l) => sum + legTime(l), 0);
  planes.forEach((p, k) => {
    for (let t = 0; t < toRoll - 35 + k * spacing; t += 0.5) advance(p, 0.5);
    place(p, 0, true);
  });

  // Everything with lights that need sizing to the lens.
  const fits: { fit(c: THREE.PerspectiveCamera, r: THREE.WebGLRenderer): void }[] = [];
  group.traverse((o) => 'fit' in o && fits.push(o as unknown as (typeof fits)[number]));

  const toTower = new THREE.Vector3();
  return {
    group,
    daylight: u,
    blips: () =>
      planes
        .filter((p) => p.mesh.visible)
        .map((p) => {
          toTower.copy(p.mesh.position);
          return { bearing: Math.atan2(toTower.x, -toTower.z), range: Math.min(0.95, Math.hypot(toTower.x, toTower.z) / 9000) };
        }),
    tick(t, dt, camera, renderer) {
      u.uTime.value = t;
      sky.position.copy(camera.position);
      let takeoff = false;
      let landing = false;
      for (const p of planes) {
        const e = advance(p, dt);
        if (e === 'takeoff') takeoff = true;
        if (e === 'landing') landing = true;
        place(p, dt, false);
      }
      for (const tug of tugs) {
        // A lazy figure of eight between the stands.
        const spot = (a: number) => at(tug.s + Math.cos(a) * 120, tug.o + Math.sin(a * 2) * 25, 0);
        const a = t * tug.speed + tug.phase;
        const here = spot(a);
        const ahead = spot(a + 0.01);
        tug.obj.position.copy(here);
        tug.obj.rotation.y = Math.atan2(-(ahead.z - here.z), ahead.x - here.x);
      }
      sockPivot.rotation.y = -0.6 + Math.sin(t * 0.4) * 0.15;
      sockPivot.rotation.z = -0.25 + Math.sin(t * 1.3) * 0.05;
      for (const f of fits) f.fit(camera, renderer);
      return { takeoff, landing };
    },
    debug: {
      planes,
      cycle,
      spacing,
      away,
      dwell,
      at,
      /** Runs the planes on by some seconds, for screenshots (software rendering crawls). */
      skip(seconds: number) {
        for (const p of planes) {
          for (let t = 0; t < seconds; t += 0.5) advance(p, 0.5);
          place(p, 0, true);
        }
      },
    },
  };
}
