// Everything printed or enamelled at the stations, on one sheet: the name
// boards, the travel posters (worn), the departures, the plates over the doors
// and the hatch, the enamel adverts. One sheet so they're all drawn with the
// station itself, in one go, and lit by its lamps like the walls they're on.
import * as THREE from 'three';
import { canvas, rng, texture } from '../../textures';
import { drawName, drawPoster } from './signs';

/** Time on a poster: the paper yellowed and faded at the top, a fold or two, a stain, a corner lifting, a strip of tape. */
function wear(g: CanvasRenderingContext2D, w: number, h: number, r: () => number) {
  g.save();
  g.globalCompositeOperation = 'multiply';
  g.fillStyle = 'rgba(232,206,150,0.55)';
  g.fillRect(0, 0, w, h);
  g.globalCompositeOperation = 'source-over';
  const fade = g.createLinearGradient(0, 0, 0, h);
  fade.addColorStop(0, 'rgba(240,232,210,0.16)');
  fade.addColorStop(0.5, 'rgba(240,232,210,0.04)');
  fade.addColorStop(1, 'rgba(240,232,210,0)');
  g.fillStyle = fade;
  g.fillRect(0, 0, w, h);
  // The folds it was posted in.
  for (const [x0, y0, x1, y1] of [
    [w / 2, 0, w / 2, h],
    [0, h * 0.5, w, h * 0.5],
  ]) {
    g.strokeStyle = 'rgba(255,248,230,0.22)';
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(x0 + 1, y0 + 1);
    g.lineTo(x1 + 1, y1 + 1);
    g.stroke();
    g.strokeStyle = 'rgba(40,28,16,0.18)';
    g.beginPath();
    g.moveTo(x0, y0);
    g.lineTo(x1, y1);
    g.stroke();
  }
  // Stains, and scuffs along the edges.
  for (let i = 0; i < 4; i++) {
    const sx = r() * w;
    const sy = r() * h;
    const sr = 10 + r() * 40;
    const st = g.createRadialGradient(sx, sy, sr * 0.2, sx, sy, sr);
    st.addColorStop(0, 'rgba(110,80,40,0.16)');
    st.addColorStop(0.8, 'rgba(110,80,40,0.1)');
    st.addColorStop(1, 'rgba(110,80,40,0)');
    g.fillStyle = st;
    g.fillRect(sx - sr, sy - sr, sr * 2, sr * 2);
  }
  for (let i = 0; i < 30; i++) {
    g.fillStyle = `rgba(250,244,228,${0.2 + r() * 0.3})`;
    const along = r();
    const e = Math.floor(r() * 4);
    const px = e < 2 ? along * w : e === 2 ? r() * 8 : w - r() * 8;
    const py = e === 0 ? r() * 8 : e === 1 ? h - r() * 8 : along * h;
    g.fillRect(px, py, 2 + r() * 6, 1 + r() * 3);
  }
  // A bottom corner lifting away from the board: the paper's pale back, a shadow under it.
  const k = 26 + r() * 30;
  const cx = r() < 0.5 ? 0 : w;
  const sx = cx === 0 ? 1 : -1;
  g.fillStyle = 'rgba(0,0,0,0.35)';
  g.beginPath();
  g.moveTo(cx, h - k - 6);
  g.lineTo(cx + sx * (k + 6), h);
  g.lineTo(cx, h);
  g.fill();
  g.fillStyle = '#d9cfb6';
  g.beginPath();
  g.moveTo(cx, h - k);
  g.lineTo(cx + sx * k, h);
  g.lineTo(cx + sx * k * 0.86, h - k * 0.86);
  g.fill();
  // Tape across the top corner on the other side.
  g.translate(cx === 0 ? w - 20 : 20, 18);
  g.rotate(cx === 0 ? 0.7 : -0.7);
  g.fillStyle = 'rgba(236,226,190,0.6)';
  g.fillRect(-26, -8, 52, 16);
  g.restore();
}

/** The departures board: what leaves from here tonight, in white on black. Drawn 448 by 448. */
function drawTimetable(g: CanvasRenderingContext2D, r: () => number) {
  g.fillStyle = '#16181b';
  g.fillRect(0, 0, 448, 448);
  g.strokeStyle = '#d9cfb3';
  g.lineWidth = 4;
  g.strokeRect(10, 10, 428, 428);
  g.fillStyle = '#efe6cf';
  g.font = '700 34px "Space Mono", monospace';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('DEPARTURES', 224, 48);
  g.fillRect(28, 76, 392, 3);
  const rows = [
    ['00 40', 'THE FIELDS'],
    ['01 15', 'THE GORGE'],
    ['01 52', 'HIGH PASS'],
    ['02 30', 'CENTRAL'],
    ['03 05', 'LAKESIDE'],
    ['03 48', 'THE FIELDS'],
    ['04 20', 'THE GORGE'],
  ];
  g.font = '400 25px "Space Mono", monospace';
  rows.forEach(([t, place], i) => {
    const y = 108 + i * 40;
    g.textAlign = 'left';
    g.fillStyle = '#f2c46a';
    g.fillText(t, 34, y);
    g.fillStyle = '#efe6cf';
    g.fillText(place, 150, y);
    g.fillStyle = 'rgba(239,230,207,0.18)';
    g.fillRect(28, y + 19, 392, 1);
  });
  // Chalked at the foot, and grime.
  g.textAlign = 'center';
  g.fillStyle = 'rgba(240,236,226,0.8)';
  g.font = 'italic 400 20px "Space Mono", monospace';
  g.fillText('SLEEPING CARS AT THE FRONT', 224, 404);
  for (let i = 0; i < 200; i++) {
    g.fillStyle = `rgba(${r() < 0.5 ? '255,250,240' : '0,0,0'},${r() * 0.06})`;
    g.fillRect(r() * 448, r() * 448, 1 + r() * 4, 1 + r() * 4);
  }
}

/** A small enamel plate: white letters on a color, for over a door or the hatch. Drawn 512 by 80. */
function drawPlate(g: CanvasRenderingContext2D, text: string, ground: string) {
  g.fillStyle = ground;
  g.fillRect(0, 0, 512, 80);
  g.strokeStyle = '#efe9dc';
  g.lineWidth = 4;
  g.strokeRect(8, 8, 496, 64);
  g.fillStyle = '#f2ede2';
  g.font = `700 ${text.length > 10 ? 36 : 42}px "Space Mono", monospace`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  (g as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = '4px';
  g.fillText(text, 256, 43);
  (g as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = '0px';
}

/** An enamel advertisement, the kind screwed to station walls. Drawn 512 by 256. */
function drawAdvert(g: CanvasRenderingContext2D, kind: 'cocoa' | 'sleepers', r: () => number) {
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  if (kind === 'cocoa') {
    g.fillStyle = '#7a2a1c';
    g.fillRect(0, 0, 512, 256);
    g.fillStyle = '#f0d9a8';
    g.fillRect(16, 16, 480, 224);
    g.fillStyle = '#7a2a1c';
    g.fillRect(24, 24, 464, 208);
    g.fillStyle = '#f6e4b8';
    g.font = '700 64px "Space Mono", monospace';
    g.fillText('HOT COCOA', 256, 104);
    g.font = '400 26px "Space Mono", monospace';
    g.fillText('A CUP FOR THE NIGHT', 256, 170);
  } else {
    g.fillStyle = '#123a2c';
    g.fillRect(0, 0, 512, 256);
    g.strokeStyle = '#e8d9a8';
    g.lineWidth = 6;
    g.strokeRect(14, 14, 484, 228);
    g.fillStyle = '#e8d9a8';
    g.font = '700 46px "Space Mono", monospace';
    g.fillText('SLEEPING CARS', 256, 86);
    g.font = '400 30px "Space Mono", monospace';
    g.fillText('EVERY NIGHT', 256, 144);
    // A crescent moon under it.
    g.beginPath();
    g.arc(256, 200, 20, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#123a2c';
    g.beginPath();
    g.arc(266, 193, 18, 0, Math.PI * 2);
    g.fill();
  }
  // Chipped at the edges, the iron showing and rusting in the chips.
  for (let i = 0; i < 40; i++) {
    const edge = Math.floor(r() * 4);
    const along = r();
    const px = edge < 2 ? along * 512 : edge === 2 ? r() * 14 : 512 - r() * 14;
    const py = edge === 0 ? r() * 14 : edge === 1 ? 256 - r() * 14 : along * 256;
    g.fillStyle = r() < 0.5 ? '#141210' : '#5a3418';
    g.beginPath();
    g.ellipse(px, py, 2 + r() * 7, 2 + r() * 4, r() * 3, 0, Math.PI * 2);
    g.fill();
  }
}

/** Where each thing is on the sheet, in pixels: x, y, width, height. */
const SLOTS: Record<string, [number, number, number, number]> = {
  'poster:lake': [0, 0, 320, 448],
  'poster:gorge': [320, 0, 320, 448],
  'poster:city': [640, 0, 320, 448],
  'poster:fields': [960, 0, 320, 448],
  'poster:pass': [1280, 0, 320, 448],
  timetable: [1600, 0, 448, 448],
  'plate:TICKETS': [1024, 608, 512, 80],
  'plate:WAITING ROOM': [1536, 608, 512, 80],
  'plate:WAY OUT': [1024, 688, 512, 80],
  'plate:BOOKING HALL': [1536, 688, 512, 80],
  'advert:cocoa': [0, 768, 512, 256],
  'advert:sleepers': [512, 768, 512, 256],
};
/** The stations' names go here, in this order. */
const NAME_SLOTS: [number, number][] = [
  [0, 448],
  [1024, 448],
  [0, 608],
  [1024, 768],
];
export const POSTERS = ['lake', 'gorge', 'city', 'fields', 'pass'];
const AW = 2048;
const AH = 1024;
let sheet: THREE.Texture | null = null;

/** The sheet, drawn the first time it's asked for, with these stations' names on it. */
export function stationAtlas(names: string[]): THREE.Texture {
  names.forEach((n, i) => (SLOTS[`name:${n}`] ??= [...NAME_SLOTS[Math.min(i, NAME_SLOTS.length - 1)], 1024, 160]));
  if (sheet) return sheet;
  const [c, g] = canvas(AW, AH);
  g.fillStyle = '#2a2622';
  g.fillRect(0, 0, AW, AH);
  const r = rng(4049);
  const at = (key: string, draw: (w: number, h: number) => void) => {
    const [x, y, w, h] = SLOTS[key];
    g.save();
    g.translate(x, y);
    g.beginPath();
    g.rect(0, 0, w, h);
    g.clip();
    draw(w, h);
    g.restore();
  };
  for (const kind of POSTERS)
    at(`poster:${kind}`, (w, h) => {
      g.save();
      g.scale(w / 384, h / 544);
      drawPoster(g, kind);
      g.restore();
      wear(g, w, h, r);
    });
  at('timetable', () => drawTimetable(g, r));
  for (const n of names) at(`name:${n}`, () => drawName(g, n, r));
  at('plate:TICKETS', () => drawPlate(g, 'TICKETS', '#16294f'));
  at('plate:WAITING ROOM', () => drawPlate(g, 'WAITING ROOM', '#16294f'));
  at('plate:WAY OUT', () => drawPlate(g, 'WAY OUT', '#1d4a2e'));
  at('plate:BOOKING HALL', () => drawPlate(g, 'BOOKING HALL', '#16294f'));
  at('advert:cocoa', () => drawAdvert(g, 'cocoa', r));
  at('advert:sleepers', () => drawAdvert(g, 'sleepers', r));
  sheet = texture(c);
  return sheet;
}

/** Where a thing is on the sheet, as uvs (left, bottom, right, top), a few pixels in from its edges. */
export function atlasRect(key: string): [number, number, number, number] {
  const [x, y, w, h] = SLOTS[key] ?? SLOTS['poster:lake'];
  const p = 3;
  return [(x + p) / AW, 1 - (y + h - p) / AH, (x + w - p) / AW, 1 - (y + p) / AH];
}
