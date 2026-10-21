import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { clean, MAX_PHRASE } from '../../src/evolve';
import { PHRASES } from '../../src/worlds/library/book';
import { bayOffset, center, clear, D, HEX, onWall, RESERVED, ROOMS, route, SHELVED, solid } from '../../src/worlds/library/plan';

const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

describe('the book over the well', () => {
  it('only breeds phrases that fit, in letters it can show', () => {
    for (const phrase of PHRASES) {
      expect(clean(phrase), phrase).toBe(phrase);
      expect(phrase.length).toBeLessThanOrEqual(MAX_PHRASE);
    }
  });

  it('breeds them two to a spread, so the pairs read across', () => {
    expect(PHRASES.length % 2).toBe(0);
    expect(PHRASES[0]).toBe('EVOLVING WORD');
    const spread = (a: string) => Math.floor(PHRASES.indexOf(a) / 2);
    expect(spread('OF MAKING BOOKS')).toBe(spread('THERE IS NO END'));
    expect(PHRASES.indexOf('OF MAKING BOOKS') % 2).toBe(0);
    expect(spread('IN THE BEGINNING')).toBe(spread('FIAT LUX'));
  });
});

describe('the plan of the library', () => {
  it('fits four bays of shelves along the front of every wall', () => {
    // The fronts of the bookcases make a smaller hexagon; its sides are this long.
    const front = ((HEX.r - HEX.depth) * 2) / Math.sqrt(3);
    expect(HEX.bays * HEX.bayW).toBeLessThanOrEqual(front);
    expect(bayOffset(0)).toBeCloseTo(-bayOffset(HEX.bays - 1));
  });

  it('leaves the studio its walls in the galleries the tour visits, on shelved walls', () => {
    for (const r of RESERVED) {
      expect(SHELVED).toContain(r.side);
      expect(r.bay + r.n).toBeLessThanOrEqual(HEX.bays);
    }
    expect(new Set(RESERVED.map((r) => r.k))).toEqual(new Set([ROOMS.honors, ROOMS.books, ROOMS.maps]));
  });

  it('knows open air from stone', () => {
    // The middle of a gallery, the well, an arch, a vestibule: open.
    expect(solid(v(0, 1.5, 3))).toBe(false);
    expect(solid(v(0, 1.5, 0))).toBe(false);
    expect(solid(v(1.5, 1.5, HEX.r + 0.01))).toBe(false);
    expect(solid(v(0, 1.5, D / 2))).toBe(false);
    // A bookcase, the wall beside an arch, the ceiling, the floor between floors: stone.
    expect(solid(onWall(1, 0, 5, 0, 0.2).position.setY(1.5))).toBe(true);
    expect(solid(v(HEX.archW + 0.3, 1.5, HEX.r + 0.5))).toBe(true);
    expect(solid(v(0, HEX.ceiling + 0.1, 3))).toBe(true);
    expect(solid(v(0, HEX.F - 0.2, 3))).toBe(true);
  });

  it('walks between galleries through the arches, round the wells, never through a wall', () => {
    // From in front of a wall of one gallery to in front of a wall of another, every pair.
    const spots: THREE.Vector3[] = [];
    for (const k of [0, 1, 2, 3])
      for (const side of SHELVED) {
        const p = onWall(k, 0, side, 0, HEX.depth + 2.6).position;
        spots.push(p.setY(1.55));
      }
    for (const a of spots)
      for (const b of spots) {
        if (a === b) continue;
        const via = route(a, b);
        expect(clear(a, b, via), `${a.toArray()} -> ${b.toArray()}`).toBe(true);
        // And never over a well on the way through a gallery in between.
        for (const p of via ?? []) {
          const k = Math.round(p.z / D);
          if (k !== Math.round(a.z / D) && k !== Math.round(b.z / D)) expect(Math.hypot(p.x, p.z - center(k).z)).toBeGreaterThan(HEX.well + 0.5);
        }
      }
  });
});
