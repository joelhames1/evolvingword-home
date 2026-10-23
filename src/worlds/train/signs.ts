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
    // Courses of dressed blocks, each its own shade, with thin joints; drawn so it tiles both ways.
    g.fillStyle = '#6a645c';
    g.fillRect(0, 0, 512, 512);
    const rows = 6;
    const rh = 512 / rows;
    for (let row = 0; row < rows; row++) {
      // Block lengths that add up to the width exactly, so the joints carry on round the wrap.
      const lens: number[] = [];
      let left = 512;
      while (left > 0) {
        const w = left < 200 ? left : 110 + r() * 90;
        lens.push(Math.min(w, left));
        left -= w;
      }
      let x = row % 2 ? -rh * 0.9 : 0;
      for (const w of lens) {
        const shade = 0.86 + r() * 0.22;
        const warm = r() * 0.05;
        g.fillStyle = `rgb(${Math.round(150 * shade * (1 + warm))},${Math.round(144 * shade)},${Math.round(132 * shade * (1 - warm))})`;
        for (const dx of [0, 512, -512]) g.fillRect(x + dx + 2, row * rh + 2, w - 3, rh - 3);
        // A darker lower edge where the weather runs off it.
        g.fillStyle = 'rgba(0,0,0,0.08)';
        for (const dx of [0, 512, -512]) g.fillRect(x + dx + 2, row * rh + rh * 0.72, w - 3, rh * 0.28 - 1);
        x += w;
      }
    }
  } else {
    // (A light ground, so it shades what it's laid on rather than darkening it to black.)
    g.fillStyle = kind === 'rock' ? '#a8a49c' : '#b4b1aa';
    g.fillRect(0, 0, 512, 512);
  }
  // Weathering over it all: blotches and grit.
  for (let i = 0; i < 2600; i++) {
    const v = r() < 0.5 ? 255 : 0;
    g.fillStyle = `rgba(${v},${v},${v},${r() * (kind === 'rock' ? 0.16 : 0.07)})`;
    const s = 2 + r() * (kind === 'rock' ? 26 : 10);
    g.fillRect(r() * 512, r() * 512, s, s);
  }
  const t = texture(c, { repeat: [1, 1] });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  cache.set(kind, t);
  return t;
}

/** A travel poster for the stations' walls, in flat colors: one of the landscapes by night, its name under it. */
export function posterArt(kind: string): THREE.Texture {
  const hit = cache.get(`poster:${kind}`);
  if (hit) return hit;
  const W = 384;
  const H = 544;
  const [c, g] = canvas(W, H);
  const r = rng(kind.length * 131 + kind.charCodeAt(0));
  const look: Record<string, { sky: [string, string]; title: string; line: string; ink: string }> = {
    lake: { sky: ['#0e1838', '#3c5a8a'], title: 'THE LAKE', line: 'MOONRISE BY SLEEPER', ink: '#f3e7c7' },
    gorge: { sky: ['#1a1030', '#5a4a7a'], title: 'THE GORGE', line: 'OVER THE VIADUCT', ink: '#f6dfb0' },
    city: { sky: ['#140c18', '#6a3a2a'], title: 'THE CITY', line: 'ALL NIGHT LONG', ink: '#ffd9a0' },
    fields: { sky: ['#0f1a30', '#4a6070'], title: 'THE FIELDS', line: 'SLEEP ALL THE WAY', ink: '#f1e6c4' },
    pass: { sky: ['#0f1a3a', '#3a4a7a'], title: 'THE HIGH PASS', line: 'BY NIGHT, BY SLEEPER', ink: '#f1e2bd' },
  };
  const L = look[kind] ?? look.lake;
  const sky = g.createLinearGradient(0, 0, 0, 360);
  sky.addColorStop(0, L.sky[0]);
  sky.addColorStop(1, L.sky[1]);
  g.fillStyle = sky;
  g.fillRect(0, 0, W, H);
  for (let i = 0; i < 50; i++) {
    g.fillStyle = `rgba(255,250,230,${0.3 + r() * 0.5})`;
    g.fillRect(r() * W, r() * 200, 2, 2);
  }
  g.fillStyle = '#f6ecd0';
  g.beginPath();
  g.arc(kind === 'gorge' ? 192 : 280, kind === 'gorge' ? 250 : 92, 28, 0, Math.PI * 2);
  g.fill();
  const poly = (color: string, pts: number[]) => {
    g.fillStyle = color;
    g.beginPath();
    g.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]);
    g.closePath();
    g.fill();
  };
  if (kind === 'lake') {
    poly('#1c2a48', [0, 250, 80, 210, 170, 240, 260, 200, 384, 235, 384, 280, 0, 280]);
    g.fillStyle = '#16264a';
    g.fillRect(0, 280, W, 120);
    // The moon's path on the water.
    for (let y = 290; y < 400; y += 9) {
      g.fillStyle = `rgba(246,236,208,${0.75 - (y - 290) / 180})`;
      g.fillRect(280 - (y - 280) * 0.25, y, 16 + (y - 280) * 0.5, 3);
    }
    poly('#0c1426', [40, 360, 120, 360, 110, 372, 52, 372]);
  } else if (kind === 'gorge') {
    poly('#2a2440', [0, 200, 90, 230, 130, 400, 0, 400]);
    poly('#2a2440', [384, 190, 290, 230, 250, 400, 384, 400]);
    // The viaduct: a deck and its arches, the train's windows lit along it.
    g.fillStyle = '#c9b89a';
    g.fillRect(0, 290, W, 26);
    for (let x = 0; x < W; x += 64) {
      g.fillRect(x, 316, 14, 84);
    }
    g.fillStyle = L.sky[1];
    for (let x = 14; x < W; x += 64) {
      g.beginPath();
      g.arc(x + 25, 340, 25, Math.PI, 0);
      g.fill();
    }
    g.fillStyle = '#1a2b20';
    g.fillRect(20, 270, 344, 20);
    g.fillStyle = '#ffcf7a';
    for (let x = 28; x < 356; x += 18) g.fillRect(x, 275, 10, 8);
  } else if (kind === 'city') {
    g.fillStyle = '#1a1018';
    for (let x = 0; x < W; x += 34) {
      const h = 120 + ((x * 37) % 140);
      g.fillRect(x, 400 - h, 30, h);
      for (let y = 410 - h; y < 390; y += 16)
        for (let wx = x + 4; wx < x + 26; wx += 9) {
          if (r() < 0.35) {
            g.fillStyle = r() < 0.15 ? '#9fc0ff' : '#ffc27a';
            g.fillRect(wx, y, 5, 7);
            g.fillStyle = '#1a1018';
          }
        }
    }
  } else if (kind === 'fields') {
    poly('#2a3a30', [0, 260, 120, 230, 260, 250, 384, 225, 384, 400, 0, 400]);
    poly('#3a4a32', [0, 320, 384, 290, 384, 400, 0, 400]);
    poly('#1a2418', [250, 250, 300, 250, 300, 230, 275, 212, 250, 230]);
    g.fillStyle = '#ffcf7a';
    g.fillRect(262, 236, 8, 8);
    g.fillRect(280, 236, 8, 8);
  } else {
    poly('#e8ecf4', [0, 330, 90, 170, 150, 250, 230, 120, 384, 300, 384, 400, 0, 400]);
    poly('#7a8ab0', [90, 170, 150, 250, 120, 330, 60, 230]);
    poly('#7a8ab0', [230, 120, 384, 300, 300, 340, 250, 220]);
  }
  // The train along the bottom of the picture, then the lettering.
  g.fillStyle = '#132416';
  g.fillRect(0, 400, W, H - 400);
  g.fillStyle = L.ink;
  g.font = `700 ${L.title.length > 10 ? 34 : 40}px "Space Mono", monospace`;
  g.textAlign = 'center';
  g.fillText(L.title, W / 2, 458);
  g.font = '400 20px "Space Mono", monospace';
  g.fillText(L.line, W / 2, 496);
  g.strokeStyle = L.ink;
  g.lineWidth = 3;
  g.strokeRect(10, 10, W - 20, H - 20);
  const t = texture(c);
  cache.set(`poster:${kind}`, t);
  return t;
}
