// The seed catalog, lying open on its stand on top of the seed drawers: an old
// nurseryman's book of the varieties everyone wants and nobody has. Each spread
// is one of them, a painted plate on the left and its description on the right,
// with how hard it is to come by. Breed one and its page gets a prize rosette,
// stamped in red.
import * as THREE from 'three';
import { canvas, rng, texture } from '../../textures';
import { WANTED } from './genome';
import { paintFlower } from './paint';

const W = 1600;
const H = 1100;

export interface Catalog {
  group: THREE.Group;
  /** What to click. */
  book: THREE.Object3D;
  page(): number;
  show(i: number, stamped: (id: string) => boolean): void;
  /** Lays a rosette on a page, with a little flourish if it's showing. */
  stamp(id: string): void;
  tick(t: number, dt: number): void;
}

/** The difficulty, as the catalog grades it. */
const GRADE = ['', 'Easily raised', 'Wants patience', 'A rare prize'];

function drawSpread(g: CanvasRenderingContext2D, i: number, stamped: boolean) {
  const w = WANTED[i];
  const r = rng(91 + i * 13);
  // Old paper, a little foxed, darker into the gutter.
  g.fillStyle = '#efe4c8';
  g.fillRect(0, 0, W, H);
  for (let k = 0; k < 2200; k++) {
    g.fillStyle = `rgba(150,110,60,${r() * 0.05})`;
    g.fillRect(r() * W, r() * H, 2 + r() * 3, 2 + r() * 3);
  }
  for (let k = 0; k < 18; k++) {
    g.fillStyle = `rgba(160,110,60,${0.03 + r() * 0.05})`;
    g.beginPath();
    g.arc(r() * W, r() * H, 4 + r() * 14, 0, Math.PI * 2);
    g.fill();
  }
  const gutter = g.createLinearGradient(W / 2 - 90, 0, W / 2 + 90, 0);
  gutter.addColorStop(0, 'rgba(90,60,30,0)');
  gutter.addColorStop(0.5, 'rgba(90,60,30,0.32)');
  gutter.addColorStop(1, 'rgba(90,60,30,0)');
  g.fillStyle = gutter;
  g.fillRect(W / 2 - 90, 0, 180, H);
  // The plate, on the left page, in a ruled frame.
  g.strokeStyle = '#6a5034';
  g.lineWidth = 3;
  g.strokeRect(70, 70, W / 2 - 150, H - 140);
  g.lineWidth = 1;
  g.strokeRect(82, 82, W / 2 - 174, H - 164);
  g.save();
  g.beginPath();
  g.rect(84, 84, W / 2 - 178, H - 168);
  g.clip();
  paintFlower(g, w.example, W / 4 - 4, H * 0.4, 150, i + 3);
  g.restore();
  g.fillStyle = '#4a3a24';
  g.textAlign = 'center';
  g.font = 'italic 400 34px "EB Garamond", serif';
  g.fillText(`Plate ${i + 1}`, W / 4 - 4, H - 104);
  // The description, on the right.
  const x = W / 2 + 90;
  const right = W - 90;
  g.textAlign = 'left';
  g.fillStyle = '#6a2a20';
  g.font = '600 26px "EB Garamond", serif';
  g.fillText(`No. ${String(i + 1).padStart(2, '0')}  ·  WANTED`, x, 150);
  g.fillStyle = '#2a2018';
  g.font = '600 64px "EB Garamond", serif';
  wrap(g, w.name, x, 240, right - x, 70);
  g.font = 'italic 400 40px "EB Garamond", serif';
  g.fillStyle = '#3a3024';
  const below = wrap(g, w.line, x, 400, right - x, 50);
  g.font = '400 30px "EB Garamond", serif';
  g.fillStyle = '#5a4a34';
  g.fillText(`${GRADE[w.difficulty]}  ${'✦'.repeat(w.difficulty)}${'·'.repeat(3 - w.difficulty)}`, x, below + 40);
  g.font = 'italic 400 30px "EB Garamond", serif';
  wrap(g, `“${w.hint}”`, x, below + 110, right - x, 40);
  // A rule, and the catalog's promise at the foot of the page.
  g.strokeStyle = '#8a7050';
  g.lineWidth = 1.5;
  g.beginPath();
  g.moveTo(x, H - 170);
  g.lineTo(right, H - 170);
  g.stroke();
  g.font = '400 24px "EB Garamond", serif';
  g.fillStyle = '#6a5a44';
  g.fillText('Raise it under glass and the house will award its rosette.', x, H - 130);
  if (stamped) stampOn(g, x + (right - x) * 0.62, H - 330);
}

/** Wraps text into lines; returns the y below the last. */
function wrap(g: CanvasRenderingContext2D, text: string, x: number, y: number, width: number, lh: number) {
  let line = '';
  for (const word of text.split(' ')) {
    const next = line ? `${line} ${word}` : word;
    if (g.measureText(next).width > width && line) {
      g.fillText(line, x, y);
      y += lh;
      line = word;
    } else line = next;
  }
  if (line) g.fillText(line, x, y);
  return y;
}

/** A prize rosette in red ink, stamped a little crooked. */
function stampOn(g: CanvasRenderingContext2D, x: number, y: number) {
  g.save();
  g.translate(x, y);
  g.rotate(-0.18);
  g.globalAlpha = 0.85;
  g.strokeStyle = '#b02a22';
  g.fillStyle = '#b02a22';
  g.lineWidth = 6;
  g.beginPath();
  for (let i = 0; i <= 48; i++) {
    const a = (i / 48) * Math.PI * 2;
    const rr = i % 2 ? 108 : 120;
    g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  g.stroke();
  g.lineWidth = 3;
  g.beginPath();
  g.arc(0, 0, 88, 0, Math.PI * 2);
  g.stroke();
  // Ribbon tails below.
  for (const s of [-1, 1]) {
    g.beginPath();
    g.moveTo(s * 30, 100);
    g.lineTo(s * 50, 190);
    g.lineTo(s * 30, 172);
    g.lineTo(s * 14, 196);
    g.lineTo(s * 4, 106);
    g.fill();
  }
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = '600 30px "EB Garamond", serif';
  g.fillText('BRED', 0, -26);
  g.fillText('HERE', 0, 8);
  g.font = 'italic 400 24px "EB Garamond", serif';
  g.fillText('first prize', 0, 44);
  g.restore();
}

export function buildCatalog(): Catalog {
  const group = new THREE.Group();
  const [c, g] = canvas(W, H);
  const tex = texture(c);
  // The stand: a slope of oak on two legs.
  const oak = new THREE.MeshStandardMaterial({ color: '#7a5434', roughness: 0.55 });
  const slope = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.025, 0.42), oak);
  slope.castShadow = true;
  slope.receiveShadow = true;
  group.add(slope);
  const ledge = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.035, 0.02), oak);
  ledge.position.set(0, 0.02, 0.21);
  group.add(ledge);
  // The book: green cloth boards, a block of pages either side of the spine, the spread on top.
  const cloth = new THREE.MeshStandardMaterial({ color: '#2e4a32', roughness: 0.7 });
  const boards = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.012, 0.4), cloth);
  boards.position.y = 0.019;
  group.add(boards);
  const pagesGeo = new THREE.PlaneGeometry(0.6, 0.39, 24, 2);
  // The pages rise from the gutter and fall away to the fore-edges, like a book lying open.
  const pp = pagesGeo.attributes.position;
  for (let i = 0; i < pp.count; i++) {
    const x = pp.getX(i) / 0.3;
    pp.setZ(i, 0.014 * Math.sin(Math.abs(x) * Math.PI * 0.95) * (1 - Math.abs(x) * 0.25) + 0.006 * (1 - Math.abs(x)));
  }
  pagesGeo.computeVertexNormals();
  const pages = new THREE.Mesh(pagesGeo, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85 }));
  pages.rotation.x = -Math.PI / 2;
  pages.position.y = 0.026;
  pages.receiveShadow = true;
  group.add(pages);
  const block = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.014, 0.385), new THREE.MeshStandardMaterial({ color: '#e8dcc0', roughness: 0.9 }));
  block.position.y = 0.022;
  group.add(block);
  const book = new THREE.Group();
  book.add(boards, pages, block);
  group.add(book);

  let current = 0;
  let isStamped: (id: string) => boolean = () => false;
  let flourish = 0;
  const draw = () => {
    drawSpread(g, current, isStamped(WANTED[current].id));
    tex.needsUpdate = true;
  };
  draw();
  return {
    group,
    book,
    page: () => current,
    show(i, stamped) {
      current = ((i % WANTED.length) + WANTED.length) % WANTED.length;
      isStamped = stamped;
      draw();
    },
    stamp(id) {
      if (WANTED[current].id === id) {
        draw();
        flourish = 1;
      }
    },
    tick(_t, dt) {
      // A stamp lands with a little bounce of the book.
      if (flourish > 0) {
        flourish = Math.max(0, flourish - dt * 2.5);
        book.position.y = Math.sin(flourish * Math.PI) * 0.006;
      }
    },
  };
}
