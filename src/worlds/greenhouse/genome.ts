// What a flower is made of: a handful of numbers, every one with its range,
// from which the plant is grown (see flower.ts). Two blooms crossed give a seed
// that takes after both, now and then with a surprise: a striped sport, a
// double, a rare blue. A genome packs into thirteen URL-safe letters, for
// sharing a flower by link; a code that comes back is treated as anything a
// stranger might type, and only ever turns into a genome inside these ranges.
// Plain numbers only, so the tests can breed without a browser.

/** A color as the garden mixes it: hue round the wheel (0..63), saturation (0..7), lightness (0..7). */
export interface Tint {
  h: number;
  s: number;
  l: number;
}

export interface Genome {
  /** 3..12 petals to a whorl. */
  petals: number;
  /** 0 round, 1 pointed, 2 frilled, 3 notched. */
  shape: number;
  /** 0 a single bloom, 1 a double (a second, smaller whorl inside). */
  double: number;
  /** The color at the heart of each petal, and at its tip. */
  base: Tint;
  tip: Tint;
  /** 0 plain, 1 stripes, 2 an edge of another color, 3 speckles. */
  pattern: number;
  /** The color of the stripes, the edge or the speckles. */
  mark: Tint;
  /** How big the blooms are (0..7) and how tall the plant grows (0..7). */
  size: number;
  height: number;
  /** Side stems, each with a bloom of its own: 0..3. */
  branches: number;
  /** 0 oval, 1 lance, 2 lobed, 3 heart-shaped leaves. */
  leaf: number;
  /** 0 deep green, 1 bright green, 2 blue-grey, 3 bronze foliage. */
  foliage: number;
  /** 0 none, 1 faint, 2 sweet, 3 heady. */
  scent: number;
  /** Its note in the garden's chord (0..15, up a pentatonic scale). */
  note: number;
  /** How the petals cup: 0 flat open, 3 a deep bowl. */
  cup: number;
}

export const SHAPES = ['round', 'pointed', 'frilled', 'notched'] as const;
export const PATTERNS = ['plain', 'stripes', 'edging', 'speckle'] as const;
export const LEAVES = ['oval', 'lance', 'lobed', 'heart'] as const;

/** Every number in a genome, its bits in a code, and its range. Tints are three fields each. */
const FIELDS: [path: string, bits: number, min: number, max: number][] = [
  ['petals', 4, 3, 12],
  ['shape', 2, 0, 3],
  ['double', 1, 0, 1],
  ['base.h', 6, 0, 63],
  ['base.s', 3, 0, 7],
  ['base.l', 3, 0, 7],
  ['tip.h', 6, 0, 63],
  ['tip.s', 3, 0, 7],
  ['tip.l', 3, 0, 7],
  ['pattern', 2, 0, 3],
  ['mark.h', 6, 0, 63],
  ['mark.s', 3, 0, 7],
  ['mark.l', 3, 0, 7],
  ['size', 3, 0, 7],
  ['height', 3, 0, 7],
  ['branches', 2, 0, 3],
  ['leaf', 2, 0, 3],
  ['foliage', 2, 0, 3],
  ['scent', 2, 0, 3],
  ['note', 4, 0, 15],
  ['cup', 2, 0, 3],
];

const get = (g: Genome, path: string): number => {
  const [a, b] = path.split('.');
  return b ? (g[a as 'base' | 'tip' | 'mark'][b as keyof Tint] as number) : (g[a as keyof Genome] as number);
};
const put = (g: Genome, path: string, x: number) => {
  const [a, b] = path.split('.');
  if (b) g[a as 'base' | 'tip' | 'mark'][b as keyof Tint] = x;
  else (g as unknown as Record<string, number>)[a] = x;
};

const clampInt = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, Math.round(Number.isFinite(x) ? x : lo)));

/** A genome with every number brought inside its range (and whole). */
export function clampGenome(g: Genome): Genome {
  const out = blank();
  for (const [path, , min, max] of FIELDS) put(out, path, clampInt(get(g, path), min, max));
  return out;
}

function blank(): Genome {
  return {
    petals: 5,
    shape: 0,
    double: 0,
    base: { h: 0, s: 0, l: 0 },
    tip: { h: 0, s: 0, l: 0 },
    pattern: 0,
    mark: { h: 0, s: 0, l: 0 },
    size: 0,
    height: 0,
    branches: 0,
    leaf: 0,
    foliage: 0,
    scent: 0,
    note: 0,
    cup: 0,
  };
}

// --- the code: thirteen letters, safe in a URL ------------------------------------------

/** The letters a code is written in (base64url). */
const DIGITS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
/** The first letter says which way the rest is packed. */
const VERSION = 'f';
const DATA = 11;
export const CODE_LENGTH = 1 + DATA + 1;
const SHAPE = /^[A-Za-z0-9_-]{13}$/;

const checksum = (s: string) => {
  let sum = 7;
  for (let i = 0; i < s.length; i++) sum = (sum * 31 + DIGITS.indexOf(s[i]) * (i + 3)) % 4093;
  return DIGITS[sum % 64];
};

/** The genome as a short code: a version letter, eleven of data and a check letter. */
export function encode(g: Genome): string {
  const c = clampGenome(g);
  const bits: number[] = [];
  for (const [path, n, min] of FIELDS) {
    const x = get(c, path) - min;
    for (let i = n - 1; i >= 0; i--) bits.push((x >> i) & 1);
  }
  while (bits.length < DATA * 6) bits.push(0);
  let body = VERSION;
  for (let k = 0; k < DATA; k++) {
    let d = 0;
    for (let i = 0; i < 6; i++) d = (d << 1) | bits[k * 6 + i];
    body += DIGITS[d];
  }
  return body + checksum(body);
}

/**
 * A code back into a genome, or null. The code is whatever someone put in a
 * link: only exactly thirteen of the right letters, the right version and a
 * matching check letter get through, and every number is clamped to its range.
 */
export function decode(code: unknown): Genome | null {
  if (typeof code !== 'string' || code.length !== CODE_LENGTH || !SHAPE.test(code)) return null;
  if (code[0] !== VERSION) return null;
  const body = code.slice(0, -1);
  if (checksum(body) !== code[CODE_LENGTH - 1]) return null;
  const bits: number[] = [];
  for (let k = 1; k <= DATA; k++) {
    const d = DIGITS.indexOf(code[k]);
    if (d < 0) return null;
    for (let i = 5; i >= 0; i--) bits.push((d >> i) & 1);
  }
  const g = blank();
  let at = 0;
  for (const [path, n, min, max] of FIELDS) {
    let x = 0;
    for (let i = 0; i < n; i++) x = (x << 1) | bits[at++];
    put(g, path, clampInt(x + min, min, max));
  }
  return g;
}

// --- chance, seeded --------------------------------------------------------------------------

/** A small seeded random (mulberry32): the same cross from the same seed gives the same seedling. */
export function seeded(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A number from a string, the same every time (FNV-1a). */
export function hash(s: string) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

// --- colors -------------------------------------------------------------------------------

/** Degrees round the wheel. */
export const degrees = (t: Tint) => (t.h * 360) / 64;
const inHue = (t: Tint, from: number, to: number) => {
  const d = degrees(t);
  return from <= to ? d >= from && d <= to : d >= from || d <= to;
};

export const isBlack = (t: Tint) => t.l <= 1;
export const isWhite = (t: Tint) => t.l >= 6 && t.s <= 1;
export const isBlue = (t: Tint) => inHue(t, 195, 245) && t.s >= 4 && t.l >= 2 && t.l <= 6;
export const isGold = (t: Tint) => inHue(t, 34, 62) && t.s >= 4 && t.l >= 3 && t.l <= 6;
export const isRed = (t: Tint) => inHue(t, 340, 14) && t.s >= 4 && t.l >= 2 && t.l <= 4;
export const isPink = (t: Tint) => inHue(t, 320, 14) && t.s >= 3 && t.l >= 4 && t.l <= 6;
export const isOrange = (t: Tint) => inHue(t, 14, 36) && t.s >= 5 && t.l >= 3 && t.l <= 5;
export const isViolet = (t: Tint) => inHue(t, 250, 300) && t.s >= 3 && t.l >= 2 && t.l <= 5;
export const isCream = (t: Tint) => inHue(t, 25, 65) && t.s >= 2 && t.s <= 4 && t.l >= 5;

const SAT = [0.05, 0.16, 0.3, 0.44, 0.58, 0.72, 0.85, 0.95];
const LIGHT = [0.06, 0.15, 0.27, 0.4, 0.53, 0.66, 0.79, 0.93];

/** The tint as an sRGB color, 0..1 each. */
export function rgb(t: Tint): [number, number, number] {
  const h = t.h / 64;
  const s = SAT[t.s];
  const l = LIGHT[t.l];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const f = (x: number) => {
    const k = ((x % 1) + 1) % 1;
    if (k < 1 / 6) return p + (q - p) * 6 * k;
    if (k < 1 / 2) return q;
    if (k < 2 / 3) return p + (q - p) * (2 / 3 - k) * 6;
    return p;
  };
  return [f(h + 1 / 3), f(h), f(h - 1 / 3)];
}

/** What you'd call it: "rose pink", "deep violet", "cream", "near black". */
export function colorName(t: Tint): string {
  if (t.l <= 1) return t.s >= 4 && t.l === 1 ? `inky ${hueWord(t)}` : 'near black';
  if (t.s <= 1) return t.l >= 6 ? 'white' : t.l >= 4 ? 'pearl grey' : 'slate';
  if (isCream(t)) return 'cream';
  const word = hueWord(t);
  if (t.l >= 6) return t.s <= 3 ? `pale ${word}` : `light ${word}`;
  if (t.l <= 2) return `deep ${word}`;
  return word;
}

function hueWord(t: Tint) {
  const d = degrees(t);
  const pale = t.l >= 5;
  if (d < 12 || d >= 345) return pale ? 'rose pink' : 'red';
  if (d < 24) return pale ? 'coral' : 'scarlet';
  if (d < 38) return pale ? 'apricot' : 'orange';
  if (d < 52) return 'gold';
  if (d < 68) return pale ? 'primrose' : 'yellow';
  if (d < 100) return 'lime';
  if (d < 160) return 'green';
  if (d < 195) return 'teal';
  if (d < 248) return pale ? 'sky blue' : 'blue';
  if (d < 278) return pale ? 'lavender' : 'violet';
  if (d < 308) return pale ? 'lilac' : 'purple';
  if (d < 330) return pale ? 'orchid' : 'magenta';
  return pale ? 'pink' : 'crimson';
}

// --- breeding ---------------------------------------------------------------------------

/** How often things go their own way in a seedling. */
export const MUTATION = {
  /** Any one number nudged a step up or down. */
  step: 0.07,
  /** A hue drifting a little round the wheel. */
  drift: 0.14,
  /** Stripes appearing out of nowhere; an edge or freckles, a little more rarely. */
  striped: 0.035,
  edged: 0.02,
  freckled: 0.02,
  /** A single bloom coming up double. */
  double: 0.05,
  /** A violet or purple turning true blue; and, far more rarely, anything at all. */
  blue: 0.12,
  anyBlue: 0.006,
  /** A color going dark, almost to black. */
  dark: 0.04,
};

const wrapHue = (h: number) => ((Math.round(h) % 64) + 64) % 64;
/** Halfway round the wheel between two hues, the short way. */
const midHue = (a: number, b: number) => {
  let d = b - a;
  if (d > 32) d -= 64;
  if (d < -32) d += 64;
  return wrapHue(a + d / 2);
};

function mixTint(a: Tint, b: Tint, r: () => number): Tint {
  const k = r();
  const h = k < 0.36 ? a.h : k < 0.72 ? b.h : midHue(a.h, b.h);
  const pick = (x: number, y: number) => {
    const j = r();
    return j < 0.4 ? x : j < 0.8 ? y : Math.round((x + y) / 2 + (r() - 0.5) * 0.9);
  };
  return { h, s: pick(a.s, b.s), l: pick(a.l, b.l) };
}

/** A seed from two blooms: each trait from one parent or the other (colors sometimes between), then the odd mutation. */
export function cross(a: Genome, b: Genome, r: () => number): Genome {
  const either = <T>(x: T, y: T): T => (r() < 0.5 ? x : y);
  const g = blank();
  g.petals = r() < 0.25 ? Math.round((a.petals + b.petals) / 2) : either(a.petals, b.petals);
  g.shape = either(a.shape, b.shape);
  g.double = a.double && b.double ? (r() < 0.9 ? 1 : 0) : a.double || b.double ? (r() < 0.5 ? 1 : 0) : 0;
  g.base = mixTint(a.base, b.base, r);
  g.tip = mixTint(a.tip, b.tip, r);
  // The markings come as a set: the pattern and its color from the same parent.
  const marked = either(a, b);
  g.pattern = marked.pattern;
  g.mark = { ...marked.mark };
  if (r() < 0.25) g.mark = mixTint(a.mark, b.mark, r);
  g.size = either(a.size, b.size);
  g.height = either(a.height, b.height);
  g.branches = either(a.branches, b.branches);
  g.leaf = either(a.leaf, b.leaf);
  g.foliage = either(a.foliage, b.foliage);
  g.scent = either(a.scent, b.scent);
  g.note = either(a.note, b.note);
  g.cup = either(a.cup, b.cup);
  return mutate(g, r);
}

/** The surprises: small steps, a drifting hue, and now and then a sport. */
export function mutate(g: Genome, r: () => number): Genome {
  for (const [path, , min, max] of FIELDS) {
    // The pattern and a double only change by a sport, below.
    if (path === 'pattern' || path === 'double') continue;
    if (path.endsWith('.h')) {
      if (r() < MUTATION.drift) put(g, path, wrapHue(get(g, path) + (r() < 0.5 ? -1 : 1) * (1 + Math.floor(r() * 2))));
    } else if (r() < MUTATION.step) put(g, path, clampInt(get(g, path) + (r() < 0.5 ? -1 : 1), min, max));
  }
  if (g.pattern !== 1 && r() < MUTATION.striped) {
    g.pattern = 1;
    // Stripes in a darker or a paler shade of the flower's own color.
    g.mark = { h: wrapHue(g.base.h + (r() - 0.5) * 6), s: Math.min(7, g.base.s + 1), l: g.base.l >= 4 ? 1 + Math.floor(r() * 2) : 6 };
  }
  if (g.pattern !== 2 && r() < MUTATION.edged) {
    g.pattern = 2;
    // A gold edge, a white one, or a deeper shade of its own color.
    const k = r();
    g.mark = k < 0.34 ? { h: 8, s: 7, l: 4 } : k < 0.67 ? { h: g.base.h, s: 0, l: 7 } : { h: g.base.h, s: Math.min(7, g.base.s + 1), l: Math.max(1, g.base.l - 2) };
  }
  if (g.pattern !== 3 && r() < MUTATION.freckled) {
    g.pattern = 3;
    g.mark = { h: wrapHue(g.base.h + (r() - 0.5) * 8), s: 5, l: 1 + Math.floor(r() * 2) };
  }
  if (!g.double && r() < MUTATION.double) g.double = 1;
  // Blue is rare under glass: it turns up in the violets, hardly ever anywhere else.
  const violetish = isViolet(g.base) || inHue(g.base, 240, 310);
  if (r() < (violetish ? MUTATION.blue : MUTATION.anyBlue)) {
    g.base = { h: 36 + Math.floor(r() * 4), s: Math.max(5, g.base.s), l: clampInt(g.base.l, 3, 5) };
    if (r() < 0.6) g.tip = { h: 37 + Math.floor(r() * 3), s: 3 + Math.floor(r() * 3), l: 5 + Math.floor(r() * 2) };
  }
  if (r() < MUTATION.dark) g.base.l = Math.max(0, g.base.l - 2);
  return clampGenome(g);
}

// --- names -----------------------------------------------------------------------------

const GENUS = ['Rotundia', 'Stellifera', 'Crispula', 'Bifidella'];
const ADJ = ['Evening', 'Little', 'Late', 'Summer', 'Velvet', 'Morning', 'Silver', 'Golden', 'Garden', 'Painted', 'Sleepy', 'Brave', 'Hidden', 'Gentle', 'Old', 'Lucky', 'Quiet', 'Merry', 'Distant', 'Tender', 'Wild', 'Honest', 'Secret', 'Patient'];
const NOUN = ['Lantern', 'Wren', 'Comet', 'Bonnet', 'Ember', 'Ribbon', 'Moth', 'Parasol', 'Teacup', 'Sparrow', 'Lady', 'Promise', 'Glow', 'Thimble', 'Kite', 'Starling', 'Dancer', 'Firefly', 'Lullaby', 'Meadow', 'Button', 'Candle', 'Sunday', 'Rambler'];

function epithet(t: Tint) {
  if (isBlack(t)) return 'nigra';
  if (isWhite(t)) return 'alba';
  if (isCream(t)) return 'lactea';
  if (isBlue(t)) return 'caerulea';
  const d = degrees(t);
  if (t.s <= 1) return 'cinerea';
  if (d < 12 || d >= 345) return t.l >= 5 ? 'rosea' : 'rubra';
  if (d < 24) return 'coccinea';
  if (d < 38) return 'aurantiaca';
  if (d < 52) return 'aurea';
  if (d < 68) return 'flava';
  if (d < 160) return 'viridis';
  if (d < 195) return 'thalassina';
  if (d < 248) return 'caerulea';
  if (d < 278) return 'violacea';
  if (d < 308) return 'purpurea';
  return t.l >= 5 ? 'rosea' : 'magentea';
}

/** The botanist's name: genus by the petal's shape, species by its color, the markings and a double after. */
export function latinName(g: Genome) {
  const parts = [GENUS[g.shape], epithet(g.base)];
  if (g.pattern === 1) parts.push('striata');
  if (g.pattern === 2) parts.push('marginata');
  if (g.pattern === 3) parts.push('punctata');
  if (g.double) parts.push('flore pleno');
  return parts.join(' ');
}

/** The garden name, the same every time for the same flower: "Evening Lantern". */
export function gardenName(g: Genome) {
  const h = hash(encode(g));
  return `${ADJ[h % ADJ.length]} ${NOUN[(h >>> 8) % NOUN.length]}`;
}

const COUNT = ['', '', '', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve'];
export const NOTE_NAMES = ['D', 'E', 'F sharp', 'A', 'B'];
/** The note's pitch, as MIDI: up D major pentatonic from the D above middle C. */
export const pitch = (note: number) => 62 + Math.floor(note / 5) * 12 + [0, 2, 4, 7, 9][note % 5];

/** One plain sentence about it: "Seven pointed petals, rose pink going to cream, edged in gold." */
export function describe(g: Genome) {
  const base = colorName(g.base);
  const tip = colorName(g.tip);
  const color = base === tip ? base : `${base} going to ${tip}`;
  const marks = ['', `, striped ${colorName(g.mark)}`, `, edged in ${colorName(g.mark)}`, `, freckled ${colorName(g.mark)}`][g.pattern];
  const bloom = g.double ? ' A double bloom.' : '';
  return `${COUNT[g.petals]} ${SHAPES[g.shape]} petals, ${color}${marks}.${bloom}`;
}

/** The traits, as the hand lens reads them. */
export function traits(g: Genome): { head: string; text: string }[] {
  const tall = ['Tiny', 'Short', 'Short', 'Middling', 'Middling', 'Tall', 'Tall', 'Very tall'][g.height];
  const blooms = ['one bloom', 'two blooms', 'three blooms', 'four blooms'][g.branches];
  const color = colorName(g.base) === colorName(g.tip) ? colorName(g.base) : `${colorName(g.base)} at the heart, ${colorName(g.tip)} at the tips`;
  return [
    { head: 'Petals', text: `${COUNT[g.petals]}, ${SHAPES[g.shape]}${g.double ? ', a second whorl inside' : ''}${['', ', a little cupped', ', cupped', ', a deep bowl'][g.cup]}` },
    { head: 'Color', text: `${color[0].toUpperCase()}${color.slice(1)}${['', `, striped ${colorName(g.mark)}`, `, edged in ${colorName(g.mark)}`, `, freckled ${colorName(g.mark)}`][g.pattern]}` },
    { head: 'Habit', text: `${tall}, ${blooms}, ${['small', 'small', 'neat', 'neat', 'generous', 'generous', 'big', 'huge'][g.size]} flowers; ${['oval', 'narrow', 'lobed', 'heart-shaped'][g.leaf]} ${['deep green', 'bright green', 'blue-grey', 'bronze'][g.foliage]} leaves` },
    { head: 'Scent and note', text: `${['None to speak of', 'Faint', 'Sweet', 'Heady'][g.scent]}; it sings ${NOTE_NAMES[g.note % 5]}` },
  ];
}

// --- what the catalog wants -----------------------------------------------------------------

export interface Wanted {
  id: string;
  name: string;
  /** What it looks like, in the catalog's words. */
  line: string;
  /** A nudge, for when it won't come. */
  hint: string;
  /** 1 easy, 2 takes a few crosses, 3 a real prize. */
  difficulty: 1 | 2 | 3;
  /** Is this it? */
  test(g: Genome): boolean;
  /** How close, 0..1 (1 is it). */
  near(g: Genome): number;
  /** One that would do, for the catalog's picture. */
  example: Genome;
}

/** Closeness of a number to a range, 0..1, a step at a time. */
const toward = (x: number, lo: number, hi: number, span = 7) => (x >= lo && x <= hi ? 1 : 1 - Math.min(1, (x < lo ? lo - x : x - hi) / span));
/** Closeness of a hue to an arc of the wheel (degrees). */
const towardHue = (t: Tint, from: number, to: number) => {
  if (inHue(t, from, to)) return 1;
  const d = degrees(t);
  const gap = (a: number, b: number) => Math.min(Math.abs(a - b), 360 - Math.abs(a - b));
  return 1 - Math.min(1, Math.min(gap(d, from), gap(d, to)) / 120);
};
const all = (...ks: number[]) => ks.reduce((a, b) => a + b, 0) / ks.length;
const tint = (h: number, s: number, l: number): Tint => ({ h, s, l });
const example = (o: Partial<Genome>): Genome => ({ ...blank(), petals: 5, size: 4, height: 4, branches: 1, scent: 1, note: 3, cup: 1, base: tint(0, 6, 4), tip: tint(0, 6, 5), mark: tint(0, 0, 0), ...o });

export const WANTED: Wanted[] = [
  {
    id: 'seven-rose',
    name: 'The Seven-Petal Rose',
    line: 'Seven round petals, rose pink.',
    hint: 'Pink comes easy. Count the petals on everything else.',
    difficulty: 1,
    test: (g) => g.petals === 7 && g.shape === 0 && isPink(g.base),
    near: (g) => all(toward(g.petals, 7, 7, 5), g.shape === 0 ? 1 : 0, towardHue(g.base, 320, 14), toward(g.base.l, 4, 6), toward(g.base.s, 3, 7)),
    example: example({ petals: 7, shape: 0, base: tint(62, 6, 5), tip: tint(0, 4, 6), cup: 2 }),
  },
  {
    id: 'sunset',
    name: 'The Sunset',
    line: 'Red at the heart, gold at the tips.',
    hint: 'A red and a gold, crossed, and look at the tips.',
    difficulty: 1,
    test: (g) => isRed(g.base) && isGold(g.tip),
    near: (g) => all(towardHue(g.base, 340, 14), toward(g.base.l, 2, 4), toward(g.base.s, 4, 7), towardHue(g.tip, 34, 62), toward(g.tip.l, 3, 6), toward(g.tip.s, 4, 7)),
    example: example({ petals: 6, shape: 1, base: tint(63, 7, 3), tip: tint(7, 7, 5) }),
  },
  {
    id: 'heady-violet',
    name: 'The Heady Violet',
    line: 'Violet, with the strongest scent in the house.',
    hint: 'Lean in close: some smell sweeter than others.',
    difficulty: 1,
    test: (g) => isViolet(g.base) && g.scent === 3,
    near: (g) => all(towardHue(g.base, 250, 300), toward(g.base.s, 3, 7), toward(g.base.l, 2, 5), toward(g.scent, 3, 3, 3)),
    example: example({ petals: 5, shape: 2, base: tint(48, 6, 3), tip: tint(47, 5, 5), scent: 3 }),
  },
  {
    id: 'tiger',
    name: 'The Tiger',
    line: 'Bright orange, striped dark.',
    hint: 'Stripes come down in families, and now and then out of nowhere.',
    difficulty: 2,
    test: (g) => isOrange(g.base) && g.pattern === 1 && g.mark.l <= 2,
    near: (g) => all(towardHue(g.base, 14, 36), toward(g.base.s, 5, 7), toward(g.base.l, 3, 5), g.pattern === 1 ? 1 : 0, toward(g.mark.l, 0, 2)),
    example: example({ petals: 6, shape: 1, base: tint(4, 7, 4), tip: tint(5, 7, 5), pattern: 1, mark: tint(2, 6, 1) }),
  },
  {
    id: 'snowball',
    name: 'The Snowball',
    line: 'A double bloom, white all through.',
    hint: 'Doubles take after doubles. White takes patience.',
    difficulty: 2,
    test: (g) => g.double === 1 && isWhite(g.base) && isWhite(g.tip),
    near: (g) => all(g.double ? 1 : 0, toward(g.base.l, 6, 7), toward(g.base.s, 0, 1), toward(g.tip.l, 6, 7), toward(g.tip.s, 0, 1)),
    example: example({ petals: 8, shape: 0, double: 1, base: tint(10, 1, 7), tip: tint(10, 0, 7), cup: 2 }),
  },
  {
    id: 'lantern',
    name: 'The Lantern',
    line: 'Tall and golden, with four blooms.',
    hint: 'Height and branching each come from one parent or the other.',
    difficulty: 2,
    test: (g) => g.height >= 6 && g.branches === 3 && isGold(g.base),
    near: (g) => all(toward(g.height, 6, 7), toward(g.branches, 3, 3, 3), towardHue(g.base, 34, 62), toward(g.base.s, 4, 7), toward(g.base.l, 3, 6)),
    example: example({ petals: 8, shape: 0, base: tint(8, 7, 5), tip: tint(9, 6, 6), height: 7, branches: 3, cup: 2 }),
  },
  {
    id: 'speckled-hen',
    name: 'The Speckled Hen',
    line: 'Cream, freckled brown, with frilled petals.',
    hint: 'Freckles, frills and cream: three parents in one.',
    difficulty: 2,
    test: (g) => isCream(g.base) && g.pattern === 3 && g.mark.l <= 3 && g.shape === 2,
    near: (g) => all(towardHue(g.base, 25, 65), toward(g.base.s, 2, 4), toward(g.base.l, 5, 7), g.pattern === 3 ? 1 : 0, toward(g.mark.l, 0, 3), g.shape === 2 ? 1 : 0),
    example: example({ petals: 6, shape: 2, base: tint(7, 2, 6), tip: tint(7, 1, 7), pattern: 3, mark: tint(4, 5, 2) }),
  },
  {
    id: 'midnight-lily',
    name: 'The Midnight Lily',
    line: 'Black, with pointed petals edged in gold.',
    hint: 'Dark flowers turn darker now and then. The gold edge has to come from somewhere.',
    difficulty: 3,
    test: (g) => isBlack(g.base) && g.tip.l <= 2 && g.pattern === 2 && isGold(g.mark) && g.shape === 1,
    near: (g) => all(toward(g.base.l, 0, 1), toward(g.tip.l, 0, 2), g.pattern === 2 ? 1 : 0, towardHue(g.mark, 34, 62), toward(g.mark.l, 3, 6), toward(g.mark.s, 4, 7), g.shape === 1 ? 1 : 0),
    example: example({ petals: 6, shape: 1, base: tint(60, 6, 0), tip: tint(58, 5, 1), pattern: 2, mark: tint(8, 7, 5), cup: 1 }),
  },
  {
    id: 'blue-moon',
    name: 'The Blue Moon',
    line: 'Sky blue, the rarest color under glass.',
    hint: 'Blue hides in the violets. Keep crossing them.',
    difficulty: 3,
    test: (g) => isBlue(g.base) && (isBlue(g.tip) || isWhite(g.tip) || (inHue(g.tip, 195, 245) && g.tip.l >= 5)),
    near: (g) => all(towardHue(g.base, 195, 245), toward(g.base.s, 4, 7), toward(g.base.l, 2, 6), towardHue(g.tip, 195, 245)),
    example: example({ petals: 5, shape: 0, base: tint(38, 6, 4), tip: tint(38, 4, 6), cup: 2 }),
  },
];

/** The first seeds in the house: enough to start, and between them every wanted flower can be bred. */
export const STARTERS: Genome[] = [
  // A rose-pink cottage flower, six round petals, sweet.
  example({ petals: 6, shape: 0, base: tint(62, 6, 4), tip: tint(63, 4, 6), size: 5, height: 3, branches: 1, leaf: 0, foliage: 0, scent: 2, note: 0, cup: 2 }),
  // Crimson going to orange, pointed, tall.
  example({ petals: 6, shape: 1, base: tint(63, 7, 3), tip: tint(4, 7, 4), size: 4, height: 5, branches: 2, leaf: 1, foliage: 3, scent: 1, note: 2, cup: 1 }),
  // A golden daisy with eight petals.
  example({ petals: 8, shape: 0, base: tint(8, 7, 4), tip: tint(9, 7, 5), size: 3, height: 5, branches: 2, leaf: 2, foliage: 1, scent: 0, note: 4, cup: 0 }),
  // Violet, frilled and freckled, heady.
  example({ petals: 5, shape: 2, base: tint(47, 6, 3), tip: tint(46, 4, 5), pattern: 3, mark: tint(45, 6, 1), size: 4, height: 3, branches: 1, leaf: 3, foliage: 2, scent: 2, note: 6, cup: 1 }),
  // Cream and double, edged in gold.
  example({ petals: 8, shape: 3, double: 1, base: tint(8, 3, 6), tip: tint(9, 1, 7), pattern: 2, mark: tint(8, 7, 4), size: 5, height: 2, branches: 0, leaf: 0, foliage: 1, scent: 2, note: 8, cup: 2 }),
  // Orange with red stripes.
  example({ petals: 5, shape: 1, base: tint(5, 7, 4), tip: tint(7, 6, 5), pattern: 1, mark: tint(62, 7, 3), size: 4, height: 4, branches: 1, leaf: 1, foliage: 0, scent: 1, note: 5, cup: 1 }),
  // Pale lilac stars, seven to a bloom.
  example({ petals: 7, shape: 1, base: tint(52, 3, 6), tip: tint(50, 2, 7), size: 3, height: 6, branches: 3, leaf: 1, foliage: 2, scent: 3, note: 9, cup: 0 }),
  // A dark maroon bowl, nearly black at the heart.
  example({ petals: 6, shape: 0, base: tint(61, 6, 1), tip: tint(62, 6, 2), size: 6, height: 4, branches: 0, leaf: 3, foliage: 3, scent: 1, note: 3, cup: 3 }),
];
