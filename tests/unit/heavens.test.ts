import { describe, expect, it } from 'vitest';
import { ALPHABET, clean, MAX_PHRASE } from '../../src/evolve';
import { WORLDS } from '../../src/worlds';
import { glyph, PER_LETTER, PHRASES, STROKES } from '../../src/worlds/heavens/board';
import { TARGETS } from '../../src/worlds/heavens/eyepiece';
import { CHORDS, MELODY } from '../../src/worlds/heavens/sound';

describe('the heavens', () => {
  it('has a globe with stars in the glass', () => {
    expect(WORLDS.find((w) => w.id === 'heavens')).toMatchObject({ name: 'The Heavens', weather: 'stars', still: '/worlds/heavens.jpg' });
  });

  it('only breeds phrases that fit, in letters it can show', () => {
    for (const phrase of PHRASES) {
      expect(clean(phrase), phrase).toBe(phrase);
      expect(phrase.length).toBeLessThanOrEqual(MAX_PHRASE);
    }
    expect(PHRASES).toEqual(expect.arrayContaining(['EVOLVING WORD', 'LOOK UP', 'THE HEAVENS', 'MAKE SOMETHING']));
  });
});

describe('the constellation letters', () => {
  it('has a figure for every letter a visitor can type, within the stars each letter has', () => {
    for (const ch of ALPHABET) {
      expect(STROKES[ch], `missing "${ch}"`).toBeDefined();
      const g = glyph(ch);
      expect(g.stars.length, ch).toBeLessThanOrEqual(PER_LETTER);
      if (ch !== ' ') expect(g.stars.length, ch).toBeGreaterThan(0);
      for (const [x, y] of g.stars) {
        expect(x).toBeGreaterThanOrEqual(0);
        expect(x).toBeLessThanOrEqual(4);
        expect(y).toBeGreaterThanOrEqual(-0.5);
        expect(y).toBeLessThanOrEqual(6);
      }
      for (const [a, b] of g.lines) {
        expect(a).not.toBe(b);
        expect(g.stars[a]).toBeDefined();
        expect(g.stars[b]).toBeDefined();
      }
    }
  });

  it('shares a star where strokes meet, and joins them up', () => {
    // An A: two legs meeting at the top, a bar across; five stars, five lines.
    const a = glyph('A');
    expect(a.stars).toHaveLength(5);
    expect(a.lines).toHaveLength(5);
    // The exclamation mark's dot stands alone.
    const bang = glyph('!');
    expect(bang.stars).toHaveLength(4);
    expect(bang.lines).toHaveLength(2);
  });

  it('never draws two letters the same', () => {
    const shapes = new Map<string, string>();
    for (const ch of ALPHABET) {
      if (ch === ' ') continue;
      const key = JSON.stringify(glyph(ch).stars);
      expect(shapes.get(key), `${ch} looks like ${shapes.get(key)}`).toBeUndefined();
      shapes.set(key, ch);
    }
  });
});

describe('the music', () => {
  it('has a phrase of the tune for every chord, inside its two bars', () => {
    expect(MELODY).toHaveLength(CHORDS.length);
    for (const phrase of MELODY)
      for (const [note, start, len] of phrase) {
        expect(start).toBeGreaterThanOrEqual(0);
        expect(start).toBeLessThan(32);
        expect(len).toBeGreaterThan(0);
        expect(note).toBeGreaterThan(55);
        expect(note).toBeLessThan(84);
      }
  });

  it('keeps the bass under the pad', () => {
    for (const c of CHORDS) expect(Math.max(c.bass)).toBeLessThan(Math.min(...c.pad));
  });
});

describe('the telescope', () => {
  it('has Saturn, Jupiter, a nebula and a cluster, all out of the slit and above the horizon', () => {
    expect(TARGETS.map((t) => t.id)).toEqual(['saturn', 'jupiter', 'lagoon', 'cluster']);
    for (const t of TARGETS) {
      expect(Math.abs(t.offset)).toBeLessThan(20);
      expect(t.el).toBeGreaterThan(15);
      expect(t.el).toBeLessThan(66);
      expect(t.lines.length).toBeGreaterThan(0);
    }
  });
});
