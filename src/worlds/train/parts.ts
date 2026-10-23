// The parts the land is built from, shared by the landscapes (scenery.ts) and
// the stations (station.ts): what a piece of land is built into, the colors of
// things lit and unlit at night, and a few simple shapes stamped into it.
import * as THREE from 'three';
import type { Leg } from './journey';
import type { Mesher } from './mesher';
import { place, SHAPES } from './mesher';

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
/** Something with its own texture: a station's flap sign, or its clock. */
export interface Fixture {
  kind: 'flap' | 'clock';
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
  /** The stations: what each surface is made of is in its glow channel (see SURF). */
  station: Mesher;
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

export const C = (hex: string) => new THREE.Color(hex);
export const LIT = {
  warm: C('#ffc27a').multiplyScalar(2.2),
  amber: C('#ffb050').multiplyScalar(2.4),
  sodium: C('#ff9f45'),
  white: C('#ffe3b8'),
  tv: C('#9fc0ff').multiplyScalar(1.6),
  red: C('#ff2a1a'),
  green: C('#3dff7a'),
};
export const DARK = {
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

export const x = (b: Build, u: number) => u - b.u0;

/** A glowing pool of light on the ground under a lamp: a fan, bright in the middle and fading to nothing at the rim. */
export function pool(b: Build, u: number, z: number, radius: number, color: THREE.Color, on?: number) {
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
export function lamp(b: Build, u: number, z: number, y0: number, opts: { height?: number; color?: THREE.Color; sweep?: number; pool?: number; poolOn?: number } = {}) {
  const h = opts.height ?? 4.2;
  const color = opts.color ?? LIT.sodium;
  b.decor.add(SHAPES.cylinder, place(x(b, u), y0, z, 0.12, h, 0.12), DARK.iron);
  b.decor.add(SHAPES.box, place(x(b, u), y0 + h + 0.12, z, 0.32, 0.3, 0.32), DARK.iron, color.clone().multiplyScalar(1.8));
  b.lights.push({ pos: new THREE.Vector3(x(b, u), y0 + h + 0.1, z), color: color.clone().multiplyScalar(0.9), size: 2.2 });
  if (opts.pool) pool(b, u, z, opts.pool, color.clone().multiplyScalar(0.18), opts.poolOn);
  if (opts.sweep) b.sweeps.push({ u, y: y0 + h, z, color: color.clone(), power: opts.sweep });
}

/** A slab of stone from (x0,y0) to (x1,y1) across z0..z1, its faces outward, uvs in meters. */
export function slab(m: Mesher, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, color: THREE.Color, faces = 'nsewt') {
  const v = (px: number, py: number, pz: number) => new THREE.Vector3(px, py, pz);
  if (faces.includes('t')) m.quad(v(x0, y1, z1), v(x1, y1, z1), v(x1, y1, z0), v(x0, y1, z0), color, undefined, [x0, z0, x1, z1]);
  if (faces.includes('s')) m.quad(v(x0, y0, z1), v(x1, y0, z1), v(x1, y1, z1), v(x0, y1, z1), color, undefined, [x0, y0, x1, y1]);
  if (faces.includes('n')) m.quad(v(x1, y0, z0), v(x0, y0, z0), v(x0, y1, z0), v(x1, y1, z0), color, undefined, [x0, y0, x1, y1]);
  if (faces.includes('e')) m.quad(v(x1, y0, z1), v(x1, y0, z0), v(x1, y1, z0), v(x1, y1, z1), color, undefined, [z0, y0, z1, y1]);
  if (faces.includes('w')) m.quad(v(x0, y0, z0), v(x0, y0, z1), v(x0, y1, z1), v(x0, y1, z0), color, undefined, [z0, y0, z1, y1]);
  if (faces.includes('b')) m.quad(v(x0, y0, z0), v(x1, y0, z0), v(x1, y0, z1), v(x0, y0, z1), color, undefined, [x0, z0, x1, z1]);
}

/** Copies a geometry into a mesher (its uvs as they come: meters, for extrusions). */
export function addGeometry(m: Mesher, geo: THREE.BufferGeometry, color: THREE.Color) {
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
