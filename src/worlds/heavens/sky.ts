// The night sky over the peak: a moonless sky, the Milky Way rising out of the
// south with its dust lanes, thousands of stars in their real colors twinkling
// harder near the horizon, a few planets that don't twinkle at all, faint
// airglow and the zodiacal light low in the west, and now and then a meteor.
// It all wheels slowly round the pole, faster than the real sky (so you can
// see it go) but still slowly.
import * as THREE from 'three';
import { rng } from '../../textures';
import type { Quality } from '../../world';

/** Degrees the sky turns each second. The real sky does a fifth of that... per minute. */
export const WHEEL = 0.05;
/** How far north we are: the pole stands this high over the northern horizon (+z). */
const LATITUDE = THREE.MathUtils.degToRad(20);
export const POLE = new THREE.Vector3(0, Math.sin(LATITUDE), Math.cos(LATITUDE));

/** A direction on the sky: azimuth from south (−z) round through west (+x), and elevation, in degrees. */
export const dir = (az: number, el: number) => {
  const a = THREE.MathUtils.degToRad(az);
  const e = THREE.MathUtils.degToRad(el);
  return new THREE.Vector3(Math.sin(a) * Math.cos(e), Math.sin(e), -Math.cos(a) * Math.cos(e));
};

// The galaxy as it stands at the start: its heart in the south, up and to the
// left of the desk's view, the band climbing to the upper right and over the top.
const CORE = dir(-24, 17);
const GAL_POLE = new THREE.Vector3().crossVectors(CORE, dir(42, 66)).normalize();

const NOISE = /* glsl */ `
  float hash3(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
  float noise3(vec3 x) {
    vec3 i = floor(x);
    vec3 f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(hash3(i), hash3(i + vec3(1, 0, 0)), f.x), mix(hash3(i + vec3(0, 1, 0)), hash3(i + vec3(1, 1, 0)), f.x), f.y),
               mix(mix(hash3(i + vec3(0, 0, 1)), hash3(i + vec3(1, 0, 1)), f.x), mix(hash3(i + vec3(0, 1, 1)), hash3(i + vec3(1, 1, 1)), f.x), f.y), f.z);
  }
  float fbm3(vec3 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < OCTAVES; i++) { v += a * noise3(p); p = p * 2.07 + vec3(1.7, 9.2, 3.3); a *= 0.5; }
    return v;
  }
`;

/** The Milky Way's picture is kept brightened this much, so its faint parts keep their detail. */
const MW_SCALE = 4;

const SKY_VERT = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = position;
    vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    // Pinned to the far plane: always behind everything else.
    gl_Position = vec4(p.xy, p.w * 0.99999, p.w);
  }
`;

// The Milky Way, worked out once into a picture of the whole sky (longitude
// across, latitude up) on the celestial sphere: galactic longitude l (0 at the
// heart) and latitude. Color in rgb (square-rooted, for the dark end), and how
// deep in the band each point is in alpha.
const MW_BAKE = /* glsl */ `
  uniform vec3 uCore;
  uniform vec3 uGalPole;
  varying vec2 vUv;
  ${NOISE}
  void main() {
    float lon = (vUv.x - 0.5) * 6.2831853;
    float la = (vUv.y - 0.5) * 3.1415927;
    vec3 s = vec3(cos(la) * sin(lon), sin(la), cos(la) * cos(lon));
    float b = dot(s, uGalPole);
    vec3 flat_ = normalize(s - uGalPole * b + 1e-5);
    float l = atan(dot(flat_, cross(uGalPole, uCore)), dot(flat_, uCore));
    float lat = asin(clamp(b, -1.0, 1.0));
    float heart = exp(-l * l / 0.3);
    // Narrow out along the arms, swelling round the heart; fading toward the far side.
    float width = 0.07 + 0.09 * heart;
    float band = exp(-lat * lat / (width * width));
    float along = 0.28 + 0.72 * exp(-l * l / 2.0);
    // Clumpy star clouds, and a fine mottle of stars too faint to see one by one.
    float c1 = fbm3(s * 4.0);
    float c2 = fbm3(s * 10.0 + 3.0);
    float clouds = smoothstep(0.3, 0.8, c1 * 0.6 + c2 * 0.5);
    float grain = noise3(s * 60.0) * 0.55 + noise3(s * 130.0) * 0.45;
    float glow = band * along * (0.18 + 1.5 * clouds) * (0.65 + 0.7 * grain);
    // The bulge: a bright swollen glow round the heart.
    glow += heart * exp(-lat * lat / 0.024) * (1.2 + 1.0 * c2) * (0.8 + 0.4 * grain);
    // A wide faint skirt either side.
    glow += exp(-lat * lat / 0.06) * along * 0.1;
    // Dust: a dark rift down the middle from the heart, thin winding lanes, and patches.
    float wob = 0.022 * sin(l * 2.6 + 0.8) + 0.03 * (fbm3(s * 3.0 + 7.0) - 0.5);
    float rift = exp(-pow((lat - wob) / (0.014 + 0.012 * heart), 2.0)) * smoothstep(1.8, 0.2, abs(l + 0.4));
    float ridge = 1.0 - abs(fbm3(s * 6.0 + 5.0) * 2.0 - 1.0);
    float lanes = smoothstep(0.82, 0.97, ridge) * exp(-lat * lat / 0.03);
    float patches = smoothstep(0.52, 0.86, fbm3(s * 9.0 + 13.0)) * band;
    // The rift breaks up along its length into a chain of dark clouds, never quite black.
    rift *= 0.35 + 0.65 * smoothstep(0.35, 0.65, fbm3(s * 5.0 + 2.0));
    float dust = clamp(rift * (0.45 + 0.5 * patches) + lanes * 0.5 + patches * 0.22, 0.0, 0.75);
    // Colors: gold toward the heart, a cool white out along the arms; the light
    // that gets through the dust's edges reddened.
    vec3 tint = mix(vec3(0.74, 0.82, 1.0), vec3(1.0, 0.78, 0.52), smoothstep(0.0, 1.0, heart * 1.3));
    tint = mix(tint, vec3(1.0, 0.7, 0.5), smoothstep(0.1, 0.5, dust) * 0.6);
    vec3 mw = tint * glow * (1.0 - dust) * 0.1;
    // Pink glowing gas here and there, mostly near the heart.
    float gas = smoothstep(0.66, 0.86, fbm3(s * 13.0 + 21.0)) * band * (0.25 + heart);
    mw += vec3(1.0, 0.3, 0.42) * gas * 0.022 * (1.0 - dust);
    gl_FragColor = vec4(sqrt(clamp(mw * ${MW_SCALE.toFixed(1)}, 0.0, 1.0)), band * (1.0 - dust * 0.7));
  }
`;

const SKY_FRAG = /* glsl */ `
  uniform mat3 uToSky;
  uniform sampler2D uMilky;
  uniform vec3 uZodiac;
  uniform vec3 uCity;
  varying vec3 vDir;
  float hash3(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
  float noise3(vec3 x) {
    vec3 i = floor(x);
    vec3 f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(hash3(i), hash3(i + vec3(1, 0, 0)), f.x), mix(hash3(i + vec3(0, 1, 0)), hash3(i + vec3(1, 1, 0)), f.x), f.y),
               mix(mix(hash3(i + vec3(0, 0, 1)), hash3(i + vec3(1, 0, 1)), f.x), mix(hash3(i + vec3(0, 1, 1)), hash3(i + vec3(1, 1, 1)), f.x), f.y), f.z);
  }
  void main() {
    vec3 d = normalize(vDir);
    float e = d.y;
    float h = max(e, 0.0);
    // The dark sky: a deep blue overhead, a little paler toward the horizon.
    vec3 col = mix(vec3(0.0042, 0.0058, 0.013), vec3(0.0018, 0.0024, 0.0062), smoothstep(0.0, 0.7, h));
    // Airglow: a faint green band low down, and a dull red one higher still.
    col += vec3(0.003, 0.0085, 0.0055) * exp(-pow((h - 0.05) / 0.05, 2.0));
    col += vec3(0.004, 0.0016, 0.002) * exp(-pow((h - 0.18) / 0.1, 2.0));

    // The Milky Way, from its picture, on the turning sky.
    vec3 s = uToSky * d;
    vec2 uv = vec2(atan(s.x, s.z) / 6.2831853 + 0.5, asin(clamp(s.y, -1.0, 1.0)) / 3.1415927 + 0.5);
    vec4 m = texture2D(uMilky, uv);
    vec3 mw = m.rgb * m.rgb / ${MW_SCALE.toFixed(1)};
    // A dust of separate tiny stars over it, thickest in the band: too fine to keep in the picture.
    float specks = pow(noise3(s * 420.0), 16.0) * 4.0 + pow(noise3(s * 260.0 + 9.0), 18.0) * 3.0;
    mw *= 0.9 + specks * m.a;
    // Thinned near the horizon, where we look through more air.
    float clear = smoothstep(-0.02, 0.2, e);
    col += mw * (0.2 + 0.8 * clear);

    // The zodiacal light: a faint leaning cone along the ecliptic out of the west.
    float z = max(dot(d, normalize(uZodiac)), 0.0);
    col += vec3(0.022, 0.019, 0.015) * pow(z, 7.0) * smoothstep(-0.02, 0.06, e) * (1.0 - smoothstep(0.1, 0.6, h));
    // A town's glow under the clouds, far off and very faint.
    float c = max(dot(normalize(vec3(d.x, 0.0, d.z)), uCity), 0.0);
    col += vec3(0.02, 0.011, 0.005) * pow(c, 18.0) * exp(-h / 0.05);

    // Below the horizon: the sea of cloud running out to the edge of the world.
    float under = smoothstep(0.004, -0.03, e);
    vec3 sea = mix(vec3(0.016, 0.02, 0.03), vec3(0.008, 0.01, 0.016), smoothstep(0.0, -0.25, e));
    sea += vec3(0.016, 0.009, 0.004) * pow(c, 10.0) * exp(e / 0.06);
    col = mix(col, sea, under);
    gl_FragColor = vec4(col, 1.0);
  }
`;

const STAR_VERT = /* glsl */ `
  attribute vec3 aColor;
  attribute vec3 aStar;
  uniform float uTime;
  uniform float uPx;
  varying vec3 vColor;
  varying float vSharp;
  void main() {
    vec3 w = normalize((modelMatrix * vec4(position, 1.0)).xyz);
    float e = w.y;
    // Lower down, through more air: dimmer, redder, and twinkling hard.
    float air = 1.0 / max(e + 0.06, 0.06);
    float ext = exp(-0.06 * air);
    float amp = mix(0.1, 0.65, pow(1.0 - clamp(e, 0.0, 1.0), 4.0)) * aStar.z;
    float tw = 1.0 + amp * (0.6 * sin(uTime * (6.0 + aStar.y * 9.0) + aStar.y * 40.0) + 0.4 * sin(uTime * (13.0 + aStar.y * 7.0) + aStar.y * 91.0));
    float bright = aStar.x * ext * max(tw, 0.0) * smoothstep(-0.03, 0.03, e);
    vec3 redden = mix(vec3(1.0), vec3(1.0, 0.72, 0.5), clamp(air / 16.0, 0.0, 1.0));
    vColor = aColor * redden * bright;
    vSharp = clamp(aStar.x, 0.0, 1.0);
    vec4 p = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0);
    gl_PointSize = (1.7 + 3.6 * pow(clamp(aStar.x / 3.5, 0.0, 1.0), 0.55)) * uPx;
    gl_Position = vec4(p.xy, p.w * 0.99998, p.w);
  }
`;
const STAR_FRAG = /* glsl */ `
  varying vec3 vColor;
  varying float vSharp;
  void main() {
    float r = length(gl_PointCoord - 0.5) * 2.0;
    float core = exp(-r * r * 7.0);
    float halo = exp(-r * r * 2.0) * 0.12 * vSharp;
    gl_FragColor = vec4(vColor * (core + halo), 1.0);
  }
`;

/** Rough star colors from surface temperature: red dwarfs to blue giants. */
function starColor(kelvin: number) {
  const stops: [number, number, number, number][] = [
    [3000, 1, 0.62, 0.4],
    [4000, 1, 0.78, 0.6],
    [5500, 1, 0.94, 0.86],
    [7000, 0.94, 0.95, 1],
    [10000, 0.78, 0.85, 1],
    [25000, 0.64, 0.74, 1],
  ];
  for (let i = 1; i < stops.length; i++)
    if (kelvin <= stops[i][0]) {
      const [t0, ...a] = stops[i - 1];
      const [t1, ...b] = stops[i];
      const k = (kelvin - t0) / (t1 - t0);
      return new THREE.Color(a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k);
    }
  return new THREE.Color(0.64, 0.74, 1);
}

export interface Sky {
  group: THREE.Group;
  /** Turns with the sky: the stars and the planets. */
  wheel: THREE.Group;
  /** Advances the wheel and the twinkle; true when a meteor starts this frame. */
  tick(t: number, dt: number, camera: THREE.PerspectiveCamera, renderer: THREE.WebGLRenderer): boolean;
  /** Where the Milky Way's heart is right now. */
  core(): THREE.Vector3;
  /** Sets off a meteor somewhere in view. */
  meteor(camera: THREE.Camera): void;
  stars: number;
}

export function buildSky(quality: Quality, renderer: THREE.WebGLRenderer): Sky {
  const group = new THREE.Group();
  const wheel = new THREE.Group();
  group.add(wheel);
  const R = 1800;
  const r = rng(77);
  const octaves = quality === 'high' ? 5 : 4;

  // --- the sky itself: the dark, the glow, the Milky Way ------------------------
  // The Milky Way is painted once, into a picture of the whole sky; each frame
  // only looks it up, turned to wherever the sky has wheeled to.
  const width = Math.min(quality === 'high' ? 4096 : 2048, renderer.capabilities.maxTextureSize);
  const milky = new THREE.WebGLRenderTarget(width, width / 2, { depthBuffer: false, generateMipmaps: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, wrapS: THREE.RepeatWrapping });
  {
    const bake = new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2),
      new THREE.ShaderMaterial({
        vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
        fragmentShader: MW_BAKE,
        defines: { OCTAVES: octaves },
        uniforms: { uCore: { value: CORE }, uGalPole: { value: GAL_POLE } },
        depthTest: false,
        depthWrite: false,
      }),
    );
    const stage = new THREE.Scene();
    stage.add(bake);
    const before = renderer.getRenderTarget();
    renderer.setRenderTarget(milky);
    renderer.render(stage, new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1));
    renderer.setRenderTarget(before);
    bake.geometry.dispose();
    (bake.material as THREE.Material).dispose();
  }
  const toSky = new THREE.Matrix3();
  const skyMat = new THREE.ShaderMaterial({
    vertexShader: SKY_VERT,
    fragmentShader: SKY_FRAG,
    uniforms: {
      uToSky: { value: toSky },
      uMilky: { value: milky.texture },
      uZodiac: { value: dir(96, -14) },
      uCity: { value: dir(232, 0).setY(0).normalize() },
    },
    side: THREE.BackSide,
    depthWrite: false,
  });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(R + 100, 64, 40), skyMat);
  dome.frustumCulled = false;
  dome.renderOrder = -10;
  group.add(dome);

  // --- the stars --------------------------------------------------------------
  // Faint ones by the thousand, bright ones by the handful (about three times as
  // many with each step fainter), crowding toward the band of the Milky Way.
  const count = quality === 'high' ? 16000 : 6000;
  const faintest = quality === 'high' ? 7.2 : 6.4;
  const pos = new Float32Array(count * 3);
  const col = new Float32Array(count * 3);
  const star = new Float32Array(count * 3);
  const e2 = new THREE.Vector3().crossVectors(GAL_POLE, CORE);
  const p = new THREE.Vector3();
  for (let i = 0; i < count; i++) {
    if (r() < 0.55) {
      // In the band: longitude favoring the heart, latitude close to the plane.
      const l = (r() - 0.5) * 2 * Math.PI * (r() < 0.5 ? 0.45 : 1);
      const g = (r() + r() + r() - 1.5) * (r() < 0.6 ? 0.09 : 0.2);
      p.copy(CORE).multiplyScalar(Math.cos(l)).addScaledVector(e2, Math.sin(l)).multiplyScalar(Math.cos(g)).addScaledVector(GAL_POLE, Math.sin(g));
    } else {
      const z = r() * 2 - 1;
      const a = r() * Math.PI * 2;
      const s = Math.sqrt(1 - z * z);
      p.set(s * Math.cos(a), z, s * Math.sin(a));
    }
    p.normalize().multiplyScalar(R).toArray(pos, i * 3);
    const mag = faintest + Math.log(Math.max(r(), 1e-6)) / 1.1;
    // Brightness as the eye takes it, squeezed so the faint ones still show.
    const flux = Math.pow(10, -0.4 * (mag - 1));
    const seen = Math.pow(flux, 0.38) * 1.5;
    const k = r();
    const kelvin = k < 0.12 ? 3000 + r() * 1000 : k < 0.38 ? 4000 + r() * 1500 : k < 0.75 ? 5500 + r() * 1800 : 7300 + r() * 14000;
    starColor(kelvin).toArray(col, i * 3);
    star[i * 3] = seen;
    star[i * 3 + 1] = r();
    star[i * 3 + 2] = 0.6 + r() * 0.8;
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  starGeo.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
  starGeo.setAttribute('aStar', new THREE.BufferAttribute(star, 3));
  const starUniforms = { uTime: { value: 0 }, uPx: { value: 1 } };
  const starMat = new THREE.ShaderMaterial({
    vertexShader: STAR_VERT,
    fragmentShader: STAR_FRAG,
    uniforms: starUniforms,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const stars = new THREE.Points(starGeo, starMat);
  stars.frustumCulled = false;
  stars.renderOrder = -9;
  wheel.add(stars);

  // --- the planets: steady lights along the ecliptic ------------------------------
  // Jupiter cream and bright, Saturn pale gold, Mars a rusty orange.
  const planets = [
    { at: dir(-34, 31), color: new THREE.Color(1, 0.95, 0.84), seen: 3.4 },
    { at: dir(18, 41), color: new THREE.Color(1, 0.9, 0.66), seen: 1.7 },
    { at: dir(118, 24), color: new THREE.Color(1, 0.6, 0.38), seen: 1.9 },
  ];
  const pp = new Float32Array(planets.length * 3);
  const pc = new Float32Array(planets.length * 3);
  const ps = new Float32Array(planets.length * 3);
  planets.forEach((pl, i) => {
    pl.at.clone().multiplyScalar(R - 20).toArray(pp, i * 3);
    pl.color.toArray(pc, i * 3);
    // No twinkle: a planet is a tiny disc, not a point.
    ps.set([pl.seen, 0.5, 0], i * 3);
  });
  const planetGeo = new THREE.BufferGeometry();
  planetGeo.setAttribute('position', new THREE.BufferAttribute(pp, 3));
  planetGeo.setAttribute('aColor', new THREE.BufferAttribute(pc, 3));
  planetGeo.setAttribute('aStar', new THREE.BufferAttribute(ps, 3));
  const planetPoints = new THREE.Points(planetGeo, starMat);
  planetPoints.frustumCulled = false;
  planetPoints.renderOrder = -9;
  wheel.add(planetPoints);

  // --- meteors: a streak that flares and is gone ----------------------------------
  const mPos = new Float32Array(4 * 3);
  const mUv = new Float32Array([0, 0, 0, 1, 1, 1, 1, 0]);
  const mGeo = new THREE.BufferGeometry();
  mGeo.setAttribute('position', new THREE.BufferAttribute(mPos, 3));
  mGeo.setAttribute('uv', new THREE.BufferAttribute(mUv, 2));
  mGeo.setIndex([0, 1, 2, 0, 2, 3]);
  const mMat = new THREE.ShaderMaterial({
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_Position = vec4(p.xy, p.w * 0.99997, p.w);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uLevel;
      varying vec2 vUv;
      void main() {
        // Bright at the head (u = 1), fading down the tail; soft across.
        float across = 1.0 - abs(vUv.y * 2.0 - 1.0);
        float along = pow(vUv.x, 2.2);
        vec3 c = mix(vec3(0.55, 0.75, 1.0), vec3(0.85, 1.0, 0.9), vUv.x);
        gl_FragColor = vec4(c * along * across * across * uLevel * 2.4, 1.0);
      }
    `,
    uniforms: { uLevel: { value: 0 } },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
  const streak = new THREE.Mesh(mGeo, mMat);
  streak.frustumCulled = false;
  streak.visible = false;
  group.add(streak);
  const flight = { from: new THREE.Vector3(), to: new THREE.Vector3(), t: 0, length: 0, tail: 0.3 };
  let nextMeteor = 6 + Math.random() * 8;
  const fwd = new THREE.Vector3();
  const head = new THREE.Vector3();
  const tail = new THREE.Vector3();
  const side = new THREE.Vector3();

  const meteor = (camera: THREE.Camera) => {
    // Somewhere up in the picture, heading down and across.
    camera.getWorldDirection(fwd);
    const yaw = Math.atan2(fwd.x, -fwd.z) * THREE.MathUtils.RAD2DEG;
    const pitch = Math.asin(THREE.MathUtils.clamp(fwd.y, -1, 1)) * THREE.MathUtils.RAD2DEG;
    const az = yaw + (Math.random() - 0.5) * 34;
    const el = THREE.MathUtils.clamp(pitch + 6 + Math.random() * 18, 12, 75);
    flight.from.copy(dir(az, el));
    const len = 8 + Math.random() * 12;
    flight.to.copy(dir(az + (Math.random() < 0.5 ? -1 : 1) * len * 0.8, el - len * (0.4 + Math.random() * 0.5)));
    flight.t = 0;
    flight.length = 0.45 + Math.random() * 0.5;
    streak.visible = true;
  };

  const slerpDir = (a: THREE.Vector3, b: THREE.Vector3, k: number, out: THREE.Vector3) => {
    const ang = a.angleTo(b);
    if (ang < 1e-5) return out.copy(a);
    const s = Math.sin(ang);
    return out
      .copy(a)
      .multiplyScalar(Math.sin((1 - k) * ang) / s)
      .addScaledVector(b, Math.sin(k * ang) / s);
  };

  const turn = new THREE.Quaternion();
  const inv = new THREE.Matrix4();
  const coreNow = new THREE.Vector3();

  return {
    group,
    wheel,
    stars: count,
    core: () => coreNow.copy(CORE).applyQuaternion(wheel.quaternion),
    meteor,
    tick(t, dt, camera, renderer) {
      // Westward, round the pole.
      turn.setFromAxisAngle(POLE, -THREE.MathUtils.degToRad(WHEEL * t));
      wheel.quaternion.copy(turn);
      toSky.setFromMatrix4(inv.makeRotationFromQuaternion(turn).invert());
      starUniforms.uTime.value = t;
      starUniforms.uPx.value = renderer.getPixelRatio();
      // The sky goes with the camera, so no star is ever nearer than another.
      group.position.copy(camera.position);
      let started = false;
      nextMeteor -= dt;
      if (nextMeteor < 0) {
        nextMeteor = 9 + Math.random() * 22;
        meteor(camera);
        started = true;
      }
      if (streak.visible) {
        flight.t += dt / flight.length;
        const k = flight.t;
        if (k >= 1.25) {
          streak.visible = false;
          mMat.uniforms.uLevel.value = 0;
        } else {
          slerpDir(flight.from, flight.to, Math.min(k, 1), head);
          slerpDir(flight.from, flight.to, Math.max(0, Math.min(k, 1) - flight.tail), tail);
          // Flares up fast, then burns out.
          mMat.uniforms.uLevel.value = Math.min(1, k * 5) * (k < 0.75 ? 1 : Math.max(0, 1 - (k - 0.75) / 0.5));
          side.crossVectors(head, tail).normalize().multiplyScalar(1.3);
          const H = head.multiplyScalar(R - 50);
          const T = tail.multiplyScalar(R - 50);
          mPos.set([T.x + side.x * 0.2, T.y + side.y * 0.2, T.z + side.z * 0.2, T.x - side.x * 0.2, T.y - side.y * 0.2, T.z - side.z * 0.2, H.x - side.x, H.y - side.y, H.z - side.z, H.x + side.x, H.y + side.y, H.z + side.z], 0);
          mGeo.attributes.position.needsUpdate = true;
        }
      }
      return started;
    },
  };
}
