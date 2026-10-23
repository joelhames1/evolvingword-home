// The greenhouse's surfaces, painted on canvases: old soft red brick in lime
// mortar with a bloom of whitewash and moss, a Victorian tiled aisle, the
// weathered pine of the benches, and terracotta. Each comes with a bump map
// drawn from the same canvas, so the low sun rakes across the mortar joints.
import * as THREE from 'three';
import { canvas, rng, texture } from '../../textures';

/** A color a little lighter or darker, as css. */
const shade = (hex: string, k: number) => `#${new THREE.Color(hex).offsetHSL(0, 0, k).getHexString()}`;

/**
 * Old brick, two meters wide and one tall to a tile: courses of stretchers in
 * soft reds and oranges, the odd dark header, lime mortar, and (if asked) a wash
 * of old whitewash near the top and moss creeping up from the ground.
 */
export function brick(seed: number, opts: { moss?: boolean; wash?: boolean } = {}) {
  const W = 1024;
  const H = 512;
  const [c, g] = canvas(W, H);
  const [bc, bg] = canvas(W, H);
  const r = rng(seed);
  // A brick is 22.5 cm by 7.5 with a 1 cm joint: 2 m is about 8.6 bricks, so 8 across, 12 courses up a meter.
  const cols = 8;
  const rows = 12;
  const bw = W / cols;
  const bh = H / rows;
  g.fillStyle = '#b9ab92';
  g.fillRect(0, 0, W, H);
  bg.fillStyle = '#000';
  bg.fillRect(0, 0, W, H);
  const reds = ['#a04a32', '#b0573a', '#93412c', '#b8643f', '#a6523a', '#8c3f2e', '#c06e48', '#9a4a34'];
  for (let row = 0; row < rows; row++) {
    const off = row % 2 ? bw / 2 : 0;
    for (let col = -1; col <= cols; col++) {
      const x = col * bw + off;
      const y = row * bh;
      const base = r() < 0.06 ? '#5e2c22' : reds[Math.floor(r() * reds.length)];
      const jx = 5;
      const jy = 4;
      g.fillStyle = shade(base, (r() - 0.5) * 0.06);
      g.fillRect(x + jx / 2, y + jy / 2, bw - jx, bh - jy);
      // Each brick a little uneven: a darker fired end, pits, a paler face.
      const grad = g.createLinearGradient(x, y, x + bw, y);
      grad.addColorStop(0, `rgba(40,10,5,${r() * 0.18})`);
      grad.addColorStop(0.5, 'rgba(0,0,0,0)');
      grad.addColorStop(1, `rgba(255,200,160,${r() * 0.1})`);
      g.fillStyle = grad;
      g.fillRect(x + jx / 2, y + jy / 2, bw - jx, bh - jy);
      for (let k = 0; k < 26; k++) {
        g.fillStyle = `rgba(${r() < 0.5 ? '255,220,190' : '50,15,8'},${r() * 0.18})`;
        g.fillRect(x + r() * bw, y + r() * bh, 1 + r() * 3, 1 + r() * 2);
      }
      // The bump: the face raised, a little rounded at the arrises.
      bg.fillStyle = '#d8d8d8';
      bg.fillRect(x + jx / 2 + 1, y + jy / 2 + 1, bw - jx - 2, bh - jy - 2);
      bg.fillStyle = '#ffffff';
      bg.fillRect(x + jx / 2 + 4, y + jy / 2 + 3, bw - jx - 8, bh - jy - 6);
    }
  }
  if (opts.wash) {
    // Whitewash, long ago: patchy, thicker toward the top, gone where the rain ran.
    for (let k = 0; k < 900; k++) {
      const x = r() * W;
      const y = Math.pow(r(), 1.6) * H * 0.7;
      g.fillStyle = `rgba(236,228,210,${0.05 + r() * 0.12})`;
      g.beginPath();
      g.ellipse(x, y, 10 + r() * 50, 6 + r() * 20, 0, 0, Math.PI * 2);
      g.fill();
    }
  }
  if (opts.moss) {
    for (let k = 0; k < 700; k++) {
      const x = r() * W;
      const y = H - Math.pow(r(), 2.4) * H * 0.45;
      g.fillStyle = `rgba(${70 + r() * 30},${90 + r() * 30},${40 + r() * 20},${0.08 + r() * 0.18})`;
      g.beginPath();
      g.ellipse(x, y, 4 + r() * 18, 2 + r() * 8, 0, 0, Math.PI * 2);
      g.fill();
    }
  }
  const map = texture(c);
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  const bump = texture(bc, { srgb: false });
  bump.wrapS = bump.wrapT = THREE.RepeatWrapping;
  return { map, bump };
}

/**
 * The floor, all of it on one canvas (the house is 12 m by 5): a tiled aisle
 * down the middle in red and black quarry tiles set on the diagonal with a buff
 * border, and old brick pavers under the benches, earthy and mossed.
 */
export function floor(size: { w: number; d: number }, aisle: { z0: number; z1: number }, z0: number) {
  const px = 85; // pixels a meter
  const W = Math.round(size.w * px);
  const H = Math.round(size.d * px);
  const [c, g] = canvas(W, H);
  const r = rng(77);
  // Brick pavers in a herringbone, earthy.
  g.fillStyle = '#5a3a2a';
  g.fillRect(0, 0, W, H);
  const pw = 0.21 * px;
  const ph = 0.1 * px;
  for (let y = -ph * 2; y < H + ph * 2; y += ph * 2)
    for (let x = -pw * 2; x < W + pw * 2; x += pw) {
      for (const [dx, dy, w, h] of [
        [0, 0, pw, ph],
        [((y / (ph * 2)) % 2) * (pw / 2), ph, pw, ph],
      ]) {
        g.fillStyle = shade(['#7a4434', '#6c3c2e', '#844c38', '#5e352a'][Math.floor(r() * 4)], (r() - 0.5) * 0.05);
        g.fillRect(x + dx + 1, y + dy + 1, w - 2, h - 2);
      }
    }
  // Earth and moss in the joints and under the staging.
  for (let k = 0; k < 2600; k++) {
    g.fillStyle = r() < 0.4 ? `rgba(70,90,40,${r() * 0.2})` : `rgba(40,25,15,${r() * 0.25})`;
    g.fillRect(r() * W, r() * H, 2 + r() * 8, 2 + r() * 5);
  }
  // The aisle: a buff border, then red and black tiles on the diagonal.
  const a0 = (aisle.z0 - z0) * px;
  const a1 = (aisle.z1 - z0) * px;
  g.fillStyle = '#c9b48c';
  g.fillRect(0, a0, W, a1 - a0);
  const t = 0.15 * px;
  g.save();
  g.beginPath();
  g.rect(0, a0 + 0.08 * px, W, a1 - a0 - 0.16 * px);
  g.clip();
  g.translate(W / 2, (a0 + a1) / 2);
  g.rotate(Math.PI / 4);
  // Enough tiles to cover the aisle once it's turned on the diagonal.
  const span = Math.hypot(W, a1 - a0) / 2 / t + 2;
  for (let i = -span; i < span; i++)
    for (let j = -span; j < span; j++) {
      // Only the ones that land in the aisle's strip (the rest are clipped anyway).
      const cx = (i + 0.5) * t * Math.SQRT1_2 - (j + 0.5) * t * Math.SQRT1_2;
      const cy = (i + 0.5) * t * Math.SQRT1_2 + (j + 0.5) * t * Math.SQRT1_2;
      if (Math.abs(cx) > W / 2 + t || Math.abs(cy) > (a1 - a0) / 2 + t) continue;
      const red = (Math.floor(i) + j) % 2 === 0;
      g.fillStyle = shade(red ? '#9a3a26' : '#1e1a18', (r() - 0.5) * 0.06);
      g.fillRect(i * t + 1, j * t + 1, t - 2, t - 2);
      // Worn: paler in the middle of the walk.
      g.fillStyle = `rgba(255,230,200,${r() * 0.06})`;
      g.fillRect(i * t + 2, j * t + 2, t - 4, t - 4);
    }
  g.restore();
  // A line of buff edging tiles either side.
  for (const y of [a0 + 0.04 * px, a1 - 0.04 * px]) {
    g.fillStyle = '#a8916a';
    g.fillRect(0, y - 2, W, 4);
  }
  return texture(c);
}

/** Weathered pine for the benches and the staging: grey where the sun's been at it, warmer in the grain. */
export function weathered(seed: number, w = 1024, h = 256) {
  const [c, g] = canvas(w, h);
  const r = rng(seed);
  g.fillStyle = '#8a7a64';
  g.fillRect(0, 0, w, h);
  for (let i = 0; i < 300; i++) {
    const y = r() * h;
    const amp = 1 + r() * 4;
    const freq = 0.004 + r() * 0.012;
    const phase = r() * 100;
    g.strokeStyle = `rgba(${r() < 0.55 ? '60,45,30' : '190,175,150'},${0.06 + r() * 0.14})`;
    g.lineWidth = 0.5 + r() * 2;
    g.beginPath();
    for (let x = 0; x <= w; x += 8) g.lineTo(x, y + Math.sin(x * freq + phase) * amp);
    g.stroke();
  }
  // Soil and water stains.
  for (let k = 0; k < 40; k++) {
    g.fillStyle = `rgba(60,40,25,${r() * 0.12})`;
    g.beginPath();
    g.ellipse(r() * w, r() * h, 10 + r() * 50, 6 + r() * 20, 0, 0, Math.PI * 2);
    g.fill();
  }
  return texture(c);
}

/** Terracotta: warm, a little mottled, with the white bloom of lime near the rim. */
export function terracotta(seed: number) {
  const [c, g] = canvas(512, 256);
  const r = rng(seed);
  g.fillStyle = '#b8643f';
  g.fillRect(0, 0, 512, 256);
  for (let k = 0; k < 1400; k++) {
    g.fillStyle = `rgba(${r() < 0.5 ? '230,160,110' : '110,50,30'},${r() * 0.1})`;
    g.fillRect(r() * 512, r() * 256, 2 + r() * 6, 2 + r() * 4);
  }
  // Lime bloom, toward the top (v = 1 is the rim on a lathe).
  for (let k = 0; k < 260; k++) {
    g.fillStyle = `rgba(235,228,210,${r() * 0.18})`;
    g.beginPath();
    g.ellipse(r() * 512, Math.pow(r(), 2) * 90, 6 + r() * 26, 3 + r() * 10, 0, 0, Math.PI * 2);
    g.fill();
  }
  return texture(c);
}

/** Potting soil seen from above: dark, crumbly, a fleck of grit and perlite. */
export function soil(seed: number) {
  const [c, g] = canvas(256, 256);
  const r = rng(seed);
  g.fillStyle = '#2e2018';
  g.fillRect(0, 0, 256, 256);
  for (let k = 0; k < 3000; k++) {
    const pale = r() < 0.04;
    g.fillStyle = pale ? `rgba(230,225,210,${0.4 + r() * 0.4})` : `rgba(${r() < 0.5 ? '80,55,40' : '15,10,8'},${r() * 0.5})`;
    g.fillRect(r() * 256, r() * 256, 1 + r() * 3, 1 + r() * 3);
  }
  return texture(c);
}
