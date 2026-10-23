// The visitor's garden: what's in each pot, when it was sown and last watered,
// which flowers it came from, and which of the catalog's pages have their
// rosette. Kept in this browser's own storage and nowhere else; anything read
// back from there is checked as if a stranger had written it, and anything odd
// means a fresh start from the first seeds. Plain numbers, for the tests.
import { cross, decode, encode, hash, seeded, STARTERS, WANTED, type Genome } from './genome';
import { POTS } from './plan';

export { POTS };
/** Seed to full bloom, in milliseconds. */
export const GROW_MS = 20_000;
/** How long a plant goes happily without water, and how long after that until it's drooping as far as it ever will. */
export const THIRST_MS = 9 * 60_000;
export const WILT_MS = 10 * 60_000;

export const STORE_KEY = 'ew.greenhouse.v1';
/** Bigger than this, a saved garden isn't one of ours. */
export const MAX_SAVED = 24_000;

export interface Plant {
  /** The genome, as its code. */
  code: string;
  /** When it was sown, and when it was last watered (ms since 1970). */
  born: number;
  watered: number;
  /** The codes of the two flowers it was crossed from, or null for a first seed or a gift. */
  parents: [string, string] | null;
  /** Came by link, from a friend. */
  gift: boolean;
}

export interface Garden {
  v: 1;
  pots: (Plant | null)[];
  /** How many crosses so far: the seed for the next one. */
  crosses: number;
  /** The catalog's wanted flowers already bred. */
  stamps: string[];
  /** Plants gone back to the soil, for the compost bin's card. */
  composted: number;
  /** A gift that came while every pot was full: it waits on the potting bench for room. */
  waiting: Plant | null;
}

/** The first visit: the starter flowers in bloom, spread along both tiers with room between to breed. */
export function starter(now: number): Garden {
  const pots: (Plant | null)[] = Array.from({ length: POTS }, () => null);
  const where = [1, 3, 5, 7, 8, 10, 12, 14];
  STARTERS.forEach((g, i) => (pots[where[i]] = { code: encode(g), born: now - GROW_MS * 4, watered: now, parents: null, gift: false }));
  return { v: 1, pots, crosses: 0, stamps: [], composted: 0, waiting: null };
}

/** The age of a plant, 0 (just sown) to 1 (in full bloom). */
export const growth = (p: Plant, now: number, speed = 1) => Math.min(1, Math.max(0, ((now - p.born) * speed) / GROW_MS));
/** How thirsty, 0 (fine) to 1 (drooping as far as it goes). It never gets worse than that. */
export const thirst = (p: Plant, now: number) => Math.min(1, Math.max(0, (now - p.watered - THIRST_MS) / WILT_MS));
export const inBloom = (p: Plant, now: number, speed = 1) => growth(p, now, speed) >= 0.86;

/** Crosses two plants into a seed, the same way every time for the same garden. */
export function seedFrom(garden: Garden, a: Genome, b: Genome): Genome {
  const r = seeded(hash(`${encode(a)}${encode(b)}${garden.crosses}`));
  return cross(a, b, r);
}

export const emptyPot = (garden: Garden) => garden.pots.findIndex((p) => !p);

/**
 * Crosses the plants in pots a and b and sows the seed in the first empty pot.
 * Returns the pot it went in and the seedling's genome, or null if the
 * garden is full or either plant isn't there.
 */
export function sow(garden: Garden, a: number, b: number, now: number): { pot: number; genome: Genome } | null {
  const pa = garden.pots[a];
  const pb = garden.pots[b];
  const ga = pa && decode(pa.code);
  const gb = pb && decode(pb.code);
  const pot = emptyPot(garden);
  if (!pa || !pb || !ga || !gb || pot < 0) return null;
  const genome = seedFrom(garden, ga, gb);
  garden.crosses++;
  garden.pots[pot] = { code: encode(genome), born: now, watered: now, parents: [pa.code, pb.code], gift: false };
  return { pot, genome };
}

/** A drink: no more thirst for a good while. */
export function water(garden: Garden, pot: number, now: number) {
  const p = garden.pots[pot];
  if (p) p.watered = now;
  return !!p;
}

/** Cut back to its leaves: it comes into flower again from there, and it's watered while you're at it. */
export function prune(garden: Garden, pot: number, now: number) {
  const p = garden.pots[pot];
  if (!p) return false;
  const leafy = GROW_MS * 0.45;
  p.born = Math.max(p.born, now - leafy);
  p.watered = now;
  return true;
}

/** Out of the pot and onto the heap. Then a waiting gift, if there is one, can have the pot. */
export function compost(garden: Garden, pot: number) {
  if (!garden.pots[pot]) return false;
  garden.pots[pot] = null;
  garden.composted = Math.min(1e6, garden.composted + 1);
  settle(garden);
  return true;
}

/** A gift waiting on the bench goes into a pot as soon as there's one free. */
export function settle(garden: Garden) {
  const pot = emptyPot(garden);
  if (!garden.waiting || pot < 0) return -1;
  garden.pots[pot] = garden.waiting;
  garden.waiting = null;
  return pot;
}

/**
 * A flower from a friend's link: the code is checked as untrusted (see decode);
 * anything that isn't one of ours is ignored. The same gift twice is only
 * planted once. Returns the pot it's in (or -1 if it's waiting on the bench for
 * room), or null for a code that isn't a flower.
 */
export function receive(garden: Garden, code: unknown, now: number): number | null {
  if (!decode(code)) return null;
  const c = code as string;
  const already = garden.pots.findIndex((p) => p?.gift && p.code === c);
  if (already >= 0) return already;
  if (garden.waiting?.code === c) return -1;
  const plant: Plant = { code: c, born: now, watered: now, parents: null, gift: true };
  const pot = emptyPot(garden);
  if (pot < 0) {
    garden.waiting = plant;
    return -1;
  }
  garden.pots[pot] = plant;
  return pot;
}

/** The link that shares a flower. */
export const shareLink = (origin: string, code: string) => `${origin}/?bloom=${code}`;

/** The wanted flowers this one is, not yet stamped. */
export const newStamps = (garden: Garden, g: Genome) => WANTED.filter((w) => !garden.stamps.includes(w.id) && w.test(g)).map((w) => w.id);

const finite = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);
const own = (o: object, k: string): unknown => (Object.hasOwn(o, k) ? (o as Record<string, unknown>)[k] : undefined);

/** One saved pot, checked: a plant with a code that decodes, sensible times and real parents; or null. */
function plantFrom(x: unknown, now: number): Plant | null | 'bad' {
  if (x === null) return null;
  if (typeof x !== 'object' || Array.isArray(x)) return 'bad';
  const code = own(x, 'code');
  const born = own(x, 'born');
  const watered = own(x, 'watered');
  const parents = own(x, 'parents');
  const gift = own(x, 'gift');
  if (!decode(code) || !finite(born) || !finite(watered)) return 'bad';
  let kin: [string, string] | null = null;
  if (parents !== null && parents !== undefined) {
    if (!Array.isArray(parents) || parents.length !== 2 || !parents.every((p) => decode(p))) return 'bad';
    kin = [parents[0] as string, parents[1] as string];
  }
  // Times from the future (a clock set wrong) are taken as now.
  return { code: code as string, born: Math.min(born, now), watered: Math.min(Math.max(watered, 0), now), parents: kin, gift: gift === true };
}

/**
 * A saved garden, checked as untrusted: the right version, sixteen pots each
 * empty or a plant that passes, counters that are whole and small, stamps
 * only for flowers the catalog has. Anything else, a fresh starter garden.
 */
export function restore(raw: string | null | undefined, now: number): Garden {
  if (typeof raw !== 'string' || !raw || raw.length > MAX_SAVED) return starter(now);
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return starter(now);
  }
  if (!data || typeof data !== 'object' || Array.isArray(data) || own(data, 'v') !== 1) return starter(now);
  const pots = own(data, 'pots');
  if (!Array.isArray(pots) || pots.length !== POTS) return starter(now);
  const out: (Plant | null)[] = [];
  for (const p of pots) {
    const plant = plantFrom(p, now);
    if (plant === 'bad') return starter(now);
    out.push(plant);
  }
  const count = (k: string) => {
    const x = own(data as object, k);
    return finite(x) && x >= 0 ? Math.min(1e6, Math.floor(x)) : 0;
  };
  const stamps = own(data, 'stamps');
  const known = WANTED.map((w) => w.id);
  const kept = Array.isArray(stamps) ? known.filter((id) => stamps.includes(id)) : [];
  const waiting = plantFrom(own(data, 'waiting') ?? null, now);
  if (waiting === 'bad') return starter(now);
  return { v: 1, pots: out, crosses: count('crosses'), stamps: kept, composted: count('composted'), waiting };
}

/** The garden as it's kept, or null if it somehow grew too big to keep. */
export function serialize(garden: Garden): string | null {
  const s = JSON.stringify({ v: 1, pots: garden.pots, crosses: garden.crosses, stamps: garden.stamps, composted: garden.composted, waiting: garden.waiting });
  return s.length <= MAX_SAVED ? s : null;
}

/** Reads this browser's garden (or the first seeds). */
export function load(now = Date.now()): Garden {
  try {
    return restore(localStorage.getItem(STORE_KEY), now);
  } catch {
    return starter(now);
  }
}

export function keep(garden: Garden) {
  const s = serialize(garden);
  if (!s) return;
  try {
    localStorage.setItem(STORE_KEY, s);
  } catch {
    // Nowhere to keep it; the garden still grows this visit.
  }
}

export function forget() {
  try {
    localStorage.removeItem(STORE_KEY);
  } catch {
    // Nothing kept to forget.
  }
}
