// What the land is made with: seeded noise for its shape, and a mesher that
// stamps simple shapes (boxes, cones, blobs, prisms) into one geometry with
// their colors and glows baked in, so each stretch of land is a handful of
// draw calls however many trees and houses it has.
import * as THREE from 'three';

/** A hash of two whole numbers and a seed, 0..1. */
export function hash(x: number, y: number, seed: number) {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(seed | 0, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** Smooth value noise, -1..1. */
export function noise(x: number, y: number, seed: number) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const fx = x - xi;
  const fy = y - yi;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const a = hash(xi, yi, seed);
  const b = hash(xi + 1, yi, seed);
  const c = hash(xi, yi + 1, seed);
  const d = hash(xi + 1, yi + 1, seed);
  return (a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy) * 2 - 1;
}

/** A few octaves of it, -1..1-ish. */
export function fbm(x: number, y: number, seed: number, octaves = 4) {
  let sum = 0;
  let amp = 0.5;
  let f = 1;
  for (let i = 0; i < octaves; i++) {
    sum += noise(x * f, y * f, seed + i * 17) * amp;
    f *= 2.03;
    amp *= 0.5;
  }
  return sum;
}

/** Ridged: sharp crests, for mountains. */
export function ridged(x: number, y: number, seed: number, octaves = 4) {
  let sum = 0;
  let amp = 0.5;
  let f = 1;
  for (let i = 0; i < octaves; i++) {
    const n = 1 - Math.abs(noise(x * f, y * f, seed + i * 31));
    sum += n * n * amp;
    f *= 2.1;
    amp *= 0.5;
  }
  return sum;
}

export const smooth = (a: number, b: number, x: number) => {
  const k = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return k * k * (3 - 2 * k);
};

/** A shape to stamp: its triangles, unindexed. */
export interface Template {
  pos: Float32Array;
  nrm: Float32Array;
  uv: Float32Array;
}

export function template(geo: THREE.BufferGeometry): Template {
  const g = geo.index ? geo.toNonIndexed() : geo;
  if (!g.attributes.normal) g.computeVertexNormals();
  const uv = g.attributes.uv ? (g.attributes.uv.array as Float32Array) : new Float32Array((g.attributes.position.count * 2) | 0);
  return { pos: g.attributes.position.array as Float32Array, nrm: g.attributes.normal.array as Float32Array, uv };
}

/** Flat-shaded templates (each face its own normal), which read better for low-poly things at night. */
export function flatTemplate(geo: THREE.BufferGeometry): Template {
  const g = geo.index ? geo.toNonIndexed() : geo.clone();
  g.deleteAttribute('normal');
  g.computeVertexNormals();
  return template(g);
}

export const SHAPES = {
  box: template(new THREE.BoxGeometry(1, 1, 1)),
  /** A box sitting on the ground: its base at y = 0. */
  block: template(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0)),
  /** A roof: a ridge along x, eaves at y = 0, apex at y = 1, over a 1x1 footprint. */
  roof: flatTemplate(
    (() => {
      const s = new THREE.Shape();
      s.moveTo(-0.5, 0);
      s.lineTo(0.5, 0);
      s.lineTo(0, 1);
      s.closePath();
      return new THREE.ExtrudeGeometry(s, { depth: 1, bevelEnabled: false }).translate(0, 0, -0.5).rotateY(Math.PI / 2);
    })(),
  ),
  cone: flatTemplate(new THREE.ConeGeometry(0.5, 1, 6, 1, true).translate(0, 0.5, 0)),
  cylinder: template(new THREE.CylinderGeometry(0.5, 0.5, 1, 6, 1, true).translate(0, 0.5, 0)),
  /** A closed one, for things seen end on (bales). */
  drum: flatTemplate(new THREE.CylinderGeometry(0.5, 0.5, 1, 10, 1, false).translate(0, 0.5, 0)),
  /** A ring, for the ironwork in the stations' canopy brackets: in the x-y plane, 1 across. */
  ring: template(new THREE.TorusGeometry(0.44, 0.06, 4, 14)),
  blob: flatTemplate(new THREE.IcosahedronGeometry(0.5, 0)),
  rock: flatTemplate(new THREE.DodecahedronGeometry(0.5, 0)),
  /** A flat square facing +z, for lit windows and signs. */
  quad: template(new THREE.PlaneGeometry(1, 1)),
};

const tmpP = new THREE.Vector3();
const tmpN = new THREE.Vector3();
const nm = new THREE.Matrix3();

/** Collects stamped shapes, then makes them one geometry with position, normal, color, aGlow and uv. */
export class Mesher {
  pos: number[] = [];
  nrm: number[] = [];
  col: number[] = [];
  glow: number[] = [];
  uv: number[] = [];

  add(t: Template, m: THREE.Matrix4, color: THREE.Color, glow?: THREE.Color, uvScale?: [number, number]) {
    nm.getNormalMatrix(m);
    const n = t.pos.length / 3;
    for (let i = 0; i < n; i++) {
      tmpP.fromArray(t.pos, i * 3).applyMatrix4(m);
      tmpN.fromArray(t.nrm, i * 3).applyMatrix3(nm).normalize();
      this.pos.push(tmpP.x, tmpP.y, tmpP.z);
      this.nrm.push(tmpN.x, tmpN.y, tmpN.z);
      this.col.push(color.r, color.g, color.b);
      if (glow) this.glow.push(glow.r, glow.g, glow.b);
      else this.glow.push(0, 0, 0);
      this.uv.push(t.uv[i * 2] * (uvScale?.[0] ?? 1), t.uv[i * 2 + 1] * (uvScale?.[1] ?? 1));
    }
  }

  /** A triangle, given its corners, flat. */
  tri(a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, color: THREE.Color, glow?: THREE.Color) {
    tmpN.subVectors(b, a).cross(tmpP.subVectors(c, a)).normalize();
    for (const p of [a, b, c]) {
      this.pos.push(p.x, p.y, p.z);
      this.nrm.push(tmpN.x, tmpN.y, tmpN.z);
      this.col.push(color.r, color.g, color.b);
      if (glow) this.glow.push(glow.r, glow.g, glow.b);
      else this.glow.push(0, 0, 0);
      this.uv.push(0, 0);
    }
  }

  /** A quad a-b-c-d (counter-clockwise from the front), with uvs in meters. */
  quad(a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, d: THREE.Vector3, color: THREE.Color, glow?: THREE.Color, uv?: [number, number, number, number]) {
    tmpN.subVectors(b, a).cross(tmpP.subVectors(d, a)).normalize();
    const [u0, v0, u1, v1] = uv ?? [0, 0, a.distanceTo(b), a.distanceTo(d)];
    const corners: [THREE.Vector3, number, number][] = [
      [a, u0, v0],
      [b, u1, v0],
      [c, u1, v1],
      [a, u0, v0],
      [c, u1, v1],
      [d, u0, v1],
    ];
    for (const [p, s, t] of corners) {
      this.pos.push(p.x, p.y, p.z);
      this.nrm.push(tmpN.x, tmpN.y, tmpN.z);
      this.col.push(color.r, color.g, color.b);
      if (glow) this.glow.push(glow.r, glow.g, glow.b);
      else this.glow.push(0, 0, 0);
      this.uv.push(s, t);
    }
  }

  get empty() {
    return this.pos.length === 0;
  }

  geometry(): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nrm, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.setAttribute('aGlow', new THREE.Float32BufferAttribute(this.glow, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.computeBoundingSphere();
    return g;
  }
}

const m4 = new THREE.Matrix4();
const q = new THREE.Quaternion();
const e = new THREE.Euler();
const sv = new THREE.Vector3();
const pv = new THREE.Vector3();
/** A matrix from a place, a turn about y (and optional tilts), and a size. */
export function place(x: number, y: number, z: number, sx: number, sy: number, sz: number, turn = 0, tiltX = 0, tiltZ = 0) {
  return m4.compose(pv.set(x, y, z), q.setFromEuler(e.set(tiltX, turn, tiltZ, 'YXZ')), sv.set(sx, sy, sz));
}
