// The split-flap board over the compartment window, the kind every station
// used to have: cream letters on black flaps, each one dropping through the
// alphabet to the next. It runs the weasel program (copy the phrase with
// mistakes, keep the copy closest, again) and every change clatters through a
// flap. The stations' signs show the same flaps: one board, many faces.
import * as THREE from 'three';
import { ALPHABET, Evolver } from '../../evolve';
import { canvas, texture } from '../../textures';
import type { Board, Evolution } from '../kit';

export const MODULES = 16;
export const PHRASES = ['EVOLVING WORD', 'ALL ABOARD', 'THE NIGHT TRAIN', 'SLEEP WELL', 'MAKE SOMETHING', 'NEXT STOP', 'DESIGN TOGETHER', 'PRINT TOGETHER', 'KEEP GOING', 'OUR STUDIO', 'STAY CURIOUS', 'GOOD NIGHT'];

/** Centers a phrase on the board. */
export const pad = (text: string) => {
  const t = text.slice(0, MODULES);
  const left = Math.floor((MODULES - t.length) / 2);
  return ' '.repeat(left) + t + ' '.repeat(MODULES - t.length - left);
};

export interface FlapBoard extends Board {
  group: THREE.Group;
  face: THREE.Mesh;
  /** The flaps as a picture, for the stations' signs to show too. */
  texture: THREE.Texture;
  /** Starts breeding the next phrase now (a train coming in), unless someone's own is on. */
  next(): void;
}

const CELL_W = 128;
const CELL_H = 224;
/** Seconds a flap takes to fall, and between generations. */
const FLIP = 0.07;
const GEN = 0.16;

export function buildBoard(width: number): FlapBoard {
  const height = (width * CELL_H) / (CELL_W * MODULES);
  const group = new THREE.Group();
  const [c, g] = canvas(CELL_W * MODULES, CELL_H);
  const tex = texture(c);
  tex.anisotropy = 8;

  // The housing: black enamel in a brass frame.
  const brass = new THREE.MeshStandardMaterial({ color: '#b48a46', metalness: 0.9, roughness: 0.32 });
  const frame = new THREE.Mesh(new THREE.BoxGeometry(width + 0.05, height + 0.05, 0.05), brass);
  frame.position.z = -0.025;
  group.add(frame);
  const back = new THREE.Mesh(new THREE.PlaneGeometry(width + 0.018, height + 0.018), new THREE.MeshStandardMaterial({ color: '#0b0b0c', roughness: 0.6 }));
  back.position.z = 0.0015;
  group.add(back);
  const face = new THREE.Mesh(new THREE.PlaneGeometry(width, height), new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color(0.78, 0.76, 0.72) }));
  face.position.z = 0.003;
  group.add(face);

  // Each module: what it shows, what it's flipping to, how far through the flip.
  const shown = Array.from({ length: MODULES }, () => ' ');
  const queue: string[][] = Array.from({ length: MODULES }, () => []);
  const flipFrom = Array.from({ length: MODULES }, () => ' ');
  const flipAt = new Float32Array(MODULES).fill(-1);

  const drawHalf = (x: number, ch: string, half: 'top' | 'bottom', squash = 1, shade = 0) => {
    const midY = CELL_H / 2;
    g.save();
    g.beginPath();
    if (half === 'top') g.rect(x + 7, 12, CELL_W - 14, midY - 13);
    else g.rect(x + 7, midY + 1, CELL_W - 14, midY - 13);
    g.clip();
    // Squash toward the hinge in the middle, for a flap mid-fall.
    g.translate(0, midY);
    g.scale(1, squash);
    g.translate(0, -midY);
    g.fillStyle = half === 'top' ? '#1d1c1b' : '#171615';
    g.fillRect(x + 7, 12, CELL_W - 14, CELL_H - 24);
    g.fillStyle = '#f1e8d2';
    g.font = '700 164px "Space Mono", monospace';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(ch, x + CELL_W / 2, midY + 8);
    if (shade) {
      g.fillStyle = `rgba(0,0,0,${shade})`;
      g.fillRect(x + 7, 12, CELL_W - 14, CELL_H - 24);
    }
    g.restore();
  };

  const drawModule = (i: number, now: number) => {
    const x = i * CELL_W;
    g.fillStyle = '#080808';
    g.fillRect(x, 0, CELL_W, CELL_H);
    const p = flipAt[i] < 0 ? 1 : Math.min(1, (now - flipAt[i]) / FLIP);
    const next = shown[i];
    const prev = flipFrom[i];
    if (p >= 1) {
      drawHalf(x, next, 'top');
      drawHalf(x, next, 'bottom');
    } else {
      // Behind: the new letter's top, the old letter's bottom. In front, the flap.
      drawHalf(x, next, 'top');
      drawHalf(x, prev, 'bottom');
      if (p < 0.5) drawHalf(x, prev, 'top', Math.cos(p * Math.PI), p * 0.6);
      else drawHalf(x, next, 'bottom', -Math.cos(p * Math.PI), (1 - p) * 0.6);
    }
    // The hinge, and the little axle pins either side.
    g.fillStyle = '#000';
    g.fillRect(x + 7, CELL_H / 2 - 1.5, CELL_W - 14, 3);
    g.fillStyle = '#4a4238';
    g.fillRect(x + 2, CELL_H / 2 - 6, 5, 12);
    g.fillRect(x + CELL_W - 7, CELL_H / 2 - 6, 5, 12);
  };

  const evolver = new Evolver(Math.random, 40, 0.05);
  let phrase = 0;
  evolver.aim(pad(PHRASES[0]));
  evolver.scramble();
  let state = evolver.state();
  let custom = false;
  let holdUntil = 0;
  let nextGen = 0;
  let lastDraw = -1;
  for (let i = 0; i < MODULES; i++) shown[i] = state.text[i];

  /** A real board can only go forward through its letters; this one takes a short cut. */
  const steps = (from: string, to: string) => {
    const a = ALPHABET.indexOf(from);
    const b = ALPHABET.indexOf(to);
    const out: string[] = [];
    const n = Math.min(3, (b - a + ALPHABET.length) % ALPHABET.length);
    for (let k = 1; k < n; k++) out.push(ALPHABET[(a + k) % ALPHABET.length]);
    out.push(to);
    return out;
  };

  return {
    group,
    face,
    texture: tex,
    evolution: (): Evolution => ({ ...state, custom }),
    evolve(text) {
      custom = true;
      holdUntil = 0;
      evolver.aim(pad(text));
      state = evolver.state();
    },
    next() {
      if (custom) return;
      holdUntil = 0;
      phrase = (phrase + 1) % PHRASES.length;
      evolver.aim(pad(PHRASES[phrase]));
      state = evolver.state();
    },
    tick(t) {
      let fell = 0;
      if (t >= nextGen) {
        // Catch up on generations a slow frame or a hidden tab missed, a few at a time.
        let n = Math.min(12, 1 + Math.floor((t - nextGen) / GEN));
        nextGen = t + GEN;
        while (n-- > 0) {
          if (state.done) {
            if (!holdUntil) holdUntil = t + (custom ? 16 : 9);
            if (t > holdUntil) {
              holdUntil = 0;
              custom = false;
              phrase = (phrase + 1) % PHRASES.length;
              evolver.aim(pad(PHRASES[phrase]));
            }
          }
          state = state.done && holdUntil ? state : evolver.step();
        }
        for (let i = 0; i < MODULES; i++) {
          const want = state.text[i];
          const last = queue[i].length ? queue[i][queue[i].length - 1] : shown[i];
          if (want !== last) queue[i].push(...steps(last, want));
        }
      }
      // Start the next flap on any module that's free.
      let animating = false;
      for (let i = 0; i < MODULES; i++) {
        const busy = flipAt[i] >= 0 && t - flipAt[i] < FLIP;
        if (!busy && queue[i].length) {
          flipFrom[i] = shown[i];
          shown[i] = queue[i].shift()!;
          flipAt[i] = t;
          fell++;
        }
        if (flipAt[i] >= 0 && t - flipAt[i] < FLIP) animating = true;
      }
      if (animating || lastDraw < 0 || fell) {
        if (t - lastDraw > 1 / 40 || fell) {
          lastDraw = t;
          for (let i = 0; i < MODULES; i++) drawModule(i, t);
          tex.needsUpdate = true;
        }
      }
      return fell;
    },
  };
}
