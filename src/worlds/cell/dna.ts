// The word board: a strand of DNA floating in front of the nucleus, and its
// reading in letters of light above it. Each letter is spelled by three base
// pairs, a codon, so the weasel program happens to the strand itself: as a
// letter mutates its three rungs flash and change color, and when the letter is
// right its rungs, and the letter over them, settle to a steady glow. Wrong
// ones flicker, still mutating. When the phrase is whole, a wave of light runs
// the length of the strand.
import * as THREE from 'three';
import { ALPHABET, Evolver, MAX_PHRASE } from '../../evolve';
import { canvas, texture } from '../../textures';
import type { Board, Evolution } from '../kit';
import { pearl } from './shaders';

/**
 * What the strand spells between visitors' own words: the first verse of a
 * gospel, then the last sentence of On the Origin of Species, a few words at a
 * time (both public domain).
 */
export const PHRASES = ['EVOLVING WORD', 'IN THE BEGINNING', 'THE WORD', 'FROM SO SIMPLE', 'A BEGINNING', 'ENDLESS FORMS', 'MOST BEAUTIFUL', 'MAKE SOMETHING'];

/** The four bases, and which each one pairs with across the helix. */
export const BASES = 'ACGT';
export const PAIR: Record<string, string> = { A: 'T', T: 'A', C: 'G', G: 'C' };

/** The three bases that spell a letter: its place in the alphabet, written in base four. */
export function codon(ch: string): string {
  const i = Math.max(0, ALPHABET.indexOf(ch));
  return BASES[(i >> 4) & 3] + BASES[(i >> 2) & 3] + BASES[i & 3];
}

/** The letter three bases spell, or null if they spell nothing (there are 64 codons and 40 letters). */
export function letter(c: string): string | null {
  if (c.length !== 3) return null;
  const d = [...c].map((b) => BASES.indexOf(b));
  if (d.some((x) => x < 0)) return null;
  return ALPHABET[d[0] * 16 + d[1] * 4 + d[2]] ?? null;
}

/** A phrase as one strand of bases, and the strand that pairs with it. */
export const strand = (text: string) => [...text].map(codon).join('');
export const complement = (bases: string) => [...bases].map((b) => PAIR[b]).join('');

/** Where a phrase sits on the strand's sixteen places: centered, as the letters are. */
export const offset = (text: string) => Math.floor((MAX_PHRASE - text.length) / 2);

const COLORS: Record<string, THREE.Color> = {
  A: new THREE.Color(1.0, 0.68, 0.22),
  T: new THREE.Color(1.0, 0.32, 0.42),
  G: new THREE.Color(0.2, 0.88, 0.78),
  C: new THREE.Color(0.58, 0.42, 1.0),
};

const SLOTS = MAX_PHRASE;
const PER = 3;
const FLANK = 6;
const RUNGS = SLOTS * PER + FLANK * 2;
/** Meters a letter takes along the strand. */
export const STEP = 0.24;
const RISE = STEP / PER;
const RADIUS = 0.17;
const TWIST = (Math.PI * 2) / 10;
/** The angle between the two strands: the minor groove on one side, the major on the other. */
const GROOVE = 2.4;
const W = 2048;
const H = 192;

export interface Helix extends Board {
  group: THREE.Group;
}

export function buildHelix(): Helix {
  const group = new THREE.Group();
  const spin = new THREE.Group();
  group.add(spin);
  const length = RUNGS * RISE;
  const x0 = -length / 2 + RISE / 2;
  const at = (i: number, strandB: boolean, out = new THREE.Vector3()) => {
    const a = i * TWIST + (strandB ? GROOVE : 0);
    return out.set(x0 + i * RISE, Math.cos(a) * RADIUS, Math.sin(a) * RADIUS);
  };

  // The two backbones, winding round each other.
  const backbone = pearl({ color: '#ffe2b8', edge: '#fff2dc', glow: 0.5 });
  for (const b of [false, true]) {
    const pts = Array.from({ length: RUNGS * 4 + 9 }, (_, k) => at(k / 4 - 1, b));
    const curve = new THREE.CatmullRomCurve3(pts);
    spin.add(new THREE.Mesh(new THREE.TubeGeometry(curve, RUNGS * 12, 0.022, 8), backbone));
  }

  // Each rung in two halves, one base's color each, and a bead where each meets its backbone.
  const rungMat = pearl({ color: '#ffffff', edge: '#ffffff', glow: 0.75 });
  const rungs = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.019, 0.019, 1, 8, 1), rungMat, RUNGS * 2);
  const beads = new THREE.InstancedMesh(new THREE.SphereGeometry(0.034, 12, 8), backbone, RUNGS * 2);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  for (let i = 0; i < RUNGS; i++) {
    at(i, false, a);
    at(i, true, b);
    const mid = a.clone().lerp(b, 0.5);
    for (const [k, from] of [
      [0, a],
      [1, b],
    ] as const) {
      const len = from.distanceTo(mid);
      q.setFromUnitVectors(up, mid.clone().sub(from).normalize());
      m.compose(from.clone().lerp(mid, 0.5), q, new THREE.Vector3(1, len, 1));
      rungs.setMatrixAt(i * 2 + k, m);
      m.compose(from, q, new THREE.Vector3(1, 1, 1));
      beads.setMatrixAt(i * 2 + k, m);
    }
  }
  spin.add(rungs, beads);

  // The bases on the flanks and the empty places don't change: a fixed random run.
  const filler = Array.from({ length: RUNGS }, (_, i) => BASES[(i * 7 + (i >> 2) * 3) % 4]);
  const tint = new THREE.Color();
  const white = new THREE.Color(1, 1, 1);

  // The reading, in letters of light above the strand.
  const [c, g] = canvas(W, H);
  const tex = texture(c);
  const letters = new THREE.Mesh(
    new THREE.PlaneGeometry(SLOTS * STEP, (SLOTS * STEP * H) / W),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: new THREE.Color(1.5, 1.5, 1.5), fog: false }),
  );
  letters.position.y = 0.46;
  group.add(letters);

  // What to click: the strand and its letters.
  const face = new THREE.Mesh(new THREE.BoxGeometry(length, 1.0, 0.5), new THREE.MeshBasicMaterial({ visible: false }));
  face.position.y = 0.2;
  group.add(face);

  const evolver = new Evolver(Math.random, 40, 0.05);
  let phrase = 0;
  evolver.aim(PHRASES[0]);
  evolver.scramble();
  let state = evolver.state();
  let custom = false;
  let holdUntil = 0;
  let nextGen = 0;
  let lastDraw = -1;
  let doneAt = -1;
  let now = 0;
  /** When each place last changed letter, for the flash. */
  const changed: number[] = Array(SLOTS).fill(-10);
  let shown = state.text;

  const draw = (t: number) => {
    g.clearRect(0, 0, W, H);
    const text = state.text;
    const o = offset(text);
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = '500 132px "EB Garamond", serif';
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      const x = (o + i + 0.5) * (W / SLOTS);
      const right = ch === state.target[i];
      // A thread of light down toward its codon.
      g.globalAlpha = right ? 0.55 : 0.18;
      g.fillStyle = right ? '#ffcf8a' : '#8fe6f0';
      g.fillRect(x - 1.5, H - 26, 3, 26);
      if (ch === ' ') continue;
      if (right) {
        g.globalAlpha = 1;
        g.shadowColor = 'rgba(255,170,80,0.9)';
        g.shadowBlur = 26;
        g.fillStyle = '#ffd896';
        g.fillText(ch, x, H / 2 - 8);
      } else {
        // Still mutating: faint, and flickering.
        const f = 0.5 + 0.5 * Math.sin(t * 23 + i * 2.7) * Math.sin(t * 7.1 + i);
        g.globalAlpha = 0.22 + 0.35 * f;
        g.shadowColor = 'rgba(90,220,230,0.8)';
        g.shadowBlur = 14;
        g.fillStyle = '#b8f4ff';
        g.fillText(ch, x + Math.sin(t * 31 + i) * 2, H / 2 - 8);
      }
      g.shadowBlur = 0;
    }
    g.globalAlpha = 1;
    tex.needsUpdate = true;
  };

  const paint = (t: number) => {
    const text = state.text;
    const o = offset(text);
    const wave = doneAt >= 0 ? (t - doneAt) / 2.6 : -1;
    for (let r = 0; r < RUNGS; r++) {
      const slot = Math.floor((r - FLANK) / PER);
      const i = slot - o;
      let base = filler[r];
      let k = 0.28;
      if (r >= FLANK && r < FLANK + SLOTS * PER && i >= 0 && i < text.length) {
        base = codon(text[i])[(r - FLANK) % PER];
        const right = text[i] === state.target[i];
        k = right ? 1.15 : 0.42 + 0.3 * Math.abs(Math.sin(t * 9 + i * 1.7 + (r % 3)));
      }
      tint.copy(COLORS[base]).multiplyScalar(k);
      // A letter that's just changed flashes white.
      const since = i >= 0 && i < text.length ? t - changed[o + i] : 10;
      if (since < 0.5) tint.lerp(white, (1 - since / 0.5) * 0.85).multiplyScalar(1 + (1 - since / 0.5));
      // The wave when it's done, running the strand's length.
      if (wave >= 0 && wave < 1.4) tint.multiplyScalar(1 + 1.6 * Math.exp(-Math.pow((r / RUNGS - wave) * 7, 2)));
      rungs.setColorAt(r * 2, tint);
      rungs.setColorAt(r * 2 + 1, tint.copy(COLORS[PAIR[base]]).multiplyScalar(k));
    }
    rungs.instanceColor!.needsUpdate = true;
  };
  paint(0);
  draw(0);

  return {
    group,
    face,
    evolution: (): Evolution => ({ ...state, custom }),
    evolve(text) {
      custom = true;
      holdUntil = 0;
      doneAt = -1;
      evolver.aim(text);
      state = evolver.state();
    },
    tick(t) {
      now = t;
      if (t >= nextGen) {
        let steps = Math.min(12, 1 + Math.floor((t - nextGen) / 0.13));
        nextGen = t + 0.13;
        while (steps-- > 0) {
          if (state.done) {
            if (!holdUntil) holdUntil = t + (custom ? 16 : 7);
            if (t > holdUntil) {
              holdUntil = 0;
              doneAt = -1;
              custom = false;
              phrase = (phrase + 1) % PHRASES.length;
              evolver.aim(PHRASES[phrase]);
            }
          }
          state = state.done && holdUntil ? state : evolver.step();
          if (state.done && doneAt < 0) doneAt = t;
        }
      }
      // Which letters changed this generation.
      if (state.text !== shown) {
        const o = offset(state.text);
        for (let i = 0; i < state.text.length; i++) if (state.text[i] !== shown[i] || state.text.length !== shown.length) changed[o + i] = t;
        shown = state.text;
      }
      spin.rotation.x = t * 0.16;
      paint(t);
      // The letters flicker while any are wrong; once it's whole, one last steady draw.
      const settled = state.done && lastDraw > doneAt && lastDraw >= 0 && doneAt >= 0;
      if (!settled && t - lastDraw > 1 / 14) {
        lastDraw = t;
        draw(now);
      }
      return 0;
    },
  };
}
