// The galleries. One hexagon is built once, piece by piece (its floor of
// hexagonal stones round the well, the stair winding through the well, the
// railing, the four walls of shelves, the two arches, the frieze, the ceiling
// and the two lamps) and then stamped into every gallery along the line and
// every floor up and down the well, so there are hundreds of them for the price
// of one. The haze swallows the rest; the library goes on regardless.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { canvas, glow, rng, texture, wood } from '../../textures';
import type { Quality } from '../../world';
import { lit } from './light';
import { ashlar, frieze, plaster, tiles } from './paint';
import { bayOffset, center, D, FREE, HEX, RESERVED, SHELVED, SIDES, wallMatrix } from './plan';
import { bayBooks, bayCase, bayStrips, box, corners, spineAtlas, stripAtlas, type Gap } from './shelves';

/** The stair's landing on every floor: on the far side of the well from the desk, a little round. */
export const LANDING = Math.PI * 0.82;
const STEPS = 24;
const RISE = HEX.F / STEPS;
const STEP = (Math.PI * 2) / STEPS;
/** The treads run from the open middle of the well out nearly to its edge. */
const TREAD = { inner: 0.95, outer: 1.84 };

export interface Copy {
  k: number;
  j: number;
  /** Close enough to want books you could pull out, not a painted strip. */
  near: boolean;
}

/** A bay of shelves somewhere in the library, and the gap kept on one of its shelves. */
export interface Slot {
  k: number;
  j: number;
  side: number;
  bay: number;
  matrix: THREE.Matrix4;
  gap: Gap | null;
}

export interface Hall {
  group: THREE.Group;
  copies: Copy[];
  slots: Slot[];
  /** Where the lantern is, going down the stair: 0 at the top, 1 far below. */
  lanternAt(u: number): THREE.Vector3;
  tick(t: number): void;
  materials: { wood: THREE.MeshStandardMaterial; books: THREE.MeshStandardMaterial; stone: THREE.MeshStandardMaterial; bronze: THREE.MeshStandardMaterial };
  atlas: THREE.Texture;
}

/** Which galleries to build: the line of them on our floor, and floors up and down the wells we walk past. */
export function plan(quality: Quality): Copy[] {
  const high = quality === 'high';
  const out: Copy[] = [];
  const add = (k: number, j: number, near: boolean) => out.push({ k, j, near });
  for (let k = -3; k <= 4; k++) add(k, 0, k >= (high ? -1 : 0) && k <= 3);
  for (let j = high ? -5 : -3; j <= (high ? 6 : 4); j++) if (j !== 0) add(0, j, false);
  for (const k of [-1, 1, 2, 3]) for (const j of high ? [-1, 1] : [1]) add(k, j, false);
  return out;
}

const tilt = (m: THREE.Matrix4, g: THREE.BufferGeometry) => g.applyMatrix4(m);
const flat = (g: THREE.BufferGeometry) => (g.index ? g.toNonIndexed() : g);
/** Scales a geometry's 0..1 UVs to meters, for textures that repeat by the meter. */
const meters = (g: THREE.BufferGeometry, w: number, h: number) => {
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w, uv.getY(i) * h);
  return g;
};

/** The hexagon's outline, `inset` in from its walls, with the well cut out. Drawn in (x, -z) so that turned to lie flat it lands right way round. */
function floorShape(sign: 1 | -1) {
  const s = new THREE.Shape();
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2;
    const x = Math.cos(a) * HEX.R;
    const y = sign * Math.sin(a) * HEX.R;
    if (k === 0) s.moveTo(x, y);
    else s.lineTo(x, y);
  }
  s.closePath();
  const hole = new THREE.Path();
  hole.absarc(0, 0, HEX.well, 0, Math.PI * 2, true);
  s.holes.push(hole);
  return s;
}

/** A free side: the wall with the arch through it, as an upside-down U so there's no hole to cut. */
function archWall() {
  const half = HEX.R / 2;
  const w = HEX.archW;
  const spring = HEX.archTop - w;
  const s = new THREE.Shape();
  s.moveTo(-half, 0);
  s.lineTo(-w, 0);
  s.lineTo(-w, spring);
  s.absarc(0, spring, w, Math.PI, 0, true);
  s.lineTo(w, 0);
  s.lineTo(half, 0);
  s.lineTo(half, HEX.ceiling);
  s.lineTo(-half, HEX.ceiling);
  s.closePath();
  return new THREE.ShapeGeometry(s, 32);
}

/** The molding round an arch: a flat band of stone standing a little proud of the wall. */
function archBand(width: number, proud: number) {
  const w = HEX.archW;
  const spring = HEX.archTop - w;
  const s = new THREE.Shape();
  s.moveTo(-w - width, 0);
  s.lineTo(-w - width, spring);
  s.absarc(0, spring, w + width, Math.PI, 0, true);
  s.lineTo(w + width, 0);
  s.lineTo(w, 0);
  s.lineTo(w, spring);
  s.absarc(0, spring, w, 0, Math.PI, false);
  s.lineTo(-w, 0);
  s.closePath();
  return new THREE.ExtrudeGeometry(s, { depth: proud, bevelEnabled: false, curveSegments: 32 });
}

/** An annular slice, lying flat: one tread of the stair. */
function tread(a0: number, a1: number, thick: number) {
  const s = new THREE.Shape();
  const n = 6;
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n;
    const p = new THREE.Vector2(Math.cos(a) * TREAD.outer, -Math.sin(a) * TREAD.outer);
    if (i === 0) s.moveTo(p.x, p.y);
    else s.lineTo(p.x, p.y);
  }
  for (let i = n; i >= 0; i--) {
    const a = a0 + ((a1 - a0) * i) / n;
    s.lineTo(Math.cos(a) * TREAD.inner, -Math.sin(a) * TREAD.inner);
  }
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: thick, bevelEnabled: false });
  g.rotateX(-Math.PI / 2);
  return g;
}

/** A helix round the well's axis, one turn per floor. */
class Helix extends THREE.Curve<THREE.Vector3> {
  constructor(
    private radius: number,
    private lift: number,
  ) {
    super();
  }
  getPoint(u: number, out = new THREE.Vector3()) {
    const a = LANDING + u * Math.PI * 2;
    return out.set(Math.cos(a) * this.radius, u * HEX.F + this.lift, Math.sin(a) * this.radius);
  }
}

/** The height of the stair's treads at angle a (round from the landing), on the floor that starts at 0. */
export const stairY = (turns: number) => turns * HEX.F + RISE;

/** Stamps a geometry into every one of `matrices`. */
function stamp(geo: THREE.BufferGeometry, mat: THREE.Material, matrices: THREE.Matrix4[], shadows: { cast?: boolean; receive?: boolean } = {}) {
  const m = new THREE.InstancedMesh(geo, mat, Math.max(1, matrices.length));
  matrices.forEach((x, i) => m.setMatrixAt(i, x));
  m.count = matrices.length;
  m.instanceMatrix.needsUpdate = true;
  m.computeBoundingSphere();
  m.castShadow = !!shadows.cast;
  m.receiveShadow = !!shadows.receive;
  return m;
}

const SKY_VERT = /* glsl */ `
  varying vec3 vNrm;
  varying vec3 vWorld;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    vec4 w = modelMatrix * vec4(position, 1.0);
    vWorld = w.xyz;
    vNrm = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;
// The light falling down the well: a pale column, brightest through its middle,
// fading as it sinks, with dust turning slowly in it.
const SHAFT_FRAG = /* glsl */ `
  uniform float uTime;
  uniform float uTop;
  uniform float uLen;
  varying vec3 vNrm;
  varying vec3 vWorld;
  varying vec2 vUv;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5); }
  void main() {
    vec3 v = normalize(cameraPosition - vWorld);
    float core = pow(abs(dot(normalize(vNrm), v)), 2.0);
    float down = (uTop - vWorld.y) / uLen;
    float along = smoothstep(0.0, 0.08, down) * exp(-down * 2.6);
    vec2 g = vec2(vUv.x * 70.0, vWorld.y * 7.0 + uTime * 0.18);
    vec2 cell = floor(g);
    float twinkle = 0.5 + 0.5 * sin(uTime * 0.7 + hash(cell + 3.1) * 40.0);
    float dust = step(0.986, hash(cell)) * smoothstep(0.42, 0.0, length(fract(g) - 0.5)) * twinkle;
    float a = core * along * (0.05 + dust * 0.9);
    gl_FragColor = vec4(vec3(0.78, 0.86, 1.0) * a, 1.0);
  }
`;

export function buildHall(quality: Quality): Hall {
  const group = new THREE.Group();
  const copies = plan(quality);
  const at = copies.map((c) => new THREE.Matrix4().makeTranslation(center(c.k, c.j)));
  const has = (k: number, j: number) => copies.some((c) => c.k === k && c.j === j);

  // --- materials -----------------------------------------------------------------
  const floorTex = tiles(0.32);
  const floorMat = lit(new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.32, envMapIntensity: 0.05 }), { spec: 0.6, shine: 60 });
  const plasterTex = plaster(5);
  plasterTex.repeat.set(1 / 3, 1 / 3);
  const ceilingMat = lit(new THREE.MeshStandardMaterial({ map: plasterTex, color: '#7d6c56', roughness: 0.95 }));
  const stoneTex = ashlar(11);
  const stoneMat = lit(new THREE.MeshStandardMaterial({ map: stoneTex, roughness: 0.85, side: THREE.DoubleSide }));
  const trimMat = lit(new THREE.MeshStandardMaterial({ color: '#b3a07e', roughness: 0.8, side: THREE.DoubleSide }));
  const woodTex = wood(51, '#4a2a16', '#24120a');
  woodTex.wrapS = woodTex.wrapT = THREE.RepeatWrapping;
  const woodMat = lit(new THREE.MeshStandardMaterial({ map: woodTex, roughness: 0.55, envMapIntensity: 0.2 }), { bake: true, spec: 0.12, shine: 24 });
  const atlas = spineAtlas();
  const booksMat = lit(new THREE.MeshStandardMaterial({ map: atlas, roughness: 0.72 }), { bake: true, spec: 0.04, shine: 12 });
  const stripMat = lit(new THREE.MeshStandardMaterial({ map: stripAtlas(), roughness: 0.8 }), { bake: true });
  const friezeMat = lit(new THREE.MeshStandardMaterial({ map: frieze(9), roughness: 0.9, side: THREE.DoubleSide }));
  const bronzeMat = lit(new THREE.MeshStandardMaterial({ color: '#5a3c1e', metalness: 0.55, roughness: 0.38, envMapIntensity: 0.5 }), { spec: 0.7, shine: 36 });
  const treadMat = lit(new THREE.MeshStandardMaterial({ color: '#8f7a5e', roughness: 0.7 }), { spec: 0.15, shine: 30 });

  // --- the floor, the well's curb, the ceiling ---------------------------------------
  const floor = new THREE.ShapeGeometry(floorShape(-1), 48);
  floor.rotateX(-Math.PI / 2);
  group.add(stamp(floor, floorMat, at, { cast: true, receive: true }));
  const ceiling = new THREE.ShapeGeometry(floorShape(1), 48);
  ceiling.rotateX(Math.PI / 2);
  ceiling.translate(0, HEX.ceiling, 0);
  group.add(stamp(ceiling, ceilingMat, at));
  // The curb: the well's lining from the ceiling below up through the floor, and a rounded lip.
  const curb = new THREE.LatheGeometry(
    [
      [HEX.well + 0.24, 0.0],
      [HEX.well + 0.24, 0.07],
      [HEX.well + 0.2, 0.11],
      [HEX.well + 0.02, 0.11],
      [HEX.well, 0.08],
      [HEX.well, -(HEX.F - HEX.ceiling)],
      [HEX.well + 0.06, -(HEX.F - HEX.ceiling) - 0.04],
      [HEX.well + 0.16, -(HEX.F - HEX.ceiling) - 0.1],
      [HEX.well + 0.3, -(HEX.F - HEX.ceiling) - 0.12],
    ].map(([x, y]) => new THREE.Vector2(x, y)),
    72,
  );
  group.add(stamp(curb, trimMat, at));

  // --- the walls -----------------------------------------------------------------------
  const stoneParts: THREE.BufferGeometry[] = [];
  const trimParts: THREE.BufferGeometry[] = [];
  const friezeParts: THREE.BufferGeometry[] = [];
  for (const i of FREE) {
    const m = wallMatrix(0, 0, i, 0, 0);
    stoneParts.push(tilt(m, archWall()));
    trimParts.push(tilt(m, archBand(0.22, 0.06)));
  }
  for (const i of SHELVED) {
    const f = new THREE.PlaneGeometry(HEX.R, HEX.ceiling - HEX.caseTop);
    f.translate(0, (HEX.ceiling + HEX.caseTop) / 2, 0);
    friezeParts.push(tilt(wallMatrix(0, 0, i, 0, 0), f));
  }
  group.add(stamp(mergeGeometries(stoneParts.map(flat)), stoneMat, at));
  group.add(stamp(mergeGeometries(trimParts.map(flat)), trimMat, at));
  group.add(stamp(mergeGeometries(friezeParts), friezeMat, at));

  // --- the shelves -----------------------------------------------------------------
  const variants = quality === 'high' ? 4 : 3;
  const near = Array.from({ length: variants }, (_, v) => bayBooks(300 + v * 17, quality !== 'high'));
  const far = Array.from({ length: variants }, (_, v) => bayStrips(900 + v * 5));
  const caseAt: THREE.Matrix4[] = [];
  const nearAt: THREE.Matrix4[][] = near.map(() => []);
  const farAt: THREE.Matrix4[][] = far.map(() => []);
  const slots: Slot[] = [];
  const alcove = (k: number, j: number, side: number, bay: number) =>
    j === 0 && RESERVED.some((r) => r.kind === 'alcove' && r.k === k && r.side === side && bay >= r.bay && bay < r.bay + r.n);
  const pick = rng(2024);
  for (const c of copies)
    for (const side of SHELVED)
      for (let bay = 0; bay < HEX.bays; bay++) {
        if (alcove(c.k, c.j, side, bay)) continue;
        const m = wallMatrix(c.k, c.j, side, bayOffset(bay), 0);
        const v = Math.floor(pick() * variants);
        caseAt.push(m);
        (c.near ? nearAt : farAt)[v].push(m);
        slots.push({ k: c.k, j: c.j, side, bay, matrix: m, gap: c.near ? near[v].gap : null });
      }
  group.add(stamp(bayCase(), woodMat, caseAt, { receive: true }));
  near.forEach((b, v) => group.add(stamp(b.geometry, booksMat, nearAt[v], { receive: true })));
  far.forEach((g, v) => group.add(stamp(g, stripMat, farAt[v])));
  group.add(stamp(corners((i) => FREE.includes(i), SIDES), woodMat, at));

  // --- where the studio's things go -------------------------------------------------------
  // A paneled stretch of wall: the shelves stop at the panel's top, and run on above it.
  // An alcove: the shelves start again above it, and below is room for a small bookcase.
  const studioWood: THREE.BufferGeometry[] = [];
  const studioPanel: THREE.BufferGeometry[] = [];
  // Box UVs run 0..1 on every face; on a big panel that stretches the grain, so give it the size of the face instead.
  const grain = (g: THREE.BufferGeometry) => {
    g.computeBoundingBox();
    const s = g.boundingBox!.getSize(new THREE.Vector3());
    const uv = g.attributes.uv;
    const n = g.attributes.normal;
    for (let i = 0; i < uv.count; i++) {
      const across = Math.abs(n.getX(i)) > 0.5 ? s.z : s.x;
      const up = Math.abs(n.getY(i)) > 0.5 ? s.z : s.y;
      uv.setXY(i, (uv.getX(i) * across) / 1.6, (uv.getY(i) * up) / 0.5);
    }
    return g;
  };
  const studioBooks: THREE.BufferGeometry[] = [];
  for (const res of RESERVED) {
    const mid = (bayOffset(res.bay) + bayOffset(res.bay + res.n - 1)) / 2;
    const W = res.n * HEX.bayW;
    const m = wallMatrix(res.k, 0, res.side, mid, 0);
    if (res.kind === 'panel') {
      const top = 2.928;
      const dd = HEX.depth + 0.01;
      const parts = [
        box(W, top, dd, 0, top / 2, dd / 2, 0.75),
        box(W, 0.16, 0.02, 0, 0.08, dd + 0.01, 0.65),
        box(W, 0.045, 0.03, 0, 0.95, dd + 0.015, 1),
        box(W + 0.02, 0.06, 0.05, 0, top - 0.03, dd + 0.02, 1),
      ];
      // Raised fields, one above the rail and one below, in each bay.
      for (let b = 0; b < res.n; b++) {
        const x = (b - (res.n - 1) / 2) * HEX.bayW;
        for (const [y0, y1] of [
          [0.24, 0.86],
          [1.06, top - 0.14],
        ]) {
          const fw = HEX.bayW - 0.22;
          for (const [w, h, px, py] of [
            [fw, 0.025, x, y0],
            [fw, 0.025, x, y1],
            [0.025, y1 - y0, x - fw / 2, (y0 + y1) / 2],
            [0.025, y1 - y0, x + fw / 2, (y0 + y1) / 2],
          ])
            parts.push(box(w, h, 0.015, px, py, dd + 0.0075, 1));
        }
      }
      studioPanel.push(...parts.map((p) => grain(flat(p)).applyMatrix4(m)));
    } else {
      for (let b = 0; b < res.n; b++) {
        const x = (b - (res.n - 1) / 2) * HEX.bayW;
        const bm = m.clone().multiply(new THREE.Matrix4().makeTranslation(x, 0, 0));
        studioWood.push(flat(bayCase(5)).applyMatrix4(bm));
        studioBooks.push(bayBooks(700 + b, false, 5).geometry.applyMatrix4(bm));
      }
      const lowest = 0.12 + 5 * ((HEX.caseTop - 0.32) / 9);
      const parts = [
        // Its sides and back, in the shelves' wood, and a valance across the top.
        box(0.05, HEX.caseTop, HEX.depth, -W / 2 + 0.025, HEX.caseTop / 2, HEX.depth / 2, 0.8),
        box(W, 0.1, 0.03, 0, lowest - 0.03, HEX.depth - 0.005, 1),
      ];
      studioWood.push(...parts.map((p) => flat(p).applyMatrix4(m)));
      studioPanel.push(grain(flat(box(W, lowest, 0.02, 0, lowest / 2, 0.01, 0.35))).applyMatrix4(m));
    }
  }
  group.add(new THREE.Mesh(mergeGeometries(studioWood), woodMat));
  const panelTex = wood(57, '#3a2012', '#1c0d06');
  panelTex.wrapS = panelTex.wrapT = THREE.RepeatWrapping;
  const panelMat = lit(new THREE.MeshStandardMaterial({ map: panelTex, roughness: 0.45, envMapIntensity: 0.6 }), { bake: true, spec: 0.25, shine: 30 });
  const panels = new THREE.Mesh(mergeGeometries(studioPanel), panelMat);
  panels.receiveShadow = true;
  group.add(panels);
  const nearBooks = new THREE.Mesh(mergeGeometries(studioBooks), booksMat);
  nearBooks.receiveShadow = true;
  group.add(nearBooks);

  // --- the stair and the railing -------------------------------------------------------
  const treads: THREE.BufferGeometry[] = [];
  for (let i = 0; i < STEPS; i++) {
    const a = LANDING + i * STEP;
    const g = tread(a - STEP / 2 - 0.015, a + STEP / 2 + 0.015, 0.07);
    g.translate(0, (i + 1) * RISE - 0.07, 0);
    treads.push(g);
  }
  group.add(stamp(mergeGeometries(treads.map(flat)), treadMat, at, { cast: true, receive: true }));
  const bronze: THREE.BufferGeometry[] = [];
  // The stair's inner string and handrail, winding up the open middle of the well.
  bronze.push(new THREE.TubeGeometry(new Helix(TREAD.inner, RISE - 0.12), 96, 0.055, 8, false));
  bronze.push(new THREE.TubeGeometry(new Helix(TREAD.inner + 0.03, RISE + 0.9), 96, 0.022, 8, false));
  for (let i = 0; i < STEPS; i++) {
    const a = LANDING + (i + 0.5) * STEP;
    const post = new THREE.CylinderGeometry(0.009, 0.009, 0.9, 6);
    post.translate(Math.cos(a) * (TREAD.inner + 0.03), (i + 1) * RISE + 0.45 + RISE / 2, Math.sin(a) * (TREAD.inner + 0.03));
    bronze.push(post);
  }
  // The railing round the well, open where the stair lands.
  const ring = HEX.well + 0.11;
  const open = [LANDING - STEP * 1.9, LANDING + STEP * 0.9];
  const inOpen = (a: number) => {
    const d = THREE.MathUtils.euclideanModulo(a - open[0], Math.PI * 2);
    return d < open[1] - open[0];
  };
  const N = 84;
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2;
    if (inOpen(a)) continue;
    const b = new THREE.CylinderGeometry(0.012, 0.016, HEX.rail - 0.11, 6);
    b.translate(Math.cos(a) * ring, 0.11 + (HEX.rail - 0.11) / 2, Math.sin(a) * ring);
    bronze.push(b);
  }
  for (const [y, tube] of [
    [HEX.rail, 0.028],
    [0.2, 0.012],
  ]) {
    const t = new THREE.TorusGeometry(ring, tube, 8, 160, Math.PI * 2 - (open[1] - open[0]));
    t.rotateX(Math.PI / 2);
    t.rotateY(-open[1]);
    t.translate(0, y, 0);
    bronze.push(t);
  }
  for (const a of open) {
    const p = new THREE.CylinderGeometry(0.035, 0.04, HEX.rail + 0.06, 10);
    p.translate(Math.cos(a) * ring, (HEX.rail + 0.06) / 2, Math.sin(a) * ring);
    bronze.push(p);
    const knob = new THREE.SphereGeometry(0.05, 12, 8);
    knob.translate(Math.cos(a) * ring, HEX.rail + 0.1, Math.sin(a) * ring);
    bronze.push(knob);
  }
  // The lamps' fittings: a chain from the ceiling and a cap over each globe.
  for (const sx of [1, -1]) {
    const x = HEX.lamp.x * sx;
    const chain = new THREE.CylinderGeometry(0.008, 0.008, HEX.ceiling - HEX.lamp.y - 0.2, 4);
    chain.translate(x, (HEX.ceiling + HEX.lamp.y + 0.2) / 2, 0);
    bronze.push(chain);
    const cap = new THREE.CylinderGeometry(0.05, 0.09, 0.07, 16);
    cap.translate(x, HEX.lamp.y + 0.2, 0);
    bronze.push(cap);
    const rose = new THREE.CylinderGeometry(0.1, 0.1, 0.03, 16);
    rose.translate(x, HEX.ceiling - 0.015, 0);
    bronze.push(rose);
  }
  group.add(stamp(mergeGeometries(bronze.map(flat).map((g) => (g.deleteAttribute('uv'), g))), bronzeMat, at));

  // --- the lamps: the light they give is "insufficient, incessant" -------------------------
  const globeMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffa457').multiplyScalar(2.1) });
  const globeAt: THREE.Matrix4[] = [];
  for (const c of copies) for (const sx of [1, -1]) globeAt.push(new THREE.Matrix4().makeTranslation(center(c.k, c.j).add(new THREE.Vector3(HEX.lamp.x * sx, HEX.lamp.y, 0))));
  group.add(stamp(new THREE.SphereGeometry(0.2, 24, 16), globeMat, globeAt));
  const haloTex = glow('rgba(255,190,120,1)', 128);
  for (const c of copies) {
    if (c.j !== 0 && c.k !== 0) continue;
    for (const sx of [1, -1]) {
      const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex, color: '#ffb877', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.85 }));
      halo.scale.setScalar(2.3);
      halo.position.copy(center(c.k, c.j)).add(new THREE.Vector3(HEX.lamp.x * sx, HEX.lamp.y, 0));
      group.add(halo);
    }
  }

  // --- the passages between galleries ---------------------------------------------------
  // Each is centered between two galleries; at the ends of the line it leads to a dark doorway.
  const L = HEX.vestibule;
  const w = HEX.archW;
  const spring = HEX.archTop - w;
  const passage: THREE.BufferGeometry[] = [];
  const pFloor = meters(new THREE.PlaneGeometry(2 * w, L), 2 * w, L);
  pFloor.rotateX(-Math.PI / 2);
  const sills: THREE.BufferGeometry[] = [];
  for (const sz of [-1, 1]) {
    const sill = new THREE.BoxGeometry(2 * w + 0.1, 0.03, 0.34);
    sill.translate(0, 0.015, (sz * L) / 2);
    sills.push(sill);
    const wall = meters(new THREE.PlaneGeometry(L, spring), L, spring);
    wall.rotateY((-sz * Math.PI) / 2);
    wall.translate(sz * w, spring / 2, 0);
    passage.push(wall);
  }
  // The vault, as a half-round of quads facing in.
  const vault = meters(new THREE.CylinderGeometry(w, w, L, 32, 1, true, -Math.PI / 2, Math.PI), Math.PI * w, L);
  vault.rotateX(-Math.PI / 2);
  vault.translate(0, spring, 0);
  passage.push(vault);
  const passMat = stoneMat;
  const pAt: THREE.Matrix4[] = [];
  const endAt: THREE.Matrix4[] = [];
  for (const c of copies) {
    const mid = center(c.k, c.j).add(new THREE.Vector3(0, 0, D / 2));
    pAt.push(new THREE.Matrix4().makeTranslation(mid));
    if (!has(c.k + 1, c.j)) endAt.push(new THREE.Matrix4().makeTranslation(mid.clone().add(new THREE.Vector3(0, 0, L / 2 - 0.02))));
    if (!has(c.k - 1, c.j)) {
      const back = center(c.k, c.j).add(new THREE.Vector3(0, 0, -D / 2));
      pAt.push(new THREE.Matrix4().makeTranslation(back));
      endAt.push(new THREE.Matrix4().makeTranslation(back.clone().add(new THREE.Vector3(0, 0, -L / 2 + 0.02))).multiply(new THREE.Matrix4().makeRotationY(Math.PI)));
    }
  }
  group.add(stamp(mergeGeometries(passage.map(flat)), passMat, pAt));
  group.add(stamp(pFloor, floorMat, pAt, { receive: true }));
  group.add(stamp(mergeGeometries(sills.map(flat)), trimMat, pAt));
  // A small door in each passage: one of the two closets.
  const door = mergeGeometries([box(0.05, 1.95, 0.9, -w + 0.03, 0.975, 0, 0.8), box(0.07, 0.08, 1.06, -w + 0.035, 1.99, 0, 0.9), box(0.07, 1.95, 0.08, -w + 0.035, 0.975, 0.49, 0.9), box(0.07, 1.95, 0.08, -w + 0.035, 0.975, -0.49, 0.9)].map(flat));
  group.add(stamp(door, woodMat, pAt));
  // Where the line runs out: a doorway into the dark (the haze does the rest).
  const [dc, dg] = canvas(64, 256);
  const dark = dg.createLinearGradient(0, 0, 0, 256);
  dark.addColorStop(0, '#0a0604');
  dark.addColorStop(1, '#1c120a');
  dg.fillStyle = dark;
  dg.fillRect(0, 0, 64, 256);
  const endGeo = new THREE.PlaneGeometry(2 * w, HEX.archTop);
  endGeo.rotateY(Math.PI);
  endGeo.translate(0, HEX.archTop / 2, 0);
  group.add(stamp(endGeo, new THREE.MeshBasicMaterial({ map: texture(dc) }), endAt));

  // --- the skylight far above each well, and the light falling from it ----------------------
  const [sc, sg] = canvas(512, 512);
  const sky = sg.createRadialGradient(256, 256, 20, 256, 256, 256);
  sky.addColorStop(0, '#f4f8ff');
  sky.addColorStop(0.7, '#c9d8ea');
  sky.addColorStop(1, '#8aa0bb');
  sg.fillStyle = sky;
  sg.fillRect(0, 0, 512, 512);
  sg.strokeStyle = 'rgba(40,50,64,0.55)';
  sg.lineWidth = 6;
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * Math.PI * 2;
    sg.beginPath();
    sg.moveTo(256 + Math.cos(a) * 40, 256 + Math.sin(a) * 40);
    sg.lineTo(256 + Math.cos(a) * 256, 256 + Math.sin(a) * 256);
    sg.stroke();
  }
  for (const rr of [40, 130, 210]) {
    sg.beginPath();
    sg.arc(256, 256, rr, 0, Math.PI * 2);
    sg.stroke();
  }
  const skyMat = new THREE.MeshBasicMaterial({ map: texture(sc), color: new THREE.Color(1.6, 1.65, 1.75), fog: false });
  const tops = new Map<number, number>();
  for (const c of copies) tops.set(c.k, Math.max(tops.get(c.k) ?? -99, c.j));
  for (const [k, j] of tops) {
    const disc = new THREE.Mesh(new THREE.CircleGeometry(HEX.well + 1.2, 48), skyMat);
    disc.rotation.x = Math.PI / 2;
    disc.position.copy(center(k, j)).add(new THREE.Vector3(0, HEX.F + 0.6, 0));
    group.add(disc);
  }
  const top = (tops.get(0) ?? 0) * HEX.F + HEX.F + 0.6;
  const shaftLen = top + 30;
  const shaftMat = new THREE.ShaderMaterial({
    vertexShader: SKY_VERT,
    fragmentShader: SHAFT_FRAG,
    uniforms: { uTime: { value: 0 }, uTop: { value: top }, uLen: { value: shaftLen } },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
  const shaftGeo = new THREE.CylinderGeometry(0.8, 0.85, shaftLen, 32, 1, true);
  shaftGeo.translate(0, top - shaftLen / 2, 0);
  const shaft = new THREE.Mesh(shaftGeo, shaftMat);
  shaft.frustumCulled = false;
  group.add(shaft);

  const lanternAt = (u: number) => {
    // Down the reading room's stair, from four floors up to four floors down.
    const turns = (1 - u) * 8 - 4;
    const a = LANDING + turns * Math.PI * 2;
    return new THREE.Vector3(Math.cos(a) * 1.42, stairY(turns) + 0.95, Math.sin(a) * 1.42);
  };

  return {
    group,
    copies,
    slots,
    lanternAt,
    materials: { wood: woodMat, books: booksMat, stone: stoneMat, bronze: bronzeMat },
    atlas,
    tick(t) {
      shaftMat.uniforms.uTime.value = t;
    },
  };
}
