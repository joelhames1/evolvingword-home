import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { ALPHABET, clean, MAX_PHRASE } from '../../src/evolve';
import { WORLDS } from '../../src/worlds';
import { PHRASES } from '../../src/worlds/greenhouse/bed';
import { daisyGeometry, spireGeometry } from '../../src/worlds/greenhouse/grounds';
import { regroup } from '../../src/worlds/greenhouse/studio';
import { DRONE, SCALE } from '../../src/worlds/greenhouse/sound';
import { FONT } from '../../src/worlds/tower/board';
import { compost, emptyPot, GROW_MS, growth, inBloom, MAX_SAVED, POTS, prune, receive, restore, seedFrom, serialize, settle, shareLink, sow, starter, thirst, water } from '../../src/worlds/greenhouse/garden';
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

describe('gardening', () => {
  const now = 1_800_000_000_000;

  it('sows a cross in the first empty pot, with its parents on it', () => {
    const g = starter(now);
    const a = g.pots.findIndex(Boolean);
    const b = g.pots.findIndex((p, i) => p && i > a);
    const free = emptyPot(g);
    const sown = sow(g, a, b, now)!;
    expect(sown.pot).toBe(free);
    expect(g.pots[free]!.parents).toEqual([g.pots[a]!.code, g.pots[b]!.code]);
    expect(decode(g.pots[free]!.code)).toEqual(sown.genome);
    expect(growth(g.pots[free]!, now)).toBe(0);
    expect(inBloom(g.pots[free]!, now + GROW_MS)).toBe(true);
    expect(g.crosses).toBe(1);
  });

  it('won\'t sow into a full garden, or from an empty pot', () => {
    const g = starter(now);
    const empty = emptyPot(g);
    expect(sow(g, empty, g.pots.findIndex(Boolean), now)).toBeNull();
    while (emptyPot(g) >= 0) sow(g, g.pots.findIndex(Boolean), g.pots.findIndex(Boolean), now);
    expect(g.pots.every(Boolean)).toBe(true);
    expect(sow(g, 0, 1, now)).toBeNull();
  });

  it('waters, cuts back to the leaves, and composts to make room', () => {
    const g = starter(now - 3_600_000);
    const i = g.pots.findIndex(Boolean);
    const later = now + 3_600_000;
    expect(thirst(g.pots[i]!, later)).toBe(1);
    water(g, i, later);
    expect(thirst(g.pots[i]!, later)).toBe(0);
    prune(g, i, later);
    expect(growth(g.pots[i]!, later)).toBeCloseTo(0.45);
    expect(inBloom(g.pots[i]!, later + GROW_MS)).toBe(true);
    const before = g.pots.filter(Boolean).length;
    expect(compost(g, i)).toBe(true);
    expect(g.pots[i]).toBeNull();
    expect(g.pots.filter(Boolean).length).toBe(before - 1);
    expect(g.composted).toBe(1);
    expect(compost(g, i)).toBe(false);
  });

  it('takes a gift from a link into an empty pot, once, and only a real one', () => {
    const g = starter(now);
    const code = encode(WANTED[0].example);
    const pot = receive(g, code, now)!;
    expect(pot).toBeGreaterThanOrEqual(0);
    expect(g.pots[pot]).toMatchObject({ code, gift: true, parents: null });
    // The same link again doesn't plant it twice.
    expect(receive(g, code, now)).toBe(pot);
    expect(g.pots.filter((p) => p?.code === code)).toHaveLength(1);
    // Anything else in the link is ignored, and the garden is untouched.
    const kept = serialize(g);
    for (const bad of ['', 'x', `${code}x`, code.slice(1), '<script>', '__proto__', 'constructor', 'f'.repeat(13), ' '.repeat(13), null, undefined, 7, {}, []]) expect(receive(g, bad, now)).toBeNull();
    expect(serialize(g)).toBe(kept);
  });

  it('keeps a gift waiting on the bench while the garden is full, and pots it as soon as there\'s room', () => {
    const g = starter(now);
    while (emptyPot(g) >= 0) sow(g, g.pots.findIndex(Boolean), g.pots.findIndex(Boolean), now);
    const code = encode(WANTED[3].example);
    expect(receive(g, code, now)).toBe(-1);
    expect(g.waiting?.code).toBe(code);
    expect(receive(g, code, now)).toBe(-1);
    // It survives being kept and read back.
    expect(restore(serialize(g), now).waiting?.code).toBe(code);
    compost(g, 4);
    expect(g.pots[4]?.code).toBe(code);
    expect(g.waiting).toBeNull();
    expect(settle(g)).toBe(-1);
  });

  it('shares a flower as a short link the decoder takes back', () => {
    const code = encode(STARTERS[3]);
    const link = shareLink('https://evolvingword.com', code);
    expect(link).toBe(`https://evolvingword.com/?bloom=${code}`);
    expect(link.length).toBeLessThan(50);
    expect(decode(new URL(link).searchParams.get('bloom'))).toEqual(STARTERS[3]);
  });
});

describe('the greenhouse', () => {
  it('has a globe with pollen in the glass', () => {
    expect(WORLDS.find((w) => w.id === 'greenhouse')).toMatchObject({ name: 'The Greenhouse', weather: 'pollen', still: '/worlds/greenhouse.jpg' });
  });

  it('only beds out phrases that fit, in letters it can plant', () => {
    for (const phrase of PHRASES) {
      expect(clean(phrase), phrase).toBe(phrase);
      expect(phrase.length).toBeLessThanOrEqual(MAX_PHRASE);
    }
    // Every letter a visitor can type has a five-by-seven planting.
    for (const ch of ALPHABET) expect(FONT[ch], ch).toMatch(/^[.#]{35}$/);
  });

  it('gives every note a flower can have a place in the garden\'s chord, over the drone', () => {
    for (let n = 0; n <= 15; n++) expect(SCALE[n], `note ${n}`).toBeDefined();
    expect([...SCALE].sort((a, b) => a - b)).toEqual(SCALE);
    expect(Math.max(...DRONE)).toBeLessThan(Math.min(...SCALE));
  });
});


describe('the garden outside', () => {
  /** Every vertex with a normal that is a number and a unit long: nothing for a shader to turn into a flicker. */
  const sound = (g: THREE.BufferGeometry) => {
    const n = g.attributes.normal;
    const p = g.attributes.position;
    expect(n.count).toBe(p.count);
    for (let i = 0; i < n.count; i++) {
      const len = Math.hypot(n.getX(i), n.getY(i), n.getZ(i));
      expect(Number.isFinite(len) && Math.abs(len - 1) < 1e-3, `normal ${i}`).toBe(true);
      expect([p.getX(i), p.getY(i), p.getZ(i)].every(Number.isFinite), `vertex ${i}`).toBe(true);
    }
    const c = g.attributes.color;
    for (let i = 0; i < c.count; i++) expect(Math.min(c.getX(i), c.getY(i), c.getZ(i)), `shade ${i}`).toBeGreaterThanOrEqual(0);
  };

  it('grows its border spires and flowers with a sound normal at every vertex', () => {
    for (const high of [true, false]) sound(spireGeometry(high));
    sound(daisyGeometry());
  });

  it('builds a spire as florets up a stalk: a meter tall, narrow, smaller toward the tip', () => {
    const g = spireGeometry(true);
    g.computeBoundingBox();
    const box = g.boundingBox!;
    expect(box.min.y).toBeGreaterThanOrEqual(-0.05);
    expect(box.max.y).toBeLessThan(1.1);
    expect(box.max.y).toBeGreaterThan(0.9);
    expect(box.max.x - box.min.x).toBeLessThan(0.2);
  });

  it('draws a book once for each material, not once for each side', () => {
    const a = new THREE.MeshBasicMaterial();
    const b = new THREE.MeshBasicMaterial();
    const c = new THREE.MeshBasicMaterial();
    const geo = new THREE.BoxGeometry(1, 2, 3);
    const before = geo.index!.count;
    const tris = (gg: THREE.BufferGeometry, mats: THREE.Material[]) => {
      const out: string[] = [];
      for (const grp of gg.groups) for (let i = grp.start; i < grp.start + grp.count; i += 3) out.push(`${mats.indexOf(mats[grp.materialIndex!])}:${[0, 1, 2].map((k) => gg.index!.getX(i + k)).join(',')}`);
      return out.sort();
    };
    const mats = [a, a, b, b, c, b];
    const was = tris(geo, mats);
    regroup(geo, mats);
    expect(geo.groups.length).toBe(3);
    expect(geo.index!.count).toBe(before);
    // The same triangles, each with the same material as before.
    expect(tris(geo, mats)).toEqual(was);
  });
});
