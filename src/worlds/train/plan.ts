// The plan of the sleeper car: where the compartment, the corridor and the
// furniture are, in plain numbers, so the tests can check the camera's walks
// without a browser. The train runs along +x; the compartment's window is on
// the −z side, the corridor on the +z side; the floor is at y = 0. The car
// stands still and the land goes by, so all of this stays put.
import * as THREE from 'three';

const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

/** The car body. */
export const CAR = {
  /** From the middle to the inside of the walls, and to the outside of the body. */
  half: 1.55,
  outer: 1.63,
  /** The car's ends, along the train (the compartment is the first one, behind the end vestibule). */
  back: -20.5,
  front: 3.5,
  /** The flat of the ceiling, and where it has curved down to at the side walls. */
  ceiling: 2.3,
  eaves: 2.06,
  /** The top of the rails, below the floor. */
  rail: -1.15,
  /** The bottom of the body, the top of its sides, and the top of the roof. */
  skirt: -0.42,
  shoulder: 2.3,
  roof: 2.82,
};

/** The compartment, wall to wall: its end walls, the window wall, and the partition to the corridor. */
export const ROOM = { x0: -1.45, x1: 1.45, z0: -CAR.half, z1: 0.25 };
/** The partition's thickness: the corridor starts on its other side. */
export const PARTITION = 0.06;
export const CORRIDOR = { z0: ROOM.z1 + PARTITION, z1: CAR.half, x0: CAR.back + 1.6, x1: 2.05 };
/** How far apart the compartments are along the car; ours is the first. */
export const COMPARTMENT_STEP = 2.9;

/** The window over the table. */
export const WINDOW = { x0: -0.62, x1: 0.82, y0: 0.84, y1: 1.78 };
export const WINDOW_X = (WINDOW.x0 + WINDOW.x1) / 2;
/** The door from the compartment to the corridor, slid open. */
export const DOOR = { x0: 0.6, x1: 1.36, y1: 2.0 };
/** The fold-down table under the window, from beside the bunk to the far wall. */
export const TABLE = { x0: -0.68, x1: ROOM.x1, z0: ROOM.z0, z1: -0.82, y: 0.76 };
/** The bunk, along the left end wall, its foot at the window. */
export const BUNK = { x0: ROOM.x0, x1: -0.74, z0: ROOM.z0, z1: ROOM.z1, top: 0.6 };
/** The bookshelf on the right end wall, between the table and the partition (the studio's, at this scale). */
export const SHELF = { z: -0.25, scale: 0.6 };
/** Corridor windows: centers along the car, and their size. */
export const CORRIDOR_WINDOWS = { first: -18.4, step: 1.95, count: 11, width: 1.3, y0: 0.86, y1: 1.76 };
/**
 * The corridor window across from our door is let down this far: the way the
 * camera comes in from outside and goes back out, over its lowered glass. (Every
 * other window, ours too, has its glass up: nothing goes through those.)
 */
export const LET_DOWN = 0.5;

/** A box of furniture or wall: [x0, y0, z0, x1, y1, z1]. */
type Box = [number, number, number, number, number, number];

/** What the camera mustn't pass through inside: furniture, and what hangs on the walls. */
export const FURNITURE: Box[] = [
  // The table, and what stands on it: the CRT on its deck at the far end, the lamp by the window.
  [TABLE.x0, 0, TABLE.z0, TABLE.x1, TABLE.y + 0.05, TABLE.z1],
  [0.84, TABLE.y, ROOM.z0, 1.42, 1.3, -0.98],
  [-0.56, TABLE.y, ROOM.z0, -0.26, 1.24, -1.25],
  // The bunk, its pillow and blanket, and the reading lamp over its head.
  [BUNK.x0, 0, BUNK.z0, BUNK.x1, BUNK.top + 0.2, BUNK.z1],
  [ROOM.x0, 1.12, -0.2, ROOM.x0 + 0.22, 1.45, 0.1],
  // The bookshelf, and the medals on their coat hooks above it.
  [ROOM.x1 - 0.2, 0, -0.74, ROOM.x1, 1.26, 0.24],
  [ROOM.x1 - 0.12, 1.4, -0.66, ROOM.x1, 2.02, 0.04],
  // On the window wall: the lever, the brake handle, the horn's cord; the board over the window.
  [0.94, 1.3, ROOM.z0, 1.4, 1.98, ROOM.z0 + 0.2],
  [-1.24, 1.38, ROOM.z0, -0.86, 1.8, ROOM.z0 + 0.14],
  [-0.84, 1.62, ROOM.z0, -0.68, 2.3, ROOM.z0 + 0.16],
  [WINDOW.x0 - 0.08, 1.84, ROOM.z0, WINDOW.x1 + 0.08, 2.3, ROOM.z0 + 0.12],
  // The curtains, gathered either side of the window, and the pelmet over them.
  [WINDOW.x0 - 0.22, 0.8, ROOM.z0, WINDOW.x0 + 0.04, 1.86, ROOM.z0 + 0.12],
  [WINDOW.x1 - 0.04, 0.8, ROOM.z0, WINDOW.x1 + 0.22, 1.86, ROOM.z0 + 0.12],
  // The map and the route plate under it, over the bunk.
  [ROOM.x0, 0.98, -1.26, ROOM.x0 + 0.16, 1.92, 0.0],
  // The luggage rack over the door, and the ceiling lamp.
  [ROOM.x0, 1.96, ROOM.z1 - 0.44, ROOM.x1, 2.3, ROOM.z1],
  [-0.22, 2.1, -0.88, 0.22, 2.3, -0.44],
  // In the corridor: the brass rail under its windows, the tip-up seats, the
  // diplomas on the partition and the shirts on their rail.
  [CORRIDOR.x0, 0.88, CORRIDOR.z1 - 0.12, CORRIDOR.x1, 1.04, CORRIDOR.z1],
  [CORRIDOR.x0, 0.35, CORRIDOR.z1 - 0.3, CORRIDOR.x1, 0.62, CORRIDOR.z1],
  [-1.3, 1.2, CORRIDOR.z0, 0.4, 1.9, CORRIDOR.z0 + 0.07],
  [-4.4, 1.2, CORRIDOR.z0, -2.4, 2.1, CORRIDOR.z0 + 0.2],
];

/** The other cars of the train, behind ours and ahead (another sleeper, then the engine): solid outside. */
export const CARS: [number, number][] = [
  [CAR.back - 25, CAR.back - 1],
  [CAR.back - 50, CAR.back - 26],
  [CAR.back - 75, CAR.back - 51],
  [CAR.front + 1, CAR.front + 25],
  [CAR.front + 26, CAR.front + 45],
];

/** The middle of the corridor window nearest x. */
export const corridorWindowAt = (x: number) => {
  const w = CORRIDOR_WINDOWS;
  const k = Math.round((x - w.first) / w.step);
  return w.first + Math.max(0, Math.min(w.count - 1, k)) * w.step;
};
/** The corridor window across from our door: the one that's let down. */
export const OPPOSITE = corridorWindowAt((DOOR.x0 + DOOR.x1) / 2);
/** The open top of it, over the lowered glass. */
export const OPENING = { x0: OPPOSITE - CORRIDOR_WINDOWS.width / 2, x1: OPPOSITE + CORRIDOR_WINDOWS.width / 2, y0: CORRIDOR_WINDOWS.y1 - LET_DOWN, y1: CORRIDOR_WINDOWS.y1 };

const inBox = (p: THREE.Vector3, b: Box, m: number) => p.x > b[0] - m && p.x < b[3] + m && p.y > b[1] - m && p.y < b[4] + m && p.z > b[2] - m && p.z < b[5] + m;

/** Inside the car body (its shell, not the rooms in it)? */
const inBody = (p: THREE.Vector3, m: number) => p.y > CAR.skirt - 0.8 - m && p.y < CAR.roof + m && Math.abs(p.z) < CAR.outer + m;

/** The ceiling's height across the car: flat in the middle, curving down to the side walls. */
export const ceilingAt = (z: number) => {
  const k = Math.min(1, Math.max(0, (Math.abs(z) - (CAR.half - 0.5)) / 0.5));
  return CAR.ceiling - (CAR.ceiling - CAR.eaves) * (1 - Math.sqrt(Math.max(0, 1 - k * k)));
};

/**
 * Is this point inside something solid: a wall, the floor or ceiling, the
 * bunk, the table, the train's other cars? Open air is the compartment, the
 * corridor and everywhere outside the train. `margin` grows every solid by
 * that much, for checking the camera keeps clear of things, not just out of them.
 */
export function solid(p: THREE.Vector3, margin = 0): boolean {
  const m = margin;
  for (const [a, b] of CARS) if (p.x > a - m && p.x < b + m && inBody(p, m)) return true;
  if (p.x < CAR.back - m || p.x > CAR.front + m || !inBody(p, m)) return false;
  // In the car's shell. The rooms are hollow; the rest is car.
  if (p.y < m || p.y > ceilingAt(p.z) - m) return true;
  const z = p.z;
  // Through the side walls only over the glass let down in the corridor window across from our door.
  // (Our own window, up or down, isn't a way in or out: its glass is there.)
  if (z < ROOM.z0 + m) return true;
  if (z > CORRIDOR.z1 - m) {
    const o = OPENING;
    const inWindow = p.x > o.x0 + m && p.x < o.x1 - m && p.y > o.y0 + m && p.y < o.y1 - m;
    return !inWindow;
  }
  if (z < ROOM.z1 + m) {
    // The compartment: only ours is open, between its end walls.
    if (p.x < ROOM.x0 + m || p.x > ROOM.x1 - m) return true;
  } else if (z < CORRIDOR.z0 - m) {
    // The partition, but for the door.
    if (!(p.x > DOOR.x0 + m && p.x < DOOR.x1 - m && p.y < DOOR.y1 - m)) return true;
  } else if (p.x < CORRIDOR.x0 + m || p.x > CORRIDOR.x1 - m) return true;
  for (const b of FURNITURE) if (inBox(p, b, m)) return true;
  return false;
}

/** Points along the walk from a to b, as the camera takes it: through the waypoints, or rising a little in the middle. */
export function walk(a: THREE.Vector3, b: THREE.Vector3, via: THREE.Vector3[] = [], n = 160) {
  const pts = via.length ? [a, ...via, b] : [a, a.clone().lerp(b, 0.5).add(v(0, 0.06, 0)), b];
  const curve = new THREE.CatmullRomCurve3(
    pts.map((p) => p.clone()),
    false,
    'centripetal',
  );
  return Array.from({ length: n - 1 }, (_, i) => curve.getPoint((i + 1) / n));
}

/** Does the walk from a to b keep `margin` clear of everything solid? (Its ends may be close to things: that's where the camera stops to look.) */
export const clear = (a: THREE.Vector3, b: THREE.Vector3, via: THREE.Vector3[] = [], margin = 0.04) =>
  walk(a, b, via).every((p) => p.distanceTo(a) < 0.08 || p.distanceTo(b) < 0.08 || !solid(p, margin));

export type Where = 'out' | 'room' | 'corridor';
/** Which part of the train a point is in: our compartment, the corridor, or outside. */
export const where = (p: THREE.Vector3): Where => {
  if (p.x < CAR.back || p.x > CAR.front || Math.abs(p.z) > CAR.half || p.y < CAR.skirt || p.y > CAR.roof) return 'out';
  return p.z < ROOM.z1 + PARTITION / 2 ? 'room' : 'corridor';
};

/** The height the camera goes through the open top of that window. */
const SILL_Y = (OPENING.y0 + OPENING.y1) / 2;
/** Through our door, and in and out through the corridor window across from it. */
export const THROUGH = {
  room: v(0.98, 1.5, -0.2),
  corridor: v(0.98, 1.5, 0.95),
  farSide: v(OPPOSITE, SILL_Y, 4.6),
  outsideSide: v(OPPOSITE, SILL_Y, 2.5),
  insideSide: v(OPPOSITE, SILL_Y, 1.25),
};
/** Where the camera can stand in the open middle of the compartment, and down the corridor. */
export const MIDDLE = v(0.32, 1.5, -0.32);
const CORRIDOR_MID = (CORRIDOR.z0 + CORRIDOR.z1) / 2;
const along = (x: number, y = 1.5) => v(Math.max(CORRIDOR.x0 + 0.5, Math.min(CORRIDOR.x1 - 0.5, x)), y, CORRIDOR_MID);

/**
 * The way from one place to another, the way someone would walk it: across
 * the compartment round the bunk and the table, out through the door into the
 * corridor and along it, and in from outside through the window.
 */
export function route(a: THREE.Vector3, b: THREE.Vector3): THREE.Vector3[] | undefined {
  const wa = where(a);
  const wb = where(b);
  if (wa === wb) {
    if (clear(a, b)) return undefined;
    if (wa === 'room') {
      // Out into the middle of the compartment first, then on.
      const tries = [[MIDDLE], [MIDDLE.clone().setY(1.25)], [a.clone().lerp(MIDDLE, 0.5).setY(1.5), MIDDLE, b.clone().lerp(MIDDLE, 0.5).setY(1.5)]];
      for (const via of tries) if (clear(a, b, via)) return via;
      return [MIDDLE];
    }
    if (wa === 'corridor') return [along(a.x, (a.y + b.y) / 2), along(b.x, (a.y + b.y) / 2)];
    // From one side of the train to the other: up and over the roof.
    const over = (p: THREE.Vector3) => v(p.x, CAR.roof + 0.9, Math.sign(p.z || 1) * (CAR.outer + 0.6));
    return [over(a), over(b)];
  }
  // Between the compartment and the corridor: through the door.
  const toCorridor = (p: THREE.Vector3) => (Math.abs(p.x - THROUGH.corridor.x) > 1.0 ? [THROUGH.corridor, along(p.x + Math.sign(THROUGH.corridor.x - p.x) * 0.6, 1.5)] : [THROUGH.corridor]);
  const inRoom = (p: THREE.Vector3) => (clear(p, THROUGH.room) ? [] : [MIDDLE]);
  if (wa === 'room' && wb === 'corridor') return [...inRoom(a), THROUGH.room, ...toCorridor(b)];
  if (wa === 'corridor' && wb === 'room') return [...toCorridor(a).reverse(), THROUGH.room, ...inRoom(b)];
  // From outside, in through the corridor window that's let down across from our door (from the
  // window side, over the roof to it first), and on through the door to the compartment; and back out.
  const fromSide = (p: THREE.Vector3) => (where(p) === 'corridor' ? [THROUGH.insideSide, ...toCorridor(p)] : [THROUGH.insideSide, THROUGH.corridor, THROUGH.room, ...inRoom(p)]);
  const out = wa === 'out' ? a : b;
  const there = wa === 'out' ? b : a;
  const over = (p: THREE.Vector3, side: number) => v(p.x, CAR.roof + 0.9, side * (CAR.outer + 0.6));
  const round = out.z > 0 ? [] : [over(out, -1), over(THROUGH.farSide, 1)];
  const way = [...round, THROUGH.farSide, THROUGH.outsideSide, ...fromSide(there)];
  return wa === 'out' ? way : way.reverse();
}
