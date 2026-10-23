// The sleeper car's surfaces, painted in code: mahogany panels with a
// boxwood inlay round each one, a darker dado, the cream ceiling, the blue
// carpet with its little gold diamonds and the red runner in the corridor,
// a plaid blanket, velvet for the curtains, the green lacquer outside with
// its gold line. Each is a tile in meters, set to repeat across the surfaces.
import * as THREE from 'three';
import { canvas, rng, texture } from '../../textures';

/** Mahogany with its grain running up and down. */
function grain(g: CanvasRenderingContext2D, w: number, h: number, seed: number, base: string, dark: string, light: string, across = false) {
  const r = rng(seed);
  g.fillStyle = base;
  g.fillRect(0, 0, w, h);
  const n = across ? h : w;
  for (let i = 0; i < 220; i++) {
    const at = r() * n;
    const amp = 1.5 + r() * 4;
    const f = 0.004 + r() * 0.012;
    const ph = r() * 100;
    g.strokeStyle = r() < 0.6 ? dark : light;
    g.globalAlpha = 0.05 + r() * 0.12;
    g.lineWidth = 0.6 + r() * 2.2;
    g.beginPath();
    const len = across ? w : h;
    for (let t = 0; t <= len; t += 8) {
      const off = at + Math.sin(t * f + ph) * amp + Math.sin(t * f * 3.3) * amp * 0.3;
      if (across) g.lineTo(t, off);
      else g.lineTo(off, t);
    }
    g.stroke();
  }
  g.globalAlpha = 1;
}

/**
 * One wall panel, 0.6 m wide by 0.9 m high: a frame of quartered mahogany, a
 * boxwood line inset round the field, a lighter crotch veneer in the middle and
 * a little inlaid diamond at the center.
 */
export function panel(): THREE.CanvasTexture {
  const W = 512;
  const H = 768;
  const [c, g] = canvas(W, H);
  grain(g, W, H, 31, '#5a2716', '#2a0f06', '#8a4628');
  // The field: a lighter, figured veneer.
  const m = 46;
  g.save();
  g.beginPath();
  g.rect(m, m, W - 2 * m, H - 2 * m);
  g.clip();
  grain(g, W, H, 32, '#74351c', '#3a1608', '#a65c34');
  // A soft flame figure up the middle.
  const flame = g.createRadialGradient(W / 2, H * 0.55, 10, W / 2, H * 0.5, H * 0.45);
  flame.addColorStop(0, 'rgba(190,110,60,0.22)');
  flame.addColorStop(1, 'rgba(40,10,0,0.18)');
  g.fillStyle = flame;
  g.fillRect(0, 0, W, H);
  g.restore();
  // The shadow line where the field meets the frame, and the boxwood inlay inside it.
  g.strokeStyle = 'rgba(20,6,0,0.75)';
  g.lineWidth = 6;
  g.strokeRect(m, m, W - 2 * m, H - 2 * m);
  g.strokeStyle = '#d8b276';
  g.lineWidth = 4;
  g.strokeRect(m + 16, m + 16, W - 2 * m - 32, H - 2 * m - 32);
  g.strokeStyle = 'rgba(30,10,0,0.6)';
  g.lineWidth = 1.5;
  g.strokeRect(m + 22, m + 22, W - 2 * m - 44, H - 2 * m - 44);
  // Corner fans and the diamond.
  g.fillStyle = '#d8b276';
  for (const [cx, cy, sx, sy] of [
    [m + 16, m + 16, 1, 1],
    [W - m - 16, m + 16, -1, 1],
    [m + 16, H - m - 16, 1, -1],
    [W - m - 16, H - m - 16, -1, -1],
  ]) {
    g.save();
    g.translate(cx, cy);
    g.scale(sx, sy);
    for (let k = 0; k < 4; k++) {
      g.beginPath();
      g.moveTo(0, 0);
      g.arc(0, 0, 30, (k / 4) * (Math.PI / 2) + 0.06, ((k + 1) / 4) * (Math.PI / 2) - 0.06);
      g.closePath();
      g.globalAlpha = k % 2 ? 0.85 : 0.55;
      g.fill();
    }
    g.restore();
  }
  g.globalAlpha = 1;
  g.save();
  g.translate(W / 2, H / 2);
  g.rotate(Math.PI / 4);
  g.fillStyle = '#e2c28a';
  g.fillRect(-16, -16, 32, 32);
  g.fillStyle = '#4a1c0c';
  g.fillRect(-8, -8, 16, 16);
  g.restore();
  // The frame's own edges between panels.
  g.fillStyle = 'rgba(15,4,0,0.7)';
  g.fillRect(0, 0, 3, H);
  g.fillRect(0, 0, W, 3);
  const t = texture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(1 / 0.6, 1 / 0.9);
  return t;
}

/** The dado below the window line: plainer, darker wood, its grain across. */
export function dado(): THREE.CanvasTexture {
  const [c, g] = canvas(512, 256);
  grain(g, 512, 256, 41, '#3e1a0d', '#1a0703', '#6a3018', true);
  g.fillStyle = 'rgba(0,0,0,0.5)';
  g.fillRect(0, 0, 512, 4);
  g.fillRect(0, 252, 512, 4);
  g.fillRect(0, 0, 3, 256);
  const t = texture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(1 / 1.2, 1 / 0.6);
  return t;
}

/** The ceiling: cream paint, a faint stencilled border pattern every so often. */
export function ceiling(): THREE.CanvasTexture {
  const [c, g] = canvas(256, 256);
  g.fillStyle = '#e9dcc0';
  g.fillRect(0, 0, 256, 256);
  const r = rng(51);
  for (let i = 0; i < 1600; i++) {
    g.fillStyle = `rgba(${r() < 0.5 ? '255,250,235' : '160,140,110'},${r() * 0.05})`;
    g.fillRect(r() * 256, r() * 256, 3, 3);
  }
  g.strokeStyle = 'rgba(170,135,80,0.08)';
  g.lineWidth = 2;
  g.beginPath();
  g.arc(128, 128, 60, 0, Math.PI * 2);
  g.stroke();
  const t = texture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(1 / 0.9, 1 / 0.9);
  return t;
}

/** The compartment's carpet: deep blue with small gold diamonds; and the corridor's red runner with its gold border. */
export function carpet(kind: 'room' | 'runner'): THREE.CanvasTexture {
  const [c, g] = canvas(256, 256);
  const r = rng(kind === 'room' ? 61 : 62);
  g.fillStyle = kind === 'room' ? '#1b2342' : '#5e1a1c';
  g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 5000; i++) {
    g.fillStyle = `rgba(${r() < 0.5 ? '255,255,255' : '0,0,0'},${r() * 0.07})`;
    g.fillRect(r() * 256, r() * 256, 2, 2);
  }
  if (kind === 'room') {
    g.fillStyle = 'rgba(214,178,104,0.75)';
    for (const [x, y] of [
      [64, 64],
      [192, 192],
      [64, 192],
      [192, 64],
    ]) {
      g.save();
      g.translate(x, y);
      g.rotate(Math.PI / 4);
      g.fillRect(-7, -7, 14, 14);
      g.restore();
    }
    g.strokeStyle = 'rgba(214,178,104,0.25)';
    g.lineWidth = 2;
    g.strokeRect(0, 0, 256, 256);
  } else {
    g.fillStyle = '#c9a050';
    g.fillRect(0, 18, 256, 8);
    g.fillRect(0, 230, 256, 8);
    g.fillStyle = 'rgba(201,160,80,0.4)';
    for (let x = 0; x < 256; x += 32) {
      g.save();
      g.translate(x + 16, 128);
      g.rotate(Math.PI / 4);
      g.fillRect(-8, -8, 16, 16);
      g.restore();
    }
  }
  const t = texture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

/** The blanket: a soft plaid, deep green and navy with a thin red and gold line. */
export function plaid(): THREE.CanvasTexture {
  const [c, g] = canvas(256, 256);
  g.fillStyle = '#1d3326';
  g.fillRect(0, 0, 256, 256);
  const band = (at: number, w: number, color: string, alpha: number) => {
    g.globalAlpha = alpha;
    g.fillStyle = color;
    g.fillRect(at, 0, w, 256);
    g.fillRect(0, at, 256, w);
  };
  band(0, 96, '#18223e', 0.7);
  band(150, 40, '#18223e', 0.6);
  band(120, 6, '#9c2a22', 0.9);
  band(210, 4, '#c9a050', 0.9);
  g.globalAlpha = 1;
  // The weave.
  for (let y = 0; y < 256; y += 2) {
    g.fillStyle = 'rgba(0,0,0,0.08)';
    g.fillRect(0, y, 256, 1);
  }
  const t = texture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(3, 3);
  return t;
}

/** The car's outside: green lacquer, a fine gold line, and the gold letters under the windows. */
export function livery(): THREE.CanvasTexture {
  const [c, g] = canvas(1024, 256);
  g.fillStyle = '#123224';
  g.fillRect(0, 0, 1024, 256);
  const r = rng(71);
  for (let i = 0; i < 1500; i++) {
    g.fillStyle = `rgba(255,255,255,${r() * 0.02})`;
    g.fillRect(r() * 1024, r() * 256, 4, 1);
  }
  const t = texture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

/** A painted name and number for the car's side: SLEEPING CAR in gold. */
export function carName(text: string): THREE.CanvasTexture {
  const [c, g] = canvas(1024, 128);
  g.clearRect(0, 0, 1024, 128);
  g.fillStyle = '#d9b26a';
  g.font = '400 84px "EB Garamond", serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  (g as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = '14px';
  g.fillText(text, 512, 68);
  return texture(c);
}

/** A little poster for the partition: the high pass at night, in flat colors, a line of letters under it. */
export function poster(): THREE.CanvasTexture {
  const [c, g] = canvas(384, 512);
  const sky = g.createLinearGradient(0, 0, 0, 340);
  sky.addColorStop(0, '#0f1a3a');
  sky.addColorStop(1, '#3a4a7a');
  g.fillStyle = sky;
  g.fillRect(0, 0, 384, 512);
  g.fillStyle = '#f3e7c7';
  g.beginPath();
  g.arc(290, 90, 30, 0, Math.PI * 2);
  g.fill();
  const r = rng(81);
  for (let i = 0; i < 60; i++) {
    g.fillStyle = `rgba(255,250,230,${0.4 + r() * 0.5})`;
    g.fillRect(r() * 384, r() * 220, 2, 2);
  }
  g.fillStyle = '#e8ecf4';
  g.beginPath();
  g.moveTo(0, 330);
  g.lineTo(90, 170);
  g.lineTo(150, 250);
  g.lineTo(230, 120);
  g.lineTo(384, 300);
  g.lineTo(384, 512);
  g.lineTo(0, 512);
  g.fill();
  g.fillStyle = '#7a8ab0';
  g.beginPath();
  g.moveTo(90, 170);
  g.lineTo(150, 250);
  g.lineTo(120, 330);
  g.lineTo(60, 230);
  g.fill();
  g.beginPath();
  g.moveTo(230, 120);
  g.lineTo(384, 300);
  g.lineTo(300, 340);
  g.lineTo(250, 220);
  g.fill();
  // The train itself, a string of lit windows across the slope.
  g.fillStyle = '#1a2b20';
  g.fillRect(30, 352, 324, 26);
  g.fillStyle = '#ffcf7a';
  for (let x = 40; x < 340; x += 22) g.fillRect(x, 358, 12, 10);
  g.fillStyle = '#132416';
  g.fillRect(0, 378, 384, 134);
  g.fillStyle = '#f1e2bd';
  g.font = '700 34px "Space Mono", monospace';
  g.textAlign = 'center';
  g.fillText('THE HIGH PASS', 192, 440);
  g.font = '400 20px "Space Mono", monospace';
  g.fillText('BY NIGHT, BY SLEEPER', 192, 476);
  return texture(c);
}
