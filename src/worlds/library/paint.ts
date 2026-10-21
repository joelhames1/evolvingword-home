// The library's surfaces, painted in code: a floor of hexagonal stones, warm
// plaster, the buff stone of the arches, and a frieze of letters round every
// gallery that never spell anything.
import * as THREE from 'three';
import { canvas, rng, texture } from '../../textures';

/** Hexagonal floor stones, one period of the pattern: 3 sides across, √3 sides down. In meters, a side is `side`. */
export function tiles(side: number) {
  const W = 1024;
  const s = W / 3;
  const H = Math.round(Math.sqrt(3) * s);
  const [c, g] = canvas(W, H);
  const r = rng(13);
  g.fillStyle = '#4a3a2c';
  g.fillRect(0, 0, W, H);
  const shades = ['#8a6c4e', '#5c3f2b', '#94785a', '#4c3324', '#7c6044', '#3e2a1d'];
  const hex = (cx: number, cy: number) => {
    const base = new THREE.Color(shades[Math.floor(r() * shades.length)]);
    base.offsetHSL(0, 0, (r() - 0.5) * 0.04);
    g.beginPath();
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2;
      const x = cx + Math.cos(a) * (s - 5);
      const y = cy + Math.sin(a) * (s - 5);
      if (k === 0) g.moveTo(x, y);
      else g.lineTo(x, y);
    }
    g.closePath();
    g.fillStyle = `#${base.getHexString()}`;
    g.fill();
    // Each stone: worn smooth in the middle, a vein or two, darker at its edges.
    g.save();
    g.clip();
    const grad = g.createRadialGradient(cx, cy, s * 0.1, cx, cy, s);
    grad.addColorStop(0, 'rgba(255,245,225,0.1)');
    grad.addColorStop(1, 'rgba(40,25,10,0.22)');
    g.fillStyle = grad;
    g.fillRect(cx - s, cy - s, 2 * s, 2 * s);
    for (let k = 0; k < 400; k++) {
      g.fillStyle = `rgba(${r() < 0.5 ? '255,250,235' : '60,40,20'},${r() * 0.08})`;
      g.fillRect(cx - s + r() * 2 * s, cy - s + r() * 2 * s, 2 + r() * 4, 2 + r() * 4);
    }
    g.strokeStyle = `rgba(90,60,40,${0.08 + r() * 0.12})`;
    g.lineWidth = 1.5;
    for (let v = 0; v < 2; v++) {
      g.beginPath();
      g.moveTo(cx - s + r() * 2 * s, cy - s);
      g.bezierCurveTo(cx - s + r() * 2 * s, cy - s / 2, cx - s + r() * 2 * s, cy + s / 2, cx - s + r() * 2 * s, cy + s);
      g.stroke();
    }
    g.restore();
  };
  // Flat-topped hexagons: columns 1.5 sides apart, every other one half a row down.
  for (let col = -1; col <= 2; col++)
    for (let row = -1; row <= 2; row++) {
      const cx = col * 1.5 * s;
      const cy = row * H + (Math.abs(col) % 2 ? H / 2 : 0);
      hex(cx, cy);
    }
  const tex = texture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1 / (3 * side), 1 / (Math.sqrt(3) * side));
  return tex;
}

/** Warm lime plaster, mottled. */
export function plaster(seed: number, base = '#d9c7a6') {
  const [c, g] = canvas(512, 512);
  const r = rng(seed);
  g.fillStyle = base;
  g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 2600; i++) {
    g.fillStyle = `rgba(${r() < 0.5 ? '255,248,230' : '120,90,60'},${r() * 0.05})`;
    const s = 4 + r() * 30;
    g.beginPath();
    g.arc(r() * 512, r() * 512, s, 0, Math.PI * 2);
    g.fill();
  }
  const tex = texture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

/** Courses of buff stone, for the arches and the passages between galleries. UVs are in meters. */
export function ashlar(seed: number) {
  const [c, g] = canvas(1024, 1024);
  const r = rng(seed);
  g.fillStyle = '#6e5e4a';
  g.fillRect(0, 0, 1024, 1024);
  const palette = ['#b8a688', '#ae9b7c', '#c2b193', '#a99474', '#b4a283', '#a08b6c'];
  let y = 0;
  while (y < 1024) {
    const ch = 128;
    let x = -Math.floor(r() * 200);
    while (x < 1024) {
      const cw = 220 + Math.floor(r() * 160);
      g.fillStyle = palette[Math.floor(r() * palette.length)];
      g.fillRect(x + 3, y + 3, cw - 6, ch - 6);
      const grad = g.createLinearGradient(0, y, 0, y + ch);
      grad.addColorStop(0, 'rgba(255,245,225,0.1)');
      grad.addColorStop(1, 'rgba(50,35,20,0.14)');
      g.fillStyle = grad;
      g.fillRect(x + 3, y + 3, cw - 6, ch - 6);
      for (let k = 0; k < cw * ch * 0.003; k++) {
        g.fillStyle = `rgba(${r() < 0.5 ? '255,245,230' : '70,50,30'},${r() * 0.1})`;
        g.fillRect(x + 3 + r() * (cw - 6), y + 3 + r() * (ch - 6), 2 + r() * 3, 2 + r() * 3);
      }
      if (x + cw > 1024) g.drawImage(c, 1024, y, x + cw - 1024, ch, 0, y, x + cw - 1024, ch);
      x += cw;
    }
    y += ch;
  }
  const tex = texture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1 / 2.6, 1 / 2.6);
  return tex;
}

/**
 * The frieze round the top of every wall: plaster, two ruled lines in red
 * ochre, and between them letters in groups, the way an inscription would run,
 * except that these say nothing.
 */
export function frieze(seed: number) {
  const [c, g] = canvas(2048, 192);
  const r = rng(seed);
  g.drawImage(plaster(seed + 1, '#d6c3a0').image as HTMLCanvasElement, 0, 0, 2048, 192);
  g.fillStyle = 'rgba(120,48,30,0.8)';
  g.fillRect(0, 22, 2048, 4);
  g.fillRect(0, 166, 2048, 4);
  g.fillStyle = 'rgba(120,48,30,0.35)';
  g.fillRect(0, 32, 2048, 2);
  g.fillRect(0, 158, 2048, 2);
  g.font = '500 92px "EB Garamond", serif';
  g.textBaseline = 'middle';
  g.fillStyle = 'rgba(70,40,26,0.78)';
  let x = 40;
  while (x < 2000) {
    const n = 2 + Math.floor(r() * 6);
    let word = '';
    for (let k = 0; k < n; k++) word += 'ABCDEFGHIKLMNOPQRSTVXYZ'[Math.floor(r() * 23)];
    const w = g.measureText(word).width;
    if (x + w > 2010) break;
    g.fillText(word, x, 98);
    x += w + 26;
    g.fillText('·', x - 6, 92);
    x += 22;
  }
  return texture(c);
}
