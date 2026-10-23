// The shape and color of the land beside the line, for each landscape, as
// plain functions of how far along its stretch you are (u) and how far out
// from the track (z: the window side is negative). The line itself is always
// at the same height; where the land is lower it runs on an embankment, where
// it's higher through a cutting, and over the gorge and through the city on
// bridges. Where one landscape gives way to the next they're blended.
import * as THREE from 'three';
import { LAYOUT, type Land, type Leg } from './journey';
import { fbm, noise, ridged, smooth } from './mesher';

/** The top of the ballast, the bottom of its shoulders (the cess), and the rails. */
export const BALLAST = -1.38;
export const CESS = -1.62;
export const RAIL_TOP = -1.15;
/** The platforms' top, a little below the car's floor, and how far out they start. */
export const PLATFORM = { y: -0.45, edge: -1.72, back: -5.6 };
/**
 * The platform lamps: one every `step` m, `offset` m on from where our window stops (so the sign
 * there stands between two), this high, this far out. (The night light lights what's round them.)
 */
export const STATION_LAMPS = { step: 12, offset: 6, y: PLATFORM.y + 3.25, z: -4.55 };
/** The water in the gorge, and the lake's. */
export const WATER = { gorge: -94.2, lake: -3.6 };

/** The middle of the gorge, along the stretch, at a distance out from the line: it winds. */
export const gorgeAt = (z: number, seed: number) => {
  const [a, b] = LAYOUT.gorge.viaduct!;
  return (a + b) / 2 + Math.sin(z / 230 + seed) * 55 + Math.sin(z / 71 + seed * 2) * 16;
};
/** Half the gorge's width at its rim, there. */
export const gorgeHalf = (z: number, seed: number) => {
  const [a, b] = LAYOUT.gorge.viaduct!;
  return (b - a) / 2 - 6 + Math.sin(z / 310 + seed * 3) * 26 * smooth(30, 200, Math.abs(z));
};

/** Is the line on a bridge here (no embankment under it)? */
export function bridged(land: Land, u: number): boolean {
  const L = LAYOUT[land];
  if (L.viaduct) return u > L.viaduct[0] - 8 && u < L.viaduct[1] + 8;
  if (land === 'city') return true;
  if (L.tunnel) return u > L.tunnel[0] - 4 && u < L.tunnel[1] + 4;
  return false;
}

/** The land as it would be without the railway. */
export function natural(land: Land, u: number, z: number, seed: number): number {
  const az = Math.abs(z);
  const s = seed % 997;
  switch (land) {
    case 'fields': {
      const rolling = (fbm(u / 380 + s, z / 380, 11) * 18 + fbm(u / 110, z / 110 + s, 12) * 3.5) * smooth(20, 280, az);
      const hills = 120 * smooth(420, 1300, az) * (0.55 + 0.45 * fbm(u / 650, z / 650 + s, 13));
      // A hollow or two, for the mist to lie in.
      const hollow = -6 * smooth(0.25, 0.7, noise(u / 260 + s, z / 260, 14)) * smooth(40, 120, az);
      return -1.9 + rolling + hills + hollow;
    }
    case 'gorge': {
      const plateau = -1.9 + fbm(u / 300, z / 300 + s, 21) * 14 * smooth(30, 300, az) + 70 * smooth(350, 1300, az) * (0.6 + 0.4 * fbm(u / 500 + s, z / 500, 22));
      const d = Math.abs(u - gorgeAt(z, s)) / gorgeHalf(z, s);
      if (d >= 1) return plateau;
      // Sheer cliffs under the rim, a long wooded slope, a steep inner gorge, and
      // a narrow floor with the river in it.
      const up = 0.08 * smooth(0.07, 0.24, d) + 0.37 * smooth(0.24, 0.84, d) + 0.55 * smooth(0.84, 1.0, d);
      const ledges = 0.03 * Math.sin(d * 23 + noise(u / 30, z / 30, 23) * 3) * smooth(0.3, 0.5, d) * (1 - smooth(0.7, 0.84, d));
      // The floor is level whatever the tops do, so the river runs the whole way.
      const floor = WATER.gorge - 3.2 + noise(z / 200, s, 24) * 1.2;
      return floor + (plateau - floor) * (up + ledges);
    }
    case 'pass': {
      if (z > 0) {
        // The mountain on the corridor side, rising steeply from the shelf the line is cut into.
        const up = (z - 2) * (0.85 + 0.25 * noise(u / 90 + s, z / 90, 31)) + 40 * ridged(u / 260, z / 260 + s, 32) * smooth(10, 120, z);
        return -1.4 + up;
      }
      // The valley on the window side: down and away, with peaks beyond it.
      const fall = -320 * Math.pow(smooth(4, 950, az), 0.8);
      const knolls = fbm(u / 160 + s, z / 160, 33) * 26 * smooth(20, 250, az);
      const beyond = 400 * smooth(700, 1380, az) * (0.45 + ridged(u / 420 + s, z / 420, 34));
      let h = -1.8 + fall + knolls + beyond;
      // Over the tunnel, a spur of the mountain comes right across the line, falling away into the
      // valley (not a wall that goes on rising out across it).
      const t = LAYOUT.pass.tunnel!;
      const over = smooth(t[0] - 50, t[0] + 10, u) * (1 - smooth(t[1] - 10, t[1] + 50, u)) * (1 - smooth(140, 420, az));
      if (over > 0) h = h + (Math.max(h, 30 + Math.min(az, 110) * 0.6 + fbm(u / 80, z / 80 + s, 35) * 12) - h) * over;
      return h;
    }
    case 'city': {
      // Streets well below the line, which runs on a brick viaduct. Gently up toward the edges of town.
      return -8.6 + 30 * smooth(700, 1400, az) * (0.5 + 0.5 * fbm(u / 500 + s, z / 500, 41));
    }
    case 'lake': {
      if (z > 0) {
        const hill = (z - 3) * 0.32 + 26 * fbm(u / 220 + s, z / 220, 51) * smooth(10, 160, z) + 180 * smooth(300, 1300, z);
        return -1.8 + hill;
      }
      // A shingle shore, then down under the water; a long way across, the far shore.
      const shore = -1.8 - 2.6 * smooth(4, 16, az) - 7 * smooth(16, 70, az);
      const far = 160 * smooth(1250, 1500, az) * (0.6 + 0.4 * fbm(u / 300 + s, 0, 52));
      return shore + far + noise(u / 40, z / 40 + s, 53) * 0.4 * smooth(4, 12, az);
    }
  }
}

/** The ground with the railway on it: ballast, its shoulders, and an embankment or a cutting out to the land. */
export function withLine(h: number, z: number, onBridge: boolean): number {
  const az = Math.abs(z);
  if (onBridge) return h;
  if (az < 2.0) return BALLAST;
  if (az < 3.0) return BALLAST + (CESS - BALLAST) * (az - 2.0);
  const lo = CESS - (az - 3.0) / 1.5;
  const hi = CESS + (az - 3.0) / 1.0;
  return Math.min(hi, Math.max(lo, h));
}

/** One landscape's ground, railway and all. */
export function groundOf(leg: Leg, u: number, z: number): number {
  const local = u - leg.start;
  let h = natural(leg.land, local, z, leg.seed);
  // The level crossing's road comes up to the rails.
  const cross = LAYOUT[leg.land].crossing;
  if (cross !== undefined) {
    const k = 1 - smooth(4, 14, Math.abs(local - cross));
    if (k > 0) h += (CESS + 0.05 - Math.min(Math.abs(z) * 0.004, 0.6) - h) * k * (1 - smooth(260, 420, Math.abs(z)));
  }
  return withLine(h, z, bridged(leg.land, local));
}

const C = (hex: string) => new THREE.Color(hex);
const COLORS = {
  grass: C('#3d5034'),
  meadow: C('#4f6040'),
  plough: C('#4a3a2e'),
  stubble: C('#76664a'),
  hedge: C('#1d2a1a'),
  rock: C('#4c4b4f'),
  darkRock: C('#2f2e33'),
  snow: C('#dfe7f4'),
  gravel: C('#6a6560'),
  ballast: C('#5d5852'),
  asphalt: C('#2a2a2d'),
  sand: C('#6c6150'),
  forest: C('#1c2a1f'),
  cobbles: C('#3d3a38'),
};
export { COLORS };

const tmp = new THREE.Color();
/** The ground's color, given where it is, its height and how steep it is (0 flat, 1 a 45° slope). */
export function paint(out: THREE.Color, leg: Leg, u: number, z: number, h: number, slope: number) {
  const local = u - leg.start;
  const az = Math.abs(z);
  const s = leg.seed % 997;
  switch (leg.land) {
    case 'fields': {
      // A patchwork: each field its own crop.
      const fu = Math.floor((local + noise(z / 90, s, 61) * 18) / 110);
      const fz = Math.floor((z + noise(local / 90, s, 62) * 14) / 85);
      const pick = noise(fu * 7.3, fz * 3.1 + s, 63) * 0.5 + 0.5;
      out.copy(pick < 0.3 ? COLORS.plough : pick < 0.55 ? COLORS.grass : pick < 0.8 ? COLORS.meadow : COLORS.stubble);
      // Furrows and mowing lines, faintly.
      out.multiplyScalar(0.9 + 0.1 * Math.sin(local * (pick < 0.3 ? 1.1 : 0.5)));
      break;
    }
    case 'gorge': {
      const d = Math.abs(local - gorgeAt(z, s)) / gorgeHalf(z, s);
      out.copy(COLORS.forest).lerp(COLORS.grass, 0.3 + 0.3 * noise(local / 50, z / 50, 64));
      if (d < 1.05) out.lerp(COLORS.rock, smooth(0.35, 0.9, slope));
      if (d < 0.12) out.copy(COLORS.gravel).multiplyScalar(0.7);
      // A dusting of frost up on the tops.
      out.lerp(COLORS.snow, 0.25 * smooth(30, 90, h));
      break;
    }
    case 'pass': {
      // Snow drifted in waves by the wind, a rock showing through here and there; on the
      // steep faces bare rock, but for the snow that holds to the high ridges.
      out.copy(COLORS.snow).multiplyScalar(0.84 + 0.1 * noise(local / 20, z / 20, 65) + 0.06 * Math.sin(local / 3.1 + noise(local / 40, z / 9, 68) * 4));
      out.lerp(COLORS.darkRock, 0.6 * smooth(0.62, 0.8, noise(local / 6, z / 6, 69)) * smooth(6, 14, az));
      out.lerp(COLORS.darkRock, smooth(0.75, 1.3, slope) * 0.85 * (1 - 0.6 * smooth(120, 600, h)));
      break;
    }
    case 'city': {
      out.copy(COLORS.asphalt).lerp(COLORS.cobbles, 0.5 + 0.5 * noise(local / 30, z / 30, 66));
      out.lerp(COLORS.forest, smooth(650, 1100, az));
      break;
    }
    case 'lake': {
      if (z < 0 && az > 5 && h < WATER.lake + 1.2) out.copy(COLORS.sand).multiplyScalar(0.8);
      else out.copy(COLORS.forest).lerp(COLORS.meadow, 0.25 * noise(local / 40, z / 40, 67) + 0.2);
      out.lerp(COLORS.rock, smooth(0.6, 1.2, slope));
      out.lerp(COLORS.snow, 0.5 * smooth(120, 220, h));
      break;
    }
  }
  // The railway: ballast between the shoulders, a gravel path beside it.
  if (!bridged(leg.land, local)) {
    if (az < 2.15) out.copy(COLORS.ballast);
    else if (az < 3.1) out.lerp(COLORS.gravel, 0.8);
    if (leg.land === 'pass' && az < 3.4) out.lerp(COLORS.snow, 0.55);
  }
  // The crossing's road.
  const cross = LAYOUT[leg.land].crossing;
  if (cross !== undefined && Math.abs(local - cross) < 3.6 && az > 2.2) out.copy(COLORS.asphalt).lerp(tmp.set('#4a4a4a'), 0.2);
}
