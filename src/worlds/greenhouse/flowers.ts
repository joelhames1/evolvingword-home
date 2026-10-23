// Every plant in the house, grown from its genome and drawn all together: one
// mesh of petals, one of leaves, one of stems and one of flower eyes, each an
// instance of a single small shape bent into place on the graphics card. A pot
// only says where its parts go and when in the plant's growing each one comes:
// the shader takes the plant's age and lifts the sprout, runs the stem up,
// unfurls the leaves, swells the buds and opens them, sways it all a little,
// and lets it droop when it's dry. Petals are thin, so with the low sun behind
// them they glow.
import * as THREE from 'three';
import { hash, rgb, seeded, type Genome, type Tint } from './genome';
import { POT, POT_AT } from './plan';
import { terracotta, soil as soilTexture } from './surfaces';

const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const SLOTS = POT_AT.length;
const UP = v(0, 1, 0);

/** A color for the shader: a tint, in linear light. */
const linear = (t: Tint) => {
  const [r, g, b] = rgb(t);
  return new THREE.Color().setRGB(r, g, b, THREE.SRGBColorSpace);
};

// --- what a plant is made of -------------------------------------------------------------------

export interface Stem {
  from: THREE.Vector3;
  to: THREE.Vector3;
  r: number;
  /** When in the plant's growing (0..1) this piece grows. */
  win: [number, number];
}
export interface Leaf {
  at: THREE.Vector3;
  /** The way it points, and its upper face. */
  dir: THREE.Vector3;
  face: THREE.Vector3;
  len: number;
  width: number;
  /** 0 oval, 1 lance, 2 lobed, 3 heart, 5 a seed leaf. */
  shape: number;
  /** How far it arches over toward its tip (radians). */
  arch: number;
  win: [number, number];
}
export interface Bloom {
  at: THREE.Vector3;
  /** The way it faces. */
  axis: THREE.Vector3;
  /** Its radius: a petal's length. */
  size: number;
  /** Bud forming, opening, open. */
  win: [number, number, number];
}
export interface Plan {
  stems: Stem[];
  leaves: Leaf[];
  blooms: Bloom[];
  /** The height of the main stem, for the sway. */
  height: number;
  /** The top of it all, flowers and all. */
  top: number;
}

/** The plant a genome grows into, in its own space: the soil's middle at the origin, the aisle toward +z. */
export function grow(g: Genome, seed: number): Plan {
  const r = seeded(seed);
  const H = 0.2 + g.height * 0.075;
  const R = 0.05 + g.size * 0.0135;
  const stems: Stem[] = [];
  const leaves: Leaf[] = [];
  const blooms: Bloom[] = [];
  // The main stem: a gentle lean toward the light and the aisle.
  const lean = v((r() - 0.5) * 0.06, 0, 0.03 + r() * 0.04);
  const at = (s: number) => v(lean.x * s * s, H * s, lean.z * s * s + Math.sin(Math.PI * s) * 0.012);
  const N = 8;
  const t0 = 0.06;
  const tTip = 0.48;
  for (let i = 0; i < N; i++) stems.push({ from: at(i / N), to: at((i + 1) / N), r: 0.0068 - (i / N) * 0.0024 + g.size * 0.0003, win: [t0 + ((tTip - t0) * i) / N, t0 + ((tTip - t0) * (i + 1)) / N] });
  const tangent = (s: number) => at(Math.min(1, s + 0.01)).sub(at(Math.max(0, s - 0.01))).normalize();
  blooms.push({ at: at(1), axis: tangent(1).multiplyScalar(0.6).add(v((r() - 0.5) * 0.3, 0.55, 0.75)).normalize(), size: R, win: [tTip, 0.78, 0.92] });

  // Leaves: their shape, and how one is set on the stem.
  const shapeLen = [1, 1.35, 1.1, 0.95][g.leaf];
  const shapeWide = [0.55, 0.26, 0.78, 0.86][g.leaf];
  const nLeaves = 3 + Math.floor(g.height / 2) + (g.leaf === 1 ? 1 : 0);
  let phi = r() * Math.PI * 2;
  function leafAt(p: THREE.Vector3, out: THREE.Vector3, scale: number, win: [number, number], basal = false) {
    const len = (0.075 + g.size * 0.006 + H * 0.12) * shapeLen * scale;
    const dir = out.clone().multiplyScalar(basal ? 1 : 0.85).add(v(0, basal ? 0.35 : 0.6, 0)).normalize();
    const side = new THREE.Vector3().crossVectors(UP, dir).normalize();
    const face = new THREE.Vector3().crossVectors(dir, side).normalize();
    leaves.push({ at: p.clone(), dir, face, len, width: len * shapeWide, shape: g.leaf, arch: basal ? 1.1 : 0.55 + r() * 0.3, win });
  }
  // Side stems, each with a bloom: out to the sides first, then forward.
  const sides = [Math.PI + (r() - 0.5) * 0.5, (r() - 0.5) * 0.5, Math.PI / 2 + (r() - 0.5) * 0.6];
  const firstSide = r() < 0.5 ? 0 : 1;
  for (let b = 0; b < g.branches; b++) {
    const theta = sides[b === 0 ? firstSide : b === 1 ? 1 - firstSide : 2];
    const out = v(Math.cos(theta), 0, Math.sin(theta));
    const f = 0.42 + b * 0.13 + r() * 0.06;
    const start = at(f);
    const len = H * (0.34 + r() * 0.12);
    const dir = out.clone().multiplyScalar(0.55).add(v(0, 0.85, 0)).normalize();
    const along = (s: number) => start.clone().addScaledVector(dir, len * s).addScaledVector(UP, len * 0.35 * s * s);
    const n = 5;
    const bt0 = 0.4 + b * 0.04;
    const bt1 = 0.6 + b * 0.04;
    for (let i = 0; i < n; i++) stems.push({ from: along(i / n), to: along((i + 1) / n), r: 0.0038 - (i / n) * 0.0012, win: [bt0 + ((bt1 - bt0) * i) / n, bt0 + ((bt1 - bt0) * (i + 1)) / n] });
    const tip = along(1);
    const tan = along(1).sub(along(0.95)).normalize();
    blooms.push({ at: tip, axis: tan.multiplyScalar(0.6).add(out.clone().multiplyScalar(0.35)).add(v(0, 0.4, 0.6)).normalize(), size: R * 0.82, win: [bt1, 0.82 + b * 0.03, 0.95 + b * 0.015] });
    // A small leaf partway along.
    const mid = along(0.45);
    const lo = out.clone().applyAxisAngle(UP, (r() - 0.5) * 1.2);
    leafAt(mid, lo, 0.7, [bt0 + 0.06, bt0 + 0.2]);
  }

  // Leaves up the main stem, round it in the golden angle, smaller toward the top.
  for (let i = 0; i < nLeaves; i++) {
    const f = 0.14 + (i / Math.max(1, nLeaves)) * 0.62;
    phi += 2.39996;
    // Not straight back into the glass, where you'd never see it.
    const a = Math.sin(phi) < -0.7 ? phi + 1.6 : phi;
    leafAt(at(f), v(Math.cos(a), 0, Math.sin(a)), 1 - f * 0.45, [t0 + (tTip - t0) * f + 0.02, t0 + (tTip - t0) * f + 0.2]);
  }
  // A rosette at the foot.
  const nBasal = 5 + (g.leaf === 3 ? 2 : g.leaf === 2 ? 1 : 0);
  for (let i = 0; i < nBasal; i++) {
    const a = (i / nBasal) * Math.PI * 2 + r() * 0.5;
    leafAt(v(0, 0.012, 0), v(Math.cos(a), 0, Math.sin(a)), 1.15, [0.1 + i * 0.02, 0.36 + i * 0.02], true);
  }
  // And the two seed leaves, first of all.
  for (const s of [-1, 1]) {
    const dir = v(s * 0.8, 0.6, 0.15).normalize();
    const face = UP.clone().addScaledVector(dir, -dir.y).normalize();
    leaves.push({ at: v(0, 0.012, 0), dir, face, len: 0.03, width: 0.022, shape: 5, arch: 0.4, win: [0.02, 0.1] });
  }

  let top = 0;
  for (const b of blooms) top = Math.max(top, b.at.y + b.size * 0.8);
  return { stems, leaves, blooms, height: H, top };
}

// --- the shaders ------------------------------------------------------------------------------------

/** Every plant's age and lean, and where it stands: (growth, droop, phase, height) and (base x, y, z, glow). */
const shared = {
  uTime: { value: 0 },
  uPlantA: { value: Array.from({ length: SLOTS }, () => new THREE.Vector4(0, 0, 0, 0.3)) },
  uPlantB: { value: Array.from({ length: SLOTS }, () => new THREE.Vector4()) },
};

/** The sway and the droop, shared by every part of a plant: a bend about its foot that grows toward the top. */
const BEND = /* glsl */ `
  uniform float uTime;
  uniform vec4 uPlantA[${SLOTS}];
  uniform vec4 uPlantB[${SLOTS}];
  attribute vec4 aMisc;
  mat3 rotX(float a) { float c = cos(a), s = sin(a); return mat3(1.0, 0.0, 0.0, 0.0, c, s, 0.0, -s, c); }
  mat3 rotZ(float a) { float c = cos(a), s = sin(a); return mat3(c, s, 0.0, -s, c, 0.0, 0.0, 0.0, 1.0); }
  int gSlot() { return int(aMisc.x + 0.5); }
  float gGrowth() { return uPlantA[gSlot()].x; }
  /** The bend at a point (in the mesh's space, which is the world's). */
  mat3 gBend(vec3 p) {
    vec4 a = uPlantA[gSlot()];
    vec4 b = uPlantB[gSlot()];
    float s = clamp((p.y - b.y) / max(a.w, 0.05), 0.0, 1.4);
    float k = s * sqrt(s);
    float ph = a.z;
    // A breath of air moving through the house, and the droop of a thirsty plant toward the aisle.
    float ax = sin(uTime * 1.3 + ph) * 0.028 + sin(uTime * 2.9 + ph * 2.0) * 0.01 + a.y * 0.85;
    float az = cos(uTime * 1.1 + ph * 1.7) * 0.026;
    return rotZ(az * k) * rotX(ax * k);
  }
  vec3 gBendPos(vec3 p) {
    vec3 base = uPlantB[gSlot()].xyz;
    return base + gBend(p) * (p - base);
  }
`;

/** Each kind's own shaping, in its local space: gShape(p, n) moves the vertex and gives its normal. */
const SHAPES: Record<'petal' | 'leaf' | 'stem' | 'eye', string> = {
  // A petal: u across (-1..1), t along (0..1). Width by shape, cupped, opened on its hinge.
  petal: /* glsl */ `
    attribute vec4 aPetal;
    attribute vec4 aWin;
    attribute vec3 aBase;
    attribute vec3 aTip;
    attribute vec3 aMark;
    varying vec3 vBase;
    varying vec3 vTip;
    varying vec3 vMark;
    varying vec2 vPetal;
    varying float vPattern;
    varying float vSeed;
    varying float vGlow;
    float halfWidth(float t, float shape) {
      t = clamp(t, 0.0, 1.0);
      float w;
      if (shape < 0.5) w = pow(max(sin(3.14159 * t), 0.0), 0.5) * mix(0.4, 1.0, smoothstep(0.0, 0.4, t));
      else if (shape < 1.5) w = pow(max(sin(3.14159 * pow(t, 0.68)), 0.0), 0.9);
      else if (shape < 2.5) w = pow(max(sin(3.14159 * t), 0.0), 0.45) * (1.0 + 0.1 * sin(t * 30.0 + aMisc.z * 6.0)) * mix(0.45, 1.0, smoothstep(0.0, 0.4, t));
      else w = pow(max(sin(3.14159 * min(t * 1.04, 1.0)), 0.0), 0.42) * mix(0.4, 1.0, smoothstep(0.0, 0.4, t));
      return w;
    }
    vec3 petalAt(float u, float t, float open, float cup) {
      float shape = aPetal.w;
      float len = aPetal.y;
      float w = halfWidth(t, shape) * aPetal.z * 0.5;
      // A notch at the tip: the middle a little shorter than the sides.
      if (shape > 2.5) t *= 1.0 - 0.16 * (1.0 - abs(u)) * smoothstep(0.55, 1.0, t);
      float x = u * w;
      // The length bends toward the front (−z) the more it's cupped, as an arc.
      float arc = cup * (1.0 - open * 0.25) + 0.15;
      float y = sin(arc * t) / arc * len;
      float z = -(1.0 - cos(arc * t)) / arc * len;
      // A shallow trough across it, and a frill at the edges.
      z -= u * u * w * 0.35;
      if (shape > 1.5 && shape < 2.5) z += sin(t * 26.0 + u * 2.0 + aMisc.z * 5.0) * 0.12 * w * abs(u) * t;
      // Open on the hinge: from pointing up the flower's axis to splayed out.
      float ang = mix(0.1, aPetal.x, open);
      float c = cos(ang), s = sin(ang);
      return vec3(x, y * c - z * s, y * s + z * c);
    }
    void gShape(inout vec3 p, inout vec3 n) {
      float g = gGrowth();
      float droop = uPlantA[gSlot()].y;
      float swell = smoothstep(aWin.x, aWin.y, g);
      float open = smoothstep(aWin.y, aWin.z, g) * (1.0 - droop * 0.3);
      float size = swell * mix(0.36, 1.0, smoothstep(0.0, 0.6, open));
      float u = p.x;
      float t = p.y;
      vec3 q = petalAt(u, t, open, aWin.w);
      vec3 du = petalAt(u + 0.05, t, open, aWin.w) - petalAt(u - 0.05, t, open, aWin.w);
      vec3 dt = petalAt(u, t + 0.04, open, aWin.w) - petalAt(u, max(t - 0.04, 0.0), open, aWin.w);
      vec3 nn = cross(du, dt);
      n = length(nn) > 1e-9 ? normalize(nn) : vec3(0.0, 0.0, 1.0);
      p = q * max(size, 1e-4);
      vBase = aBase;
      vTip = aTip;
      vMark = aMark;
      vPetal = vec2(u, t);
      vPattern = aMisc.y;
      vSeed = aMisc.z;
      vGlow = uPlantB[gSlot()].w;
    }
  `,
  // A leaf: u across, t along. Folded while young, flat and arching once grown.
  leaf: /* glsl */ `
    attribute vec4 aLeaf;
    attribute vec4 aWin;
    attribute vec3 aColor;
    varying vec3 vColor;
    varying vec2 vLeafUv;
    varying float vGlow;
    float halfWidth(float t, float shape) {
      t = clamp(t, 0.0, 1.0);
      if (shape < 0.5) return pow(max(sin(3.14159 * t), 0.0), 0.75);
      if (shape < 1.5) return pow(max(sin(3.14159 * pow(t, 0.55)), 0.0), 1.1);
      if (shape < 2.5) return pow(max(sin(3.14159 * t), 0.0), 0.7) * (0.72 + 0.28 * abs(sin(t * 3.14159 * 3.0)));
      if (shape < 3.5) return pow(max(sin(3.14159 * (0.2 + 0.8 * t)), 0.0), 0.6);
      if (shape < 4.5) return pow(max(sin(3.14159 * pow(t, 0.7)), 0.0), 1.2);
      return pow(max(sin(3.14159 * t), 0.0), 0.6);
    }
    vec3 leafAt(float u, float t, float unfurl, float arch) {
      float w = halfWidth(t, aLeaf.z) * aLeaf.y * 0.5;
      float x = u * w;
      float len = aLeaf.x;
      // A heart's two lobes sweep back past the stalk.
      float back = aLeaf.z > 2.5 && aLeaf.z < 3.5 ? abs(u) * (1.0 - t) * 0.22 * len : 0.0;
      float a = max(arch, 1e-3);
      float y = sin(a * t) / a * len - back;
      float z = -(1.0 - cos(a * t)) / a * len;
      // Young, it's folded up along the midrib; grown, a little cupped.
      z += abs(u) * w * mix(0.9, 0.12, unfurl);
      return vec3(x, y, z);
    }
    void gShape(inout vec3 p, inout vec3 n) {
      float g = gGrowth();
      float droop = uPlantA[gSlot()].y;
      float unfurl = smoothstep(aWin.x, aWin.y, g);
      float arch = aLeaf.w * mix(0.3, 1.0, unfurl) + droop * 0.7;
      float u = p.x;
      float t = p.y;
      vec3 q = leafAt(u, t, unfurl, arch);
      vec3 du = leafAt(u + 0.05, t, unfurl, arch) - leafAt(u - 0.05, t, unfurl, arch);
      vec3 dt = leafAt(u, t + 0.04, unfurl, arch) - leafAt(u, max(t - 0.04, 0.0), unfurl, arch);
      vec3 nn = cross(du, dt);
      n = length(nn) > 1e-9 ? normalize(nn) : vec3(0.0, 0.0, 1.0);
      p = q * max(mix(0.12, 1.0, unfurl) * step(aWin.x, g), 1e-4);
      vColor = aColor;
      vLeafUv = vec2(u, t);
      vGlow = uPlantB[gSlot()].w;
    }
  `,
  // A stem: a short tapering tube, growing up its length.
  stem: /* glsl */ `
    attribute vec4 aWin;
    attribute vec3 aColor;
    varying vec3 vColor;
    varying float vGlow;
    void gShape(inout vec3 p, inout vec3 n) {
      float grow = smoothstep(aWin.x, aWin.y, gGrowth());
      p.y *= max(grow, 1e-4);
      p.xz *= mix(0.45, 1.0, grow) * step(aWin.x, gGrowth());
      vColor = aColor;
      vGlow = uPlantB[gSlot()].w;
    }
  `,
  // The eye of a flower: a little dome of stamens, coming up as it opens.
  eye: /* glsl */ `
    attribute vec4 aWin;
    attribute vec3 aColor;
    varying vec3 vColor;
    varying float vGlow;
    void gShape(inout vec3 p, inout vec3 n) {
      float open = smoothstep(aWin.y, aWin.z, gGrowth());
      p *= max(open, 1e-4);
      vColor = aColor;
      vGlow = uPlantB[gSlot()].w;
    }
  `,
};

/** The colors, in the fragment shader: a petal's gradient and its markings; a leaf's veins. */
const PAINT: Record<'petal' | 'leaf' | 'stem' | 'eye', string> = {
  petal: /* glsl */ `
    float h21(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
    vec3 petalColor() {
      float u = vPetal.x;
      float t = vPetal.y;
      vec3 col = mix(vBase, vTip, smoothstep(0.08, 0.92, t));
      // Fine veins along it, and a deeper flush at the very heart.
      col *= 1.0 - 0.07 * smoothstep(0.6, 1.0, abs(sin(u * 22.0 + vSeed * 3.0)));
      col *= mix(0.78, 1.0, smoothstep(0.0, 0.16, t));
      float m = 0.0;
      if (vPattern > 0.5 && vPattern < 1.5) {
        // Stripes running out from the heart.
        m = smoothstep(0.55, 0.9, abs(sin(u * 5.2 + 0.4 * sin(t * 6.0)))) * smoothstep(0.05, 0.25, t) * (1.0 - smoothstep(0.86, 1.0, t));
      } else if (vPattern > 1.5 && vPattern < 2.5) {
        // An edge of another color all round.
        float e = min(1.0 - abs(u), (1.0 - t) * 2.6);
        m = smoothstep(0.24, 0.1, e) * smoothstep(0.1, 0.3, t);
      } else if (vPattern > 2.5) {
        // Freckles, thickest toward the heart.
        vec2 g = vec2(u * 5.0, t * 9.0);
        vec2 c = floor(g);
        vec2 f = fract(g) - (0.3 + 0.4 * vec2(h21(c + vSeed), h21(c + 7.7 + vSeed)));
        float there = step(h21(c + 3.1 + vSeed), 0.75 - t * 0.5);
        m = smoothstep(0.24, 0.14, length(f)) * there * smoothstep(0.04, 0.12, t);
      }
      return mix(col, vMark, m * 0.92);
    }
  `,
  leaf: /* glsl */ `
    vec3 leafColor() {
      float u = vLeafUv.x;
      float t = vLeafUv.y;
      vec3 col = vColor * mix(0.75, 1.1, t);
      // A paler midrib and the side veins running out from it.
      col = mix(col, col * 1.45 + 0.02, smoothstep(0.08, 0.0, abs(u)) * 0.6);
      col *= 1.0 - 0.1 * smoothstep(0.75, 1.0, abs(sin((t - abs(u) * 0.35) * 26.0)));
      return col;
    }
  `,
  stem: '',
  eye: '',
};

type Kind = keyof typeof SHAPES;

/** A MeshStandardMaterial (and its shadow) taught to grow, bend and color one kind of plant part. */
function plantMaterial(kind: Kind, opts: THREE.MeshStandardMaterialParameters) {
  const vertex = (s: { vertexShader: string }, depth: boolean) => {
    s.vertexShader = s.vertexShader
      .replace('#include <common>', `#include <common>\n${BEND}\n${SHAPES[kind]}`)
      .replace(
        '#include <beginnormal_vertex>',
        /* glsl */ `
        vec3 objectNormal = vec3(normal);
        vec3 gPos = position;
        gShape(gPos, objectNormal);
        #ifdef USE_TANGENT
          vec3 objectTangent = vec3(tangent.xyz);
        #endif
      `,
      )
      .replace(
        '#include <defaultnormal_vertex>',
        /* glsl */ `
        vec3 transformedNormal = objectNormal;
        mat3 gIm = mat3(instanceMatrix);
        transformedNormal /= vec3(dot(gIm[0], gIm[0]), dot(gIm[1], gIm[1]), dot(gIm[2], gIm[2]));
        transformedNormal = gIm * transformedNormal;
        transformedNormal = gBend((instanceMatrix * vec4(gPos, 1.0)).xyz) * transformedNormal;
        transformedNormal = normalMatrix * transformedNormal;
      `,
      )
      .replace('#include <begin_vertex>', depth ? 'vec3 gPos = position; vec3 gN = vec3(0.0, 0.0, 1.0); gShape(gPos, gN); vec3 transformed = gPos;' : 'vec3 transformed = gPos;')
      .replace(
        '#include <project_vertex>',
        /* glsl */ `
        vec4 gWorld = instanceMatrix * vec4(transformed, 1.0);
        gWorld.xyz = gBendPos(gWorld.xyz);
        vec4 mvPosition = modelViewMatrix * gWorld;
        gl_Position = projectionMatrix * mvPosition;
      `,
      )
      .replace(
        '#include <worldpos_vertex>',
        /* glsl */ `
        vec4 worldPosition = modelMatrix * vec4(gBendPos((instanceMatrix * vec4(transformed, 1.0)).xyz), 1.0);
      `,
      );
  };
  const mat = new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, ...opts });
  mat.onBeforeCompile = (s) => {
    Object.assign(s.uniforms, shared);
    vertex(s, false);
    const varyings = SHAPES[kind]
      .split('\n')
      .filter((l) => l.trim().startsWith('varying'))
      .join('\n');
    s.fragmentShader = s.fragmentShader
      .replace('#include <common>', `#include <common>\n${varyings}\n${PAINT[kind]}`)
      .replace(
        '#include <color_fragment>',
        kind === 'petal' ? 'diffuseColor.rgb = petalColor();' : kind === 'leaf' ? 'diffuseColor.rgb = leafColor();' : 'diffuseColor.rgb = vColor;',
      )
      .replace(
        '#include <lights_fragment_end>',
        /* glsl */ `
        #include <lights_fragment_end>
        // Light through the leaf or petal from the far side: the low sun, behind it, makes it glow.
        #if NUM_DIR_LIGHTS > 0
          float gSun = 1.0;
          #if defined( USE_SHADOWMAP ) && NUM_DIR_LIGHT_SHADOWS > 0
            gSun = getShadow(directionalShadowMap[0], directionalLightShadows[0].shadowMapSize, directionalLightShadows[0].shadowIntensity, directionalLightShadows[0].shadowBias, directionalLightShadows[0].shadowRadius, vDirectionalShadowCoord[0]);
          #endif
          vec3 gL = directionalLights[0].direction;
          float gThrough = 0.35 * max(-dot(normal, gL), 0.0) + 0.9 * pow(max(dot(-geometryViewDir, gL), 0.0), 3.0);
          totalEmissiveRadiance += diffuseColor.rgb * directionalLights[0].color * gSun * gThrough * ${kind === 'petal' ? '0.6' : kind === 'leaf' ? '0.55' : '0.0'};
        #endif
        totalEmissiveRadiance += vec3(0.16, 0.1, 0.03) * vGlow;
      `,
      );
  };
  mat.customProgramCacheKey = () => `greenhouse-${kind}`;
  const depth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, side: THREE.DoubleSide });
  depth.onBeforeCompile = (s) => {
    Object.assign(s.uniforms, shared);
    vertex(s, true);
  };
  depth.customProgramCacheKey = () => `greenhouse-${kind}-depth`;
  return { mat, depth };
}

/** A strip u -1..1 by t 0..1, for petals and leaves to bend. */
function strip(across: number, along: number) {
  const geo = new THREE.PlaneGeometry(2, 1, across, along);
  geo.translate(0, 0.5, 0);
  return geo;
}

/** An instanced mesh of one kind of part, with room for `n` and the attributes it needs. */
function parts(kind: Kind, geo: THREE.BufferGeometry, n: number, attrs: Record<string, number>, opts: THREE.MeshStandardMaterialParameters) {
  for (const [name, size] of Object.entries({ aMisc: 4, ...attrs })) {
    const a = new THREE.InstancedBufferAttribute(new Float32Array(n * size), size);
    geo.setAttribute(name, a);
  }
  const { mat, depth } = plantMaterial(kind, opts);
  const mesh = new THREE.InstancedMesh(geo, mat, n);
  mesh.customDepthMaterial = depth;
  mesh.count = 0;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  // The shader moves everything; the bounds can't know where.
  mesh.frustumCulled = false;
  return mesh;
}

// --- the flowers in the house ----------------------------------------------------------------------

export interface Flowers {
  group: THREE.Group;
  /** Something to click for each pot (the plant, or the empty pot). */
  pick: THREE.Mesh[];
  /** Puts a plant in a pot (or empties it). The seed varies its shape a little; the same seed, the same plant. */
  set(slot: number, g: Genome | null, seed?: number): void;
  /** Per frame, each pot's state: how grown (0..1), how drooped (0..1), and a glow for hover or picking. */
  state(slot: number, growth: number, droop: number, glow: number): void;
  /** Where its blooms are, in the world (main one first), and how big. */
  blooms(slot: number): { at: THREE.Vector3; axis: THREE.Vector3; size: number }[];
  /** The top of the plant in a pot, in the world, or the pot's rim if it's empty. */
  top(slot: number): THREE.Vector3;
  plan(slot: number): Plan | null;
  tick(t: number): void;
}

/** A pot's world matrix: its foot on the staging, turned to face the aisle. */
const potMatrix = (slot: number) => new THREE.Matrix4().makeTranslation(POT_AT[slot].x, POT_AT[slot].y, POT_AT[slot].z);

export function buildFlowers(quality: 'high' | 'low'): Flowers {
  const group = new THREE.Group();
  const high = quality === 'high';
  const MAX = { petal: SLOTS * 4 * 28, leaf: SLOTS * 40, stem: SLOTS * 26, eye: SLOTS * 4 };
  const petals = parts('petal', strip(high ? 6 : 4, high ? 8 : 5), MAX.petal, { aPetal: 4, aWin: 4, aBase: 3, aTip: 3, aMark: 3 }, { roughness: 0.55 });
  const leafMesh = parts('leaf', strip(4, high ? 7 : 5), MAX.leaf, { aLeaf: 4, aWin: 4, aColor: 3 }, { roughness: 0.6 });
  const stemGeo = new THREE.CylinderGeometry(0.8, 1, 1, 6, 1, true);
  stemGeo.translate(0, 0.5, 0);
  const stemMesh = parts('stem', stemGeo, MAX.stem, { aWin: 4, aColor: 3 }, { roughness: 0.6 });
  const eyeGeo = new THREE.SphereGeometry(1, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2);
  eyeGeo.scale(1, 0.55, 1);
  const eyeMesh = parts('eye', eyeGeo, MAX.eye, { aWin: 4, aColor: 3 }, { roughness: 0.85 });
  group.add(petals, leafMesh, stemMesh, eyeMesh);

  // The pots and their soil.
  const potProfile = [
    [0, 0.002],
    [POT.r * 0.72, 0],
    [POT.r * 0.92, POT.h * 0.82],
    [POT.r * 1.02, POT.h * 0.84],
    [POT.r * 1.03, POT.h],
    [POT.r * 0.9, POT.h],
    [POT.r * 0.86, POT.h * 0.86],
    [POT.r * 0.72, POT.h * 0.1],
    [0, POT.h * 0.1],
  ].map(([a, b]) => new THREE.Vector2(a, b));
  const pots = new THREE.InstancedMesh(new THREE.LatheGeometry(potProfile, high ? 24 : 16), new THREE.MeshStandardMaterial({ map: terracotta(3), roughness: 0.88 }), SLOTS);
  const soils = new THREE.InstancedMesh(new THREE.CircleGeometry(POT.r * 0.86, 16).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: soilTexture(9), roughness: 1 }), SLOTS);
  for (let i = 0; i < SLOTS; i++) {
    pots.setMatrixAt(i, potMatrix(i));
    soils.setMatrixAt(i, potMatrix(i).multiply(new THREE.Matrix4().makeTranslation(0, POT.h * 0.82, 0)));
  }
  pots.castShadow = true;
  pots.receiveShadow = true;
  soils.receiveShadow = true;
  group.add(pots, soils);

  // Something to click for each pot.
  const pickMat = new THREE.MeshBasicMaterial({ visible: false });
  const pick = POT_AT.map((p) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.13, 1, 10), pickMat);
    m.position.copy(p);
    group.add(m);
    return m;
  });

  // What each pot holds, as instance ranges rebuilt whenever a pot changes.
  const plans: (Plan | null)[] = Array.from({ length: SLOTS }, () => null);
  const genomes: (Genome | null)[] = Array.from({ length: SLOTS }, () => null);
  const seeds = new Float64Array(SLOTS);
  const m4 = new THREE.Matrix4();
  const basis = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const leafColor = (g: Genome, k: number) => {
    const c = new THREE.Color(['#3a6a2a', '#5a9a32', '#6a908a', '#7a5428'][g.foliage]);
    return c.multiplyScalar(0.85 + k * 0.3);
  };
  const stemColor = (g: Genome) => new THREE.Color(['#467028', '#5a8a30', '#648a74', '#6a5a2a'][g.foliage]);
  /** A frame for a part: y along `y`, z as near `z` as can be. */
  const frame = (at: THREE.Vector3, y: THREE.Vector3, z: THREE.Vector3, scale = 1) => {
    const ny = y.clone().normalize();
    const nx = new THREE.Vector3().crossVectors(ny, z).normalize();
    if (nx.lengthSq() < 1e-6) nx.set(1, 0, 0);
    const nz = new THREE.Vector3().crossVectors(nx, ny);
    return basis.makeBasis(nx, ny, nz).scale(v(scale, scale, scale)).setPosition(at);
  };

  const rebuild = () => {
    const counts = { petal: 0, leaf: 0, stem: 0, eye: 0 };
    const put = (mesh: THREE.InstancedMesh, kind: keyof typeof counts, matrix: THREE.Matrix4, slot: number, values: Record<string, number[]>, misc: number[] = [0, 0]) => {
      const i = counts[kind]++;
      if (i >= MAX[kind]) return;
      mesh.setMatrixAt(i, matrix);
      (mesh.geometry.attributes.aMisc as THREE.InstancedBufferAttribute).setXYZW(i, slot, misc[0], misc[1], 0);
      for (const [name, vals] of Object.entries(values)) {
        const a = mesh.geometry.attributes[name] as THREE.InstancedBufferAttribute;
        for (let k = 0; k < vals.length; k++) a.array[i * a.itemSize + k] = vals[k];
      }
    };
    for (let slot = 0; slot < SLOTS; slot++) {
      const plan = plans[slot];
      const g = genomes[slot];
      if (!plan || !g) continue;
      const pot = potMatrix(slot).multiply(new THREE.Matrix4().makeTranslation(0, POT.h * 0.82, 0));
      const world = (p: THREE.Vector3) => p.clone().applyMatrix4(pot);
      const stemCol = stemColor(g).toArray();
      for (const s of plan.stems) {
        const a = world(s.from);
        const b = world(s.to);
        const len = a.distanceTo(b);
        q.setFromUnitVectors(UP, b.clone().sub(a).normalize());
        m4.compose(a, q, v(s.r, len * 1.04, s.r));
        put(stemMesh, 'stem', m4, slot, { aWin: [s.win[0], s.win[1], 0, 0], aColor: stemCol });
      }
      plan.leaves.forEach((l, k) => {
        const col = (l.shape === 5 ? stemColor(g).multiplyScalar(1.3) : leafColor(g, (k % 3) / 2)).toArray();
        put(leafMesh, 'leaf', frame(world(l.at), l.dir, l.face), slot, { aLeaf: [l.len, l.width, l.shape, l.arch], aWin: [l.win[0], l.win[1], 0, 0], aColor: col });
      });
      const base = linear(g.base).toArray();
      const tip = linear(g.tip).toArray();
      const mark = linear(g.mark).toArray();
      // The eye: gold, unless the petals are gold already, then dark.
      const goldish = (g.base.h * 360) / 64 > 30 && (g.base.h * 360) / 64 < 70 && g.base.s >= 4;
      const eyeCol = new THREE.Color(goldish ? '#3a2410' : g.pattern === 3 ? '#5a3a18' : '#e8b030').toArray();
      const r = seeded(seeds[slot] + 17);
      plan.blooms.forEach((b, bi) => {
        const at = world(b.at);
        const axis = b.axis.clone();
        const ref = Math.abs(axis.y) < 0.95 ? UP : v(0, 0, 1);
        const whorls = g.double ? 2 : 1;
        const cupAngle = [1.42, 1.18, 0.92, 0.66][g.cup];
        const shapeWide = [1.5, 1.0, 1.45, 1.3][g.shape];
        for (let w = 0; w < whorls; w++) {
          const n = w === 0 ? g.petals : Math.min(14, g.petals + 2);
          const len = b.size * (w === 0 ? 1 : 0.68);
          const width = Math.min(len * 0.95, ((2 * Math.PI * len * 0.55) / n) * shapeWide);
          const offset = r() * 6.28 + (w ? Math.PI / n : 0);
          for (let k = 0; k < n; k++) {
            const phi = offset + (k / n) * Math.PI * 2 + (r() - 0.5) * 0.08;
            // The petal's frame: up the bloom's axis, turned round it, out a little from the middle.
            const f = frame(at, axis, ref).multiply(new THREE.Matrix4().makeRotationY(phi)).multiply(new THREE.Matrix4().makeTranslation(0, w ? 0.004 : 0, b.size * 0.08));
            const open = (w ? cupAngle * 0.62 : cupAngle) + (r() - 0.5) * 0.12;
            put(petals, 'petal', f, slot, { aPetal: [open, len * (0.94 + r() * 0.1), width, g.shape], aWin: [b.win[0], b.win[1], b.win[2] + w * 0.02, [0.25, 0.7, 1.2, 1.8][g.cup] * (w ? 1.6 : 1)], aBase: base, aTip: tip, aMark: mark }, [g.pattern, r()]);
          }
        }
        // Green sepals behind the petals, holding the bud.
        for (let k = 0; k < 5; k++) {
          const phi = (k / 5) * Math.PI * 2 + bi;
          const f = frame(at, axis, ref).multiply(new THREE.Matrix4().makeRotationY(phi)).multiply(new THREE.Matrix4().makeTranslation(0, -0.004, b.size * 0.06)).multiply(new THREE.Matrix4().makeRotationX(1.9));
          put(leafMesh, 'leaf', f, slot, { aLeaf: [b.size * 0.42, b.size * 0.2, 4, 0.5], aWin: [b.win[0], b.win[0] + 0.08, 0, 0], aColor: stemCol });
        }
        const s = b.size * 0.26;
        put(eyeMesh, 'eye', frame(at.clone().addScaledVector(axis, 0.002), axis, ref, s), slot, { aWin: [0, b.win[1], b.win[2], 0], aColor: eyeCol });
      });
    }
    for (const [mesh, kind] of [
      [petals, 'petal'],
      [leafMesh, 'leaf'],
      [stemMesh, 'stem'],
      [eyeMesh, 'eye'],
    ] as const) {
      mesh.count = Math.min(counts[kind], MAX[kind]);
      mesh.instanceMatrix.needsUpdate = true;
      for (const a of Object.values(mesh.geometry.attributes)) if (a instanceof THREE.InstancedBufferAttribute) a.needsUpdate = true;
    }
  };

  let dirty = false;
  return {
    group,
    pick,
    set(slot, g, seed) {
      genomes[slot] = g;
      seeds[slot] = seed ?? (g ? hash(JSON.stringify(g)) : 0);
      plans[slot] = g ? grow(g, seeds[slot]) : null;
      const p = plans[slot];
      const top = p ? POT.h + p.top + 0.06 : POT.h + 0.04;
      pick[slot].scale.set(1, top, 1);
      pick[slot].position.set(POT_AT[slot].x, POT_AT[slot].y + top / 2, POT_AT[slot].z);
      const a = shared.uPlantA.value[slot];
      a.z = (seeds[slot] % 1000) / 159;
      a.w = p ? p.height : 0.3;
      shared.uPlantB.value[slot].set(POT_AT[slot].x, POT_AT[slot].y + POT.h * 0.82, POT_AT[slot].z, 0);
      dirty = true;
    },
    state(slot, growth, droop, glow) {
      const a = shared.uPlantA.value[slot];
      a.x = growth;
      a.y = droop;
      shared.uPlantB.value[slot].w = glow;
    },
    blooms(slot) {
      const p = plans[slot];
      if (!p) return [];
      const off = v(POT_AT[slot].x, POT_AT[slot].y + POT.h * 0.82, POT_AT[slot].z);
      return p.blooms.map((b) => ({ at: b.at.clone().add(off), axis: b.axis.clone(), size: b.size }));
    },
    top(slot) {
      const p = plans[slot];
      return v(POT_AT[slot].x, POT_AT[slot].y + POT.h + (p ? p.top : 0), POT_AT[slot].z);
    },
    plan: (slot) => plans[slot],
    tick(t) {
      if (dirty) {
        dirty = false;
        rebuild();
      }
      shared.uTime.value = t;
    },
  };
}
