// Light for the world outside the window. Like the lake and the city, everything
// out there lights itself with its own sun and sky (the room's lamps would
// otherwise shine straight through the walls onto the view) and fades into the
// same haze as the sky. Instancing and vertex colors both work.
import * as THREE from 'three';

export interface Daylight {
  /** Toward the sun. */
  sunDir: THREE.Vector3;
  sunColor: THREE.Color;
  /** Light from the sky above, and bounced up from the ground. */
  sky: THREE.Color;
  ground: THREE.Color;
  /** The haze things fade into with distance, and how thick it is. */
  haze: THREE.Color;
  hazeDensity: number;
  /** Low mist hugging the ground (0 for none), and the height it sits at. */
  mist: number;
  mistLevel: number;
}

export type DaylightUniforms = Record<string, { value: unknown }>;

export function daylightUniforms(d: Daylight): DaylightUniforms {
  return {
    uSunDir: { value: d.sunDir.clone().normalize() },
    uSunColor: { value: d.sunColor },
    uSky: { value: d.sky },
    uGround: { value: d.ground },
    uHaze: { value: d.haze },
    uHazeDensity: { value: d.hazeDensity },
    uMist: { value: d.mist },
    uMistLevel: { value: d.mistLevel },
    uTime: { value: 0 },
  };
}

/** The lighting and haze, for any shader outside that wants to match. */
export const DAYLIGHT = /* glsl */ `
  uniform vec3 uSunDir;
  uniform vec3 uSunColor;
  uniform vec3 uSky;
  uniform vec3 uGround;
  uniform vec3 uHaze;
  uniform float uHazeDensity;
  uniform float uMist;
  uniform float uMistLevel;
  uniform float uTime;
  vec3 hazeToward(vec3 dir) {
    // Brighter and warmer looking toward the sun.
    float s = max(dot(dir, uSunDir), 0.0);
    return uHaze + uSunColor * (pow(s, 6.0) * 0.18 + pow(s, 40.0) * 0.25);
  }
  vec3 daylight(vec3 albedo, vec3 n, vec3 world) {
    float diff = max(dot(n, uSunDir), 0.0);
    vec3 amb = mix(uGround, uSky, n.y * 0.5 + 0.5);
    return albedo * (amb + uSunColor * diff);
  }
  vec3 fade(vec3 col, vec3 world) {
    vec3 toP = world - cameraPosition;
    float d = length(toP);
    float fog = 1.0 - exp(-d * uHazeDensity);
    // Morning mist lies low and thickens with distance.
    float low = exp(-max(world.y - uMistLevel, 0.0) / 14.0);
    fog = max(fog, uMist * low * (1.0 - exp(-d / 700.0)));
    return mix(col, hazeToward(toP / max(d, 1e-3)), clamp(fog, 0.0, 1.0));
  }
`;

const VERT = /* glsl */ `
  varying vec3 vNrm;
  varying vec3 vWorld;
  varying vec3 vColor;
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
    vec4 w = modelMatrix * local;
    vWorld = w.xyz;
    vNrm = normalize(mat3(modelMatrix) * nrm);
    vUv = uv;
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;

const FRAG = /* glsl */ `
  ${DAYLIGHT}
  uniform vec3 uColor;
  uniform vec3 uEmissive;
  uniform sampler2D uMap;
  uniform float uUseMap;
  varying vec3 vNrm;
  varying vec3 vWorld;
  varying vec3 vColor;
  varying vec2 vUv;
  void main() {
    vec3 albedo = uColor * vColor;
    vec3 glow = uEmissive;
    if (uUseMap > 0.5) {
      vec4 t = texture2D(uMap, vUv);
      albedo *= t.rgb;
      glow *= t.rgb * t.a;
    }
    vec3 n = normalize(vNrm);
    if (!gl_FrontFacing) n = -n;
    vec3 col = daylight(albedo, n, vWorld) + glow;
    gl_FragColor = vec4(fade(col, vWorld), 1.0);
  }
`;

/** A plain lit surface outside: a color, vertex or instance colors, and optionally a map that also glows. */
export function outdoor(u: DaylightUniforms, opts: { color?: THREE.ColorRepresentation; emissive?: THREE.ColorRepresentation; map?: THREE.Texture; vertexColors?: boolean; side?: THREE.Side } = {}) {
  return new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    uniforms: {
      ...u,
      uColor: { value: new THREE.Color(opts.color ?? '#ffffff') },
      uEmissive: { value: new THREE.Color(opts.emissive ?? '#000000') },
      uMap: { value: opts.map ?? null },
      uUseMap: { value: opts.map ? 1 : 0 },
    },
    vertexColors: opts.vertexColors ?? false,
    side: opts.side ?? THREE.FrontSide,
  });
}

/**
 * Lights that stay a few pixels across however far away they are: runway lights,
 * nav lights, the lamps of a far village. Each point has a color and a blink
 * pattern (aBlink: 0 steady; otherwise a period in seconds, with aPhase).
 */
export function pointLights(points: { pos: THREE.Vector3; color: THREE.Color; size?: number; blink?: number; phase?: number; duty?: number }[], u: DaylightUniforms) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(points.length * 3);
  const col = new Float32Array(points.length * 3);
  const size = new Float32Array(points.length);
  const blink = new Float32Array(points.length * 3);
  points.forEach((p, i) => {
    p.pos.toArray(pos, i * 3);
    p.color.toArray(col, i * 3);
    size[i] = p.size ?? 1;
    blink[i * 3] = p.blink ?? 0;
    blink[i * 3 + 1] = p.phase ?? 0;
    blink[i * 3 + 2] = p.duty ?? 0.5;
  });
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
  geo.setAttribute('aBlink', new THREE.BufferAttribute(blink, 3));
  const mat = new THREE.ShaderMaterial({
    vertexShader: /* glsl */ `
      attribute vec3 aColor;
      attribute float aSize;
      attribute vec3 aBlink;
      uniform float uTime;
      uniform float uScale;
      uniform float uHazeDensity;
      varying vec3 vColor;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        float d = -mv.z;
        float on = 1.0;
        if (aBlink.x > 0.0) on = step(fract(uTime / aBlink.x + aBlink.y), aBlink.z);
        // Dimmed by the same haze as everything else, never quite to nothing.
        float clear = max(exp(-d * uHazeDensity * 0.6), 0.12);
        vColor = aColor * on * clear;
        // aSize is the glow's size in meters; uScale turns meters at 1m into pixels.
        gl_PointSize = clamp(aSize * uScale / d, 1.5, 40.0) * on;
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec3 vColor;
      void main() {
        float r = length(gl_PointCoord - 0.5) * 2.0;
        float a = smoothstep(1.0, 0.0, r);
        gl_FragColor = vec4(vColor * (a * a * 1.6 + smoothstep(0.35, 0.0, r) * 2.5), 1.0);
      }
    `,
    uniforms: { uTime: u.uTime, uHazeDensity: u.uHazeDensity, uScale: { value: 1000 } },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  return Object.assign(pts, {
    /** Keeps the glows the right size for the lens and the screen; call each frame. */
    fit(camera: THREE.PerspectiveCamera, renderer: THREE.WebGLRenderer) {
      const h = renderer.domElement.height;
      mat.uniforms.uScale.value = h / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
    },
  });
}
