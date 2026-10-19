// A split-flap board over the window, like an old station departures board.
// It runs the weasel program: random letters, copied with mistakes, the best
// copy kept, until they spell something. Every change clatters through a flap.
import * as THREE from 'three';
import { ALPHABET, Evolver } from '../../evolve';
import { canvas, texture } from '../../textures';

export const MODULES = 16;
export const PHRASES = ['EVOLVING WORD', 'DESIGN TOGETHER', 'PRINT TOGETHER', 'MAKE SOMETHING', 'KEEP RUNNING', 'WRITE IT DOWN', 'OUR STUDIO', 'STAY CURIOUS'];

/** Centers a phrase on the board. */
export const pad = (text: string) => {
  const t = text.slice(0, MODULES);
  const left = Math.floor((MODULES - t.length) / 2);
  return ' '.repeat(left) + t + ' '.repeat(MODULES - t.length - left);
};

export interface Flap {
  group: THREE.Group;
  /** The face of the board, for clicking on. */
  face: THREE.Mesh;
  evolution(): { text: string; target: string; generation: number; fitness: number; done: boolean; custom: boolean };
  /** Breeds someone's own phrase, then goes back to ours. */
  evolve(text: string): void;
  /** Advances the board; returns how many flaps fell this frame (for the sound). */
  tick(t: number): number;
}

const CELL_W = 128;
const CELL_H = 224;

export function buildFlap(width: number, height: number): Flap {
  const group = new THREE.Group();
  const [c, g] = canvas(CELL_W * MODULES, CELL_H);
  const tex = texture(c);
  tex.anisotropy = 8;

  // The housing: a dark aluminum box with a lip.
  const housing = new THREE.Mesh(new THREE.BoxGeometry(width + 0.06, height + 0.06, 0.08), new THREE.MeshStandardMaterial({ color: '#1b1c20', metalness: 0.6, roughness: 0.4 }));
  housing.position.z = -0.04;
  group.add(housing);
  const face = new THREE.Mesh(new THREE.PlaneGeometry(width, height), new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color(0.7, 0.7, 0.7) }));
  face.position.z = 0.002;
  group.add(face);

  // Each module: what it shows, what it's flipping to, how far through the flip.
  const shown = Array.from({ length: MODULES }, () => ' ');
  const queue: string[][] = Array.from({ length: MODULES }, () => []);
  const flipFrom = Array.from({ length: MODULES }, () => ' ');
  const flipAt = new Float32Array(MODULES).fill(-1);
  const FLIP = 0.075;

  const drawHalf = (x: number, ch: string, half: 'top' | 'bottom', squash = 1, shade = 0) => {
    const midY = CELL_H / 2;
    g.save();
    g.beginPath();
    if (half === 'top') g.rect(x + 6, 10, CELL_W - 12, midY - 11);
    else g.rect(x + 6, midY + 1, CELL_W - 12, midY - 11);
    g.clip();
    // Squash toward the hinge in the middle, for a flap mid-fall.
    g.translate(0, midY);
    g.scale(1, squash);
    g.translate(0, -midY);
    g.fillStyle = '#1a1a1d';
    g.fillRect(x + 6, 10, CELL_W - 12, CELL_H - 20);
    g.fillStyle = '#f2efe6';
    g.font = '700 168px "Space Mono", monospace';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(ch, x + CELL_W / 2, midY + 8);
    if (shade) {
      g.fillStyle = `rgba(0,0,0,${shade})`;
      g.fillRect(x + 6, 10, CELL_W - 12, CELL_H - 20);
    }
    g.restore();
  };

  const drawModule = (i: number, now: number) => {
    const x = i * CELL_W;
    g.fillStyle = '#0c0c0e';
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
    // The hinge line and the little axle pins.
    g.fillStyle = '#000';
    g.fillRect(x + 6, CELL_H / 2 - 1.5, CELL_W - 12, 3);
    g.fillStyle = '#3a3a40';
    g.fillRect(x + 2, CELL_H / 2 - 5, 5, 10);
    g.fillRect(x + CELL_W - 7, CELL_H / 2 - 5, 5, 10);
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

  /** Real boards can only go forward through the alphabet; we take a short cut. */
  const route = (from: string, to: string) => {
    const a = ALPHABET.indexOf(from);
    const b = ALPHABET.indexOf(to);
    const steps: string[] = [];
    const n = Math.min(3, (b - a + ALPHABET.length) % ALPHABET.length);
    for (let k = 1; k < n; k++) steps.push(ALPHABET[(a + k) % ALPHABET.length]);
    steps.push(to);
    return steps;
  };

  return {
    group,
    face,
    evolution: () => ({ ...state, custom }),
    evolve(text) {
      custom = true;
      holdUntil = 0;
      evolver.aim(pad(text));
      state = evolver.state();
    },
    tick(t) {
      let fell = 0;
      if (t >= nextGen) {
        // Catch up on generations a slow frame or a hidden tab missed, a few at a time.
        let steps = Math.min(12, 1 + Math.floor((t - nextGen) / 0.16));
        nextGen = t + 0.16;
        while (steps-- > 0) {
          if (state.done) {
            if (!holdUntil) holdUntil = t + (custom ? 16 : 6);
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
          if (want !== last) queue[i].push(...route(last, want));
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
