// The painted band over the window: a strip of lime plaster with a line of
// lettering on it. The weasel program at work, the way a fresco goes up: wrong
// letters are only the faint red underdrawing, the sinopia; each one that comes
// right is painted in, in red ochre. Brother Sun at one end, Sister Moon at the other.
import * as THREE from 'three';
import { Evolver } from '../../evolve';
import { canvas, rng, texture } from '../../textures';
import type { Board, Evolution } from '../kit';

/**
 * What the band says, between visitors' own words. Most are from St. Francis's
 * Canticle of the Creatures, in Matthew Arnold's translation (public domain).
 */
export const PHRASES = ['EVOLVING WORD', 'OUR BROTHER SUN', 'OUR SISTER MOON', 'OUR BROTHER WIND', 'SISTER WATER', 'BROTHER FIRE', 'MOTHER EARTH', 'PEACE AND GOOD', 'MAKE SOMETHING'];

const W = 2048;
const H = 168;

export interface Band extends Board {
  mesh: THREE.Mesh;
}

export function buildBand(width: number, height: number): Band {
  const [c, g] = canvas(W, H);
  const tex = texture(c);
  tex.anisotropy = 8;
  const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95, emissive: '#ffffff', emissiveMap: tex, emissiveIntensity: 0.12 });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), mat);
  mesh.receiveShadow = true;

  // The plaster, mottled, painted once and kept.
  const [pc, pg] = canvas(W, H);
  const r = rng(61);
  pg.fillStyle = '#eee3d1';
  pg.fillRect(0, 0, W, H);
  for (let i = 0; i < 9000; i++) {
    pg.fillStyle = `rgba(${r() < 0.5 ? '255,250,240' : '150,120,90'},${r() * 0.05})`;
    const s = 2 + r() * 14;
    pg.fillRect(r() * W, r() * H, s, s * 0.6);
  }
  // Two ruled lines in red ochre, top and bottom.
  pg.fillStyle = 'rgba(150,62,38,0.85)';
  pg.fillRect(0, 10, W, 5);
  pg.fillRect(0, H - 15, W, 5);
  pg.fillStyle = 'rgba(150,62,38,0.4)';
  pg.fillRect(0, 20, W, 2);
  pg.fillRect(0, H - 22, W, 2);
  // Brother Sun on the left, Sister Moon on the right.
  pg.save();
  pg.translate(80, H / 2);
  pg.fillStyle = '#c98a2e';
  pg.beginPath();
  pg.arc(0, 0, 20, 0, Math.PI * 2);
  pg.fill();
  pg.strokeStyle = '#c98a2e';
  pg.lineWidth = 5;
  pg.lineCap = 'round';
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * Math.PI * 2;
    pg.beginPath();
    pg.moveTo(Math.cos(a) * 28, Math.sin(a) * 28);
    pg.lineTo(Math.cos(a) * (k % 2 ? 38 : 44), Math.sin(a) * (k % 2 ? 38 : 44));
    pg.stroke();
  }
  pg.restore();
  pg.save();
  pg.translate(W - 80, H / 2);
  pg.fillStyle = '#6d7e96';
  pg.beginPath();
  pg.arc(0, 0, 30, 0, Math.PI * 2);
  pg.arc(12, -6, 26, 0, Math.PI * 2, true);
  pg.fill('evenodd');
  pg.restore();

  const evolver = new Evolver(Math.random, 40, 0.05);
  let phrase = 0;
  evolver.aim(PHRASES[0]);
  evolver.scramble();
  let state = evolver.state();
  let custom = false;
  let holdUntil = 0;
  let nextGen = 0;
  let lastDraw = -1;
  /** When each letter last came right, so it can be painted in rather than appear. */
  const paintedAt: (number | undefined)[] = [];
  let lastText = '';

  const draw = (t: number) => {
    g.drawImage(pc, 0, 0);
    const text = state.text;
    const size = Math.min(104, (W - 320) / Math.max(text.length, 1) / 0.78);
    g.font = `500 ${size}px "EB Garamond", serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    const step = size * 0.78;
    const x0 = W / 2 - (step * (text.length - 1)) / 2;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (ch === ' ') continue;
      const right = ch === state.target[i];
      if (right && paintedAt[i] === undefined) paintedAt[i] = t;
      if (!right) paintedAt[i] = undefined;
      const x = x0 + i * step;
      const y = H / 2 + 6;
      if (!right) {
        // The underdrawing: thin, pale, a little uncertain.
        g.globalAlpha = 0.6;
        g.strokeStyle = '#c47a5c';
        g.lineWidth = 2;
        g.strokeText(ch, x + Math.sin(i * 7.1) * 1.5, y + Math.cos(i * 3.3) * 1.5);
      } else {
        const k = Math.min(1, (t - (paintedAt[i] ?? t)) / 0.6);
        g.globalAlpha = 0.35 + 0.65 * k;
        g.fillStyle = state.done ? '#8a2f1c' : '#9b3b22';
        g.fillText(ch, x, y);
      }
    }
    g.globalAlpha = 1;
    tex.needsUpdate = true;
  };
  draw(0);

  return {
    mesh,
    face: mesh,
    evolution: (): Evolution => ({ ...state, custom }),
    evolve(text) {
      custom = true;
      holdUntil = 0;
      evolver.aim(text);
      state = evolver.state();
    },
    tick(t) {
      if (t >= nextGen) {
        // Slower than the other boards: paint takes its time.
        let steps = Math.min(12, 1 + Math.floor((t - nextGen) / 0.14));
        nextGen = t + 0.14;
        while (steps-- > 0) {
          if (state.done) {
            if (!holdUntil) holdUntil = t + (custom ? 16 : 7);
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
      // Redraw while letters are being painted in, or when the text moves on.
      const fresh = state.text !== lastText || paintedAt.some((p) => p !== undefined && t - p < 0.7);
      if (fresh && t - lastDraw > 1 / 15) {
        lastDraw = t;
        lastText = state.text;
        draw(t);
      }
      return 0;
    },
  };
}
