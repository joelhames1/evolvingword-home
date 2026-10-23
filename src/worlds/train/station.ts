// The stations: a platform along the window side, a canopy over it, its
// lamps, the sign by our window with its flaps and clock, benches, a trolley,
// posters and the departures, and the station house behind with its rooms
// lit. Three kinds: the city's, grand, in rusticated stone and brick under
// cast iron and glass; the lake's, a wooden halt with a veranda, open to the
// water; the pass's, rubble stone, snow on everything, icicles along the eaves.
//
// Most of it goes into the station material (night.ts), which draws what each
// surface is made of (brick, stone, boards, flags, slates...) and lights it by
// the platform's lamps: each vertex says what it is in its glow channel. What
// glows (lit glass, the lanterns) goes into the land's own decor, as before.
import * as THREE from 'three';
import { atlasRect, POSTERS } from './atlas';
import { BALLAST, CANOPY, PLATFORM, STATION_LAMPS, SURF } from './ground';
import { LAYOUT, type Leg } from './journey';
import { hash, type Mesher, place, SHAPES } from './mesher';
import { C, DARK, LIT, x, type Build } from './parts';
import { WINDOW_X } from './plan';

export type StationKind = 'city' | 'lake' | 'pass';
type Role = 'win' | 'door' | 'main' | 'ticket' | 'poster' | 'timetable' | 'advert';

interface Look {
  /** The house: how long, deep and tall, where its middle stands from our window, the floors (window middles above the platform), the bays. */
  len: number;
  depth: number;
  height: number;
  at: number;
  floors: number[];
  bay: number;
  win: [number, number];
  upper: [number, number];
  /** How deep the windows are set in the wall. */
  reveal: number;
  /** What's in each bay on the ground floor (above, windows), and the plates over the doors and hatch. */
  roles: Role[];
  plates: Record<number, string>;
  wall: THREE.Color;
  wallSurf: number;
  /** The ground floor's own facing, up to this height over the platform (the city's rusticated stone). */
  base?: { color: THREE.Color; surf: number; to: number };
  quoin: THREE.Color | null;
  trim: THREE.Color;
  frame: THREE.Color;
  door: THREE.Color;
  shutters: THREE.Color | null;
  /** Glazing bars across and up each window. */
  panes: [number, number];
  roof: THREE.Color;
  roofSurf: number;
  pitch: number;
  hip: boolean;
  chimney: THREE.Color;
  chimneySurf: number;
  paving: THREE.Color;
  deck: boolean;
  /** The platform's painted line and its snow (the paving surface's shade): 0 yellow, 0.5 white under snow, 1 white. */
  line: number;
  face: THREE.Color;
  faceSurf: number;
  /** The canopy from and to, along from our window. */
  canopy: [number, number];
  soffit: THREE.Color;
  soffitSurf: number;
  roofTop: THREE.Color;
  fascia: THREE.Color;
  iron: THREE.Color;
  posts: 'iron' | 'timber';
  lamp: THREE.Color;
  benches: number[];
}

const LOOKS: Record<StationKind, Look> = {
  city: {
    len: 44,
    depth: 12,
    height: 10.6,
    at: -6,
    floors: [1.6, 5.35, 8.35],
    bay: 3.4,
    win: [1.3, 2.2],
    upper: [1.15, 1.8],
    reveal: 0.18,
    roles: ['win', 'win', 'poster', 'door', 'win', 'ticket', 'main', 'win', 'timetable', 'advert', 'door', 'win'],
    plates: { 3: 'WAITING ROOM', 5: 'TICKETS', 10: 'WAY OUT' },
    wall: C('#7e4a38'),
    wallSurf: SURF.brick,
    base: { color: C('#8c826f'), surf: SURF.ashlar, to: 3.85 },
    quoin: C('#bdb29d'),
    trim: C('#c9bea7'),
    frame: C('#e2dbcb'),
    door: C('#1f3328'),
    shutters: null,
    panes: [2, 3],
    roof: C('#3a3d45'),
    roofSurf: SURF.slate,
    pitch: 0.55,
    hip: true,
    chimney: C('#74432f'),
    chimneySurf: SURF.brick,
    paving: C('#7e786f'),
    deck: false,
    line: 0,
    face: C('#6a3f31'),
    faceSurf: SURF.brick,
    canopy: [-45, 33],
    soffit: C('#3a4248'),
    soffitSurf: SURF.glazing,
    roofTop: C('#2a2d31'),
    fascia: C('#2c3a34'),
    iron: C('#2c3a34'),
    posts: 'iron',
    lamp: LIT.white,
    benches: [4.6, -7.4, -19.4, 16.6],
  },
  lake: {
    len: 12,
    depth: 6,
    height: 3.95,
    at: -10.5,
    floors: [1.55],
    bay: 2.4,
    win: [1.0, 1.45],
    upper: [1, 1],
    reveal: 0.09,
    roles: ['win', 'main', 'ticket', 'win'],
    plates: { 2: 'TICKETS' },
    wall: C('#d1c5a6'),
    wallSurf: SURF.boards,
    quoin: null,
    trim: C('#2f5443'),
    frame: C('#efe9da'),
    door: C('#2f5443'),
    shutters: C('#2e5468'),
    panes: [2, 2],
    roof: C('#7a3a2b'),
    roofSurf: SURF.tiles,
    pitch: 0.72,
    hip: false,
    chimney: C('#84503e'),
    chimneySurf: SURF.brick,
    paving: C('#6c5844'),
    deck: true,
    line: 1,
    face: C('#4a3a2c'),
    faceSurf: SURF.boards,
    canopy: [-17.2, -3.8],
    soffit: C('#ddd3ba'),
    soffitSurf: SURF.soffit,
    roofTop: C('#5a2c22'),
    fascia: C('#2f5443'),
    iron: C('#24323c'),
    posts: 'timber',
    lamp: LIT.warm.clone().multiplyScalar(0.55),
    benches: [4.6, -7.4],
  },
  pass: {
    len: 16,
    depth: 8,
    height: 6.4,
    at: -2,
    floors: [1.5, 4.6],
    bay: 2.6,
    win: [1.0, 1.35],
    upper: [0.9, 1.1],
    reveal: 0.22,
    roles: ['win', 'ticket', 'main', 'win', 'poster'],
    plates: { 1: 'TICKETS' },
    wall: C('#7c756a'),
    wallSurf: SURF.rubble,
    quoin: C('#aea696'),
    trim: C('#d6cfbf'),
    frame: C('#ece3cf'),
    door: C('#5a2e22'),
    shutters: C('#2f5a3a'),
    panes: [2, 3],
    roof: C('#e6edf6'),
    roofSurf: SURF.snow,
    pitch: 0.95,
    hip: false,
    chimney: C('#7c756a'),
    chimneySurf: SURF.rubble,
    paving: C('#878e96'),
    deck: false,
    line: 0.5,
    face: C('#6f6a62'),
    faceSurf: SURF.rubble,
    canopy: [-21, 15],
    soffit: C('#5a4030'),
    soffitSurf: SURF.soffit,
    roofTop: C('#e6edf6'),
    fascia: C('#4a3426'),
    iron: C('#3a2a20'),
    posts: 'iron',
    lamp: LIT.warm.clone().multiplyScalar(0.55),
    benches: [4.6, -7.4],
  },
};

/** A lit room through a window: warm, brighter toward the top where its lamp is; a curtain in the light; the hatch, brighter. */
const ROOM_GLOW = C('#ffb066').multiplyScalar(0.7);
const CURTAIN_GLOW = C('#ff9050').multiplyScalar(0.22);
const CURTAIN = C('#6a2a1e');
const HATCH_GLOW = C('#ffc890').multiplyScalar(0.95);
const BRASS = C('#b48a46');
/** Geraniums, white daisies, marigolds and something purple, in the lake's tubs. */
const FLOWERS = [C('#b8384c'), C('#ddd2b8'), C('#d0a040'), C('#8a4a88')];
/** The sides of a lit window's opening, in the room's light. */
const REVEAL = C('#7a6a58');
const NONE = new THREE.Color(0, 0, 0);
/** What a surface is made of, its shade, and how much it's in shadow (for the station material, in the glow channel). */
const S = (k: number, vary = 0, ao = 0) => new THREE.Color(k, vary, ao);

// --- what a station is -------------------------------------------------------------------

/** Where everything at a station is: worked out the same way for the land (to build it) and for the light (to light it). */
export interface StationPlan {
  kind: StationKind;
  stop: number;
  /** Where our window is when the train stands here, the platform's ends, the canopy's. */
  w: number;
  p0: number;
  p1: number;
  c0: number;
  c1: number;
  /** The platform lamps along it. */
  lamps: number[];
  /** The house: its middle and ends along the line. */
  hu: number;
  h0: number;
  h1: number;
  bays: { u: number; role: Role; lit: boolean[] }[];
  /** Lamps of their own: over the sign by our window, over the doors. */
  lights: { u: number; y: number; z: number; power: number }[];
  /** Where light comes out through the front of the house at platform level: lit windows, the hatch, fanlights. */
  glows: { u0: number; u1: number; k: number }[];
}

/** How wide a doorway is; and where the lamp by it hangs, on a bracket beside it. */
const doorWidth = (kind: StationKind, role: Role) => (role === 'main' && kind === 'city' ? 1.75 : 1.2);
const doorLamp = (kind: StationKind, role: Role, u: number) => ({ u: u + doorWidth(kind, role) / 2 + 0.34, y: PLATFORM.y + 2.5, z: PLATFORM.back + 0.36 });

const plans = new Map<string, StationPlan>();
export function stationPlan(kind: StationKind, stop: number, seed: number): StationPlan {
  const key = `${kind}:${stop}:${seed}`;
  const hit = plans.get(key);
  if (hit) return hit;
  const L = LOOKS[kind];
  const w = stop + WINDOW_X;
  const p0 = stop - 104;
  const p1 = stop + 54;
  const SL = STATION_LAMPS;
  const lamps: number[] = [];
  for (let u = Math.ceil((p0 + 6 - w - SL.offset) / SL.step) * SL.step + w + SL.offset; u < p1 - 4; u += SL.step) lamps.push(u);
  const hu = w + L.at;
  const n = L.roles.length;
  const first = hu - ((n - 1) * L.bay) / 2;
  // The bay behind the sign by our window always has its lamp on.
  let behind = 0;
  for (let i = 0; i < n; i++) if (Math.abs(first + i * L.bay - w) < Math.abs(first + behind * L.bay - w)) behind = i;
  const bays = L.roles.map((role, i) => ({
    u: first + i * L.bay,
    role,
    lit: L.floors.map((_, f) => role === 'ticket' || (f === 0 && i === behind && role === 'win') || hash(i, f, seed + 7) < (f === 0 ? 0.8 : 0.45)),
  }));
  const lights: StationPlan['lights'] = [{ u: w, y: PLATFORM.y + 2.8, z: -2.62, power: 0.3 }];
  const glows: StationPlan['glows'] = [];
  for (const bay of bays) {
    if (bay.role === 'win' && bay.lit[0]) glows.push({ u0: bay.u - L.win[0] / 2, u1: bay.u + L.win[0] / 2, k: 1 });
    if (bay.role === 'ticket') glows.push({ u0: bay.u - 0.6, u1: bay.u + 0.6, k: 1.25 });
    if (bay.role === 'main' || bay.role === 'door') {
      glows.push({ u0: bay.u - 0.5, u1: bay.u + 0.5, k: 0.3 });
      if (lights.length < 4) lights.push({ ...doorLamp(kind, bay.role, bay.u), power: bay.role === 'main' ? 0.6 : 0.45 });
    }
  }
  // (The lake's halt has a lamp on its end toward our window, by the departures.)
  if (kind === 'lake') lights.push({ u: hu + L.len / 2 + 0.38, y: PLATFORM.y + 2.62, z: PLATFORM.back - 2.4, power: 0.5 });
  const plan: StationPlan = { kind, stop, w, p0, p1, c0: w + L.canopy[0], c1: w + L.canopy[1], lamps, hu, h0: hu - L.len / 2, h1: hu + L.len / 2, bays, lights, glows };
  if (plans.size > 24) plans.clear();
  plans.set(key, plan);
  return plan;
}

/** The station on a stretch, if it has one. */
export function planFor(leg: Leg): StationPlan | null {
  const st = LAYOUT[leg.land].station;
  if (!st || (leg.land !== 'city' && leg.land !== 'lake' && leg.land !== 'pass')) return null;
  return stationPlan(leg.land, leg.start + st.at, leg.seed);
}

/** Is (u, z) inside the station house's footprint, on a stretch with a station (the city's goes down to the street)? */
export function underStation(leg: Leg, u: number, z: number) {
  const st = LAYOUT[leg.land].station;
  if (!st || leg.land !== 'city') return false;
  const H = LOOKS.city;
  const hu = leg.start + st.at + WINDOW_X + H.at;
  return Math.abs(u - hu) < H.len / 2 + 2 && z < PLATFORM.back + 1 && z > PLATFORM.back - H.depth - 2;
}

// --- shapes, with what they're made of ----------------------------------------------------

const V = (a: number, b: number, c: number) => new THREE.Vector3(a, b, c);
const tmpE = new THREE.Vector3();
const tmpF = new THREE.Vector3();

/**
 * A rectangle from corner p along edges e and f (its front is the side e × f
 * points to), uvs in meters from (u0, v0); glows per corner if given four.
 */
function rect(m: Mesher, p: THREE.Vector3, e: THREE.Vector3, f: THREE.Vector3, color: THREE.Color, s: THREE.Color | THREE.Color[], u0 = 0, v0 = 0) {
  const n = tmpE.copy(e).cross(f);
  if (n.lengthSq() < 1e-12) return;
  n.normalize();
  const eu = e.length();
  const fv = f.length();
  for (let k = 0; k < 6; k++) {
    const a = CORNERS[k * 3];
    const b = CORNERS[k * 3 + 1];
    const g = Array.isArray(s) ? s[CORNERS[k * 3 + 2]] : s;
    tmpF.copy(p).addScaledVector(e, a).addScaledVector(f, b);
    m.pos.push(tmpF.x, tmpF.y, tmpF.z);
    m.nrm.push(n.x, n.y, n.z);
    m.col.push(color.r, color.g, color.b);
    m.glow.push(g.r, g.g, g.b);
    m.uv.push(u0 + a * eu, v0 + b * fv);
  }
}
/** A rectangle's two triangles: each corner's place along its two edges, and which corner it is. */
const CORNERS = [0, 0, 0, 1, 0, 1, 1, 1, 2, 0, 0, 0, 1, 1, 2, 0, 1, 3];
const bp = new THREE.Vector3();
const be = new THREE.Vector3();
const bf = new THREE.Vector3();

/** A box from (x0, y0, z0) to (x1, y1, z1), the faces named (s +z, n −z, e +x, w −x, t up, b down), uvs in meters. */
function box(m: Mesher, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, color: THREE.Color, s: THREE.Color, faces = 'snewtb') {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const dz = z1 - z0;
  // (Into vectors kept for the purpose: a station is a lot of boxes.)
  if (faces.includes('s')) rect(m, bp.set(x0, y0, z1), be.set(dx, 0, 0), bf.set(0, dy, 0), color, s, x0, y0);
  if (faces.includes('n')) rect(m, bp.set(x1, y0, z0), be.set(-dx, 0, 0), bf.set(0, dy, 0), color, s, -x1, y0);
  if (faces.includes('e')) rect(m, bp.set(x1, y0, z1), be.set(0, 0, -dz), bf.set(0, dy, 0), color, s, -z1, y0);
  if (faces.includes('w')) rect(m, bp.set(x0, y0, z0), be.set(0, 0, dz), bf.set(0, dy, 0), color, s, z0, y0);
  if (faces.includes('t')) rect(m, bp.set(x0, y1, z1), be.set(dx, 0, 0), bf.set(0, 0, -dz), color, s, x0, -z1);
  if (faces.includes('b')) rect(m, bp.set(x0, y0, z0), be.set(dx, 0, 0), bf.set(0, 0, dz), color, s, x0, z0);
}

/** A convex polygon facing out of the page from its winding, with its own uvs and glows (for gradients across lit glass, sloping roofs). */
function poly(m: Mesher, pts: THREE.Vector3[], color: THREE.Color, glows: THREE.Color[], uvs?: [number, number][]) {
  const n = tmpE.subVectors(pts[1], pts[0]).cross(tmpF.subVectors(pts[2], pts[0]));
  if (n.lengthSq() < 1e-12) return;
  n.normalize();
  for (let i = 1; i < pts.length - 1; i++)
    for (const k of [0, i, i + 1]) {
      const p = pts[k];
      m.pos.push(p.x, p.y, p.z);
      m.nrm.push(n.x, n.y, n.z);
      m.col.push(color.r, color.g, color.b);
      const g = glows[Math.min(k, glows.length - 1)];
      m.glow.push(g.r, g.g, g.b);
      const uv = uvs?.[k] ?? [0, 0];
      m.uv.push(uv[0], uv[1]);
    }
}

const rodQ = new THREE.Quaternion();
const rodM = new THREE.Matrix4();
const Z = new THREE.Vector3(0, 0, 1);
/** A bar of square section t from a to b. */
function rod(m: Mesher, a: THREE.Vector3, b: THREE.Vector3, t: number, color: THREE.Color, s: THREE.Color) {
  const dir = tmpE.subVectors(b, a);
  const len = dir.length();
  if (len < 1e-6) return;
  rodQ.setFromUnitVectors(Z, dir.divideScalar(len));
  rodM.compose(tmpF.addVectors(a, b).multiplyScalar(0.5), rodQ, new THREE.Vector3(t, t, len));
  m.add(SHAPES.box, rodM, color, s);
}

/**
 * A wall's own frame: its origin, the way along it (ex) and the way out of it
 * (ez), level both. Things on a wall are placed by how far along it they are,
 * how high, and how far out (d: in front of it, or set back into it below zero).
 */
interface Frame {
  o: THREE.Vector3;
  ex: THREE.Vector3;
  ez: THREE.Vector3;
}
const at3 = (F: Frame, a: number, y: number, d: number) => V(F.o.x + F.ex.x * a + F.ez.x * d, y, F.o.z + F.ex.z * a + F.ez.z * d);
/** The frame of anything facing the line: along is x, out is z. */
const FACING: Frame = { o: V(0, 0, 0), ex: V(1, 0, 0), ez: V(0, 0, 1) };
const face = (v: THREE.Vector3) => (v.z > 0.5 ? 's' : v.z < -0.5 ? 'n' : v.x > 0.5 ? 'e' : 'w');
const OPPOSITE: Record<string, string> = { s: 'n', n: 's', e: 'w', w: 'e' };

/** A box on a wall: along it a0..a1, up y0..y1, out d0..d1; its faces o(ut), i(n), r (on along), l (back along), t, b. */
function fbox(m: Mesher, F: Frame, a0: number, y0: number, d0: number, a1: number, y1: number, d1: number, color: THREE.Color, s: THREE.Color, faces = 'oirltb') {
  const p = at3(F, a0, y0, d0);
  const q = at3(F, a1, y1, d1);
  const map: Record<string, string> = { o: face(F.ez), i: OPPOSITE[face(F.ez)], r: face(F.ex), l: OPPOSITE[face(F.ex)], t: 't', b: 'b' };
  box(m, Math.min(p.x, q.x), y0, Math.min(p.z, q.z), Math.max(p.x, q.x), y1, Math.max(p.z, q.z), color, s, [...faces].map((c) => map[c]).join(''));
}

/** A rectangle flat on a wall, d out from it. */
function frect(m: Mesher, F: Frame, a0: number, y0: number, a1: number, y1: number, d: number, color: THREE.Color, s: THREE.Color | THREE.Color[]) {
  rect(m, at3(F, a0, y0, d), F.ex.clone().multiplyScalar(a1 - a0), V(0, y1 - y0, 0), color, s, a0, y0);
}

/** A thing from the atlas (a poster, a plate, a name board) on a wall, its middle at (a, cy), d out from it. */
function sheet(m: Mesher, F: Frame, key: string, a: number, cy: number, d: number, w: number, h: number) {
  const [u0, v0, u1, v1] = atlasRect(key);
  const p = [at3(F, a - w / 2, cy - h / 2, d), at3(F, a + w / 2, cy - h / 2, d), at3(F, a + w / 2, cy + h / 2, d), at3(F, a - w / 2, cy + h / 2, d)];
  poly(m, p, new THREE.Color(1, 1, 1), [S(SURF.atlas)], [
    [u0, v0],
    [u1, v0],
    [u1, v1],
    [u0, v1],
  ]);
}

type Hole = { x0: number; x1: number; y0: number; y1: number };

/** A wall from a0 to a1 along its frame and y0 to y1, with holes in it; uvs in meters. Its facing can change with height; darker low down. */
function holed(m: Mesher, F: Frame, a0: number, a1: number, y0: number, y1: number, holes: Hole[], at: (y: number) => [THREE.Color, number], splits: number[] = [], grimeFrom = y0) {
  const xs = [...new Set([a0, a1, ...holes.flatMap((h) => [h.x0, h.x1])].filter((v) => v >= a0 && v <= a1))].sort((p, q) => p - q);
  const ys = [...new Set([y0, y1, grimeFrom + 0.6, ...splits, ...holes.flatMap((h) => [h.y0, h.y1])].filter((v) => v >= y0 && v <= y1))].sort((p, q) => p - q);
  const grime = grimeFrom + 0.6;
  for (let j = 0; j < ys.length - 1; j++) {
    const ya = ys[j];
    const yb = ys[j + 1];
    const cy = (ya + yb) / 2;
    const [color, surf] = at(cy);
    // Darker low down, where the dirt and the shadow gather.
    const ao = (y: number) => S(surf, 0, y < grime ? 0.4 * Math.min(1, 1 - (y - grimeFrom) / 0.6) : 0);
    let run = -1;
    for (let i = 0; i <= xs.length - 1; i++) {
      const mid = i < xs.length - 1 ? (xs[i] + xs[i + 1]) / 2 : 0;
      const solid = i < xs.length - 1 && !holes.some((h) => mid > h.x0 && mid < h.x1 && cy > h.y0 && cy < h.y1);
      if (solid && run < 0) run = i;
      if (!solid && run >= 0) {
        frect(m, F, xs[run], ya, xs[i], yb, 0, color, [ao(ya), ao(ya), ao(yb), ao(yb)]);
        run = -1;
      }
    }
  }
}

/** Lit glass set into a wall at d: warm, brighter up where the room's lamp is; curtains drawn back either side (in the same plane, so nothing flickers). */
function litGlass(dm: Mesher, F: Frame, h: Hole, d: number, glow: THREE.Color, curtains: boolean) {
  const low = glow.clone().multiplyScalar(0.45);
  const g8 = glow.clone().multiplyScalar(0.8);
  const { x0, x1, y0, y1 } = h;
  const cw = curtains ? (x1 - x0) * 0.24 : 0;
  const P = (a: number, y: number) => at3(F, a, y, d);
  if (curtains) {
    const c6 = CURTAIN_GLOW.clone().multiplyScalar(0.6);
    poly(dm, [P(x0, y0), P(x0 + cw, y0), P(x0 + cw * 0.7, y1), P(x0, y1)], CURTAIN, [c6, CURTAIN_GLOW, CURTAIN_GLOW, CURTAIN_GLOW]);
    poly(dm, [P(x1 - cw, y0), P(x1, y0), P(x1, y1), P(x1 - cw * 0.7, y1)], CURTAIN, [CURTAIN_GLOW, c6, CURTAIN_GLOW, CURTAIN_GLOW]);
  }
  const mid = y0 + (y1 - y0) * 0.42;
  const k = (y: number) => cw * (1 - 0.3 * ((y - y0) / (y1 - y0)));
  poly(dm, [P(x0 + k(y0), y0), P(x1 - k(y0), y0), P(x1 - k(mid), mid), P(x0 + k(mid), mid)], DARK.glass, [low, low, g8, g8]);
  poly(dm, [P(x0 + k(mid), mid), P(x1 - k(mid), mid), P(x1 - k(y1), y1), P(x0 + k(y1), y1)], DARK.glass, [g8, g8, glow, glow]);
}

/** A frame round a pane at d, with glazing bars across it. */
function sash(m: Mesher, F: Frame, h: Hole, d: number, color: THREE.Color, panes: [number, number]) {
  const { x0, x1, y0, y1 } = h;
  const t = 0.055;
  const trim = S(SURF.trim, 0.3);
  fbox(m, F, x0, y0, d, x1, y0 + t, d + 0.05, color, trim, 'otb');
  fbox(m, F, x0, y1 - t, d, x1, y1, d + 0.05, color, trim, 'otb');
  fbox(m, F, x0, y0, d, x0 + t, y1, d + 0.05, color, trim, 'or');
  fbox(m, F, x1 - t, y0, d, x1, y1, d + 0.05, color, trim, 'ol');
  const b = 0.028;
  for (let i = 1; i < panes[0]; i++) {
    const bx = x0 + ((x1 - x0) * i) / panes[0];
    fbox(m, F, bx - b / 2, y0 + t, d, bx + b / 2, y1 - t, d + 0.03, color, trim, 'orl');
  }
  for (let j = 1; j < panes[1]; j++) {
    const by = y0 + ((y1 - y0) * j) / panes[1];
    fbox(m, F, x0 + t, by - b / 2, d, x1 - t, by + b / 2, d + 0.03, color, trim, 'otb');
  }
}

/** The sides of an opening in a wall, `depth` deep. */
function reveals(m: Mesher, F: Frame, h: Hole, depth: number, color: THREE.Color, s: THREE.Color, sill = true) {
  const w = h.x1 - h.x0;
  const hh = h.y1 - h.y0;
  const back = F.ez.clone().multiplyScalar(-depth);
  const out = F.ez.clone().multiplyScalar(depth);
  const along = F.ex.clone().multiplyScalar(w);
  rect(m, at3(F, h.x0, h.y0, 0), back, V(0, hh, 0), color, s);
  rect(m, at3(F, h.x1, h.y0, -depth), out, V(0, hh, 0), color, s);
  rect(m, at3(F, h.x0, h.y1, -depth), along, out, color, s);
  if (sill) rect(m, at3(F, h.x0, h.y0, 0), along, back, color, s);
}

/** A hung lantern or a lamp-post's: a glass box lit from inside, a base, a hood over it, a vent on top. */
function lantern(b: Build, lx: number, ly: number, lz: number, iron: THREE.Color, color: THREE.Color, scale = 1) {
  const m = b.station;
  const s = S(SURF.iron);
  const k = scale;
  b.decor.add(SHAPES.box, place(lx, ly, lz, 0.24 * k, 0.32 * k, 0.24 * k), DARK.iron, color.clone().multiplyScalar(1.7));
  box(m, lx - 0.15 * k, ly - 0.2 * k, lz - 0.15 * k, lx + 0.15 * k, ly - 0.16 * k, lz + 0.15 * k, iron, s);
  m.add(SHAPES.cone, place(lx, ly + 0.16 * k, lz, 0.44 * k, 0.2 * k, 0.44 * k, Math.PI / 6), iron, s);
  box(m, lx - 0.03 * k, ly + 0.34 * k, lz - 0.03 * k, lx + 0.03 * k, ly + 0.42 * k, lz + 0.03 * k, iron, s);
  // The four corner bars of the glass.
  for (const [dx, dz] of [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ])
    box(m, lx + dx * 0.125 * k - 0.012, ly - 0.16 * k, lz + dz * 0.125 * k - 0.012, lx + dx * 0.125 * k + 0.012, ly + 0.16 * k, lz + dz * 0.125 * k + 0.012, iron, s, 'snewt');
}

// --- the station ------------------------------------------------------------------------------

export function station(b: Build, leg: Leg, stop: number, name: string, kind: StationKind) {
  const P = stationPlan(kind, stop, leg.seed);
  if (P.p1 + 60 < b.u0 || P.p0 - 60 > b.u1) return;
  const L = LOOKS[kind];
  platform(b, P, L);
  canopy(b, P, L);
  lamps(b, P, L);
  sign(b, P, L, name);
  furniture(b, P, L, leg.seed);
  house(b, P, L, name, leg.seed);
  fence(b, P, L);
}

const own = (b: Build, u: number) => u >= b.u0 && u < b.u1;

/** The platform: flags (or boards, by the lake) with a coping and the painted line along the edge, a lip over the face down to the ballast, ramps at the ends. */
function platform(b: Build, P: StationPlan, L: Look) {
  const m = b.station;
  const PL = PLATFORM;
  const from = Math.max(P.p0, b.u0);
  const to = Math.min(P.p1, b.u1);
  const top = S(L.deck ? SURF.decking : SURF.paving, L.line);
  const shade = (ao: number) => S(L.deck ? SURF.decking : SURF.paving, L.line, ao);
  if (to > from) {
    const X0 = x(b, from);
    const X1 = x(b, to);
    const U = from - P.stop;
    const lip = PL.edge + 0.05;
    // The top (its uvs: along from the stop, and out from the line), shadowed a little along the back, where it meets the house or the fence.
    const strip = (za: number, zb: number, ga: THREE.Color, gb: THREE.Color) =>
      poly(m, [V(X0, PL.y, za), V(X1, PL.y, za), V(X1, PL.y, zb), V(X0, PL.y, zb)], L.paving, [ga, ga, gb, gb], [
        [U, za],
        [U + X1 - X0, za],
        [U + X1 - X0, zb],
        [U, zb],
      ]);
    strip(lip, PL.back + 0.7, top, top);
    strip(PL.back + 0.7, PL.back, shade(0), shade(0.35));
    // The coping's lip, painted white along its face, a shadow under it, and the face down to the ballast.
    const face = S(SURF.edge, L.faceSurf === SURF.brick ? 0 : L.faceSurf === SURF.rubble ? 0.5 : 1);
    rect(m, V(X0, PL.y - 0.12, lip), V(X1 - X0, 0, 0), V(0, 0.12, 0), L.face, face, U, PL.y - 0.12);
    rect(m, V(X0, PL.y - 0.12, PL.edge), V(X1 - X0, 0, 0), V(0, 0, 0.05), L.face, S(SURF.plain, 0, 0.6), U, 0);
    rect(m, V(X0, BALLAST - 0.1, PL.edge), V(X1 - X0, 0, 0), V(0, PL.y - 0.12 - (BALLAST - 0.1), 0), L.face, [S(SURF.edge, face.g, 0.2), S(SURF.edge, face.g, 0.2), S(SURF.edge, face.g, 0.55), S(SURF.edge, face.g, 0.55)], U, BALLAST - 0.1);
    // The back, down to the ground (or the street, in the city).
    // (Not where the house stands on it: that's inside the house.)
    for (let u = from; u < to; u += 8) {
      const u1 = Math.min(to, u + 8);
      for (const [a, e] of [
        [u, Math.min(u1, P.h0)],
        [Math.max(u, P.h1), u1],
      ]) {
        if (e <= a) continue;
        const g = Math.min(b.ground(a, PL.back - 0.5), b.ground(e, PL.back - 0.5), PL.y - 1) - 0.6;
        rect(m, V(x(b, e), g, PL.back), V(x(b, a) - x(b, e), 0, 0), V(0, PL.y - g, 0), L.face, S(L.faceSurf, 0.3, 0.15), a - P.stop, g);
      }
    }
  }
  // Ramps down at either end.
  for (const [end, dir] of [
    [P.p0, -1],
    [P.p1, 1],
  ] as const) {
    if (!own(b, end)) continue;
    const ex = x(b, end);
    const fx = ex + dir * 5;
    const foot = BALLAST + 0.05;
    const g = Math.min(b.ground(end, PL.back), b.ground(end + dir * 5, PL.back), BALLAST) - 0.6;
    const s = S(L.deck ? SURF.decking : SURF.paving, L.line);
    // The slope (wound to face up whichever way it runs).
    const a = V(ex, PL.y, PL.edge + 0.05);
    const c = V(fx, foot, PL.back);
    poly(m, dir > 0 ? [a, V(fx, foot, PL.edge + 0.05), c, V(ex, PL.y, PL.back)] : [V(ex, PL.y, PL.back), c, V(fx, foot, PL.edge + 0.05), a], L.paving, [s], dir > 0
      ? [
          [end - P.stop, PL.edge + 0.05],
          [end - P.stop + 5, PL.edge + 0.05],
          [end - P.stop + 5, PL.back],
          [end - P.stop, PL.back],
        ]
      : [
          [end - P.stop, PL.back],
          [end - P.stop - 5, PL.back],
          [end - P.stop - 5, PL.edge + 0.05],
          [end - P.stop, PL.edge + 0.05],
        ]);
    const f = S(L.faceSurf, 0.3, 0.2);
    // Its sides: toward the line and away from it, down to the ground.
    for (const [z, out] of [
      [PL.edge + 0.05, 1],
      [PL.back, -1],
    ] as const) {
      const pts = [V(ex, g, z), V(fx, g, z), V(fx, foot, z), V(ex, PL.y, z)];
      poly(m, dir * out > 0 ? pts : [...pts].reverse(), L.face, [f], (dir * out > 0 ? pts : [...pts].reverse()).map((p) => [p.x, p.y] as [number, number]));
    }
  }
}

/** The canopy: a roof on iron columns (or timber posts by the lake), its underside boarded or glazed, a fretted valance along the front; snow and icicles on the pass. */
function canopy(b: Build, P: StationPlan, L: Look) {
  const m = b.station;
  const ca = Math.max(P.c0, b.u0);
  const cb = Math.min(P.c1, b.u1);
  const front = CANOPY.front;
  const ys = CANOPY.y;
  const yt = ys + 0.16;
  const back = PLATFORM.back;
  const snowy = P.kind === 'pass';
  const iron = S(SURF.iron);
  if (cb > ca) {
    const X0 = x(b, ca);
    const X1 = x(b, cb);
    // The underside, darker into the corner by the wall.
    const sof = (ao: number) => S(L.soffitSurf, 0.5, ao);
    rect(m, V(X0, ys, back), V(X1 - X0, 0, 0), V(0, 0, front - back), L.soffit, [sof(0.35), sof(0.35), sof(0), sof(0)], ca - P.stop, back);
    rect(m, V(X0, yt, front), V(X1 - X0, 0, 0), V(0, 0, back - front), L.roofTop, S(snowy ? SURF.snow : SURF.plain, 0.4), ca - P.stop, front);
    // The fascia, the gutter on it, and the valance under it.
    box(m, X0, ys - 0.06, front - 0.05, X1, yt + 0.1, front, L.fascia, S(SURF.plain, 0.2), 'stb');
    box(m, X0, yt + 0.02, front - 0.02, X1, yt + 0.14, front + 0.1, L.fascia, iron, 'stb');
    const tooth = P.kind === 'city' ? 0.18 : 0.22;
    const val = S(SURF.plain, 0.2);
    for (let u = Math.ceil(ca / tooth) * tooth; u + tooth <= cb; u += tooth) {
      const ux = x(b, u);
      poly(m, [V(ux, ys - 0.06, front - 0.02), V(ux + tooth, ys - 0.06, front - 0.02), V(ux + tooth / 2, ys - 0.38, front - 0.02)], L.fascia, [val]);
    }
    // Where the canopy runs on past the house, a fascia along the back too.
    for (const [a, e] of [
      [ca, Math.min(cb, P.h0)],
      [Math.max(ca, P.h1), cb],
    ])
      if (e > a) box(m, x(b, a), ys - 0.06, back, x(b, e), yt + 0.1, back + 0.05, L.fascia, S(SURF.plain, 0.2), 'ntb');
    if (snowy) {
      // Snow on the roof, overhanging the front a little, and icicles off it.
      box(m, X0, yt, back + 0.05, X1, yt + 0.24, front + 0.12, DARK.snow, S(SURF.snow), 'stnew');
      icicles(b, ca, cb, front + 0.05, ys - 0.06, 31);
    }
    // A beam along under the roof over the columns.
    if (L.posts === 'iron') box(m, X0, ys - 0.22, -3.62, X1, ys, -3.48, L.iron, iron, 'snb');
  }
  // The columns, every 6 m, brackets each way with a ring in each; by the lake, posts with knee braces along the front.
  if (L.posts === 'iron') {
    for (let u = Math.ceil((P.c0 - P.w - 3) / 6) * 6 + P.w + 3; u <= P.c1; u += 6) {
      if (!own(b, u)) continue;
      const cx = x(b, u);
      const cz = -3.55;
      const y0 = PLATFORM.y;
      box(m, cx - 0.17, y0, cz - 0.17, cx + 0.17, y0 + 0.36, cz + 0.17, L.iron, iron, 'snewt');
      m.add(SHAPES.cylinder, place(cx, y0 + 0.36, cz, 0.16, ys - y0 - 0.62, 0.16), L.iron, iron);
      // A flared capital, and a collar a third of the way up.
      m.add(SHAPES.cone, place(cx, ys - 0.22, cz, 0.36, 0.28, 0.36, 0, Math.PI), L.iron, iron);
      m.add(SHAPES.drum, place(cx, ys - 0.26, cz, 0.38, 0.06, 0.38), L.iron, iron);
      m.add(SHAPES.drum, place(cx, y0 + 1.2, cz, 0.22, 0.06, 0.22), L.iron, iron);
      for (const toZ of [front + 0.15, PLATFORM.back + 0.1]) {
        const dz = toZ - cz;
        const dy = 0.85;
        const l = Math.hypot(dz, dy);
        m.add(SHAPES.box, place(cx, ys - 0.05 - dy / 2, cz + dz / 2, 0.05, 0.06, l, 0, Math.atan2(-dy, dz)), L.iron, iron);
        m.add(SHAPES.ring, place(cx, ys - 0.33, cz + dz * 0.32, 0.42, 0.42, 0.42, Math.PI / 2), L.iron, iron);
      }
    }
  } else {
    const pz = front - 0.24;
    const wood = S(SURF.wood, 0.4);
    const ca2 = Math.max(P.c0 + 0.3, b.u0);
    const cb2 = Math.min(P.c1 - 0.3, b.u1);
    const n = Math.round((P.c1 - P.c0 - 0.6) / 3.3);
    for (let k = 0; k <= n; k++) {
      const u = P.c0 + 0.3 + (k * (P.c1 - P.c0 - 0.6)) / n;
      if (!own(b, u)) continue;
      const cx = x(b, u);
      box(m, cx - 0.08, PLATFORM.y, pz - 0.08, cx + 0.08, ys, pz + 0.08, L.fascia, wood, 'snewt');
      // Knee braces up to the beam either side, and one back to the wall.
      for (const s of [-1, 1]) if ((s < 0 && k > 0) || (s > 0 && k < n)) rod(m, V(cx, ys - 0.7, pz), V(cx + s * 0.62, ys - 0.2, pz), 0.07, L.fascia, wood);
      rod(m, V(cx, ys - 0.7, pz - 0.04), V(cx, ys, pz - 0.75), 0.07, L.fascia, wood);
    }
    if (cb2 > ca2) box(m, x(b, ca2), ys - 0.2, pz - 0.08, x(b, cb2), ys, pz + 0.08, L.fascia, wood, 'snb');
  }
}

/** Icicles hanging from an edge at z, height y, along u from a to e: thin, uneven, some long. */
function icicles(b: Build, a: number, e: number, z: number, y: number, salt: number) {
  const m = b.station;
  const ice = S(SURF.ice);
  const col = C('#cfe2f2');
  const step = b.detail >= 1 ? 0.21 : 0.42;
  for (let u = Math.ceil(a / step) * step; u < e; u += step) {
    const r = hash(Math.round(u * 10), salt, 7);
    if (r < 0.35) continue;
    const len = 0.08 + Math.pow(hash(Math.round(u * 10), salt, 9), 2.2) * 0.62;
    const wdt = 0.035 + len * 0.06;
    m.add(SHAPES.cone, place(x(b, u) + (r - 0.5) * 0.1, y, z, wdt, len, wdt, r * 6, Math.PI), col, ice);
  }
}

/** The platform lamps: lanterns hung from the canopy, on posts beyond it. */
function lamps(b: Build, P: StationPlan, L: Look) {
  const SL = STATION_LAMPS;
  const m = b.station;
  const iron = S(SURF.iron);
  for (const u of P.lamps) {
    if (!own(b, u)) continue;
    const lx = x(b, u);
    if (u > P.c0 + 1 && u < P.c1 - 1) {
      box(m, lx - 0.015, SL.y + 0.42, SL.z - 0.015, lx + 0.015, CANOPY.y, SL.z + 0.015, L.iron, iron, 'snew');
      lantern(b, lx, SL.y, SL.z, L.iron, L.lamp);
    } else {
      // A lamp post: a fluted base, a column, the arm a lamplighter's ladder rested on.
      const y0 = PLATFORM.y;
      m.add(SHAPES.drum, place(lx, y0, SL.z, 0.3, 0.42, 0.3), L.iron, iron);
      m.add(SHAPES.cone, place(lx, y0 + 0.42, SL.z, 0.3, 0.3, 0.3), L.iron, iron);
      m.add(SHAPES.drum, place(lx, y0 + 0.4, SL.z, 0.34, 0.05, 0.34), L.iron, iron);
      m.add(SHAPES.cylinder, place(lx, y0 + 0.5, SL.z, 0.11, SL.y - y0 - 0.7, 0.11), L.iron, iron);
      box(m, lx - 0.3, SL.y - 0.42, SL.z - 0.02, lx + 0.3, SL.y - 0.38, SL.z + 0.02, L.iron, iron, 'snewtb');
      lantern(b, lx, SL.y, SL.z, L.iron, L.lamp);
    }
    b.lights.push({ pos: new THREE.Vector3(lx, SL.y, SL.z), color: L.lamp.clone().multiplyScalar(0.7), size: 1.8 });
    b.sweeps.push({ u, y: SL.y, z: SL.z, color: L.lamp.clone(), power: 3.2 });
  }
}

/** The sign by our window: the name on its board, the flaps under it in their case, the clock on top, two little lamps on arms to light it. */
function sign(b: Build, P: StationPlan, L: Look, name: string) {
  if (!own(b, P.w)) return;
  const m = b.station;
  const wx = x(b, P.w);
  const sz = -3.05;
  const iron = S(SURF.iron);
  for (const dx of [-1.24, 1.24]) box(m, wx + dx - 0.045, PLATFORM.y, sz - 0.145, wx + dx + 0.045, 2.6, sz - 0.055, L.iron, iron, 'snewt');
  // The flaps' case: black enamel, a hood over it, a brass line top and bottom.
  box(m, wx - 1.25, 1.35, sz - 0.14, wx + 1.25, 1.71, sz - 0.01, C('#121314'), S(SURF.plain, 0.6), 'snewtb');
  box(m, wx - 1.28, 1.715, sz - 0.15, wx + 1.28, 1.755, sz + 0.09, L.iron, iron);
  for (const dy of [0.155, -0.155]) box(m, wx - 1.21, 1.53 + dy - 0.006, sz - 0.001, wx + 1.21, 1.53 + dy + 0.006, sz + 0.011, BRASS, S(SURF.trim, 0.8), 'stb');
  // The name board, on a backing plate.
  box(m, wx - 1.22, 1.71, sz - 0.065, wx + 1.22, 2.09, sz - 0.015, L.iron, iron, 'snewt');
  sheet(m, FACING, `name:${name}`, wx, 1.9, sz, 2.34, 0.3);
  b.fixtures.push({ kind: 'flap', u: P.w, y: 1.53, z: sz, w: 2.34, h: 0.256 });
  // The clock on a bracket over it.
  box(m, wx - 0.04, 2.09, sz - 0.11, wx + 0.04, 2.2, sz - 0.05, L.iron, iron, 'snewt');
  // (The drum runs back from just behind the face; the other way it hid it.)
  m.add(SHAPES.drum, place(wx, 2.45, sz - 0.035, 0.6, 0.12, 0.6, 0, -Math.PI / 2), L.iron, iron);
  b.fixtures.push({ kind: 'clock', u: P.w, y: 2.45, z: sz - 0.025, w: 0.5, h: 0.5 });
  // The lamps on their arms, over the board.
  for (const s of [-1, 1]) {
    const ax = wx + s * 1.24;
    const lx = ax - s * 0.3;
    rod(m, V(ax, 2.5, sz - 0.1), V(lx, 2.3, sz + 0.28), 0.028, L.iron, iron);
    box(m, lx - 0.09, 2.21, sz + 0.2, lx + 0.09, 2.27, sz + 0.36, L.iron, iron);
    b.decor.add(SHAPES.box, place(lx, 2.195, sz + 0.28, 0.12, 0.03, 0.1), DARK.iron, L.lamp.clone().multiplyScalar(2.2));
    b.lights.push({ pos: new THREE.Vector3(lx, 2.18, sz + 0.28), color: L.lamp.clone().multiplyScalar(0.35), size: 0.6 });
  }
}

/** Benches against the back, a trolley with the luggage on it, a bin; churns and tubs of flowers by the lake; snow on the pass. */
function furniture(b: Build, P: StationPlan, L: Look, seed: number) {
  const m = b.station;
  const y0 = PLATFORM.y;
  const iron = S(SURF.iron);
  const wood = S(SURF.wood, 0.6);
  const slat = C('#6a4a30');
  const snowy = P.kind === 'pass';
  for (const du of L.benches) {
    const bu = P.w + du;
    if (!own(b, bu)) continue;
    const bx = x(b, bu);
    const bz = PLATFORM.back + 0.55;
    for (let k = 0; k < 3; k++) box(m, bx - 0.92, y0 + 0.43, bz + 0.17 - k * 0.13, bx + 0.92, y0 + 0.47, bz + 0.27 - k * 0.13, slat, wood, 'snewtb');
    for (let k = 0; k < 2; k++) m.add(SHAPES.box, place(bx, y0 + 0.66 + k * 0.17, bz - 0.2, 1.84, 0.1, 0.035, 0, 0.12), slat, wood);
    for (const dx of [-0.8, 0.8]) {
      box(m, bx + dx - 0.03, y0, bz - 0.2, bx + dx + 0.03, y0 + 0.44, bz + 0.22, L.iron, iron, 'snewt');
      m.add(SHAPES.box, place(bx + dx, y0 + 0.68, bz - 0.24, 0.06, 0.52, 0.05, 0, 0.12), L.iron, iron);
      m.add(SHAPES.box, place(bx + dx, y0 + 0.62, bz + 0.0, 0.05, 0.05, 0.42), L.iron, iron);
    }
    if (snowy) box(m, bx - 0.9, y0 + 0.47, bz - 0.12, bx + 0.9, y0 + 0.53, bz + 0.26, DARK.snow, S(SURF.snow), 'snewt');
    // A bin at the end of each.
    const nx = bx + 1.35;
    m.add(SHAPES.drum, place(nx, y0, bz + 0.05, 0.42, 0.78, 0.42), C('#24392c'), iron);
    m.add(SHAPES.drum, place(nx, y0 + 0.78, bz + 0.05, 0.46, 0.05, 0.46), C('#1c2c22'), iron);
  }
  // A luggage trolley, its trunks waiting.
  if (P.kind !== 'lake') {
    const tu = P.w + (P.kind === 'city' ? 9.2 : -12.5);
    if (own(b, tu)) {
      const tx = x(b, tu);
      const tz = -4.3;
      box(m, tx - 0.95, y0 + 0.36, tz - 0.42, tx + 0.95, y0 + 0.43, tz + 0.42, C('#5a4632'), wood, 'snewtb');
      for (const dz of [-0.42, 0.42]) box(m, tx - 0.95, y0 + 0.43, tz + dz - 0.025, tx + 0.95, y0 + 0.55, tz + dz + 0.025, C('#4a3826'), wood, 'snewt');
      for (const dz of [-0.36, 0.36]) {
        m.add(SHAPES.drum, place(tx + 0.55, y0 + 0.26, tz + dz, 0.52, 0.06, 0.52, 0, Math.PI / 2), L.iron, iron);
        m.add(SHAPES.drum, place(tx - 0.7, y0 + 0.13, tz + dz, 0.26, 0.05, 0.26, 0, Math.PI / 2), L.iron, iron);
      }
      // The handle, raised.
      for (const dz of [-0.36, 0.36]) m.add(SHAPES.box, place(tx - 1.2, y0 + 0.75, tz + dz, 0.04, 0.85, 0.04, 0, 0, 0.6), L.iron, iron);
      box(m, tx - 1.48, y0 + 1.1, tz - 0.4, tx - 1.44, y0 + 1.14, tz + 0.4, L.iron, iron, 'snewtb');
      // Trunks, a case, a hatbox.
      const trunk = C('#5a3424');
      box(m, tx - 0.85, y0 + 0.43, tz - 0.36, tx + 0.05, y0 + 0.95, tz + 0.32, trunk, S(SURF.wood, 0.1), 'snewt');
      box(m, tx - 0.85, y0 + 0.6, tz - 0.37, tx + 0.05, y0 + 0.64, tz + 0.33, C('#2a1c14'), S(SURF.trim, 0.3), 'snewt');
      box(m, tx + 0.15, y0 + 0.43, tz - 0.28, tx + 0.85, y0 + 0.75, tz + 0.18, C('#7a6a4c'), S(SURF.wood, 0.3), 'snewt');
      box(m, tx - 0.7, y0 + 0.95, tz - 0.2, tx - 0.05, y0 + 1.18, tz + 0.2, C('#3c4a5a'), S(SURF.plain, 0.4), 'snewt');
      m.add(SHAPES.drum, place(tx + 0.45, y0 + 0.75, tz - 0.05, 0.38, 0.24, 0.38), C('#8a2e2a'), S(SURF.plain));
      if (snowy) box(m, tx - 0.85, y0 + 1.18, tz - 0.2, tx - 0.05, y0 + 1.23, tz + 0.2, DARK.snow, S(SURF.snow), 'snewt');
    }
  }
  if (P.kind === 'lake') {
    // Milk churns at the end of the house, tubs of flowers along the rail.
    for (let k = 0; k < 3; k++) {
      const cu = P.h1 + 0.6 + (k % 2) * 0.45;
      if (!own(b, cu)) continue;
      const cz = PLATFORM.back + 0.45 + k * 0.42;
      m.add(SHAPES.drum, place(x(b, cu), y0, cz, 0.36, 0.55, 0.36), C('#8a9096'), S(SURF.iron, 0.3));
      m.add(SHAPES.cone, place(x(b, cu), y0 + 0.55, cz, 0.36, 0.14, 0.36), C('#8a9096'), S(SURF.iron, 0.3));
      m.add(SHAPES.drum, place(x(b, cu), y0 + 0.66, cz, 0.22, 0.1, 0.22), C('#7a8086'), S(SURF.iron, 0.3));
    }
    for (const du of [2.6, 14, -26, 26]) {
      const tu = P.w + du;
      if (!own(b, tu)) continue;
      const tx = x(b, tu);
      const tz = PLATFORM.back + 0.45;
      m.add(SHAPES.drum, place(tx, y0, tz, 0.62, 0.42, 0.62), C('#5a4030'), wood);
      b.decor.add(SHAPES.blob, place(tx, y0 + 0.62, tz, 0.72, 0.5, 0.72, du), DARK.leaf.clone().multiplyScalar(1.3));
      for (let k = 0; k < (b.detail >= 1 ? 12 : 6); k++) {
        const a = k * 2.39996 + du;
        const e = 0.25 + 1.1 * hash(k, 3, Math.round(du * 10));
        const col = FLOWERS[Math.floor(hash(k, 5, Math.round(du * 10)) * FLOWERS.length)];
        b.decor.add(SHAPES.blob, place(tx + Math.cos(a) * Math.cos(e) * 0.34, y0 + 0.62 + Math.sin(e) * 0.24, tz + Math.sin(a) * Math.cos(e) * 0.34, 0.045, 0.035, 0.045, a), col);
      }
    }
  }
  if (snowy) {
    // Drifts against the house and the wall at the back, and along the foot of the columns.
    for (let k = 0; k < 22; k++) {
      const du = -100 + k * 7.2 + hash(k, 3, seed) * 3;
      const u = P.stop + du;
      if (!own(b, u)) continue;
      const len = 1.6 + hash(k, 5, seed) * 2.2;
      m.add(SHAPES.blob, place(x(b, u), y0 - 0.05, PLATFORM.back + 0.18, len, 0.32 + hash(k, 7, seed) * 0.2, 0.6, 0.2), DARK.snow, S(SURF.snow));
    }
  }
}

/** Along the back of the platform beyond the house: iron railings on a low wall in the city, a white rail by the lake, a stone wall capped with snow on the pass. */
function fence(b: Build, P: StationPlan, L: Look) {
  const m = b.station;
  const from = Math.max(P.p0, b.u0);
  const to = Math.min(P.p1, b.u1);
  if (to <= from) return;
  const y0 = PLATFORM.y;
  const z = PLATFORM.back;
  const runs = [
    [from, Math.min(to, P.h0 - 0.4)],
    [Math.max(from, P.h1 + 0.4), to],
  ].filter(([a, e]) => e > a);
  for (const [a, e] of runs) {
    const X0 = x(b, a);
    const X1 = x(b, e);
    if (P.kind === 'city') {
      box(m, X0, y0, z, X1, y0 + 0.5, z + 0.32, L.face, S(SURF.brick, 0.2), 'snt');
      box(m, X0, y0 + 0.5, z - 0.03, X1, y0 + 0.6, z + 0.35, C('#b5ab98'), S(SURF.ashlar, 0.6), 'snt');
      const iron = S(SURF.iron);
      const step = b.detail >= 1 ? 0.22 : 0.44;
      for (let u = Math.ceil(a / step) * step; u < e; u += step) box(m, x(b, u) - 0.012, y0 + 0.6, z + 0.15, x(b, u) + 0.012, y0 + 1.62, z + 0.175, L.iron, iron, 'se');
      for (const yy of [y0 + 0.72, y0 + 1.48]) box(m, X0, yy, z + 0.14, X1, yy + 0.04, z + 0.185, L.iron, iron, 'snt');
    } else if (P.kind === 'lake') {
      const white = C('#e2ddd0');
      const paint = S(SURF.plain, 0.5);
      for (let u = Math.ceil(a / 2) * 2; u < e; u += 2) box(m, x(b, u) - 0.05, y0, z + 0.05, x(b, u) + 0.05, y0 + 1.08, z + 0.15, white, paint, 'snewt');
      for (const yy of [y0 + 0.5, y0 + 0.98]) box(m, X0, yy, z + 0.1, X1, yy + 0.07, z + 0.16, white, paint, 'sntb');
    } else {
      box(m, X0, y0, z, X1, y0 + 0.85, z + 0.42, L.wall, S(SURF.rubble, 0.4), 'snt');
      box(m, X0, y0 + 0.85, z - 0.04, X1, y0 + 1.02, z + 0.48, DARK.snow, S(SURF.snow), 'snt');
    }
  }
}

/** The station house: its walls and the rooms lit behind them, doors, the hatch, posters, its roof and chimneys. */
function house(b: Build, P: StationPlan, L: Look, name: string, seed: number) {
  // (Whole houses belong to the piece their middle is in.)
  if (!own(b, P.hu)) return;
  const m = b.station;
  const d = b.decor;
  const y0 = PLATFORM.y;
  const zf = PLATFORM.back;
  const zb = zf - L.depth;
  const top = y0 + L.height;
  const X0 = x(b, P.h0);
  const X1 = x(b, P.h1);
  const base = Math.min(b.ground(P.h0, zb), b.ground(P.h1, zb), b.ground(P.h0, zf - 0.5), b.ground(P.h1, zf - 0.5), y0) - 0.6;
  const at = (y: number): [THREE.Color, number] => (L.base && y < y0 + L.base.to ? [L.base.color, L.base.surf] : [L.wall, L.wallSurf]);
  const dep = L.reveal;
  const trim = S(SURF.trim, 0.3);
  const plain = S(SURF.plain, 0.3);
  const wood = S(SURF.wood, 0.5);
  const iron = S(SURF.iron);
  let poster = Math.floor(hash(L.roles.length, 3, seed) * POSTERS.length);
  const front: Frame = { o: V(0, 0, zf), ex: V(1, 0, 0), ez: V(0, 0, 1) };

  /** A window in a wall: set back in it, the reveals (warm where the room's lit), the glass, its sash and bars, the sill, and what each kind of house has round its windows. */
  const opening = (F: Frame, a: number, cy: number, ww: number, wh: number, lit: boolean, glow: number) => {
    const h = { x0: a - ww / 2, x1: a + ww / 2, y0: cy - wh / 2, y1: cy + wh / 2 };
    if (lit) reveals(d, F, h, dep, REVEAL, ROOM_GLOW.clone().multiplyScalar(0.16));
    else reveals(m, F, h, dep, at(cy)[0], S(at(cy)[1], 0.2, 0.3));
    if (lit) litGlass(d, F, h, -dep, ROOM_GLOW.clone().multiplyScalar(glow), true);
    else frect(d, F, h.x0, h.y0, h.x1, h.y1, -dep, DARK.glass, NONE);
    sash(m, F, h, -dep + 0.002, L.frame, L.panes);
    fbox(m, F, h.x0 - 0.1, h.y0 - 0.09, -dep + 0.05, h.x1 + 0.1, h.y0, 0.09, L.trim, S(L.quoin ? SURF.ashlar : SURF.plain, 0.7), 'orlt');
    if (P.kind === 'pass') fbox(m, F, h.x0 - 0.08, h.y0, -0.02, h.x1 + 0.08, h.y0 + 0.07, 0.09, DARK.snow, S(SURF.snow), 'orlt');
    if (P.kind === 'city') {
      // Stone surrounds upstairs, a hood over each; a keystone over the ground floor's.
      const sur = S(SURF.ashlar, 0.5);
      if (cy > y0 + 3) {
        fbox(m, F, h.x0 - 0.14, h.y0, 0, h.x0, h.y1 + 0.14, 0.04, L.trim, sur, 'orlt');
        fbox(m, F, h.x1, h.y0, 0, h.x1 + 0.14, h.y1 + 0.14, 0.04, L.trim, sur, 'orlt');
        fbox(m, F, h.x0 - 0.14, h.y1, 0, h.x1 + 0.14, h.y1 + 0.14, 0.04, L.trim, sur, 'orlt');
        fbox(m, F, h.x0 - 0.24, h.y1 + 0.14, 0, h.x1 + 0.24, h.y1 + 0.26, 0.13, L.trim, sur, 'orltb');
      } else fbox(m, F, a - 0.13, h.y1, 0, a + 0.13, h.y1 + 0.3, 0.05, L.trim, sur, 'orlt');
    }
    if (L.shutters)
      for (const s of [-1, 1]) {
        const sa = s < 0 ? h.x0 - 0.05 : h.x1 + 0.05;
        fbox(m, F, Math.min(sa, sa + s * ww * 0.5), h.y0 - 0.02, 0.01, Math.max(sa, sa + s * ww * 0.5), h.y1 + 0.02, 0.05, L.shutters, S(SURF.boards, 0.4), 'orlt');
      }
    if (P.kind === 'lake') {
      fbox(m, F, h.x0 - 0.1, h.y0, 0, h.x0, h.y1 + 0.1, 0.03, L.frame, plain, 'orlt');
      fbox(m, F, h.x1, h.y0, 0, h.x1 + 0.1, h.y1 + 0.1, 0.03, L.frame, plain, 'orlt');
      fbox(m, F, h.x0 - 0.1, h.y1, 0, h.x1 + 0.1, h.y1 + 0.12, 0.06, L.frame, plain, 'orltb');
    }
    return h;
  };
  /** A poster in its frame, on a wall. */
  const posterOn = (F: Frame, a: number, cy: number, w = 0.62, h = 0.88) => {
    fbox(m, F, a - w / 2 - 0.06, cy - h / 2 - 0.1, 0, a + w / 2 + 0.06, cy + h / 2 + 0.1, 0.035, C('#2a2018'), wood, 'orlt');
    sheet(m, F, `poster:${POSTERS[poster++ % POSTERS.length]}`, a, cy, 0.04, w, h);
  };

  const holes: Hole[] = [];
  P.bays.forEach((bay, i) => {
    const bx = x(b, bay.u);
    L.floors.forEach((fy, f) => {
      const role: Role = f === 0 ? bay.role : 'win';
      if (role === 'win') {
        const [ww, wh] = f === 0 ? L.win : L.upper;
        holes.push(opening(front, bx, y0 + fy, ww, wh, bay.lit[f], f === 0 ? 1 : 0.75 + 0.3 * hash(i, f, seed)));
        return;
      }
      if (role === 'door' || role === 'main') {
        const dw = doorWidth(P.kind, role);
        const dh = 2.3;
        const h = { x0: bx - dw / 2, x1: bx + dw / 2, y0, y1: y0 + dh + 0.42 };
        holes.push(h);
        reveals(m, front, h, dep, at(y0 + 1)[0], S(at(y0 + 1)[1], 0.2, 0.25), false);
        // The door (two leaves for the city's main one), panelled, a brass knob.
        const dz = -dep;
        fbox(m, front, h.x0 + 0.04, y0, dz, h.x1 - 0.04, y0 + dh, dz + 0.05, L.door, S(SURF.wood, 0.2), 'o');
        const leaves = dw > 1.5 ? 2 : 1;
        for (let l = 0; l < leaves; l++) {
          const lx0 = h.x0 + 0.04 + (l * (dw - 0.08)) / leaves;
          const lw = (dw - 0.08) / leaves;
          for (const [py0, py1] of [
            [0.15, 1.0],
            [1.2, 2.15],
          ])
            fbox(m, front, lx0 + 0.12, y0 + py0, dz + 0.05, lx0 + lw - 0.12, y0 + py1, dz + 0.075, L.door.clone().multiplyScalar(1.25), S(SURF.trim, 0.2), 'orlt');
          if (leaves === 2) fbox(m, front, lx0 + lw - 0.012, y0, dz + 0.05, lx0 + lw + 0.012, y0 + dh, dz + 0.07, L.door.clone().multiplyScalar(0.6), trim, 'o');
        }
        fbox(m, front, h.x1 - 0.2, y0 + 1.02, dz + 0.05, h.x1 - 0.13, y0 + 1.08, dz + 0.11, BRASS, S(SURF.iron, 0.9), 'orlt');
        // The fanlight over it, lit from the hall.
        fbox(m, front, h.x0, y0 + dh, dz, h.x1, y0 + dh + 0.06, dz + 0.06, L.frame, trim, 'otb');
        litGlass(d, front, { x0: h.x0, x1: h.x1, y0: y0 + dh + 0.06, y1: h.y1 }, dz, ROOM_GLOW.clone().multiplyScalar(0.8), false);
        for (let k = 1; k < 4; k++) fbox(m, front, h.x0 + (dw * k) / 4 - 0.014, y0 + dh + 0.06, dz, h.x0 + (dw * k) / 4 + 0.014, h.y1, dz + 0.03, L.frame, trim, 'orl');
        // The name, or a plate, over it; a lamp on a bracket beside it.
        const plateY = Math.min(CANOPY.y - 0.55, h.y1 + 0.3);
        const pw = role === 'main' ? (P.kind === 'lake' ? 1.98 : 2.28) : 1.38;
        fbox(m, front, bx - pw / 2, plateY - 0.2, 0, bx + pw / 2, plateY + 0.2, 0.03, C('#1d1a17'), plain, 'orlt');
        if (role === 'main') sheet(m, front, `name:${name}`, bx, plateY, 0.035, pw - 0.08, P.kind === 'lake' ? 0.27 : 0.32);
        else if (L.plates[i]) sheet(m, front, `plate:${L.plates[i]}`, bx, plateY, 0.035, 1.3, 0.2);
        const dl = doorLamp(P.kind, role, bay.u);
        const lx = x(b, dl.u);
        box(m, lx - 0.08, dl.y + 0.2, zf, lx + 0.08, dl.y + 0.46, zf + 0.03, L.iron, iron, 'snewt');
        rod(m, V(lx, dl.y + 0.36, zf + 0.02), V(lx, dl.y + 0.38, dl.z), 0.035, L.iron, iron);
        rod(m, V(lx, dl.y + 0.24, zf + 0.02), V(lx, dl.y + 0.36, dl.z - 0.12), 0.025, L.iron, iron);
        lantern(b, lx, dl.y, dl.z, L.iron, L.lamp, 0.72);
        b.lights.push({ pos: new THREE.Vector3(lx, dl.y, dl.z), color: L.lamp.clone().multiplyScalar(0.5), size: 1.2 });
        return;
      }
      if (role === 'ticket') {
        const h = { x0: bx - 0.6, x1: bx + 0.6, y0: y0 + 1.0, y1: y0 + 2.05 };
        holes.push(h);
        reveals(d, front, h, dep, DARK.cream.clone().multiplyScalar(0.8), HATCH_GLOW.clone().multiplyScalar(0.12), false);
        litGlass(d, front, h, -dep, HATCH_GLOW, false);
        // The counter out under it, a brass grille, the plate over it.
        fbox(m, front, h.x0 - 0.12, h.y0 - 0.06, -dep, h.x1 + 0.12, h.y0, 0.26, C('#5a3c26'), wood);
        for (let k = 1; k < 9; k++) fbox(m, front, h.x0 + (1.2 * k) / 9 - 0.007, h.y0 + 0.3, -dep + 0.01, h.x0 + (1.2 * k) / 9 + 0.007, h.y1 - 0.05, -dep + 0.025, BRASS, S(SURF.trim, 0.9), 'o');
        fbox(m, front, h.x0, h.y0 + 0.28, -dep + 0.01, h.x1, h.y0 + 0.31, -dep + 0.03, BRASS, S(SURF.trim, 0.9), 'ot');
        sash(m, front, h, -dep + 0.002, L.frame, [1, 1]);
        if (L.plates[i]) {
          fbox(m, front, bx - 0.69, h.y1 + 0.12, 0, bx + 0.69, h.y1 + 0.42, 0.03, C('#1d1a17'), plain, 'orlt');
          sheet(m, front, `plate:${L.plates[i]}`, bx, h.y1 + 0.27, 0.035, 1.3, 0.2);
        }
        return;
      }
      // Something on the wall: a poster in its frame, the departures, an enamel advert.
      if (role === 'poster') posterOn(front, bx, y0 + 1.54);
      else if (role === 'timetable') {
        fbox(m, front, bx - 0.55, y0 + 1.06, 0, bx + 0.55, y0 + 2.16, 0.04, C('#3a2a1c'), wood, 'orlt');
        sheet(m, front, 'timetable', bx, y0 + 1.61, 0.045, 0.98, 0.98);
      } else if (role === 'advert') {
        fbox(m, front, bx - 0.56, y0 + 1.5, 0, bx + 0.56, y0 + 2.1, 0.02, C('#1d1a17'), plain, 'orlt');
        sheet(m, front, `advert:${hash(i, 5, seed) < 0.5 ? 'cocoa' : 'sleepers'}`, bx, y0 + 1.8, 0.025, 1.1, 0.55);
        posterOn(front, bx, y0 + 0.9, 0.6, 0.84);
      }
    });
  });
  // The front, with its openings.
  holed(m, front, X0, X1, y0, top, holes, at, L.base ? [y0 + L.base.to] : []);

  // The ends, from the ground: windows in them (the lake's toward our window has the departures and a poster, and a lamp to read them by).
  const ends: Frame[] = [
    { o: V(X1, 0, zf), ex: V(0, 0, -1), ez: V(1, 0, 0) },
    { o: V(X0, 0, zb), ex: V(0, 0, 1), ez: V(-1, 0, 0) },
  ];
  ends.forEach((E, e) => {
    const eh: Hole[] = [];
    const spots = P.kind === 'city' ? [0.3, 0.7] : [0.5];
    if (P.kind === 'lake' && e === 0) {
      fbox(m, E, 1.05, y0 + 1.06, 0, 2.15, y0 + 2.16, 0.04, C('#3a2a1c'), wood, 'orlt');
      sheet(m, E, 'timetable', 1.6, y0 + 1.61, 0.045, 0.98, 0.98);
      posterOn(E, 3.2, y0 + 1.5);
      const la = 2.4;
      const ly = y0 + 2.62;
      fbox(m, E, la - 0.08, ly + 0.2, 0, la + 0.08, ly + 0.46, 0.03, L.iron, iron, 'orlt');
      rod(m, at3(E, la, ly + 0.36, 0.02), at3(E, la, ly + 0.38, 0.38), 0.035, L.iron, iron);
      const lp = at3(E, la, ly, 0.38);
      lantern(b, lp.x, lp.y, lp.z, L.iron, L.lamp, 0.72);
      b.lights.push({ pos: lp, color: L.lamp.clone().multiplyScalar(0.5), size: 1.2 });
    } else
      L.floors.forEach((fy, f) => {
        const [ww, wh] = f === 0 ? L.win : L.upper;
        spots.forEach((t, k) => eh.push(opening(E, L.depth * t, y0 + fy, ww * 0.9, wh, hash(e * 7 + k, f, seed + 11) < 0.45, 0.8)));
      });
    holed(m, E, 0, L.depth, base, top, eh, at, L.base ? [y0 + L.base.to] : [], y0);
  });
  // The back, plain.
  rect(m, V(X1, base, zb), V(X0 - X1, 0, 0), V(0, top - base, 0), L.wall.clone().multiplyScalar(0.9), S(L.wallSurf, 0.1));
  // The plinth along the front, broken for the doors.
  const doors = holes.filter((h) => h.y0 <= y0 + 0.01).sort((p, q) => p.x0 - q.x0);
  let px = X0 - 0.06;
  const plinth = L.base ? L.base.color.clone().multiplyScalar(0.8) : P.kind === 'lake' ? C('#5a3c30') : L.wall.clone().multiplyScalar(0.8);
  const plinthS = S(P.kind === 'lake' ? SURF.brick : L.base ? SURF.ashlar : L.wallSurf, 0.7, 0.15);
  for (const h of [...doors.map((q) => ({ x0: q.x0, x1: q.x1 })), { x0: X1 + 0.06, x1: X1 + 0.06 }]) {
    if (h.x0 > px) box(m, px, y0, zf - 0.02, h.x0, y0 + (P.kind === 'lake' ? 0.32 : 0.48), zf + 0.07, plinth, plinthS, 'snewt');
    px = h.x1;
  }
  // Quoins at the front corners, long and short in turn.
  if (L.quoin) {
    const qh = P.kind === 'city' ? 0.36 : 0.3;
    const from = L.base ? y0 + L.base.to + 0.3 : y0 + 0.48;
    let k = 0;
    for (let y = from; y + qh <= top + 0.01; y += qh, k++) {
      const long = k % 2 === 0;
      const qs = S(SURF.ashlar, 0.4 + 0.2 * (k % 3));
      box(m, X0 - 0.035, y + 0.01, zf - (long ? 0.28 : 0.5), X0 + (long ? 0.5 : 0.28), y + qh - 0.01, zf + 0.035, L.quoin, qs, 'swtb');
      box(m, X1 - (long ? 0.5 : 0.28), y + 0.01, zf - (long ? 0.28 : 0.5), X1 + 0.035, y + qh - 0.01, zf + 0.035, L.quoin, qs, 'setb');
    }
  } else if (P.kind === 'lake') {
    // Corner boards.
    for (const [cx0, cx1] of [
      [X0 - 0.03, X0 + 0.14],
      [X1 - 0.14, X1 + 0.03],
    ])
      box(m, cx0, y0, zf - 0.14, cx1, top, zf + 0.03, L.trim, plain, 'snewt');
  }
  // The city's: a string course over the canopy and between the floors, a cornice with dentils, a parapet.
  if (P.kind === 'city') {
    const band = (yb: number, ht: number, out: number, s = S(SURF.ashlar, 0.6)) => {
      box(m, X0 - out, yb, zf - 0.02, X1 + out, yb + ht, zf + out, L.trim, s, 'snewtb');
      box(m, X0 - out, yb, zb - out, X0 + 0.02, yb + ht, zf - 0.02, L.trim, s, 'nwtb');
      box(m, X1 - 0.02, yb, zb - out, X1 + out, yb + ht, zf - 0.02, L.trim, s, 'netb');
    };
    band(y0 + 4.08, 0.24, 0.1);
    band(y0 + 6.95, 0.16, 0.07);
    band(top - 0.42, 0.16, 0.12);
    band(top - 0.26, 0.26, 0.3);
    if (b.detail >= 1) for (let u = X0 + 0.15; u < X1 - 0.1; u += 0.26) box(m, u, top - 0.42 - 0.13, zf, u + 0.11, top - 0.42, zf + 0.12, L.trim, S(SURF.ashlar, 0.5), 'snewb');
    // The parapet, brick, with a stone coping.
    box(m, X0, top, zf - 0.3, X1, top + 0.8, zf, L.wall, S(SURF.brick, 0.2), 'sn');
    box(m, X0 - 0.04, top + 0.8, zf - 0.34, X1 + 0.04, top + 0.92, zf + 0.04, L.trim, S(SURF.ashlar, 0.6), 'snewt');
    // Over the main door, a pediment in the parapet.
    const main = P.bays.find((q) => q.role === 'main');
    if (main) {
      const mx = x(b, main.u);
      poly(m, [V(mx - 2.4, top + 0.92, zf + 0.02), V(mx + 2.4, top + 0.92, zf + 0.02), V(mx, top + 2.0, zf + 0.02)], L.trim, [S(SURF.ashlar, 0.6)], [
        [0, 0],
        [4.8, 0],
        [2.4, 1.08],
      ]);
    }
  }
  roof(b, P, L, X0, X1, zf, zb, top);
}

/** The house's roof: hipped slates behind the city's parapet, tiles over the lake's halt with fretted bargeboards, snow on the pass; and chimneys. */
function roof(b: Build, P: StationPlan, L: Look, X0: number, X1: number, zf: number, zb: number, top: number) {
  const m = b.station;
  const rs = S(L.roofSurf, 0.3);
  const plain = S(SURF.plain, 0.3);
  const mid = (zf + zb) / 2;
  let ridgeY: number;
  if (L.hip) {
    const e = top + 0.5;
    const ax0 = X0 + 0.4;
    const ax1 = X1 - 0.4;
    const az0 = zb + 0.4;
    const az1 = zf - 0.4;
    const hd = (az1 - az0) / 2;
    const rise = hd * L.pitch;
    ridgeY = e + rise;
    const slope = Math.hypot(hd, rise);
    const r0 = ax0 + hd;
    const r1 = ax1 - hd;
    // Front and back, their slates in courses up the slope; the hips at the ends.
    poly(m, [V(ax0, e, az1), V(ax1, e, az1), V(r1, ridgeY, mid), V(r0, ridgeY, mid)], L.roof, [rs], [
      [0, 0],
      [ax1 - ax0, 0],
      [r1 - ax0, slope],
      [r0 - ax0, slope],
    ]);
    poly(m, [V(ax1, e, az0), V(ax0, e, az0), V(r0, ridgeY, mid), V(r1, ridgeY, mid)], L.roof.clone().multiplyScalar(0.9), [rs], [
      [0, 0],
      [ax1 - ax0, 0],
      [r1 - ax0, slope],
      [r0 - ax0, slope],
    ]);
    poly(m, [V(ax0, e, az0), V(ax0, e, az1), V(r0, ridgeY, mid)], L.roof, [rs], [
      [0, 0],
      [az1 - az0, 0],
      [hd, slope],
    ]);
    poly(m, [V(ax1, e, az1), V(ax1, e, az0), V(r1, ridgeY, mid)], L.roof, [rs], [
      [0, 0],
      [az1 - az0, 0],
      [hd, slope],
    ]);
    box(m, r0, ridgeY - 0.04, mid - 0.08, r1, ridgeY + 0.08, mid + 0.08, L.roof.clone().multiplyScalar(0.8), S(SURF.iron, 0.2), 'sntew');
    // (Down to the parapet, out of sight, so no gap shows round the eaves.)
    box(m, X0 + 0.3, top, zb + 0.3, X1 - 0.3, e, zf - 0.3, L.roof.clone().multiplyScalar(0.5), plain, 'snew');
  } else {
    const o = P.kind === 'lake' ? 0.55 : 0.45;
    const og = 0.35;
    const half = (zf - zb) / 2;
    ridgeY = top + half * L.pitch;
    const ye = top - o * L.pitch;
    const slope = Math.hypot(half + o, ridgeY - ye);
    const a0 = X0 - og;
    const a1 = X1 + og;
    poly(m, [V(a0, ye, zf + o), V(a1, ye, zf + o), V(a1, ridgeY, mid), V(a0, ridgeY, mid)], L.roof, [rs], [
      [0, 0],
      [a1 - a0, 0],
      [a1 - a0, slope],
      [0, slope],
    ]);
    poly(m, [V(a1, ye, zb - o), V(a0, ye, zb - o), V(a0, ridgeY, mid), V(a1, ridgeY, mid)], L.roof.clone().multiplyScalar(0.92), [rs], [
      [0, 0],
      [a1 - a0, 0],
      [a1 - a0, slope],
      [0, slope],
    ]);
    // The gables, in the walls' own stuff.
    const ws = S(L.wallSurf, 0.1);
    poly(m, [V(X0, top, zb), V(X0, top, zf), V(X0, ridgeY, mid)], L.wall.clone().multiplyScalar(0.95), [ws], [
      [0, 0],
      [zf - zb, 0],
      [half, ridgeY - top],
    ]);
    poly(m, [V(X1, top, zf), V(X1, top, zb), V(X1, ridgeY, mid)], L.wall.clone().multiplyScalar(0.95), [ws], [
      [0, 0],
      [zf - zb, 0],
      [half, ridgeY - top],
    ]);
    // A fascia board along the eaves; bargeboards up the gables; on the pass, the snow's thick edge.
    const fas = P.kind === 'lake' ? L.trim : C('#3a2c22');
    box(m, a0, ye - 0.2, zf + o - 0.04, a1, ye + 0.02, zf + o, fas, plain, 'stb');
    box(m, a0, ye - 0.2, zb - o, a1, ye + 0.02, zb - o + 0.04, fas, plain, 'ntb');
    const tilt = Math.atan2(ridgeY - ye, half + o);
    for (const gx of [a0 + 0.03, a1 - 0.03])
      for (const s of [-1, 1]) {
        const len = slope;
        m.add(SHAPES.box, place(gx, (ye + ridgeY) / 2 - 0.08, mid + (s * (half + o)) / 2, 0.05, 0.24, len, 0, s * tilt), fas, plain);
      }
    if (P.kind === 'lake') {
      // Fretwork hanging from the bargeboards at the gable toward our window, and a finial.
      for (const s of [-1, 1])
        for (let k = 1; k < 9; k++) {
          const t = k / 9;
          const zz = mid + s * (half + o) * t;
          const yy = ridgeY - (ridgeY - ye) * t - 0.2;
          poly(m, [V(a1 - 0.02, yy, zz - 0.11), V(a1 - 0.02, yy, zz + 0.11), V(a1 - 0.02, yy - 0.2, zz)], L.trim, [plain]);
        }
      box(m, a1 - 0.07, ridgeY - 0.1, mid - 0.05, a1 - 0.0, ridgeY + 0.55, mid + 0.05, L.trim, plain, 'snewt');
    }
    if (P.kind === 'pass') {
      box(m, a0, ye - 0.05, zf + o - 0.05, a1, ye + 0.18, zf + o + 0.12, DARK.snow, S(SURF.snow), 'snewt');
      icicles(b, P.h0 - og, P.h1 + og, zf + o + 0.03, ye - 0.06, 47);
    }
  }
  // Chimneys, with pots.
  const stacks = P.kind === 'city' ? [0.22, 0.78] : [0.7];
  const cs = S(L.chimneySurf, 0.4);
  for (const t of stacks) {
    const cx = X0 + (X1 - X0) * t;
    const cz = mid - 0.9;
    const w = P.kind === 'city' ? 1.1 : 0.7;
    const h0 = ridgeY - 1.6;
    const h1 = ridgeY + (P.kind === 'city' ? 1.3 : 0.9);
    box(m, cx - w / 2, h0, cz - 0.35, cx + w / 2, h1, cz + 0.35, L.chimney, cs, 'snewt');
    box(m, cx - w / 2 - 0.06, h1, cz - 0.41, cx + w / 2 + 0.06, h1 + 0.14, cz + 0.41, L.trim, S(SURF.ashlar, 0.6), 'snewtb');
    const pots = P.kind === 'city' ? 3 : 1;
    for (let k = 0; k < pots; k++) m.add(SHAPES.drum, place(cx + (k - (pots - 1) / 2) * 0.32, h1 + 0.14, cz, 0.2, 0.36, 0.2), C('#8a4a34'), S(SURF.plain, 0.4));
    if (P.kind === 'pass') box(m, cx - w / 2 - 0.08, h1 + 0.14, cz - 0.43, cx + w / 2 + 0.08, h1 + 0.3, cz + 0.43, DARK.snow, S(SURF.snow), 'snewt');
  }
}
