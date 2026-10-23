// A flower painted from its genome, the way an old seed catalog would show it:
// a stem with its leaves, the bloom seen from the front, washes of color from
// heart to tip, the markings laid over, and a fine sepia line round it all. The
// petal and leaf outlines follow the same shapes the plants on the staging grow.
import { rgb, type Genome, type Tint } from './genome';

const css = (t: Tint, a = 1) => {
  const [r, g, b] = rgb(t);
  return `rgba(${Math.round(r * 255)},${Math.round(g * 255)},${Math.round(b * 255)},${a})`;
};
const INK = 'rgba(70,48,30,0.75)';
const LEAF = ['#4a7a34', '#6aa040', '#7aa09a', '#8a6232'];

/** A petal's half-width along its length (t from 0 at the heart to 1 at the tip), by shape: as the shader has it. */
function halfWidth(t: number, shape: number) {
  const s = Math.sin(Math.PI * Math.min(1, Math.max(0, t)));
  const smooth = (a: number, b: number, x: number) => {
    const k = Math.min(1, Math.max(0, (x - a) / (b - a)));
    return k * k * (3 - 2 * k);
  };
  if (shape === 0) return Math.pow(s, 0.5) * (0.4 + 0.6 * smooth(0, 0.4, t));
  if (shape === 1) return Math.pow(Math.sin(Math.PI * Math.pow(t, 0.68)), 0.9);
  if (shape === 2) return Math.pow(s, 0.45) * (1 + 0.1 * Math.sin(t * 30)) * (0.45 + 0.55 * smooth(0, 0.4, t));
  return Math.pow(Math.sin(Math.PI * Math.min(t * 1.04, 1)), 0.42) * (0.4 + 0.6 * smooth(0, 0.4, t));
}

/** The petal's outline, pointing up from (0, 0): length `len`, widest `w`. */
function petalPath(g: CanvasRenderingContext2D, len: number, w: number, shape: number) {
  const N = 28;
  g.beginPath();
  g.moveTo(0, 0);
  for (let i = 1; i <= N; i++) {
    const t = i / N;
    const notch = shape === 3 ? 1 - 0.16 * Math.max(0, (t - 0.55) / 0.45) ** 2 : 1;
    g.lineTo(halfWidth(t, shape) * w * 0.5, -t * len * (shape === 3 ? notch * 0.98 + 0.02 : 1));
  }
  if (shape === 3) g.lineTo(0, -len * 0.86);
  for (let i = N; i >= 1; i--) {
    const t = i / N;
    const notch = shape === 3 ? 1 - 0.16 * Math.max(0, (t - 0.55) / 0.45) ** 2 : 1;
    g.lineTo(-halfWidth(t, shape) * w * 0.5, -t * len * (shape === 3 ? notch * 0.98 + 0.02 : 1));
  }
  g.closePath();
}

/** One petal: the wash, the markings, the line. */
function petal(g: CanvasRenderingContext2D, gen: Genome, len: number, w: number, seed: number) {
  petalPath(g, len, w, gen.shape);
  const grad = g.createLinearGradient(0, 0, 0, -len);
  grad.addColorStop(0, css(gen.base));
  grad.addColorStop(0.15, css(gen.base));
  grad.addColorStop(0.92, css(gen.tip));
  g.fillStyle = grad;
  g.fill();
  g.save();
  petalPath(g, len, w, gen.shape);
  g.clip();
  // Fine veins.
  g.strokeStyle = 'rgba(60,30,20,0.12)';
  g.lineWidth = 0.8;
  for (let k = -3; k <= 3; k++) {
    g.beginPath();
    g.moveTo(0, -len * 0.05);
    g.quadraticCurveTo(k * w * 0.08, -len * 0.5, k * w * 0.11, -len * 0.95);
    g.stroke();
  }
  if (gen.pattern === 1) {
    g.strokeStyle = css(gen.mark, 0.85);
    g.lineWidth = Math.max(1.5, w * 0.07);
    for (const k of [-0.22, 0, 0.22]) {
      g.beginPath();
      g.moveTo(k * w * 0.2, -len * 0.08);
      g.quadraticCurveTo(k * w * 0.6, -len * 0.5, k * w * 0.9, -len * 0.88);
      g.stroke();
    }
  } else if (gen.pattern === 2) {
    g.strokeStyle = css(gen.mark, 0.95);
    g.lineWidth = Math.max(2, w * 0.16);
    petalPath(g, len, w, gen.shape);
    g.stroke();
  } else if (gen.pattern === 3) {
    g.fillStyle = css(gen.mark, 0.85);
    let s = seed;
    for (let k = 0; k < 14; k++) {
      s = (s * 9301 + 49297) % 233280;
      const a = s / 233280;
      s = (s * 9301 + 49297) % 233280;
      const b = s / 233280;
      const t = 0.12 + Math.pow(a, 1.4) * 0.6;
      g.beginPath();
      g.arc((b - 0.5) * w * 0.7 * halfWidth(t, gen.shape), -t * len, Math.max(1, w * 0.035), 0, Math.PI * 2);
      g.fill();
    }
  }
  g.restore();
  petalPath(g, len, w, gen.shape);
  g.strokeStyle = INK;
  g.lineWidth = 1.2;
  g.stroke();
}

/** A leaf, pointing up from (0, 0). */
function leaf(g: CanvasRenderingContext2D, gen: Genome, len: number) {
  const wide = [0.55, 0.26, 0.78, 0.86][gen.leaf] * len;
  const shape = (t: number) => {
    const s = Math.sin(Math.PI * t);
    if (gen.leaf === 1) return Math.pow(Math.sin(Math.PI * Math.pow(t, 0.55)), 1.1);
    if (gen.leaf === 2) return Math.pow(s, 0.7) * (0.72 + 0.28 * Math.abs(Math.sin(t * Math.PI * 3)));
    if (gen.leaf === 3) return Math.pow(Math.sin(Math.PI * (0.2 + 0.8 * t)), 0.6);
    return Math.pow(s, 0.75);
  };
  g.beginPath();
  g.moveTo(0, 0);
  for (let i = 1; i <= 24; i++) g.lineTo(shape(i / 24) * wide * 0.5, -(i / 24) * len);
  for (let i = 24; i >= 0; i--) g.lineTo(-shape(i / 24) * wide * 0.5, -(i / 24) * len);
  g.closePath();
  const grad = g.createLinearGradient(0, 0, 0, -len);
  grad.addColorStop(0, LEAF[gen.foliage]);
  grad.addColorStop(1, `${LEAF[gen.foliage]}cc`);
  g.fillStyle = grad;
  g.fill();
  g.strokeStyle = INK;
  g.lineWidth = 1;
  g.stroke();
  g.beginPath();
  g.moveTo(0, 0);
  g.lineTo(0, -len * 0.92);
  g.strokeStyle = 'rgba(230,240,200,0.5)';
  g.stroke();
}

/** The flower, painted with the bloom's middle at (cx, cy) and its petals `r` long. */
export function paintFlower(g: CanvasRenderingContext2D, gen: Genome, cx: number, cy: number, r: number, seed = 1) {
  g.save();
  g.lineCap = 'round';
  g.lineJoin = 'round';
  // The stem, curving down off the page, with its leaves.
  g.strokeStyle = LEAF[gen.foliage];
  g.lineWidth = Math.max(2, r * 0.07);
  g.beginPath();
  g.moveTo(cx, cy);
  g.bezierCurveTo(cx + r * 0.2, cy + r * 1.2, cx - r * 0.3, cy + r * 2.2, cx + r * 0.1, cy + r * 3.4);
  g.stroke();
  for (const [t, a, s] of [
    [0.45, -0.9, 1],
    [0.7, 0.85, 1.15],
    [0.25, 1.1, 0.75],
  ] as const) {
    g.save();
    g.translate(cx + r * (0.2 * 3 * t * (1 - t) * (1 - t) - 0.3 * 3 * t * t * (1 - t) + 0.1 * t * t * t), cy + r * 3.4 * t);
    g.rotate(a);
    leaf(g, gen, r * 1.1 * s);
    g.restore();
  }
  // The bloom: the outer whorl, then the inner one for a double, then the eye.
  const whorl = (n: number, len: number, offset: number) => {
    const width = Math.min(len * 0.95, ((2 * Math.PI * len * 0.55) / n) * [1.5, 1.0, 1.45, 1.3][gen.shape]);
    for (let k = 0; k < n; k++) {
      g.save();
      g.translate(cx, cy);
      g.rotate(offset + (k / n) * Math.PI * 2);
      // A cupped flower shows its petals a little shortened.
      petal(g, gen, len * (1 - gen.cup * 0.08), width, seed + k * 7);
      g.restore();
    }
  };
  whorl(gen.petals, r, 0.2);
  if (gen.double) whorl(Math.min(14, gen.petals + 2), r * 0.66, 0.2 + Math.PI / gen.petals);
  const goldish = (gen.base.h * 360) / 64 > 30 && (gen.base.h * 360) / 64 < 70 && gen.base.s >= 4;
  g.fillStyle = goldish ? '#3a2410' : gen.pattern === 3 ? '#5a3a18' : '#e0a628';
  g.beginPath();
  g.arc(cx, cy, r * 0.24, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = 'rgba(60,30,10,0.45)';
  for (let k = 0; k < 18; k++) {
    const a = k * 2.39996;
    const d = Math.sqrt(k / 18) * r * 0.2;
    g.beginPath();
    g.arc(cx + Math.cos(a) * d, cy + Math.sin(a) * d, r * 0.025, 0, Math.PI * 2);
    g.fill();
  }
  g.restore();
}
