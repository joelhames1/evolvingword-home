// The library's light. There are far more lamps than a scene can afford real
// lights for (two in every gallery, on every floor, forever), so the shell of
// the library lights itself: each surface works out which gallery it's in and
// takes the light of that gallery's two lamps, a little of the pale light that
// falls down the well, and the lantern on the stair, all in its own shader.
// Real lights (the desk lamp, the map's picture light) still add their share;
// the real point lights, which only exist to light the studio's things, don't
// reach the shell, so nothing glows through a floor.
//
// The haze changes with where you look: warm and dusky across a gallery, pale
// toward the skylight far above, nearly black down the well.
import * as THREE from 'three';
import { D, HEX } from './plan';

/** Shared by every surface of the library. */
export const LIGHT = {
  uLibD: { value: D },
  uLibF: { value: HEX.F },
  uLibR: { value: HEX.r },
  uLibWell: { value: HEX.well },
  uLibLamp: { value: HEX.lamp.clone() },
  uLibLampColor: { value: new THREE.Color('#ffb46a').multiplyScalar(2.3) },
  uLibSky: { value: new THREE.Color('#a9c2e0').multiplyScalar(0.22) },
  uLibAmbient: { value: new THREE.Color('#5a3a22').multiplyScalar(0.035) },
  uLibLantern: { value: new THREE.Vector3(0, -100, 0) },
  uLibLanternColor: { value: new THREE.Color('#ffb060').multiplyScalar(0.9) },
  uLibSkyFog: { value: new THREE.Color('#8fa3b8') },
  uLibDeepFog: { value: new THREE.Color('#020103') },
};

const VERT_HEAD = /* glsl */ `
varying vec3 vLibWorld;
varying vec3 vLibNormal;
varying float vLibBake;
#ifdef LIB_BAKE
attribute float aBake;
#endif
`;

const VERT_BODY = /* glsl */ `
{
  vec4 libW = vec4(transformed, 1.0);
  vec3 libN = objectNormal;
  #ifdef USE_INSTANCING
  libW = instanceMatrix * libW;
  libN = mat3(instanceMatrix) * libN;
  #endif
  libW = modelMatrix * libW;
  vLibWorld = libW.xyz;
  vLibNormal = normalize(mat3(modelMatrix) * libN);
  #ifdef LIB_BAKE
  vLibBake = aBake;
  #else
  vLibBake = 1.0;
  #endif
}
`;

const FRAG_HEAD = /* glsl */ `
varying vec3 vLibWorld;
varying vec3 vLibNormal;
varying float vLibBake;
uniform float uLibD;
uniform float uLibF;
uniform float uLibR;
uniform float uLibWell;
uniform vec3 uLibLamp;
uniform vec3 uLibLampColor;
uniform vec3 uLibSky;
uniform vec3 uLibAmbient;
uniform vec3 uLibLantern;
uniform vec3 uLibLanternColor;
uniform vec3 uLibSkyFog;
uniform vec3 uLibDeepFog;
uniform float uLibSpec;
uniform float uLibShine;
uniform float uLibGlow;
uniform float uLibIbl;

// One lamp: soft falloff, a little wrap so the shadowed side isn't dead, and a gleam.
vec2 libLamp(vec3 q, vec3 n, vec3 v, vec3 L) {
  vec3 d = L - q;
  float r2 = dot(d, d);
  vec3 l = d * inversesqrt(r2);
  float a = 1.0 / (1.0 + r2 * 0.45);
  float nl = dot(n, l);
  float diff = max(nl, 0.0) * 0.82 + 0.18 * (0.5 + 0.5 * nl);
  float spec = pow(max(dot(n, normalize(l + v)), 0.0), uLibShine) * uLibSpec * step(0.0, nl);
  return vec2(diff, spec) * a;
}

// Both lamps of the gallery whose middle is at c.
vec2 libGallery(vec3 p, vec3 c, vec3 n, vec3 v) {
  vec3 q = p - c;
  return libLamp(q, n, v, uLibLamp) + libLamp(q, n, v, uLibLamp * vec3(-1.0, 1.0, 1.0));
}

vec3 libLight(vec3 p, vec3 n, vec3 v, vec3 albedo) {
  float j = floor((p.y + 0.3) / uLibF);
  float k = floor(p.z / uLibD + 0.5);
  vec3 c = vec3(0.0, j * uLibF, k * uLibD);
  float zl = p.z - c.z;
  // In a vestibule, the light of the gallery on the other side comes in too.
  float wn = 0.5 * smoothstep(uLibR - 0.8, uLibD * 0.5, abs(zl));
  vec3 c2 = c + vec3(0.0, 0.0, sign(zl) * uLibD);
  vec2 lamps = libGallery(p, c, n, v) * (1.0 - wn) + libGallery(p, c2, n, v) * wn;
  // Pale light falling down the well, strongest near it and on what faces up or in.
  vec2 h = p.xz - c.xz;
  float rho = length(h);
  vec3 toAxis = vec3(-h.x, 0.0, -h.y) / max(rho, 0.001);
  float near = exp(-max(rho - uLibWell, 0.0) * 1.1);
  float face = 0.25 + 0.75 * max(n.y, 0.0) + 0.6 * max(dot(n, toAxis), 0.0) * step(rho, uLibWell + 0.3);
  vec3 sky = uLibSky * near * face;
  // The lantern on the stair, carried by someone you never quite see.
  vec3 dl = uLibLantern - p;
  float rl = dot(dl, dl);
  float lan = max(dot(n, dl * inversesqrt(rl)), 0.0) * 0.8 + 0.2;
  vec3 lantern = uLibLanternColor * lan / (1.0 + rl * 1.6);
  float bake = vLibBake;
  return albedo * (uLibLampColor * lamps.x * bake + sky * (0.4 + 0.6 * bake) + lantern + uLibAmbient * bake) + uLibLampColor * lamps.y;
}
`;

const FRAG_LIGHT = /* glsl */ `
#include <aomap_fragment>
{
  vec3 libN = normalize(vLibNormal) * (gl_FrontFacing ? 1.0 : -1.0);
  vec3 libV = normalize(cameraPosition - vLibWorld);
  totalEmissiveRadiance += libLight(vLibWorld, libN, libV, diffuseColor.rgb) + diffuseColor.rgb * uLibGlow;
}
`;

const FRAG_FOG = /* glsl */ `
#ifdef USE_FOG
{
  vec3 libRay = vLibWorld - cameraPosition;
  float libDist = length(libRay);
  float libFog = 1.0 - exp(-fogDensity * fogDensity * libDist * libDist);
  float up = libRay.y / max(libDist, 0.001);
  vec3 libFogColor = mix(fogColor, uLibSkyFog, smoothstep(0.45, 0.97, up));
  libFogColor = mix(libFogColor, uLibDeepFog, smoothstep(-0.25, -0.9, up));
  gl_FragColor.rgb = mix(gl_FragColor.rgb, libFogColor, libFog);
}
#endif
`;

// The usual lighting, minus the real point lights and the sky dome: the shell
// has its own lamps (above), and real lamps would shine through the floors.
const LIGHTS_BEGIN = THREE.ShaderChunk.lights_fragment_begin.replace('#if ( NUM_POINT_LIGHTS > 0 ) && defined( RE_Direct )', '#if 0').replace('#if ( NUM_HEMI_LIGHTS > 0 )', '#if 0');

export interface LitOptions {
  /** How much the lamps gleam on it, and how tight the gleam is. */
  spec?: number;
  shine?: number;
  /** A per-vertex shade (the `aBake` attribute): darker deep in a shelf, say. */
  bake?: boolean;
  /** A faint light of its own. */
  glow?: number;
}

/** Makes a material light itself the library's way. */
export function lit<T extends THREE.MeshStandardMaterial>(mat: T, opts: LitOptions = {}): T {
  // The studio's sky dome is a bright white room; in here it would only wash things gray.
  // (The scene's own environment strength overrides a material's, so scale it in the shader.)
  const own = { uLibSpec: { value: opts.spec ?? 0 }, uLibShine: { value: opts.shine ?? 30 }, uLibGlow: { value: opts.glow ?? 0 }, uLibIbl: { value: mat.envMapIntensity === 1 ? 0.12 : mat.envMapIntensity } };
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, LIGHT, own);
    if (opts.bake) shader.defines = { ...shader.defines, LIB_BAKE: '' };
    shader.vertexShader = VERT_HEAD + shader.vertexShader.replace('#include <worldpos_vertex>', `#include <worldpos_vertex>\n${VERT_BODY}`);
    shader.fragmentShader =
      FRAG_HEAD +
      shader.fragmentShader
        .replace('#include <lights_fragment_begin>', LIGHTS_BEGIN)
        .replace('#include <lights_fragment_maps>', '#include <lights_fragment_maps>\n#ifdef USE_ENVMAP\niblIrradiance *= uLibIbl;\nradiance *= uLibIbl;\n#endif')
        .replace('#include <aomap_fragment>', FRAG_LIGHT)
        .replace('#include <fog_fragment>', FRAG_FOG);
  };
  mat.customProgramCacheKey = () => `library${opts.bake ? '-bake' : ''}`;
  return mat;
}
