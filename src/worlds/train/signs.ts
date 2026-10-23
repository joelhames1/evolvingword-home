// The painted and lit things at the stations and the crossing: enamel name
// boards, the platform clock (keeping your real time, like the watch), the
// red-and-white barrier arms, and the textures for stone, brick and the
// tunnel's rock. Each is made once and shared by every stretch that needs it.
import * as THREE from 'three';
import { canvas, rng, texture } from '../../textures';

const cache = new Map<string, THREE.Texture>();

/** An enamel station sign: white letters on deep blue, a white rule round the edge. */
export function nameBoard(name: string): THREE.Texture {
  const hit = cache.get(`name:${name}`);
  if (hit) return hit;
  const [c, g] = canvas(1024, 160);
  g.fillStyle = '#16294f';
  g.fillRect(0, 0, 1024, 160);
  g.strokeStyle = '#f2efe6';
  g.lineWidth = 8;
  g.strokeRect(14, 14, 996, 132);
  g.fillStyle = '#f2efe6';
  g.font = '700 92px "Space Mono", monospace';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  (g as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = '10px';
  g.fillText(name, 512, 84);
  const t = texture(c);
  cache.set(`name:${name}`, t);
  return t;
}

/** The station clock's face: drawn again each minute, with your local time. */
export function buildClock() {
  const [c, g] = canvas(256, 256);
  const tex = texture(c);
  let last = -1;
  const draw = () => {
    const now = new Date();
    const m = now.getHours() * 60 + now.getMinutes();
    if (m === last) return;
    last = m;
    g.clearRect(0, 0, 256, 256);
    g.fillStyle = '#f6f3ea';
    g.beginPath();
    g.arc(128, 128, 120, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = '#111';
    g.lineWidth = 8;
    g.stroke();
    for (let i = 0; i < 60; i++) {
      const a = (i / 60) * Math.PI * 2;
      const r0 = i % 5 === 0 ? 92 : 104;
      g.lineWidth = i % 5 === 0 ? 9 : 3;
      g.beginPath();
      g.moveTo(128 + Math.sin(a) * r0, 128 - Math.cos(a) * r0);
      g.lineTo(128 + Math.sin(a) * 112, 128 - Math.cos(a) * 112);
      g.stroke();
    }
    const hand = (a: number, len: number, w: number) => {
      g.lineWidth = w;
      g.lineCap = 'butt';
      g.beginPath();
      g.moveTo(128 - Math.sin(a) * 18, 128 + Math.cos(a) * 18);
      g.lineTo(128 + Math.sin(a) * len, 128 - Math.cos(a) * len);
      g.stroke();
    };
    hand(((now.getHours() % 12) + now.getMinutes() / 60) * (Math.PI / 6), 62, 12);
    hand(now.getMinutes() * (Math.PI / 30), 96, 8);
    g.fillStyle = '#111';
    g.beginPath();
    g.arc(128, 128, 7, 0, Math.PI * 2);
    g.fill();
    tex.needsUpdate = true;
  };
  draw();
  return { texture: tex, tick: draw };
}

/** Red and white stripes, for the barrier arms. */
export function stripes(): THREE.Texture {
  const hit = cache.get('stripes');
  if (hit) return hit;
  const [c, g] = canvas(256, 16);
  for (let i = 0; i < 8; i++) {
    g.fillStyle = i % 2 ? '#f3efe6' : '#b3201c';
    g.fillRect(i * 32, 0, 32, 16);
  }
  const t = texture(c);
  cache.set('stripes', t);
  return t;
}

/**
 * Dressed stone in courses, as a tiling texture a meter of wall wide to every
 * 1/2 of its width (so its uvs are in meters at a repeat of 0.5).
 */
export function stone(kind: 'ashlar' | 'brick' | 'rock' | 'concrete'): THREE.Texture {
  const hit = cache.get(kind);
  if (hit) return hit;
  const [c, g] = canvas(512, 512);
  const r = rng(kind.length * 977);
  if (kind === 'brick') {
    g.fillStyle = '#3a241c';
    g.fillRect(0, 0, 512, 512);
    const bh = 512 / 26;
    for (let row = 0; row < 26; row++) {
      const off = row % 2 ? 0 : 24;
      for (let x = -48; x < 512; x += 48) {
        const shade = 0.75 + r() * 0.4;
        g.fillStyle = `rgb(${Math.round(150 * shade)},${Math.round(78 * shade)},${Math.round(56 * shade)})`;
        g.fillRect(x + off + 2, row * bh + 2, 44, bh - 3);
      }
    }
  } else if (kind === 'ashlar') {
    g.fillStyle = '#5b5650';
    g.fillRect(0, 0, 512, 512);
    const rows = 8;
    for (let row = 0; row < rows; row++) {
      let x = row % 2 ? -40 : 0;
      while (x < 512) {
        const w = 70 + r() * 70;
        const shade = 0.82 + r() * 0.3;
        g.fillStyle = `rgb(${Math.round(150 * shade)},${Math.round(144 * shade)},${Math.round(132 * shade)})`;
        g.fillRect(x + 3, row * 64 + 3, w - 6, 58);
        x += w;
      }
    }
  } else {
    g.fillStyle = kind === 'rock' ? '#4a4844' : '#6c6a66';
    g.fillRect(0, 0, 512, 512);
  }
  // Weathering over it all: blotches and grit.
  for (let i = 0; i < 2600; i++) {
    const v = r() < 0.5 ? 255 : 0;
    g.fillStyle = `rgba(${v},${v},${v},${r() * (kind === 'rock' ? 0.09 : 0.05)})`;
    const s = 2 + r() * (kind === 'rock' ? 26 : 10);
    g.fillRect(r() * 512, r() * 512, s, s);
  }
  const t = texture(c, { repeat: [1, 1] });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  cache.set(kind, t);
  return t;
}
