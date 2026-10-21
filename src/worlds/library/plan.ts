// The plan of the library: hexagonal galleries in a line, each one's two free
// sides opening through an arch and a short vestibule into the next, a well
// through the middle of every gallery with a stair winding round it, and the
// same again on every floor above and below. Everything here is plain numbers,
// so the tests can walk the plan without a browser.
import * as THREE from 'three';

/** One gallery, in meters. Its free sides face ±z; its four walls of shelves lean in between. */
export const HEX = {
  /** Center to the middle of a wall. */
  r: 5.6,
  /** Center to a corner (and the length of each wall). */
  R: (5.6 * 2) / Math.sqrt(3),
  /** The well: its radius at the floor's edge. */
  well: 1.9,
  /** Floor to floor, and the underside of the floor above. */
  F: 5.0,
  ceiling: 4.55,
  /** The short passage from one gallery's arch to the next one's. */
  vestibule: 2.4,
  /** The arch: half its width, and the top of its round. */
  archW: 2.45,
  archTop: 4.3,
  /** The bookcases: how far they stand out from the wall, and how high they go. */
  depth: 0.42,
  caseTop: 3.95,
  /** Four bays of shelves to a wall. */
  bays: 4,
  bayW: 1.45,
  /** The two lamps, either side of the well, hanging from the ceiling. */
  lamp: new THREE.Vector3(3.35, 3.55, 0),
  /** The railing round the well. */
  rail: 0.82,
};

/** The stair in the well: where it lands on every floor (on the far side of the well from the desk, a little round), its steps to a floor, and how far in and out its treads run. */
export const STAIR = { landing: Math.PI * 0.82, steps: 24, inner: 0.95, outer: 1.84 };

/** From one gallery's center to the next. */
export const D = 2 * HEX.r + HEX.vestibule;

/** The middle of gallery k (along the line) on floor j. */
export const center = (k: number, j = 0) => new THREE.Vector3(0, j * HEX.F, k * D);

/** The six sides, by the angle their outward normal makes (from +x toward +z). Sides 1 and 4 are the free ones. */
export const SIDES = [30, 90, 150, 210, 270, 330].map((deg) => (deg * Math.PI) / 180);
export const SHELVED = [0, 2, 3, 5];
export const FREE = [1, 4];

/** Where the galleries the tour visits are, and what's in each. */
export const ROOMS = {
  /** The reading room: the desk, and the book over the well. */
  reading: 0,
  /** Medals and diplomas on a paneled wall. */
  honors: 1,
  /** The books you can read, in an alcove of their own. */
  books: 2,
  /** The map, the shirts on their line and the shoes. */
  maps: 3,
};

/** Which bays of which wall are given over to the studio: a paneled stretch (shelves only above it) or an alcove. */
export const RESERVED: { k: number; side: number; bay: number; n: number; kind: 'panel' | 'alcove' }[] = [
  { k: ROOMS.honors, side: 5, bay: 1, n: 2, kind: 'panel' },
  { k: ROOMS.books, side: 3, bay: 1, n: 2, kind: 'alcove' },
  { k: ROOMS.maps, side: 5, bay: 1, n: 2, kind: 'panel' },
];

/**
 * A place on a wall: `offset` meters along it (to the right, as you face it),
 * `depth` meters out from it into the room. Its local +z faces into the room
 * and its local +x runs along the wall to your right.
 */
export function onWall(k: number, j: number, side: number, offset: number, depth: number) {
  const phi = SIDES[side];
  const out = new THREE.Vector3(Math.cos(phi), 0, Math.sin(phi));
  const along = new THREE.Vector3(-Math.sin(phi), 0, Math.cos(phi));
  const position = center(k, j).addScaledVector(out, HEX.r - depth).addScaledVector(along, offset);
  const turn = Math.atan2(-out.x, -out.z);
  return { position, turn, out, along };
}

/** The same, as a matrix. */
export function wallMatrix(k: number, j: number, side: number, offset: number, depth: number) {
  const w = onWall(k, j, side, offset, depth);
  return new THREE.Matrix4().compose(w.position, new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), w.turn), new THREE.Vector3(1, 1, 1));
}

/** The middle of bay `bay` (0..3) along its wall. */
export const bayOffset = (bay: number) => (bay - (HEX.bays - 1) / 2) * HEX.bayW;

/**
 * Is this point inside something solid: a wall, a bookcase, the floor or the
 * ceiling? Open air (the galleries, the arches and vestibules, the well) is
 * not. For checking that the camera's walks between galleries go through the
 * arches and never through the stone.
 */
export function solid(p: THREE.Vector3, galleries = { from: -3, to: 4 }): boolean {
  const j = Math.floor(p.y / HEX.F);
  const y = p.y - j * HEX.F;
  const k = Math.round(p.z / D);
  if (k < galleries.from || k > galleries.to) return true;
  const x = p.x;
  const z = p.z - k * D;
  const rho = Math.hypot(x, z);
  // The floors, but not the well through them.
  if (y > HEX.ceiling && rho > HEX.well - 0.05) return true;
  // Inside the gallery: in front of the bookcases on every side, and clear of
  // the stair (a tread and the handrail over it, winding up one floor a turn)
  // and of the railing round the well.
  const inside = SIDES.every((phi, i) => x * Math.cos(phi) + z * Math.sin(phi) <= HEX.r - (FREE.includes(i) ? 0 : HEX.depth));
  if (inside) {
    if (rho > STAIR.inner - 0.12 && rho < STAIR.outer + 0.06) {
      const tread = (THREE.MathUtils.euclideanModulo(Math.atan2(z, x) - STAIR.landing, Math.PI * 2) / (Math.PI * 2) + 1 / STAIR.steps) * HEX.F;
      if (THREE.MathUtils.euclideanModulo(p.y - tread + 0.3, HEX.F) < 1.4) return true;
    }
    return rho > HEX.well - 0.05 && rho < HEX.well + 0.3 && y < HEX.rail + 0.15;
  }
  // In an arch or its vestibule: between the walls and under the round.
  if (Math.abs(z) >= HEX.r - 0.01 && Math.abs(x) < HEX.archW) {
    const spring = HEX.archTop - HEX.archW;
    if (y <= spring) return false;
    return Math.hypot(x, y - spring) > HEX.archW;
  }
  return true;
}

/** Does the walk from a to b (as the camera takes it: through the waypoints, or rising a little in the middle) stay in the open? */
export function clear(a: THREE.Vector3, b: THREE.Vector3, via: THREE.Vector3[] = []) {
  const pts = via.length ? [a, ...via, b] : [a, a.clone().lerp(b, 0.5).add(new THREE.Vector3(0, 0.06, 0)), b];
  const curve = new THREE.CatmullRomCurve3(
    pts.map((p) => p.clone()),
    false,
    'centripetal',
  );
  for (let i = 1; i < 80; i++) if (solid(curve.getPoint(i / 80))) return false;
  return true;
}

/**
 * The way from one gallery to another, as someone would walk it: out past the
 * well, through each arch and vestibule in turn (round the side of each well on
 * the way, never over it) and in to where you're going. Within one gallery,
 * round the well if it's in the way. From up a well, down it to the floor first.
 */
export function route(a: THREE.Vector3, b: THREE.Vector3): THREE.Vector3[] | undefined {
  const ka = Math.round(a.z / D);
  const kb = Math.round(b.z / D);
  const above = a.y - Math.floor(b.y / HEX.F) * HEX.F;
  if (above > HEX.archTop - 0.3 || above < 0) {
    // Somewhere up or down a well (on the way in, say): down the middle of it to
    // our floor first, slowing as it nears so the turn out of the well doesn't
    // swing low over the railing.
    const y = THREE.MathUtils.clamp(b.y, 1.35, 2.6) + 0.6;
    if (Math.hypot(a.x, a.z - ka * D) > STAIR.inner - 0.3 || Math.abs(y - b.y) > HEX.F * 0.8) return undefined;
    const floor = new THREE.Vector3(a.x, y, a.z);
    const slow = a.y > y + 2.4 ? [new THREE.Vector3(a.x, y + 1.8, a.z)] : [];
    return [...slow, floor, ...(route(floor, b) ?? [])];
  }
  if (ka === kb) {
    // Across the same gallery: round the well rather than through the stair, unless going into the well itself.
    const c = center(ka);
    const ra = Math.hypot(a.x, a.z - c.z);
    const rb = Math.hypot(b.x, b.z - c.z);
    if (ra < HEX.well || rb < HEX.well) return undefined;
    const ab = new THREE.Vector2(b.x - a.x, b.z - a.z);
    const t = THREE.MathUtils.clamp(-(a.x * ab.x + (a.z - c.z) * ab.y) / Math.max(ab.lengthSq(), 1e-6), 0, 1);
    const near = new THREE.Vector2(a.x + ab.x * t, a.z - c.z + ab.y * t);
    if (near.length() > HEX.well + 0.2) return undefined;
    const out = near.length() > 0.2 ? near.normalize() : new THREE.Vector2(-ab.y, ab.x).normalize();
    return [new THREE.Vector3(out.x * 2.9, THREE.MathUtils.clamp((a.y + b.y) / 2, 1.35, 1.9), c.z + out.y * 2.9)];
  }
  const dir = Math.sign(kb - ka);
  const y = THREE.MathUtils.clamp((a.y + b.y) / 2, 1.35, 1.9);
  const side = (p: THREE.Vector3) => (Math.abs(p.x) > 0.3 ? Math.sign(p.x) : 1);
  const via: THREE.Vector3[] = [];
  // Leaving: if we start on the far side of our well, come round it first.
  if ((a.z - ka * D) * dir < -0.5) via.push(new THREE.Vector3(side(a) * 2.9, y, ka * D));
  for (let k = ka; k !== kb; k += dir) {
    via.push(new THREE.Vector3(0, y, (k + dir * 0.5) * D));
    // Through each gallery between, round the side of its well.
    if (k + dir !== kb) via.push(new THREE.Vector3(side(b) * 2.9, y, (k + dir) * D));
  }
  if ((b.z - kb * D) * dir > 0.5) via.push(new THREE.Vector3(side(b) * 2.9, y, kb * D));
  return via;
}
