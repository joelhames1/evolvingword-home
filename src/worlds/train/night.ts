// Light for everything outside the train at night: the moon instead of a sun,
// a deep blue sky, haze that thickens with distance (orange over the city),
// and the warm squares the train's own lit windows throw on the ground as it
// goes by. Built on the shared daylight functions (worlds/outdoor.ts), so the
// haze and the far-off lights match the rest of the site's outdoors.
import * as THREE from 'three';
import { DAYLIGHT, daylightUniforms, type DaylightUniforms } from '../outdoor';
import { CANOPY, PLATFORM, STATION_LAMPS, SURF } from './ground';
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
    // Along the station, a strip (see STATION_TEX): where light comes out of the house's windows, and where the canopy is.
    // Where the strip starts (world x) and one over its length; the lamps of its own (by the sign, by the doors): x, y, z, power.
    uStationTex: { value: stationTexture() },
    uStationGeo: { value: new THREE.Vector4(0, 1 / STATION_TEX.length, 0, 0) },
    uStationLights: { value: [0, 1, 2, 3].map(() => new THREE.Vector4(0, 0, 0, 0)) },
    uStationWin: { value: new THREE.Color('#ff9a4c').multiplyScalar(0.75) },
    // How brightly the train's windows light the ground beside it (0 in a tunnel's dark, it's the tunnel walls they light).
    uSpill: { value: 1 },
    uSpillColor: { value: new THREE.Color('#ffb46a') },
    // A wash of light from below the haze: the city's glow, a little sodium orange.
    uGlow: { value: new THREE.Color('#000000') },
    // The brakes' sparks, lighting the ballast round the wheels: where, and how brightly.
    uSpark: { value: new THREE.Vector4(0, -1.15, -0.8, 0) },
    // The level crossing's red lamps, the one of each pair that's lit: where, and how bright.
    uCross: { value: [new THREE.Vector4(0, 0, 0, 0), new THREE.Vector4(0, 0, 0, 0)] },
    // The city's street lamps along the line, one every 24 m: where they fall now (the line's position, mod 24); how much of the city, and of the fields, there is here.
    uLand: { value: new THREE.Vector3(0, 0, 0) },
  };
}

/** The strip along a station that tells its light where the house's lit windows and the canopy are: texels, and how many meters it covers from where it starts. */
export const STATION_TEX = { size: 512, length: 192, from: -120 };
function stationTexture() {
  const t = new THREE.DataTexture(new Uint8Array(STATION_TEX.size * 4), STATION_TEX.size, 1, THREE.RGBAFormat);
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearFilter;
  t.generateMipmaps = false;
  t.needsUpdate = true;
  return t;
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
    return vec3(1.0, 0.42, 0.12) * uSpark.w * exp(-dot(d, d) * 0.24);
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
  uniform sampler2D uStationTex;
  uniform vec4 uStationGeo;
  uniform vec4 uStationLights[4];
  uniform vec3 uStationWin;
  // How much of the sky a station's canopy hides here: 0 out in the open, 1 well in under it.
  float stationCover(vec3 world) {
    if (uStation.w <= 0.0 || world.y > ${CANOPY.y.toFixed(3)} + 0.05 || world.z < ${PLATFORM.back.toFixed(3)} - 0.6 || world.z > ${CANOPY.front.toFixed(3)} + 0.9) return 0.0;
    float tx = (world.x - uStationGeo.x) * uStationGeo.y;
    if (tx <= 0.0 || tx >= 1.0) return 0.0;
    return texture2D(uStationTex, vec2(tx, 0.5)).g * smoothstep(${CANOPY.front.toFixed(3)} + 0.9, ${CANOPY.front.toFixed(3)} - 0.5, world.z);
  }
  // One lamp's light here, falling away with distance; under a hood most of it goes down. Its glint, for what's glossy.
  float lampAt(vec3 n, vec3 V, vec3 world, vec3 lp, float power, float hood, float gloss, inout float spec) {
    vec3 d = lp - world;
    float dd = max(dot(d, d), 1e-4);
    vec3 L = d * inversesqrt(dd);
    float down = clamp(L.y, 0.0, 1.0);
    down *= down;
    float fall = power * mix(1.0, 0.04 + 0.96 * down * down, hood) / (dd + 0.3);
    float ndl = dot(n, L);
    if (gloss > 0.0) {
      vec3 hv = L + V;
      vec3 h = hv * inversesqrt(max(dot(hv, hv), 1e-6));
      float s = clamp(dot(n, h), 0.0, 1.0);
      s *= s;
      s *= s;
      s *= s;
      s *= s;
      spec += s * fall * step(0.0, ndl);
    }
    return clamp(ndl * 0.9 + 0.1, 0.0, 1.0) * fall;
  }
  // A station near us: pools of light under its lamps, one every ${STATION_LAMPS.step} m along the platform (the nearest two),
  // and under the lamps of its own; and the light of the house's lit windows, out over the platform.
  vec3 stationLit(vec3 albedo, vec3 n, vec3 world, float gloss) {
    if (uStation.w <= 0.0 || world.x < uStation.y - 14.0 || world.x > uStation.z + 14.0 || world.z < -40.0 || world.z > 4.0) return vec3(0.0);
    vec3 toEye = cameraPosition - world;
    vec3 V = toEye * inversesqrt(max(dot(toEye, toEye), 1e-6));
    float base = floor((world.x - uStation.x) / ${STATION_LAMPS.step.toFixed(1)});
    float diff = 0.0;
    float spec = 0.0;
    for (int i = 0; i < 2; i++) {
      float lx = uStation.x + (base + float(i)) * ${STATION_LAMPS.step.toFixed(1)};
      if (lx > uStation.y - 0.5 && lx < uStation.z + 0.5) diff += lampAt(n, V, world, vec3(lx, ${STATION_LAMPS.y.toFixed(3)}, ${STATION_LAMPS.z.toFixed(3)}), 20.0, 1.0, gloss, spec);
    }
    for (int i = 0; i < 4; i++) {
      vec4 q = uStationLights[i];
      if (q.w > 0.0) diff += lampAt(n, V, world, q.xyz, q.w, 0.5, gloss, spec);
    }
    // Close in, the lamps look whiter; their light warms as it thins.
    vec3 lampCol = mix(uStationColor, vec3(1.0, 0.94, 0.84), clamp(diff * 0.25, 0.0, 0.5));
    vec3 col = albedo * lampCol * diff + uStationColor * spec * gloss;
    // The rooms' light out through the windows: onto the platform, and onto what faces the house.
    float away = world.z - ${PLATFORM.back.toFixed(3)};
    if (away > -0.05 && away < 6.0 && world.y < ${(PLATFORM.y + 2.9).toFixed(3)}) {
      float tx = (world.x - uStationGeo.x) * uStationGeo.y;
      float spread = (0.12 + away * 0.45) * uStationGeo.y;
      float w = texture2D(uStationTex, vec2(tx, 0.5)).r * 0.4 + (texture2D(uStationTex, vec2(tx - spread, 0.5)).r + texture2D(uStationTex, vec2(tx + spread, 0.5)).r) * 0.3;
      float face = clamp(n.y, 0.0, 1.0) * 0.9 + clamp(-n.z, 0.0, 1.0) * smoothstep(${(PLATFORM.y + 2.9).toFixed(3)}, ${(PLATFORM.y + 1.6).toFixed(3)}, world.y);
      w *= face * smoothstep(-0.05, 0.3, away) / (1.0 + away * away * 0.45);
      col += albedo * uStationWin * w;
    }
    return col * uStation.w;
  }
  uniform vec4 uCross[2];
  // Where the street lamps along the line fall now (its position, mod 24 m), and how much of the city and of the fields there are here.
  uniform vec3 uLand;
  // The level crossing's red lamps, flashing in turn: their light out along the road, on the barriers and the car waiting.
  vec3 crossingLit(vec3 albedo, vec3 n, vec3 world) {
    vec3 sum = vec3(0.0);
    for (int i = 0; i < 2; i++) {
      vec4 q = uCross[i];
      if (q.w <= 0.0) continue;
      vec3 d = q.xyz - world;
      float dd = dot(d, d);
      if (dd > 1600.0) continue;
      vec3 L = d * inversesqrt(max(dd, 1e-4));
      // They face out along the road, away from the line.
      float ahead = clamp(-L.z * sign(q.z), 0.0, 1.0);
      float fall = q.w * (0.1 + 0.9 * ahead * ahead) / (dd + 0.5);
      // (And a red sheen on the road and the grass, wet with the night.)
      vec3 hv = L + normalize(cameraPosition - world);
      float s = clamp(dot(n, hv * inversesqrt(max(dot(hv, hv), 1e-6))), 0.0, 1.0);
      s *= s;
      s *= s;
      s *= s;
      sum += vec3(1.0, 0.09, 0.04) * fall * (clamp(dot(n, L) * 0.9 + 0.1, 0.0, 1.0) + s * clamp(n.y, 0.0, 1.0) * 0.06 / max(dot(albedo, vec3(0.33)), 0.02));
    }
    return albedo * sum;
  }
  // The moon's glint on what's glossy (rails, wet stone, paint).
  vec3 moonGloss(vec3 n, vec3 world, float gloss) {
    vec3 toEye = cameraPosition - world;
    vec3 V = toEye * inversesqrt(max(dot(toEye, toEye), 1e-6));
    vec3 hv = V + uSunDir;
    vec3 h = hv * inversesqrt(max(dot(hv, hv), 1e-6));
    float s = clamp(dot(n, h), 0.0, 1.0);
    s *= s;
    s *= s;
    s *= s;
    s *= s;
    return uSunColor * s * gloss * 0.3 * uMoonK;
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
    // And the edges of the land that's been built (behind, ahead and out to the sides), gone into the haze.
    fog = max(fog, max(smoothstep(820.0, 1020.0, -world.x), smoothstep(1050.0, 1320.0, world.x)));
    fog = max(fog, smoothstep(1330.0, 1400.0, abs(world.z)));
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
  uniform float uDetail;
  varying vec3 vNrm;
  varying vec3 vWorld;
  varying vec3 vColor;
  varying vec3 vGlow;
  varying vec2 vUv;
  float hd(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
  // Value noise whose lattice repeats every per cells along x (the ground's uvs start again every 1200 m).
  float vnw(vec2 p, float per) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float i0 = mod(i.x, per);
    float i1 = mod(i.x + 1.0, per);
    return mix(mix(hd(vec2(i0, i.y)), hd(vec2(i1, i.y)), f.x), mix(hd(vec2(i0, i.y + 1.0)), hd(vec2(i1, i.y + 1.0)), f.x), f.y);
  }
  // Close by, the ground isn't one flat color: tussocks and clods, and furrows along the ploughed fields.
  vec3 groundDetail(vec3 albedo, vec2 uv, vec3 world) {
    float near = 1.0 - smoothstep(40.0, 180.0, length(cameraPosition - world));
    if (near <= 0.0) return albedo;
    vec2 fw = fwidth(uv * 2.4);
    float small = mix(vnw(uv * 2.4, 2880.0), 0.5, smoothstep(0.3, 0.8, max(fw.x, fw.y)));
    float k = 0.8 + 0.3 * vnw(uv * 0.5, 600.0) + 0.24 * (small - 0.5);
    float ph = uv.y / 0.7;
    float furrow = mix(0.5 + 0.5 * sin(ph * 6.2832), 0.5, smoothstep(0.2, 0.5, fwidth(ph)));
    k *= 1.0 - smoothstep(0.0, 0.025, albedo.r - albedo.g) * 0.16 * furrow * uLand.z;
    return albedo * mix(1.0, k, near);
  }
  void main() {
    vec3 albedo = uColor * vColor;
    if (uUseMap > 0.5) albedo *= texture2D(uMap, vUv * uMapScale).rgb;
    if (uDetail > 0.5) albedo = groundDetail(albedo, vUv, vWorld);
    vec3 n = vNrm * inversesqrt(max(dot(vNrm, vNrm), 1e-8));
    if (!gl_FrontFacing) n = -n;
    // (A glow below zero marks something glossy, the rails: how glossy.)
    float gloss = max(-vGlow.x, 0.0);
    vec3 col = moonlit(albedo, n, vWorld) * (1.0 - 0.85 * stationCover(vWorld));
    if (gloss > 0.0) col += moonGloss(n, vWorld, gloss);
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
    col += stationLit(albedo, n, vWorld, gloss);
    col += crossingLit(albedo, n, vWorld);
    // The city's glow lights things a little from below the sky, everywhere.
    col += albedo * uGlow;
    col += max(vGlow, vec3(0.0));
    gl_FragColor = vec4(nightFade(col, vWorld), 1.0);
  }
`;

/** A surface outside at night: a color, vertex or instance colors, optional map, optional per-vertex glow (aGlow). */
export function nightMaterial(u: DaylightUniforms, opts: { color?: THREE.ColorRepresentation; map?: THREE.Texture; mapScale?: number; vertexColors?: boolean; glows?: boolean; sheen?: number; side?: THREE.Side; detail?: boolean } = {}) {
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
      uDetail: { value: opts.detail ? 1 : 0 },
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
      // The street lamps along the line, every 24 m either side: their sodium light up the fronts of the buildings.
      vec3 streetLit(vec3 albedo, vec3 n, vec3 world) {
        if (uLand.y <= 0.0 || abs(world.z) > 90.0) return vec3(0.0);
        float sz = world.z < 0.0 ? -8.0 : 8.0;
        float base = floor((world.x + uLand.x) / 24.0);
        float sum = 0.0;
        for (int i = 0; i < 2; i++) {
          vec3 d = vec3((base + float(i)) * 24.0 - uLand.x, -2.0, sz) - world;
          float dd = max(dot(d, d), 1e-3);
          sum += clamp(dot(n, d * inversesqrt(dd)) * 0.9 + 0.1, 0.0, 1.0) * 60.0 / (dd + 1.0);
        }
        return albedo * vec3(1.0, 0.5, 0.17) * sum * uLand.y;
      }
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
        vec3 col = moonlit(albedo * 0.55, n, vWorld) + albedo * uGlow * 1.5 + lit + stationLit(albedo, n, vWorld, 0.0) + streetLit(albedo, n, vWorld);
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

/**
 * What a station's surfaces are made of, drawn from where each pixel is on them
 * (uvs in meters): brick in courses, dressed and rubble stone, weatherboards,
 * the platform's flags with their coping and painted line, slates and tiles,
 * boards and glazing under the canopy, snow, ice, iron and wood; and the sheet
 * of posters and names. Each gives its color, how glossy it is, and any light
 * of its own. Where the pattern's finer than a pixel or two, its average, so it
 * never shimmers.
 */
const SURFACES = /* glsl */ `
  float h21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
  float vn(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(h21(i), h21(i + vec2(1.0, 0.0)), f.x), mix(h21(i + vec2(0.0, 1.0)), h21(i + vec2(1.0, 1.0)), f.x), f.y);
  }
  // How much of a joint w wide (a fraction of the cell, each way) a pixel is on, softened by its footprint.
  float joints(vec2 f, vec2 w, vec2 fw) {
    vec2 d = min(f, 1.0 - f);
    vec2 s = 1.0 - smoothstep(w - fw, w + fw, d);
    return max(s.x, s.y);
  }
  float farOff(vec2 fw) { return smoothstep(0.2, 0.55, max(fw.x, fw.y)); }
  const vec3 MORTAR = vec3(0.13, 0.12, 0.105);

  vec3 brick(vec2 uv, vec3 base, float seed) {
    vec2 g = uv / vec2(0.225, 0.075);
    vec2 fw = fwidth(g);
    g.x += 0.5 * mod(floor(g.y), 2.0);
    vec2 id = floor(g);
    float j = joints(fract(g), vec2(0.024, 0.075), fw);
    float r = h21(id + seed);
    vec3 c = base * (0.74 + 0.5 * r) * mix(vec3(1.0), vec3(0.72, 0.7, 0.8), step(0.9, h21(id * 1.7 + 3.0)));
    return mix(mix(c, MORTAR * 1.6, j), mix(base, MORTAR * 1.6, 0.18), farOff(fw));
  }
  vec3 ashlar(vec2 uv, vec3 base, float seed) {
    vec2 size = vec2(0.64, 0.32);
    vec2 g = uv / size;
    vec2 fw = fwidth(g);
    g.x += 0.5 * mod(floor(g.y), 2.0) + 0.17 * h21(vec2(floor(g.y), seed));
    vec2 id = floor(g);
    vec2 f = fract(g);
    float j = joints(f, vec2(0.016, 0.04), fw);
    // Each block chamfered at its edges (the light catching the top one, the bottom in shadow), its own shade, a tooled face, weathered.
    vec2 m = min(f, 1.0 - f) * size;
    float bevel = mix(0.5, 1.0, smoothstep(0.0, 0.04, min(m.x, m.y))) * (1.0 + 0.18 * (1.0 - smoothstep(0.0, 0.03, (1.0 - f.y) * size.y)));
    vec3 c = base * (0.78 + 0.36 * h21(id + seed)) * bevel * (0.88 + 0.16 * vn(uv * vec2(7.0, 19.0))) * (0.85 + 0.15 * vn(uv * 1.3 + seed));
    // Streaks where rain has run down it.
    c *= 1.0 - 0.18 * smoothstep(0.55, 0.85, vn(uv * vec2(5.0, 0.35) + seed));
    return mix(mix(c, MORTAR, j), base * 0.88, farOff(fw));
  }
  vec3 rubble(vec2 uv, vec3 base, float seed) {
    vec2 p = uv * vec2(2.7, 3.7);
    vec2 ip = floor(p);
    vec2 fp = fract(p);
    float d1 = 9.0;
    float d2 = 9.0;
    vec2 id = vec2(0.0);
    for (int j = -1; j <= 1; j++)
      for (int i = -1; i <= 1; i++) {
        vec2 o = vec2(float(i), float(j));
        vec2 c = o + 0.15 + 0.7 * vec2(h21(ip + o + seed), h21(ip + o + 31.7)) - fp;
        float dd = dot(c, c);
        if (dd < d1) {
          d2 = d1;
          d1 = dd;
          id = ip + o;
        } else if (dd < d2) d2 = dd;
      }
    float e = sqrt(d2) - sqrt(d1);
    float fwp = max(fwidth(p.x), fwidth(p.y));
    float jn = 1.0 - smoothstep(0.05, 0.13 + fwp, e);
    vec3 st = base * (0.66 + 0.56 * h21(id + seed)) * mix(vec3(1.0), vec3(1.08, 1.0, 0.9), h21(id + 5.1));
    st *= 0.8 + 0.2 * smoothstep(0.0, 0.3, e);
    return mix(mix(st, MORTAR * 1.5, jn), base * 0.88, farOff(vec2(fwp)));
  }
  vec3 boards(vec2 uv, vec3 base) {
    float g = uv.y / 0.17;
    float f = fract(g);
    float row = floor(g);
    float fw = fwidth(g);
    // The shadow under each board's lapped edge, the edge itself catching light.
    float shade = mix(1.0, 0.5, smoothstep(0.74, 1.0, f)) * (1.0 + 0.14 * (1.0 - smoothstep(0.0, 0.08, f)));
    float bx = fract(uv.x / 3.1 + h21(vec2(row, 3.0)));
    float bfw = fwidth(uv.x / 3.1);
    float butt = 1.0 - smoothstep(0.003 - bfw, 0.003 + bfw, min(bx, 1.0 - bx));
    vec3 c = base * shade * (0.92 + 0.12 * h21(vec2(row, 1.0))) * (1.0 - 0.35 * butt);
    // Paint worn off here and there.
    c = mix(c, base * vec3(0.55, 0.48, 0.4), 0.6 * smoothstep(0.72, 0.9, vn(uv * vec2(3.0, 26.0))));
    return mix(c, base * 0.86, smoothstep(0.25, 0.6, fw));
  }

  void surface(float kind, vec2 uv, vec3 base, float vary, out vec3 alb, out float gloss, out vec3 emit) {
    alb = base;
    gloss = 0.0;
    emit = vec3(0.0);
    float seed = floor(vary * 37.0);
    if (kind < 0.5) {
      gloss = 0.12;
    } else if (kind < 1.5) {
      alb = brick(uv, base, seed);
      gloss = 0.04;
    } else if (kind < 2.5) {
      alb = ashlar(uv, base, seed);
      gloss = 0.05;
    } else if (kind < 3.5) {
      alb = rubble(uv, base, seed);
      gloss = 0.05;
    } else if (kind < 4.5) {
      alb = boards(uv, base);
      gloss = 0.1;
    } else if (kind < 5.5) {
      // The platform: uv.y is how far out from the line.
      float z = uv.y;
      float fwz = fwidth(z);
      if (z > ${PLATFORM.edge.toFixed(3)} - 0.45) {
        // The coping stones along the edge, their rounded front catching the light.
        float g = uv.x / 0.9;
        float fw = fwidth(g);
        float j = 1.0 - smoothstep(0.012 - fw, 0.012 + fw, min(fract(g), 1.0 - fract(g)));
        vec3 cope = mix(base, vec3(0.5, 0.48, 0.45), 0.55) * (0.9 + 0.14 * h21(vec2(floor(g), 3.0)));
        cope *= 1.0 + 0.3 * smoothstep(${PLATFORM.edge.toFixed(3)} - 0.12, ${PLATFORM.edge.toFixed(3)} + 0.04, z);
        alb = mix(cope, MORTAR, j * (1.0 - farOff(vec2(fw))));
        gloss = 0.3;
      } else {
        vec2 g = vec2(uv.x / 0.6, (z - ${PLATFORM.back.toFixed(3)}) / 0.55);
        vec2 fw = fwidth(g);
        g.x += 0.5 * mod(floor(g.y), 2.0);
        vec2 id = floor(g);
        float j = joints(fract(g), vec2(0.018, 0.02), fw);
        vec3 flag = base * (0.82 + 0.32 * h21(id + 7.0)) * mix(vec3(1.0), vec3(1.05, 1.0, 0.93), h21(id + 2.0));
        alb = mix(mix(flag, MORTAR, j), base * 0.96, farOff(fw));
        // Damp here and there, so the lamps shine in it.
        float wet = smoothstep(0.55, 0.85, vn(uv * vec2(0.45, 0.9) + 3.0));
        gloss = 0.08 + 0.6 * wet;
        alb *= 1.0 - 0.2 * wet;
        // The line to stand behind, worn where feet go.
        float line = smoothstep(${(PLATFORM.edge - 1.03).toFixed(3)} - fwz, ${(PLATFORM.edge - 1.03).toFixed(3)} + fwz, z) * (1.0 - smoothstep(${(PLATFORM.edge - 0.93).toFixed(3)} - fwz, ${(PLATFORM.edge - 0.93).toFixed(3)} + fwz, z));
        vec3 paint = vary < 0.25 ? vec3(0.6, 0.42, 0.05) : vec3(0.7, 0.7, 0.66);
        alb = mix(alb, paint, line * (1.0 - 0.5 * smoothstep(0.35, 0.8, vn(uv * vec2(1.2, 6.0)))));
        gloss = mix(gloss, 0.35, line);
      }
      if (vary > 0.3 && vary < 0.7) {
        // Snow drifted against the back and lying in patches, trodden away down the middle.
        float drift = clamp(smoothstep(${(PLATFORM.back + 1.2).toFixed(3)}, ${(PLATFORM.back + 0.2).toFixed(3)}, z) + smoothstep(0.6, 0.78, vn(uv * vec2(0.5, 1.6))) + 0.7 * smoothstep(${(PLATFORM.edge - 0.35).toFixed(3)}, ${(PLATFORM.edge).toFixed(3)}, z) * smoothstep(0.4, 0.6, vn(uv * vec2(1.4, 3.0))), 0.0, 1.0);
        alb = mix(alb, vec3(0.7, 0.75, 0.82) * (0.92 + 0.08 * vn(uv * 7.0)), drift);
        gloss = mix(gloss, 0.3, drift);
      }
    } else if (kind < 7.5) {
      // Slates, or clay tiles: courses up the slope, each course's foot shadowing the one below.
      bool tile = kind > 6.5;
      vec2 size = tile ? vec2(0.22, 0.16) : vec2(0.3, 0.2);
      vec2 g = uv / size;
      vec2 fw = fwidth(g);
      g.x += 0.5 * mod(floor(g.y), 2.0);
      vec2 id = floor(g);
      vec2 f = fract(g);
      float j = 1.0 - smoothstep(0.03 - fw.x, 0.03 + fw.x, min(f.x, 1.0 - f.x));
      float shade = mix(1.0, 0.55, smoothstep(0.8, 1.0, f.y));
      if (tile) shade *= 0.8 + 0.25 * sin(f.x * 3.14159);
      vec3 c = base * (0.78 + 0.4 * h21(id + seed)) * shade * (1.0 - 0.45 * j);
      alb = mix(c, base * 0.82, farOff(fw));
      gloss = tile ? 0.1 : 0.3;
    } else if (kind < 8.5) {
      // Boards under the canopy, running across it.
      float g = uv.x / 0.12;
      float fw = fwidth(g);
      float j = 1.0 - smoothstep(0.05 - fw, 0.05 + fw, min(fract(g), 1.0 - fract(g)));
      alb = mix(base * (0.88 + 0.16 * h21(vec2(floor(g), 4.0))) * (1.0 - 0.6 * j), base * 0.9, smoothstep(0.25, 0.6, fw));
      gloss = 0.1;
    } else if (kind < 9.5) {
      // Glass in iron glazing bars, the night through it.
      vec2 g = vec2(uv.x / 0.62, (uv.y - ${PLATFORM.back.toFixed(3)}) / 1.15);
      vec2 fw = fwidth(g);
      float bar = joints(fract(g), vec2(0.045, 0.025), fw);
      vec3 glass = vec3(0.01, 0.014, 0.024);
      float far = farOff(fw);
      alb = mix(mix(glass, base, bar), mix(glass, base, 0.15), far);
      emit = (1.0 - mix(bar, 0.15, far)) * vec3(0.005, 0.008, 0.016);
      gloss = mix(mix(1.2, 0.35, bar), 0.6, far);
    } else if (kind < 10.5) {
      // Snow, glinting.
      alb = base * (0.9 + 0.1 * vn(uv * 3.0));
      vec2 fw = fwidth(uv * 60.0);
      gloss = 0.25 + 3.0 * step(0.993, h21(floor(uv * 60.0))) * (1.0 - farOff(fw));
    } else if (kind < 11.5) {
      gloss = 0.45;
    } else if (kind < 12.5) {
      alb = base * (0.84 + 0.16 * vn(uv * vec2(1.5, 26.0)));
      gloss = 0.12;
    } else if (kind < 13.5) {
      // Ice: glassy, holding a little of the lamps' light in it.
      gloss = 1.6;
      emit = base * 0.012;
    } else if (kind < 14.5) {
      // Boards across the lake's platform, a gap between each; the edge board painted white.
      float z = uv.y;
      float fwz = fwidth(z);
      float g = uv.x / 0.16;
      float fw = fwidth(g);
      float gap = 1.0 - smoothstep(0.05 - fw, 0.05 + fw, min(fract(g), 1.0 - fract(g)));
      vec3 bd = base * (0.78 + 0.38 * h21(vec2(floor(g), 1.0))) * (0.9 + 0.1 * vn(vec2(uv.x * 40.0, uv.y * 2.0)));
      alb = mix(mix(bd, base * 0.22, gap), base * 0.84, smoothstep(0.2, 0.5, fw));
      float edge = smoothstep(${(PLATFORM.edge - 0.32).toFixed(3)} - fwz, ${(PLATFORM.edge - 0.32).toFixed(3)} + fwz, z);
      alb = mix(alb, vec3(0.68, 0.68, 0.64) * (0.9 + 0.1 * vn(uv * vec2(0.8, 5.0))), edge * 0.92);
      gloss = 0.1 + 0.18 * edge;
    } else if (kind < 15.5) {
      // The platform's face: white along the coping, then brick, stone or boards down to the ballast.
      if (uv.y > ${(PLATFORM.y - 0.13).toFixed(3)}) {
        alb = vec3(0.68, 0.68, 0.64);
        gloss = 0.3;
      } else if (vary < 0.25) alb = brick(uv, base, 5.0);
      else if (vary < 0.75) alb = rubble(uv, base, 5.0);
      else alb = boards(uv, base);
    } else if (kind < 16.5) {
      alb = texture2D(uAtlas, uv).rgb;
      gloss = 0.22;
      emit = alb * 0.015;
    } else {
      gloss = 0.22;
    }
  }
`;

/** The stations: what each surface is made of (SURF, in the glow channel, with its shade and how shaded it is), lit by the moon and the station's lamps. */
export function stationMaterial(u: DaylightUniforms, atlas: THREE.Texture) {
  return new THREE.ShaderMaterial({
    // (What's painted on, from the posters on, is drawn a hair nearer, along the line of sight: it stays exactly where it is on the screen, but never flickers into what it's on, however far off.)
    vertexShader: VERT.replace('gl_Position = projectionMatrix * viewMatrix * w;', `vec4 mv = viewMatrix * w;\n    mv.xyz *= 1.0 - step(${(SURF.atlas - 0.5).toFixed(1)}, aGlow.x) * 0.0012;\n    gl_Position = projectionMatrix * mv;`),
    fragmentShader: /* glsl */ `
      ${DAYLIGHT}
      ${SPILL}
      ${NIGHT}
      uniform vec3 uGlow;
      uniform sampler2D uAtlas;
      varying vec3 vNrm;
      varying vec3 vWorld;
      varying vec3 vColor;
      varying vec3 vGlow;
      varying vec2 vUv;
      ${SURFACES}
      void main() {
        vec3 n = vNrm * inversesqrt(max(dot(vNrm, vNrm), 1e-8));
        if (!gl_FrontFacing) n = -n;
        float kind = floor(vGlow.x + 0.5);
        float occl = 1.0 - clamp(vGlow.z, 0.0, 1.0);
        vec3 albedo;
        float gloss;
        vec3 emit;
        surface(kind, vUv, vColor, vGlow.y, albedo, gloss, emit);
        vec3 col = moonlit(albedo, n, vWorld) * (1.0 - 0.85 * stationCover(vWorld)) * occl;
        if (gloss > 0.0) col += moonGloss(n, vWorld, gloss) * occl;
        // (The train's own windows light the platform beside it, but more softly than the lamps: blinds are down at this hour.)
        col += albedo * uSpillColor * spillAt(vWorld, n) * 0.2;
        col += albedo * sparkAt(vWorld);
        col += stationLit(albedo, n, vWorld, gloss) * mix(occl, 1.0, 0.35);
        col += albedo * uGlow + emit;
        gl_FragColor = vec4(nightFade(col, vWorld), 1.0);
      }
    `,
    defines: { GLOWS: '' },
    uniforms: { ...u, uAtlas: { value: atlas } },
    vertexColors: true,
    side: THREE.DoubleSide,
  });
}
