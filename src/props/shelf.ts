// The bookshelf on the wall behind the desk: a few books you can take down and
// read, a lot you can't (yet), a boombox that plays the tape, and odds and ends.
import * as THREE from 'three';
import { BOOKS, type Book } from '../books';
import { canvas, rng, texture, wood } from '../textures';

export interface Shelf {
  group: THREE.Group;
  /** The readable books, each pulled out a little. */
  books: { book: Book; mesh: THREE.Object3D }[];
  boombox: THREE.Object3D;
  /** Slides a book out toward the reader, or back. */
  pull(id: string | null): void;
  tick(t: number, dt: number): void;
}

const SW = 1.5;
const SH = 2.05;
const SD = 0.3;

function spineTexture(b: Book) {
  const [c, g] = canvas(128, 768);
  g.fillStyle = b.cloth;
  g.fillRect(0, 0, 128, 768);
  // Cloth weave and gilt bands.
  for (let y = 0; y < 768; y += 3) {
    g.fillStyle = `rgba(0,0,0,${0.04 + Math.random() * 0.04})`;
    g.fillRect(0, y, 128, 1);
  }
  g.fillStyle = b.ink;
  for (const y of [40, 54, 714, 728]) g.fillRect(10, y, 108, 4);
  g.save();
  g.translate(64, 384);
  g.rotate(Math.PI / 2);
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = '600 46px "EB Garamond", serif';
  const title = b.title.length > 20 ? b.title.slice(0, 19) + '…' : b.title;
  g.fillText(title, 40, -14);
  g.font = 'italic 400 32px "EB Garamond", serif';
  g.fillText(b.author.split(',')[0], 40, 30);
  g.restore();
  return texture(c);
}

export function buildShelf(): Shelf {
  const group = new THREE.Group();
  const r = rng(404);
  const shelfMat = new THREE.MeshStandardMaterial({ map: wood(23, '#6a4126', '#3a2010'), roughness: 0.55 });

  // The carcass: sides, top, back, and five shelves.
  const part = (w: number, h: number, d: number, x: number, y: number, z: number) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), shelfMat);
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    group.add(m);
  };
  part(0.03, SH, SD, -SW / 2, SH / 2, SD / 2);
  part(0.03, SH, SD, SW / 2, SH / 2, SD / 2);
  part(SW + 0.03, 0.03, SD, 0, SH, SD / 2);
  part(SW, SH, 0.012, 0, SH / 2, 0.006);
  const levels = [0.08, 0.5, 0.92, 1.34, 1.72];
  for (const y of levels) part(SW, 0.025, SD, 0, y, SD / 2);

  // Filler books: a little run of cloth and paper spines on each shelf.
  const fillerColors = ['#7a2a2a', '#2a4a6a', '#3d5a3a', '#c9b48a', '#5a3a5a', '#1f1f24', '#8a6a3a', '#a8442f', '#e1d6bb', '#24435a'];
  const filler = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ roughness: 0.8 }), 140);
  let fi = 0;
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const readable: { book: Book; mesh: THREE.Object3D; home: THREE.Vector3 }[] = [];
  let next = 0;
  levels.forEach((y, li) => {
    if (li === levels.length - 1) return; // the top shelf has the boombox
    let x = -SW / 2 + 0.03;
    const end = SW / 2 - 0.03;
    // Two readable books on most shelves, at a random spot in the run.
    const slots = li === 0 ? [0.45 + r() * 0.2] : [0.15 + r() * 0.25, 0.6 + r() * 0.25];
    while (x < end - 0.02) {
      const at = (x + SW / 2) / SW;
      if (slots.length && at > slots[0] && next < BOOKS.length) {
        slots.shift();
        const b = BOOKS[next++];
        const w = 0.042;
        const h = 0.27;
        const book = new THREE.Group();
        const cover = new THREE.MeshStandardMaterial({ color: b.cloth, roughness: 0.7 });
        const pages = new THREE.MeshStandardMaterial({ color: '#efe6cf', roughness: 0.9 });
        const spine = new THREE.MeshStandardMaterial({ map: spineTexture(b), roughness: 0.65 });
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.2), [cover, cover, pages, pages, spine, pages]);
        mesh.castShadow = true;
        book.add(mesh);
        const home = new THREE.Vector3(x + w / 2, y + 0.0125 + h / 2, SD / 2 + 0.03);
        book.position.copy(home);
        group.add(book);
        readable.push({ book: b, mesh: book, home });
        x += w + 0.004;
        continue;
      }
      const w = 0.02 + r() * 0.035;
      const h = 0.2 + r() * 0.12;
      const lean = x > end - 0.12 && r() < 0.5 ? 0.18 : 0;
      m4.compose(
        new THREE.Vector3(x + w / 2, y + 0.0125 + h / 2, SD / 2 + (r() - 0.5) * 0.02),
        q.setFromAxisAngle(new THREE.Vector3(0, 0, 1), -lean),
        new THREE.Vector3(w, h, 0.17 + r() * 0.05),
      );
      if (fi < 140) {
        filler.setMatrixAt(fi, m4);
        filler.setColorAt(fi, new THREE.Color(fillerColors[Math.floor(r() * fillerColors.length)]));
        fi++;
      }
      x += w + 0.002;
      // Leave a gap now and then for an object.
      if (r() < 0.05) x += 0.1;
    }
  });
  filler.count = fi;
  filler.castShadow = true;
  filler.receiveShadow = true;
  group.add(filler);

  // A boombox on the top shelf: silver plastic, two speakers, a tape door.
  const boombox = new THREE.Group();
  const plastic = new THREE.MeshStandardMaterial({ color: '#b9bcc2', metalness: 0.5, roughness: 0.35 });
  const dark = new THREE.MeshStandardMaterial({ color: '#1a1b1f', roughness: 0.6 });
  const bodyBox = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.2, 0.11), plastic);
  bodyBox.castShadow = true;
  boombox.add(bodyBox);
  for (const sx of [-1, 1]) {
    const grille = new THREE.Mesh(new THREE.CylinderGeometry(0.068, 0.068, 0.01, 32), dark);
    grille.rotation.x = Math.PI / 2;
    grille.position.set(sx * 0.15, -0.01, 0.055);
    boombox.add(grille);
    const cone = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.012, 24), plastic);
    cone.rotation.x = Math.PI / 2;
    cone.position.set(sx * 0.15, -0.01, 0.058);
    boombox.add(cone);
  }
  const [dc, dg] = canvas(256, 128);
  dg.fillStyle = '#26282e';
  dg.fillRect(0, 0, 256, 128);
  dg.fillStyle = '#0d0e10';
  dg.fillRect(30, 30, 196, 70);
  dg.strokeStyle = '#c9a04e';
  dg.lineWidth = 3;
  for (const x of [90, 166]) {
    dg.beginPath();
    dg.arc(x, 65, 18, 0, Math.PI * 2);
    dg.stroke();
  }
  dg.fillStyle = '#e8e1cc';
  dg.font = '700 16px "Space Mono", monospace';
  dg.fillText('EW · SIDE A', 80, 22);
  const door = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.06), new THREE.MeshStandardMaterial({ map: texture(dc), roughness: 0.4 }));
  door.position.set(0, -0.01, 0.0555);
  boombox.add(door);
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.008, 8, 24, Math.PI), plastic);
  handle.position.set(0, 0.1, 0);
  boombox.add(handle);
  const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.002, 0.002, 0.3, 6), plastic);
  antenna.position.set(0.18, 0.2, -0.03);
  antenna.rotation.z = -0.5;
  boombox.add(antenna);
  boombox.position.set(-0.25, levels[4] + 0.0125 + 0.1, SD / 2 + 0.02);
  group.add(boombox);

  // A couple of keepsakes on the top shelf too: a little brass trophy and a framed snapshot.
  const brass = new THREE.MeshStandardMaterial({ color: '#c9a04e', metalness: 1, roughness: 0.3 });
  const cupMesh = new THREE.Mesh(new THREE.LatheGeometry([0, 0.03, 0.035, 0.012, 0.012, 0.04, 0.045].map((x, i) => new THREE.Vector2(x, [0, 0, 0.01, 0.02, 0.06, 0.1, 0.13][i])), 24), brass);
  cupMesh.position.set(0.35, levels[4] + 0.0125, SD / 2);
  group.add(cupMesh);
  const photo = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.12, 0.015), new THREE.MeshStandardMaterial({ color: '#2a1d14', roughness: 0.5 }));
  photo.position.set(0.58, levels[4] + 0.0125 + 0.06, SD / 2 - 0.05);
  photo.rotation.x = -0.15;
  group.add(photo);
  const [pc, pg] = canvas(256, 192);
  const sky = pg.createLinearGradient(0, 0, 0, 192);
  sky.addColorStop(0, '#8fb6d8');
  sky.addColorStop(1, '#f4d3a8');
  pg.fillStyle = sky;
  pg.fillRect(0, 0, 256, 192);
  pg.fillStyle = '#3d5a6a';
  pg.beginPath();
  pg.moveTo(0, 150);
  pg.lineTo(70, 70);
  pg.lineTo(120, 120);
  pg.lineTo(170, 50);
  pg.lineTo(256, 140);
  pg.lineTo(256, 192);
  pg.lineTo(0, 192);
  pg.fill();
  const snap = new THREE.Mesh(new THREE.PlaneGeometry(0.13, 0.095), new THREE.MeshStandardMaterial({ map: texture(pc), roughness: 0.4 }));
  snap.position.set(0, 0, 0.0081);
  photo.add(snap);

  let pulled: string | null = null;
  return {
    group,
    books: readable.map(({ book, mesh }) => ({ book, mesh })),
    boombox,
    pull(id) {
      pulled = id;
    },
    tick(_t, dt) {
      for (const b of readable) {
        const out = b.book.id === pulled ? 0.12 : 0;
        b.mesh.position.z += (b.home.z + out - b.mesh.position.z) * Math.min(1, dt * 6);
      }
    },
  };
}
