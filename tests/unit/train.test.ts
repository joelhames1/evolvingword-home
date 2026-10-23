import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { ALPHABET, clean, MAX_PHRASE } from '../../src/evolve';
import { WORLDS } from '../../src/worlds';
import { MODULES, pad, PHRASES } from '../../src/worlds/train/board';
import { bpmFor, BRANCHES, clackInterval, FIRST_LEAD, inStep, Journey, LANDS, LAYOUT, LEVER_LIT, LEVER_LOCK, RAIL, VIADUCT_LIMIT, type Land, type TrainEvent } from '../../src/worlds/train/journey';
import { PLATFORM, STATION_LAMPS } from '../../src/worlds/train/ground';
import { SHED_PILLARS } from '../../src/worlds/train/scenery';
import { stationPlan, type StationKind } from '../../src/worlds/train/station';
import { STATION_TEX } from '../../src/worlds/train/night';
import { CAR, clear, CORRIDOR, OPPOSITE, ROOM, route, solid, THROUGH, where, WINDOW } from '../../src/worlds/train/plan';
import { CHORDS, ECHOES, MELODY } from '../../src/worlds/train/sound';
import { fresh, MAX_HOLES, nextHole, parseTicket, SHAPES } from '../../src/worlds/train/ticket';

const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

/** A seeded random, so the runs are the same every time. */
const seeded = (seed: number) => {
  let s = seed;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
};

/** Runs the train for a while, collecting what happens. */
function run(j: Journey, seconds: number, dt = 0.1) {
  const events: TrainEvent[] = [];
  for (let t = 0; t < seconds; t += dt) events.push(...j.step(dt));
  return events;
}

describe('the night train', () => {
  it('has a globe with lamps going by in the glass', () => {
    expect(WORLDS.find((w) => w.id === 'train')).toMatchObject({ name: 'The Night Train', weather: 'lamps', still: '/worlds/train.jpg' });
  });
});

describe('the line', () => {
  it('forks at every junction for two other landscapes', () => {
    for (const land of LANDS) {
      const [a, b] = BRANCHES[land];
      expect(a).not.toBe(b);
      expect(a).not.toBe(land);
      expect(b).not.toBe(land);
      expect(LANDS).toContain(a);
      expect(LANDS).toContain(b);
    }
  });

  it('can get from any landscape to any other', () => {
    for (const from of LANDS) {
      const seen = new Set<Land>([from]);
      const queue = [from];
      while (queue.length) for (const next of BRANCHES[queue.shift()!]) if (!seen.has(next)) (seen.add(next), queue.push(next));
      expect([...seen].sort()).toEqual([...LANDS].sort());
    }
  });

  it('comes round to every landscape, left to itself', () => {
    const j = new Journey({ rand: seeded(7), land: 'fields', at: 0 });
    const lands = new Set<Land>([j.current().land]);
    let legs = 0;
    for (const e of run(j, 4000, 0.5)) if (e.kind === 'points') (lands.add(e.to.land), legs++);
    expect(legs).toBeGreaterThan(8);
    expect([...lands].sort()).toEqual([...LANDS].sort());
  });

  it('keeps its stations, tunnels and viaducts inside their stretches, clear of the junctions', () => {
    for (const land of LANDS) {
      const L = LAYOUT[land];
      for (const span of [L.viaduct, L.tunnel, ...(L.sheds ?? [])].filter(Boolean) as [number, number][]) {
        expect(span[0]).toBeGreaterThan(200);
        expect(span[1]).toBeLessThan(L.length - 200);
      }
      if (L.station) expect(L.station.at).toBeLessThan(L.length - 100);
      if (L.crossing !== undefined) expect(L.crossing).toBeLessThan(L.length - 300);
    }
  });

  it('goes the way the lever is thrown, but only while it is lit', () => {
    const j = new Journey({ rand: seeded(3), land: 'gorge', at: 0 });
    // Too far off yet: the lever won't move.
    expect(j.junction().live).toBe(false);
    expect(j.pull()).toBe(false);
    // Up to where it lights.
    const lit = run(j, 400).find((e) => e.kind === 'lit');
    expect(lit).toBeTruthy();
    const jn = j.junction();
    expect(jn.live).toBe(true);
    expect(jn.left).toBeLessThanOrEqual(LEVER_LIT);
    const before = j.ahead().land;
    const set = jn.set;
    expect(j.pull()).toBe(true);
    expect(j.junction().set).toBe(set ? 0 : 1);
    expect(j.junction().by).toBe('you');
    const after = j.ahead().land;
    expect(after).not.toBe(before);
    expect(after).toBe(BRANCHES.gorge[j.junction().set]);
    // Over the points, and on into the landscape chosen.
    const points = run(j, 400).find((e) => e.kind === 'points');
    expect(points && points.kind === 'points' && points.to.land).toBe(after);
  });

  it('starts on the viaduct with the first lever still dark, and lights it a little after you sit down', () => {
    const at = LAYOUT.gorge.viaduct![0] + 150;
    const j = new Journey({ rand: seeded(21), land: 'gorge', at, speed: VIADUCT_LIMIT, lead: FIRST_LEAD });
    expect(j.junction().live).toBe(false);
    // The way in takes 11 seconds; the lamp should still be dark then, and lit within a minute and a half.
    let t = 0;
    let lit = -1;
    for (; t < 90 && lit < 0; t += 0.1) if (j.step(0.1).some((e) => e.kind === 'lit')) lit = t;
    expect(lit).toBeGreaterThan(15);
    expect(lit).toBeLessThan(60);
  });

  it('hands back the same junction and the same list of events each time, rather than making new ones every frame', () => {
    const j = new Journey({ rand: seeded(2), land: 'fields', at: 100 });
    expect(j.junction()).toBe(j.junction());
    expect(j.step(0.1)).toBe(j.step(0.1));
  });

  it('crosses the viaduct fast enough for the band to keep time, with room to spare', () => {
    expect((60 * VIADUCT_LIMIT) / RAIL).toBeGreaterThan(41.5);
    expect(inStep(VIADUCT_LIMIT - 0.05)).toBe(true);
  });

  it('locks the points before it gets to them', () => {
    const j = new Journey({ rand: seeded(5), land: 'fields', at: LAYOUT.fields.length - LEVER_LOCK + 20 });
    expect(j.junction().live).toBe(false);
    expect(j.pull()).toBe(false);
  });

  it('stops at its stations and goes on again', () => {
    const j = new Journey({ rand: seeded(11), land: 'city', at: 200 });
    const events = run(j, 400);
    const arrive = events.findIndex((e) => e.kind === 'arrive');
    const depart = events.findIndex((e) => e.kind === 'depart');
    expect(arrive).toBeGreaterThanOrEqual(0);
    expect(depart).toBeGreaterThan(arrive);
    expect(events[arrive]).toMatchObject({ name: 'CENTRAL' });
  });

  it('screeches to a stop on the emergency brake, waits, and eases away', () => {
    const j = new Journey({ rand: seeded(13), land: 'fields', at: 100, speed: 24 });
    expect(j.brake()).toBe(true);
    expect(j.brake()).toBe(false);
    let s = j.s;
    const seen: string[] = [];
    for (let t = 0; t < 120; t += 0.1) {
      for (const e of j.step(0.1)) seen.push(e.kind);
      expect(j.v).toBeGreaterThanOrEqual(0);
      expect(j.s).toBeGreaterThanOrEqual(s);
      s = j.s;
    }
    expect(seen).toEqual(expect.arrayContaining(['stopped', 'release', 'away']));
    expect(seen.indexOf('stopped')).toBeLessThan(seen.indexOf('away'));
    expect(j.v).toBeGreaterThan(5);
  });
});

describe('the wheels and the band', () => {
  it('clacks once a rail length, faster the faster it goes', () => {
    expect(clackInterval(24)).toBeCloseTo(RAIL / 24);
    expect(clackInterval(12)).toBeCloseTo(2 * clackInterval(24));
    expect(clackInterval(0)).toBe(Infinity);
    for (let s = 1; s < 40; s += 3) expect(clackInterval(s + 1)).toBeLessThan(clackInterval(s));
  });

  it('keeps the band on the beat of the wheels while it can, and in a tempo it can play', () => {
    for (let s = 0; s <= 40; s += 0.5) {
      expect(bpmFor(s)).toBeGreaterThanOrEqual(40);
      expect(bpmFor(s)).toBeLessThanOrEqual(80);
      if (inStep(s)) expect(60 / bpmFor(s)).toBeCloseTo(clackInterval(s));
    }
    expect(inStep(20)).toBe(true);
    expect(inStep(2)).toBe(false);
  });

  it('has a phrase of the tune for every chord, inside its two bars', () => {
    expect(MELODY).toHaveLength(CHORDS.length);
    for (const phrase of MELODY)
      for (const [note, start, len] of phrase) {
        expect(start).toBeGreaterThanOrEqual(0);
        expect(start + len).toBeLessThanOrEqual(32);
        expect(note).toBeGreaterThan(55);
        expect(note).toBeLessThan(80);
      }
    for (const c of CHORDS) expect(c.bass).toBeLessThan(Math.min(...c.notes));
  });

  it('echoes the horn longest in the gorge and shortest in the city', () => {
    const last = (k: keyof typeof ECHOES) => Math.max(...ECHOES[k].delays);
    expect(last('gorge')).toBeGreaterThan(last('fields'));
    expect(last('city')).toBeLessThan(0.6);
    for (const e of Object.values(ECHOES)) {
      expect(e.delays).toHaveLength(e.gains.length);
      for (const g of e.gains) expect(g).toBeGreaterThan(0);
    }
  });
});

describe('the ticket', () => {
  const good = { v: 1, holes: [{ x: 0.3, y: 0.12, shape: 'star' }], stamps: ['gorge', 'pass'] };

  it('keeps what it wrote', () => {
    expect(parseTicket(JSON.stringify(good))).toEqual(good);
    expect(parseTicket(null)).toEqual(fresh());
  });

  it('throws away anything it did not write', () => {
    const junk: unknown[] = [
      'not json',
      '{',
      '[]',
      'null',
      '42',
      JSON.stringify({ ...good, v: 2 }),
      JSON.stringify({ ...good, holes: 'many' }),
      JSON.stringify({ ...good, holes: [{ x: 'a', y: 0.1, shape: 'star' }] }),
      JSON.stringify({ ...good, holes: [{ x: 2, y: 0.1, shape: 'star' }] }),
      JSON.stringify({ ...good, holes: [{ x: 0.2, y: -1, shape: 'star' }] }),
      JSON.stringify({ ...good, holes: [{ x: 0.2, y: 0.1, shape: 'skull' }] }),
      JSON.stringify({ ...good, holes: [null] }),
      JSON.stringify({ ...good, holes: Array.from({ length: MAX_HOLES + 1 }, () => ({ x: 0.5, y: 0.1, shape: 'round' })) }),
      JSON.stringify({ ...good, stamps: ['atlantis'] }),
      JSON.stringify({ ...good, stamps: ['gorge', 'gorge'] }),
      JSON.stringify({ ...good, stamps: [1] }),
      'x'.repeat(5000),
      { v: 1, holes: [{ x: NaN, y: 0.1, shape: 'round' }], stamps: [] },
    ];
    for (const j of junk) expect(parseTicket(j), String(j).slice(0, 40)).toEqual(fresh());
  });

  it('punches each new hole clear of the others, until there is no room', () => {
    const r = seeded(17);
    let state = fresh();
    for (let i = 0; i < MAX_HOLES; i++) {
      const h = nextHole(state, r);
      if (!h) break;
      expect(SHAPES).toContain(h.shape);
      for (const o of state.holes) expect(Math.hypot((o.x - h.x) * 2, o.y - h.y)).toBeGreaterThan(0.1);
      state = { ...state, holes: [...state.holes, h] };
    }
    expect(state.holes.length).toBeGreaterThan(8);
    expect(nextHole({ ...state, holes: Array.from({ length: MAX_HOLES }, () => state.holes[0]) }, r)).toBeNull();
  });
});

describe('the snow sheds', () => {
  it('stand their pillars slim, well apart and well out from the window, so they flick past instead of filling it', () => {
    expect(SHED_PILLARS.step).toBeGreaterThanOrEqual(8);
    expect(SHED_PILLARS.width).toBeLessThanOrEqual(0.5);
    expect(SHED_PILLARS.z1).toBeLessThan(-CAR.outer - 2.4);
  });
});

describe('the stations', () => {
  it('hang their lamps either side of the sign by our window, not over it, along the back of the platform', () => {
    expect(STATION_LAMPS.offset % STATION_LAMPS.step).toBeGreaterThan(3);
    expect(STATION_LAMPS.step - (STATION_LAMPS.offset % STATION_LAMPS.step)).toBeGreaterThan(3);
    expect(STATION_LAMPS.z).toBeLessThan(PLATFORM.edge - 1.5);
    expect(STATION_LAMPS.z).toBeGreaterThan(PLATFORM.back);
    expect(STATION_LAMPS.y).toBeGreaterThan(PLATFORM.y + 2.5);
  });

  for (const kind of ['city', 'lake', 'pass'] as StationKind[])
    it(`${kind}: lamps along the platform, the house on it, and the light where the land has things to light`, () => {
      const P = stationPlan(kind, 10_000, 4321);
      // Lamps all along the platform, none over the sign by our window.
      expect(P.lamps.length).toBeGreaterThan(8);
      for (const u of P.lamps) {
        expect(u).toBeGreaterThan(P.p0);
        expect(u).toBeLessThan(P.p1);
        expect(Math.abs(u - P.w)).toBeGreaterThan(3);
      }
      // The house stands on the platform, the canopy over the platform.
      expect(P.h0).toBeGreaterThan(P.p0);
      expect(P.h1).toBeLessThan(P.p1);
      expect(P.c0).toBeGreaterThanOrEqual(P.p0);
      expect(P.c1).toBeLessThanOrEqual(P.p1);
      // Its own lamps fit the shader's four, the first over the sign; its windows' light comes out of the house.
      expect(P.lights.length).toBeLessThanOrEqual(4);
      expect(Math.abs(P.lights[0].u - P.w)).toBeLessThan(0.5);
      for (const q of P.lights) expect(q.z).toBeLessThan(PLATFORM.edge);
      expect(P.glows.length).toBeGreaterThan(0);
      for (const g of P.glows) {
        expect(g.u0).toBeGreaterThanOrEqual(P.h0);
        expect(g.u1).toBeLessThanOrEqual(P.h1);
      }
      // The strip the light reads covers the whole platform and a little beyond, as far as the lamps reach.
      expect(P.stop + STATION_TEX.from).toBeLessThan(P.p0 - 8);
      expect(P.stop + STATION_TEX.from + STATION_TEX.length).toBeGreaterThan(P.p1 + 8);
      // Planned once, the same for the land and for the light.
      expect(stationPlan(kind, 10_000, 4321)).toBe(P);
    });

  it("leave our window a view: the city's lit window behind the sign, the lake's water past the halt", () => {
    const city = stationPlan('city', 10_000, 99);
    const behind = city.bays.reduce((a, q) => (Math.abs(q.u - city.w) < Math.abs(a.u - city.w) ? q : a));
    expect(behind.role === 'win' && behind.lit[0]).toBe(true);
    const lake = stationPlan('lake', 10_000, 99);
    expect(lake.h1).toBeLessThan(lake.w - 3);
  });
});

describe('the split-flap signs', () => {
  it('only breed phrases that fit, in letters they can show', () => {
    for (const phrase of PHRASES) {
      expect(clean(phrase), phrase).toBe(phrase);
      expect(phrase.length).toBeLessThanOrEqual(MAX_PHRASE);
      for (const ch of pad(phrase)) expect(ALPHABET).toContain(ch);
    }
    expect(PHRASES[0]).toBe('EVOLVING WORD');
    expect(MODULES).toBe(MAX_PHRASE);
    expect(pad('ALL ABOARD')).toHaveLength(MODULES);
  });
});

describe('the plan of the car', () => {
  it('knows open air from wall and furniture', () => {
    // The middle of the compartment and of the corridor, outside: open.
    expect(solid(v(0.3, 1.5, -0.3))).toBe(false);
    expect(solid(v(-2, 1.5, (CORRIDOR.z0 + CORRIDOR.z1) / 2))).toBe(false);
    expect(solid(v(0, 1.5, -10))).toBe(false);
    // The walls, the partition beside the door, the bunk, the table, the ceiling, the next car: solid.
    expect(solid(v(-1.0, 1.5, ROOM.z0 - 0.04))).toBe(true);
    expect(solid(v(0, 1.5, ROOM.z1 + 0.03))).toBe(true);
    expect(solid(v(1.0, 1.5, ROOM.z1 + 0.03))).toBe(false);
    expect(solid(v(-1.1, 0.5, -0.5))).toBe(true);
    expect(solid(v(0.2, 0.7, -1.2))).toBe(true);
    expect(solid(v(0, 2.4, -0.5))).toBe(true);
    expect(solid(v(CAR.front + 5, 1.5, 0))).toBe(true);
    expect(where(v(0, 1.5, -0.5))).toBe('room');
    expect(where(v(-3, 1.5, 0.9))).toBe('corridor');
    expect(where(v(0, 1.5, -3))).toBe('out');
  });

  it('walks between any two places through the door and round the furniture, never through a wall', () => {
    const spots = [
      v(0.3, 1.5, 0.13), // the table
      v(0.12, 1.36, -1.2), // nose to the glass
      v(-0.45, 1.52, -0.24), // the medals and books
      v(0.55, 1.62, -0.27),
      v(0.22, 1.12, -0.25),
      v(1.12, 1.5, -0.5), // the bunk and the map
      v(-0.22, 1.58, -0.62),
      v(-0.2, 0.62, -0.18),
      v(1.05, 1.58, 0.98), // the corridor
      v(-0.6, 1.56, CORRIDOR.z1 - 0.16),
      v(-3.57, 1.6, CORRIDOR.z1 - 0.14),
      v(-2.95, 1.6, CORRIDOR.z1 - 0.14),
    ];
    for (const a of spots)
      for (const b of spots) {
        if (a === b) continue;
        expect(clear(a, b, route(a, b)), `${a.toArray()} -> ${b.toArray()}`).toBe(true);
      }
  });

  it('comes in from outside over the glass let down across from our door, from either side, never through other glass', () => {
    const outside = [THROUGH.farSide, v(-4.6, 0.55, 4.3), v(7, -10, 34), v(0.3, 1.4, -4.6), v(-6, 0.4, -4)];
    for (const from of outside)
      for (const to of [v(0.3, 1.5, 0.13), v(-2, 1.56, 1.2), v(-0.66, 1.58, -0.9)]) {
        expect(clear(from, to, route(from, to)), `${from.toArray()} -> ${to.toArray()}`).toBe(true);
        expect(clear(to, from, route(to, from)), `${to.toArray()} -> ${from.toArray()}`).toBe(true);
      }
  });

  it('keeps the glass in every window but the one let down', () => {
    // Our window, middle of the pane, glass up or down: never a way through.
    expect(solid(v((WINDOW.x0 + WINDOW.x1) / 2, 1.3, ROOM.z0 - 0.04))).toBe(true);
    expect(solid(v((WINDOW.x0 + WINDOW.x1) / 2, 1.65, ROOM.z0 - 0.04))).toBe(true);
    // The corridor window across from our door: open over its lowered glass, not through the glass.
    expect(solid(v(OPPOSITE, 1.55, CORRIDOR.z1 + 0.04))).toBe(false);
    expect(solid(v(OPPOSITE, 1.1, CORRIDOR.z1 + 0.04))).toBe(true);
    // The next corridor window along: its glass is up.
    expect(solid(v(OPPOSITE - 1.95, 1.55, CORRIDOR.z1 + 0.04))).toBe(true);
  });
});
