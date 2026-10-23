// The studio, re-potted. The desk is the potting bench, in weathered pine; the
// medals hang on a show board as the prizes of the house's own flower show,
// rosettes beside them and a prize plant on a stand; the diplomas are framed as
// botanical plates; the scratch map is a plant hunter's, with a cartouche and a
// collecting tin; the shirts dry on a line among bundles of herbs; the books
// share the wall with a cabinet of seed drawers, and the seed catalog lies open
// on top of it. Every piece works as it always does.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { canvas, rng, texture } from '../../textures';
import type { Studio } from '../kit';
import { HOUSE, POT_AT, SHOW_POT, SHOW_STAND, WALL } from './plan';
import { weathered } from './surfaces';

const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const BACK = HOUSE.back;

/** The seed drawers: where the cabinet stands, and its size. */
export const DRAWERS = { x: WALL.drawers, w: 0.92, h: 1.06, d: 0.4 };
/** Where the catalog lies open, on its stand on top of the drawers: its middle, and how far it leans back. */
export const CATALOG = { at: v(WALL.drawers, DRAWERS.h + 0.12, BACK - DRAWERS.d / 2 - 0.02), tilt: 0.55 };

/** Lettering for a sign: one or two lines, centered, on a ground. */
function sign(lines: { text: string; font: string; color: string; y: number }[], w: number, h: number, ground: (g: CanvasRenderingContext2D) => void) {
  const [c, g] = canvas(w, h);
  ground(g);
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  for (const l of lines) {
    g.font = l.font;
    g.fillStyle = l.color;
    g.fillText(l.text, w / 2, l.y);
  }
  return texture(c);
}

/** A prize rosette: pleated rings of ribbon round a button with the place on it. */
function rosetteTexture(color: string, light: string, place: string) {
  const [c, g] = canvas(256, 256);
  const cx = 128;
  for (const [r, col] of [
    [124, color],
    [104, light],
    [86, color],
  ] as const) {
    g.fillStyle = col;
    g.beginPath();
    for (let i = 0; i <= 64; i++) {
      const a = (i / 64) * Math.PI * 2;
      const rr = r - (i % 2) * 7;
      g.lineTo(cx + Math.cos(a) * rr, cx + Math.sin(a) * rr);
    }
    g.fill();
    // The pleats.
    g.strokeStyle = 'rgba(0,0,0,0.18)';
    g.lineWidth = 2;
    for (let i = 0; i < 32; i++) {
      const a = (i / 32) * Math.PI * 2;
      g.beginPath();
      g.moveTo(cx + Math.cos(a) * (r - 18), cx + Math.sin(a) * (r - 18));
      g.lineTo(cx + Math.cos(a) * r, cx + Math.sin(a) * r);
      g.stroke();
    }
  }
  g.fillStyle = '#f4ecd8';
  g.beginPath();
  g.arc(cx, cx, 56, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = '#b08a3a';
  g.lineWidth = 5;
  g.stroke();
  g.fillStyle = '#2a2018';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = '600 46px "EB Garamond", serif';
  g.fillText(place, cx, cx + 2);
  return texture(c);
}

/** The mat of a botanical plate: pale sage paper, a fine double rule, a pressed sprig in each corner. */
function plateMat(no: string) {
  const [c, g] = canvas(820, 620);
  g.fillStyle = '#e6e2cc';
  g.fillRect(0, 0, 820, 620);
  const r = rng(no.length * 31 + 7);
  for (let i = 0; i < 1600; i++) {
    g.fillStyle = `rgba(120,110,70,${r() * 0.05})`;
    g.fillRect(r() * 820, r() * 620, 2, 2);
  }
  g.strokeStyle = '#6a6040';
  g.lineWidth = 3;
  g.strokeRect(18, 18, 784, 584);
  g.lineWidth = 1;
  g.strokeRect(28, 28, 764, 564);
  // A little fern frond in each corner, pressed flat and faded.
  const frond = (x: number, y: number, a: number) => {
    g.save();
    g.translate(x, y);
    g.rotate(a);
    g.strokeStyle = 'rgba(70,90,50,0.8)';
    g.fillStyle = 'rgba(80,105,55,0.75)';
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(0, 0);
    g.quadraticCurveTo(20, -30, 10, -64);
    g.stroke();
    for (let i = 1; i < 9; i++) {
      const t = i / 9;
      const px = 20 * 2 * t * (1 - t) + 10 * t * t;
      const py = -64 * t * t - 30 * 2 * t * (1 - t);
      for (const s of [-1, 1]) {
        g.beginPath();
        g.ellipse(px + s * 7 * (1 - t), py, 7 * (1 - t * 0.6), 2.6, s * 0.5, 0, Math.PI * 2);
        g.fill();
      }
    }
    g.restore();
  };
  frond(40, 600, 0.6);
  frond(780, 600, -0.6);
  frond(40, 20, 2.5);
  frond(780, 20, -2.5);
  g.fillStyle = '#4a4430';
  g.textAlign = 'center';
  g.font = 'italic 400 22px "EB Garamond", serif';
  g.fillText(no, 410, 604);
  return texture(c);
}

/** The cabinet of seed drawers' front: sixteen little drawers, each a label and a brass pull. */
function drawerFront() {
  const [c, g] = canvas(512, 600);
  const r = rng(61);
  g.fillStyle = '#5a3a22';
  g.fillRect(0, 0, 512, 600);
  const seeds = ['SWEET PEA', 'NASTURTIUM', 'LARKSPUR', 'MIGNONETTE', 'STOCK', 'POPPY', 'CORNFLOWER', 'PANSY', 'WALLFLOWER', 'LOVE IN A MIST', 'CANTERBURY BELL', 'HOLLYHOCK', 'FOXGLOVE', 'MARIGOLD', 'SNAPDRAGON', 'SWEET WILLIAM'];
  const cols = 4;
  const rows = 4;
  const dw = 512 / cols;
  const dh = 600 / rows;
  for (let i = 0; i < cols * rows; i++) {
    const x = (i % cols) * dw;
    const y = Math.floor(i / cols) * dh;
    const tone = 0.9 + r() * 0.2;
    g.fillStyle = `rgb(${Math.round(120 * tone)},${Math.round(80 * tone)},${Math.round(48 * tone)})`;
    g.fillRect(x + 6, y + 6, dw - 12, dh - 12);
    g.strokeStyle = 'rgba(30,18,8,0.7)';
    g.lineWidth = 4;
    g.strokeRect(x + 6, y + 6, dw - 12, dh - 12);
    // A brass label holder with a hand-written card.
    g.fillStyle = '#b08a44';
    g.fillRect(x + 16, y + 24, dw - 32, 40);
    g.fillStyle = '#efe6cc';
    g.fillRect(x + 20, y + 28, dw - 40, 32);
    g.fillStyle = '#3a2a1a';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    let px = 20;
    g.font = `600 ${px}px "Caveat", cursive`;
    while (g.measureText(seeds[i]).width > dw - 46 && px > 12) g.font = `600 ${(px -= 1)}px "Caveat", cursive`;
    g.fillText(seeds[i], x + dw / 2, y + 45);
    // The pull.
    g.fillStyle = '#c9a04e';
    g.beginPath();
    g.arc(x + dw / 2, y + dh - 42, 9, 0, Math.PI * 2);
    g.fill();
  }
  return texture(c);
}

/** A bundle of herbs hung upside down to dry: stems tied at the top, leaves and flowers down the length. */
function herbBundle(kind: number, seed: number) {
  const r = rng(seed);
  const parts: THREE.BufferGeometry[] = [];
  const colors: number[] = [];
  const stemCol = new THREE.Color(['#6a7a4a', '#4a5a34', '#7a8a6a', '#6a6a3a', '#7a7a4a'][kind]);
  const leafCol = new THREE.Color(['#8a9a7a', '#3e5232', '#9aa898', '#6a7a3e', '#8a9a5a'][kind]);
  const flowerCol = new THREE.Color(['#7a5aa8', '#4a5a3a', '#9aa898', '#e8e2d0', '#e8a030'][kind]);
  const add = (g: THREE.BufferGeometry, c: THREE.Color) => {
    const n = (g.index ? g.toNonIndexed() : g).attributes.position.count;
    const geo = g.index ? g.toNonIndexed() : g;
    geo.deleteAttribute('uv');
    parts.push(geo);
    for (let i = 0; i < n; i++) colors.push(c.r, c.g, c.b);
  };
  const n = 12 + Math.floor(r() * 6);
  for (let i = 0; i < n; i++) {
    // Each stem fans out a little from the tie, hanging down.
    const a = r() * Math.PI * 2;
    const spread = 0.02 + r() * 0.035;
    const len = 0.22 + r() * 0.1;
    const end = v(Math.cos(a) * spread, -len, Math.sin(a) * spread);
    const stem = new THREE.CylinderGeometry(0.0018, 0.0022, len, 4, 1);
    stem.applyMatrix4(new THREE.Matrix4().compose(end.clone().multiplyScalar(0.5), new THREE.Quaternion().setFromUnitVectors(v(0, 1, 0), end.clone().normalize().negate()), v(1, 1, 1)));
    add(stem, stemCol);
    // Leaves along it (small blobs), and the flowers or heads at its end.
    for (let k = 0; k < 5; k++) {
      const t = 0.25 + k * 0.15;
      const leaf = new THREE.IcosahedronGeometry(kind === 1 ? 0.006 : 0.011, 0);
      leaf.scale(1, kind === 1 ? 2.2 : 1.4, 0.6);
      leaf.translate(end.x * t + (r() - 0.5) * 0.012, end.y * t, end.z * t + (r() - 0.5) * 0.012);
      add(leaf, leafCol);
    }
    const head = new THREE.IcosahedronGeometry(kind === 3 ? 0.016 : 0.008, 0);
    head.scale(1, kind === 0 ? 3 : 1, 1);
    head.translate(end.x, end.y - 0.01, end.z);
    add(head, flowerCol);
  }
  // The twine round the top.
  const tie = new THREE.TorusGeometry(0.014, 0.004, 4, 10);
  tie.rotateX(Math.PI / 2);
  tie.translate(0, -0.02, 0);
  add(tie, new THREE.Color('#c8b088'));
  const loop = new THREE.CylinderGeometry(0.0015, 0.0015, 0.05, 3);
  loop.translate(0, 0.005, 0);
  add(loop, new THREE.Color('#c8b088'));
  const geo = mergeGeometries(parts);
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  return geo;
}

export interface Dressing {
  group: THREE.Group;
  /** The rosettes on the show board, to stir a little. */
  rosettes: THREE.Object3D[];
  /** The pieces big enough to throw a shadow worth having in the low sun. */
  casters: THREE.Object3D[];
}

/** Moves the studio's pieces to the greenhouse and adds what dresses them. */
export function arrangeStudio(s: Studio, mats: { wood: THREE.MeshStandardMaterial; iron: THREE.MeshStandardMaterial; blackIron: THREE.MeshStandardMaterial }): Dressing {
  const group = new THREE.Group();
  const rosettes: THREE.Object3D[] = [];

  // --- the potting bench -------------------------------------------------------------------
  s.desk.plant.visible = false;
  const pine = weathered(19);
  pine.wrapS = pine.wrapT = THREE.RepeatWrapping;
  pine.repeat.set(1.2, 1);
  s.desk.group.traverse((o) => {
    const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
    if (!(o as THREE.Mesh).isMesh || !m || !(m instanceof THREE.MeshStandardMaterial)) return;
    // The desk's wood (top and drawers) and its dark legs: weathered pine, like the staging.
    if (m.map && m.map !== pine && o.parent === s.desk.group && m.color.getHex() === 0xffffff && (o as THREE.Mesh).geometry.type === 'RoundedBoxGeometry') {
      m.map = pine;
      m.color.set('#d8ccb8');
      m.roughness = 0.82;
      m.needsUpdate = true;
    }
    if (!m.map && m.color.getHexString() === '2a1c12') m.color.set('#6a5a46');
  });

  // --- the prizes: medals and plates on a show board -----------------------------------------------
  const { honors } = s;
  honors.group.position.set(WALL.honors, 0, BACK - 0.03);
  honors.group.rotation.y = Math.PI;
  const boardW = 2.55;
  const board = new THREE.Mesh(
    new THREE.BoxGeometry(boardW, 1.12, 0.02),
    new THREE.MeshStandardMaterial({
      map: sign([], 64, 64, (g) => {
        g.fillStyle = '#24402e';
        g.fillRect(0, 0, 64, 64);
      }),
      roughness: 0.75,
    }),
  );
  board.position.set(WALL.honors - 0.06, 1.72, BACK - 0.012);
  board.castShadow = true;
  board.receiveShadow = true;
  group.add(board);
  const header = new THREE.Mesh(
    new THREE.PlaneGeometry(1.5, 0.15),
    new THREE.MeshStandardMaterial({
      map: sign([{ text: 'THE GREENHOUSE SHOW · PRIZES', font: '600 54px "EB Garamond", serif', color: '#e6c674', y: 50 }], 1024, 100, (g) => {
        g.fillStyle = '#1c3324';
        g.fillRect(0, 0, 1024, 100);
        g.strokeStyle = '#c9a04e';
        g.lineWidth = 4;
        g.strokeRect(8, 8, 1008, 84);
      }),
      roughness: 0.6,
    }),
  );
  header.position.set(WALL.honors - 0.06, 2.2, BACK - 0.025);
  header.rotation.y = Math.PI;
  group.add(header);
  // Rosettes, as a show gives them, pinned beside the medals.
  const rosetteGeo = new THREE.CircleGeometry(0.075, 32);
  const tailGeo = new THREE.PlaneGeometry(0.035, 0.16);
  tailGeo.translate(0, -0.08, 0);
  for (const [i, color, light, place, x, y] of [
    [0, '#b8262a', '#e8d070', '1st', 2.2, 1.95],
    [1, '#2a4ea0', '#e8e0d0', '2nd', 2.24, 1.66],
    [2, '#d8a828', '#f4ecd8', '3rd', 4.82, 1.86],
  ] as const) {
    const rosette = new THREE.Group();
    const face = new THREE.Mesh(rosetteGeo, new THREE.MeshStandardMaterial({ map: rosetteTexture(color, light, place), roughness: 0.7, side: THREE.DoubleSide }));
    face.position.z = 0.012;
    rosette.add(face);
    for (const s2 of [-1, 1]) {
      const tail = new THREE.Mesh(tailGeo, new THREE.MeshStandardMaterial({ color, roughness: 0.7, side: THREE.DoubleSide }));
      tail.position.set(s2 * 0.022, -0.03, 0.006);
      tail.rotation.z = s2 * 0.18;
      rosette.add(tail);
    }
    rosette.position.set(x, y, BACK - 0.03);
    rosette.rotation.y = Math.PI;
    rosette.userData.phase = i * 1.9;
    rosettes.push(rosette);
    group.add(rosette);
  }
  // The diplomas, framed as botanical plates: light oak, a gilt slip, a sage mat with pressed fronds.
  const oak = new THREE.MeshStandardMaterial({ color: '#b08a5a', roughness: 0.55 });
  honors.diplomas.forEach((d, i) => {
    const kids = d.children as THREE.Mesh[];
    const frame = kids.find((k) => (k.geometry as THREE.BoxGeometry).parameters?.width === 0.46);
    const mat = kids.find((k) => (k.geometry as THREE.PlaneGeometry).parameters?.width === 0.41 && !(k.material as THREE.MeshStandardMaterial).transparent);
    if (frame) frame.material = oak;
    if (mat) (mat.material as THREE.MeshStandardMaterial).map = plateMat(`Plate ${['I', 'II', 'III', 'IV'][i] ?? i + 1}`);
    if (mat) (mat.material as THREE.MeshStandardMaterial).color.set('#ffffff');
  });

  // The prize plant's stand: a little round table by the board.
  const stand = POT_AT[SHOW_POT];
  const top = new THREE.Mesh(new THREE.CylinderGeometry(SHOW_STAND.r, SHOW_STAND.r, 0.03, 28), mats.wood);
  top.position.set(stand.x, stand.y - 0.015, stand.z);
  top.castShadow = true;
  top.receiveShadow = true;
  group.add(top);
  const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.04, stand.y - 0.03, 10), mats.blackIron);
  leg.position.set(stand.x, (stand.y - 0.03) / 2, stand.z);
  group.add(leg);
  const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.18, 0.03, 20), mats.blackIron);
  foot.position.set(stand.x, 0.015, stand.z);
  group.add(foot);
  const card = new THREE.Mesh(
    new THREE.PlaneGeometry(0.1, 0.065),
    new THREE.MeshStandardMaterial({
      map: sign(
        [
          { text: 'BEST IN SHOW', font: '600 40px "EB Garamond", serif', color: '#7a2a22', y: 52 },
          { text: 'first prize', font: 'italic 400 34px "EB Garamond", serif', color: '#3a3020', y: 104 },
        ],
        320,
        200,
        (g) => {
          g.fillStyle = '#f4eedf';
          g.fillRect(0, 0, 320, 200);
          g.strokeStyle = '#7a2a22';
          g.lineWidth = 6;
          g.strokeRect(10, 10, 300, 180);
        },
      ),
      roughness: 0.8,
    }),
  );
  card.position.set(stand.x - 0.11, stand.y + 0.034, stand.z - 0.12);
  card.rotation.set(-0.6, 0.5, 0.12);
  group.add(card);

  // --- the plant hunter's map ------------------------------------------------------------------------
  const { map } = s;
  map.group.position.set(WALL.map, 1.62, BACK - 0.02);
  map.group.rotation.y = Math.PI;
  map.group.traverse((o) => {
    const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
    if ((o as THREE.Mesh).isMesh && m instanceof THREE.MeshStandardMaterial && m.color.getHexString() === '141414') m.color.set('#4a3020');
  });
  const cartouche = new THREE.Mesh(
    new THREE.PlaneGeometry(0.78, 0.14),
    new THREE.MeshStandardMaterial({
      map: sign([{ text: 'THE PLANT HUNTER’S MAP', font: '600 50px "EB Garamond", serif', color: '#3a2a18', y: 70 }], 1024, 140, (g) => {
        g.fillStyle = '#ead9b0';
        g.beginPath();
        g.moveTo(40, 20);
        g.lineTo(984, 20);
        g.quadraticCurveTo(1014, 70, 984, 120);
        g.lineTo(40, 120);
        g.quadraticCurveTo(10, 70, 40, 20);
        g.fill();
        g.strokeStyle = '#8a6a3a';
        g.lineWidth = 3;
        g.stroke();
      }),
      transparent: true,
      roughness: 0.85,
    }),
  );
  cartouche.position.set(WALL.map, 2.16, BACK - 0.012);
  cartouche.rotation.y = Math.PI;
  group.add(cartouche);
  // A botanist's collecting tin, hung on a nail beside it.
  const tin = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.42, 20), new THREE.MeshStandardMaterial({ color: '#3e5a3a', roughness: 0.45, metalness: 0.4 }));
  body.rotation.z = Math.PI / 2;
  body.castShadow = true;
  tin.add(body);
  for (const x of [-0.21, 0.21]) {
    const capEnd = new THREE.Mesh(new THREE.CylinderGeometry(0.078, 0.078, 0.02, 20), new THREE.MeshStandardMaterial({ color: '#2e4a2c', roughness: 0.4, metalness: 0.5 }));
    capEnd.rotation.z = Math.PI / 2;
    capEnd.position.x = x;
    tin.add(capEnd);
  }
  const strap = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.008, 4, 24, Math.PI), new THREE.MeshStandardMaterial({ color: '#6a4a2a', roughness: 0.7 }));
  strap.position.y = 0.02;
  tin.add(strap);
  tin.position.set(WALL.map - 1.08, 1.32, BACK - 0.09);
  tin.rotation.set(0, Math.PI, 0.15);
  group.add(tin);

  // The shoes, kicked off under the map, toes out into the house.
  s.shoes.group.position.set(WALL.map + 0.42, 0, BACK - 0.42);
  s.shoes.group.rotation.y = Math.PI / 2 - 0.35;

  // --- the bookshelf, the seed drawers and the catalog ----------------------------------------------
  s.shelf.group.position.set(WALL.shelf, 0, BACK);
  s.shelf.group.rotation.y = Math.PI;
  const cab = new THREE.Group();
  const cabWood = new THREE.MeshStandardMaterial({ color: '#6a4428', roughness: 0.6 });
  const carcass = new THREE.Mesh(new THREE.BoxGeometry(DRAWERS.w, DRAWERS.h, DRAWERS.d), [cabWood, cabWood, cabWood, cabWood, new THREE.MeshStandardMaterial({ map: drawerFront(), roughness: 0.6 }), cabWood]);
  carcass.position.y = DRAWERS.h / 2;
  carcass.castShadow = true;
  carcass.receiveShadow = true;
  cab.add(carcass);
  const cabTop = new THREE.Mesh(new THREE.BoxGeometry(DRAWERS.w + 0.05, 0.03, DRAWERS.d + 0.04), cabWood);
  cabTop.position.y = DRAWERS.h + 0.015;
  cabTop.castShadow = true;
  cab.add(cabTop);
  cab.position.set(DRAWERS.x, 0, BACK - DRAWERS.d / 2);
  // Its front faces the room: the box's +z face.
  group.add(cab);

  // --- the line: shirts and herbs drying, hung from the wall on two brackets --------------------------
  const { line } = s;
  line.group.rotation.y = Math.PI;
  line.group.position.set(WALL.line + 0.95, 0, BACK - 0.26);
  line.group.updateMatrixWorld(true);
  const herbs = new THREE.Group();
  const herbParts: THREE.BufferGeometry[] = [];
  // Along the rope (its own x, 0..1.55, sagging in the middle), past the shirts.
  for (const [k, x] of [
    [0, 1.02],
    [1, 1.16],
    [2, 1.29],
    [3, 1.42],
    [4, 0.02],
  ] as const) {
    const t = x / 1.55;
    const y = 2.32 + (2.29 - 2.32) * t - Math.sin(t * Math.PI) * 0.09;
    const b = herbBundle(k, 40 + k * 13);
    b.translate(x, y, 0.004);
    herbParts.push(b);
  }
  const herbMesh = new THREE.Mesh(mergeGeometries(herbParts), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 }));
  herbMesh.castShadow = true;
  herbs.add(herbMesh);
  line.group.add(herbs);
  for (const x of [0, 1.55]) {
    const tip = line.group.localToWorld(v(x, 2.8, 0));
    const root = v(tip.x, tip.y, BACK);
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, root.distanceTo(tip), 6), mats.blackIron);
    arm.position.copy(tip).add(root).multiplyScalar(0.5);
    arm.rotation.x = Math.PI / 2;
    group.add(arm);
    const plate = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.1, 0.012), mats.blackIron);
    plate.position.copy(root).add(v(0, 0, -0.006));
    group.add(plate);
  }

  for (const o of [honors.group, map.group, s.shelf.group, s.shoes.group, line.group, group]) o.updateMatrixWorld(true);
  return { group, rosettes, casters: [board, cab, top, leg, tin] };
}
