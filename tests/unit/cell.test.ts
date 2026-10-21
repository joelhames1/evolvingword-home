import { describe, expect, it } from 'vitest';
import { ALPHABET, clean, MAX_PHRASE } from '../../src/evolve';
import { BASES, codon, complement, letter, offset, PAIR, PHRASES, strand } from '../../src/worlds/cell/dna';
import { CHORDS, length, TUNES } from '../../src/worlds/cell/sound';

describe('the living word', () => {
  it('only breeds phrases that fit, in letters the strand can spell', () => {
    for (const phrase of PHRASES) {
      expect(clean(phrase), phrase).toBe(phrase);
      expect(phrase.length).toBeLessThanOrEqual(MAX_PHRASE);
    }
    expect(PHRASES[0]).toBe('EVOLVING WORD');
    expect(PHRASES).toEqual(expect.arrayContaining(['IN THE BEGINNING', 'THE WORD']));
  });

  it('spells every letter with its own three bases, and reads them back', () => {
    const seen = new Set<string>();
    for (const ch of ALPHABET) {
      const c = codon(ch);
      expect(c).toMatch(/^[ACGT]{3}$/);
      expect(letter(c), ch).toBe(ch);
      seen.add(c);
    }
    expect(seen.size).toBe(ALPHABET.length);
    // The codons left over spell nothing.
    expect(letter('TTT')).toBeNull();
    expect(letter('AXA')).toBeNull();
    expect(letter('AC')).toBeNull();
  });

  it('pairs A with T and C with G, both ways', () => {
    for (const b of BASES) expect(PAIR[PAIR[b]]).toBe(b);
    expect(PAIR.A).toBe('T');
    expect(PAIR.C).toBe('G');
    const s = strand('THE WORD');
    expect(s).toHaveLength(8 * 3);
    expect(complement(complement(s))).toBe(s);
    for (let i = 0; i < s.length; i++) expect(complement(s)[i]).toBe(PAIR[s[i]]);
  });

  it('centers each phrase on the strand', () => {
    expect(offset('IN THE BEGINNING')).toBe(0);
    expect(offset('THE WORD')).toBe(4);
    for (const p of PHRASES) {
      expect(offset(p)).toBeGreaterThanOrEqual(0);
      expect(offset(p) + p.length).toBeLessThanOrEqual(MAX_PHRASE);
    }
  });

  it('keeps every phrase of the tune to its eight bars', () => {
    for (const t of TUNES) expect(length(t)).toBe(8 * 16);
    expect(CHORDS).toHaveLength(4);
    // Each chord's voices sit above its bass.
    for (const c of CHORDS) expect(Math.min(...c.notes)).toBeGreaterThan(c.bass);
  });
});
