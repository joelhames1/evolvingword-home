// The ticket on the table. Click it and the conductor punches it: a little
// hole each time, in whatever shape his punch makes (they all had their own).
// Every landscape you pass through gets its rubber stamp. It remembers, on
// this computer: what's stored is checked before it's believed, and anything
// odd is thrown away for a fresh ticket.
import * as THREE from 'three';
import { canvas, rng, texture } from '../../textures';
import { LANDS, NAMES, type Land } from './journey';

export const SHAPES = ['round', 'star', 'moon', 'diamond', 'heart', 'cross'] as const;
export type Punch = (typeof SHAPES)[number];
export interface Hole {
  x: number;
  y: number;
  shape: Punch;
}
export interface TicketState {
  v: 1;
  holes: Hole[];
  stamps: Land[];
}
/** No more holes than this fit in the punching strip. */
export const MAX_HOLES = 14;
export const KEY = 'ew.train.ticket';

export const fresh = (): TicketState => ({ v: 1, holes: [], stamps: [] });

/** What's stored, if it's a ticket we wrote; otherwise a fresh one. Nothing in it is trusted until it's checked. */
export function parseTicket(raw: unknown): TicketState {
  let data: unknown = raw;
  if (typeof raw === 'string') {
    if (raw.length > 4000) return fresh();
    try {
      data = JSON.parse(raw);
    } catch {
      return fresh();
    }
  }
  if (!data || typeof data !== 'object') return fresh();
  const d = data as Record<string, unknown>;
  if (d.v !== 1 || !Array.isArray(d.holes) || !Array.isArray(d.stamps)) return fresh();
  if (d.holes.length > MAX_HOLES || d.stamps.length > LANDS.length) return fresh();
  const holes: Hole[] = [];
  for (const h of d.holes) {
    if (!h || typeof h !== 'object') return fresh();
    const { x, y, shape } = h as Record<string, unknown>;
    if (typeof x !== 'number' || typeof y !== 'number' || !Number.isFinite(x) || !Number.isFinite(y)) return fresh();
    if (x < 0 || x > 1 || y < 0 || y > 1) return fresh();
    if (typeof shape !== 'string' || !(SHAPES as readonly string[]).includes(shape)) return fresh();
    holes.push({ x, y, shape: shape as Punch });
  }
  const stamps: Land[] = [];
  for (const s of d.stamps) {
    if (typeof s !== 'string' || !(LANDS as string[]).includes(s) || stamps.includes(s as Land)) return fresh();
    stamps.push(s as Land);
  }
  return { v: 1, holes, stamps };
}

/** Somewhere new in the punching strip along the ticket's top edge, clear of the holes already there. */
export function nextHole(state: TicketState, rand: () => number): Hole | null {
  if (state.holes.length >= MAX_HOLES) return null;
  for (let tries = 0; tries < 60; tries++) {
    const x = 0.06 + rand() * 0.88;
    const y = 0.08 + rand() * 0.12;
    if (state.holes.every((h) => Math.hypot((h.x - x) * 2, h.y - y) > 0.11)) return { x, y, shape: SHAPES[Math.floor(rand() * SHAPES.length)] };
  }
  return null;
}

const INK: Record<Land, string> = { fields: '#6a3c8a', gorge: '#8a2a22', pass: '#2a4a8a', city: '#2a2a2a', lake: '#1f6a5a' };

/** A hole's outline, at (cx, cy), about r across. */
function holePath(g: CanvasRenderingContext2D, shape: Punch, cx: number, cy: number, r: number) {
  g.beginPath();
  if (shape === 'round') g.arc(cx, cy, r, 0, Math.PI * 2);
  else if (shape === 'star') {
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
      const rr = i % 2 ? r * 0.45 : r * 1.1;
      g.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
    }
  } else if (shape === 'moon') {
    g.arc(cx, cy, r, 0.5, Math.PI * 2 - 0.5);
    g.arc(cx + r * 0.55, cy, r * 0.75, Math.PI * 2 - 0.9, 0.9, true);
  } else if (shape === 'diamond') {
    g.moveTo(cx, cy - r * 1.1);
    g.lineTo(cx + r * 0.75, cy);
    g.lineTo(cx, cy + r * 1.1);
    g.lineTo(cx - r * 0.75, cy);
  } else if (shape === 'heart') {
    g.moveTo(cx, cy + r);
    g.bezierCurveTo(cx - r * 1.6, cy - r * 0.2, cx - r * 0.6, cy - r * 1.4, cx, cy - r * 0.4);
    g.bezierCurveTo(cx + r * 0.6, cy - r * 1.4, cx + r * 1.6, cy - r * 0.2, cx, cy + r);
  } else {
    const t = r * 0.38;
    g.moveTo(cx - t, cy - r);
    g.lineTo(cx + t, cy - r);
    g.lineTo(cx + t, cy - t);
    g.lineTo(cx + r, cy - t);
    g.lineTo(cx + r, cy + t);
    g.lineTo(cx + t, cy + t);
    g.lineTo(cx + t, cy + r);
    g.lineTo(cx - t, cy + r);
    g.lineTo(cx - t, cy + t);
    g.lineTo(cx - r, cy + t);
    g.lineTo(cx - r, cy - t);
    g.lineTo(cx - t, cy - t);
  }
  g.closePath();
}

/** A little picture for each landscape's stamp. */
function icon(g: CanvasRenderingContext2D, land: Land, cx: number, cy: number, s: number) {
  g.beginPath();
  if (land === 'fields') {
    for (let i = -2; i <= 2; i++) {
      g.moveTo(cx + i * s * 0.25, cy + s * 0.4);
      g.quadraticCurveTo(cx + i * s * 0.25 + s * 0.08, cy, cx + i * s * 0.2, cy - s * 0.35);
    }
  } else if (land === 'gorge') {
    g.moveTo(cx - s * 0.6, cy + s * 0.3);
    g.lineTo(cx + s * 0.6, cy + s * 0.3);
    for (const a of [-0.4, 0, 0.4]) {
      g.moveTo(cx + (a - 0.18) * s, cy + s * 0.3);
      g.arc(cx + a * s, cy + s * 0.3, s * 0.18, Math.PI, 0);
    }
    g.moveTo(cx - s * 0.6, cy - s * 0.05);
    g.lineTo(cx + s * 0.6, cy - s * 0.05);
  } else if (land === 'pass') {
    g.moveTo(cx - s * 0.6, cy + s * 0.35);
    g.lineTo(cx - s * 0.15, cy - s * 0.4);
    g.lineTo(cx + s * 0.1, cy - s * 0.05);
    g.lineTo(cx + s * 0.3, cy - s * 0.25);
    g.lineTo(cx + s * 0.6, cy + s * 0.35);
  } else if (land === 'city') {
    for (const [x, h] of [
      [-0.5, 0.4],
      [-0.25, 0.7],
      [0.02, 0.5],
      [0.28, 0.85],
      [0.5, 0.35],
    ]) g.rect(cx + x * s - s * 0.1, cy + s * 0.4 - h * s, s * 0.2, h * s);
  } else {
    for (let k = 0; k < 3; k++) {
      const yy = cy - s * 0.2 + k * s * 0.22;
      g.moveTo(cx - s * 0.6, yy);
      for (let i = 1; i <= 6; i++) g.quadraticCurveTo(cx - s * 0.6 + (i - 0.5) * s * 0.2, yy + (i % 2 ? -1 : 1) * s * 0.1, cx - s * 0.6 + i * s * 0.2, yy);
    }
  }
  g.stroke();
}

export interface Ticket {
  mesh: THREE.Mesh;
  state(): TicketState;
  /** Punch a new hole; false if there's no room left. */
  punch(): boolean;
  /** Stamp it for a landscape (once each). */
  stamp(land: Land): boolean;
  /** A fresh ticket. */
  renew(): void;
}

export function buildTicket(): Ticket {
  const W = 1024;
  const H = 512;
  const [c, g] = canvas(W, H);
  const [ac, ag] = canvas(W, H);
  const tex = texture(c);
  const alpha = texture(ac, { srgb: false });
  const r = rng(Date.now() & 0xffff);
  let state: TicketState = fresh();
  try {
    state = parseTicket(localStorage.getItem(KEY));
  } catch {
    // No storage: a fresh ticket each visit.
  }
  const save = () => {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      // Fine: it just won't remember.
    }
  };

  const draw = () => {
    // Card stock, a printed border and the words.
    g.fillStyle = '#efe4c8';
    g.fillRect(0, 0, W, H);
    const fib = rng(91);
    for (let i = 0; i < 3000; i++) {
      g.fillStyle = `rgba(120,90,50,${fib() * 0.05})`;
      g.fillRect(fib() * W, fib() * H, 2, 2);
    }
    g.fillStyle = '#c9cfd8';
    g.fillRect(0, 0, W, 130);
    g.strokeStyle = '#2a3a5a';
    g.lineWidth = 6;
    g.strokeRect(14, 14, W - 28, H - 28);
    g.lineWidth = 2;
    g.strokeRect(26, 26, W - 52, H - 52);
    g.fillStyle = '#2a3a5a';
    g.font = '700 30px "Space Mono", monospace';
    g.textAlign = 'center';
    g.fillText('PUNCH HERE', W / 2, 118);
    g.font = '600 66px "EB Garamond", serif';
    g.fillText('The Night Train', W / 2, 205);
    g.font = '400 30px "Space Mono", monospace';
    g.fillText('SLEEPING CAR  ·  CAR 7  ·  BERTH 14', W / 2, 252);
    g.font = 'italic 400 30px "EB Garamond", serif';
    g.fillText('Good for one night, by any line', W / 2, 292);
    // The five stamp boxes.
    LANDS.forEach((land, i) => {
      const bx = 60 + i * 184;
      const by = 318;
      g.strokeStyle = 'rgba(42,58,90,0.5)';
      g.lineWidth = 2;
      g.setLineDash([6, 6]);
      g.strokeRect(bx, by, 168, 160);
      g.setLineDash([]);
      g.fillStyle = 'rgba(42,58,90,0.55)';
      g.font = '400 20px "Space Mono", monospace';
      g.fillText(NAMES[land].replace(/^The /, '').toUpperCase(), bx + 84, by + 150);
      if (state.stamps.includes(land)) {
        // A rubber stamp, a little crooked, the ink uneven.
        const sr = rng(i * 13 + 7);
        g.save();
        g.translate(bx + 84, by + 70);
        g.rotate((sr() - 0.5) * 0.5);
        g.strokeStyle = INK[land];
        g.fillStyle = INK[land];
        g.globalAlpha = 0.78;
        g.lineWidth = 6;
        g.beginPath();
        g.arc(0, 0, 58, 0, Math.PI * 2);
        g.stroke();
        g.lineWidth = 2;
        g.beginPath();
        g.arc(0, 0, 49, 0, Math.PI * 2);
        g.stroke();
        g.lineWidth = 4;
        icon(g, land, 0, -6, 52);
        g.font = '700 15px "Space Mono", monospace';
        g.fillText(NAMES[land].replace(/^The /, '').toUpperCase(), 0, 38);
        // Gaps where the ink didn't take.
        g.globalCompositeOperation = 'destination-out';
        for (let k = 0; k < 40; k++) {
          g.globalAlpha = sr() * 0.5;
          g.fillRect((sr() - 0.5) * 130, (sr() - 0.5) * 130, 2 + sr() * 6, 2 + sr() * 6);
        }
        g.restore();
        g.globalCompositeOperation = 'source-over';
        g.globalAlpha = 1;
      }
    });
    // The holes: a dark rim on the card, and cut clean through in the alpha.
    ag.fillStyle = '#fff';
    ag.fillRect(0, 0, W, H);
    for (const h of state.holes) {
      const cx = h.x * W;
      const cy = h.y * H;
      g.save();
      g.shadowColor = 'rgba(60,40,20,0.6)';
      g.shadowBlur = 6;
      g.fillStyle = '#3a2a18';
      holePath(g, h.shape, cx, cy, 22);
      g.fill();
      g.restore();
      ag.fillStyle = '#000';
      holePath(ag, h.shape, cx, cy, 19);
      ag.fill();
    }
    tex.needsUpdate = true;
    alpha.needsUpdate = true;
  };
  draw();

  // The ticket itself: 15 cm long, lying on the table with a little curl to it.
  const geo = new THREE.PlaneGeometry(0.15, 0.075, 16, 4);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) p.setZ(i, Math.pow(p.getX(i) / 0.075, 2) * 0.004);
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: tex, alphaMap: alpha, alphaTest: 0.5, roughness: 0.85, side: THREE.DoubleSide }));
  mesh.rotation.x = -Math.PI / 2;
  mesh.castShadow = true;
  mesh.receiveShadow = true;

  return {
    mesh,
    state: () => state,
    punch() {
      const h = nextHole(state, r);
      if (!h) return false;
      state = { ...state, holes: [...state.holes, h] };
      save();
      draw();
      return true;
    },
    stamp(land) {
      if (state.stamps.includes(land)) return false;
      state = { ...state, stamps: [...state.stamps, land] };
      save();
      draw();
      return true;
    },
    renew() {
      state = fresh();
      save();
      draw();
    },
  };
}
