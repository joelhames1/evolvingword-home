// The plan of the greenhouse: a long Victorian glasshouse against an old brick
// garden wall, the glass coming up from a low brick wall at the front and
// curving over into the roof. The potting bench stands under the front glass in
// the middle; the staging for the flowers runs along the front to its left;
// ferns and the compost to its right; the brick wall at the back holds the
// prizes, the seed drawers and the plant hunter's map, with the shirts and the
// herbs drying at its far end. Everything here is plain numbers, so the tests
// can walk the plan without a browser.
import * as THREE from 'three';

const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

/** The house, in meters. The front glass faces −z, toward the garden and the low sun. */
export const HOUSE = {
  x0: -6,
  x1: 6,
  /** The front glass, and the face of the brick wall at the back. */
  front: -2.2,
  back: 2.8,
  /** The brick wall the front glass stands on. */
  knee: 0.75,
  /** Where the front glass starts to curve over, and where the curve meets the straight roof. */
  bend: 2.0,
  eave: { z: -1.3, y: 3.05 },
  ridge: { z: 1.6, y: 4.7 },
  /** Where the short back slope meets the brick wall. */
  wallTop: 4.25,
  /** Ribs every so far along the house. */
  bay: 1.2,
  /** The door, in the right-hand end: its middle (z), half its width, its height. */
  door: { z: 0.55, half: 0.55, h: 2.25 },
};

/** Toward the sun: low in the garden, ahead and to the left of the desk. Golden hour. */
export const SUN = v(-Math.sin(0.66) * Math.cos(0.245), Math.sin(0.245), -Math.cos(0.66) * Math.cos(0.245)).normalize();

/** The roof's height over a point z across the house (the glass's inside face). */
export function roofY(z: number) {
  const { front, bend, eave, ridge, back, wallTop } = HOUSE;
  if (z <= front) return HOUSE.knee;
  if (z < eave.z) {
    // The curved eave: a quadratic from the top of the upright glass to the
    // straight roof, tangent to both. Solve for its parameter along z.
    const cy = eave.y - ((ridge.y - eave.y) / (ridge.z - eave.z)) * (eave.z - front);
    const k = Math.sqrt(THREE.MathUtils.clamp((z - front) / (eave.z - front), 0, 1));
    const a = (1 - k) * (1 - k);
    return a * bend + 2 * (1 - k) * k * cy + k * k * eave.y;
  }
  if (z < ridge.z) return eave.y + ((ridge.y - eave.y) * (z - eave.z)) / (ridge.z - eave.z);
  return ridge.y + ((wallTop - ridge.y) * (z - ridge.z)) / (back - ridge.z);
}

/** Points along the glass, front to back: the upright front, the curve and the roof (z, y), for building the ribs and the glass. */
export function profile(steps = 10): THREE.Vector2[] {
  const { front, knee, bend, eave, ridge, back, wallTop } = HOUSE;
  const out = [new THREE.Vector2(front, knee), new THREE.Vector2(front, bend)];
  const cy = eave.y - ((ridge.y - eave.y) / (ridge.z - eave.z)) * (eave.z - front);
  for (let i = 1; i <= steps; i++) {
    const k = i / steps;
    const z = (1 - k) * (1 - k) * front + 2 * (1 - k) * k * front + k * k * eave.z;
    const y = (1 - k) * (1 - k) * bend + 2 * (1 - k) * k * cy + k * k * eave.y;
    out.push(new THREE.Vector2(z, y));
  }
  out.push(new THREE.Vector2(ridge.z, ridge.y), new THREE.Vector2(back, wallTop));
  return out;
}

/** The staging: two tiers of eight pots along the front, left of the potting bench. */
export const STAGING = {
  x0: -5.8,
  x1: -1.95,
  front: { z: -1.36, y: 0.7, x: -5.55 },
  back: { z: -1.84, y: 0.98, x: -5.33 },
  pitch: 0.44,
};
/** Where each pot stands (its foot, on the shelf): 0..7 the front tier left to right, 8..15 the back. */
export const POT_AT = Array.from({ length: 16 }, (_, i) => {
  const tier = i < 8 ? STAGING.front : STAGING.back;
  return v(tier.x + (i % 8) * STAGING.pitch, tier.y, tier.z);
});
/** A pot: its height and the radius of its rim. */
export const POT = { h: 0.15, r: 0.085 };

/** The bench across the aisle from the staging, for ferns and the like, and the compost bin before it. */
export const FERNS = { x0: 2.95, x1: 5.8, z0: -2.12, z1: -1.2, y: 0.82 };
export const COMPOST = v(2.35, 0, -1.6);

/** Along the brick wall at the back: where each of the studio's pieces hangs or stands (its middle, x). */
export const WALL = { line: -4.85, map: -2.7, shelf: 0.05, drawers: 1.35, honors: 3.55 };

/**
 * The solid things in the house the camera must keep clear of, as boxes:
 * [x0, y0, z0, x1, y1, z1]. The glass, the brick and the ground are handled
 * separately (see solid).
 */
export const BLOCKS: [number, number, number, number, number, number][] = [
  // The potting bench (the desk), the CRT's brick pier and the things on top.
  [-1.78, 0, -1.99, 1.78, 0.98, -1.17],
  [-0.62, 0, -2.2, 0.38, 1.5, -1.72],
  // The staging and the flowers on it (up to the tallest stem).
  [STAGING.x0, 0, -2.2, STAGING.x1, 1.75, -1.12],
  [STAGING.x0, 0, -2.2, STAGING.x1, 1.95, -1.6],
  // The fern bench and the compost bin.
  [FERNS.x0, 0, -2.2, FERNS.x1, 1.55, FERNS.z1],
  [COMPOST.x - 0.36, 0, COMPOST.z - 0.36, COMPOST.x + 0.36, 0.8, COMPOST.z + 0.36],
  // Along the back wall: the line with the shirts and herbs, the map, the shelf, the drawers, the honors.
  [WALL.line - 0.95, 1.4, 2.25, WALL.line + 0.95, 2.95, 2.8],
  [WALL.map - 0.85, 1.15, 2.6, WALL.map + 0.85, 2.1, 2.8],
  [WALL.shelf - 0.8, 0, 2.45, WALL.shelf + 0.8, 2.15, 2.8],
  [WALL.drawers - 0.45, 0, 2.4, WALL.drawers + 0.45, 1.45, 2.8],
  [WALL.honors - 1.35, 1.25, 2.62, WALL.honors + 1.35, 2.1, 2.8],
  // The watering can by the bench, and the tree fern by the door.
  [-2.15, 0, -1.15, -1.6, 0.42, -0.55],
  [4.75, 0, 1.25, 5.85, 3.2, 2.35],
];

/** Hanging baskets under the roof: their middle and how far their trails reach. */
export const BASKETS: { at: THREE.Vector3; r: number }[] = [
  { at: v(-3.6, 2.95, -0.55), r: 0.42 },
  { at: v(-0.95, 3.15, 0.15), r: 0.42 },
  { at: v(2.15, 3.05, -0.35), r: 0.42 },
  { at: v(4.6, 2.95, -0.6), r: 0.42 },
];

const inBox = (p: THREE.Vector3, b: (typeof BLOCKS)[number], pad = 0) => p.x > b[0] - pad && p.x < b[3] + pad && p.y > b[1] - pad && p.y < b[4] + pad && p.z > b[2] - pad && p.z < b[5] + pad;

/** In the house's own footprint (between its glass and its brick), give or take. */
const underRoof = (p: THREE.Vector3, pad = 0) => p.x > HOUSE.x0 - pad && p.x < HOUSE.x1 + pad && p.z > HOUSE.front - pad && p.z < HOUSE.back + pad;

/**
 * Is this point somewhere the camera mustn't be: in the glass or the brick, in
 * something in the house, under the ground? Out in the garden is open air
 * (above the lawn), and so is the doorway. `pad` keeps that much air round it.
 */
export function solid(p: THREE.Vector3, pad = 0): boolean {
  if (p.y < 0.05 + pad) return true;
  const inside = underRoof(p, -pad) && p.y < roofY(p.z) - pad;
  if (inside) return BLOCKS.some((b) => inBox(p, b, pad)) || BASKETS.some((k) => p.distanceTo(k.at) < k.r + pad);
  // Outside, or in the shell itself: the doorway is open, the rest of the shell isn't.
  const { door } = HOUSE;
  if (Math.abs(p.x - HOUSE.x1) < 0.5 && Math.abs(p.z - door.z) < door.half - pad && p.y < door.h - pad) return false;
  if (underRoof(p, 0.25 + pad) && p.y < roofY(THREE.MathUtils.clamp(p.z, HOUSE.front, HOUSE.back)) + 0.25 + pad) return true;
  // Beyond the wall at the back is the rest of the garden wall.
  if (p.z > HOUSE.back - pad && p.z < HOUSE.back + 0.6 + pad && p.y < HOUSE.wallTop + 0.5 && p.x > HOUSE.x0 - 8 && p.x < HOUSE.x1 + 8) return true;
  return false;
}

/** Does the walk from a to b (as the camera takes it: through the waypoints, or rising a little in the middle) keep `pad` of air round it all the way? */
export function clear(a: THREE.Vector3, b: THREE.Vector3, via: THREE.Vector3[] = [], pad = 0.04) {
  const pts = via.length ? [a, ...via, b] : [a, a.clone().lerp(b, 0.5).add(v(0, 0.06, 0)), b];
  const curve = new THREE.CatmullRomCurve3(
    pts.map((p) => p.clone()),
    false,
    'centripetal',
  );
  const n = Math.max(80, Math.ceil(curve.getLength() / 0.03));
  for (let i = 1; i < n; i++) if (solid(curve.getPoint(i / n), pad)) return false;
  return true;
}

/** The aisle down the middle of the house: the line walks keep to, and its height. */
export const AISLE = { z: 0.3, y: 1.55 };
/** The doorway, just outside and just in. */
export const DOOR_OUT = v(HOUSE.x1 + 1.6, 1.55, HOUSE.door.z);
export const DOOR_IN = v(HOUSE.x1 - 0.9, 1.55, HOUSE.door.z);

/** In the open middle of the house, where a walk along the aisle can start. */
const open = (p: THREE.Vector3) => underRoof(p, -0.3) && p.z > -0.95 && p.z < 1.75 && p.y > 0.9 && p.y < 2.6;
/** Out in the garden. */
const outdoors = (p: THREE.Vector3) => !underRoof(p, 0.1) || p.y > roofY(THREE.MathUtils.clamp(p.z, HOUSE.front, HOUSE.back)) + 0.3;

/** Out of a close-up into the aisle: straight back from it (up a little first if it's low over the bench). */
function stepOut(p: THREE.Vector3): THREE.Vector3[] {
  const y = THREE.MathUtils.clamp(p.y, 1.35, 2.0);
  const out: THREE.Vector3[] = [];
  if (p.y < 1.3) out.push(v(p.x, 1.4, p.z + (p.z < -0.5 ? 0.12 : -0.12)));
  out.push(v(p.x, y, THREE.MathUtils.clamp(p.z, -0.6, 1.4)));
  return out;
}

/**
 * The way from one place to another, as someone would walk it: straight if
 * nothing's in the way; otherwise back out into the aisle, along it, and in.
 * From out in the garden, in by the door first.
 */
export function route(a: THREE.Vector3, b: THREE.Vector3): THREE.Vector3[] | undefined {
  if (clear(a, b, [], 0.06)) return undefined;
  const via: THREE.Vector3[] = [];
  let from = a;
  if (outdoors(a)) {
    via.push(DOOR_OUT.clone(), DOOR_IN.clone());
    from = DOOR_IN;
  } else if (!open(a)) {
    via.push(...stepOut(a));
    from = via[via.length - 1];
  }
  const into = open(b) ? [] : stepOut(b).reverse();
  const to = into.length ? into[0] : b;
  // Along the aisle, if the step across isn't clear by itself.
  if (!clear(from, to, [], 0.06)) {
    const y = THREE.MathUtils.clamp((from.y + to.y) / 2, 1.4, 1.9);
    via.push(v(from.x, y, AISLE.z), v(to.x, y, AISLE.z));
  }
  via.push(...into);
  // No two waypoints on top of each other (the curve through them would kink).
  const out: THREE.Vector3[] = [];
  for (const p of via) if (!out.length || out[out.length - 1].distanceTo(p) > 0.08) out.push(p);
  return out.filter((p) => p.distanceTo(a) > 0.08 && p.distanceTo(b) > 0.08);
}
