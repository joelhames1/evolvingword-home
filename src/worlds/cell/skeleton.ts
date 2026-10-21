// The cell's scaffolding, which is also its architecture: microtubules rising
// like columns, ribbed along their length, actin filaments arching overhead like
// vaulting, and fine threads to hang things from. A kinesin walks one of them
// hand over hand with a vesicle on its back. And the soft pads the studio's
// pieces rest on: flattened sacs of membrane, lit from within.
import * as THREE from 'three';
import { rng } from '../../textures';
import { CELL, glass, metersAlong, pearl } from './shaders';

const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

/** Microtubules: thirteen ribs round, a bump every eight centimeters along. */
export const tubulin = () => pearl({ color: '#553634', edge: '#ffb488', glow: 0.02, ribs: [13, 12] });
/** Actin: two strands wound round each other. */
export const actin = () => pearl({ color: '#8a4a44', edge: '#ff9a7a', glow: 0.06, ribs: [2, 0], twist: 3.2 });

/** A filament along a curve, its ribs scaled to its length. */
export function filament(points: THREE.Vector3[], radius: number, mat: THREE.Material, radial = 14) {
  const curve = new THREE.CatmullRomCurve3(points);
  const len = curve.getLength();
  const geo = metersAlong(new THREE.TubeGeometry(curve, Math.max(16, Math.round(len * 6)), radius, radial, false), len);
  return new THREE.Mesh(geo, mat);
}

/** How far up and down a vertical line at (x, z) runs before it meets the cell wall. */
export function reach(x: number, z: number) {
  const dx = x - CELL.center.x;
  const dz = z - CELL.center.z;
  const h = Math.sqrt(Math.max(0, CELL.radius * CELL.radius - dx * dx - dz * dz));
  return [CELL.center.y - h * 0.98, CELL.center.y + h * 0.98];
}

/** The part of the line from a to b that's inside the cell (with a little room to spare). */
export function clip(a: THREE.Vector3, b: THREE.Vector3, room = 0.4): [THREE.Vector3, THREE.Vector3] {
  const d = b.clone().sub(a);
  const len = d.length();
  d.normalize();
  const oc = a.clone().sub(CELL.center);
  const k = oc.dot(d);
  const R = CELL.radius - room;
  const h = Math.sqrt(Math.max(0, k * k - (oc.lengthSq() - R * R)));
  const t0 = Math.max(0, -k - h);
  const t1 = Math.min(len, -k + h);
  return [a.clone().addScaledVector(d, t0), a.clone().addScaledVector(d, t1)];
}

/** A column: a microtubule from the bottom of the cell to the top, leaning and bending a little. */
export function column(x: number, z: number, radius: number, mat: THREE.Material, seed: number) {
  const r = rng(seed);
  const [y0, y1] = reach(x, z);
  const pts: THREE.Vector3[] = [];
  const lean = v((r() - 0.5) * 0.06, 0, (r() - 0.5) * 0.06);
  for (let i = 0; i <= 8; i++) {
    const y = y0 + ((y1 - y0) * i) / 8;
    const k = (y - 1.5) / 10;
    pts.push(v(x + lean.x * (y - 1.5) * 10 * k + Math.sin(i * 1.3 + seed) * 0.08, y, z + lean.z * (y - 1.5) * 10 * k + Math.cos(i * 1.1 + seed) * 0.08));
  }
  return filament(pts, radius, mat);
}

/** An arch of actin from one point to another, rising to a crown between them. */
export function arch(a: THREE.Vector3, b: THREE.Vector3, rise: number, radius: number, mat: THREE.Material) {
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= 12; i++) {
    const k = i / 12;
    const p = a.clone().lerp(b, k);
    p.y += Math.sin(k * Math.PI) * rise;
    pts.push(p);
  }
  return filament(pts, radius, mat, 8);
}

/** A thin glowing thread, straight from a to b, for hanging things. */
export function thread(a: THREE.Vector3, b: THREE.Vector3, mat: THREE.Material, radius = 0.0035) {
  const len = a.distanceTo(b);
  const m = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, len, 5, 1, true), mat);
  m.position.copy(a).lerp(b, 0.5);
  m.quaternion.setFromUnitVectors(v(0, 1, 0), b.clone().sub(a).normalize());
  return m;
}

/**
 * A soft pad for things to rest on: a flattened sac of membrane, flat on top so
 * legs sit on it, its rim rolled under. Lit by the room's lights like the studio's
 * pieces, and glowing faintly from inside.
 */
export function pad(radius: number, color = '#2a1216', glowColor = '#ff8a5a') {
  const prof: THREE.Vector2[] = [new THREE.Vector2(0, 0)];
  const flat = radius - 0.2;
  for (let i = 1; i <= 8; i++) prof.push(new THREE.Vector2((flat * i) / 8, -0.003 * i * i * 0.1));
  for (let i = 1; i <= 14; i++) {
    const a = (i / 14) * Math.PI;
    prof.push(new THREE.Vector2(flat + Math.sin(a) * 0.2, -0.02 - (1 - Math.cos(a)) * 0.09));
  }
  prof.push(new THREE.Vector2(flat * 0.6, -0.22), new THREE.Vector2(0, -0.24));
  // Soft rather than glossy: a shiny rolled edge catches the light all round and reads as the lip of a bowl.
  const m = new THREE.Mesh(new THREE.LatheGeometry(prof, 96), new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.05, emissive: glowColor, emissiveIntensity: 0.06 }));
  m.receiveShadow = true;
  // The rolled rim, lit from within: a seam of light round its side, below the top.
  const rim = new THREE.Mesh(new THREE.TorusGeometry(flat + 0.16, 0.06, 10, 96), glass({ color: glowColor, edge: '#ffc09a', core: 0.04, rim: 0.4, power: 2.4 }));
  rim.rotation.x = Math.PI / 2;
  rim.position.y = -0.13;
  m.add(rim);
  return m;
}

export interface Walker {
  group: THREE.Group;
  /** Where along its track it is, 0..1. */
  progress(): number;
  /** Hurry up for a bit. */
  hurry(): void;
  tick(t: number, dt: number): void;
}

/**
 * A kinesin, walking a straight track hand over hand: the back head lifts, swings
 * past the front one and lands a step ahead. Its stalk carries a vesicle, which
 * bobs along a moment behind.
 */
export function buildKinesin(from: THREE.Vector3, to: THREE.Vector3, opts: { scale?: number; cargo?: number; color?: string } = {}): Walker {
  const s = opts.scale ?? 1;
  const group = new THREE.Group();
  const headMat = pearl({ color: opts.color ?? '#9fe3d6', edge: '#d8fff4', glow: 0.18 });
  const stalkMat = pearl({ color: '#b8d8cc', edge: '#e8fff6', glow: 0.1 });
  const headGeo = new THREE.SphereGeometry(0.055 * s, 20, 14);
  headGeo.scale(1.25, 0.9, 0.9);
  const heads = [new THREE.Mesh(headGeo, headMat), new THREE.Mesh(headGeo, headMat)];
  for (const h of heads) {
    // A smaller lobe on each, so they read as proteins rather than balls.
    const lobe = new THREE.Mesh(new THREE.SphereGeometry(0.03 * s, 14, 10), headMat);
    lobe.position.set(0.03 * s, 0.035 * s, 0.01 * s);
    h.add(lobe);
    group.add(h);
  }
  // Neck linkers from each head up to the top of the stalk's coiled coil.
  const necks = [0, 1].map(() => {
    const n = new THREE.Mesh(new THREE.CylinderGeometry(0.008 * s, 0.008 * s, 1, 6), stalkMat);
    group.add(n);
    return n;
  });
  const stalkLen = 0.42 * s;
  const stalk = new THREE.Group();
  for (const side of [-1, 1]) {
    const pts = Array.from({ length: 13 }, (_, i) => v(Math.cos(i * 1.4) * 0.008 * s * side, (i / 12) * stalkLen, Math.sin(i * 1.4) * 0.008 * s * side));
    stalk.add(filament(pts, 0.007 * s, stalkMat, 6));
  }
  group.add(stalk);
  const cargoR = (opts.cargo ?? 0.26) * s;
  const cargo = new THREE.Mesh(new THREE.IcosahedronGeometry(cargoR, 4), glass({ color: '#ffb36a', edge: '#ffd09a', core: 0.12, rim: 1.0, power: 1.8 }));
  const freight = new THREE.Mesh(new THREE.IcosahedronGeometry(cargoR * 0.45, 2), glass({ color: '#ff7a8a', edge: '#ffa0a0', core: 0.4, rim: 0.6, power: 1.4 }));
  cargo.add(freight);
  group.add(cargo);

  const dir = to.clone().sub(from);
  const length = dir.length();
  dir.normalize();
  const side = new THREE.Vector3().crossVectors(dir, v(0, 1, 0)).normalize();
  const step = 0.13 * s;
  let at = 0;
  let speed = 1;
  let hurryUntil = -1;
  let now = 0;
  // Where each foot is along the track, in meters.
  const feet = [0, step];
  let lifting = 0;
  let phase = 0;
  const cargoAt = from.clone().add(v(0, stalkLen + cargoR, 0));
  const pos = (d: number) => from.clone().addScaledVector(dir, d);
  const up = v(0, 1, 0);
  const place = (n: THREE.Mesh, a: THREE.Vector3, b: THREE.Vector3) => {
    n.position.copy(a).lerp(b, 0.5);
    n.scale.set(1, Math.max(1e-3, a.distanceTo(b)), 1);
    n.quaternion.setFromUnitVectors(up, b.clone().sub(a).normalize());
  };
  return {
    group,
    progress: () => at / length,
    hurry() {
      hurryUntil = now + 4;
    },
    tick(t, dt) {
      now = t;
      speed += ((t < hurryUntil ? 3.2 : 1) - speed) * Math.min(1, dt * 2);
      // Swing the back foot past the front one: half a second a step, a little rest between.
      phase += dt * speed * 1.6;
      if (phase >= 1) {
        phase -= 1;
        feet[lifting] = feet[1 - lifting] + step;
        lifting = 1 - lifting;
      }
      const swing = Math.min(1, phase / 0.7);
      const e = swing * swing * (3 - 2 * swing);
      const back = feet[lifting];
      const front = feet[1 - lifting];
      const moving = back + (front + step - back) * e;
      at = (moving + front) / 2;
      // At the end of the track, start again from the other end, unseen in the haze.
      if (at > length) {
        feet[0] = 0;
        feet[1] = step;
        lifting = 0;
        phase = 0;
        at = 0;
        cargoAt.copy(from).add(v(0, stalkLen + cargoR, 0));
      }
      const lift = Math.sin(e * Math.PI) * 0.06 * s;
      const a = pos(moving).addScaledVector(up, 0.05 * s + lift).addScaledVector(side, (lifting ? 1 : -1) * 0.025 * s);
      const b = pos(front).addScaledVector(up, 0.05 * s).addScaledVector(side, (lifting ? -1 : 1) * 0.025 * s);
      heads[lifting].position.copy(a);
      heads[1 - lifting].position.copy(b);
      heads[lifting].rotation.z = -Math.sin(e * Math.PI) * 0.5;
      heads[1 - lifting].rotation.z = 0;
      const hip = pos(at).addScaledVector(up, 0.13 * s + lift * 0.3);
      place(necks[lifting], a, hip);
      place(necks[1 - lifting], b, hip);
      // The vesicle rides on top, a moment behind, and the stalk leans to follow it.
      const want = hip.clone().addScaledVector(up, stalkLen + cargoR * 0.9);
      // (Eased toward where it should be, so it lags a little and never runs away, whatever the frame rate.)
      cargoAt.lerp(want, 1 - Math.exp(-dt * 7));
      stalk.position.copy(hip);
      stalk.quaternion.setFromUnitVectors(up, cargoAt.clone().sub(hip).normalize());
      cargo.position.copy(cargoAt);
      freight.position.set(Math.sin(t * 0.7) * cargoR * 0.2, Math.cos(t * 0.5) * cargoR * 0.15, 0);
    },
  };
}
