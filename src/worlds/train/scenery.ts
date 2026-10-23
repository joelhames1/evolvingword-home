// What stands on the land along each stretch: trees, hedges, farmhouses with a
// light on, masts for the overhead wires, a level crossing with its car
// waiting; the stone viaduct over the gorge; the snow sheds and the tunnel on
// the pass; the city's streets at 3am; the lake's shore and jetty; and the
// stations. Everything is placed by hashing where it is along its own stretch,
// so a stretch looks the same however it's cut into pieces, and no two visits
// to a landscape look quite alike.
import * as THREE from 'three';
import { LAYOUT, type Leg } from './journey';
import { BALLAST, CESS, COLORS, gorgeAt, gorgeHalf, PLATFORM, RAIL_TOP, STATION_LAMPS, WATER } from './ground';
import { hash, Mesher, noise, place, SHAPES } from './mesher';
import { WINDOW_X } from './plan';

export interface PointSpec {
  pos: THREE.Vector3;
  color: THREE.Color;
  size?: number;
  blink?: number;
  phase?: number;
  duty?: number;
}
/** A lamp close to the line, whose light sweeps through the compartment as it goes by. */
export interface Sweep {
  u: number;
  y: number;
  z: number;
  color: THREE.Color;
  power: number;
}
/** Something with its own texture: a station's flap sign, name board or clock. */
export interface Fixture {
  kind: 'flap' | 'clock' | 'name' | 'poster';
  name?: string;
  u: number;
  y: number;
  z: number;
  w: number;
  h: number;
}

/** What a stretch of land is built into. Positions in the meshers are local: x = u − u0. */
export interface Build {
  u0: number;
  u1: number;
  /** The ground's height (every landscape blended, the railway on it). */
  ground(u: number, z: number): number;
  /** How much this stretch shapes the land at u. */
  weight(leg: Leg, u: number): number;
  decor: Mesher;
  stone: Mesher;
  brick: Mesher;
  rock: Mesher;
  city: Mesher;
  /** Light on the ground: drawn added over what's there. */
  pools: Mesher;
  lights: PointSpec[];
  sweeps: Sweep[];
  fixtures: Fixture[];
  /** Places a thing only once per stretch: true if u falls in this piece, and the land here is (mostly) this stretch's. */
  mine(leg: Leg, u: number, salt: number): boolean;
  /** Clear of the other lines at the junctions, by r meters? */
  free(u: number, z: number, r: number): boolean;
  /** How much of what's far off to put in: 1, or less on a slower computer. */
  detail: number;
}

const C = (hex: string) => new THREE.Color(hex);
const LIT = {
  warm: C('#ffc27a').multiplyScalar(2.2),
  amber: C('#ffb050').multiplyScalar(2.4),
  sodium: C('#ff9f45'),
  white: C('#ffe3b8'),
  tv: C('#9fc0ff').multiplyScalar(1.6),
  red: C('#ff2a1a'),
  green: C('#3dff7a'),
};
const DARK = {
  wall: C('#7d7365'),
  pale: C('#a59a88'),
  roof: C('#3a2f2a'),
  slate: C('#34363c'),
  wood: C('#4a3424'),
  iron: C('#2a2c30'),
  trunk: C('#2b2119'),
  fir: C('#1a2a1e'),
  firLight: C('#24382a'),
  leaf: C('#22301c'),
  bush: C('#1b2717'),
  hay: C('#8a7346'),
  snow: C('#e6edf7'),
  car: C('#4a1d1d'),
  glass: C('#1a2230'),
  boat: C('#5a3e2a'),
  cream: C('#d8cfbc'),
  steel: C('#5a5f66'),
};

const x = (b: Build, u: number) => u - b.u0;

// --- the things themselves -----------------------------------------------------------

function conifer(b: Build, u: number, z: number, height: number, turn: number, snowy = false) {
  const y = b.ground(u, z);
  const w = height * 0.36;
  b.decor.add(SHAPES.cone, place(x(b, u), y + height * 0.12, z, w, height * 0.6, w, turn), snowy ? DARK.fir : DARK.fir);
  b.decor.add(SHAPES.cone, place(x(b, u), y + height * 0.42, z, w * 0.74, height * 0.58, w * 0.74, turn + 0.4), snowy ? DARK.snow.clone().multiplyScalar(0.55) : DARK.firLight);
  if (snowy) b.decor.add(SHAPES.cone, place(x(b, u), y + height * 0.66, z, w * 0.42, height * 0.34, w * 0.42, turn + 0.8), DARK.snow);
  if (Math.abs(z) < 45) b.decor.add(SHAPES.cylinder, place(x(b, u), y - 0.2, z, 0.25, height * 0.2, 0.25), DARK.trunk);
}

function broadleaf(b: Build, u: number, z: number, height: number, turn: number) {
  const y = b.ground(u, z);
  const w = height * 0.62;
  // Close to the line, a fuller crown of several lumps; further off one will do.
  if (Math.abs(z) < 40) {
    b.decor.add(SHAPES.cylinder, place(x(b, u), y - 0.2, z, 0.35, height * 0.55, 0.35), DARK.trunk);
    for (let k = 0; k < 5; k++) {
      const a = turn + k * 1.3;
      const rr = k === 0 ? 0 : w * 0.32;
      b.decor.add(SHAPES.blob, place(x(b, u) + Math.cos(a) * rr, y + height * (0.62 + (k % 2) * 0.12), z + Math.sin(a) * rr, w * 0.62, height * 0.42, w * 0.62, a), DARK.leaf.clone().multiplyScalar(0.9 + k * 0.06));
    }
    return;
  }
  if (Math.abs(z) < 60) b.decor.add(SHAPES.cylinder, place(x(b, u), y - 0.2, z, 0.35, height * 0.5, 0.35), DARK.trunk);
  b.decor.add(SHAPES.blob, place(x(b, u), y + height * 0.62, z, w, height * 0.7, w, turn), DARK.leaf);
  if (Math.abs(z) < 250) b.decor.add(SHAPES.blob, place(x(b, u) + w * 0.25, y + height * 0.75, z + w * 0.1, w * 0.6, height * 0.45, w * 0.6, turn + 1), DARK.leaf.clone().multiplyScalar(1.15));
}

/** A house with a pitched roof, a chimney, and a window or two lit on the side toward the line. */
function house(b: Build, u: number, z: number, opts: { w: number; d: number; h: number; turn?: number; lit: number; seed: number; wall?: THREE.Color; snowy?: boolean }) {
  const y = b.ground(u, z) - 0.3;
  const turn = opts.turn ?? 0;
  const lx = x(b, u);
  b.decor.add(SHAPES.block, place(lx, y, z, opts.w, opts.h + 0.3, opts.d, turn), opts.wall ?? DARK.wall);
  b.decor.add(SHAPES.roof, place(lx, y + opts.h + 0.3, z, opts.w + 0.6, opts.d * 0.55, opts.d + 0.6, turn), opts.snowy ? DARK.snow : DARK.roof);
  b.decor.add(SHAPES.block, place(lx + opts.w * 0.25, y + opts.h + 0.3, z, 0.5, opts.d * 0.6, 0.5, turn), DARK.roof);
  // Windows on the face toward the track.
  const face = z < 0 ? 1 : -1;
  const cos = Math.cos(turn);
  const sin = Math.sin(turn);
  const n = Math.max(1, Math.round(opts.w / 2.6));
  for (let i = 0; i < n; i++) {
    for (const floor of opts.h > 5 ? [1.4, 4.2] : [1.4]) {
      const lit = hash(i, Math.round(floor), opts.seed) < opts.lit;
      const along = (i - (n - 1) / 2) * 2.6;
      // Off the wall by more the further it is from the line, so far off it doesn't flicker into the wall;
      // a long way off, only the lit ones show, as lights.
      const out = (opts.d / 2 + 0.03 + Math.abs(z) * 0.0012) * face;
      const wx = lx + along * cos + out * sin;
      const wz = z - along * sin + out * cos;
      const color = lit ? (hash(i, 7, opts.seed) < 0.15 ? LIT.tv : LIT.warm) : DARK.glass;
      if (Math.abs(z) < 450) b.decor.add(SHAPES.quad, place(wx, y + 0.3 + floor, wz, 0.9, 1.2, 1, turn + (face < 0 ? Math.PI : 0)), DARK.glass, lit ? color : undefined);
      if (lit && Math.abs(z) > 25) b.lights.push({ pos: new THREE.Vector3(wx, y + 0.3 + floor, wz), color: color.clone().multiplyScalar(0.16), size: 0.7 });
    }
  }
}

/** A mast for the overhead wires on the window side, its arm out over the track, and a stretch of wire. */
function masts(b: Build, from: number, to: number, opts: { z?: number; base?: (u: number) => number; spacing?: number } = {}) {
  const sp = opts.spacing ?? 58;
  const mz = opts.z ?? -3.35;
  for (let k = Math.ceil(from / sp); k * sp < to; k++) {
    const u = k * sp;
    const y0 = opts.base ? opts.base(u) : b.ground(u, mz);
    const top = RAIL_TOP + 6.6;
    b.decor.add(SHAPES.block, place(x(b, u), y0, mz, 0.26, top - y0, 0.32), DARK.iron);
    b.decor.add(SHAPES.box, place(x(b, u), top - 0.6, mz / 2 + 0.2, 0.12, 0.14, Math.abs(mz) + 0.6), DARK.iron);
    b.decor.add(SHAPES.box, place(x(b, u), top - 1.55, mz / 2 + 0.6, 0.06, 0.06, Math.abs(mz) - 0.8, 0, -0.35), DARK.steel);
  }
  // The contact wire and the catenary over it, along this piece.
  const len = to - from;
  if (len > 0) {
    b.decor.add(SHAPES.box, place(x(b, (from + to) / 2), RAIL_TOP + 5.1, 0.1, len, 0.02, 0.02), DARK.iron);
    b.decor.add(SHAPES.box, place(x(b, (from + to) / 2), RAIL_TOP + 6.1, 0.1, len, 0.02, 0.02), DARK.iron);
  }
}

/** The rails and sleepers along a piece of straight track at z, or along a curve. */
function track(b: Build, from: number, to: number, zAt: (u: number) => number = () => 0, y = BALLAST) {
  const sleeper = DARK.wood.clone().multiplyScalar(0.8);
  for (let u = Math.ceil(from / 0.65) * 0.65; u < to; u += 0.65) {
    const z = zAt(u);
    const turn = Math.atan2(zAt(u + 1) - z, 1);
    b.decor.add(SHAPES.box, place(x(b, u), y + 0.06, z, 0.24, 0.13, 2.5, -turn), sleeper);
  }
  const step = 4;
  for (let u = from; u < to; u += step) {
    const u1 = Math.min(to, u + step);
    for (const side of [-0.7175, 0.7175]) {
      const a = new THREE.Vector3(x(b, u), y + 0.16, zAt(u) + side);
      const c = new THREE.Vector3(x(b, u1), y + 0.16, zAt(u1) + side);
      const mid = a.clone().add(c).multiplyScalar(0.5);
      b.decor.add(SHAPES.box, place(mid.x, mid.y + 0.04, mid.z, a.distanceTo(c), 0.15, 0.07, -Math.atan2(c.z - a.z, c.x - a.x)), DARK.steel);
    }
  }
}

/** A glowing pool of light on the ground under a lamp: a fan, bright in the middle and fading to nothing at the rim. */
function pool(b: Build, u: number, z: number, radius: number, color: THREE.Color, on?: number) {
  // On the ground, or on a floor at `on` (a platform).
  const floor = (pu: number, pz: number) => (on ?? b.ground(pu, pz)) + 0.06;
  const center = new THREE.Vector3(x(b, u), floor(u, z), z);
  const n = 10;
  const pts = Array.from({ length: n + 1 }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    const pu = u + Math.cos(a) * radius;
    const pz = z + Math.sin(a) * radius;
    return new THREE.Vector3(x(b, pu), floor(pu, pz), pz);
  });
  const none = new THREE.Color(0, 0, 0);
  for (let i = 0; i < n; i++) {
    const base = b.pools.glow.length;
    b.pools.tri(center, pts[i + 1], pts[i], none, color);
    // The rim's corners: no light.
    for (let k = 3; k < 9; k++) b.pools.glow[base + k] = 0;
  }
}

/** A lamp post: a post, a lantern, its glow from afar, and a pool of light under it. */
function lamp(b: Build, u: number, z: number, y0: number, opts: { height?: number; color?: THREE.Color; sweep?: number; pool?: number; poolOn?: number } = {}) {
  const h = opts.height ?? 4.2;
  const color = opts.color ?? LIT.sodium;
  b.decor.add(SHAPES.cylinder, place(x(b, u), y0, z, 0.12, h, 0.12), DARK.iron);
  b.decor.add(SHAPES.box, place(x(b, u), y0 + h + 0.12, z, 0.32, 0.3, 0.32), DARK.iron, color.clone().multiplyScalar(1.8));
  b.lights.push({ pos: new THREE.Vector3(x(b, u), y0 + h + 0.1, z), color: color.clone().multiplyScalar(0.9), size: 2.2 });
  if (opts.pool) pool(b, u, z, opts.pool, color.clone().multiplyScalar(0.18), opts.poolOn);
  if (opts.sweep) b.sweeps.push({ u, y: y0 + h, z, color: color.clone(), power: opts.sweep });
}

/** A tapered stone pier from the ground up to y1: w along the line, d across it. */
function pier(m: Mesher, cx: number, y0: number, y1: number, w0: number, d0: number, w1: number, d1: number, color: THREE.Color) {
  const v = (px: number, py: number, pz: number) => new THREE.Vector3(px, py, pz);
  const a0 = [v(cx - w0 / 2, y0, -d0 / 2), v(cx + w0 / 2, y0, -d0 / 2), v(cx + w0 / 2, y0, d0 / 2), v(cx - w0 / 2, y0, d0 / 2)];
  const a1 = [v(cx - w1 / 2, y1, -d1 / 2), v(cx + w1 / 2, y1, -d1 / 2), v(cx + w1 / 2, y1, d1 / 2), v(cx - w1 / 2, y1, d1 / 2)];
  // Four sides (outward), uvs in meters.
  m.quad(a0[1], a0[0], a1[0], a1[1], color, undefined, [0, y0, w0, y1]);
  m.quad(a0[2], a0[1], a1[1], a1[2], color, undefined, [0, y0, d0, y1]);
  m.quad(a0[3], a0[2], a1[2], a1[3], color, undefined, [0, y0, w0, y1]);
  m.quad(a0[0], a0[3], a1[3], a1[0], color, undefined, [0, y0, d0, y1]);
}

/** A slab of stone from (x0,y0) to (x1,y1) across z0..z1, its faces outward, uvs in meters. */
function slab(m: Mesher, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, color: THREE.Color, faces = 'nsewt') {
  const v = (px: number, py: number, pz: number) => new THREE.Vector3(px, py, pz);
  if (faces.includes('t')) m.quad(v(x0, y1, z1), v(x1, y1, z1), v(x1, y1, z0), v(x0, y1, z0), color, undefined, [x0, z0, x1, z1]);
  if (faces.includes('s')) m.quad(v(x0, y0, z1), v(x1, y0, z1), v(x1, y1, z1), v(x0, y1, z1), color, undefined, [x0, y0, x1, y1]);
  if (faces.includes('n')) m.quad(v(x1, y0, z0), v(x0, y0, z0), v(x0, y1, z0), v(x1, y1, z0), color, undefined, [x0, y0, x1, y1]);
  if (faces.includes('e')) m.quad(v(x1, y0, z1), v(x1, y0, z0), v(x1, y1, z0), v(x1, y1, z1), color, undefined, [z0, y0, z1, y1]);
  if (faces.includes('w')) m.quad(v(x0, y0, z0), v(x0, y0, z1), v(x0, y1, z1), v(x0, y1, z0), color, undefined, [z0, y0, z1, y1]);
  if (faces.includes('b')) m.quad(v(x0, y0, z0), v(x1, y0, z0), v(x1, y0, z1), v(x0, y0, z1), color, undefined, [x0, z0, x1, z1]);
}

// --- the landscapes ------------------------------------------------------------------

/**
 * Scatters things on a grid of cells along the stretch, each cell's spot
 * jittered; `put` decides what (if anything) goes there. Past `near` meters out
 * they thin away, the far ones being only specks in the haze.
 */
function scatter(b: Build, leg: Leg, cell: number, zFrom: number, zTo: number, salt: number, put: (u: number, z: number, r: number, i: number, j: number) => void, near = 70) {
  const l0 = Math.floor((b.u0 - leg.start) / cell) - 1;
  const l1 = Math.ceil((b.u1 - leg.start) / cell) + 1;
  const j0 = Math.floor(zFrom / cell);
  const j1 = Math.ceil(zTo / cell);
  for (let i = l0; i <= l1; i++)
    for (let j = j0; j <= j1; j++) {
      const u = leg.start + (i + hash(i, j, leg.seed + salt)) * cell;
      const z = (j + hash(j, i, leg.seed + salt * 3)) * cell;
      if (z < zFrom || z > zTo) continue;
      if (Math.abs(z) > near && hash(i * 5, j * 3, leg.seed + salt * 11) > Math.pow(near / Math.abs(z), 1.25) * b.detail) continue;
      if (!b.mine(leg, u, salt + i * 7 + j * 13) || !b.free(u, z, 5)) continue;
      put(u, z, hash(i * 3, j * 5, leg.seed + salt * 7), i, j);
    }
}

function dressFields(b: Build, leg: Leg) {
  const s = leg.seed;
  const L = LAYOUT.fields;
  // Trees along the hedgerows and in little woods.
  scatter(b, leg, 14, -1300, 1300, 1, (u, z, r) => {
    const az = Math.abs(z);
    if (az < 14) return;
    const wood = noise((u - leg.start) / 300, z / 300, s + 3) > 0.35;
    const hedge = Math.abs(((z + noise((u - leg.start) / 80, 0, s) * 10) % 85) / 85) < 0.08 || Math.abs(((u - leg.start) % 110) / 110) < 0.06;
    if (!(wood && r < 0.85) && !(hedge && r < 0.55)) return;
    if (az > 500 && r > 0.4) return;
    broadleaf(b, u, z, 7 + r * 7, r * 6);
  });
  // Hedges: low, dark, along the field edges near the line.
  scatter(b, leg, 7, -260, 260, 2, (u, z, r) => {
    if (Math.abs(z) < 14) return;
    const along = Math.abs((((u - leg.start) % 110) + 110) % 110 - 55) > 52;
    const across = Math.abs((((z % 85) + 85) % 85) - 42) > 39;
    if (!(along || across) || r > 0.8) return;
    const y = b.ground(u, z);
    b.decor.add(SHAPES.blob, place(x(b, u), y + 0.7, z, 5, 1.8, 3.5, r * 3), DARK.bush);
  });
  // Farms: a house and a barn, now and then, some with a light on.
  scatter(b, leg, 170, -900, 900, 3, (u, z, r, i, j) => {
    if (Math.abs(z) < 45 || r > 0.55) return;
    const turn = (hash(i, j, s + 5) - 0.5) * 0.5;
    house(b, u, z, { w: 9 + r * 4, d: 7, h: 5.5, turn, lit: 0.35, seed: s + i * 31 + j });
    house(b, u + 16, z + (z < 0 ? -10 : 10), { w: 16, d: 10, h: 6, turn, lit: 0, seed: s + i, wall: DARK.wood });
    // A yard lamp by the door.
    if (r < 0.3) b.lights.push({ pos: new THREE.Vector3(x(b, u - 5), b.ground(u - 5, z) + 3, z + (z < 0 ? 4 : -4)), color: LIT.white.clone().multiplyScalar(0.8), size: 1.6 });
  });
  // Bales in a stubble field.
  scatter(b, leg, 22, -300, 300, 4, (u, z, r) => {
    if (Math.abs(z) < 20 || r > 0.25 || noise((u - leg.start) / 200, z / 200, s + 9) < 0.2) return;
    const y = b.ground(u, z);
    b.decor.add(SHAPES.drum, place(x(b, u), y + 0.72, z, 1.5, 1.4, 1.5, r * 3, Math.PI / 2), DARK.hay);
  });
  // A village far off: a cluster of lights, a church.
  if (b.mine(leg, leg.start + 1400, 5)) {
    const vz = -700 - (s % 200);
    for (let k = 0; k < 22; k++) {
      const u = leg.start + 1400 + (hash(k, 1, s) - 0.5) * 260;
      const z = vz + (hash(k, 2, s) - 0.5) * 160;
      house(b, u, z, { w: 8, d: 7, h: 6, lit: 0.5, seed: s + k, turn: hash(k, 3, s) - 0.5 });
    }
    const cu = leg.start + 1400;
    const cy = b.ground(cu, vz);
    b.decor.add(SHAPES.block, place(x(b, cu), cy, vz, 7, 14, 7), DARK.pale);
    b.decor.add(SHAPES.cone, place(x(b, cu), cy + 14, vz, 5, 12, 5, Math.PI / 4), DARK.slate);
    b.lights.push({ pos: new THREE.Vector3(x(b, cu), cy + 11, vz + 3.6), color: LIT.white.clone(), size: 2.5 });
  }
  // Telegraph poles beside the line, wires rising and falling between them.
  const PZ = -6.2;
  const sp = 42;
  for (let k = Math.ceil((b.u0 - leg.start) / sp); leg.start + k * sp < b.u1; k++) {
    const u = leg.start + k * sp;
    if (!b.mine(leg, u, 6)) continue;
    const y = b.ground(u, PZ);
    b.decor.add(SHAPES.cylinder, place(x(b, u), y - 0.3, PZ, 0.22, 7.6, 0.22), DARK.wood);
    b.decor.add(SHAPES.box, place(x(b, u), y + 6.7, PZ, 0.12, 0.12, 1.6), DARK.wood);
    const ny = b.ground(u + sp, PZ);
    for (const dz of [-0.65, -0.22, 0.22, 0.65]) {
      const n = 8;
      for (let q = 0; q < n; q++) {
        const t0 = q / n;
        const t1 = (q + 1) / n;
        const yy = (t: number) => y + (ny - y) * t + 6.85 - Math.sin(t * Math.PI) * 0.55;
        const a = new THREE.Vector3(x(b, u + sp * t0), yy(t0), PZ + dz);
        const c = new THREE.Vector3(x(b, u + sp * t1), yy(t1), PZ + dz);
        b.decor.quad(a, c, c.clone().setY(c.y + 0.022), a.clone().setY(a.y + 0.022), DARK.iron);
      }
    }
  }
  // A fence at the edge of the railway's land.
  for (let u = Math.ceil(b.u0 / 3.2) * 3.2; u < b.u1; u += 3.2) {
    if (b.weight(leg, u) < 0.5) continue;
    const local = u - leg.start;
    if (L.crossing !== undefined && Math.abs(local - L.crossing) < 12) continue;
    const y = b.ground(u, -9);
    b.decor.add(SHAPES.box, place(x(b, u), y + 0.55, -9, 0.1, 1.1, 0.1), DARK.wood);
  }
  if (L.crossing !== undefined) crossing(b, leg, leg.start + L.crossing);
  masts(b, Math.max(b.u0, leg.start), Math.min(b.u1, leg.end));
}

/** The level crossing: the road, the barriers down, the red lights flashing, a car waiting with its lights on. */
function crossing(b: Build, leg: Leg, c: number) {
  if (c < b.u0 - 20 || c > b.u1 + 20) return;
  const own = c >= b.u0 && c < b.u1;
  // The road over the line, following the ground.
  const zs = [-420, -260, -160, -100, -60, -36, -22, -14, -9, -6, -4, -3, -2.2, 2.2, 3, 4, 6, 9, 14, 22, 36, 60, 100, 160, 260, 420];
  if (own) {
    for (let i = 0; i < zs.length - 1; i++) {
      const za = zs[i];
      const zb = zs[i + 1];
      if (za === -2.2) continue;
      const ya = b.ground(c, za) + 0.06;
      const yb = b.ground(c, zb) + 0.06;
      const v = (u: number, y: number, z: number) => new THREE.Vector3(x(b, u), y, z);
      // The road either side of a white line down the middle, broken: side by side, never one laid over
      // another (that flickers from far off).
      const mid = i % 2 === 0 ? DARK.cream.clone().multiplyScalar(0.7) : COLORS.asphalt;
      for (const [a, e, col] of [
        [c - 3.4, c - 0.06, COLORS.asphalt],
        [c - 0.06, c + 0.06, mid],
        [c + 0.06, c + 3.4, COLORS.asphalt],
      ] as const)
        b.decor.quad(v(a, ya, za), v(e, ya, za), v(e, yb, zb), v(a, yb, zb), col);
    }
    // Timber decking between the rails.
    b.decor.add(SHAPES.box, place(x(b, c), RAIL_TOP - 0.05, 0, 6.8, 0.1, 4.6), DARK.wood);
    for (const side of [-1, 1]) {
      const pz = side * 4.6;
      const py = b.ground(c, pz);
      // The barrier: a post, and its striped arm down across the road.
      const pu = c + side * 4.3;
      b.decor.add(SHAPES.block, place(x(b, pu), py, pz, 0.35, 1.25, 0.35), DARK.cream);
      b.decor.add(SHAPES.box, place(x(b, pu) - side * 3.9, py + 1.0, pz, 7.6, 0.12, 0.1), DARK.cream);
      for (let k = 0; k < 6; k++) b.decor.add(SHAPES.box, place(x(b, pu) - side * (0.9 + k * 1.2), py + 1.0, pz, 0.6, 0.13, 0.11), LIT.red.clone().multiplyScalar(0.35));
      // The lights: two red lamps flashing in turn, on a post with the crossed boards.
      const lu = c - side * 4.2;
      b.decor.add(SHAPES.block, place(x(b, lu), py, pz, 0.14, 3.2, 0.14), DARK.iron);
      for (const [dx, ph] of [
        [-0.32, 0],
        [0.32, 0.5],
      ] as const) {
        b.decor.add(SHAPES.box, place(x(b, lu) + dx, py + 2.2, pz + side * -0.1, 0.24, 0.24, 0.12), DARK.iron);
        b.lights.push({ pos: new THREE.Vector3(x(b, lu) + dx, py + 2.2, pz - side * 0.18), color: LIT.red.clone().multiplyScalar(2.2), size: 1.2, blink: 1.1, phase: ph, duty: 0.5 });
      }
      for (const t of [0.78, -0.78]) b.decor.add(SHAPES.box, place(x(b, lu), py + 2.85, pz - side * 0.1, 1.3, 0.2, 0.04, 0, 0, t), DARK.cream);
      b.sweeps.push({ u: lu, y: py + 2.2, z: pz, color: LIT.red.clone(), power: 2.5 });
    }
    // The car waiting on the window side, headlights on the barrier.
    const cz = -12.5;
    const cy = b.ground(c + 1.6, cz);
    b.decor.add(SHAPES.block, place(x(b, c + 1.6), cy + 0.25, cz, 1.75, 0.75, 4.3), DARK.car);
    b.decor.add(SHAPES.block, place(x(b, c + 1.6), cy + 1.0, cz - 0.3, 1.6, 0.55, 2.2), DARK.glass);
    for (const dx of [-0.6, 0.6]) {
      b.decor.add(SHAPES.box, place(x(b, c + 1.6) + dx, cy + 0.68, cz + 2.16, 0.3, 0.16, 0.04), DARK.cream, LIT.white.clone().multiplyScalar(3));
      b.lights.push({ pos: new THREE.Vector3(x(b, c + 1.6) + dx, cy + 0.68, cz + 2.2), color: LIT.white.clone().multiplyScalar(1.6), size: 1.1 });
      b.lights.push({ pos: new THREE.Vector3(x(b, c + 1.6) + dx, cy + 0.7, cz - 2.18), color: LIT.red.clone().multiplyScalar(0.7), size: 0.5 });
    }
    // Its lights on the road ahead of it.
    pool(b, c + 1.6, cz + 7, 4.5, LIT.white.clone().multiplyScalar(0.14));
    // The crossing keeper's cottage.
    house(b, c - 14, -22, { w: 7, d: 6, h: 4.5, lit: 0.8, seed: leg.seed + 77, wall: DARK.pale });
  }
}

function dressGorge(b: Build, leg: Leg) {
  const s = leg.seed % 997;
  const [va, vb] = LAYOUT.gorge.viaduct!;
  // Pines on the tops and down the slopes, thinning where the walls get sheer.
  scatter(b, leg, 11, -1300, 1300, 11, (u, z, r) => {
    const az = Math.abs(z);
    if (az < (z < 0 ? 13 : 9)) return;
    const local = u - leg.start;
    const d = Math.abs(local - gorgeAt(z, s)) / gorgeHalf(z, s);
    if (d > 0.82 && d < 1.03) return;
    if (d < 0.25) return;
    const dense = noise(local / 160, z / 160, s + 4) > -0.1;
    if (r > (dense ? 0.75 : 0.2)) return;
    if (az > 600 && r > 0.35) return;
    conifer(b, u, z, 9 + r * 12, r * 6);
  });
  // Boulders on the slopes.
  scatter(b, leg, 18, -500, 500, 12, (u, z, r) => {
    if (Math.abs(z) < 8 || r > 0.35) return;
    const y = b.ground(u, z);
    const size = 1.5 + r * 6;
    b.decor.add(SHAPES.rock, place(x(b, u), y + size * 0.2, z, size * 1.4, size, size * 1.2, r * 9), DARK.wall.clone().multiplyScalar(0.75));
  });
  // A farm or two up on the tops, a light in the window.
  scatter(b, leg, 260, -1000, 1000, 13, (u, z, r, i, j) => {
    const local = u - leg.start;
    if (Math.abs(z) < 70 || r > 0.5 || Math.abs(local - gorgeAt(z, s)) < gorgeHalf(z, s) + 40) return;
    house(b, u, z, { w: 10, d: 7, h: 5, lit: 0.5, seed: leg.seed + i * 7 + j, turn: r - 0.5 });
  });
  viaduct(b, leg.start + va, leg.start + vb);
  masts(b, Math.max(b.u0, leg.start), Math.min(b.u1, leg.start + va - 10));
  masts(b, Math.max(b.u0, leg.start + vb + 10), Math.min(b.u1, leg.end));
  masts(b, Math.max(b.u0, leg.start + va), Math.min(b.u1, leg.start + vb), { z: -2.95, base: () => -0.55, spacing: 64 });
}

/** The stone viaduct: tall piers down to the gorge, a row of arches under the deck, another lower down, parapets. */
function viaduct(b: Build, a: number, end: number) {
  const SPAN = 30;
  const stoneColor = new THREE.Color('#b4ab9c');
  const deck = -1.6;
  const crown = deck - 2.2;
  const from = Math.max(a, b.u0);
  const to = Math.min(end, b.u1);
  if (to > from) {
    // The deck and its parapets, a coping on each.
    slab(b.stone, x(b, from), deck - 1.4, -2.75, x(b, to), deck, 2.75, stoneColor, 'nst');
    for (const side of [-1, 1]) {
      const z0 = side < 0 ? -2.75 : 2.35;
      slab(b.stone, x(b, from), deck, z0, x(b, to), deck + 0.95, z0 + 0.4, stoneColor, 'nst');
      slab(b.stone, x(b, from), deck + 0.95, z0 - 0.06, x(b, to), deck + 1.07, z0 + 0.46, stoneColor.clone().multiplyScalar(1.12), 'nst');
    }
    slab(b.stone, x(b, from), deck, -1.7, x(b, to), BALLAST, 1.7, COLORS.ballast, 'nst');
  }
  // The piers, each down to the ground, and the arches between them.
  const n = Math.round((end - a) / SPAN);
  const pierAt = (k: number) => a + (k * (end - a)) / n;
  for (let k = 0; k <= n; k++) {
    const pu = pierAt(k);
    const ground = Math.min(b.ground(pu, -4), b.ground(pu, 4), b.ground(pu, 0)) - 1;
    // Piers stand in their own piece of land; arches belong to the piece their middle is in.
    if (pu >= b.u0 && pu < b.u1 && ground < crown - 1) {
      const depth = crown - ground;
      const w1 = 4.2;
      const w0 = w1 + depth * 0.06;
      // Up from the ground, tapering, and on up between the arches to the deck.
      pier(b.stone, x(b, pu), ground, crown - 13, w0, 5.5 + depth * 0.07, w1, 5.5, stoneColor);
      pier(b.stone, x(b, pu), crown - 13, deck - 1.4, w1, 5.5, w1, 5.5, stoneColor);
      // A string course at the springing.
      slab(b.stone, x(b, pu) - w1 / 2 - 0.2, crown - 13.4, -2.95, x(b, pu) + w1 / 2 + 0.2, crown - 12.9, 2.95, stoneColor, 'nsewt');
    }
    if (k === n) break;
    const p0 = pu;
    const p1 = pierAt(k + 1);
    const mid = (p0 + p1) / 2;
    if (mid < b.u0 || mid >= b.u1) continue;
    const r = (p1 - p0 - 4.2) / 2;
    const spring = crown - r;
    // Spandrel and arch ring, as one extruded outline: up the pier face, along under the deck, down, and round the arch back.
    const sh = new THREE.Shape();
    sh.moveTo(x(b, p0) + 2.1, spring);
    sh.lineTo(x(b, p0) + 2.1 - 0.001, deck - 1.4);
    sh.lineTo(x(b, p1) - 2.1, deck - 1.4);
    sh.lineTo(x(b, p1) - 2.1, spring);
    sh.absarc(x(b, mid), spring, r, 0, Math.PI, false);
    const geo = new THREE.ExtrudeGeometry(sh, { depth: 5.5, bevelEnabled: false, curveSegments: 14 });
    geo.translate(0, 0, -2.75);
    addGeometry(b.stone, geo, stoneColor);
    // The lower tier, where the gorge is deep enough for it.
    const g0 = Math.min(b.ground(p0, 0), b.ground(p1, 0));
    if (g0 < spring - 40) {
      const lowCrown = spring - 26;
      const lr = r;
      const lowSpring = lowCrown - lr;
      const lo = new THREE.Shape();
      lo.moveTo(x(b, p0) + 2.6, lowSpring);
      lo.lineTo(x(b, p0) + 2.6 - 0.001, lowCrown + 1.6);
      lo.lineTo(x(b, p1) - 2.6, lowCrown + 1.6);
      lo.lineTo(x(b, p1) - 2.6, lowSpring);
      lo.absarc(x(b, mid), lowSpring, (p1 - p0 - 5.2) / 2, 0, Math.PI, false);
      const lg = new THREE.ExtrudeGeometry(lo, { depth: 4.2, bevelEnabled: false, curveSegments: 12 });
      lg.translate(0, 0, -2.1);
      addGeometry(b.stone, lg, stoneColor.clone().multiplyScalar(0.72));
    }
  }
}

/** Copies a geometry into a mesher (its uvs as they come: meters, for extrusions). */
function addGeometry(m: Mesher, geo: THREE.BufferGeometry, color: THREE.Color) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  g.computeVertexNormals();
  const p = g.attributes.position;
  const n = g.attributes.normal;
  const uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) {
    m.pos.push(p.getX(i), p.getY(i), p.getZ(i));
    m.nrm.push(n.getX(i), n.getY(i), n.getZ(i));
    m.col.push(color.r, color.g, color.b);
    m.glow.push(0, 0, 0);
    m.uv.push(uv ? uv.getX(i) : 0, uv ? uv.getY(i) : 0);
  }
  geo.dispose();
  if (g !== geo) g.dispose();
}

function dressPass(b: Build, leg: Leg) {
  const s = leg.seed % 997;
  const L = LAYOUT.pass;
  const local = (u: number) => u - leg.start;
  const inTunnel = (u: number) => local(u) > L.tunnel![0] - 30 && local(u) < L.tunnel![1] + 30;
  // Snowy firs down the valley side and up the mountain.
  scatter(b, leg, 10, -1300, 900, 21, (u, z, r) => {
    const az = Math.abs(z);
    if (az < (z < 0 ? 13 : 8) || inTunnel(u)) return;
    const dense = noise(local(u) / 140, z / 140, s + 7) > 0.05;
    if (r > (dense ? 0.7 : 0.15)) return;
    if (z > 0 && z > 250) return;
    if (az > 700 && r > 0.3) return;
    conifer(b, u, z, 7 + r * 10, r * 6, true);
  });
  // Rock breaking through the snow.
  scatter(b, leg, 20, -700, 300, 22, (u, z, r) => {
    if (Math.abs(z) < 7 || r > 0.3 || inTunnel(u)) return;
    const y = b.ground(u, z);
    const size = 2 + r * 9;
    b.decor.add(SHAPES.rock, place(x(b, u), y + size * 0.15, z, size * 1.3, size, size, r * 9), DARK.wall.clone().multiplyScalar(0.7));
  });
  // Chalets far down in the valley, lit.
  scatter(b, leg, 120, -900, -150, 23, (u, z, r, i, j) => {
    if (r > 0.45) return;
    house(b, u, z, { w: 9, d: 8, h: 5.5, lit: 0.6, seed: leg.seed + i * 3 + j, snowy: true, wall: DARK.wood, turn: r - 0.5 });
  });
  // The sheds: a roof over the line, pillars on the valley side, a wall on the mountain side.
  for (const [a, e] of L.sheds!) sheds(b, leg.start + a, leg.start + e);
  tunnel(b, leg.start + L.tunnel![0], leg.start + L.tunnel![1]);
  const covered = [...L.sheds!, L.tunnel!].map(([a, e]) => [leg.start + a, leg.start + e] as const);
  let from = Math.max(b.u0, leg.start);
  const end = Math.min(b.u1, leg.end);
  for (const [a, e] of covered.sort((p, q) => p[0] - q[0])) {
    if (a > from) masts(b, from, Math.min(end, a));
    from = Math.max(from, e);
  }
  if (end > from) masts(b, from, end);
  if (L.station) station(b, leg, leg.start + L.station.at, L.station.name, 'pass');
}

/** How far apart the sheds' pillars stand on the valley side, how wide each is, and how far out. */
export const SHED_PILLARS = { step: 9, width: 0.42, z0: -4.75, z1: -4.3 };

function sheds(b: Build, a: number, e: number) {
  const from = Math.max(a, b.u0);
  const to = Math.min(e, b.u1);
  if (to <= from) return;
  const concrete = new THREE.Color('#8d8a84');
  const P = SHED_PILLARS;
  // Roof slab, out over the pillars toward the valley, snow on top.
  slab(b.rock, x(b, from), 4.4, P.z0 - 0.15, x(b, to), 5.1, 4.2, concrete, 'nstb');
  b.decor.add(SHAPES.box, place(x(b, (from + to) / 2), 5.35, (P.z0 + 4.2) / 2, to - from, 0.5, 4.2 - P.z0 + 0.2), DARK.snow);
  // The mountain-side wall.
  slab(b.rock, x(b, from), CESS - 0.2, 3.4, x(b, to), 4.4, 4.2, concrete, 'n');
  // Slim stone pillars on the valley side, well out from the line, so they flick past the window
  // one by one instead of filling it.
  for (let k = Math.ceil(from / P.step); k * P.step < to; k++) {
    const pu = k * P.step;
    const g = Math.min(b.ground(pu, P.z0), b.ground(pu, P.z1), CESS) - 1.2;
    slab(b.stone, x(b, pu) - P.width / 2, g, P.z0, x(b, pu) + P.width / 2, 4.4, P.z1, new THREE.Color('#a49c8e'), 'nsew');
    // A haunch where each meets the roof.
    b.stone.add(SHAPES.box, place(x(b, pu), 4.2, (P.z0 + P.z1) / 2, P.width + 0.5, 0.4, P.z1 - P.z0), new THREE.Color('#a49c8e'));
  }
  // The ends of the roof, thick.
  for (const pu of [a, e]) if (pu >= b.u0 && pu < b.u1) slab(b.rock, x(b, pu) - 0.4, 3.6, P.z0 - 0.2, x(b, pu) + 0.4, 5.4, 4.3, concrete, 'nsewt');
}

/** The tunnel: its walls and vault, a lamp every so often, and a stone portal at each end in the mountain's face. */
function tunnel(b: Build, a: number, e: number) {
  const from = Math.max(a, b.u0);
  const to = Math.min(e, b.u1);
  const rockColor = new THREE.Color('#57534d');
  const W = 3.7;
  const spring = 1.3;
  const R = W;
  // The profile: up one wall, over the vault, down the other (seen from inside).
  const prof: [number, number][] = [];
  prof.push([-W, CESS - 0.2], [-W, spring]);
  for (let i = 1; i < 12; i++) {
    const t = Math.PI - (i / 12) * Math.PI;
    prof.push([Math.cos(t) * R, spring + Math.sin(t) * R * 0.95]);
  }
  prof.push([W, spring], [W, CESS - 0.2]);
  if (to > from) {
    const step = 5;
    for (let u = from; u < to; u += step) {
      const u1 = Math.min(to, u + step);
      for (let i = 0; i < prof.length - 1; i++) {
        const [z0, y0] = prof[i];
        const [z1, y1] = prof[i + 1];
        const v = (uu: number, yy: number, zz: number) => new THREE.Vector3(x(b, uu), yy, zz);
        // Facing in: wound so the inside is the front.
        b.rock.quad(v(u, y0, z0), v(u1, y0, z0), v(u1, y1, z1), v(u, y1, z1), rockColor.clone().multiplyScalar(0.8 + 0.2 * hash(i, Math.floor(u), 9)), undefined, [u, i, u1, i + 1]);
      }
    }
    // Lamps on the window-side wall, and a cable run.
    for (let k = Math.ceil((from - a) / 22); a + k * 22 < to; k++) {
      const lu = a + k * 22 + 6;
      if (lu >= to) break;
      b.decor.add(SHAPES.box, place(x(b, lu), 1.9, -W + 0.1, 0.5, 0.18, 0.12), DARK.iron, LIT.amber.clone().multiplyScalar(2.2));
      pool(b, lu, -W + 1.2, 1.4, LIT.amber.clone().multiplyScalar(0.12));
      b.lights.push({ pos: new THREE.Vector3(x(b, lu), 1.9, -W + 0.25), color: LIT.amber.clone().multiplyScalar(0.8), size: 1.2 });
      b.sweeps.push({ u: lu, y: 1.9, z: -W + 0.3, color: LIT.amber.clone().multiplyScalar(0.5), power: 2.0 });
    }
    b.decor.add(SHAPES.box, place(x(b, (from + to) / 2), 0.9, -W + 0.08, to - from, 0.08, 0.06), DARK.iron);
    b.decor.add(SHAPES.box, place(x(b, (from + to) / 2), 1.05, -W + 0.08, to - from, 0.05, 0.05), DARK.iron);
  }
  // The portals: a wall of dressed stone with the tunnel's mouth in it.
  for (const [pu, dir] of [
    [a, -1],
    [e, 1],
  ] as const) {
    if (pu < b.u0 || pu >= b.u1) continue;
    const sh = new THREE.Shape();
    sh.moveTo(-16, CESS - 3);
    sh.lineTo(16, CESS - 3);
    sh.lineTo(16, 13);
    sh.lineTo(-16, 13);
    sh.closePath();
    const hole = new THREE.Path();
    hole.moveTo(-W, CESS - 0.2);
    hole.lineTo(W, CESS - 0.2);
    hole.lineTo(W, spring);
    hole.absarc(0, spring, R, 0, Math.PI, false);
    hole.lineTo(-W, CESS - 0.2);
    sh.holes.push(hole);
    const geo = new THREE.ExtrudeGeometry(sh, { depth: 2, bevelEnabled: false, curveSegments: 16 });
    // The shape is drawn across the line (z) and up; turn it to face along the line.
    // (Turned so it stands just outside the mouth: before it at the way in, after it at the way out.)
    geo.rotateY(dir < 0 ? -Math.PI / 2 : Math.PI / 2);
    geo.translate(x(b, pu), 0, 0);
    addGeometry(b.stone, geo, new THREE.Color('#9c968c'));
    // Snow on its top.
    b.decor.add(SHAPES.box, place(x(b, pu) + dir * 1, 13.3, 0, 2.6, 0.6, 32.4), DARK.snow);
  }
}

function dressCity(b: Build, leg: Leg) {
  const s = leg.seed;
  const L = LAYOUT.city;
  const STREET = -8.6;
  // Cross streets, every eighty-odd meters along the line.
  const crossAt = (k: number) => leg.start + 40 + k * 86 + (hash(k, 1, s) - 0.5) * 18;
  const k0 = Math.floor((b.u0 - leg.start - 60) / 86) - 1;
  const k1 = Math.ceil((b.u1 - leg.start) / 86) + 1;
  // The rows of buildings either side, between the streets that run beside the line.
  const ROWS = [
    [21, 70],
    [84, 140],
    [154, 214],
    [228, 300],
    [314, 400],
    [414, 520],
    [534, 660],
  ];
  for (let k = k0; k <= k1; k++) {
    const sa = crossAt(k) + 7;
    const sb = crossAt(k + 1) - 7;
    if (sa > leg.end || sb < leg.start) continue;
    for (const sign of [-1, 1]) {
      ROWS.forEach(([za, zb], row) => {
        // Lots along the block, a building on each, front and back.
        let u = sa;
        let lot = 0;
        while (u < sb - 6) {
          const w = Math.min(sb - u, 10 + hash(k * 31 + lot, row, s) * 18);
          const mid = u + w / 2;
          lot++;
          u += w;
          if (!b.mine(leg, mid, 100 + k * 17 + lot * 3 + row * 7 + (sign + 1))) continue;
          if (!b.free(mid, sign * (za + zb) / 2, w / 2 + (zb - za) / 2)) continue;
          const tall = row > 2 ? 1.5 : 1;
          for (const [edge, face] of [
            [za, 1],
            [zb, -1],
          ] as const) {
            const depth = 11 + hash(lot, row * 3 + face, s + k) * 12;
            const h = (9 + Math.pow(hash(lot, row * 5 + face, s + k * 3), 2) * 26) * tall;
            const zc = sign * (edge + (face * depth) / 2);
            building(b, mid, zc, w - 0.6, depth, h, STREET, hash(lot, k, s + row), row < 2 ? 0.045 : 0.03);
          }
        }
      });
    }
    // Lamps down the cross street, both sides, out into the town.
    const cu = crossAt(k);
    if (cu >= b.u0 && cu < b.u1) {
      for (const sign of [-1, 1])
        for (let z = 14; z < 560; z += 26) {
          if (!underStation(leg, cu - 6.5, sign * z)) lamp(b, cu - 6.5, sign * z, STREET, { height: 6, pool: z < 160 ? 6 : 0 });
          if (z % 52 === 14 && !underStation(leg, cu + 6.5, sign * (z + 13))) lamp(b, cu + 6.5, sign * (z + 13), STREET, { height: 6, pool: z < 160 ? 6 : 0 });
        }
      // A traffic light blinking amber at the corner by the line.
      for (const sign of [-1, 1]) {
        b.decor.add(SHAPES.block, place(x(b, cu + 7), STREET, sign * 19.5, 0.12, 3.2, 0.12), DARK.iron);
        b.lights.push({ pos: new THREE.Vector3(x(b, cu + 7), STREET + 3.0, sign * 19.5), color: LIT.amber.clone().multiplyScalar(1.4), size: 0.8, blink: 1.3, phase: hash(k, sign + 3, s), duty: 0.5 });
      }
    }
  }
  // The streets that run along beside the line, under the viaduct: lamps, parked cars.
  for (let u = Math.ceil(b.u0 / 24) * 24; u < b.u1; u += 24) {
    if (b.weight(leg, u) < 0.5) continue;
    for (const sign of [-1, 1]) {
      if (underStation(leg, u, sign * 8) || underStation(leg, u + 8, sign * 12)) continue;
      lamp(b, u, sign * 8, STREET, { height: 6.5, pool: 7, sweep: sign < 0 ? 1.4 : 0 });
      if (hash(Math.round(u), sign + 5, s) < 0.45) {
        const cz = sign * (11.5 + hash(Math.round(u), 9, s));
        const tint = [DARK.car, DARK.slate, DARK.cream.clone().multiplyScalar(0.5), DARK.steel][Math.floor(hash(Math.round(u), 11, s) * 4)];
        b.decor.add(SHAPES.block, place(x(b, u + 8), STREET, cz, 4.2, 0.8, 1.75), tint);
        b.decor.add(SHAPES.block, place(x(b, u + 8.3), STREET + 0.8, cz, 2.2, 0.55, 1.6), DARK.glass);
      }
    }
  }
  // The brick viaduct the line runs on: its walls down to the street, a parapet each side.
  const from = Math.max(b.u0, leg.start - 170);
  const to = Math.min(b.u1, leg.end + 170);
  const brickColor = new THREE.Color('#9a6a56');
  for (let u = from; u < to; u += 5) {
    const u1 = Math.min(to, u + 5);
    for (const side of [-1, 1]) {
      const z = side * 3.0;
      const g0 = Math.min(b.ground(u, side * 3.6), b.ground(u1, side * 3.6));
      if (g0 > CESS - 0.3) continue;
      const v = (uu: number, yy: number, zz: number) => new THREE.Vector3(x(b, uu), yy, zz);
      // The outer face, down to the street.
      if (side < 0) b.brick.quad(v(u1, g0, z - 0.5), v(u, g0, z - 0.5), v(u, -0.5, z - 0.5), v(u1, -0.5, z - 0.5), brickColor, undefined, [u, g0, u1, -0.5]);
      else b.brick.quad(v(u, g0, z + 0.5), v(u1, g0, z + 0.5), v(u1, -0.5, z + 0.5), v(u, -0.5, z + 0.5), brickColor, undefined, [u, g0, u1, -0.5]);
      // The parapet's top and inner face.
      const zi = side < 0 ? z + 0.5 : z - 0.5;
      const zo = side < 0 ? z - 0.5 : z + 0.5;
      b.brick.quad(v(u, -0.5, zo), v(u1, -0.5, zo), v(u1, -0.5, zi), v(u, -0.5, zi), brickColor.clone().multiplyScalar(1.1), undefined, [u, 0, u1, 1]);
      if (side < 0) b.brick.quad(v(u, CESS, zi), v(u1, CESS, zi), v(u1, -0.5, zi), v(u, -0.5, zi), brickColor, undefined, [u, CESS, u1, -0.5]);
      else b.brick.quad(v(u1, CESS, zi), v(u, CESS, zi), v(u, -0.5, zi), v(u1, -0.5, zi), brickColor, undefined, [u, CESS, u1, -0.5]);
    }
  }
  if (to > from) b.decor.add(SHAPES.box, place(x(b, (from + to) / 2), BALLAST - 0.12, 0, to - from, 0.24, 5.0), COLORS.ballast);
  // Signals on the parapet now and then: red or green.
  for (let k = Math.ceil((b.u0 - leg.start) / 380); leg.start + k * 380 < b.u1; k++) {
    const u = leg.start + k * 380 + 120;
    if (u < b.u0 || u >= b.u1) continue;
    b.decor.add(SHAPES.block, place(x(b, u), -0.5, -2.9, 0.18, 4.2, 0.18), DARK.iron);
    b.decor.add(SHAPES.box, place(x(b, u), 3.4, -2.9, 0.42, 1.1, 0.28), DARK.iron);
    const green = hash(k, 3, s) < 0.6;
    b.lights.push({ pos: new THREE.Vector3(x(b, u), green ? 3.2 : 3.65, -2.72), color: (green ? LIT.green : LIT.red).clone().multiplyScalar(1.8), size: 0.7 });
    b.sweeps.push({ u, y: 3.4, z: -2.8, color: (green ? LIT.green : LIT.red).clone().multiplyScalar(0.6), power: 1.4 });
  }
  masts(b, Math.max(b.u0, leg.start), Math.min(b.u1, leg.end), { z: -2.95, base: () => -0.5, spacing: 52 });
  if (L.station) station(b, leg, leg.start + L.station.at, L.station.name, 'city');
}

/** Is (u, z) inside the station house's footprint, on a stretch with a station (the city's goes down to the street)? */
function underStation(leg: Leg, u: number, z: number) {
  const st = LAYOUT[leg.land].station;
  if (!st || leg.land !== 'city') return false;
  const H = HOUSE.city;
  const hu = leg.start + st.at + WINDOW_X + H.at;
  return Math.abs(u - hu) < H.len / 2 + 2 && z < PLATFORM.back + 1 && z > PLATFORM.back - H.depth - 2;
}

/** A city building: four walls and a roof, the windows drawn by its shader from where they are on it (see the city material). */
function building(b: Build, u: number, z: number, w: number, d: number, h: number, base: number, seed: number, lit: number) {
  const v = (px: number, py: number, pz: number) => new THREE.Vector3(px, py, pz);
  const x0 = x(b, u) - w / 2;
  const x1 = x(b, u) + w / 2;
  const z0 = z - d / 2;
  const z1 = z + d / 2;
  const y0 = base;
  const y1 = base + h;
  const tone = [new THREE.Color('#8f8476'), new THREE.Color('#7b7368'), new THREE.Color('#9b8e7a'), new THREE.Color('#6d655e'), new THREE.Color('#8a7e70')][Math.floor(seed * 5)];
  // The glow channel carries the building's own numbers: its seed, how many windows are lit, and that it's a building.
  const g = new THREE.Color(seed, lit, 1);
  b.city.quad(v(x0, y0, z1), v(x1, y0, z1), v(x1, y1, z1), v(x0, y1, z1), tone, g, [0, 0, w, h]);
  b.city.quad(v(x1, y0, z0), v(x0, y0, z0), v(x0, y1, z0), v(x1, y1, z0), tone, g, [0, 0, w, h]);
  b.city.quad(v(x1, y0, z1), v(x1, y0, z0), v(x1, y1, z0), v(x1, y1, z1), tone, g, [0, 0, d, h]);
  b.city.quad(v(x0, y0, z0), v(x0, y0, z1), v(x0, y1, z1), v(x0, y1, z0), tone, g, [0, 0, d, h]);
  b.city.quad(v(x0, y1, z1), v(x1, y1, z1), v(x1, y1, z0), v(x0, y1, z0), tone.clone().multiplyScalar(0.6), new THREE.Color(seed, 0, 1), [0, 0, 0, 0]);
  // From afar, a few of its windows as points of light.
  if (Math.abs(z) > 160 && hash(Math.round(u), Math.round(z), 3) < 0.5) {
    const face = z < 0 ? z1 + 0.2 : z0 - 0.2;
    for (let i = 0; i < 2; i++) b.lights.push({ pos: v(x(b, u) + (hash(i, Math.round(u), 5) - 0.5) * w, y0 + 3 + hash(i, Math.round(z), 7) * (h - 4), face), color: LIT.warm.clone().multiplyScalar(0.35), size: 1.5 });
  }
}

function dressLake(b: Build, leg: Leg) {
  const s = leg.seed % 997;
  const L = LAYOUT.lake;
  // Woods up the hill on the corridor side, and a fringe of trees along the shore.
  scatter(b, leg, 10, -22, 1100, 31, (u, z, r) => {
    if (Math.abs(z) < 12) return;
    if (z < 0 && r > 0.25) return;
    const dense = noise((u - leg.start) / 120, z / 120, s + 2) > -0.2;
    if (r > (dense ? 0.8 : 0.2)) return;
    if (z > 600 && r > 0.35) return;
    if (r < 0.3) broadleaf(b, u, z, 8 + r * 10, r * 7);
    else conifer(b, u, z, 10 + r * 9, r * 6);
  });
  // Boats pulled up on the shingle; a jetty out into the water with a lamp on the end.
  scatter(b, leg, 60, -11, -8, 32, (u, z, r) => {
    if (r > 0.3) return;
    const y = b.ground(u, z);
    b.decor.add(SHAPES.block, place(x(b, u), y, z, 3.6, 0.5, 1.3, 0.2 + r), DARK.boat);
  });
  const jetty = leg.start + 500 + (s % 300);
  if (jetty >= b.u0 && jetty < b.u1) {
    const y = WATER.lake + 0.9;
    b.decor.add(SHAPES.box, place(x(b, jetty), y, -32, 2.2, 0.2, 40), DARK.wood);
    for (let z = -14; z > -52; z -= 4) for (const dx of [-1, 1]) b.decor.add(SHAPES.box, place(x(b, jetty) + dx, y - 1.2, z, 0.2, 2.4, 0.2), DARK.wood);
    b.decor.add(SHAPES.cylinder, place(x(b, jetty) + 0.8, y, -51, 0.1, 2.6, 0.1), DARK.iron);
    b.decor.add(SHAPES.box, place(x(b, jetty) + 0.8, y + 2.7, -51, 0.3, 0.35, 0.3), DARK.iron, LIT.warm.clone());
    b.lights.push({ pos: new THREE.Vector3(x(b, jetty) + 0.8, y + 2.7, -51), color: LIT.warm.clone().multiplyScalar(0.9), size: 2 });
    // Its light on the water, a long wavering streak toward us.
    b.lights.push({ pos: new THREE.Vector3(x(b, jetty) + 0.8, WATER.lake + 0.05, -46), color: LIT.warm.clone().multiplyScalar(0.25), size: 3.5 });
    b.decor.add(SHAPES.block, place(x(b, jetty) - 3, y - 0.6, -40, 4, 0.6, 1.4, 0.1), DARK.boat);
  }
  // A few houses on the hill, lit.
  scatter(b, leg, 150, 40, 700, 33, (u, z, r, i, j) => {
    if (r > 0.45) return;
    house(b, u, z, { w: 9, d: 7, h: 5.5, lit: 0.55, seed: leg.seed + i + j * 5, turn: r - 0.5 });
  });
  masts(b, Math.max(b.u0, leg.start), Math.min(b.u1, leg.end));
  if (L.station) station(b, leg, leg.start + L.station.at, L.station.name, 'lake');
}

// --- stations ------------------------------------------------------------------------

/** How each station's house looks: how long, deep and tall, where it stands against our window, and in what. */
const HOUSE = {
  city: { len: 44, depth: 12, height: 10.6, at: -6, wall: C('#9b8b74'), trim: C('#cfc3aa'), roof: C('#3b3e46'), frame: C('#d9cfba'), shutters: null, floors: [1.75, 5.2, 8.3], win: [1.25, 2.1] },
  pass: { len: 16, depth: 8, height: 6.2, at: -2, wall: C('#6e4c31'), trim: C('#e6dcc6'), roof: DARK.snow, frame: C('#efe6d2'), shutters: C('#2f5a3a'), floors: [1.55, 4.55], win: [1.0, 1.35] },
  lake: { len: 13, depth: 7, height: 5.0, at: -1, wall: C('#cdbf9f'), trim: C('#f0e8d6'), roof: C('#713428'), frame: C('#f3ecdc'), shutters: C('#2e5468'), floors: [1.55], win: [1.05, 1.45] },
} satisfies Record<string, { len: number; depth: number; height: number; at: number; wall: THREE.Color; trim: THREE.Color; roof: THREE.Color; frame: THREE.Color; shutters: THREE.Color | null; floors: number[]; win: [number, number] }>;
/** A lit room through a window: warm, brighter toward the top where its lamp is; and the same through a curtain. */
const ROOM_GLOW = C('#ffb066').multiplyScalar(0.62);
const ROOM_LOW = ROOM_GLOW.clone().multiplyScalar(0.7);
const CURTAIN_GLOW = C('#ff9050').multiplyScalar(0.2);
const CURTAIN = C('#6a2a1e');
/** The posters along the stations' walls. */
const POSTERS = ['lake', 'gorge', 'city', 'fields', 'pass'];

/** A window in a wall that faces the line (its face at z): glass, perhaps a lit room behind it, curtains, a frame and glazing bars, a sill, shutters. */
function litWindow(m: Mesher, cx: number, cy: number, z: number, w: number, h: number, lit: boolean, o: { frame: THREE.Color; sill: THREE.Color; shutters?: THREE.Color | null }) {
  const v = (px: number, py: number, pz: number) => new THREE.Vector3(px, py, pz);
  const x0 = cx - w / 2;
  const x1 = cx + w / 2;
  const y0 = cy - h / 2;
  const y1 = cy + h / 2;
  const zg = z + 0.015;
  const mid = y0 + h * 0.45;
  m.quad(v(x0, y0, zg), v(x1, y0, zg), v(x1, mid, zg), v(x0, mid, zg), DARK.glass, lit ? ROOM_LOW : undefined);
  m.quad(v(x0, mid, zg), v(x1, mid, zg), v(x1, y1, zg), v(x0, y1, zg), DARK.glass, lit ? ROOM_GLOW : undefined);
  if (lit) {
    // Curtains, drawn back to either side.
    const cw = w * 0.24;
    const zc = zg + 0.008;
    m.quad(v(x0, y0, zc), v(x0 + cw, y0, zc), v(x0 + cw * 0.7, y1, zc), v(x0, y1, zc), CURTAIN, CURTAIN_GLOW);
    m.quad(v(x1 - cw, y0, zc), v(x1, y0, zc), v(x1, y1, zc), v(x1 - cw * 0.7, y1, zc), CURTAIN, CURTAIN_GLOW);
  }
  // The frame, the glazing bars, the sill.
  const t = 0.065;
  const zf = z + 0.04;
  m.add(SHAPES.box, place(cx, y1 + t / 2, zf, w + 2 * t, t, 0.07), o.frame);
  m.add(SHAPES.box, place(x0 - t / 2, cy, zf, t, h, 0.07), o.frame);
  m.add(SHAPES.box, place(x1 + t / 2, cy, zf, t, h, 0.07), o.frame);
  m.add(SHAPES.box, place(cx, cy, zg + 0.02, 0.035, h, 0.025), o.frame);
  m.add(SHAPES.box, place(cx, y0 + h * 0.64, zg + 0.02, w, 0.035, 0.025), o.frame);
  m.add(SHAPES.box, place(cx, y0 - 0.045, z + 0.07, w + 0.24, 0.08, 0.16), o.sill);
  if (o.shutters) for (const s of [-1, 1]) m.add(SHAPES.box, place(cx + s * (w / 2 + t + w * 0.27), cy, z + 0.035, w * 0.52, h + 0.06, 0.05), o.shutters);
}

/** The station: a platform along the window side under a canopy on iron columns, lamps, benches, posters, the sign with its flaps and clock, and the station house behind, lit. */
function station(b: Build, leg: Leg, stop: number, name: string, kind: 'pass' | 'city' | 'lake') {
  // Where our window will be when the train stops here, and the platform's ends.
  const w = stop + WINDOW_X;
  const p0 = stop - 104;
  const p1 = stop + 54;
  if (p1 + 60 < b.u0 || p0 - 60 > b.u1) return;
  const own = (u: number) => u >= b.u0 && u < b.u1;
  const from = Math.max(p0, b.u0);
  const to = Math.min(p1, b.u1);
  const snowy = kind === 'pass';
  const P = PLATFORM;
  const SL = STATION_LAMPS;
  const H = HOUSE[kind];
  const v = (uu: number, yy: number, zz: number) => new THREE.Vector3(x(b, uu), yy, zz);
  const paving = C(snowy ? '#b8c0cb' : kind === 'city' ? '#8e877c' : '#878076');
  const coping = C(snowy ? '#e4e9f0' : '#d6cdb9');
  const iron = C(kind === 'city' ? '#2c3a34' : kind === 'pass' ? '#3a2a20' : '#24323c');
  const lampColor = kind === 'city' ? LIT.white : LIT.warm.clone().multiplyScalar(0.55);

  // --- the platform ------------------------------------------------------------------------
  if (to > from) {
    // The top in strips meeting edge to edge (nothing laid over anything, so nothing flickers from afar):
    // the coping, the paving, the line you stand behind, the paving.
    const strips: [number, number, THREE.Color][] = [
      [P.edge, P.edge - 0.45, coping],
      [P.edge - 0.45, P.edge - 0.95, paving],
      [P.edge - 0.95, P.edge - 1.05, C('#c9a83a')],
      [P.edge - 1.05, P.back, paving],
    ];
    for (const [za, zb, c] of strips) b.stone.quad(v(from, P.y, za), v(to, P.y, za), v(to, P.y, zb), v(from, P.y, zb), c, undefined, [from, za, to, zb]);
    // The edge down to the ballast, and the back down to the ground, following it.
    b.stone.quad(v(to, BALLAST - 0.1, P.edge), v(from, BALLAST - 0.1, P.edge), v(from, P.y, P.edge), v(to, P.y, P.edge), paving.clone().multiplyScalar(0.7), undefined, [from, BALLAST, to, P.y]);
    for (let u = from; u < to; u += 8) {
      const u1 = Math.min(to, u + 8);
      const g = Math.min(b.ground(u, P.back - 0.5), b.ground(u1, P.back - 0.5), P.y - 1) - 0.6;
      b.stone.quad(v(u, g, P.back), v(u1, g, P.back), v(u1, P.y, P.back), v(u, P.y, P.back), paving.clone().multiplyScalar(0.6), undefined, [u, g, u1, P.y]);
    }
    for (const end of [p0, p1])
      if (own(end)) {
        const g = Math.min(b.ground(end, P.back), b.ground(end, P.edge), BALLAST) - 0.6;
        slab(b.stone, x(b, end) - 0.2, g, P.back, x(b, end) + 0.2, P.y, P.edge, paving, 'ew');
      }
  }

  // --- the canopy: iron columns, brackets with a ring in each, a roof, a fretted valance -----
  const c0 = w + (kind === 'city' ? -45 : kind === 'pass' ? -21 : -15);
  const c1 = w + (kind === 'city' ? 33 : kind === 'pass' ? 15 : 9);
  const roofY = P.y + 3.85;
  const front = -2.15;
  const ca = Math.max(c0, b.u0);
  const cb = Math.min(c1, b.u1);
  const roofColor = kind === 'lake' ? C('#4a3324') : iron.clone().multiplyScalar(1.3);
  const trim = H.trim;
  if (cb > ca) {
    slab(b.decor, x(b, ca), roofY, P.back, x(b, cb), roofY + 0.16, front, roofColor, 'nstb');
    if (snowy) b.decor.add(SHAPES.box, place(x(b, (ca + cb) / 2), roofY + 0.28, (P.back + front) / 2, cb - ca, 0.24, front - P.back - 0.2), DARK.snow);
    // The fascia board along the front and the valance under it: pointed boards, the old way.
    b.decor.add(SHAPES.box, place(x(b, (ca + cb) / 2), roofY + 0.04, front - 0.03, cb - ca, 0.28, 0.05), trim);
    for (let u = Math.ceil(ca / 0.22) * 0.22; u + 0.22 <= cb; u += 0.22) b.decor.tri(v(u, roofY - 0.1, front - 0.06), v(u + 0.22, roofY - 0.1, front - 0.06), v(u + 0.11, roofY - 0.42, front - 0.06), trim);
  }
  for (let u = Math.ceil((c0 - w - 3) / 6) * 6 + w + 3; u <= c1; u += 6) {
    if (!own(u)) continue;
    const cz = -3.55;
    b.decor.add(SHAPES.block, place(x(b, u), P.y, cz, 0.3, 0.32, 0.3), iron);
    b.decor.add(SHAPES.cylinder, place(x(b, u), P.y + 0.3, cz, 0.15, roofY - P.y - 0.5, 0.15), iron);
    b.decor.add(SHAPES.box, place(x(b, u), roofY - 0.13, cz, 0.3, 0.14, 0.3), iron);
    // A bracket each way under the roof, a ring in the corner of each.
    for (const toZ of [front + 0.15, P.back + 0.1]) {
      const dz = toZ - cz;
      const dy = 0.85;
      const l = Math.hypot(dz, dy);
      b.decor.add(SHAPES.box, place(x(b, u), roofY - 0.05 - dy / 2, cz + dz / 2, 0.05, 0.06, l, 0, Math.atan2(-dy, dz)), iron);
      b.decor.add(SHAPES.box, place(x(b, u), roofY - 0.06, cz + dz / 2, 0.05, 0.06, Math.abs(dz)), iron);
      b.decor.add(SHAPES.ring, place(x(b, u), roofY - 0.33, cz + dz * 0.32, 0.42, 0.42, 0.42, Math.PI / 2), iron);
    }
  }

  // --- the lamps: lanterns hung from the canopy, on posts beyond it; light pooled under each ---
  for (let u = Math.ceil((p0 + 6 - w - SL.offset) / SL.step) * SL.step + w + SL.offset; u < p1 - 4; u += SL.step) {
    if (!own(u)) continue;
    if (u > c0 + 1 && u < c1 - 1) {
      b.decor.add(SHAPES.box, place(x(b, u), (roofY + SL.y + 0.2) / 2, SL.z, 0.03, roofY - SL.y - 0.2, 0.03), iron);
      b.decor.add(SHAPES.box, place(x(b, u), SL.y + 0.24, SL.z, 0.34, 0.08, 0.34), iron);
      b.decor.add(SHAPES.box, place(x(b, u), SL.y, SL.z, 0.24, 0.36, 0.24), iron, lampColor.clone().multiplyScalar(1.6));
      b.lights.push({ pos: new THREE.Vector3(x(b, u), SL.y, SL.z), color: lampColor.clone().multiplyScalar(0.7), size: 1.8 });
      pool(b, u, SL.z + 0.6, 2.8, lampColor.clone().multiplyScalar(0.1), P.y);
      b.sweeps.push({ u, y: SL.y, z: SL.z, color: lampColor.clone(), power: 3.2 });
    } else lamp(b, u, SL.z, P.y, { height: SL.y - P.y - 0.12, color: lampColor, sweep: 3.2, pool: 2.8, poolOn: P.y });
  }

  // --- the sign by our window: the name, the flaps under it in their case, the clock on top ---
  if (own(w)) {
    const sz = -3.05;
    for (const dx of [-1.24, 1.24]) b.decor.add(SHAPES.block, place(x(b, w) + dx, P.y, sz - 0.1, 0.09, 3.05, 0.09), iron);
    // The flaps' case: black enamel, a hood over it, a brass line top and bottom.
    b.decor.add(SHAPES.box, place(x(b, w), 1.53, sz - 0.075, 2.5, 0.36, 0.13), C('#121314'));
    b.decor.add(SHAPES.box, place(x(b, w), 1.735, sz - 0.03, 2.56, 0.04, 0.24), iron);
    for (const dy of [0.155, -0.155]) b.decor.add(SHAPES.box, place(x(b, w), 1.53 + dy, sz + 0.005, 2.42, 0.012, 0.012), C('#b48a46'));
    // The name board's back, and the clock on a bracket over it.
    b.decor.add(SHAPES.box, place(x(b, w), 1.9, sz - 0.04, 2.44, 0.38, 0.05), iron);
    b.fixtures.push({ kind: 'name', name, u: w, y: 1.9, z: sz, w: 2.34, h: 0.3 });
    b.fixtures.push({ kind: 'flap', u: w, y: 1.53, z: sz, w: 2.34, h: 0.256 });
    b.decor.add(SHAPES.box, place(x(b, w), 2.18, sz - 0.08, 0.08, 0.22, 0.06), iron);
    b.decor.add(SHAPES.drum, place(x(b, w), 2.45, sz - 0.07, 0.6, 0.08, 0.6, 0, Math.PI / 2), iron);
    b.fixtures.push({ kind: 'clock', u: w, y: 2.45, z: sz - 0.02, w: 0.5, h: 0.5 });
  }

  // --- benches against the house, facing the line ------------------------------------------
  const benches = kind === 'city' ? [w + 4.6, w - 7.4, w - 19.4, w + 16.6] : [w + 4.6, w - 7.4];
  for (const bu of benches) {
    if (!own(bu)) continue;
    const bz = P.back + 0.55;
    for (let k = 0; k < 3; k++) b.decor.add(SHAPES.box, place(x(b, bu), P.y + 0.45, bz + 0.12 - k * 0.12, 1.8, 0.04, 0.1), DARK.wood.clone().multiplyScalar(1.4));
    for (let k = 0; k < 2; k++) b.decor.add(SHAPES.box, place(x(b, bu), P.y + 0.66 + k * 0.17, bz - 0.21, 1.8, 0.1, 0.035, 0, 0.12), DARK.wood.clone().multiplyScalar(1.4));
    for (const dx of [-0.78, 0.78]) {
      b.decor.add(SHAPES.box, place(x(b, bu) + dx, P.y + 0.22, bz, 0.06, 0.44, 0.42), iron);
      b.decor.add(SHAPES.box, place(x(b, bu) + dx, P.y + 0.7, bz - 0.21, 0.06, 0.5, 0.05), iron);
    }
  }

  // --- the station house ----------------------------------------------------------------------
  const hu = w + H.at;
  const h0 = hu - H.len / 2;
  const h1 = hu + H.len / 2;
  if (h1 > b.u0 && h0 < b.u1) {
    // (Whole houses belong to the piece their middle is in.)
    if (!own(hu)) return fence();
    const zf = P.back;
    const zb = P.back - H.depth;
    const top = P.y + H.height;
    const base = Math.min(b.ground(h0, zb), b.ground(h1, zb), b.ground(h0, zf - 0.5), b.ground(h1, zf - 0.5), P.y) - 0.6;
    const wall = H.wall;
    // The front from the platform up; the ends and back from the ground.
    b.decor.quad(v(h0, P.y, zf), v(h1, P.y, zf), v(h1, top, zf), v(h0, top, zf), wall);
    b.decor.quad(v(h1, base, zb), v(h0, base, zb), v(h0, top, zb), v(h1, top, zb), wall.clone().multiplyScalar(0.9));
    b.decor.quad(v(h0, base, zb), v(h0, base, zf), v(h0, top, zf), v(h0, top, zb), wall.clone().multiplyScalar(0.95));
    b.decor.quad(v(h1, base, zf), v(h1, base, zb), v(h1, top, zb), v(h1, top, zf), wall.clone().multiplyScalar(0.95));
    // A stone plinth along the front, the eaves board, the roof and a chimney or two.
    b.decor.add(SHAPES.box, place(x(b, hu), P.y + 0.2, zf + 0.04, H.len + 0.1, 0.4, 0.09), paving.clone().multiplyScalar(0.8));
    b.decor.add(SHAPES.box, place(x(b, hu), top - 0.12, zf + 0.06, H.len + 0.2, 0.24, 0.14), H.trim);
    if (kind === 'city') {
      // A heavier cornice, a flat roof behind a parapet, pilasters between the bays.
      b.decor.add(SHAPES.box, place(x(b, hu), top + 0.35, (zf + zb) / 2, H.len + 0.4, 0.7, H.depth + 0.3), H.trim.clone().multiplyScalar(0.85));
      b.decor.add(SHAPES.box, place(x(b, hu), top + 0.72, (zf + zb) / 2, H.len - 0.6, 0.06, H.depth - 0.8), H.roof);
    } else {
      b.decor.add(SHAPES.roof, place(x(b, hu), top, (zf + zb) / 2, H.len + 1.2, H.depth * 0.5, H.depth + 1.4), H.roof);
      b.decor.add(SHAPES.block, place(x(b, hu) + H.len * 0.3, top + H.depth * 0.2, (zf + zb) / 2 - 1, 0.7, H.depth * 0.45, 0.7), kind === 'pass' ? C('#5a5350') : C('#8a5a48'));
    }
    // The bays along the front: windows, the door in the middle, posters between.
    const bay = kind === 'city' ? 3.4 : 2.6;
    const n = Math.floor((H.len - 1.2) / bay);
    const first = hu - ((n - 1) * bay) / 2;
    const door = Math.floor(n / 2);
    let poster = Math.floor(hash(n, 3, leg.seed) * POSTERS.length);
    H.floors.forEach((fy, floor) => {
      for (let i = 0; i < n; i++) {
        const bx = x(b, first + i * bay);
        const cy = P.y + fy;
        if (floor === 0 && (i === door || (kind === 'city' && Math.abs(i - door) === 3))) {
          // A door, its fanlight lit, and the name over it.
          b.decor.quad(v(first + i * bay - 0.65, P.y, zf + 0.02), v(first + i * bay + 0.65, P.y, zf + 0.02), v(first + i * bay + 0.65, P.y + 2.3, zf + 0.02), v(first + i * bay - 0.65, P.y + 2.3, zf + 0.02), C('#3a2416'));
          b.decor.quad(v(first + i * bay - 0.55, P.y + 2.38, zf + 0.02), v(first + i * bay + 0.55, P.y + 2.38, zf + 0.02), v(first + i * bay + 0.55, P.y + 2.72, zf + 0.02), v(first + i * bay - 0.55, P.y + 2.72, zf + 0.02), DARK.glass, ROOM_GLOW);
          b.decor.add(SHAPES.box, place(bx, P.y + 2.34, zf + 0.05, 1.5, 0.08, 0.1), H.frame);
          if (i === door) b.fixtures.push({ kind: 'name', name, u: first + i * bay, y: Math.min(roofY - 0.45, P.y + 3.05), z: zf + 0.06, w: 2.2, h: 0.32 });
          continue;
        }
        // Every other bay on the ground floor, a poster where there's no window.
        if (floor === 0 && (i + door) % 3 === 1 && kind !== 'pass') {
          b.decor.add(SHAPES.box, place(bx, P.y + 1.55, zf + 0.03, 0.7, 0.98, 0.04), C('#2a2018'));
          b.fixtures.push({ kind: 'poster', name: POSTERS[poster++ % POSTERS.length], u: first + i * bay, y: P.y + 1.55, z: zf + 0.06, w: 0.6, h: 0.86 });
          continue;
        }
        const lit = hash(i, floor, leg.seed + 7) < (floor === 0 ? 0.85 : 0.45);
        const [ww, wh] = floor === 0 ? H.win : [H.win[0] * 0.85, H.win[1] * 0.8];
        litWindow(b.decor, bx, cy, zf, ww, wh, lit, { frame: H.frame, sill: H.trim, shutters: H.shutters });
      }
    });
    // The city's grand front: pilasters between the bays, up to the cornice.
    if (kind === 'city') for (let i = 0; i <= n; i++) b.decor.add(SHAPES.box, place(x(b, first + (i - 0.5) * bay), (P.y + top) / 2, zf + 0.06, 0.34, H.height, 0.12), H.trim.clone().multiplyScalar(0.92));
  }
  fence();

  /** Along the back of the platform beyond the house: a railing (the lake's halt has the lake behind it). */
  function fence() {
    if (kind === 'city' || to <= from) return;
    for (let u = Math.ceil(from / 2.5) * 2.5; u < to; u += 2.5) if (u < h0 - 0.5 || u > h1 + 0.5) b.decor.add(SHAPES.box, place(x(b, u), P.y + 0.5, P.back + 0.1, 0.06, 1.0, 0.06), iron);
    for (const [a, e] of [
      [from, Math.min(to, h0 - 0.5)],
      [Math.max(from, h1 + 0.5), to],
    ])
      if (e > a) b.decor.add(SHAPES.box, place(x(b, (a + e) / 2), P.y + 0.95, P.back + 0.1, e - a, 0.05, 0.05), iron);
  }
}

// --- the points, and the line not taken ----------------------------------------------

/** How far the other line has swung out from ours, d meters past the points (on the window side). */
export const branchZ = (d: number) => (d < 0 ? 0 : d < 240 ? -(d * d) / (2 * 640) : -45 - (d - 240) * 0.375);

/** The junction at j: the line not taken peeling away from ours on the window side, its rails and ballast, as far as `end` past the points. */
export function points(b: Build, j: number, end: number) {
  const from = Math.max(b.u0, j);
  const to = Math.min(b.u1, j + end);
  if (to <= from) return;
  track(b, from, to, (u) => branchZ(u - j), BALLAST);
  for (let u = from; u < to; u += 4) {
    const u1 = Math.min(to, u + 4);
    const za = branchZ(u - j);
    const zb = branchZ(u1 - j);
    const v = (uu: number, zz: number) => new THREE.Vector3(x(b, uu), b.ground(uu, zz) + 0.04, zz);
    if (za > -2.4) continue;
    b.decor.quad(v(u, za + 1.5), v(u1, zb + 1.5), v(u1, zb - 1.5), v(u, za - 1.5), COLORS.ballast);
  }
  // Where it ends (into the dark, past where it can be followed), a buffer: two posts and a beam.
  const e = j + end;
  if (end > 60 && e >= b.u0 && e < b.u1) {
    const z = branchZ(end);
    const y = b.ground(e, z);
    b.decor.add(SHAPES.box, place(x(b, e), y + 0.6, z, 0.3, 0.3, 2.2, -Math.atan(0.375)), LIT.red.clone().multiplyScalar(0.3));
    for (const dz of [-0.8, 0.8]) b.decor.add(SHAPES.block, place(x(b, e) + 0.2, y - 0.2, z + dz, 0.2, 1.0, 0.2), DARK.iron);
  }
}

export function dress(b: Build, leg: Leg) {
  switch (leg.land) {
    case 'fields':
      return dressFields(b, leg);
    case 'gorge':
      return dressGorge(b, leg);
    case 'pass':
      return dressPass(b, leg);
    case 'city':
      return dressCity(b, leg);
    case 'lake':
      return dressLake(b, leg);
  }
}

export { track };
