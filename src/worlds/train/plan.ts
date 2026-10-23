// The plan of the sleeper car: where the compartment, the corridor and the
// furniture are, in plain numbers, so the tests can check the camera's walks
// without a browser. The train runs along +x; the compartment's window is on
// the −z side, the corridor on the +z side; the floor is at y = 0.
import * as THREE from 'three';

const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

/** The car body. */
export const CAR = {
  /** From the middle to the inside of the walls, and to the outside of the body. */
  half: 1.55,
  outer: 1.63,
  /** The car's ends, along the train (the compartment sits over the front bogie). */
  back: -20.5,
  front: 3.5,
  /** The flat of the ceiling, and where it starts to curve down to the walls. */
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
export const CORRIDOR = { z0: ROOM.z1 + PARTITION, z1: CAR.half, x0: CAR.back + 2.4, x1: CAR.front - 2.1 };

/** The window over the table. */
export const WINDOW = { x0: -0.62, x1: 0.82, y0: 0.84, y1: 1.78 };
export const WINDOW_X = (WINDOW.x0 + WINDOW.x1) / 2;
/** The door from the compartment to the corridor, standing open. */
export const DOOR = { x0: 0.6, x1: 1.36, y1: 2.0 };
/** The fold-down table under the window, the full width of the window wall beside the bunk. */
export const TABLE = { x0: -0.66, x1: ROOM.x1, z0: ROOM.z0, z1: -0.74, y: 0.76 };
/** The bunk, along the left end wall, its head at the partition. */
export const BUNK = { x0: ROOM.x0, x1: -0.72, z0: ROOM.z0, z1: ROOM.z1, top: 0.6 };
/** The bookshelf on the right end wall, between the table and the partition. */
export const SHELF = { z: -0.21, depth: 0.17, width: 0.83, height: 1.13 };
/** Corridor windows: centers along the car, and their size. */
export const CORRIDOR_WINDOWS = { first: -18.4, step: 1.95, count: 11, width: 1.3, y0: 0.86, y1: 1.76 };
/** Compartment windows on the other side (one per compartment, ours among them). */
export const COMPARTMENT_STEP = 2.9;

/** A box of furniture or wall: [x0, y0, z0, x1, y1, z1]. */
type Box = [number, number, number, number, number, number];

/** What the camera mustn't pass through inside: furniture, and what hangs on the walls. */
export const FURNITURE: Box[] = [
  // The table, with the CRT on its right end and the lamp on its left.
  [TABLE.x0, 0, TABLE.z0, TABLE.x1, TABLE.y + 0.06, TABLE.z1],
  [0.78, TABLE.y, -1.55, 1.32, 1.24, -0.86],
  [-0.62, TABLE.y, -1.52, -0.12, 1.3, -1.1],
  // The bunk, and its reading lamp.
  [BUNK.x0, 0, BUNK.z0, BUNK.x1, BUNK.top + 0.12, BUNK.z1],
  [ROOM.x0, 1.12, -0.25, ROOM.x0 + 0.2, 1.42, 0.12],
  // The bookshelf, and the medals on their hooks above it.
  [ROOM.x1 - SHELF.depth - 0.03, 0, SHELF.z - SHELF.width / 2 - 0.03, ROOM.x1, SHELF.height + 0.04, SHELF.z + SHELF.width / 2 + 0.03],
  [ROOM.x1 - 0.12, 1.3, -0.62, ROOM.x1, 2.0, 0.2],
  // The lever, the brake handle and the horn's cord on the window wall; the board over the window.
  [0.98, 1.2, ROOM.z0, 1.4, 1.92, ROOM.z0 + 0.16],
  [-1.22, 1.36, ROOM.z0, -0.84, 1.76, ROOM.z0 + 0.13],
  [-0.79, 1.72, ROOM.z0, -0.69, 2.3, ROOM.z0 + 0.22],
  [WINDOW.x0 - 0.05, 1.86, ROOM.z0, WINDOW.x1 + 0.05, 2.1, ROOM.z0 + 0.1],
  // The curtains, gathered either side of the window.
  [WINDOW.x0 - 0.2, 0.8, ROOM.z0, WINDOW.x0 + 0.02, 1.9, ROOM.z0 + 0.12],
  [WINDOW.x1 - 0.02, 0.8, ROOM.z0, WINDOW.x1 + 0.2, 1.9, ROOM.z0 + 0.12],
  // The luggage shelf over the door.
  [ROOM.x0, 1.98, ROOM.z1 - 0.42, ROOM.x1, 2.3, ROOM.z1],
  // In the corridor: the brass rail under its windows, and what hangs on the partition.
  [CORRIDOR.x0, 0.9, CAR.half - 0.1, CORRIDOR.x1, 1.06, CAR.half],
  [-7.6, 0.6, CORRIDOR.z0, DOOR.x0 - 0.05, 2.2, CORRIDOR.z0 + 0.08],
  // The shirts hang a little further out, from their rail.
  [-6.95, 1.0, CORRIDOR.z0, -4.65, 2.15, CORRIDOR.z0 + 0.16],
];

/** The other cars of the train, behind ours and ahead (the engine): solid outside. */
export const CARS: [number, number][] = [
  [CAR.back - 25, CAR.back - 1],
  [CAR.back - 50, CAR.back - 26],
  [CAR.back - 75, CAR.back - 51],
  [CAR.front + 1, CAR.front + 20],
];

const inBox = (p: THREE.Vector3, b: Box, m: number) => p.x > b[0] - m && p.x < b[3] + m && p.y > b[1] - m && p.y < b[4] + m && p.z > b[2] - m && p.z < b[5] + m;

/** Inside the car body (its shell, not the rooms in it)? */
const inBody = (p: THREE.Vector3, m: number) => p.y > CAR.skirt - m && p.y < CAR.roof + m && Math.abs(p.z) < CAR.outer + m;

/** The ceiling's height across the car: flat in the middle, curving down to the walls. */
export const ceilingAt = (z: number) => {
  const k = Math.max(0, (Math.abs(z) - (CAR.half - 0.5)) / 0.5);
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
  // Through the walls only by the windows: ours, and the corridor's.
  if (z < ROOM.z0 + m) {
    const inWindow = p.x > WINDOW.x0 + m && p.x < WINDOW.x1 - m && p.y > WINDOW.y0 + m && p.y < WINDOW.y1 - m;
    return !inWindow;
  }
  if (z > CORRIDOR.z1 - m) {
    const w = CORRIDOR_WINDOWS;
    const k = Math.round((p.x - w.first) / w.step);
    const cx = w.first + Math.max(0, Math.min(w.count - 1, k)) * w.step;
    const inWindow = Math.abs(p.x - cx) < w.width / 2 - m && p.y > w.y0 + m && p.y < w.y1 - m;
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
export function walk(a: THREE.Vector3, b: THREE.Vector3, via: THREE.Vector3[] = [], n = 120) {
  const pts = via.length ? [a, ...via, b] : [a, a.clone().lerp(b, 0.5).add(v(0, 0.06, 0)), b];
  const curve = new THREE.CatmullRomCurve3(
    pts.map((p) => p.clone()),
    false,
    'centripetal',
  );
  return Array.from({ length: n - 1 }, (_, i) => curve.getPoint((i + 1) / n));
}

/** Does the walk from a to b keep `margin` clear of everything solid? */
export const clear = (a: THREE.Vector3, b: THREE.Vector3, via: THREE.Vector3[] = [], margin = 0.04) => walk(a, b, via).every((p) => !solid(p, margin));

type Where = 'out' | 'room' | 'corridor';
/** Which part of the train a point is in: our compartment, the corridor, or outside. */
export const where = (p: THREE.Vector3): Where => {
  if (p.x < CAR.back || p.x > CAR.front || Math.abs(p.z) > CAR.half || p.y < CAR.skirt || p.y > CAR.roof) return 'out';
  return p.z < ROOM.z1 + PARTITION / 2 ? 'room' : 'corridor';
};

/** In and out through our window, and through our door. */
export const THROUGH = {
  far: v(WINDOW_X, 1.33, -4.6),
  outside: v(WINDOW_X, 1.33, -2.5),
  inside: v(WINDOW_X, 1.33, -0.5),
  room: v(0.98, 1.5, -0.16),
  corridor: v(0.98, 1.5, 0.88),
};
/** Where the camera can stand in the open middle of the compartment, and down the corridor. */
const MIDDLE = v(0.3, 1.45, -0.28);
const along = (x: number, y = 1.5) => v(Math.max(CORRIDOR.x0 + 0.5, Math.min(CORRIDOR.x1 - 0.5, x)), y, (CORRIDOR.z0 + CORRIDOR.z1) / 2);

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
      for (const via of [[MIDDLE], [MIDDLE.clone().setY(1.2)], [a.clone().lerp(MIDDLE, 0.5).setY(1.5), MIDDLE, b.clone().lerp(MIDDLE, 0.5).setY(1.5)]]) if (clear(a, b, via)) return via;
      return [MIDDLE];
    }
    if (wa === 'corridor') return [along(a.x, (a.y + b.y) / 2), along(b.x, (a.y + b.y) / 2)];
    return undefined;
  }
  // Between the compartment and the corridor: through the door.
  const toCorridor = (p: THREE.Vector3) => (Math.abs(p.x - THROUGH.corridor.x) > 1.2 ? [THROUGH.corridor, along(p.x + Math.sign(THROUGH.corridor.x - p.x) * 0.6, 1.5)] : [THROUGH.corridor]);
  const inRoom = (p: THREE.Vector3) => (clear(p, THROUGH.room) ? [] : [MIDDLE]);
  if (wa === 'room' && wb === 'corridor') return [...inRoom(a), THROUGH.room, ...toCorridor(b)];
  if (wa === 'corridor' && wb === 'room') return [...toCorridor(a).reverse(), THROUGH.room, ...inRoom(b)];
  // From outside, in through the window (and on through the door, for the corridor); and back out.
  const fromWindow = (p: THREE.Vector3) => (where(p) === 'corridor' ? [THROUGH.inside, ...inRoom(THROUGH.inside), THROUGH.room, ...toCorridor(p)] : clear(THROUGH.inside, p) ? [THROUGH.inside] : [THROUGH.inside, MIDDLE]);
  if (wa === 'out') return [THROUGH.far, THROUGH.outside, ...fromWindow(b)];
  return [...fromWindow(a).reverse(), THROUGH.outside, THROUGH.far];
}
