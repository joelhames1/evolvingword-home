// The light in the house: the low sun through the glass (and the shadows of
// every bar and leaf it throws), the warm sky all round, shafts of it hanging in
// the dusty air with motes turning in them, and, when a shower passes, the rain
// coming down outside. The shafts and the dust are drawn on the graphics card
// from a few numbers each; nothing about them is touched per frame but the time.
import * as THREE from 'three';
import { HOUSE, SUN } from './plan';

const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

/** The layer the sun's shadows are drawn from: only what's put on it casts one (bars, benches, plants, the bigger pieces), not every little thing. */
export const SUN_SHADOW = 2;

/** Lets an object (and everything in it) throw a shadow in the low sun. */
export function castsSun(o: THREE.Object3D) {
  o.traverse((c) => {
    if ((c as THREE.Mesh).isMesh) c.layers.enable(SUN_SHADOW);
  });
}

export interface Light {
  group: THREE.Group;
  sun: THREE.DirectionalLight;
  /** Per frame: the time, and how hard it's raining (0..1). */
  tick(t: number, rain: number): void;
}

/** The shafts: where each enters the house, how far it runs, how wide, and how bright. */
const SHAFTS: [THREE.Vector3, number, number, number][] = [
  [v(-5.95, 2.6, -1.2), 8.5, 0.55, 0.9],
  [v(-5.95, 1.7, -0.3), 6.0, 0.4, 0.7],
  [v(-4.2, 3.35, -0.9), 7.5, 0.7, 0.75],
  [v(-2.6, 3.0, -1.55), 6.5, 0.45, 0.65],
  [v(-0.6, 2.25, -2.15), 4.5, 0.38, 0.55],
  [v(1.6, 2.0, -2.15), 4.0, 0.42, 0.5],
];

const SHAFT_VERT = /* glsl */ `
  attribute vec4 aShaft;
  attribute vec3 aFrom;
  uniform vec3 uDir;
  varying vec2 vUv;
  varying vec3 vWorld;
  varying float vBright;
  void main() {
    // A ribbon along the sun's direction, turned about its own length to face the eye.
    float len = aShaft.x;
    float width = aShaft.y;
    vec3 mid = aFrom + uDir * len * 0.5;
    vec3 side = cross(uDir, normalize(cameraPosition - mid));
    side = length(side) > 1e-4 ? normalize(side) : vec3(1.0, 0.0, 0.0);
    vec3 p = aFrom + uDir * len * position.y + side * width * position.x;
    vUv = vec2(position.x, position.y);
    vWorld = p;
    vBright = aShaft.z;
    gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
  }
`;
const SHAFT_FRAG = /* glsl */ `
  uniform float uTime;
  uniform float uLevel;
  varying vec2 vUv;
  varying vec3 vWorld;
  varying float vBright;
  float h(vec3 p) { p = fract(p * 0.1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
  float n3(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(h(i), h(i + vec3(1, 0, 0)), f.x), mix(h(i + vec3(0, 1, 0)), h(i + vec3(1, 1, 0)), f.x), f.y),
               mix(mix(h(i + vec3(0, 0, 1)), h(i + vec3(1, 0, 1)), f.x), mix(h(i + vec3(0, 1, 1)), h(i + vec3(1, 1, 1)), f.x), f.y), f.z);
  }
  void main() {
    // Soft across, fading in where it comes through the glass and out as it spreads.
    float across = exp(-vUv.x * vUv.x * 7.0);
    float along = smoothstep(0.0, 0.08, vUv.y) * (1.0 - smoothstep(0.45, 1.0, vUv.y));
    // Dust drifting through it.
    float dust = 0.65 + 0.35 * n3(vWorld * 2.2 + vec3(uTime * 0.05, uTime * 0.02, 0.0));
    // Never flaring across the lens: nothing within a step of the eye.
    float near = smoothstep(0.4, 1.6, distance(vWorld, cameraPosition));
    float a = across * along * dust * near * vBright * uLevel;
    gl_FragColor = vec4(vec3(1.0, 0.78, 0.46) * a * 0.09, 1.0);
  }
`;

const DUST_VERT = /* glsl */ `
  attribute vec4 aMote;
  attribute vec3 aFrom;
  uniform vec3 uDir;
  uniform float uTime;
  uniform float uPx;
  varying float vA;
  void main() {
    // Each mote rides in its shaft, turning slowly about where it hangs.
    float len = aMote.w;
    vec3 side = normalize(cross(uDir, vec3(0.0, 1.0, 0.0)));
    vec3 up = cross(side, uDir);
    float t = uTime * (0.04 + aMote.z * 0.05);
    vec3 p = aFrom + uDir * len * aMote.x + side * aMote.y + up * (aMote.z - 0.5) * 0.4;
    p += vec3(sin(t + aMote.x * 40.0), sin(t * 0.7 + aMote.y * 30.0) * 0.6, cos(t * 0.9 + aMote.z * 20.0)) * 0.12;
    vec4 mv = viewMatrix * vec4(p, 1.0);
    float twinkle = 0.5 + 0.5 * sin(uTime * (1.5 + aMote.z * 3.0) + aMote.x * 50.0);
    float edge = exp(-aMote.y * aMote.y * 18.0);
    vA = twinkle * edge * smoothstep(0.3, 1.0, -mv.z) * (1.0 - smoothstep(0.75, 1.0, aMote.x));
    gl_PointSize = clamp(uPx * 2.2 / max(-mv.z, 0.2), 1.0, 5.0);
    gl_Position = projectionMatrix * mv;
  }
`;
const DUST_FRAG = /* glsl */ `
  uniform float uLevel;
  varying float vA;
  void main() {
    float r = length(gl_PointCoord - 0.5) * 2.0;
    gl_FragColor = vec4(vec3(1.0, 0.86, 0.6) * vA * uLevel * smoothstep(1.0, 0.0, r) * 0.9, 1.0);
  }
`;

const RAIN_VERT = /* glsl */ `
  attribute vec3 aSeed;
  uniform float uTime;
  uniform vec3 uBox0;
  uniform vec3 uBox1;
  varying float vA;
  varying float vY;
  void main() {
    vec3 size = uBox1 - uBox0;
    // Each streak falls through the box and comes round again, a little slanted by the breeze.
    float fall = fract(aSeed.y - uTime * (0.9 + aSeed.z * 0.4) * 7.0 / size.y);
    vec3 head = uBox0 + vec3(aSeed.x * size.x + fall * 0.5, fall * size.y, aSeed.z * size.z);
    // A thin vertical ribbon facing the eye.
    vec3 toEye = cameraPosition - head;
    vec3 side = normalize(vec3(-toEye.z, 0.0, toEye.x) + 1e-5);
    vec3 p = head + vec3(0.0, position.y * 0.32, 0.0) + side * position.x * 0.006 + vec3(position.y * 0.02, 0.0, 0.0);
    vY = position.y;
    vec4 mv = viewMatrix * vec4(p, 1.0);
    vA = smoothstep(0.6, 2.5, -mv.z);
    gl_Position = projectionMatrix * mv;
  }
`;
const RAIN_FRAG = /* glsl */ `
  uniform float uLevel;
  varying float vA;
  varying float vY;
  void main() {
    gl_FragColor = vec4(vec3(0.75, 0.78, 0.82) * vA * uLevel * (0.2 + 0.8 * vY) * 0.35, 1.0);
  }
`;

export function buildLight(quality: 'high' | 'low'): Light {
  const group = new THREE.Group();
  const high = quality === 'high';
  const dir = SUN.clone().negate();

  // The sun, low, golden, throwing every bar's shadow across the floor and the wall.
  const sun = new THREE.DirectionalLight('#ffbb6a', 6.5);
  sun.position.copy(SUN).multiplyScalar(30).add(v(0, 0, 0.3));
  sun.target.position.set(0, 0, 0.3);
  sun.castShadow = true;
  sun.shadow.mapSize.set(high ? 2048 : 1024, high ? 2048 : 1024);
  const sc = sun.shadow.camera;
  sc.left = -6.5;
  sc.right = 6.5;
  sc.top = 7;
  sc.bottom = -3;
  sc.layers.set(SUN_SHADOW);
  sc.near = 12;
  sc.far = 48;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.02;
  group.add(sun, sun.target);
  // The sky through all that glass, faint: the shade stays shade, warm from the brick and the earth.
  const sky = new THREE.HemisphereLight('#e8d2b8', '#7a4a2a', 0.16);
  group.add(sky);
  // A little warm bounce off the sunlit back wall and floor, toward the benches.
  const bounce = new THREE.PointLight('#ffa060', 1.4, 10, 1.3);
  bounce.position.set(1.0, 1.6, 1.8);
  group.add(bounce);

  // --- the shafts ----------------------------------------------------------------------------------
  const quad = new THREE.PlaneGeometry(2, 1, 1, 8);
  quad.translate(0, 0.5, 0);
  const shaftGeo = new THREE.InstancedBufferGeometry();
  shaftGeo.index = quad.index;
  shaftGeo.setAttribute('position', quad.attributes.position);
  shaftGeo.setAttribute('aFrom', new THREE.InstancedBufferAttribute(new Float32Array(SHAFTS.flatMap(([p]) => p.toArray())), 3));
  shaftGeo.setAttribute('aShaft', new THREE.InstancedBufferAttribute(new Float32Array(SHAFTS.flatMap(([, len, w, b]) => [len, w, b, 0])), 4));
  shaftGeo.instanceCount = SHAFTS.length;
  const level = { value: 1 };
  const time = { value: 0 };
  const shafts = new THREE.Mesh(
    shaftGeo,
    new THREE.ShaderMaterial({
      vertexShader: SHAFT_VERT,
      fragmentShader: SHAFT_FRAG,
      uniforms: { uDir: { value: dir }, uTime: time, uLevel: level },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    }),
  );
  shafts.frustumCulled = false;
  shafts.renderOrder = 3;
  group.add(shafts);

  // --- the dust in them ----------------------------------------------------------------------------
  const N = high ? 700 : 350;
  const from = new Float32Array(N * 3);
  const mote = new Float32Array(N * 4);
  for (let i = 0; i < N; i++) {
    const [p, len, w] = SHAFTS[i % SHAFTS.length];
    p.toArray(from, i * 3);
    mote.set([Math.random(), (Math.random() - 0.5) * w * 1.2, Math.random(), len], i * 4);
  }
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
  dustGeo.setAttribute('aFrom', new THREE.BufferAttribute(from, 3));
  dustGeo.setAttribute('aMote', new THREE.BufferAttribute(mote, 4));
  const dust = new THREE.Points(
    dustGeo,
    new THREE.ShaderMaterial({
      vertexShader: DUST_VERT,
      fragmentShader: DUST_FRAG,
      uniforms: { uDir: { value: dir }, uTime: time, uLevel: level, uPx: { value: high ? 1.5 : 1 } },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  dust.frustumCulled = false;
  dust.renderOrder = 3;
  group.add(dust);

  // --- the rain, outside the glass ---------------------------------------------------------------------
  const R = high ? 1400 : 700;
  const streak = new THREE.PlaneGeometry(1, 1, 1, 1);
  streak.translate(0, 0.5, 0);
  const rainGeo = new THREE.InstancedBufferGeometry();
  rainGeo.index = streak.index;
  rainGeo.setAttribute('position', streak.attributes.position);
  const seeds = new Float32Array(R * 3);
  for (let i = 0; i < R * 3; i++) seeds[i] = Math.random();
  rainGeo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seeds, 3));
  rainGeo.instanceCount = R;
  const rainLevel = { value: 0 };
  const rain = new THREE.Mesh(
    rainGeo,
    new THREE.ShaderMaterial({
      vertexShader: RAIN_VERT,
      fragmentShader: RAIN_FRAG,
      uniforms: { uTime: time, uLevel: rainLevel, uBox0: { value: v(-18, 0, -18) }, uBox1: { value: v(16, 9, HOUSE.kneeOut - 0.4) } },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  rain.frustumCulled = false;
  rain.visible = false;
  group.add(rain);

  return {
    group,
    sun,
    tick(t, wet) {
      time.value = t;
      // A shower dims the sun and the shafts with it.
      const k = 1 - wet * 0.55;
      sun.intensity = 6.5 * k;
      level.value = 1 - wet * 0.85;
      sky.intensity = 0.16 + wet * 0.12;
      rainLevel.value = wet;
      rain.visible = wet > 0.01;
    },
  };
}
