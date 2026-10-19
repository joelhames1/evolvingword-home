import { describe, expect, it } from 'vitest';
import inferno from '../../public/books/inferno.json';
import odyssey from '../../public/books/odyssey.json';
import paradiso from '../../public/books/paradiso.json';
import poe from '../../public/books/poe.json';
import purgatorio from '../../public/books/purgatorio.json';
import rubaiyat from '../../public/books/rubaiyat.json';
import type { GeometryCollection, Topology } from 'topojson-specification';
import world from 'world-atlas/countries-110m.json';
import { BOOKS, type Book, type Piece } from '../../src/books';
import { MEDALS, POEMS, VISITED, WORK } from '../../src/content';
import { ALPHABET } from '../../src/evolve';
import { MODULES, PHRASES, pad } from '../../src/worlds/alps/flap';
import { mapName } from '../../src/places';
import { paginate } from '../../src/reader';

/** The long books' text, as the page fetches it from public/books. */
const TEXTS: Record<string, { pieces: Piece[] }> = { inferno, purgatorio, paradiso, odyssey, poe, rubaiyat };
const loaded = (b: Book): Book => (b.src ? { ...b, pieces: TEXTS[b.id].pieces } : b);

describe('the library', () => {
  it('opens every book on a title page and gives each piece one heading', () => {
    for (const book of BOOKS.map(loaded)) {
      const pages = paginate(book);
      expect(pages[0]).toEqual({ kind: 'title', book });
      const headings = pages.flatMap((p) => (p.kind === 'text' && p.heading ? [p.heading] : []));
      expect(headings).toEqual(book.pieces.map((p) => p.title));
    }
  });

  it('keeps verse to a page, running long stanzas over', () => {
    for (const book of BOOKS.map(loaded)) {
      for (const page of paginate(book)) {
        if (page.kind !== 'text' || page.prose) continue;
        const rows = page.lines.reduce((n, l) => n + Math.max(1, Math.ceil(l.trimEnd().length / 52)), 0);
        expect(rows, `${book.id}: ${page.heading ?? page.lines[0]}`).toBeLessThanOrEqual(22);
      }
    }
  });

  it('has a contents page that points at each piece', () => {
    for (const book of BOOKS.map(loaded)) {
      const pages = paginate(book);
      const entries = pages.flatMap((p) => (p.kind === 'contents' ? p.entries : []));
      if (book.pieces.length <= 4) {
        expect(entries).toEqual([]);
        continue;
      }
      expect(entries.map((e) => e.title)).toEqual(book.pieces.map((p) => p.title));
      for (const e of entries) {
        const page = pages[e.page];
        expect(page.kind === 'text' && page.heading, `${book.id} ${e.title}`).toBe(e.title);
      }
    }
  });

  it('ships the long books, and the Inferno starts in the dark wood', () => {
    const inferno = loaded(BOOKS.find((b) => b.id === 'inferno')!);
    expect(inferno.pieces).toHaveLength(34);
    expect(inferno.pieces[0].text).toMatch(/^Midway upon the journey of our life/);
    expect(loaded(BOOKS.find((b) => b.id === 'odyssey')!).pieces).toHaveLength(24);
    for (const b of BOOKS.map(loaded)) expect(JSON.stringify(b.pieces)).not.toMatch(/Gutenberg/i);
  });

  it('has unique ids, so the shelf can find each book', () => {
    expect(new Set(BOOKS.map((b) => b.id)).size).toBe(BOOKS.length);
  });
});

describe('the scratch map', () => {
  it('can draw every country on the visited list', () => {
    const topo = world as unknown as Topology<{ countries: GeometryCollection<{ name: string }> }>;
    const names = new Set(topo.objects.countries.geometries.map((g) => (g.properties as { name?: string } | undefined)?.name ?? ''));
    for (const country of VISITED) expect(mapName(country, names), country).not.toBeNull();
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

describe('the content', () => {
  it('has a medal for each distance, the poems, and the work history', () => {
    expect(MEDALS.map((m) => m.face)).toEqual(['5K', '10K', '13.1', '26.2']);
    expect(POEMS).toHaveLength(5);
    for (const poem of POEMS) {
      expect(poem.lines[0]).toBeTruthy();
      expect(poem.lines.at(-1)).toBeTruthy();
    }
    expect(WORK[0].company).toBe('ParentSquare');
  });
});
