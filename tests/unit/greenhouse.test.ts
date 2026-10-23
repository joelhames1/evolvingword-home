import { describe, expect, it } from 'vitest';
import { POTS, restore, seedFrom, serialize, starter, thirst, growth, MAX_SAVED, GROW_MS } from '../../src/worlds/greenhouse/garden';
import { clampGenome, CODE_LENGTH, cross, decode, describe as say, encode, gardenName, latinName, MUTATION, seeded, STARTERS, traits, WANTED, type Genome } from '../../src/worlds/greenhouse/genome';

/** Every number in a genome, by name, for comparing. */
const flat = (g: Genome): Record<string, number> => ({
  petals: g.petals,
  shape: g.shape,
  double: g.double,
  'base.h': g.base.h,
  'base.s': g.base.s,
  'base.l': g.base.l,
  'tip.h': g.tip.h,
  'tip.s': g.tip.s,
  'tip.l': g.tip.l,
  pattern: g.pattern,
  'mark.h': g.mark.h,
  'mark.s': g.mark.s,
  'mark.l': g.mark.l,
  size: g.size,
  height: g.height,
  branches: g.branches,
  leaf: g.leaf,
  foliage: g.foliage,
  scent: g.scent,
  note: g.note,
  cup: g.cup,
});
const RANGES: Record<string, [number, number]> = { petals: [3, 12], shape: [0, 3], double: [0, 1], pattern: [0, 3], size: [0, 7], height: [0, 7], branches: [0, 3], leaf: [0, 3], foliage: [0, 3], scent: [0, 3], note: [0, 15], cup: [0, 3] };
const range = (k: string): [number, number] => RANGES[k] ?? (k.endsWith('.h') ? [0, 63] : [0, 7]);
const inRange = (g: Genome) => Object.entries(flat(g)).every(([k, x]) => Number.isInteger(x) && x >= range(k)[0] && x <= range(k)[1]);

/** A random genome anywhere in its ranges. */
const random = (r: () => number): Genome => {
  const pick = (k: string) => {
    const [lo, hi] = range(k);
    return lo + Math.floor(r() * (hi - lo + 1));
  };
  const t = (p: string) => ({ h: pick(`${p}.h`), s: pick(`${p}.s`), l: pick(`${p}.l`) });
  return { petals: pick('petals'), shape: pick('shape'), double: pick('double'), base: t('base'), tip: t('tip'), pattern: pick('pattern'), mark: t('mark'), size: pick('size'), height: pick('height'), branches: pick('branches'), leaf: pick('leaf'), foliage: pick('foliage'), scent: pick('scent'), note: pick('note'), cup: pick('cup') };
};

describe('a flower in a link', () => {
  it('comes back exactly as it went', () => {
    const r = seeded(11);
    for (let i = 0; i < 500; i++) {
      const g = random(r);
      const code = encode(g);
      expect(code).toMatch(/^[A-Za-z0-9_-]+$/);
      expect(code).toHaveLength(CODE_LENGTH);
      expect(decode(code)).toEqual(g);
    }
    for (const g of STARTERS) expect(decode(encode(g))).toEqual(g);
  });

  it('turns away anything that is not one of ours', () => {
    const good = encode(STARTERS[0]);
    const bad: unknown[] = [
      undefined,
      null,
      42,
      {},
      [],
      '',
      ' ',
      good.slice(0, -1),
      `${good}A`,
      good.toLowerCase() === good ? good.toUpperCase() : good.toLowerCase(),
      `x${good.slice(1)}`,
      good.replace(/.$/, (c) => (c === 'A' ? 'B' : 'A')),
      `${good.slice(0, 5)}${good[5] === 'A' ? 'B' : 'A'}${good.slice(6)}`,
      '<img src=x onerror=alert(1)>',
      '"><script>alert(1)</script>',
      '__proto__',
      'constructor',
      'f'.repeat(13),
      'f%20AAAAAAAAAAA',
      'fAAAAAA AAAAA',
      'fAAAAAAAAAAA\u0000',
      'fAAAAAAAAAAA\n',
      'ｆAAAAAAAAAAAA',
      'f'.repeat(100_000),
    ];
    for (const b of bad) expect(decode(b), String(b).slice(0, 40)).toBeNull();
  });

  it('clamps whatever a well-formed code says into the ranges', () => {
    // Every possible pattern of data letters that passes its check decodes to a flower inside the ranges.
    const r = seeded(5);
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
    let found = 0;
    for (let i = 0; i < 20_000; i++) {
      let s = 'f';
      for (let k = 0; k < 12; k++) s += letters[Math.floor(r() * 64)];
      const g = decode(s);
      if (!g) continue;
      found++;
      expect(inRange(g), s).toBe(true);
      // And it encodes to a code that decodes to the same flower.
      expect(decode(encode(g))).toEqual(g);
    }
    expect(found).toBeGreaterThan(100);
    // The petals field can say 0..15; it's held to 3..12.
    expect(clampGenome({ ...STARTERS[0], petals: 15 }).petals).toBe(12);
    expect(clampGenome({ ...STARTERS[0], petals: -4 }).petals).toBe(3);
    expect(clampGenome({ ...STARTERS[0], size: NaN }).size).toBe(0);
  });
});

describe('breeding', () => {
  it('takes after its parents, with only so much going its own way', () => {
    const r = seeded(99);
    let changed = 0;
    let traitsSeen = 0;
    for (let i = 0; i < 3000; i++) {
      const a = STARTERS[Math.floor(r() * STARTERS.length)];
      const b = STARTERS[Math.floor(r() * STARTERS.length)];
      const child = cross(a, b, r);
      expect(inRange(child)).toBe(true);
      const fa = flat(a);
      const fb = flat(b);
      for (const [k, x] of Object.entries(flat(child))) {
        traitsSeen++;
        if (k.endsWith('.h')) {
          // A hue is one parent's, or between them, give or take a little drift (or a sport).
          const gap = (p: number, q: number) => Math.min(Math.abs(p - q), 64 - Math.abs(p - q));
          if (Math.min(gap(x, fa[k]), gap(x, fb[k])) > gap(fa[k], fb[k]) / 2 + 2) changed++;
        } else if (x < Math.min(fa[k], fb[k]) - 1 || x > Math.max(fa[k], fb[k]) + 1) changed++;
      }
    }
    // Nearly everything comes from the parents; a few percent of traits jump.
    expect(changed / traitsSeen).toBeLessThan(0.03);
    expect(changed).toBeGreaterThan(0);
  });

  it('is the same seed every time for the same garden and parents', () => {
    const g = starter(0);
    const a = seedFrom(g, STARTERS[0], STARTERS[1]);
    expect(seedFrom(g, STARTERS[0], STARTERS[1])).toEqual(a);
    g.crosses++;
    expect(encode(seedFrom(g, STARTERS[0], STARTERS[1]))).not.toBe(encode(a));
  });

  it('sometimes surprises: a striped sport, a double, a rare blue', () => {
    const r = seeded(3);
    const plainSingle = STARTERS[0];
    let stripes = 0;
    let doubles = 0;
    let blues = 0;
    for (let i = 0; i < 4000; i++) {
      const c = cross(plainSingle, plainSingle, r);
      if (c.pattern === 1) stripes++;
      if (c.double) doubles++;
      if (WANTED.find((w) => w.id === 'blue-moon')!.test(c)) blues++;
    }
    expect(stripes / 4000).toBeGreaterThan(MUTATION.striped * 0.5);
    expect(stripes / 4000).toBeLessThan(MUTATION.striped * 2);
    expect(doubles / 4000).toBeGreaterThan(MUTATION.double * 0.5);
    expect(blues / 4000).toBeLessThan(0.01);
  });

  it('names each flower, and describes it in plain words', () => {
    for (const g of STARTERS) {
      expect(latinName(g)).toMatch(/^[A-Z][a-z]+ [a-z]+( [a-z]+)*$/);
      expect(gardenName(g)).toMatch(/^[A-Z][a-z]+ [A-Z][a-z]+$/);
      expect(say(g)).toMatch(/petals/);
      expect(say(g)).not.toMatch(/—|undefined|NaN/);
      for (const t of traits(g)) expect(t.text).not.toMatch(/undefined|NaN/);
    }
    // The starters all have names of their own.
    expect(new Set(STARTERS.map(gardenName)).size).toBe(STARTERS.length);
  });
});

describe('the seed catalog', () => {
  it('wants between six and ten flowers, easy to hard, none of them already in the house', () => {
    expect(WANTED.length).toBeGreaterThanOrEqual(6);
    expect(WANTED.length).toBeLessThanOrEqual(10);
    expect(new Set(WANTED.map((w) => w.difficulty))).toEqual(new Set([1, 2, 3]));
    for (const w of WANTED) {
      expect(w.test(w.example), w.id).toBe(true);
      expect(w.near(w.example), w.id).toBe(1);
      for (const s of STARTERS) expect(w.test(s), `${w.id} is a starter`).toBe(false);
    }
  });

  /**
   * Breeds toward a wanted flower the way a patient visitor would: cross the two
   * closest (now and then a closest with anything else), keep a seedling if
   * there's a pot or it beats the worst, sixteen pots at most.
   */
  const breedToward = (id: string, seed: number, limit: number) => {
    const w = WANTED.find((x) => x.id === id)!;
    const r = seeded(seed);
    const pots: Genome[] = STARTERS.map((g) => ({ ...g }));
    for (let n = 1; n <= limit; n++) {
      const ranked = [...pots].sort((p, q) => w.near(q) - w.near(p));
      const a = ranked[0];
      const others = ranked.filter((p) => encode(p) !== encode(a));
      const b = others.length && r() < 0.75 ? others[Math.floor(r() * Math.min(3, others.length))] : pots[Math.floor(r() * pots.length)];
      const child = cross(a, b, r);
      if (w.test(child)) return n;
      if (pots.length < POTS) pots.push(child);
      else {
        const worst = ranked[ranked.length - 1];
        if (w.near(child) >= w.near(worst)) pots[pots.indexOf(worst)] = child;
      }
    }
    return Infinity;
  };

  it('can breed every wanted flower from the first seeds, in sixteen pots', () => {
    const report: Record<string, number[]> = {};
    for (const w of WANTED) {
      report[w.id] = [1, 2, 3, 4, 5, 6].map((seed) => breedToward(w.id, seed * 7919 + w.id.length, 600));
      for (const n of report[w.id]) expect(n, `${w.id}: ${report[w.id]}`).toBeLessThan(600);
    }
    // The easy ones come quickly; the prizes take longer.
    const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
    for (const w of WANTED.filter((x) => x.difficulty === 1)) expect(median(report[w.id]), w.id).toBeLessThan(25);
  });
});

describe('the garden kept in the browser', () => {
  const now = 1_800_000_000_000;

  it('starts with the first seeds in bloom, half the pots free', () => {
    const g = starter(now);
    expect(g.pots).toHaveLength(POTS);
    expect(g.pots.filter(Boolean)).toHaveLength(STARTERS.length);
    expect(g.pots.filter((p) => !p).length).toBeGreaterThanOrEqual(6);
    for (const p of g.pots) if (p) expect(growth(p, now)).toBe(1);
  });

  it('comes back as it was kept', () => {
    const g = starter(now);
    g.pots[0] = { code: encode(STARTERS[2]), born: now - 1000, watered: now - 5000, parents: [encode(STARTERS[0]), encode(STARTERS[1])], gift: false };
    g.crosses = 3;
    g.stamps = ['sunset'];
    g.composted = 2;
    expect(restore(serialize(g), now)).toEqual(g);
  });

  it('starts over on anything odd', () => {
    const fresh = starter(now);
    const good = JSON.parse(serialize(fresh)!);
    const variants: unknown[] = [
      null,
      '',
      'not json',
      '[]',
      '{}',
      JSON.stringify({ ...good, v: 2 }),
      JSON.stringify({ ...good, pots: good.pots.slice(1) }),
      JSON.stringify({ ...good, pots: [...good.pots, null] }),
      JSON.stringify({ ...good, pots: good.pots.map((p: unknown, i: number) => (i === 1 ? { ...(p as object), code: 'nope' } : p)) }),
      JSON.stringify({ ...good, pots: good.pots.map((p: unknown, i: number) => (i === 1 ? { ...(p as object), born: 'yesterday' } : p)) }),
      JSON.stringify({ ...good, pots: good.pots.map((p: unknown, i: number) => (i === 1 ? { ...(p as object), parents: ['<b>x</b>', 'y'] } : p)) }),
      JSON.stringify({ ...good, pots: good.pots.map((p: unknown, i: number) => (i === 1 ? 'a plant' : p)) }),
      JSON.stringify({ ...good, pots: good.pots.map((p: unknown, i: number) => (i === 1 ? [1, 2] : p)) }),
      `{"v":1,"pots":${JSON.stringify(good.pots)},"stamps":[${'"x",'.repeat(10_000)}"y"]}`,
    ];
    for (const raw of variants) expect(restore(raw as string, now), String(raw).slice(0, 60)).toEqual(fresh);
  });

  it('keeps only what it knows, and nothing from the future', () => {
    const fresh = starter(now);
    const good = JSON.parse(serialize(fresh)!);
    const odd = restore(
      JSON.stringify({ ...good, stamps: ['sunset', 'sunset', '__proto__', 'toString', 'not-a-flower', 3], crosses: -5, composted: 1e12, __proto__: { polluted: true }, extra: 'ignored' }),
      now,
    );
    expect(odd.stamps).toEqual(['sunset']);
    expect(odd.crosses).toBe(0);
    expect(odd.composted).toBe(1e6);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    const future = JSON.parse(serialize(fresh)!);
    future.pots[1].born = now + 1e9;
    future.pots[1].watered = now + 1e9;
    const back = restore(JSON.stringify(future), now);
    expect(back.pots[1]!.born).toBe(now);
    expect(back.pots[1]!.watered).toBe(now);
    expect(serialize(back)!.length).toBeLessThan(MAX_SAVED);
  });

  it('grows in about twenty seconds, and droops gently if left dry, never worse', () => {
    const p = { code: encode(STARTERS[0]), born: now, watered: now, parents: null, gift: false };
    expect(growth(p, now + GROW_MS / 2)).toBeCloseTo(0.5);
    expect(growth(p, now + GROW_MS * 3)).toBe(1);
    expect(thirst(p, now + 60_000)).toBe(0);
    expect(thirst(p, now + 1e12)).toBe(1);
  });
});
