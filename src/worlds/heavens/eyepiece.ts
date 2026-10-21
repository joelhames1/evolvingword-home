// The view through the telescope: a bright circle in the dark, the way an
// eyepiece looks when you put your eye to it. Four things to look at, each
// painted once into its own picture: Saturn and its rings, Jupiter with its four
// big moons, the Lagoon Nebula, and the great globular cluster in Hercules.
// The air above the dome never quite holds still, so the picture shimmers a
// little; between targets the field slides away as the telescope swings.
import { rng } from '../../textures';

export interface Target {
  id: string;
  name: string;
  /** Where the telescope points for it: azimuth off the slit's middle, and elevation (degrees). */
  offset: number;
  el: number;
  lines: string[];
  note: string;
}

export const TARGETS: Target[] = [
  {
    id: 'saturn',
    name: 'Saturn',
    offset: -9,
    el: 37,
    lines: [
      'About 1.4 billion kilometers away. The light you are seeing left it a little over an hour ago.',
      'The rings are mostly ice, from grains like snow to lumps the size of a house, and in places they are only about ten meters thick.',
    ],
    note: 'The dot off to one side is Titan, a moon bigger than the planet Mercury.',
  },
  {
    id: 'jupiter',
    name: 'Jupiter',
    offset: 11,
    el: 50,
    lines: [
      'Heavier than all the other planets put together. The stripes are bands of cloud, and the red spot is a storm wider than the Earth that has been going for at least 150 years.',
      'The four dots in a line are the moons Galileo found in 1610: Io, Europa, Ganymede and Callisto. Look again tomorrow and they will have moved.',
    ],
    note: 'Click the view, or Next, for the next one.',
  },
  {
    id: 'lagoon',
    name: 'The Lagoon Nebula',
    offset: -17,
    el: 23,
    lines: [
      'A cloud of glowing gas in Sagittarius, about 4,000 light years away and three times as wide as the full Moon looks. New stars are being born inside it.',
      'The light reaching you tonight set out about when Stonehenge was being built.',
    ],
    note: 'Low in the south, just above the brightest part of the Milky Way.',
  },
  {
    id: 'cluster',
    name: 'The great cluster in Hercules',
    offset: 15,
    el: 61,
    lines: [
      'A ball of a few hundred thousand stars about 22,000 light years away, packed so close that from a planet in the middle the night would never get dark.',
      'Its stars are among the oldest in the galaxy, more than twice the age of the Sun.',
    ],
    note: 'Most of the stars you see here are older than the Earth.',
  },
];

const S = 1024;

const mk = (): [HTMLCanvasElement, CanvasRenderingContext2D] => {
  const c = document.createElement('canvas');
  c.width = S;
  c.height = S;
  return [c, c.getContext('2d')!];
};

/** A sprinkle of faint background stars, the same each time. */
function field(g: CanvasRenderingContext2D, seed: number, n: number, bright = 1) {
  const r = rng(seed);
  for (let i = 0; i < n; i++) {
    const x = r() * S;
    const y = r() * S;
    const m = Math.pow(r(), 3);
    const rad = 0.8 + m * 2.6;
    const a = (0.25 + m * 0.75) * bright;
    const tint = r();
    const col = tint < 0.2 ? '255,214,170' : tint < 0.4 ? '190,210,255' : '245,245,255';
    const grad = g.createRadialGradient(x, y, 0, x, y, rad * 2.4);
    grad.addColorStop(0, `rgba(${col},${a})`);
    grad.addColorStop(0.35, `rgba(${col},${a * 0.5})`);
    grad.addColorStop(1, `rgba(${col},0)`);
    g.fillStyle = grad;
    g.fillRect(x - rad * 3, y - rad * 3, rad * 6, rad * 6);
  }
}

function saturn() {
  const [c, g] = mk();
  g.fillStyle = '#070a12';
  g.fillRect(0, 0, S, S);
  field(g, 11, 40, 0.6);
  const cx = S / 2;
  const cy = S / 2;
  const R = S * 0.15;
  const tilt = 0.4;
  // The rings, as fractions of the planet's radius: C (faint), B (bright), the Cassini gap, A.
  const ring = (inner: number, outer: number, fill: string, half: 'back' | 'front') => {
    g.save();
    g.beginPath();
    if (half === 'back') g.rect(0, 0, S, cy);
    else g.rect(0, cy, S, S - cy);
    g.clip();
    g.beginPath();
    g.ellipse(cx, cy, R * outer, R * outer * tilt, -0.06, 0, Math.PI * 2);
    g.ellipse(cx, cy, R * inner, R * inner * tilt, -0.06, 0, Math.PI * 2);
    g.fillStyle = fill;
    g.fill('evenodd');
    g.restore();
  };
  const rings = (half: 'back' | 'front') => {
    ring(1.24, 1.52, 'rgba(150,135,112,0.35)', half);
    ring(1.52, 1.95, '#e6d6b2', half);
    ring(1.58, 1.7, 'rgba(255,245,220,0.35)', half);
    ring(2.03, 2.27, '#c4b18c', half);
    ring(2.2, 2.22, 'rgba(40,32,22,0.5)', half);
  };
  rings('back');
  // The planet's shadow falling across the rings behind it.
  g.save();
  g.beginPath();
  g.rect(0, 0, S, cy);
  g.clip();
  g.fillStyle = 'rgba(2,2,4,0.85)';
  g.beginPath();
  g.ellipse(cx + R * 0.5, cy - R * 0.25, R * 0.9, R * 0.42, -0.06, 0, Math.PI * 2);
  g.fill();
  g.restore();
  // The globe: butterscotch, banded, darker at the poles and the edge.
  g.save();
  g.translate(cx, cy);
  g.rotate(-0.06);
  g.beginPath();
  g.ellipse(0, 0, R, R * 0.9, 0, 0, Math.PI * 2);
  g.clip();
  g.fillStyle = '#d9bd86';
  g.fillRect(-R, -R, R * 2, R * 2);
  for (const [y, h, col] of [
    [-0.82, 0.3, 'rgba(120,110,95,0.55)'],
    [-0.5, 0.12, 'rgba(160,120,70,0.45)'],
    [-0.28, 0.1, 'rgba(170,125,70,0.5)'],
    [-0.08, 0.16, 'rgba(250,235,200,0.35)'],
    [0.2, 0.09, 'rgba(165,120,70,0.4)'],
    [0.42, 0.14, 'rgba(150,115,75,0.35)'],
    [0.75, 0.35, 'rgba(120,110,95,0.45)'],
  ] as const) {
    g.fillStyle = col;
    g.fillRect(-R, (y - h / 2) * R, R * 2, h * R);
  }
  const limb = g.createRadialGradient(-R * 0.15, -R * 0.1, R * 0.2, 0, 0, R * 1.05);
  limb.addColorStop(0, 'rgba(0,0,0,0)');
  limb.addColorStop(0.7, 'rgba(0,0,0,0.12)');
  limb.addColorStop(1, 'rgba(0,0,0,0.75)');
  g.fillStyle = limb;
  g.fillRect(-R, -R, R * 2, R * 2);
  // The rings' shadow on the globe, just above where they cross it.
  g.fillStyle = 'rgba(20,14,8,0.55)';
  g.beginPath();
  g.ellipse(0, -R * 0.08, R * 1.6, R * 1.6 * tilt, 0, 0.15 * Math.PI, 0.85 * Math.PI);
  g.lineWidth = R * 0.07;
  g.strokeStyle = 'rgba(20,14,8,0.5)';
  g.stroke();
  g.restore();
  rings('front');
  // Titan, and fainter Rhea.
  for (const [x, y, rad, a] of [
    [cx + R * 2.65, cy - R * 0.5, 3.4, 0.9],
    [cx - R * 2.5, cy + R * 0.3, 2.2, 0.55],
  ] as const) {
    const grad = g.createRadialGradient(x, y, 0, x, y, rad * 2.5);
    grad.addColorStop(0, `rgba(255,236,200,${a})`);
    grad.addColorStop(1, 'rgba(255,236,200,0)');
    g.fillStyle = grad;
    g.fillRect(x - 10, y - 10, 20, 20);
  }
  return c;
}

function jupiter() {
  const [c, g] = mk();
  g.fillStyle = '#070a12';
  g.fillRect(0, 0, S, S);
  field(g, 23, 30, 0.5);
  const cx = S / 2;
  const cy = S / 2;
  const R = S * 0.17;
  g.save();
  g.translate(cx, cy);
  g.rotate(0.05);
  g.beginPath();
  g.ellipse(0, 0, R, R * 0.935, 0, 0, Math.PI * 2);
  g.clip();
  g.fillStyle = '#e9dcc0';
  g.fillRect(-R, -R, R * 2, R * 2);
  const r = rng(5);
  // Belts and zones, with wavy edges.
  const band = (y: number, h: number, col: string, wobble: number) => {
    g.fillStyle = col;
    g.beginPath();
    g.moveTo(-R, (y - h / 2) * R);
    for (let x = -R; x <= R; x += R / 30) g.lineTo(x, (y - h / 2) * R + Math.sin(x * 0.09 + y * 20) * wobble);
    for (let x = R; x >= -R; x -= R / 30) g.lineTo(x, (y + h / 2) * R + Math.sin(x * 0.07 + y * 13) * wobble);
    g.closePath();
    g.fill();
  };
  band(-0.86, 0.32, 'rgba(140,125,110,0.6)', 2);
  band(-0.6, 0.1, 'rgba(165,125,90,0.5)', 2);
  band(-0.32, 0.17, 'rgba(160,105,70,0.75)', 3);
  band(-0.04, 0.2, 'rgba(250,240,220,0.4)', 2);
  band(0.24, 0.19, 'rgba(150,98,64,0.75)', 3);
  band(0.48, 0.08, 'rgba(165,125,90,0.45)', 2);
  band(0.84, 0.36, 'rgba(140,125,110,0.6)', 2);
  // Festoons trailing out of the north belt into the bright zone.
  g.strokeStyle = 'rgba(110,80,60,0.5)';
  g.lineWidth = 2;
  for (let i = 0; i < 9; i++) {
    const x = -R * 0.8 + i * R * 0.2 + r() * 10;
    g.beginPath();
    g.moveTo(x, -0.24 * R);
    g.quadraticCurveTo(x + 14, -0.08 * R, x + 30, -0.04 * R + r() * 6);
    g.stroke();
  }
  // The Great Red Spot, in the south belt's edge.
  g.fillStyle = 'rgba(196,108,72,0.95)';
  g.beginPath();
  g.ellipse(R * 0.28, R * 0.36, R * 0.15, R * 0.075, 0, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = 'rgba(245,230,210,0.5)';
  g.lineWidth = 3;
  g.stroke();
  const limb = g.createRadialGradient(-R * 0.1, -R * 0.1, R * 0.3, 0, 0, R * 1.04);
  limb.addColorStop(0, 'rgba(0,0,0,0)');
  limb.addColorStop(0.75, 'rgba(0,0,0,0.12)');
  limb.addColorStop(1, 'rgba(0,0,0,0.7)');
  g.fillStyle = limb;
  g.fillRect(-R, -R, R * 2, R * 2);
  g.restore();
  // The four moons, strung out along the line of the equator.
  for (const [k, rad, col] of [
    [-2.45, 3.4, '255,240,200'],
    [-1.45, 3, '245,240,232'],
    [1.6, 4, '235,228,215'],
    [2.35, 3.6, '210,200,190'],
  ] as const) {
    const x = cx + k * R;
    const y = cy + k * R * 0.05;
    const grad = g.createRadialGradient(x, y, 0, x, y, rad * 2.2);
    grad.addColorStop(0, `rgba(${col},1)`);
    grad.addColorStop(0.45, `rgba(${col},0.7)`);
    grad.addColorStop(1, `rgba(${col},0)`);
    g.fillStyle = grad;
    g.fillRect(x - 12, y - 12, 24, 24);
  }
  return c;
}

/** Smooth value noise for the nebula, worked out on a small grid and drawn up. */
function cloudNoise(seed: number) {
  const r = rng(seed);
  const n = 64;
  const grid = Array.from({ length: n * n }, () => r());
  const at = (x: number, y: number) => grid[(((y % n) + n) % n) * n + (((x % n) + n) % n)];
  const smooth = (x: number, y: number) => {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    const fx = x - ix;
    const fy = y - iy;
    const sx = fx * fx * (3 - 2 * fx);
    const sy = fy * fy * (3 - 2 * fy);
    const a = at(ix, iy);
    const b = at(ix + 1, iy);
    const c = at(ix, iy + 1);
    const d = at(ix + 1, iy + 1);
    return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
  };
  return (x: number, y: number, oct = 5) => {
    let v = 0;
    let a = 0.5;
    for (let i = 0; i < oct; i++) {
      v += a * smooth(x, y);
      x = x * 2.03 + 5.3;
      y = y * 2.03 + 1.7;
      a *= 0.5;
    }
    return v;
  };
}

function lagoon() {
  const [c, g] = mk();
  const small = 256;
  const sc = document.createElement('canvas');
  sc.width = small;
  sc.height = small;
  const sgx = sc.getContext('2d')!;
  const img = sgx.createImageData(small, small);
  const fbm = cloudNoise(31);
  const fbm2 = cloudNoise(77);
  for (let y = 0; y < small; y++)
    for (let x = 0; x < small; x++) {
      const u = (x / small - 0.5) * 2;
      const v = (y / small - 0.5) * 2;
      // A long glow lying across the field, brighter left of middle.
      const shape = Math.exp(-((u + 0.05) ** 2) / 0.17 - ((v - u * 0.15) ** 2) / 0.045);
      const n = fbm(x / 18, y / 18);
      const fine = fbm2(x / 7, y / 7);
      let gas = shape * (0.2 + n * n * 2.0) * (0.45 + fine * 1.1);
      // The lagoon itself: a dark lane curving through it.
      const lane = Math.exp(-((v - 0.05 - 0.25 * Math.sin(u * 2.2 + 0.4) - (fine - 0.5) * 0.08) ** 2) / 0.004);
      gas *= 1 - 0.75 * lane * (u > -0.55 ? 1 : 0.3);
      // The bright knot of the Hourglass, toward the right.
      const knot = Math.exp(-((u - 0.16) ** 2 + (v + 0.02) ** 2) / 0.0012);
      const i = (y * small + x) * 4;
      img.data[i] = Math.min(255, gas * 210 + knot * 230);
      img.data[i + 1] = Math.min(255, gas * 70 + knot * 210 + fine * gas * 30);
      img.data[i + 2] = Math.min(255, gas * 95 + knot * 220);
      img.data[i + 3] = 255;
    }
  sgx.putImageData(img, 0, 0);
  g.fillStyle = '#070a12';
  g.fillRect(0, 0, S, S);
  g.imageSmoothingEnabled = true;
  g.filter = 'blur(1.5px)';
  g.drawImage(sc, 0, 0, S, S);
  g.filter = 'none';
  field(g, 41, 110, 0.8);
  // The young cluster to the left of the lane: a scatter of hot blue-white stars.
  const r = rng(9);
  for (let i = 0; i < 26; i++) {
    const x = S * (0.27 + r() * 0.18);
    const y = S * (0.42 + r() * 0.2);
    const rad = 1.5 + Math.pow(r(), 2) * 4;
    const grad = g.createRadialGradient(x, y, 0, x, y, rad * 2.5);
    grad.addColorStop(0, 'rgba(225,235,255,1)');
    grad.addColorStop(0.4, 'rgba(200,215,255,0.5)');
    grad.addColorStop(1, 'rgba(200,215,255,0)');
    g.fillStyle = grad;
    g.fillRect(x - rad * 3, y - rad * 3, rad * 6, rad * 6);
  }
  return c;
}

function cluster() {
  const [c, g] = mk();
  g.fillStyle = '#070a12';
  g.fillRect(0, 0, S, S);
  field(g, 53, 60, 0.7);
  const cx = S / 2;
  const cy = S / 2;
  // The unresolved glow of the core.
  const glow = g.createRadialGradient(cx, cy, 0, cx, cy, S * 0.2);
  glow.addColorStop(0, 'rgba(255,240,215,0.55)');
  glow.addColorStop(0.3, 'rgba(255,235,210,0.18)');
  glow.addColorStop(1, 'rgba(255,235,210,0)');
  g.fillStyle = glow;
  g.fillRect(0, 0, S, S);
  // Stars thick in the middle, thinning out: a King-ish profile.
  const r = rng(13);
  const core = S * 0.035;
  for (let i = 0; i < 2600; i++) {
    const u = r();
    const rad = core * Math.sqrt(u / (1 - u * 0.985));
    const a = r() * Math.PI * 2;
    const x = cx + Math.cos(a) * rad;
    const y = cy + Math.sin(a) * rad;
    const m = Math.pow(r(), 4);
    const size = 0.7 + m * 3.2;
    const tint = r() < 0.15 ? '255,200,150' : r() < 0.3 ? '210,220,255' : '255,245,230';
    g.fillStyle = `rgba(${tint},${0.35 + m * 0.65})`;
    g.beginPath();
    g.arc(x, y, size, 0, Math.PI * 2);
    g.fill();
  }
  return c;
}

const PAINT: Record<string, () => HTMLCanvasElement> = { saturn, jupiter, lagoon, cluster };

export interface Eyepiece {
  root: HTMLElement;
  open(index: number): void;
  close(): void;
  isOpen(): boolean;
  /** Swings to another target, the field sliding across on the way. */
  show(index: number): void;
  index(): number;
  tick(t: number, dt: number): void;
}

/** The view, a circle of light in a black screen, sitting to the right of the card. */
export function buildEyepiece(onClick: () => void): Eyepiece {
  const root = document.createElement('div');
  root.className = 'eyepiece';
  root.setAttribute('aria-hidden', 'true');
  root.style.cssText = 'position:fixed;inset:0;z-index:8;background:#000;opacity:0;pointer-events:none;transition:opacity 0.9s ease;cursor:pointer';
  const view = document.createElement('canvas');
  view.style.cssText = 'position:absolute;border-radius:50%';
  root.append(view);
  document.body.append(root);
  root.addEventListener('click', () => onClick());
  const g = view.getContext('2d')!;
  const pictures = new Map<string, HTMLCanvasElement>();
  const picture = (i: number) => {
    const id = TARGETS[i].id;
    let p = pictures.get(id);
    if (!p) pictures.set(id, (p = PAINT[id]()));
    return p;
  };

  let open = false;
  let current = 0;
  let previous = -1;
  let slew = 1;
  let size = 0;
  let time = 0;

  const layout = () => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    // Clear of the card on the left (see .card in style.css).
    const card = Math.max(w * 0.04, 72) + Math.min(400, w * 0.36) + 24;
    const room = Math.max(w - card, w * 0.5);
    const d = Math.round(Math.min(h * 0.66, room * 0.82));
    const px = Math.min(2, window.devicePixelRatio || 1);
    if (d !== size) {
      size = d;
      view.width = view.height = Math.round(d * px);
    }
    view.style.width = view.style.height = `${d}px`;
    view.style.left = `${Math.round(w - room / 2 - d / 2)}px`;
    view.style.top = `${Math.round(h / 2 - d / 2)}px`;
  };
  window.addEventListener('resize', () => open && layout());

  const draw = () => {
    const W = view.width;
    g.save();
    g.fillStyle = '#000';
    g.fillRect(0, 0, W, W);
    // The air shimmering: the picture wanders and swims by a hair.
    const sx = Math.sin(time * 7.1) * 0.6 + Math.sin(time * 13.7) * 0.4;
    const sy = Math.cos(time * 6.3) * 0.6 + Math.sin(time * 11.9) * 0.4;
    const swim = (W / 900) * 1.2;
    const k = slew < 1 ? 0.5 - 0.5 * Math.cos(slew * Math.PI) : 1;
    // On a swing, the old field slides off one way while the new one comes in, smeared as it moves.
    const layer = (pic: HTMLCanvasElement, offset: number, alpha: number) => {
      const smear = slew < 1 ? 7 : 1;
      for (let i = 0; i < smear; i++) {
        g.globalAlpha = alpha / smear;
        const o = offset + (slew < 1 ? (i / smear) * 0.06 * W : 0);
        g.drawImage(pic, o + sx * swim, sy * swim, W, W);
      }
    };
    if (slew < 1 && previous >= 0) layer(picture(previous), -k * W * 1.1, 1 - k);
    layer(picture(current), (1 - k) * W * 1.1, slew < 1 ? k : 1);
    g.globalAlpha = 1;
    // The edge of the field: a soft dark ring, and a faint glint on the glass.
    const rim = g.createRadialGradient(W / 2, W / 2, W * 0.36, W / 2, W / 2, W / 2);
    rim.addColorStop(0, 'rgba(0,0,0,0)');
    rim.addColorStop(0.75, 'rgba(0,0,0,0.35)');
    rim.addColorStop(1, 'rgba(0,0,0,1)');
    g.fillStyle = rim;
    g.fillRect(0, 0, W, W);
    g.strokeStyle = 'rgba(140,170,255,0.06)';
    g.lineWidth = W * 0.01;
    g.beginPath();
    g.arc(W / 2, W / 2, W * 0.47, Math.PI * 1.1, Math.PI * 1.45);
    g.stroke();
    g.restore();
  };

  return {
    root,
    open(i) {
      current = i;
      previous = -1;
      slew = 1;
      open = true;
      layout();
      draw();
      root.style.opacity = '1';
      root.style.pointerEvents = 'auto';
    },
    close() {
      open = false;
      root.style.opacity = '0';
      root.style.pointerEvents = 'none';
    },
    isOpen: () => open,
    show(i) {
      if (i === current) return;
      previous = current;
      current = i;
      slew = 0;
    },
    index: () => current,
    tick(t, dt) {
      time = t;
      if (slew < 1) slew = Math.min(1, slew + dt / 1.4);
      if (open || root.style.opacity !== '0') draw();
    },
  };
}
