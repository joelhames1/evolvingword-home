// Every surface is painted in code: canvases turned into textures, so the page
// downloads no images and the whole world is a few hundred kilobytes.
import * as THREE from 'three';

/** A small seeded random, so the room looks the same on every visit. */
export function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return (s >>> 0) / 4294967296;
  };
}

export function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')!];
}

export function texture(c: HTMLCanvasElement, opts: { repeat?: [number, number]; srgb?: boolean; aniso?: number } = {}): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c);
  if (opts.srgb !== false) t.colorSpace = THREE.SRGBColorSpace;
  if (opts.repeat) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(...opts.repeat);
  }
  t.anisotropy = opts.aniso ?? 8;
  return t;
}

/** Warm wood with long grain and the odd knot. */
export function wood(seed: number, base = '#6b4429', dark = '#3d2414', w = 1024, h = 256): THREE.CanvasTexture {
  const [c, g] = canvas(w, h);
  const r = rng(seed);
  g.fillStyle = base;
  g.fillRect(0, 0, w, h);
  for (let i = 0; i < 260; i++) {
    const y = r() * h;
    const amp = 2 + r() * 6;
    const freq = 0.004 + r() * 0.01;
    const phase = r() * 100;
    g.strokeStyle = `rgba(${r() < 0.5 ? '40,20,8' : '150,95,55'},${0.05 + r() * 0.12})`;
    g.lineWidth = 0.6 + r() * 2.2;
    g.beginPath();
    for (let x = 0; x <= w; x += 8) g.lineTo(x, y + Math.sin(x * freq + phase) * amp + Math.sin(x * freq * 3.1) * amp * 0.3);
    g.stroke();
  }
  for (let k = 0; k < 3; k++) {
    const x = r() * w;
    const y = r() * h;
    const grad = g.createRadialGradient(x, y, 1, x, y, 14 + r() * 10);
    grad.addColorStop(0, dark);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grad;
    g.beginPath();
    g.ellipse(x, y, 30, 9, 0, 0, Math.PI * 2);
    g.fill();
  }
  return texture(c, { repeat: [1, 1] });
}

/** Plaster with a faint mottle; tinted by the lights, not the paint. */
export function plaster(seed: number, base = '#8a7a68', w = 512, h = 512): THREE.CanvasTexture {
  const [c, g] = canvas(w, h);
  const r = rng(seed);
  g.fillStyle = base;
  g.fillRect(0, 0, w, h);
  for (let i = 0; i < 2600; i++) {
    const v = r() < 0.5 ? 255 : 0;
    g.fillStyle = `rgba(${v},${v},${v},${r() * 0.035})`;
    const s = 2 + r() * 18;
    g.fillRect(r() * w, r() * h, s, s);
  }
  return texture(c, { repeat: [3, 2] });
}

/** Dark floorboards, slightly uneven. */
export function boards(seed: number): THREE.CanvasTexture {
  const [c, g] = canvas(1024, 1024);
  const r = rng(seed);
  const rows = 8;
  for (let i = 0; i < rows; i++) {
    const shade = 34 + r() * 18;
    g.fillStyle = `rgb(${shade + 18},${shade + 6},${shade - 6})`;
    g.fillRect(0, (i * 1024) / rows, 1024, 1024 / rows);
    for (let k = 0; k < 40; k++) {
      g.strokeStyle = `rgba(0,0,0,${0.05 + r() * 0.1})`;
      g.lineWidth = 1 + r() * 2;
      const y = (i + r()) * (1024 / rows);
      g.beginPath();
      g.moveTo(0, y);
      for (let x = 0; x <= 1024; x += 32) g.lineTo(x, y + Math.sin(x * 0.01 + k) * 2);
      g.stroke();
    }
    g.fillStyle = 'rgba(0,0,0,0.55)';
    g.fillRect(0, (i * 1024) / rows, 1024, 3);
    const seam = r() * 1024;
    g.fillRect(seam, (i * 1024) / rows, 3, 1024 / rows);
  }
  return texture(c, { repeat: [2, 2] });
}

/** Lines of text drawn with a font that's already loaded. */
export function label(
  lines: { text: string; font: string; color: string; x?: number; y: number; align?: CanvasTextAlign; spacing?: number }[],
  w: number,
  h: number,
  bg?: string,
): THREE.CanvasTexture {
  const [c, g] = canvas(w, h);
  if (bg) {
    g.fillStyle = bg;
    g.fillRect(0, 0, w, h);
  }
  for (const l of lines) {
    g.font = l.font;
    g.fillStyle = l.color;
    g.textAlign = l.align ?? 'left';
    g.textBaseline = 'middle';
    if (l.spacing) (g as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = `${l.spacing}px`;
    g.fillText(l.text, l.x ?? (l.align === 'center' ? w / 2 : 0), l.y);
    if (l.spacing) (g as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = '0px';
  }
  return texture(c);
}

/** A soft round glow, for sprites: lamp halos, distant lights, steam. */
export function glow(inner = 'rgba(255,255,255,1)', size = 128): THREE.CanvasTexture {
  const [c, g] = canvas(size, size);
  const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, inner);
  grad.addColorStop(0.25, inner.replace(/[\d.]+\)$/, '0.45)'));
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  return texture(c);
}
