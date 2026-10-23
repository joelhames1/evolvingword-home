// The land, built in pieces as the train comes to it and recycled behind it,
// so it goes on for ever. The train stands still at the middle of the scene
// and each piece slides by underneath it: its own coordinates are meters along
// the line from where it starts, so nothing far out ever loses precision. A
// piece is a few meshes: the ground, what stands on it, the stone and brick of
// bridges and stations, the city's buildings, water, and its lights.
import * as THREE from 'three';
import type { DaylightUniforms } from '../outdoor';
import { pointLights } from '../outdoor';
import type { Journey, Leg } from './journey';
import { LAYOUT } from './journey';
import { BALLAST, CESS, groundOf, paint, WATER } from './ground';
import { hash, Mesher } from './mesher';
import { cityMaterial, nightMaterial, poolMaterial, waterMaterial } from './night';
import { branchZ, dress, points, track, type Build, type Fixture, type PointSpec, type Sweep } from './scenery';
import { buildClock, nameBoard, stone } from './signs';

export const CHUNK = 200;
const BEHIND = 1050;
const AHEAD = 1350;
const STEP = 5;
/** How far out from the line the ground is sampled: close together near it, far apart a long way off. */
const ZS = (() => {
  const out = [0, 1.0, 2.0, 2.5, 3.0, 3.5, 4.2, 5, 6, 7.5, 9, 11, 13.5, 16.5, 20, 25, 31, 38, 47, 58, 72, 90, 112, 140, 175, 220, 275, 340, 420, 520, 640, 780, 950, 1150, 1400];
  return [...out.slice(1).map((z) => -z).reverse(), ...out];
})();

interface Piece {
  u0: number;
  group: THREE.Group;
  /** Rebuilt for the line as it was then; built again if the line ahead changes. */
  dirty: boolean;
  built: boolean;
  lights: (THREE.Points & { fit(c: THREE.PerspectiveCamera, r: THREE.WebGLRenderer): void })[];
  sweeps: Sweep[];
  signs: THREE.Object3D[];
}

export interface Land {
  group: THREE.Group;
  /** Moves the pieces to where the train is, and builds the next one that's needed. */
  update(s: number, camera: THREE.PerspectiveCamera, renderer: THREE.WebGLRenderer): void;
  /** The line ahead has changed from here on: build it again. */
  invalidate(from: number): void;
  /** The lamps near the line within reach of the compartment's window, at track position u. */
  sweeps(): Sweep[];
  /** The stations' flap signs nearby, in the scene. */
  signs(): THREE.Object3D[];
  /** The ground height at u, z (for things that move over it). */
  ground(u: number, z: number): number;
  pieces(): number;
  clock: ReturnType<typeof buildClock>;
}

/**
 * A mesher's triangles in up to three meshes: the window side, the line itself,
 * and the corridor side, so whichever side is behind the camera isn't drawn.
 */
function halves(m: Mesher): THREE.BufferGeometry[] {
  if (m.empty) return [];
  const parts = [new Mesher(), new Mesher(), new Mesher()];
  const n = m.pos.length / 9;
  for (let t = 0; t < n; t++) {
    const z = (m.pos[t * 9 + 2] + m.pos[t * 9 + 5] + m.pos[t * 9 + 8]) / 3;
    const into = parts[z < -6 ? 0 : z > 6 ? 2 : 1];
    for (let k = 0; k < 3; k++) {
      const i = t * 3 + k;
      into.pos.push(m.pos[i * 3], m.pos[i * 3 + 1], m.pos[i * 3 + 2]);
      into.nrm.push(m.nrm[i * 3], m.nrm[i * 3 + 1], m.nrm[i * 3 + 2]);
      into.col.push(m.col[i * 3], m.col[i * 3 + 1], m.col[i * 3 + 2]);
      into.glow.push(m.glow[i * 3], m.glow[i * 3 + 1], m.glow[i * 3 + 2]);
      into.uv.push(m.uv[i * 2], m.uv[i * 2 + 1]);
    }
  }
  return parts.filter((p) => !p.empty).map((p) => p.geometry());
}

export function buildLand(opts: { journey: Journey; uniforms: DaylightUniforms; flapTexture: THREE.Texture }): Land {
  const { journey, uniforms } = opts;
  const group = new THREE.Group();
  group.name = 'land';
  const mats = {
    terrain: nightMaterial(uniforms, { vertexColors: true, sheen: 0.18 }),
    decor: nightMaterial(uniforms, { vertexColors: true, glows: true }),
    stone: nightMaterial(uniforms, { vertexColors: true, map: stone('ashlar'), mapScale: 0.42, side: THREE.DoubleSide }),
    brick: nightMaterial(uniforms, { vertexColors: true, map: stone('brick'), mapScale: 0.36, side: THREE.DoubleSide }),
    rock: nightMaterial(uniforms, { vertexColors: true, map: stone('rock'), mapScale: 0.2, side: THREE.DoubleSide }),
    city: cityMaterial(uniforms),
    pools: poolMaterial(uniforms),
    water: waterMaterial(uniforms),
  };
  const clock = buildClock();
  const flapMat = new THREE.MeshBasicMaterial({ map: opts.flapTexture, color: new THREE.Color(0.72, 0.7, 0.66) });
  const clockMat = new THREE.MeshBasicMaterial({ map: clock.texture, transparent: true, color: new THREE.Color(0.8, 0.78, 0.72) });
  const nameMats = new Map<string, THREE.MeshBasicMaterial>();
  const nameMat = (name: string) => {
    let m = nameMats.get(name);
    if (!m) nameMats.set(name, (m = new THREE.MeshBasicMaterial({ map: nameBoard(name), color: new THREE.Color(0.62, 0.62, 0.66) })));
    return m;
  };

  // How much a stretch shapes the land at u.
  const weight = (leg: Leg, u: number) => {
    for (const { leg: l, w } of journey.weights(u)) if (l.start === leg.start && l.land === leg.land) return w;
    return 0;
  };

  /** The ground at u, z: the stretches there blended. */
  const base = (u: number, z: number) => {
    let h = 0;
    for (const { leg, w } of journey.weights(u)) h += groundOf(leg, u, z) * w;
    return h;
  };
  /** How far past each junction its other line runs: until the land gets too rough to lay it (a gorge, a lake). */
  const ends = new Map<number, number>();
  const branchEnd = (j: number) => {
    let e = ends.get(j);
    if (e !== undefined) return e;
    e = 0;
    while (e < 360) {
      const h = base(j + e + 10, branchZ(e + 10));
      if (Math.abs(h - CESS) > 5 || h < -3.2) break;
      e += 10;
    }
    if (ends.size > 40) ends.clear();
    ends.set(j, e);
    return e;
  };
  /** ...and with the other line at the junctions cut through it, on its own little embankment or cutting. */
  const ground = (u: number, z: number) => {
    let h = base(u, z);
    for (const l of journey.legs) {
      const d = u - l.end;
      if (d < 0 || d > 420) continue;
      const zb = branchZ(d);
      const dz = Math.abs(z - zb);
      if (zb > -2.5 || dz > 30) continue;
      const end = branchEnd(l.end);
      if (d > end + 20) continue;
      const k = 1 - Math.max(0, (d - end) / 20);
      const bed = dz < 2 ? BALLAST : dz < 3 ? BALLAST + (CESS - BALLAST) * (dz - 2) : Math.min(CESS + (dz - 3), Math.max(CESS - (dz - 3) / 1.5, h));
      h += (bed - h) * k;
    }
    return h;
  };
  /** Clear of the other lines by r? */
  const free = (u: number, z: number, r: number) => {
    for (const l of journey.legs) {
      const d = u - l.end;
      if (d < -r || d > 380 + r) continue;
      if (d > branchEnd(l.end) + r) continue;
      if (Math.abs(z - branchZ(Math.max(0, d))) < r + 3) return false;
    }
    return true;
  };

  const tmpC = new THREE.Color();
  const tmpD = new THREE.Color();

  /** The ground's mesh for one piece, normals from its neighbors so there's no seam between pieces. */
  function terrain(u0: number) {
    const cols = CHUNK / STEP + 3;
    const rows = ZS.length;
    const H = new Float32Array(cols * rows);
    for (let i = 0; i < cols; i++) {
      const u = u0 + (i - 1) * STEP;
      for (let j = 0; j < rows; j++) H[i * rows + j] = ground(u, ZS[j]);
    }
    const nCols = cols - 2;
    const pos = new Float32Array(nCols * rows * 3);
    const nrm = new Float32Array(nCols * rows * 3);
    const col = new Float32Array(nCols * rows * 3);
    const n = new THREE.Vector3();
    for (let i = 1; i <= nCols; i++) {
      const u = u0 + (i - 1) * STEP;
      const ws = journey.weights(u);
      for (let j = 0; j < rows; j++) {
        const z = ZS[j];
        const h = H[i * rows + j];
        const k = ((i - 1) * rows + j) * 3;
        pos[k] = (i - 1) * STEP;
        pos[k + 1] = h;
        pos[k + 2] = z;
        const dhu = (H[(i + 1) * rows + j] - H[(i - 1) * rows + j]) / (2 * STEP);
        const ja = Math.max(0, j - 1);
        const jb = Math.min(rows - 1, j + 1);
        const dhz = (H[i * rows + jb] - H[i * rows + ja]) / (ZS[jb] - ZS[ja]);
        n.set(-dhu, 1, -dhz).normalize();
        nrm[k] = n.x;
        nrm[k + 1] = n.y;
        nrm[k + 2] = n.z;
        const slope = Math.min(2, Math.hypot(dhu, dhz));
        tmpC.setRGB(0, 0, 0);
        for (const { leg, w } of ws) {
          paint(tmpD, leg, u, z, h, slope);
          tmpC.r += tmpD.r * w;
          tmpC.g += tmpD.g * w;
          tmpC.b += tmpD.b * w;
        }
        col[k] = tmpC.r;
        col[k + 1] = tmpC.g;
        col[k + 2] = tmpC.b;
      }
    }
    // Two meshes, one each side of the line (sharing the row under it), so the side behind the camera isn't drawn.
    const mid = ZS.indexOf(0);
    return [
      [0, mid],
      [mid, rows - 1],
    ].map(([j0, j1]) => {
      const n = j1 - j0 + 1;
      const p2 = new Float32Array(nCols * n * 3);
      const n2 = new Float32Array(nCols * n * 3);
      const c2 = new Float32Array(nCols * n * 3);
      for (let i = 0; i < nCols; i++)
        for (let j = j0; j <= j1; j++) {
          const from = (i * rows + j) * 3;
          const to = (i * n + (j - j0)) * 3;
          for (let q = 0; q < 3; q++) {
            p2[to + q] = pos[from + q];
            n2[to + q] = nrm[from + q];
            c2[to + q] = col[from + q];
          }
        }
      const index: number[] = [];
      for (let i = 0; i < nCols - 1; i++)
        for (let j = 0; j < n - 1; j++) {
          const a = i * n + j;
          const b = (i + 1) * n + j;
          index.push(a, a + 1, b, b, a + 1, b + 1);
        }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(p2, 3));
      geo.setAttribute('normal', new THREE.BufferAttribute(n2, 3));
      geo.setAttribute('color', new THREE.BufferAttribute(c2, 3));
      geo.setIndex(index);
      geo.computeBoundingSphere();
      return new THREE.Mesh(geo, mats.terrain);
    });
  }

  /** A sheet of water across the piece at a stretch's water level, its uvs where it is along the land. */
  function water(u0: number, level: number, z0: number, z1: number) {
    const geo = new THREE.PlaneGeometry(CHUNK, z1 - z0, 1, 1);
    geo.rotateX(-Math.PI / 2);
    geo.translate(CHUNK / 2, level, (z0 + z1) / 2);
    const uv = geo.attributes.uv as THREE.BufferAttribute;
    const base = ((u0 % 4000) + 4000) % 4000;
    for (let i = 0; i < uv.count; i++) {
      const px = geo.attributes.position.getX(i);
      const pz = geo.attributes.position.getZ(i);
      uv.setXY(i, base + px, pz);
    }
    return new THREE.Mesh(geo, mats.water);
  }

  function build(piece: Piece) {
    const u0 = piece.u0;
    const u1 = u0 + CHUNK;
    const out = new THREE.Group();
    const lights: PointSpec[] = [];
    const sweeps: Sweep[] = [];
    const fixtures: Fixture[] = [];
    const b: Build = {
      u0,
      u1,
      ground,
      weight,
      decor: new Mesher(),
      stone: new Mesher(),
      brick: new Mesher(),
      rock: new Mesher(),
      city: new Mesher(),
      pools: new Mesher(),
      lights,
      sweeps,
      fixtures,
      free,
      mine(leg, u, salt) {
        if (u < u0 || u >= u1) return false;
        const w = weight(leg, u);
        if (w >= 0.999) return true;
        if (w <= 0.001) return false;
        return hash(Math.floor(u * 3.7), salt, leg.seed) < w;
      },
    };
    out.add(...terrain(u0));
    // Every stretch that reaches this piece dresses its part of it.
    const legs = journey.legs.filter((l) => l.end > u0 - 200 && l.start < u1 + 200);
    for (const leg of legs) dress(b, leg);
    // The line itself, and the junctions' other lines.
    track(b, u0, u1);
    for (const l of legs) points(b, l.end, branchEnd(l.end));
    for (const [m, mat] of [
      [b.decor, mats.decor],
      [b.stone, mats.stone],
      [b.brick, mats.brick],
      [b.rock, mats.rock],
      [b.city, mats.city],
      [b.pools, mats.pools],
    ] as const)
      for (const geo of halves(m)) {
        const mesh = new THREE.Mesh(geo, mat);
        if (m === b.pools) mesh.renderOrder = 2;
        out.add(mesh);
      }
    // Water, where a stretch has it.
    for (const leg of legs) {
      const w0 = weight(leg, u0);
      const w1 = weight(leg, u1 - 1);
      if (Math.max(w0, w1) < 0.02) continue;
      if (leg.land === 'gorge') out.add(water(u0, WATER.gorge, -1400, 0), water(u0, WATER.gorge, 0, 1400));
      if (leg.land === 'lake') out.add(water(u0, WATER.lake, -1400, -4));
    }
    // The stations' signs and clocks.
    const signs: THREE.Object3D[] = [];
    for (const f of fixtures) {
      const geo = f.kind === 'clock' ? new THREE.CircleGeometry(f.w / 2, 32) : new THREE.PlaneGeometry(f.w, f.h);
      const mesh = new THREE.Mesh(geo, f.kind === 'flap' ? flapMat : f.kind === 'clock' ? clockMat : nameMat(f.name ?? ''));
      mesh.position.set(f.u - u0, f.y, f.z);
      out.add(mesh);
      if (f.kind === 'flap') signs.push(mesh);
    }
    const pts = lights.length ? pointLights(lights, uniforms) : null;
    if (pts) out.add(pts);
    // Swap the new for the old.
    for (const old of [...piece.group.children]) {
      piece.group.remove(old);
      old.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.geometry) m.geometry.dispose();
        // (Materials are shared; only the lights' own are thrown away.)
        if ((o as THREE.Points).isPoints) ((o as THREE.Points).material as THREE.Material).dispose();
      });
    }
    for (const c of [...out.children]) piece.group.add(c);
    piece.lights = pts ? [pts] : [];
    piece.sweeps = sweeps;
    piece.signs = signs;
    piece.built = true;
    piece.dirty = false;
  }

  const pool: Piece[] = [];
  const count = Math.ceil((BEHIND + AHEAD) / CHUNK) + 2;
  for (let i = 0; i < count; i++) {
    const g = new THREE.Group();
    g.visible = false;
    group.add(g);
    pool.push({ u0: NaN, group: g, dirty: false, built: false, lights: [], sweeps: [], signs: [] });
  }
  let first = true;

  return {
    group,
    clock,
    ground,
    update(s, camera, renderer) {
      const k0 = Math.floor((s - BEHIND) / CHUNK);
      const k1 = Math.floor((s + AHEAD) / CHUNK);
      const want = new Set<number>();
      for (let k = k0; k <= k1; k++) want.add(k * CHUNK);
      // Pieces no longer wanted are free; wanted starts without a piece take one.
      for (const p of pool) if (!want.has(p.u0)) p.u0 = NaN;
      const have = new Set(pool.filter((p) => !Number.isNaN(p.u0)).map((p) => p.u0));
      for (const u0 of want) {
        if (have.has(u0)) continue;
        const p = pool.find((q) => Number.isNaN(q.u0));
        if (!p) break;
        p.u0 = u0;
        p.built = false;
        p.dirty = true;
        p.group.visible = false;
      }
      // Build what's needed: everything at once the first time, then one piece a frame, nearest first.
      const todo = pool.filter((p) => !Number.isNaN(p.u0) && p.dirty).sort((a, b) => Math.abs(a.u0 + CHUNK / 2 - s) - Math.abs(b.u0 + CHUNK / 2 - s));
      for (const p of first ? todo : todo.slice(0, 1)) build(p);
      first = false;
      for (const p of pool) {
        const live = !Number.isNaN(p.u0) && p.built;
        p.group.visible = live;
        if (!live) continue;
        p.group.position.x = p.u0 - s;
        for (const l of p.lights) l.fit(camera, renderer);
      }
    },
    invalidate(from) {
      for (const p of pool) if (!Number.isNaN(p.u0) && p.u0 + CHUNK > from) p.dirty = true;
    },
    sweeps() {
      const out: Sweep[] = [];
      for (const p of pool) if (p.built && !Number.isNaN(p.u0)) out.push(...p.sweeps);
      return out;
    },
    signs() {
      const out: THREE.Object3D[] = [];
      for (const p of pool) if (p.built && !Number.isNaN(p.u0)) out.push(...p.signs);
      return out;
    },
    pieces: () => pool.filter((p) => p.built && !Number.isNaN(p.u0)).length,
  };
}

export { LAYOUT };
