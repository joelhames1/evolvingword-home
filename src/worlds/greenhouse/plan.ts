// The plan of the greenhouse: a long Victorian glasshouse against an old brick
// garden wall, the glass coming up from a low brick wall at the front and
// curving over into the roof. The potting bench stands under the front glass in
// the middle; the staging for the flowers runs along the front to its left;
// ferns to its right; the brick wall at the back holds the prizes, the seed
// drawers and the plant hunter's map, with the shirts and the herbs drying at
// its far end. Everything here is plain numbers, so the tests can walk the plan
// without a browser.
import * as THREE from 'three';

const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

/** The house, in meters. The front glass faces −z, toward the garden and the low sun. */
export const HOUSE = {
  x0: -6,
  x1: 6,
  /** The front glass, and the face of the brick wall at the back. */
  front: -2.25,
  back: 2.8,
  /** The brick wall the front glass stands on: its top, and its inner and outer faces. */
  knee: 0.8,
  kneeIn: -2.12,
  kneeOut: -2.42,
  /** Where the front glass starts to curve over, and where the curve meets the straight roof. */
  bend: 2.05,
  eave: { z: -1.35, y: 3.05 },
  ridge: { z: 1.6, y: 4.7 },
  /** Where the short back slope meets the brick wall. */
  wallTop: 4.3,
  /** Ribs every so far along the house. */
  bay: 1.2,
  /** The door, in the left-hand end (toward the sun): its middle (z), half its width, its height. */
  door: { z: 0.55, half: 0.5, h: 2.2 },
};

/** Toward the sun: low over the garden, off to the left of the desk, so its light rakes along the house. Golden hour. */
export const SUN = v(-Math.sin(1.18) * Math.cos(0.27), Math.sin(0.27), -Math.cos(1.18) * Math.cos(0.27)).normalize();

/** The control point of the curved eave (a quadratic, tangent to the upright glass and the roof). */
const eaveControl = () => {
  const { front, eave, ridge } = HOUSE;
  return eave.y - ((ridge.y - eave.y) / (ridge.z - eave.z)) * (eave.z - front);
};

/** The roof's height over a point z across the house (the glass's inside face). */
export function roofY(z: number) {
  const { front, bend, eave, ridge, back, wallTop } = HOUSE;
  if (z <= front) return HOUSE.knee;
  if (z < eave.z) {
    // The curve's z runs (1-k)^2 front + 2(1-k)k front + k^2 eave.z, so k comes straight back from z.
    const k = Math.sqrt(THREE.MathUtils.clamp((z - front) / (eave.z - front), 0, 1));
    return (1 - k) * (1 - k) * bend + 2 * (1 - k) * k * eaveControl() + k * k * eave.y;
  }
  if (z < ridge.z) return eave.y + ((ridge.y - eave.y) * (z - eave.z)) / (ridge.z - eave.z);
  return ridge.y + ((wallTop - ridge.y) * (Math.min(z, back) - ridge.z)) / (back - ridge.z);
}

/** Points along the glass, front to back: the upright front, the curve, the roof and the short back slope, as (z, y). */
export function profile(steps = 10): THREE.Vector2[] {
  const { front, knee, bend, eave, ridge, back, wallTop } = HOUSE;
  const out = [new THREE.Vector2(front, knee), new THREE.Vector2(front, bend)];
  const cy = eaveControl();
  for (let i = 1; i <= steps; i++) {
    const k = i / steps;
    out.push(new THREE.Vector2((1 - k * k) * front + k * k * eave.z, (1 - k) * (1 - k) * bend + 2 * (1 - k) * k * cy + k * k * eave.y));
  }
  out.push(new THREE.Vector2(ridge.z, ridge.y), new THREE.Vector2(back, wallTop));
  return out;
}

/** The staging: two tiers of eight pots along the front, left of the potting bench. */
export const STAGING = {
  x0: -5.85,
  x1: -2.1,
  front: { z0: -1.66, z1: -1.14, y: 0.72, x: -5.62 },
  back: { z0: -2.1, z1: -1.68, y: 1.0, x: -5.41 },
  pitch: 0.43,
};
/** Pots on the staging. */
export const POTS = 16;
/** The little round table the show plant stands on, by the prizes. */
export const SHOW_STAND = { r: 0.2, h: 0.8 };
/** Where each pot stands (its foot): 0..7 the front tier left to right, 8..15 the back; 16 a gift waiting on the potting bench; 17 the prize plant at the show. */
export const POT_AT = [
  ...Array.from({ length: POTS }, (_, i) => {
    const tier = i < 8 ? STAGING.front : STAGING.back;
    return v(tier.x + (i % 8) * STAGING.pitch, tier.y, (tier.z0 + tier.z1) / 2);
  }),
  v(-1.5, 0.76, -1.78),
  v(2.12, 0.8, 2.42),
];
export const GIFT_POT = 16;
export const SHOW_POT = 17;
/**
 * Which empty pot a seed (or a gift) goes into first: the near row before the
 * back row (nothing stands in front of it), from the end by the potting bench,
 * the one nearest the aisle's view and furthest from the card.
 */
export const FILL_ORDER = [7, 6, 5, 4, 3, 2, 1, 0, 15, 14, 13, 12, 11, 10, 9, 8];
/** Where a pot on the staging is, in words, as seen from the aisle: "the near row, third from the left". */
export function potPlace(i: number) {
  const row = i < 8 ? 'the near row' : 'the back row';
  const k = i % 8;
  const nth = ['', 'second', 'third', 'fourth'];
  const side = k < 4 ? (k === 0 ? 'far left' : `${nth[k]} from the left`) : k === 7 ? 'far right' : `${nth[7 - k]} from the right`;
  return `${row}, ${side}`;
}
/** A pot: its height and the radius of its rim. */
export const POT = { h: 0.17, r: 0.098 };

/** The bench across the aisle from the staging, for ferns, and the tree fern by the door. */
export const FERNS = { x0: 2.3, x1: 5.85, z0: -2.1, z1: -1.2, y: 0.78 };
export const TREE_FERN = v(5.25, 0, 1.85);
/** Ferns in pots on the fern bench's gravel (their feet). */
export const FERN_POTS = [v(2.78, FERNS.y, -1.62), v(3.62, FERNS.y, -1.72), v(4.48, FERNS.y, -1.6), v(5.35, FERNS.y, -1.7)];
/** The compost bin, tucked under the end of the staging: its middle on the floor, and its size. */
export const COMPOST = { at: v(-2.47, 0, -1.2), w: 0.62, d: 0.5, h: 0.58 };
/** The tools: the watering can on the floor by the bench, and the rack at the end of the staging for the shears and the lens. */
export const CAN = v(-1.92, 0, -0.92);
export const RACK = v(-2.0, 0, -1.3);

/** Along the brick wall at the back: where each of the studio's pieces hangs or stands (its middle, x). */
export const WALL = { line: -4.85, map: -2.7, shelf: 0.05, drawers: 1.35, honors: 3.55 };

/** The CRT's brick alcove on the potting bench. */
export const ALCOVE = { x0: -0.6, x1: 0.36, z0: HOUSE.kneeIn, z1: -1.76, top: 1.5 };

/**
 * The solid things in the house the camera must keep clear of, as boxes:
 * [x0, y0, z0, x1, y1, z1]. The glass, the brick and the ground are handled
 * separately (see solid).
 */
export const BLOCKS: [number, number, number, number, number, number][] = [
  // The potting bench (the desk) up to its top, the CRT's alcove, the lamp and the Rolodex on it.
  [-1.78, 0, -2.0, 1.78, 0.8, -1.17],
  [1.18, 0.76, -1.8, 1.42, 0.95, -1.52],
  [ALCOVE.x0, 0, HOUSE.kneeIn, ALCOVE.x1, ALCOVE.top + 0.08, ALCOVE.z1],
  [-1.42, 0.76, -1.75, -0.9, 1.32, -1.3],
  // The staging and the flowers on it (up to the tallest stem).
  [STAGING.x0, 0, -2.2, STAGING.x1 + 0.12, 1.75, -1.08],
  [STAGING.x0, 0, -2.2, STAGING.x1, 2.15, -1.6],
  // The compost bin and the watering can.
  [COMPOST.at.x - COMPOST.w / 2, 0, COMPOST.at.z - COMPOST.d / 2, COMPOST.at.x + COMPOST.w / 2, COMPOST.h, COMPOST.at.z + COMPOST.d / 2],
  [CAN.x - 0.25, 0, CAN.z - 0.18, CAN.x + 0.25, 0.45, CAN.z + 0.18],
  // The fern bench, and the tree fern by the door.
  [FERNS.x0, 0, -2.2, FERNS.x1, 1.6, FERNS.z1],
  [TREE_FERN.x - 0.85, 0, TREE_FERN.z - 0.85, TREE_FERN.x + 0.75, 3.3, TREE_FERN.z + 0.95],
  // Along the back wall: the line with the shirts and herbs, the map, the shelf, the drawers and the catalog, the honors and the show plant.
  [WALL.line - 1.05, 1.45, 2.3, WALL.line + 1.05, 2.95, 2.8],
  [WALL.map - 0.85, 1.15, 2.6, WALL.map + 0.85, 2.15, 2.8],
  [WALL.shelf - 0.8, 0, 2.45, WALL.shelf + 0.8, 2.15, 2.8],
  [WALL.drawers - 0.5, 0, 2.3, WALL.drawers + 0.5, 1.7, 2.8],
  [WALL.honors - 1.35, 1.25, 2.6, WALL.honors + 1.35, 2.15, 2.8],
  [POT_AT[SHOW_POT].x - 0.3, 0, POT_AT[SHOW_POT].z - 0.3, POT_AT[SHOW_POT].x + 0.3, 1.85, 2.8],
];

/** Hanging baskets under the roof: their middle and how far their trails reach. */
export const BASKETS: { at: THREE.Vector3; r: number }[] = [
  { at: v(-3.7, 2.85, -0.45), r: 0.5 },
  { at: v(-0.95, 3.1, 0.05), r: 0.5 },
  { at: v(2.2, 3.0, -0.3), r: 0.5 },
  { at: v(4.55, 2.85, -0.55), r: 0.5 },
];

const inBox = (p: THREE.Vector3, b: (typeof BLOCKS)[number], pad = 0) => p.x > b[0] - pad && p.x < b[3] + pad && p.y > b[1] - pad && p.y < b[4] + pad && p.z > b[2] - pad && p.z < b[5] + pad;

/** In the house's own footprint (between its glass and its brick), give or take. */
const underRoof = (p: THREE.Vector3, pad = 0) => p.x > HOUSE.x0 - pad && p.x < HOUSE.x1 + pad && p.z > HOUSE.front - pad && p.z < HOUSE.back + pad;

/** The doorway in the left-hand end, give or take `pad`. */
const inDoorway = (p: THREE.Vector3, pad = 0) => Math.abs(p.x - HOUSE.x0) < 0.6 && Math.abs(p.z - HOUSE.door.z) < HOUSE.door.half - pad && p.y < HOUSE.door.h - pad;

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
  if (inDoorway(p, pad)) return false;
  // The knee wall stands a little proud of the glass.
  if (underRoof(p, 0.25 + pad) && p.y < roofY(THREE.MathUtils.clamp(p.z, HOUSE.front, HOUSE.back)) + 0.25 + pad) return true;
  // Beyond the back wall is the rest of the garden wall.
  if (p.z > HOUSE.back - pad && p.z < HOUSE.back + 0.6 + pad && p.y < HOUSE.wallTop + 0.5) return true;
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
export const AISLE = { z: 0.35, y: 1.6 };
/** The doorway, just outside and just in. */
export const DOOR_OUT = v(HOUSE.x0 - 1.4, 1.5, HOUSE.door.z);
export const DOOR_IN = v(HOUSE.x0 + 0.9, 1.55, HOUSE.door.z);

/** In the open middle of the house, where a walk along the aisle can start. */
const open = (p: THREE.Vector3) => underRoof(p, -0.3) && p.z > -0.95 && p.z < 1.75 && p.y > 0.9 && p.y < 2.6;
/** Out in the garden. */
const outdoors = (p: THREE.Vector3) => !underRoof(p, 0.1) || p.y > roofY(THREE.MathUtils.clamp(p.z, HOUSE.front, HOUSE.back)) + 0.3;

/** Out of a close-up into the aisle: straight back from it (up a little first if it's low over a bench). */
function stepOut(p: THREE.Vector3): THREE.Vector3[] {
  const y = THREE.MathUtils.clamp(p.y, 1.35, 2.0);
  const out: THREE.Vector3[] = [];
  if (p.y < 1.3 && p.z < -0.5) out.push(v(p.x, 1.4, p.z + 0.12));
  out.push(v(THREE.MathUtils.clamp(p.x, HOUSE.x0 + 0.5, HOUSE.x1 - 0.5), y, THREE.MathUtils.clamp(p.z, -0.6, 1.4)));
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
    // Round to the door and in, from out in front if that's where we are.
    if (a.x > HOUSE.x0 - 0.5) via.push(v(HOUSE.x0 - 2.6, Math.max(1.5, Math.min(a.y, 3)), Math.min(a.z, -3.2)));
    via.push(DOOR_OUT.clone(), DOOR_IN.clone());
    from = DOOR_IN;
  } else if (!open(a)) {
    via.push(...stepOut(a));
    from = via[via.length - 1];
  }
  if (outdoors(b)) {
    // Out by the door, the way in backwards.
    if (!clear(from, DOOR_IN, [], 0.06)) via.push(v(from.x, AISLE.y, AISLE.z), v(DOOR_IN.x, AISLE.y, AISLE.z));
    via.push(DOOR_IN.clone(), DOOR_OUT.clone());
    if (b.x > HOUSE.x0 - 0.5) via.push(v(HOUSE.x0 - 2.6, Math.max(1.5, Math.min(b.y, 3)), Math.min(b.z, -3.2)));
    return tidy(via, a, b);
  }
  const into = open(b) ? [] : stepOut(b).reverse();
  const to = into.length ? into[0] : b;
  // Along the aisle, if the step across isn't clear by itself.
  if (!clear(from, to, [], 0.06)) {
    const y = THREE.MathUtils.clamp((from.y + to.y) / 2, 1.4, 1.9);
    via.push(v(from.x, y, AISLE.z), v(to.x, y, AISLE.z));
  }
  via.push(...into);
  return tidy(via, a, b);
}

/** No two waypoints on top of each other, or on the ends (the curve through them would kink). */
function tidy(via: THREE.Vector3[], a: THREE.Vector3, b: THREE.Vector3) {
  const out: THREE.Vector3[] = [];
  for (const p of via) if (!out.length || out[out.length - 1].distanceTo(p) > 0.08) out.push(p);
  return out.filter((p) => p.distanceTo(a) > 0.08 && p.distanceTo(b) > 0.08);
}
