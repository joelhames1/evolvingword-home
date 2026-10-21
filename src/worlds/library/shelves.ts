// The shelves. Every wall is four bays of dark wood, nine shelves high, and
// every shelf is full: leather and vellum, bands across the spines, a few
// letters on each that spell nothing. All of them the same format, more or
// less, as you'd expect of a library that holds every possible book.
//
// Near galleries get books you could pull out (a box each, merged into one
// mesh per bay); far ones get the same spines painted onto a strip. Either way
// one bay is built once and stamped into every slot of every gallery.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { canvas, rng, texture } from '../../textures';
import { HEX } from './plan';

const AW = 2048;
const AH = 1024;
/** Spine designs in the atlas: two rows of 64, each 32 x 480 px. */
const SPINE_W = 32;
const SPINE_H = 480;
const PER_ROW = AW / SPINE_W;
export const SPINES = PER_ROW * 2;

const LEATHER = ['#5e1f1a', '#6b2a1c', '#4a2c18', '#5a3a22', '#7a4a2a', '#22382a', '#2e3b2c', '#1f2a3a', '#2a2420', '#1a1614', '#7a3a2a', '#8a6a30', '#3a2418', '#4d1c18', '#614a2e'];
const VELLUM = ['#cdbb92', '#bba67c', '#d6c7a2', '#a8936a'];
/** Letters for the spines: no words, just letters. */
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/** The atlas of spines, and a strip of page tops along the bottom. */
export function spineAtlas() {
  const [c, g] = canvas(AW, AH);
  const r = rng(1941);
  g.fillStyle = '#1a120c';
  g.fillRect(0, 0, AW, AH);
  for (let i = 0; i < SPINES; i++) {
    const x = (i % PER_ROW) * SPINE_W;
    const y = Math.floor(i / PER_ROW) * 512;
    const vellum = r() < 0.12;
    const base = new THREE.Color(vellum ? VELLUM[Math.floor(r() * VELLUM.length)] : LEATHER[Math.floor(r() * LEATHER.length)]);
    base.offsetHSL(0, (r() - 0.5) * 0.06, (r() - 0.5) * 0.05);
    g.fillStyle = `#${base.getHexString()}`;
    g.fillRect(x, y, SPINE_W, SPINE_H);
    // Grain and scuffs.
    for (let k = 0; k < 140; k++) {
      g.fillStyle = `rgba(${r() < 0.5 ? '255,235,200' : '0,0,0'},${r() * (vellum ? 0.06 : 0.1)})`;
      g.fillRect(x + r() * SPINE_W, y + r() * SPINE_H, 1 + r() * 3, 1 + r() * 6);
    }
    // Raised bands across the spine (not on vellum, which is plain).
    const bands = vellum ? [] : [0.16, 0.3, 0.44, 0.58, 0.72, 0.86].filter(() => r() < 0.9);
    for (const b of bands) {
      const by = y + b * SPINE_H;
      g.fillStyle = 'rgba(0,0,0,0.45)';
      g.fillRect(x, by - 5, SPINE_W, 3);
      g.fillStyle = 'rgba(255,230,190,0.16)';
      g.fillRect(x, by - 2, SPINE_W, 3);
      g.fillStyle = 'rgba(0,0,0,0.25)';
      g.fillRect(x, by + 1, SPINE_W, 3);
    }
    // A label with a few letters, one above another.
    const lab = vellum ? 0.12 + r() * 0.2 : 0.18 + Math.floor(r() * 2) * 0.14;
    const ly = y + lab * SPINE_H + 6;
    const n = 2 + Math.floor(r() * 3);
    if (!vellum && r() < 0.6) {
      g.fillStyle = r() < 0.5 ? 'rgba(20,10,6,0.75)' : 'rgba(110,30,22,0.8)';
      g.fillRect(x + 3, ly - 4, SPINE_W - 6, n * 15 + 8);
    }
    g.fillStyle = vellum ? 'rgba(50,30,18,0.75)' : r() < 0.5 ? 'rgba(214,190,130,0.85)' : 'rgba(225,215,190,0.7)';
    g.font = vellum ? 'italic 400 16px "EB Garamond", serif' : '600 15px "EB Garamond", serif';
    g.textAlign = 'center';
    g.textBaseline = 'top';
    for (let k = 0; k < n; k++) g.fillText(LETTERS[Math.floor(r() * LETTERS.length)], x + SPINE_W / 2, ly + k * 15);
    // Round the spine: darker toward its edges, a soft highlight down the middle.
    const round = g.createLinearGradient(x, 0, x + SPINE_W, 0);
    round.addColorStop(0, 'rgba(0,0,0,0.55)');
    round.addColorStop(0.3, 'rgba(0,0,0,0.05)');
    round.addColorStop(0.5, 'rgba(255,240,210,0.08)');
    round.addColorStop(0.72, 'rgba(0,0,0,0.05)');
    round.addColorStop(1, 'rgba(0,0,0,0.6)');
    g.fillStyle = round;
    g.fillRect(x, y, SPINE_W, SPINE_H);
    // Worn at the head and tail.
    const ends = g.createLinearGradient(0, y, 0, y + SPINE_H);
    ends.addColorStop(0, 'rgba(0,0,0,0.5)');
    ends.addColorStop(0.04, 'rgba(0,0,0,0)');
    ends.addColorStop(0.95, 'rgba(0,0,0,0)');
    ends.addColorStop(1, 'rgba(0,0,0,0.55)');
    g.fillStyle = ends;
    g.fillRect(x, y, SPINE_W, SPINE_H);
  }
  // Page tops: cream, ruled with the edges of leaves, dusty.
  const py = 992;
  g.fillStyle = '#b9a47e';
  g.fillRect(0, py, AW, 32);
  for (let x = 0; x < AW; x += 2) {
    g.fillStyle = `rgba(${r() < 0.5 ? '255,245,220' : '60,40,20'},${r() * 0.18})`;
    g.fillRect(x, py, 1, 32);
  }
  const tex = texture(c);
  tex.anisotropy = 8;
  return tex;
}

/** UVs of spine design i in the atlas (u0, v0, u1, v1). */
function spineUV(i: number): [number, number, number, number] {
  const x = (i % PER_ROW) * SPINE_W;
  const y = Math.floor(i / PER_ROW) * 512;
  return [x / AW, 1 - (y + SPINE_H) / AH, (x + SPINE_W) / AW, 1 - y / AH];
}

/** Where the books stand in a bay: shelf by shelf, bottom to top. */
export const SHELVES = (() => {
  const top = HEX.caseTop - 0.2;
  const bottom = 0.12;
  const n = 9;
  const h = (top - bottom) / n;
  return Array.from({ length: n }, (_, i) => bottom + i * h + 0.0125);
})();
const SHELF_GAP = (HEX.caseTop - 0.2 - 0.12) / 9;

/** A box built face by face, for merging: just the faces you can see from the room. */
class Builder {
  pos: number[] = [];
  nrm: number[] = [];
  uv: number[] = [];
  bake: number[] = [];
  idx: number[] = [];
  quad(a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, d: THREE.Vector3, n: THREE.Vector3, uv: [number, number, number, number], shade: number) {
    const base = this.pos.length / 3;
    for (const p of [a, b, c, d]) this.pos.push(p.x, p.y, p.z);
    for (let i = 0; i < 4; i++) {
      this.nrm.push(n.x, n.y, n.z);
      this.bake.push(shade);
    }
    const [u0, v0, u1, v1] = uv;
    this.uv.push(u0, v0, u1, v0, u1, v1, u0, v1);
    this.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nrm, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('aBake', new THREE.Float32BufferAttribute(this.bake, 1));
    g.setIndex(this.idx);
    g.computeBoundingSphere();
    return g;
  }
}

/**
 * One book, standing (or leaning) with its spine to the room: front, top and
 * both sides. `m` places it; the box is w wide, h high, d deep, its front at z=0.
 */
function book(b: Builder, m: THREE.Matrix4, w: number, h: number, d: number, design: number, shade: number) {
  const [u0, v0, u1, v1] = spineUV(design);
  const P = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z).applyMatrix4(m);
  const turn = new THREE.Matrix3().setFromMatrix4(m);
  const N = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z).applyMatrix3(turn).normalize();
  const x0 = -w / 2;
  const x1 = w / 2;
  // The spine.
  b.quad(P(x0, 0, 0), P(x1, 0, 0), P(x1, h, 0), P(x0, h, 0), N(0, 0, 1), [u0, v0, u1, v1], shade);
  // The top: page edges, in shadow under the shelf above.
  const pu = 0.02 + ((design * 37) % 900) / 1000;
  b.quad(P(x0, h, 0), P(x1, h, 0), P(x1, h, -d), P(x0, h, -d), N(0, 1, 0), [pu, 2 / AH, pu + 0.01, 30 / AH], shade * 0.55);
  // The boards at the sides, mostly hidden by the neighbors.
  const edge: [number, number, number, number] = [u0 + 1 / AW, v0, u0 + 3 / AW, v1];
  b.quad(P(x0, 0, -d), P(x0, 0, 0), P(x0, h, 0), P(x0, h, -d), N(-1, 0, 0), edge, shade * 0.45);
  b.quad(P(x1, 0, 0), P(x1, 0, -d), P(x1, h, -d), P(x1, h, 0), N(1, 0, 0), edge, shade * 0.45);
}

/** Where the reshelved book can go in each bay: the gap left for it on one shelf. */
export interface Gap {
  x: number;
  y: number;
  w: number;
}

/**
 * The books of one bay (a variant, seeded): shelf after shelf of them across
 * its width, the odd one leaning, the odd stack lying flat, a few gaps, and one
 * gap kept for a book that's out.
 */
export function bayBooks(seed: number, sparse: boolean, fromShelf = 0): { geometry: THREE.BufferGeometry; gap: Gap } {
  const b = new Builder();
  const r = rng(seed);
  const x0 = -HEX.bayW / 2 + 0.05;
  const x1 = HEX.bayW / 2 - 0.004;
  const front = HEX.depth - 0.026;
  const gapShelf = 3 + Math.floor(r() * 3);
  const gapAt = x0 + 0.25 + r() * (x1 - x0 - 0.5);
  const gap: Gap = { x: gapAt, y: SHELVES[gapShelf], w: 0.055 };
  SHELVES.forEach((y, s) => {
    if (s < fromShelf) return;
    let x = x0 + r() * 0.03;
    // Lower shelves stand a little prouder; the top ones are pushed back.
    while (x < x1 - 0.03) {
      if (s === gapShelf && x + 0.06 > gap.x - gap.w / 2 && x < gap.x + gap.w / 2) {
        x = gap.x + gap.w / 2 + 0.004;
        continue;
      }
      const w = (sparse ? 0.042 : 0.032) + r() * (sparse ? 0.03 : 0.026);
      if (x + w > x1) break;
      const h = 0.27 + r() * 0.05 + (r() < 0.06 ? 0.03 : 0);
      const d = 0.2 + r() * 0.05;
      const push = r() * 0.025 + (r() < 0.05 ? 0.05 : 0);
      const design = Math.floor(r() * SPINES);
      // Darker deeper in the shelf, and a touch darker low down.
      const shade = (1 - push * 6) * (0.82 + 0.18 * (s / SHELVES.length));
      // Now and then a few lie flat in a stack.
      if (r() < 0.025 && x + 0.24 < x1) {
        const n = 2 + Math.floor(r() * 3);
        let sy = y;
        for (let k = 0; k < n; k++) {
          const t = 0.035 + r() * 0.02;
          const m = new THREE.Matrix4().makeTranslation(x + 0.12, sy, front - push + 0.01).multiply(new THREE.Matrix4().makeRotationZ(Math.PI / 2)).multiply(new THREE.Matrix4().makeTranslation(t / 2, -0.11, 0));
          book(b, m, t, 0.22 + r() * 0.03, 0.18, Math.floor(r() * SPINES), shade * 0.9);
          sy += t;
        }
        x += 0.25;
        continue;
      }
      // At the end of a run, one leans on its neighbor.
      const lean = r() < 0.035 ? (0.12 + r() * 0.2) * (r() < 0.5 ? -1 : 1) : 0;
      const m = new THREE.Matrix4().makeTranslation(x + w / 2, y, front - push);
      if (lean) {
        const pivot = lean > 0 ? w / 2 : -w / 2;
        m.multiply(new THREE.Matrix4().makeTranslation(pivot, 0, 0)).multiply(new THREE.Matrix4().makeRotationZ(-lean)).multiply(new THREE.Matrix4().makeTranslation(-pivot, 0, 0));
        x += Math.abs(Math.sin(lean)) * h;
      }
      book(b, m, w, h, d, design, shade);
      x += w + 0.0015;
      // A gap now and then.
      if (r() < 0.03) x += 0.04 + r() * 0.12;
    }
  });
  return { geometry: b.geometry(), gap };
}

/** The far version: each shelf's books painted onto one strip. */
export function stripAtlas() {
  const [c, g] = canvas(2048, 512);
  const r = rng(77);
  g.fillStyle = '#120c08';
  g.fillRect(0, 0, 2048, 512);
  for (let row = 0; row < 4; row++) {
    let x = 0;
    while (x < 2048) {
      const w = 18 + r() * 18;
      const h = 100 + r() * 24;
      const vellum = r() < 0.1;
      const col = new THREE.Color(vellum ? VELLUM[Math.floor(r() * VELLUM.length)] : LEATHER[Math.floor(r() * LEATHER.length)]);
      col.multiplyScalar(0.8 + r() * 0.3);
      g.fillStyle = `#${col.getHexString()}`;
      g.fillRect(x, row * 128 + 128 - h, w - 1.5, h);
      for (const b of [0.2, 0.4, 0.6, 0.8]) {
        g.fillStyle = 'rgba(0,0,0,0.35)';
        g.fillRect(x, row * 128 + 128 - h * b, w - 1.5, 2);
      }
      g.fillStyle = 'rgba(0,0,0,0.4)';
      g.fillRect(x, row * 128 + 128 - h, 3, h);
      g.fillRect(x + w - 4.5, row * 128 + 128 - h, 3, h);
      x += w;
      if (r() < 0.03) x += 20 + r() * 40;
    }
  }
  const tex = texture(c);
  tex.wrapS = THREE.RepeatWrapping;
  return tex;
}

export function bayStrips(seed: number): THREE.BufferGeometry {
  const b = new Builder();
  const r = rng(seed);
  const x0 = -HEX.bayW / 2 + 0.05;
  const x1 = HEX.bayW / 2;
  const z = HEX.depth - 0.06;
  const N = new THREE.Vector3(0, 0, 1);
  for (const y of SHELVES) {
    const row = Math.floor(r() * 4);
    const u = r();
    const v0 = 1 - (row + 1) / 4;
    const h = SHELF_GAP - 0.03;
    b.quad(new THREE.Vector3(x0, y, z), new THREE.Vector3(x1, y, z), new THREE.Vector3(x1, y + h, z), new THREE.Vector3(x0, y + h, z), N, [u, v0, u + 0.7, v0 + 0.25], 0.9);
  }
  return b.geometry();
}

/** A box for merging, with a flat shade on every face. */
export function box(w: number, h: number, d: number, x: number, y: number, z: number, shade = 1) {
  const g = new THREE.BoxGeometry(w, h, d);
  g.translate(x, y, z);
  g.setAttribute('aBake', new THREE.Float32BufferAttribute(new Array(g.attributes.position.count).fill(shade), 1));
  return g;
}

/**
 * The woodwork of one bay: its upright on the left, a back, a plinth, nine
 * shelves and a cornice. Bays stand side by side, each one's upright closing
 * the one before.
 */
export function bayCase(fromShelf = 0): THREE.BufferGeometry {
  const W = HEX.bayW;
  const dd = HEX.depth;
  // Over an alcove, the upright and the back start at the lowest shelf.
  const y0 = fromShelf ? SHELVES[fromShelf] - 0.025 : 0;
  const parts = [
    // Upright, back, plinth.
    box(0.05, HEX.caseTop - y0, dd, -W / 2 + 0.025, (HEX.caseTop + y0) / 2, dd / 2, 0.9),
    box(W, HEX.caseTop - 0.2 - y0, 0.02, 0, (HEX.caseTop - 0.2 + y0) / 2, 0.01, 0.3),
    // The cornice, stepping out at the top.
    box(W, 0.2, dd, 0, HEX.caseTop - 0.1, dd / 2, 0.85),
    box(W, 0.05, 0.06, 0, HEX.caseTop - 0.03, dd + 0.03, 1),
    box(W, 0.03, 0.03, 0, HEX.caseTop - 0.18, dd + 0.015, 0.8),
  ];
  if (fromShelf === 0) parts.push(box(W, 0.12, dd, 0, 0.06, dd / 2, 0.7));
  const shelves = SHELVES.slice(fromShelf);
  for (const y of shelves) parts.push(box(W, 0.025, dd - 0.02, 0, y - 0.0125, (dd - 0.02) / 2, 0.75));
  // A thin lip on each shelf's front edge.
  for (const y of shelves) parts.push(box(W, 0.03, 0.012, 0, y - 0.012, dd - 0.014, 1));
  return mergeGeometries(parts.map((p) => p.toNonIndexed()));
}

/**
 * The corner posts of one gallery, all six: each fills the wedge where two
 * walls of shelves meet (or a wall of shelves meets a free side) and carries
 * the cornice round the corner.
 */
export function corners(sideIsFree: (i: number) => boolean, sides: number[]): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const half = (HEX.bays * HEX.bayW) / 2;
  const line = (phi: number, depth: number) => ({ n: new THREE.Vector2(Math.cos(phi), Math.sin(phi)), c: HEX.r - depth });
  const meet = (a: ReturnType<typeof line>, b: ReturnType<typeof line>) => {
    // Solve a.n·p = a.c, b.n·p = b.c.
    const det = a.n.x * b.n.y - a.n.y * b.n.x;
    return new THREE.Vector2((a.c * b.n.y - b.c * a.n.y) / det, (a.n.x * b.c - b.n.x * a.c) / det);
  };
  const along = (phi: number) => new THREE.Vector2(-Math.sin(phi), Math.cos(phi));
  for (let i = 0; i < 6; i++) {
    const a = i;
    const b = (i + 1) % 6;
    if (sideIsFree(a) && sideIsFree(b)) continue;
    const pa = sides[a];
    const pb = sides[b];
    const da = sideIsFree(a) ? 0 : HEX.depth;
    const db = sideIsFree(b) ? 0 : HEX.depth;
    const corner = meet(line(pa, 0), line(pb, 0));
    const front = meet(line(pa, da), line(pb, db));
    const pts: THREE.Vector2[] = [corner];
    // Wall a's last bay ends `half` along it; wall b's first bay starts `half` back.
    if (!sideIsFree(a)) {
      const ca = new THREE.Vector2(Math.cos(pa), Math.sin(pa)).multiplyScalar(HEX.r);
      const e = ca.clone().addScaledVector(along(pa), half);
      pts.push(e, e.clone().addScaledVector(new THREE.Vector2(Math.cos(pa), Math.sin(pa)), -HEX.depth));
    }
    pts.push(front);
    if (!sideIsFree(b)) {
      const cb = new THREE.Vector2(Math.cos(pb), Math.sin(pb)).multiplyScalar(HEX.r);
      const e = cb.clone().addScaledVector(along(pb), -half);
      pts.push(e.clone().addScaledVector(new THREE.Vector2(Math.cos(pb), Math.sin(pb)), -HEX.depth), e);
    }
    // The shape is drawn in (x, z); extrude it up and stand it on the floor.
    const shape = new THREE.Shape(pts.map((p) => new THREE.Vector2(p.x, -p.y)));
    const g = new THREE.ExtrudeGeometry(shape, { depth: HEX.caseTop, bevelEnabled: false });
    g.rotateX(-Math.PI / 2);
    g.setAttribute('aBake', new THREE.Float32BufferAttribute(new Array(g.attributes.position.count).fill(0.85), 1));
    parts.push(g);
  }
  return mergeGeometries(parts);
}
