import { describe, expect, it } from 'vitest';
import { ALPHABET, clean, MAX_PHRASE } from '../../src/evolve';
import { MAX_WORLDS, WORLDS } from '../../src/worlds';
import { SHOWN } from '../../src/worlds/shown';
import { PHRASES as LAKE } from '../../src/worlds/alps/flap';
import { PHRASES as CITY } from '../../src/worlds/city/city';
import { PHRASES as BAND } from '../../src/worlds/monastery/band';
import { DEST, FONT, glyph, PHRASES as DEPARTURES } from '../../src/worlds/tower/board';

describe('the worlds', () => {
  it('has every world, and shows no more globes than the chooser is laid out for', () => {
    expect(WORLDS.length).toBeGreaterThanOrEqual(4);
    expect(SHOWN.length).toBeLessThanOrEqual(MAX_WORLDS);
    for (const id of SHOWN) expect(WORLDS.map((w) => w.id)).toContain(id);
    expect(new Set(WORLDS.map((w) => w.id)).size).toBe(WORLDS.length);
    expect(WORLDS.map((w) => w.id)).toEqual(expect.arrayContaining(['alps', 'city', 'tower', 'monastery']));
  });

  it('has a still in the globe for every world', () => {
    const stills = Object.keys(import.meta.glob('/public/worlds/*.jpg')).map((p) => p.replace('/public', ''));
    for (const w of WORLDS) expect(stills, w.still).toContain(w.still);
  });

  it('gives the new worlds their own weather in the glass', () => {
    const weather = Object.fromEntries(WORLDS.map((w) => [w.id, w.weather]));
    expect(weather).toMatchObject({ alps: 'snow', city: 'rain', tower: 'mist', monastery: 'petals' });
  });
});

describe('every word board', () => {
  it('only breeds phrases that fit, in letters it can show', () => {
    for (const phrase of [...LAKE, ...CITY, ...DEPARTURES, ...BAND]) {
      expect(clean(phrase), phrase).toBe(phrase);
      expect(phrase.length).toBeLessThanOrEqual(MAX_PHRASE);
    }
  });

  it('quotes the Canticle on the monastery band', () => {
    expect(BAND).toEqual(expect.arrayContaining(['OUR BROTHER SUN', 'OUR SISTER MOON', 'SISTER WATER']));
  });
});

describe('the departures board', () => {
  it('has a five-by-seven glyph for every letter a visitor can type', () => {
    for (const ch of ALPHABET) {
      expect(FONT[ch], `missing "${ch}"`).toBeDefined();
      expect(FONT[ch]).toMatch(/^[.#]{35}$/);
    }
  });

  it('draws letters the right way up', () => {
    // The T: a full bar on top, then a single dot down the middle.
    const t = glyph('T').map((row) => row.map((on) => (on ? '#' : '.')).join(''));
    expect(t[0]).toBe('#####');
    expect(t.slice(1).every((row) => row === '..#..')).toBe(true);
    // An L the other way round: down the left, a bar along the bottom.
    expect(glyph('L')[6].every(Boolean)).toBe(true);
  });

  it('leaves room on the destination line for the longest phrase', () => {
    expect(DEST).toBe(MAX_PHRASE);
  });
});
