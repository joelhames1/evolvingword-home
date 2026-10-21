// The word board, out in the sky beyond the slit: a constellation that spells
// the phrase. Every letter has its own little swarm of stars. While a letter is
// still wrong its stars drift about, faint, half-making whatever letter the
// weasel program has there now; once it comes right they settle into place,
// brighten, and faint lines join them up, the way a star chart draws a figure.
import * as THREE from 'three';
import { Evolver, MAX_PHRASE } from '../../evolve';
import { rng } from '../../textures';
import type { Board, Evolution } from '../kit';

export const PHRASES = ['EVOLVING WORD', 'LOOK UP', 'THE HEAVENS', 'MAKE SOMETHING', 'CLEAR SKIES', 'STAY CURIOUS', 'MADE OF STARS', 'WONDER'];

/**
 * The letters as constellations: strokes through stars on a grid four wide and
 * six tall (y up). Each stroke is a run of x,y points; strokes split by |. A
 * point shared between strokes is one star.
 */
export const STROKES: Record<string, string> = {
  A: '0,0 0.83,2.5 2,6 3.17,2.5 4,0|0.83,2.5 3.17,2.5',
  B: '0,0 0,3.2 0,6 2.8,6 3.6,4.6 2.8,3.2 0,3.2|2.8,3.2 4,1.6 3,0 0,0',
  C: '4,5 2.5,6 1,5.5 0,3 1,0.5 2.5,0 4,1',
  D: '0,0 0,6 2,6 3.6,4.5 4,3 3.6,1.5 2,0 0,0',
  E: '4,6 0,6 0,3.1 0,0 4,0|0,3.1 3,3.1',
  F: '4,6 0,6 0,3.1 0,0|0,3.1 3,3.1',
  G: '4,5 2.5,6 1,5.5 0,3 1,0.5 2.5,0 4,1 4,2.8 2.2,2.8',
  H: '0,0 0,3 0,6|4,0 4,3 4,6|0,3 4,3',
  I: '1,6 2,6 3,6|2,6 2,0|1,0 2,0 3,0',
  J: '1,6 3,6 4,6|3,6 3,1.2 2,0 0.8,0.3 0,1.5',
  K: '0,0 0,2.3 0,6|4,6 1.3,3.5 0,2.3|1.3,3.5 4,0',
  L: '0,6 0,3 0,0 4,0',
  M: '0,0 0,6 2,2.5 4,6 4,0',
  N: '0,0 0,6 4,0 4,6',
  O: '2,6 3.6,5 4,3 3.6,1 2,0 0.4,1 0,3 0.4,5 2,6',
  P: '0,0 0,3 0,6 3,6 4,4.5 3,3 0,3',
  Q: '2,6 3.6,5 4,3 3.6,1 2,0 0.4,1 0,3 0.4,5 2,6|2.6,1.4 4,-0.4',
  R: '0,0 0,3 0,6 3,6 4,4.5 3,3 0,3|3,3 4,0',
  S: '4,5 2,6 0.3,4.8 1.2,3.4 2.8,2.6 3.7,1.2 2,0 0,1',
  T: '0,6 2,6 4,6|2,6 2,3 2,0',
  U: '0,6 0,1.5 1,0.2 2,0 3,0.2 4,1.5 4,6',
  V: '0,6 1,3 2,0 3,3 4,6',
  W: '0,6 1,0 2,3.5 3,0 4,6',
  X: '0,6 2,3 4,0|4,6 2,3 0,0',
  Y: '0,6 2,3 4,6|2,3 2,0',
  Z: '0,6 4,6 2,3 0,0 4,0',
  '0': '2,6 3.5,5 4,3 3.5,1 2,0 0.5,1 0,3 0.5,5 2,6|0.9,1.4 3.1,4.6',
  '1': '0.8,4.6 2,6 2,3 2,0|0.8,0 2,0 3.2,0',
  '2': '0.2,4.8 1.8,6 3.6,5.2 3.6,3.6 0,0 4,0',
  '3': '0.2,5.4 2,6 3.6,5 2.8,3.4 1.4,3.2|2.8,3.4 3.8,1.6 2,0 0,0.8',
  '4': '3,0 3,2 3,6 0,2 3,2 4,2',
  '5': '4,6 0.4,6 0,3.4 2.2,3.8 3.8,2.6 3.6,0.8 2,0 0,0.8',
  '6': '3.6,5.6 1.8,6 0.4,4.4 0,2 1,0.2 2.8,0.2 4,1.6 3,3.4 1,3.2 0.2,2.4',
  '7': '0,6 4,6 2.4,3 1.4,0',
  '8': '2,3.3 0.6,4.3 1,5.6 2,6 3,5.6 3.4,4.3 2,3.3 0.4,1.8 1.2,0.2 2.8,0.2 3.6,1.8 2,3.3',
  '9': '0.4,0.4 2.2,0 3.6,1.6 4,4 3,5.8 1.2,5.8 0,4.2 1,2.8 3,2.9 4,4',
  '!': '2,6 2,4 2,1.8|2,0.2',
  '&': '4,0 1.2,4.4 1.6,5.8 2.8,5.6 2.6,4.2 0.3,2 0.8,0.3 2.2,0.2 3.8,2',
  "'": '2,6 1.8,4.4',
  ' ': '',
};

/** Stars per letter: enough for the busiest glyph. */
export const PER_LETTER = 10;

export interface Glyph {
  stars: [number, number][];
  lines: [number, number][];
}

/** A letter's stars (unique points) and the lines between them. */
export function glyph(ch: string): Glyph {
  const stars: [number, number][] = [];
  const lines: [number, number][] = [];
  const index = (x: number, y: number) => {
    const i = stars.findIndex(([sx, sy]) => Math.abs(sx - x) < 1e-6 && Math.abs(sy - y) < 1e-6);
    if (i >= 0) return i;
    stars.push([x, y]);
    return stars.length - 1;
  };
  for (const stroke of (STROKES[ch] ?? '').split('|').filter(Boolean)) {
    const pts = stroke.split(' ').map((p) => p.split(',').map(Number) as [number, number]);
    let last = -1;
    for (const [x, y] of pts) {
      const i = index(x, y);
      if (last >= 0 && last !== i && !lines.some(([a, b]) => (a === last && b === i) || (a === i && b === last))) lines.push([last, i]);
      last = i;
    }
  }
  return { stars, lines };
}

// Each letter's glyph, worked out once.
const GLYPHS = new Map<string, Glyph>();
const glyphOf = (ch: string) => {
  let g = GLYPHS.get(ch);
  if (!g) GLYPHS.set(ch, (g = glyph(ch)));
  return g;
};

const STAR_VERT = /* glsl */ `
  attribute vec3 aColor;
  attribute float aLevel;
  uniform float uPx;
  varying vec3 vColor;
  void main() {
    vColor = aColor * aLevel;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = (2.4 + aLevel * 5.2) * uPx;
    gl_Position = projectionMatrix * mv;
  }
`;
const STAR_FRAG = /* glsl */ `
  varying vec3 vColor;
  void main() {
    float r = length(gl_PointCoord - 0.5) * 2.0;
    float core = exp(-r * r * 9.0);
    float halo = exp(-r * r * 2.2) * 0.25;
    gl_FragColor = vec4(vColor * (core * 2.4 + halo), 1.0);
  }
`;
const LINE_VERT = /* glsl */ `
  attribute float aAlpha;
  varying float vAlpha;
  void main() {
    vAlpha = aAlpha;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const LINE_FRAG = /* glsl */ `
  uniform vec3 uColor;
  varying float vAlpha;
  void main() { gl_FragColor = vec4(uColor * vAlpha, 1.0); }
`;

export interface StarBoard extends Board {
  group: THREE.Group;
  face: THREE.Mesh;
  /** How many of the letters have settled, 0..1. */
  settled(): number;
  /** Keep the stars a steady size on any screen; call with the renderer's pixel ratio. */
  setPixelRatio(px: number): void;
}

/**
 * The board, `unit` meters to a grid step (a letter is six tall). Built facing
 * +z; place and turn the group to face whoever looks at it.
 */
export function buildStarBoard(unit: number): StarBoard {
  const group = new THREE.Group();
  const advance = 5.6 * unit;
  const N = MAX_PHRASE * PER_LETTER;
  const r = rng(1919);

  // Every star: where it is, where it's going, and how bright it is.
  const pos = new Float32Array(N * 3);
  const color = new Float32Array(N * 3);
  const level = new Float32Array(N);
  const vel = new Float32Array(N * 2);
  const xy = new Float32Array(N * 2);
  const wander = Array.from({ length: N }, () => ({ p: r() * 6.28, q: r() * 6.28, f: 0.25 + r() * 0.35, mag: 0.55 + r() * 0.45 }));
  for (let i = 0; i < N; i++) {
    // Mostly white, some a little blue, some a little gold, like the real ones.
    const k = r();
    const c = k < 0.25 ? [0.78, 0.86, 1] : k < 0.45 ? [1, 0.88, 0.7] : [1, 0.97, 0.92];
    color.set(c, i * 3);
    // Start about where its letter will be, scattered.
    const slot = Math.floor(i / PER_LETTER);
    xy[i * 2] = (slot - (MAX_PHRASE - 1) / 2) * advance + (r() - 0.5) * 3 * advance;
    xy[i * 2 + 1] = (r() - 0.2) * 7 * unit;
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  starGeo.setAttribute('aColor', new THREE.BufferAttribute(color, 3));
  starGeo.setAttribute('aLevel', new THREE.BufferAttribute(level, 1));
  const starMat = new THREE.ShaderMaterial({
    vertexShader: STAR_VERT,
    fragmentShader: STAR_FRAG,
    uniforms: { uPx: { value: 1 } },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const stars = new THREE.Points(starGeo, starMat);
  stars.frustumCulled = false;
  group.add(stars);

  // The lines: a thin quad for each, so they stay a couple of pixels wide.
  const MAX_LINES = MAX_PHRASE * 14;
  const linePos = new Float32Array(MAX_LINES * 4 * 3);
  const lineAlpha = new Float32Array(MAX_LINES * 4);
  const lineIndex: number[] = [];
  for (let i = 0; i < MAX_LINES; i++) lineIndex.push(i * 4, i * 4 + 1, i * 4 + 2, i * 4, i * 4 + 2, i * 4 + 3);
  const lineGeo = new THREE.BufferGeometry();
  lineGeo.setAttribute('position', new THREE.BufferAttribute(linePos, 3));
  lineGeo.setAttribute('aAlpha', new THREE.BufferAttribute(lineAlpha, 1));
  lineGeo.setIndex(lineIndex);
  const lines = new THREE.Mesh(
    lineGeo,
    new THREE.ShaderMaterial({
      vertexShader: LINE_VERT,
      fragmentShader: LINE_FRAG,
      uniforms: { uColor: { value: new THREE.Color(0.26, 0.36, 0.58) } },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    }),
  );
  lines.frustumCulled = false;
  group.add(lines);
  const halfWidth = unit * 0.045;

  // What to click: the whole stretch of sky the phrase spans.
  const face = new THREE.Mesh(new THREE.PlaneGeometry(MAX_PHRASE * advance, 9 * unit), new THREE.MeshBasicMaterial({ visible: false }));
  face.position.y = 3 * unit;
  group.add(face);

  // The phrase, bred the usual way.
  const evolver = new Evolver(Math.random, 40, 0.05);
  let phrase = 0;
  evolver.aim(PHRASES[0]);
  evolver.scramble();
  let state = evolver.state();
  let custom = false;
  let holdUntil = 0;
  let nextGen = 0;
  // How settled each letter is (0 seeking, 1 in place), eased, and how bright its lines are.
  const settle = new Float32Array(MAX_PHRASE);
  const flash = new Float32Array(MAX_PHRASE);
  const wasRight = new Uint8Array(MAX_PHRASE);
  let lastT = 0;

  const place = (t: number, dt: number) => {
    const L = state.target.length;
    const k = 1 - Math.exp(-dt * 2.2);
    let line = 0;
    for (let s = 0; s < MAX_PHRASE; s++) {
      const inPhrase = s < L;
      const right = inPhrase && state.text[s] === state.target[s];
      if (right && !wasRight[s]) flash[s] = 1;
      wasRight[s] = right ? 1 : 0;
      settle[s] += ((right ? 1 : 0) - settle[s]) * (1 - Math.exp(-dt * (right ? 1.6 : 4)));
      flash[s] = Math.max(0, flash[s] - dt * 1.2);
      const g = inPhrase ? glyphOf(state.text[s]) : glyphOf(' ');
      const cx = (s - (L - 1) / 2) * advance - 2 * unit;
      const loose = 1 - settle[s];
      for (let j = 0; j < PER_LETTER; j++) {
        const i = s * PER_LETTER + j;
        const w = wander[i];
        const has = j < g.stars.length;
        // Where it's heading: its place in the letter, or (spare stars) somewhere about it.
        const [gx, gy] = has ? g.stars[j] : [2 + Math.sin(w.p * 3) * 2.4, 3 + Math.cos(w.q * 2) * 3.2];
        // Wrong letters wander a long way off their marks.
        const drift = (has ? 1.3 : 2.4) * loose;
        const tx = cx + (gx + Math.sin(t * w.f + w.p) * drift) * unit;
        const ty = (gy + Math.cos(t * w.f * 0.8 + w.q) * drift) * unit;
        // A soft spring toward it, a little slower for the stars still looking.
        const spring = right ? 3.2 : 1.4;
        const vx = vel[i * 2] + (tx - xy[i * 2]) * spring * dt;
        const vy = vel[i * 2 + 1] + (ty - xy[i * 2 + 1]) * spring * dt;
        vel[i * 2] = vx * Math.exp(-dt * 2.6);
        vel[i * 2 + 1] = vy * Math.exp(-dt * 2.6);
        xy[i * 2] += vel[i * 2] * dt;
        xy[i * 2 + 1] += vel[i * 2 + 1] * dt;
        pos[i * 3] = xy[i * 2];
        pos[i * 3 + 1] = xy[i * 2 + 1];
        pos[i * 3 + 2] = 0;
        // Bright once in place (and a flare as it lands); faint while it looks; spare stars fade out.
        const twinkle = 0.88 + 0.12 * Math.sin(t * (2.1 + w.f * 3) + w.q * 5);
        const aim = !inPhrase ? 0 : has ? (0.22 + 0.78 * settle[s]) * w.mag + flash[s] * 0.8 : 0.18 * loose * w.mag;
        level[i] += (aim * twinkle - level[i]) * k * 2;
      }
      // The lines join a letter's stars once it's right, and its stars have arrived.
      const lineLevel = inPhrase ? Math.max(0, settle[s] - 0.25) / 0.75 : 0;
      if (lineLevel > 0.01)
        for (const [a, b] of g.lines) {
          if (line >= MAX_LINES) break;
          const ia = s * PER_LETTER + a;
          const ib = s * PER_LETTER + b;
          const ax = xy[ia * 2];
          const ay = xy[ia * 2 + 1];
          const bx = xy[ib * 2];
          const by = xy[ib * 2 + 1];
          const off = Math.max(
            Math.hypot(ax - cx - g.stars[a][0] * unit, ay - g.stars[a][1] * unit),
            Math.hypot(bx - cx - g.stars[b][0] * unit, by - g.stars[b][1] * unit),
          );
          const near = Math.max(0, 1 - off / (unit * 0.8));
          if (near <= 0) continue;
          // Stop short of each star, so the line doesn't run through its glow.
          const dx = bx - ax;
          const dy = by - ay;
          const len = Math.hypot(dx, dy) || 1;
          const gap = Math.min(unit * 0.32, len * 0.3);
          const ux = dx / len;
          const uy = dy / len;
          const nx = -uy * halfWidth;
          const ny = ux * halfWidth;
          const x0 = ax + ux * gap;
          const y0 = ay + uy * gap;
          const x1 = bx - ux * gap;
          const y1 = by - uy * gap;
          linePos.set([x0 + nx, y0 + ny, 0, x1 + nx, y1 + ny, 0, x1 - nx, y1 - ny, 0, x0 - nx, y0 - ny, 0], line * 12);
          lineAlpha.fill(lineLevel * near * 0.75, line * 4, line * 4 + 4);
          line++;
        }
    }
    lineAlpha.fill(0, line * 4);
    starGeo.attributes.position.needsUpdate = true;
    starGeo.attributes.aLevel.needsUpdate = true;
    lineGeo.attributes.position.needsUpdate = true;
    lineGeo.attributes.aAlpha.needsUpdate = true;
    lineGeo.setDrawRange(0, Math.max(1, line) * 6);
  };

  return {
    group,
    face,
    settled: () => {
      const L = state.target.length || 1;
      let s = 0;
      for (let i = 0; i < state.target.length; i++) s += settle[i];
      return s / L;
    },
    setPixelRatio: (px) => (starMat.uniforms.uPx.value = px),
    evolution: (): Evolution => ({ ...state, custom }),
    evolve(text) {
      custom = true;
      holdUntil = 0;
      evolver.aim(text.slice(0, MAX_PHRASE));
      state = evolver.state();
    },
    tick(t) {
      const dt = Math.min(0.1, Math.max(0, t - lastT));
      lastT = t;
      if (t >= nextGen) {
        // A little slower than the other boards: stars take their time.
        let steps = Math.min(12, 1 + Math.floor((t - nextGen) / 0.16));
        nextGen = t + 0.16;
        while (steps-- > 0) {
          if (state.done) {
            if (!holdUntil) holdUntil = t + (custom ? 18 : 9);
            if (t > holdUntil) {
              holdUntil = 0;
              custom = false;
              phrase = (phrase + 1) % PHRASES.length;
              evolver.aim(PHRASES[phrase]);
            }
          }
          state = state.done && holdUntil ? state : evolver.step();
        }
      }
      place(t, dt);
      return 0;
    },
  };
}
