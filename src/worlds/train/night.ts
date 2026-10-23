// Light for everything outside the train at night: the moon instead of a sun,
// a deep blue sky, haze that thickens with distance (orange over the city),
// and the warm squares the train's own lit windows throw on the ground as it
// goes by. Built on the shared daylight functions (worlds/outdoor.ts), so the
// haze and the far-off lights match the rest of the site's outdoors.
import * as THREE from 'three';
import { DAYLIGHT, daylightUniforms, type DaylightUniforms } from '../outdoor';
import { STATION_LAMPS } from './ground';
import { CAR, COMPARTMENT_STEP, CORRIDOR_WINDOWS, WINDOW } from './plan';

/** Toward the moon, as seen (low over the land on the window side, a little behind), and the way its light falls. */
export const MOON_DIR = new THREE.Vector3(-0.32, 0.12, -0.94).normalize();
const MOONLIGHT = new THREE.Vector3(-0.38, 0.62, -0.69).normalize();

/** Where the train's windows are along it, for the light they throw: from the last car to the front of the car ahead. */
export const TRAIN_SPAN = { back: CAR.back - 75, front: CAR.front + 25 };

export function nightUniforms(): DaylightUniforms {
  const u = daylightUniforms({
    sunDir: MOONLIGHT,
    sunColor: new THREE.Color('#9db4e6').multiplyScalar(1.15),
    sky: new THREE.Color('#2a3c62').multiplyScalar(1.1),
    ground: new THREE.Color('#141a26'),
    haze: new THREE.Color('#0d1424'),
    hazeDensity: 0.0012,
    mist: 0.4,
    mistLevel: -6,
  });
  return {
    ...u,
    // The far side of the sky from the moon: a soft cool light, so what's turned away from it still reads.
    uFill: { value: new THREE.Color('#5d76a8').multiplyScalar(0.42) },
    // The moon catching the edges of things seen against it.
    uRim: { value: new THREE.Color('#b9cdf5').multiplyScalar(1.1) },
    // Where the moon is, for the haze to glow round it.
    uMoonDir: { value: MOON_DIR.clone() },
    uMoonGlow: { value: new THREE.Color('#6f84b4').multiplyScalar(0.18) },
    // How much of the moon and the sky reach the line: none deep in a tunnel.
    uMoonK: { value: 1 },
    // The platform lamps of the station near us: the world x of one of them, the stretch they run
    // along (x0, x1), and how bright (0: no station near). The light they give, warm or white.
    uStation: { value: new THREE.Vector4(0, 0, 0, 0) },
    uStationColor: { value: new THREE.Color('#ffc58a') },
    // How brightly the train's windows light the ground beside it (0 in a tunnel's dark, it's the tunnel walls they light).
    uSpill: { value: 1 },
    uSpillColor: { value: new THREE.Color('#ffb46a') },
    // A wash of light from below the haze: the city's glow, a little sodium orange.
    uGlow: { value: new THREE.Color('#000000') },
    // The brakes' sparks, lighting the ballast round the wheels: where, and how brightly.
    uSpark: { value: new THREE.Vector4(0, -1.15, -0.8, 0) },
  };
}

/** The squares of light from the train's windows, on whatever is beside the line. */
const SPILL = /* glsl */ `
  uniform float uSpill;
  uniform vec3 uSpillColor;
  uniform vec4 uSpark;
  vec3 sparkAt(vec3 world) {
    if (uSpark.w <= 0.0) return vec3(0.0);
    // Along the train they're thrown back from the wheels, so the light runs out behind the bogie.
    vec3 d = world - uSpark.xyz;
    d.z = abs(world.z) - uSpark.z;
    d.x = d.x > 0.0 ? d.x * 1.6 : d.x * 0.35;
    return vec3(1.0, 0.42, 0.12) * uSpark.w * exp(-dot(d, d) * 0.4);
  }
  float spillAt(vec3 world, vec3 n) {
    float side = world.z;
    float d = abs(side) - ${CAR.outer.toFixed(3)};
    // How far it is from the windows, counting how far below them it is too.
    float d3 = length(vec2(d, max(0.0, 0.84 - world.y) * 0.8));
    if (d < 0.0 || d3 > 9.0 || uSpill <= 0.0) return 0.0;
    if (world.x < ${TRAIN_SPAN.back.toFixed(1)} || world.x > ${TRAIN_SPAN.front.toFixed(1)}) return 0.0;
    // Compartment windows on the −z side, the corridor's on the +z side: a square of light
    // for each, spreading and fading as it falls further out.
    float pitch = side < 0.0 ? ${COMPARTMENT_STEP.toFixed(3)} : ${CORRIDOR_WINDOWS.step.toFixed(3)};
    float halfW = side < 0.0 ? ${((WINDOW.x1 - WINDOW.x0) / 2).toFixed(3)} : ${(CORRIDOR_WINDOWS.width / 2).toFixed(3)};
    float mid = side < 0.0 ? ${((WINDOW.x0 + WINDOW.x1) / 2).toFixed(3)} : ${CORRIDOR_WINDOWS.first.toFixed(3)};
    float k = world.x - mid;
    float cell = k - pitch * floor(k / pitch + 0.5);
    float spread = halfW + d * 0.3;
    float lit = 1.0 - smoothstep(spread - 0.1 - d * 0.1, spread + 0.15 + d * 0.15, abs(cell));
    // On the ground it falls below the sill; on a wall facing the train (a tunnel,
    // a platform's fittings) it makes a band at the windows' height.
    float toward = side < 0.0 ? n.z : -n.z;
    float ground = clamp(n.y, 0.0, 1.0) * clamp((0.6 - world.y) / 2.0, 0.0, 1.0);
    float lo = ${WINDOW.y0.toFixed(2)} - d * 0.45;
    float hi = ${WINDOW.y1.toFixed(2)} + d * 0.35;
    float band = smoothstep(lo - 0.3, lo + 0.1, world.y) * (1.0 - smoothstep(hi - 0.1, hi + 0.3, world.y));
    // (A wall close by, a tunnel's, takes it brightly; one further off, a platform's, more softly.)
    float wall = clamp(toward, 0.0, 1.0) * band * 2.6 * exp(-max(d3 - 1.5, 0.0) * 0.45);
    // And a little whichever way it faces: light scattered in the night air under the windows.
    float wash = 0.4 * exp(-d3 * 0.55);
    return (lit * max(ground, wall) * exp(-d3 * 0.55) + wash * (0.6 + 0.4 * lit)) * uSpill;
  }
`;

/**
 * The night's own light, over the shared uniforms: the moon as the key, wrapped a
 * little so forms turn into shadow instead of going black; the sky overhead and a
 * cool fill from the far side of it; a rim of moonlight on edges seen against the
 * moon; the platform lamps of a station close by. And a haze that glows round the moon.
 */
const NIGHT = /* glsl */ `
  uniform vec3 uFill;
  uniform vec3 uRim;
  uniform vec3 uMoonDir;
  uniform vec3 uMoonGlow;
  uniform vec4 uStation;
  uniform vec3 uStationColor;
  uniform float uMoonK;
  vec3 moonlit(vec3 color, vec3 n, vec3 world) {
    // By moonlight colors go grey: the eye sees them that way.
    vec3 albedo = mix(color, vec3(dot(color, vec3(0.3, 0.55, 0.15))), 0.4);
    vec3 L = uSunDir;
    float ndl = dot(n, L);
    float key = clamp((ndl + 0.3) / 1.3, 0.0, 1.0);
    key *= key;
    vec3 amb = mix(uGround, uSky, n.y * 0.5 + 0.5);
    vec3 F = normalize(vec3(-L.x, 0.5, -L.z));
    float fill = clamp(dot(n, F) * 0.5 + 0.5, 0.0, 1.0);
    vec3 toEye = cameraPosition - world;
    vec3 V = toEye / max(length(toEye), 1e-3);
    float edge = 1.0 - clamp(dot(n, V), 0.0, 1.0);
    edge = edge * edge * edge;
    float behind = clamp(0.5 - 0.5 * dot(V, uMoonDir), 0.0, 1.0);
    float rim = edge * behind * behind * clamp(ndl + 0.6, 0.0, 1.0);
    return albedo * (amb * (0.2 + 0.8 * uMoonK) + (uSunColor * key + uFill * (fill * fill) + uRim * rim) * uMoonK);
  }
  // The station's lamps, one every ${STATION_LAMPS.step} m along the back of the platform: the nearest two.
  vec3 stationLit(vec3 albedo, vec3 n, vec3 world) {
    if (uStation.w <= 0.0 || world.x < uStation.y - 8.0 || world.x > uStation.z + 8.0 || world.z < -40.0 || world.z > 4.0) return vec3(0.0);
    float base = floor((world.x - uStation.x) / ${STATION_LAMPS.step.toFixed(1)});
    vec3 sum = vec3(0.0);
    for (int i = 0; i < 2; i++) {
      float lx = uStation.x + (base + float(i)) * ${STATION_LAMPS.step.toFixed(1)};
      float there = step(uStation.y - 0.5, lx) * step(lx, uStation.z + 0.5);
      vec3 d = vec3(lx, ${STATION_LAMPS.y.toFixed(3)}, ${STATION_LAMPS.z.toFixed(3)}) - world;
      float dd = max(dot(d, d), 1e-3);
      float ndl = dot(n, d * inversesqrt(dd));
      sum += there * clamp(ndl * 0.8 + 0.2, 0.0, 1.0) / (1.0 + dd * 0.28);
    }
    return albedo * uStationColor * sum * uStation.w;
  }
  vec3 moonHaze(vec3 dir) {
    float s = max(dot(dir, uMoonDir), 0.0);
    float s2 = s * s;
    float s8 = s2 * s2;
    s8 *= s8;
    float s32 = s8 * s8;
    s32 *= s32;
    float s64 = s32 * s32;
    return uHaze + uMoonGlow * (s32 * 0.55 + s64 * 1.0);
  }
  vec3 nightFade(vec3 col, vec3 world) {
    vec3 toP = world - cameraPosition;
    float d = length(toP);
    float fog = 1.0 - exp(-d * uHazeDensity);
    float low = exp(-max(world.y - uMistLevel, 0.0) / 14.0);
    fog = max(fog, uMist * low * (1.0 - exp(-d / 700.0)));
    // And the edge of the land, wherever it's seen, gone into the haze.
    fog = max(fog, smoothstep(1300.0, 1500.0, d));
    return mix(col, moonHaze(toP / max(d, 1e-3)), clamp(fog, 0.0, 1.0));
  }
`;

const VERT = /* glsl */ `
  attribute vec3 aGlow;
  varying vec3 vNrm;
  varying vec3 vWorld;
  varying vec3 vColor;
  varying vec3 vGlow;
  varying vec2 vUv;
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
    #ifdef GLOWS
      vGlow = aGlow;
    #else
      vGlow = vec3(0.0);
    #endif
    vec4 w = modelMatrix * local;
    vWorld = w.xyz;
    // (Made unit length in the fragment shader, safely: a zero normal mustn't become not-a-number.)
    vNrm = mat3(modelMatrix) * nrm;
    vUv = uv;
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;

const FRAG = /* glsl */ `
  ${DAYLIGHT}
  ${SPILL}
  ${NIGHT}
  uniform vec3 uColor;
  uniform vec3 uGlow;
  uniform sampler2D uMap;
  uniform float uUseMap;
  uniform float uMapScale;
  uniform float uSheen;
  varying vec3 vNrm;
  varying vec3 vWorld;
  varying vec3 vColor;
  varying vec3 vGlow;
  varying vec2 vUv;
  void main() {
    vec3 albedo = uColor * vColor;
    if (uUseMap > 0.5) albedo *= texture2D(uMap, vUv * uMapScale).rgb;
    vec3 n = vNrm * inversesqrt(max(dot(vNrm, vNrm), 1e-8));
    if (!gl_FrontFacing) n = -n;
    vec3 col = moonlit(albedo, n, vWorld);
    // A little moon sheen on snow and ice (not on fields or leaves).
    float shiny = uSheen * smoothstep(0.25, 0.6, dot(albedo, vec3(0.3, 0.5, 0.2)));
    if (shiny > 0.0) {
      vec3 toEye = cameraPosition - vWorld;
      vec3 view = toEye / max(length(toEye), 1e-3);
      vec3 hv = view + uSunDir;
      vec3 h = hv * inversesqrt(max(dot(hv, hv), 1e-8));
      float sp = clamp(dot(n, h), 0.0, 1.0);
      float sp2 = sp * sp;
      float sp8 = sp2 * sp2;
      sp8 *= sp8;
      float sp32 = sp8 * sp8;
      sp32 *= sp32;
      col += uSunColor * sp32 * sp8 * shiny;
    }
    col += albedo * uSpillColor * spillAt(vWorld, n) * 1.3;
    col += albedo * sparkAt(vWorld);
    col += stationLit(albedo, n, vWorld);
    // The city's glow lights things a little from below the sky, everywhere.
    col += albedo * uGlow;
    col += vGlow;
    gl_FragColor = vec4(nightFade(col, vWorld), 1.0);
  }
`;

/** A surface outside at night: a color, vertex or instance colors, optional map, optional per-vertex glow (aGlow). */
export function nightMaterial(u: DaylightUniforms, opts: { color?: THREE.ColorRepresentation; map?: THREE.Texture; mapScale?: number; vertexColors?: boolean; glows?: boolean; sheen?: number; side?: THREE.Side } = {}) {
  return new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    defines: opts.glows ? { GLOWS: '' } : {},
    uniforms: {
      ...u,
      uColor: { value: new THREE.Color(opts.color ?? '#ffffff') },
      uMap: { value: opts.map ?? null },
      uUseMap: { value: opts.map ? 1 : 0 },
      uMapScale: { value: opts.mapScale ?? 1 },
      uSheen: { value: opts.sheen ?? 0 },
    },
    vertexColors: opts.vertexColors ?? false,
    side: opts.side ?? THREE.FrontSide,
  });
}

/**
 * The city's buildings: plain walls lit by the moon and the street lamps' glow,
 * windows drawn from where they fall on each wall (uvs in meters), a few lit at
 * 3am, warm or the blue of a television. The glow attribute carries each
 * building's seed and how many of its windows are lit.
 */
export function cityMaterial(u: DaylightUniforms) {
  return new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: /* glsl */ `
      ${DAYLIGHT}
      ${SPILL}
      ${NIGHT}
      uniform vec3 uGlow;
      varying vec3 vNrm;
      varying vec3 vWorld;
      varying vec3 vColor;
      varying vec3 vGlow;
      varying vec2 vUv;
      float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
      void main() {
        vec3 n = vNrm * inversesqrt(max(dot(vNrm, vNrm), 1e-8));
        if (!gl_FrontFacing) n = -n;
        vec3 albedo = vColor;
        vec3 lit = vec3(0.0);
        // Each building's own number, as a whole number: taken straight from the interpolated attribute,
        // its last few bits wander from pixel to pixel, and the hashes below turn that into static.
        float seed = floor(vGlow.x * 997.0) + 0.5;
        float share = floor(vGlow.y * 1000.0 + 0.5) / 1000.0;
        if (abs(n.y) < 0.5) {
          // A grid of windows: a floor every 3.2 m, a bay every 2.7 m, a sill and a lintel.
          vec2 g = vUv / vec2(2.7, 3.2);
          vec2 cell = floor(g);
          vec2 f = fract(g);
          // Soft edges a pixel wide, and where the windows are smaller than a few pixels, their average:
          // a grid that fine only shimmers.
          vec2 fw = max(fwidth(g), vec2(1e-4));
          vec2 lo = smoothstep(vec2(0.22, 0.3) - fw, vec2(0.22, 0.3) + fw, f);
          vec2 hi = 1.0 - smoothstep(vec2(0.78, 0.82) - fw, vec2(0.78, 0.82) + fw, f);
          float pane = lo.x * lo.y * hi.x * hi.y;
          pane = mix(pane, 0.27, smoothstep(0.15, 0.45, max(fw.x, fw.y)));
          // No windows in the bottom meter or a half at the top (the parapet).
          pane *= step(1.2, vUv.y);
          float h = hash(cell + seed * 0.0973);
          float on = step(h, share);
          float tv = step(0.86, hash(cell * 1.7 + seed * 0.0311));
          vec3 warm = mix(vec3(1.0, 0.72, 0.42), vec3(1.0, 0.85, 0.6), hash(cell + 3.1));
          vec3 glowCol = mix(warm, vec3(0.55, 0.7, 1.0), tv) * (0.7 + 0.6 * hash(cell * 2.3));
          // Dark glass catches a little of the sky.
          albedo = mix(albedo, vec3(0.05, 0.06, 0.08), pane * 0.85);
          lit = glowCol * pane * on;
          // The ground floor: a lit shop window here and there (soft edged, and an average where it's tiny).
          float shop = smoothstep(0.08 - fw.x, 0.08 + fw.x, f.x) * (1.0 - smoothstep(0.92 - fw.x, 0.92 + fw.x, f.x));
          shop = mix(shop, 0.84, smoothstep(0.15, 0.45, fw.x));
          shop *= smoothstep(0.45, 0.6, vUv.y) * (1.0 - smoothstep(2.9, 3.05, vUv.y));
          lit += vec3(1.0, 0.72, 0.45) * 0.55 * shop * step(0.9, hash(vec2(cell.x, 9.0) + seed * 0.0131));
        }
        vec3 col = moonlit(albedo * 0.55, n, vWorld) + albedo * uGlow * 1.5 + lit + stationLit(albedo, n, vWorld);
        gl_FragColor = vec4(nightFade(col, vWorld), 1.0);
      }
    `,
    defines: { GLOWS: '' },
    uniforms: { ...u },
    vertexColors: true,
    side: THREE.DoubleSide,
  });
}

/** Light lying on the ground under lamps: added over whatever's there, fading with the haze. */
export function poolMaterial(u: DaylightUniforms) {
  return new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: /* glsl */ `
      uniform vec3 uHaze;
      uniform float uHazeDensity;
      varying vec3 vWorld;
      varying vec3 vGlow;
      void main() {
        float d = length(vWorld - cameraPosition);
        gl_FragColor = vec4(vGlow * exp(-d * uHazeDensity), 1.0);
      }
    `,
    defines: { GLOWS: '' },
    uniforms: { ...u },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
}

/**
 * Still water at night: nearly black, the sky's blue in it at a slant, and a
 * path of moonlight broken up by ripples. uvs are where it is along the land
 * (meters, kept small), so the ripples stay put as we go by.
 */
export function waterMaterial(u: DaylightUniforms) {
  return new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: /* glsl */ `
      ${DAYLIGHT}
      ${SPILL}
      ${NIGHT}
      uniform vec3 uMoon;
      varying vec3 vWorld;
      varying vec2 vUv;
      float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
      float noise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
      void main() {
        vec3 toEye = cameraPosition - vWorld;
        float d = length(toEye);
        vec3 view = toEye / max(d, 1e-3);
        // Ripples: two drifting layers of noise, smaller near, smoothed out far off.
        vec2 p = vUv;
        float t = uTime;
        float fine = 1.0 / (1.0 + d * 0.004);
        vec2 slope = vec2(
          noise(p * 0.35 + vec2(t * 0.11, 0.0)) - noise(p * 0.35 + vec2(0.7, t * 0.09)),
          noise(p * 0.21 + vec2(3.1, t * 0.07)) - noise(p * 0.21 + vec2(t * 0.05, 5.3))
        ) * 0.22 * fine + vec2(noise(p * 1.7 + t * 0.3) - 0.5, noise(p * 1.9 - t * 0.27) - 0.5) * 0.1 * fine;
        vec3 n = normalize(vec3(slope.x, 1.0, slope.y));
        vec3 r = reflect(-view, n);
        float fres = 0.02 + 0.98 * pow(1.0 - max(dot(view, n), 0.0), 5.0);
        vec3 skyCol = mix(vec3(0.03, 0.045, 0.085), vec3(0.008, 0.012, 0.03), clamp(r.y * 2.0, 0.0, 1.0));
        vec3 col = vec3(0.004, 0.007, 0.012) + skyCol * fres * 1.4;
        // The moon's path: a long glitter where the ripples tilt its light to us.
        float m = max(dot(r, uMoon), 0.0);
        col += vec3(0.9, 0.92, 1.0) * (pow(m, 900.0) * 6.0 + pow(m, 120.0) * 0.6);
        col += uSpillColor * spillAt(vWorld, vec3(0.0, 1.0, 0.0)) * 0.5;
        gl_FragColor = vec4(nightFade(col, vWorld), 1.0);
      }
    `,
    uniforms: { ...u, uMoon: { value: MOON_DIR.clone() } },
  });
}
