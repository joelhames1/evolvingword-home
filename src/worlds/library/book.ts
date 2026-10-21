// The word board: a great open book, floating in the light over the well. Its
// pages are like every other page in the library, line after line of letters
// that say nothing. Across the middle of each page runs one line set larger,
// and there the weasel program works: copy the line with mistakes, keep the
// copy closest to the phrase, again and again. The letters still wrong stay
// faint, like the noise around them; each one that comes right is inked in
// red, the way a scribe picked out a heading. Meaning, bred out of noise.
//
// A phrase on the left page, then one on the right; then the leaf turns and a
// fresh spread of noise begins.
import * as THREE from 'three';
import { Evolver, type Generation } from '../../evolve';
import { canvas, rng, texture } from '../../textures';
import type { Board, Evolution } from '../kit';

/**
 * What the book breeds, two to a spread, read across. The lines from the King
 * James Bible (Ecclesiastes 12:12, Genesis 1:1) and the Vulgate (Genesis 1:3)
 * are in the public domain.
 */
export const PHRASES = [
  'EVOLVING WORD',
  'ALL THE BOOKS',
  'SENSE FROM NOISE',
  'LETTER BY LETTER',
  'OF MAKING BOOKS',
  'THERE IS NO END',
  'IN THE BEGINNING',
  'FIAT LUX',
  'SOMEWHERE HERE',
  'IS YOUR BOOK',
];

const PW = 1024;
const PH = 1420;
/** A page, in meters. */
export const PAGE = { w: 0.6, h: 0.83 };
const LINE_Y = PH * 0.47;
const RED = '#8c1d12';
/** Seconds per generation: ink takes its time. */
const GEN = 0.13;

interface Line {
  target: string;
  evolver: Evolver;
  state: Generation;
  custom: boolean;
  /** When each letter came right, so it can be inked in rather than appear. */
  inked: (number | undefined)[];
}

/** The paper, with its edge darkening toward the gutter. */
function paper(side: 'left' | 'right') {
  const [c, g] = canvas(PW, PH);
  const r = rng(side === 'left' ? 3 : 4);
  g.fillStyle = '#eadfc4';
  g.fillRect(0, 0, PW, PH);
  for (let i = 0; i < 9000; i++) {
    g.fillStyle = `rgba(${r() < 0.5 ? '255,250,235' : '140,110,70'},${r() * 0.05})`;
    g.fillRect(r() * PW, r() * PH, 1 + r() * 3, 1 + r() * 3);
  }
  // Foxing: a few faint brown spots.
  for (let i = 0; i < 14; i++) {
    const x = r() * PW;
    const y = r() * PH;
    const s = 4 + r() * 16;
    const f = g.createRadialGradient(x, y, 0, x, y, s);
    f.addColorStop(0, 'rgba(150,100,50,0.14)');
    f.addColorStop(1, 'rgba(150,100,50,0)');
    g.fillStyle = f;
    g.fillRect(x - s, y - s, 2 * s, 2 * s);
  }
  const gx = side === 'left' ? PW : 0;
  const gut = g.createLinearGradient(gx, 0, side === 'left' ? PW - 160 : 160, 0);
  gut.addColorStop(0, 'rgba(90,60,30,0.32)');
  gut.addColorStop(1, 'rgba(90,60,30,0)');
  g.fillStyle = gut;
  g.fillRect(0, 0, PW, PH);
  const edge = g.createRadialGradient(PW / 2, PH / 2, PH * 0.42, PW / 2, PH / 2, PH * 0.78);
  edge.addColorStop(0, 'rgba(120,80,40,0)');
  edge.addColorStop(1, 'rgba(120,80,40,0.22)');
  g.fillStyle = edge;
  g.fillRect(0, 0, PW, PH);
  return c;
}

const lower = 'abcdefghijklmnopqrstuvwxyz';

/** A page of noise: a running head, a red initial, and line after line of letters, with room left for the line that breeds. */
function noisePage(side: 'left' | 'right', seed: number) {
  const [c, g] = canvas(PW, PH);
  const r = rng(seed);
  g.drawImage(paper(side), 0, 0);
  const x0 = side === 'left' ? 96 : 130;
  const x1 = side === 'left' ? PW - 130 : PW - 96;
  // The running head and the folio: every book here has four hundred and ten pages.
  g.fillStyle = 'rgba(70,50,35,0.7)';
  g.font = '500 30px "EB Garamond", serif';
  g.textAlign = 'center';
  g.textBaseline = 'alphabetic';
  let head = '';
  for (let k = 0; k < 3; k++) head += (k ? ' · ' : '') + Array.from({ length: 2 + Math.floor(r() * 3) }, () => 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[Math.floor(r() * 26)]).join('');
  g.fillText(head, (x0 + x1) / 2, 92);
  g.textAlign = side === 'left' ? 'left' : 'right';
  g.fillText(String(1 + Math.floor(r() * 410)), side === 'left' ? x0 : x1, 92);
  g.fillStyle = 'rgba(140,40,25,0.55)';
  g.fillRect(x0, 108, x1 - x0, 2);
  // The text: lowercase letters, spaces, now and then a comma or a period. It reads as text from across the room.
  const size = 29;
  const lead = 39;
  g.font = `400 ${size}px "EB Garamond", serif`;
  g.textAlign = 'left';
  g.fillStyle = 'rgba(52,38,26,0.72)';
  const line = () => {
    let s = '';
    while (s.length < 60) {
      const n = 1 + Math.floor(r() * 9);
      for (let k = 0; k < n; k++) s += lower[Math.floor(r() * 26)];
      s += r() < 0.07 ? ', ' : r() < 0.04 ? '. ' : ' ';
    }
    return s;
  };
  const fit = (s: string, w: number) => {
    let out = s;
    while (g.measureText(out).width > w && out.length) out = out.slice(0, -1);
    return out.trimEnd();
  };
  let y = 172;
  let first = true;
  while (y < PH - 120) {
    if (y > LINE_Y - 110 && y < LINE_Y + 110) {
      y += lead;
      continue;
    }
    if (first) {
      // A red initial, three lines deep.
      g.save();
      g.fillStyle = RED;
      g.font = '400 128px "UnifrakturMaguntia", serif';
      g.fillText('ABCDEFGHLMNOPRST'[Math.floor(r() * 16)], x0 - 4, y + 2 * lead - 6);
      g.restore();
      g.font = `400 ${size}px "EB Garamond", serif`;
      g.fillStyle = 'rgba(52,38,26,0.72)';
      for (let k = 0; k < 3; k++) {
        g.fillText(fit(line(), x1 - x0 - 108), x0 + 108, y);
        y += lead;
      }
      first = false;
      continue;
    }
    g.fillText(fit(line(), x1 - x0), x0, y);
    y += lead;
  }
  // Thin red rules round the line that breeds.
  g.fillStyle = 'rgba(140,40,25,0.45)';
  g.fillRect(x0 + 40, LINE_Y - 82, x1 - x0 - 80, 2);
  g.fillRect(x0 + 40, LINE_Y + 72, x1 - x0 - 80, 2);
  return { canvas: c, x0, x1 };
}

export interface BookBoard extends Board {
  group: THREE.Group;
  /** True while a leaf is turning (for the sound of it). */
  turning(): boolean;
  /** Number of leaves turned so far. */
  turns(): number;
}

export function buildBook(): BookBoard {
  const group = new THREE.Group();
  const { w, h } = PAGE;

  // --- the pages: two live canvases, and the leaf that turns ---------------------------
  const live = {
    left: canvas(PW, PH),
    right: canvas(PW, PH),
  };
  const base = { left: noisePage('left', 1), right: noisePage('right', 2) };
  const leafFront = canvas(PW, PH);
  const leafBack = canvas(PW, PH);
  const tex = {
    left: texture(live.left[0]),
    right: texture(live.right[0]),
    front: texture(leafFront[0]),
    back: texture(leafBack[0]),
  };
  tex.back.wrapS = THREE.RepeatWrapping;
  tex.back.repeat.x = -1;
  tex.back.offset.x = 1;
  // Matte paper, a little lit from within. (Not a standard material: the hover
  // glow repaints those, and over the page it would dim the paper, not light it.)
  const pageMat = (map: THREE.Texture, side: THREE.Side = THREE.FrontSide) =>
    new THREE.MeshLambertMaterial({ map, emissive: '#ffffff', emissiveMap: map, emissiveIntensity: 0.32, side });

  // Each page curves up out of the gutter and lies nearly flat toward its edge.
  const curve = (s: number) => 0.05 * Math.sin(Math.min(1, s * 1.7) * Math.PI * 0.5) - 0.012 * s * s;
  const pageGeo = (sign: 1 | -1) => {
    const g = new THREE.PlaneGeometry(w, h, 32, 1);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const s = (p.getX(i) + w / 2) / w;
      const t = sign > 0 ? s : 1 - s;
      p.setX(i, sign * t * w);
      p.setZ(i, curve(t));
    }
    g.computeVertexNormals();
    return g;
  };
  const left = new THREE.Mesh(pageGeo(-1), pageMat(tex.left));
  const right = new THREE.Mesh(pageGeo(1), pageMat(tex.right));
  group.add(left, right);

  // The text block under each page (its edges), the boards and the spine.
  const [ec, eg] = canvas(256, 64);
  eg.fillStyle = '#d8c9a6';
  eg.fillRect(0, 0, 256, 64);
  for (let y = 0; y < 64; y += 2) {
    eg.fillStyle = `rgba(110,85,50,${0.15 + Math.random() * 0.15})`;
    eg.fillRect(0, y, 256, 1);
  }
  const edgeMat = new THREE.MeshStandardMaterial({ map: texture(ec), roughness: 0.95 });
  const leather = new THREE.MeshStandardMaterial({ color: '#4a1712', roughness: 0.62, metalness: 0.05 });
  for (const sign of [-1, 1]) {
    const block = new THREE.Mesh(new THREE.BoxGeometry(w - 0.02, h - 0.01, 0.05), [edgeMat, edgeMat, edgeMat, edgeMat, edgeMat, edgeMat]);
    block.position.set(sign * (w / 2 + 0.005), 0, -0.031);
    group.add(block);
    const board = new THREE.Mesh(new THREE.BoxGeometry(w + 0.03, h + 0.035, 0.014), leather);
    board.position.set(sign * (w / 2 + 0.012), 0, -0.064);
    group.add(board);
  }
  const spine = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, h + 0.035, 20, 1, true, Math.PI / 2, Math.PI), new THREE.MeshStandardMaterial({ color: '#4a1712', roughness: 0.62, side: THREE.DoubleSide }));
  spine.position.set(0, 0, -0.06);
  group.add(spine);
  // A red ribbon, hanging out of the bottom of the book and stirring in the air from the well.
  const ribbonGeo = new THREE.PlaneGeometry(0.022, 0.42, 1, 12);
  ribbonGeo.translate(0, -0.21, 0);
  const ribbon = new THREE.Mesh(ribbonGeo, new THREE.MeshStandardMaterial({ color: '#9a1c18', roughness: 0.6, side: THREE.DoubleSide }));
  ribbon.position.set(0.01, -h / 2 + 0.02, 0.02);
  group.add(ribbon);
  const ribbonRest = Float32Array.from(ribbonGeo.attributes.position.array as Float32Array);

  // The leaf: two faces of one bending sheet.
  const leafGeo = new THREE.PlaneGeometry(w, h, 32, 1);
  const leafFrontMesh = new THREE.Mesh(leafGeo, pageMat(tex.front));
  const leafBackMesh = new THREE.Mesh(leafGeo, pageMat(tex.back, THREE.BackSide));
  leafFrontMesh.visible = leafBackMesh.visible = false;
  group.add(leafFrontMesh, leafBackMesh);
  const bendLeaf = (theta: number) => {
    const p = leafGeo.attributes.position;
    const n = 32;
    const seg = w / n;
    // Each segment's angle: the rest curve of a right page at 0, of a left page at π, and in between the far edge lags.
    const xs = [0];
    const zs = [0.004];
    for (let i = 0; i < n; i++) {
      const s0 = i / n;
      const s1 = (i + 1) / n;
      const rest = Math.atan2(curve(s1) - curve(s0), seg);
      const phi = theta + rest * (1 - (2 * theta) / Math.PI) - 0.85 * Math.sin(theta) * Math.pow(s1, 1.4);
      xs.push(xs[i] + Math.cos(phi) * seg);
      zs.push(zs[i] + Math.sin(phi) * seg);
    }
    for (let i = 0; i < p.count; i++) {
      const col = i % (n + 1);
      p.setX(i, xs[col]);
      p.setZ(i, zs[col] + 0.003);
    }
    p.needsUpdate = true;
    leafGeo.computeVertexNormals();
  };

  // --- the breeding ------------------------------------------------------------------
  const line = (target: string, custom: boolean): Line => {
    const evolver = new Evolver(Math.random, 40, 0.05);
    evolver.aim(target);
    evolver.scramble();
    return { target, evolver, state: evolver.state(), custom, inked: [] };
  };
  let pair = 0;
  let seed = 10;
  const spread = { left: line(PHRASES[0], false) as Line | null, right: line(PHRASES[1], false) as Line | null };
  let active: 'left' | 'right' = 'left';
  let holdUntil = 0;
  let nextGen = 0;
  let turnStart = -1;
  let turned = 0;
  let queued: string | null = null;
  const dirty = { left: true, right: true };
  const lastDraw = { left: -1, right: -1 };

  const drawLine = (g: CanvasRenderingContext2D, l: Line, x0: number, x1: number, t: number) => {
    const text = l.state.text;
    const size = Math.min(88, ((x1 - x0 - 60) / Math.max(text.length, 1)) * 1.3);
    const step = size * 0.74;
    const start = (x0 + x1) / 2 - (step * (text.length - 1)) / 2;
    g.font = `500 ${size}px "EB Garamond", serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      const right = ch === l.target[i];
      if (right && l.inked[i] === undefined) l.inked[i] = t;
      if (!right) l.inked[i] = undefined;
      if (ch === ' ') continue;
      const x = start + i * step;
      if (!right) {
        g.globalAlpha = 0.5;
        g.fillStyle = '#6e6152';
        g.fillText(ch, x, LINE_Y);
      } else {
        const k = Math.min(1, (t - (l.inked[i] ?? t)) / 0.7);
        // Wet ink first: a little brighter, then settling dark.
        g.globalAlpha = 0.3 + 0.7 * k;
        g.fillStyle = k < 1 ? '#b0301e' : RED;
        g.fillText(ch, x, LINE_Y);
      }
    }
    g.globalAlpha = 1;
    if (l.state.done) {
      // A paragraph mark before it, in red, when it's whole.
      g.fillStyle = RED;
      g.font = `400 ${Math.round(size * 0.8)}px "EB Garamond", serif`;
      g.fillText('¶', start - step * 1.1, LINE_Y + 2);
    }
  };
  /** Draws a page (its noise, and its line as it stands) onto a canvas. */
  const paintTo = (g: CanvasRenderingContext2D, side: 'left' | 'right', t: number) => {
    const b = base[side];
    g.drawImage(b.canvas, 0, 0);
    const l = spread[side];
    if (l) drawLine(g, l, b.x0, b.x1, t);
  };
  const paint = (side: 'left' | 'right', t: number) => {
    paintTo(live[side][1], side, t);
    tex[side].needsUpdate = true;
    lastDraw[side] = t;
    dirty[side] = false;
  };

  /**
   * Turns the leaf: it carries the old right page over; under it is the next
   * right page, and on its back the next left one, which the left page shows
   * once the leaf lands.
   */
  const turn = (t: number, next: { left: Line | null; right: Line | null }) => {
    leafFront[1].drawImage(live.right[0], 0, 0);
    tex.front.needsUpdate = true;
    base.left = noisePage('left', seed++);
    base.right = noisePage('right', seed++);
    spread.left = next.left;
    spread.right = next.right;
    paintTo(leafBack[1], 'left', t);
    tex.back.needsUpdate = true;
    paint('right', t);
    dirty.left = true;
    // The leaf covers the new right page from this very frame, or it shows for a moment before the turn begins.
    leafFrontMesh.visible = leafBackMesh.visible = true;
    bendLeaf(0);
    turnStart = t;
    active = 'left';
    holdUntil = 0;
    turned++;
  };

  paint('left', 0);
  paint('right', 0);

  const evolution = (): Evolution => {
    const l = spread[active] ?? spread.left ?? spread.right;
    if (!l) return { text: '', target: '', generation: 0, fitness: 0, done: false, custom: false };
    return { ...l.state, custom: l.custom };
  };

  const step = (l: Line) => {
    l.state = l.evolver.step();
  };

  return {
    group,
    face: group,
    evolution,
    turning: () => turnStart >= 0,
    turns: () => turned,
    evolve(text) {
      queued = text;
    },
    tick(t) {
      // A visitor's phrase: a fresh spread for it, the right page left to noise.
      if (queued !== null && turnStart < 0) {
        const text = queued;
        queued = null;
        turn(t, { left: line(text, true), right: null });
      }
      // The leaf in the air.
      if (turnStart >= 0) {
        const k = Math.min(1, (t - turnStart) / 1.7);
        const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
        leafFrontMesh.visible = leafBackMesh.visible = true;
        bendLeaf(e * Math.PI);
        if (k >= 1) {
          turnStart = -1;
          leafFrontMesh.visible = leafBackMesh.visible = false;
        }
      }
      // Breed the active line, a generation at a time.
      const l = spread[active];
      if (turnStart < 0 && t >= nextGen) {
        let n = Math.min(10, 1 + Math.floor((t - nextGen) / GEN));
        nextGen = t + GEN;
        while (n-- > 0) {
          if (!l) break;
          if (!l.state.done) {
            step(l);
            dirty[active] = true;
            continue;
          }
          if (!holdUntil) holdUntil = t + (l.custom ? 16 : active === 'left' ? 3.5 : 9);
          if (t < holdUntil) break;
          holdUntil = 0;
          if (active === 'left' && spread.right) {
            active = 'right';
            break;
          }
          // The spread is done: on to the next pair.
          pair = (pair + 1) % (PHRASES.length / 2);
          turn(t, { left: line(PHRASES[pair * 2], false), right: line(PHRASES[pair * 2 + 1], false) });
          break;
        }
      }
      // Repaint while letters are being inked in, or when the text moves on.
      for (const side of ['left', 'right'] as const) {
        const ln = spread[side];
        const wet = ln?.inked.some((p) => p !== undefined && t - p < 0.75);
        if ((dirty[side] || wet) && t - lastDraw[side] > 1 / 12 && !(side === 'left' && turnStart >= 0)) paint(side, t);
      }
      // The ribbon stirs in the air rising up the well.
      const rp = ribbonGeo.attributes.position;
      for (let i = 0; i < rp.count; i++) {
        const y = ribbonRest[i * 3 + 1];
        const d = -y / 0.42;
        rp.setX(i, ribbonRest[i * 3] + Math.sin(t * 1.3 + d * 3) * 0.02 * d);
        rp.setZ(i, ribbonRest[i * 3 + 2] + Math.sin(t * 0.9 + d * 2.2) * 0.03 * d * d);
      }
      rp.needsUpdate = true;
      return 0;
    },
  };
}
