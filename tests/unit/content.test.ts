import { describe, expect, it } from 'vitest';
import type { GeometryCollection, Topology } from 'topojson-specification';
import world from 'world-atlas/countries-110m.json';
import { BOOKS } from '../../src/books';
import { MEDALS, POEMS, VISITED } from '../../src/content';
import { ALPHABET } from '../../src/evolve';
import { MODULES, PHRASES, pad } from '../../src/flap';
import { paginate } from '../../src/reader';

describe('the library', () => {
  it('opens every book on a title page and gives each piece one heading', () => {
    for (const book of BOOKS) {
      const pages = paginate(book);
      expect(pages[0]).toEqual({ kind: 'title', book });
      const headings = pages.flatMap((p) => (p.kind === 'text' && p.heading ? [p.heading] : []));
      expect(headings).toEqual(book.pieces.map((p) => p.title));
    }
  });

  it('keeps verse pages to a page, unless one stanza is longer than that', () => {
    for (const book of BOOKS) {
      for (const page of paginate(book)) {
        if (page.kind !== 'text' || page.prose || page.lines.length <= 22) continue;
        expect(page.lines).not.toContain('');
      }
    }
  });

  it('has unique ids, so the shelf can find each book', () => {
    expect(new Set(BOOKS.map((b) => b.id)).size).toBe(BOOKS.length);
  });
});

describe('the scratch map', () => {
  it('only lists countries the map knows by name', () => {
    const topo = world as unknown as Topology<{ countries: GeometryCollection<{ name: string }> }>;
    const names = new Set(topo.objects.countries.geometries.map((g) => (g.properties as { name?: string } | undefined)?.name));
    for (const country of VISITED) expect(names, country).toContain(country);
  });
});

describe('the board', () => {
  it('only shows phrases that fit, in letters it has', () => {
    for (const phrase of PHRASES) {
      expect(phrase.length).toBeLessThanOrEqual(MODULES);
      for (const ch of phrase) expect(ALPHABET).toContain(ch);
    }
  });

  it('centers a phrase across every module', () => {
    expect(pad('OUR STUDIO')).toBe('   OUR STUDIO   ');
    expect(pad('X'.repeat(20))).toHaveLength(MODULES);
  });
});

describe('the placeholders', () => {
  it('has a medal for each distance and something for the pen to write', () => {
    expect(MEDALS.map((m) => m.distance)).toHaveLength(4);
    expect(POEMS.length).toBeGreaterThan(0);
    for (const poem of POEMS) expect(poem.lines.length).toBeLessThanOrEqual(12);
  });
});
