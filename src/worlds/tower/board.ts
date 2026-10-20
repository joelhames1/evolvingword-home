// The departures board hanging over the glass: amber dot-matrix, a 5x7 font, every
// LED its own dot. The top flight's destination is the weasel program at work:
// letters copied with mistakes, the best copy kept, until it spells something.
// Then it moves down the board to board, and the next one starts breeding.
import * as THREE from 'three';
import { Evolver } from '../../evolve';
import type { Board, Evolution } from '../kit';

export const DEST = 16;
export const PHRASES = ['EVOLVING WORD', 'CLEARED TO BUILD', 'DESIGN TOGETHER', 'PRINT TOGETHER', 'FIRST LIGHT', 'MAKE SOMETHING', 'OUR STUDIO', 'STAY CURIOUS'];

/** The board's font: seven rows of five dots per character. */
export const FONT: Record<string, string> = {
  A: '.###.#...##...#######...##...##...#',
  B: '####.#...##...#####.#...##...#####.',
  C: '.###.#...##....#....#....#...#.###.',
  D: '####.#...##...##...##...##...#####.',
  E: '######....#....####.#....#....#####',
  F: '######....#....####.#....#....#....',
  G: '.###.#...##....#.####...##...#.####',
  H: '#...##...##...#######...##...##...#',
  I: '.###...#....#....#....#....#...###.',
  J: '..###...#....#....#....#.#..#..##..',
  K: '#...##..#.#.#..##...#.#..#..#.#...#',
  L: '#....#....#....#....#....#....#####',
  M: '#...###.###.#.##.#.##...##...##...#',
  N: '#...##...###..##.#.##..###...##...#',
  O: '.###.#...##...##...##...##...#.###.',
  P: '####.#...##...#####.#....#....#....',
  Q: '.###.#...##...##...##.#.##..#..##.#',
  R: '####.#...##...#####.#.#..#..#.#...#',
  S: '.#####....#.....###.....#....#####.',
  T: '#####..#....#....#....#....#....#..',
  U: '#...##...##...##...##...##...#.###.',
  V: '#...##...##...##...##...#.#.#...#..',
  W: '#...##...##...##.#.##.#.##.#.#.#.#.',
  X: '#...##...#.#.#...#...#.#.#...##...#',
  Y: '#...##...#.#.#...#....#....#....#..',
  Z: '#####....#...#...#...#...#....#####',
  '0': '.###.#...##..###.#.###..##...#.###.',
  '1': '..#...##....#....#....#....#...###.',
  '2': '.###.#...#....#...#...#...#...#####',
  '3': '#####...#...#.....#.....##...#.###.',
  '4': '...#...##..#.#.#..#.#####...#....#.',
  '5': '######....####.....#....##...#.###.',
  '6': '..##..#...#....####.#...##...#.###.',
  '7': '#####....#...#...#...#....#....#...',
  '8': '.###.#...##...#.###.#...##...#.###.',
  '9': '.###.#...##...#.####....#...#..##..',
  '!': '..#....#....#....#....#.........#..',
  '&': '.##..#..#.#.#...#...#.#.##..#..##.#',
  "'": '..#....#...#.......................',
  ':': '......##...##........##...##.......',
  '.': '..........................##...##..',
  '-': '...............#####...............',
  '/': '.........#...#...#...#...#.........',
  ' ': '...................................',
};

/** One character's dots, row by row (a missing glyph is blank). */
export const glyph = (ch: string) => {
  const g = (FONT[ch] ?? FONT[' ']).padEnd(35, '.');
  return Array.from({ length: 7 }, (_, row) => [...g.slice(row * 5, row * 5 + 5)].map((c) => c === '#'));
};

// The grid: a margin, a header line and three flights, each line nine dots tall.
const COLS = 256;
const ROWS = 40;
const CELL = 6;
const LINE = 9;
// Where each column starts, in characters: time, flight, destination, gate, remarks.
const AT = { time: 0, flight: 6, dest: 13, gate: 30, remark: 33 };

const VERT = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;
const FRAG = /* glsl */ `
  uniform sampler2D uLeds;
  uniform vec2 uGrid;
  uniform vec3 uOn;
  uniform vec3 uOff;
  varying vec2 vUv;
  void main() {
    vec2 g = vUv * uGrid;
    vec2 cell = floor(g);
    vec2 f = fract(g) - 0.5;
    // Row 0 of the grid is the top of the board.
    float level = texture2D(uLeds, vec2(cell.x + 0.5, uGrid.y - cell.y - 0.5) / uGrid).r;
    float r = length(f);
    // Each LED a round dot, sized to the pixel so it stays crisp far off.
    float w = fwidth(g.x) * 0.7;
    float dot = smoothstep(0.38 + w, 0.38 - w, r);
    float halo = smoothstep(0.75, 0.0, r) * 0.25;
    vec3 col = uOff * dot + uOn * level * (dot + halo);
    // Smoked glass in front.
    gl_FragColor = vec4(col + vec3(0.004, 0.004, 0.005), 1.0);
  }
`;

export interface DotBoard extends Board {
  group: THREE.Group;
  face: THREE.Mesh;
}

export function buildDotBoard(width: number): DotBoard {
  const height = (width * ROWS) / COLS;
  const group = new THREE.Group();
  const data = new Uint8Array(COLS * ROWS * 4);
  const leds = new THREE.DataTexture(data, COLS, ROWS, THREE.RGBAFormat);
  leds.magFilter = THREE.NearestFilter;
  leds.minFilter = THREE.NearestFilter;
  leds.flipY = false;
  leds.needsUpdate = true;

  // The housing: black, a lip round the glass, hung from the ceiling on two rods.
  const black = new THREE.MeshStandardMaterial({ color: '#141518', roughness: 0.5, metalness: 0.4 });
  const housing = new THREE.Mesh(new THREE.BoxGeometry(width + 0.08, height + 0.08, 0.12), black);
  housing.position.z = -0.06;
  // No shadow: the low sun would throw a dark smudge of it across the back wall.
  group.add(housing);
  for (const x of [-width * 0.38, width * 0.38]) {
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.5, 8), black);
    rod.position.set(x, height / 2 + 0.29, -0.06);
    group.add(rod);
  }
  const face = new THREE.Mesh(
    new THREE.PlaneGeometry(width, height),
    new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: {
        uLeds: { value: leds },
        uGrid: { value: new THREE.Vector2(COLS, ROWS) },
        uOn: { value: new THREE.Color(2.6, 1.15, 0.18) },
        uOff: { value: new THREE.Color(0.035, 0.018, 0.006) },
      },
    }),
  );
  face.position.z = 0.002;
  group.add(face);

  const level = new Uint8Array(COLS * ROWS);
  const clear = () => level.fill(0);
  /** Writes text at a character column on one of the four lines. */
  const write = (text: string, col: number, line: number, bright: (i: number) => number = () => 255) => {
    const y0 = 2 + line * LINE;
    [...text].forEach((ch, i) => {
      const x0 = 2 + (col + i) * CELL;
      const b = bright(i);
      glyph(ch).forEach((row, ry) =>
        row.forEach((on, rx) => {
          const x = x0 + rx;
          const y = y0 + ry;
          if (on && x < COLS && y < ROWS) level[y * COLS + x] = b;
        }),
      );
    });
  };
  const upload = () => {
    for (let i = 0; i < level.length; i++) data[i * 4] = level[i];
    leds.needsUpdate = true;
  };

  // The flights: the newest breeds its destination; above it, the last two that made it.
  type Flight = { time: number; no: number; dest: string; gate: string; remark: string };
  let clock = 6 * 60 + 10;
  let flightNo = 101;
  const gates = ['A2', 'A4', 'B1', 'B3', 'B6', 'C2', 'C5', 'C7'];
  const next = (dest: string): Flight => ({ time: (clock += 15), no: flightNo++, dest, gate: gates[flightNo % gates.length], remark: '' });
  const below: Flight[] = [
    { ...next('MAKE SOMETHING'), remark: 'DEPARTED' },
    { ...next('STAY CURIOUS'), remark: 'BOARDING' },
  ];
  let top = next('');
  const hhmm = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

  const evolver = new Evolver(Math.random, 40, 0.05);
  let phrase = 0;
  evolver.aim(PHRASES[0].padEnd(DEST));
  evolver.scramble();
  let state = evolver.state();
  let custom = false;
  let holdUntil = 0;
  let nextGen = 0;
  let lastDraw = -1;

  const draw = (t: number) => {
    clear();
    const now = new Date();
    write('DEPARTURES', 0, 0);
    write(hhmm(now.getHours() * 60 + now.getMinutes()), 37, 0, () => (now.getSeconds() % 2 ? 255 : 200));
    const line = (f: Flight, row: number, dest: (i: number) => number = () => 255) => {
      write(hhmm(f.time), AT.time, row, () => 220);
      write(`EW${String(f.no).padStart(4, ' ')}`, AT.flight, row, () => 220);
      write(f.dest.padEnd(DEST).slice(0, DEST), AT.dest, row, dest);
      write(f.gate, AT.gate, row, () => 220);
      write(f.remark.padEnd(9).slice(0, 9), AT.remark, row, () => (f.remark === 'BOARDING' && t % 1.2 < 0.4 ? 90 : 230));
    };
    top.dest = state.text;
    top.remark = state.done ? (custom ? 'YOURS' : 'ON TIME') : `GEN ${String(state.generation).padStart(4, '0')}`;
    // Letters still wrong glow dimmer, and shimmer.
    // Oldest first, the way the board sorts them: departed, boarding, then the one still breeding.
    line(below[1], 1);
    line(below[0], 2);
    line(top, 3, (i) => (state.done || state.text[i] === state.target[i] ? 255 : 70 + Math.floor(60 * Math.abs(Math.sin(t * 9 + i)))));
    upload();
  };
  draw(0);

  return {
    group,
    face,
    evolution: (): Evolution => ({ ...state, custom }),
    evolve(text) {
      custom = true;
      holdUntil = 0;
      evolver.aim(text.padEnd(DEST).slice(0, DEST));
      state = evolver.state();
    },
    tick(t) {
      if (t >= nextGen) {
        // Catch up on generations a slow frame or a hidden tab missed, a few at a time.
        let steps = Math.min(12, 1 + Math.floor((t - nextGen) / 0.12));
        nextGen = t + 0.12;
        while (steps-- > 0) {
          if (state.done) {
            if (!holdUntil) holdUntil = t + (custom ? 16 : 6);
            if (t > holdUntil) {
              holdUntil = 0;
              // The finished flight moves down to boarding, the last one departs.
              below[1] = { ...below[0], remark: 'DEPARTED' };
              below[0] = { ...top, dest: state.target.trim(), remark: 'BOARDING' };
              top = next('');
              custom = false;
              phrase = (phrase + 1) % PHRASES.length;
              evolver.aim(PHRASES[phrase].padEnd(DEST));
            }
          }
          state = state.done && holdUntil ? state : evolver.step();
        }
      }
      // A dozen redraws a second is plenty for LEDs.
      if (t - lastDraw > 1 / 12) {
        lastDraw = t;
        draw(t);
      }
      return 0;
    },
  };
}
