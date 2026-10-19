// The simple page: everything in the room, typeset. It's what phones, slower
// computers, reduced motion and screen readers get, and it stays in the
// document (visually hidden) behind the scene for screen readers too.
import { geoNaturalEarth1, geoPath, geoCircle } from 'd3-geo';
import type { Feature, FeatureCollection, Geometry } from 'geojson';
import { feature } from 'topojson-client';
import type { GeometryCollection, Topology } from 'topojson-specification';
import world from 'world-atlas/countries-110m.json';
import { BOOKS } from './books';
import { ABOUT, DIPLOMAS, MEDALS, POEMS, SHOES, VISITED, WORK } from './content';
import { mapName, SMALL_PLACES } from './places';
import { PROJECTS } from './projects';

const KEY = 'ew.mode';
const SVG = 'http://www.w3.org/2000/svg';
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const el = (tag: string, text?: string, cls?: string) => {
  const e = document.createElement(tag);
  if (text !== undefined) e.textContent = text;
  if (cls) e.className = cls;
  return e;
};

/** Remembers which version someone chose, and goes there. */
export function switchTo(mode: 'simple' | 'full') {
  try {
    if (mode === 'simple') localStorage.setItem(KEY, 'simple');
    else localStorage.removeItem(KEY);
  } catch {
    // Nowhere to remember it; the link still works this once.
  }
  location.href = mode === 'simple' ? '?lite' : '?full';
}

/** The simple page: phones, reduced motion, no WebGL, ?lite, or a choice made earlier. */
export function wantsLite(): boolean {
  const q = new URLSearchParams(location.search);
  if (q.has('full')) return false;
  if (q.has('lite')) return true;
  try {
    if (localStorage.getItem(KEY) === 'simple') return true;
  } catch {
    // No storage: decide from the device alone.
  }
  const gl = document.createElement('canvas').getContext('webgl2');
  if (!gl) return true;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return true;
  return window.innerWidth < 760 || (matchMedia('(pointer: coarse)').matches && window.innerWidth < 1100);
}

const METALS = { gold: ['#fbe9a6', '#d4a63a', '#7a5a14'], silver: ['#ffffff', '#b9bec7', '#5d636e'], bronze: ['#f6c79a', '#b0703a', '#5a3214'] };

/** A world map with the visited countries filled, drawn as SVG. */
function drawMap(svg: SVGSVGElement) {
  const W = 960;
  const H = 500;
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  const topo = world as unknown as Topology<{ countries: GeometryCollection<{ name: string }> }>;
  const outlines = (feature(topo, topo.objects.countries) as FeatureCollection<Geometry, { name: string }>).features as Feature<Geometry, { name: string }>[];
  const projection = geoNaturalEarth1().fitExtent(
    [
      [6, 6],
      [W - 6, H - 6],
    ],
    { type: 'Sphere' },
  );
  const path = geoPath(projection);
  const known = new Set(outlines.map((c) => c.properties.name));
  const been = new Set(VISITED.map((v) => mapName(v, known)).filter((n): n is string => !!n));
  const add = (d: string | null, cls: string, title?: string) => {
    if (!d) return;
    const p = document.createElementNS(SVG, 'path');
    p.setAttribute('d', d);
    p.setAttribute('class', cls);
    if (title) {
      const t = document.createElementNS(SVG, 'title');
      t.textContent = title;
      p.append(t);
    }
    svg.append(p);
  };
  add(path({ type: 'Sphere' }), 'sphere');
  for (const c of outlines) add(path(c), been.has(c.properties.name) ? 'land been' : 'land', c.properties.name);
  // Small places visited get a dot, as on the scratch map.
  for (const [name, center] of Object.entries(SMALL_PLACES)) if (been.has(name)) add(path(geoCircle().center(center).radius(1.2)()), 'land been', name);
}

/** Fills the simple page from the same content the room uses. */
export function fillPlain(openBook: (id: string) => void) {
  const list = $('plain-list');
  list.replaceChildren();
  for (const p of PROJECTS) {
    const li = el('li');
    if (p.art) {
      const img = el('img', undefined, 'art') as HTMLImageElement;
      img.src = p.art;
      img.alt = '';
      img.loading = 'lazy';
      li.append(img);
    } else li.append(el('div', undefined, 'art'));
    const body = el('div');
    body.append(el('h3', p.title), el('p', p.tagline, 'tag'), el('p', p.blurb));
    if (p.url) {
      const a = el('a', `Open ${p.title} →`) as HTMLAnchorElement;
      a.href = p.url;
      body.append(a);
    } else body.append(el('p', p.status, 'q-small'));
    li.append(body);
    list.append(li);
  }

  $('plain-about-body').replaceChildren(...ABOUT.lines.map((l) => el('p', l)));

  const NUMERALS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
  $('plain-poems').replaceChildren(
    ...POEMS.map((p, i) => {
      const poem = el('article', undefined, 'poem');
      poem.append(el('p', p.title ?? NUMERALS[i % NUMERALS.length], 'num'));
      for (const line of p.lines) poem.append(el('p', line || ' ', line ? undefined : 'gap'));
      return poem;
    }),
  );

  $('plain-medals').replaceChildren(
    ...MEDALS.map((m) => {
      const li = el('li');
      const disc = el('span', m.face, 'disc');
      const [hi, mid, lo] = METALS[m.metal];
      disc.style.setProperty('--m-hi', hi);
      disc.style.setProperty('--m-mid', mid);
      disc.style.setProperty('--m-lo', lo);
      disc.style.setProperty('--r1', m.ribbon[0]);
      disc.style.setProperty('--r2', m.ribbon[1]);
      disc.setAttribute('aria-hidden', 'true');
      li.append(disc, el('strong', m.race), el('span', `${m.distance} · ${m.year} · ${m.time}`, 'time'), el('span', m.note, 'what'));
      return li;
    }),
  );
  $('plain-shoes').textContent = `Running in the ${SHOES.label}. ${SHOES.lines.join(' ')}`;

  const job = (years: string, head: string, note?: string) => {
    const li = el('li');
    const what = el('div');
    what.append(el('strong', head));
    if (note) what.append(el('span', note, 'note'));
    li.append(el('span', years, 'years'), what);
    return li;
  };
  $('plain-work-list').replaceChildren(...WORK.map((w) => job(w.years, `${w.role}, ${w.company}`, w.note)));
  $('plain-diplomas').replaceChildren(...DIPLOMAS.map((d) => job(d.year, `${d.degree} in ${d.field}`, d.honors ? `${d.school}. ${d.honors}.` : d.school)));

  const svg = document.getElementById('plain-map') as unknown as SVGSVGElement;
  svg.replaceChildren();
  drawMap(svg);
  const caption = $('plain-places');
  caption.replaceChildren(el('strong', `${VISITED.length} countries so far. `), document.createTextNode(`${VISITED.join(', ')}.`));

  $('plain-books').replaceChildren(
    ...BOOKS.map((b, i) => {
      const li = el('li');
      const spine = el('button', b.short ?? b.title) as HTMLButtonElement;
      spine.type = 'button';
      spine.title = `${b.title}, ${b.author}`;
      spine.setAttribute('aria-label', `Read ${b.title}, by ${b.author}`);
      spine.style.setProperty('--cloth', b.cloth);
      spine.style.setProperty('--gilt', b.ink);
      spine.style.setProperty('--h', `${(b.src ? 220 : 196) - (i % 3) * 8}px`);
      spine.addEventListener('click', () => openBook(b.id));
      li.append(spine);
      return li;
    }),
  );
}
