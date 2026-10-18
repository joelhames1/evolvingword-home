import { describe, expect, it } from 'vitest';
import { ALPHABET, clean, Evolver, MAX_PHRASE } from '../../src/evolve';
import { rng } from '../../src/textures';

describe('the weasel program', () => {
  it('breeds a phrase out of noise, never getting worse', () => {
    const e = new Evolver(rng(7));
    e.aim('EVOLVING WORD');
    e.scramble();
    let last = e.state().fitness;
    for (let i = 0; i < 2000 && !e.state().done; i++) {
      const g = e.step();
      expect(g.fitness).toBeGreaterThanOrEqual(last);
      last = g.fitness;
    }
    const s = e.state();
    expect(s.done).toBe(true);
    expect(s.text).toBe('EVOLVING WORD');
    // Dawkins' point: selection gets there in dozens of generations, not the
    // 27^13 tries pure chance would need.
    expect(s.generation).toBeLessThan(400);
  });

  it('starts a new phrase from whatever is showing', () => {
    const e = new Evolver(rng(3));
    e.aim('OUR STUDIO');
    while (!e.state().done) e.step();
    e.aim('OUR STUFF');
    const s = e.state();
    expect(s.generation).toBe(0);
    expect(s.text.slice(0, 6)).toBe('OUR ST');
    expect(s.text).toHaveLength('OUR STUFF'.length);
  });

  it('only ever shows letters it knows', () => {
    const e = new Evolver(rng(11));
    e.aim("ROCK & ROLL '99!");
    e.scramble();
    for (let i = 0; i < 50; i++) for (const ch of e.step().text) expect(ALPHABET).toContain(ch);
  });
});

describe('cleaning what people type', () => {
  it('keeps capitals, digits and a little punctuation', () => {
    expect(clean('happy 31st!')).toBe('HAPPY 31ST!');
    expect(clean('  rock   &  roll ')).toBe('ROCK & ROLL');
    expect(clean('don’t stop')).toBe("DON'T STOP");
  });

  it('drops what the billboard cannot show', () => {
    expect(clean('<script>')).toBe('SCRIPT');
    expect(clean('café ☕')).toBe('CAF');
    expect(clean('🙂🙂')).toBe('');
  });

  it('stops at the longest phrase the billboard can hold', () => {
    const long = clean('the quick brown fox jumps over the lazy dog');
    expect(long.length).toBeLessThanOrEqual(MAX_PHRASE);
    expect(long).toBe('THE QUICK BROWN FO');
  });
});
