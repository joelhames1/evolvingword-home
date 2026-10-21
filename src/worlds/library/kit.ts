// The Library: the studio scattered through an endless library of hexagonal
// galleries, after the one in the story everyone half remembers, which holds
// every book that could be written, almost all of them noise. ‹ › walks you
// from gallery to gallery: the reading room with the desk, where a great book
// floats open over the well and breeds words out of noise; the medals and
// diplomas on a paneled wall; the few books here you can actually read, in an
// alcove of their own; the map, the shirts on their line and the shoes; and the
// well itself, a stair winding round it up toward a skylight nobody has reached
// and down into the dark.
import * as THREE from 'three';
import { SHOTS } from '../../camera';
import { ROOM } from '../../layout';
import { glow, wood } from '../../textures';
import type { Kit, KitModule, Studio } from '../kit';
import { buildBook } from './book';
import { buildMirror } from './mirror';
import { buildHall } from './hall';
import { lit, LIGHT } from './light';
import { center, clear, D, HEX, onWall, ROOMS, route, wallMatrix } from './plan';
import { buildBand } from './sound';

const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

/** How far the desk and everything on it moves back from the usual room: to sit at the reading room's well. */
const DESK = v(0, 0, 4.75);
/** Where the book floats, over the reading room's well. */
const BOOK = v(0, 1.86, 0);

export const buildKit: KitModule['buildKit'] = ({ quality, scene, log }) => {
  log('DUSTING THE SHELVES', 40);
  const hall = buildHall(quality);
  log('TRIMMING THE LAMPS', 60);
  scene.fog = new THREE.FogExp2('#2a1a0e', 0.034);

  // --- the book over the well ------------------------------------------------------------
  const book = buildBook();
  book.group.position.copy(BOOK);
  book.group.rotation.x = -0.36;

  // --- light for the studio's things (the galleries light themselves) ----------------------
  const lights = new THREE.Group();
  const lamp = (k: number, sx: number, power: number) => {
    const l = new THREE.PointLight('#ffb36a', power, 9, 1.6);
    l.position.copy(center(k)).add(v(HEX.lamp.x * sx, HEX.lamp.y - 0.05, 0));
    lights.add(l);
  };
  lamp(ROOMS.reading, 1, 3.2);
  lamp(ROOMS.reading, -1, 3.2);
  lamp(ROOMS.honors, 1, 6);
  // Over the books you can read, a picture light of their own.
  const reading = new THREE.SpotLight('#ffd29a', 9, 6, 0.7, 0.7, 1.4);
  const alcove = onWall(ROOMS.books, 0, 3, 0, 1.3);
  reading.position.copy(alcove.position).setY(2.9);
  reading.target.position.copy(onWall(ROOMS.books, 0, 3, 0, 0.2).position).setY(1.0);
  lights.add(reading, reading.target);
  lamp(ROOMS.maps, 1, 3);
  lights.add(new THREE.HemisphereLight('#c6d0de', '#3a2414', 0.35));
  // The pale light from above, on the book and the desk.
  const fall = new THREE.SpotLight('#cfe0ff', 6, 30, 0.12, 0.6, 1);
  fall.position.set(0, 24, 0);
  fall.target.position.copy(BOOK);
  lights.add(fall, fall.target);

  // --- someone else's reading table, in the gallery across the well ------------------------
  const table = new THREE.Group();
  const tableWood = lit(new THREE.MeshStandardMaterial({ map: wood(61, '#5a3620', '#2a160a'), roughness: 0.6 }), { spec: 0.2, shine: 30 });
  const top = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.05, 0.72), tableWood);
  top.position.y = 0.76;
  table.add(top);
  for (const [x, z] of [
    [-0.58, -0.3],
    [0.58, -0.3],
    [-0.58, 0.3],
    [0.58, 0.3],
  ]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.74, 0.05), tableWood);
    leg.position.set(x, 0.37, z);
    table.add(leg);
  }
  // A chair pushed back, as if someone just got up.
  const chair = new THREE.Group();
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.04, 0.42), tableWood);
  seat.position.y = 0.46;
  chair.add(seat);
  const back = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.5, 0.03), tableWood);
  back.position.set(0, 0.72, 0.2);
  chair.add(back);
  for (const [x, z] of [
    [-0.19, -0.18],
    [0.19, -0.18],
    [-0.19, 0.18],
    [0.19, 0.18],
  ]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.46, 0.035), tableWood);
    leg.position.set(x, 0.23, z);
    chair.add(leg);
  }
  chair.position.set(0.2, 0, 0.75);
  chair.rotation.y = 0.5;
  table.add(chair);
  const tableLamp = new THREE.Mesh(new THREE.SphereGeometry(0.07, 16, 12), new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffc890').multiplyScalar(3) }));
  tableLamp.position.set(-0.42, 1.08, -0.15);
  table.add(tableLamp);
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.05, 0.26, 10), hall.materials.bronze);
  stem.position.set(-0.42, 0.91, -0.15);
  table.add(stem);
  const tableHalo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow('rgba(255,190,120,1)', 64), color: '#ffb877', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.6 }));
  tableHalo.scale.setScalar(0.7);
  tableHalo.position.copy(tableLamp.position);
  table.add(tableHalo);
  table.position.copy(center(-1)).add(v(-2.5, 0, 2.7));
  table.rotation.y = 0.35;
  table.traverse((o) => (o.castShadow = false));

  // --- the lantern on the stair -------------------------------------------------------------
  const lantern = new THREE.Group();
  const flame = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffb060').multiplyScalar(4) }));
  lantern.add(flame);
  const lanternHalo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow('rgba(255,180,100,1)', 64), color: '#ffa860', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.8 }));
  lanternHalo.scale.setScalar(0.9);
  lantern.add(lanternHalo);
  const LANTERN_PERIOD = 280;
  let lastStep = -1;

  // The looking-glass in the passage on to the next gallery, on the wall across from the closet door.
  const mirror = buildMirror(quality, hall.materials.wood);
  mirror.position.set(HEX.archW - 0.02, 1.25, D / 2);
  mirror.rotation.y = -Math.PI / 2;

  const band = buildBand();

  // --- a book that's always just been put back --------------------------------------------
  // Wherever you arrive, one book in sight is still standing out of its shelf;
  // a moment later it slides home, as if someone had just left.
  const stray = new THREE.Mesh(new THREE.BoxGeometry(0.048, 0.29, 0.22), lit(new THREE.MeshStandardMaterial({ color: '#5a1d16', roughness: 0.6 }), { spec: 0.1 }));
  stray.visible = false;
  const strayAt = new THREE.Matrix4();
  let strayStart = -1;
  let strayShot = '';
  let turnsHeard = 0;
  const proj = new THREE.Vector3();
  const reshelve = (t: number, camera: THREE.PerspectiveCamera) => {
    const k = Math.round(camera.position.z / D);
    const seen = hall.slots.filter((s) => {
      if (s.k !== k || s.j !== 0 || !s.gap) return false;
      const p = v(s.gap.x, s.gap.y + 0.15, HEX.depth).applyMatrix4(s.matrix);
      const d = p.distanceTo(camera.position);
      proj.copy(p).project(camera);
      return d > 2 && d < 7.5 && Math.abs(proj.x) < 0.75 && Math.abs(proj.y) < 0.7 && proj.z < 1;
    });
    if (!seen.length) return;
    const s = seen[Math.floor(Math.random() * seen.length)];
    strayAt.copy(s.matrix).multiply(new THREE.Matrix4().makeTranslation(s.gap!.x, s.gap!.y + 0.145, HEX.depth - 0.026 - 0.11));
    strayStart = t;
  };

  // The tour: the reading room, then gallery by gallery down the line, then the well.
  const walls = [
    { id: 'desk', name: 'The reading room', members: ['signal', 'about', 'watch', 'pad', 'treats', 'work', 'board'] },
    { id: 'honors', name: 'Medals & diplomas', members: ['diplomas', 'medals'] },
    { id: 'library', name: 'Books you can read' },
    { id: 'places', name: 'Map, shirts & shoes', members: ['map', 'shoes', 'projects'] },
    { id: 'window', name: 'The well' },
  ];

  const kit: Kit = {
    objects: [hall.group, book.group, lights, table, lantern, stray, mirror],
    board: book,
    shots: {
      // High in the reading room's well, looking down the stair into the library.
      vista: { pos: v(0.32, 24, 0.55), target: v(-0.1, 0, -0.2), fov: 40, lean: 0.2 },
      // Out over the well, looking up the stair toward the light.
      window: { pos: v(0.12, 2.75, 0.62), target: v(-0.05, 16, -0.6), fov: 64, lean: 0.05 },
      // From behind the desk, the book across the well.
      board: { pos: v(0.28, 1.72, 4.0), target: BOOK.clone().add(v(0, -0.02, 0)), fov: 17, lean: 0.02 },
    },
    // Down the well past floor after floor, out over the book, and back to the desk.
    intro: { via: [v(0.25, 16, 0.45), v(0.15, 8.5, 0.3), v(0.05, 3.6, 0.6), v(0, 2.5, 3.1)], duration: 10, lines: ['EVOLVING WORD', 'A LITTLE STUDIO IN THE LIBRARY', 'WHERE WE MAKE THINGS TOGETHER'] },
    tagline: 'A LITTLE STUDIO IN THE LIBRARY.',
    walls,
    band,
    route,
    arrange(s: Studio) {
      // The desk and all that's on it, to the reading room's well.
      for (const o of [s.desk.group, s.watch.group, s.pad.group, s.treats.group, s.rolodex.group]) o.position.add(DESK);
      // The medals and diplomas, on the paneled wall of the next gallery.
      const h = onWall(ROOMS.honors, 0, 5, 0, HEX.depth + 0.012);
      s.honors.group.position.copy(h.position);
      s.honors.group.rotation.set(0, h.turn, 0);
      // The books you can read, in their alcove.
      const b = onWall(ROOMS.books, 0, 3, 0, 0.05);
      s.shelf.group.position.copy(b.position);
      s.shelf.group.rotation.set(0, b.turn, 0);
      // The map, the line and the shoes keep their places relative to each other: the whole left wall moves.
      const from = new THREE.Matrix4().compose(v(ROOM.x0, 0, 0.98), new THREE.Quaternion().setFromAxisAngle(v(0, 1, 0), Math.PI / 2), v(1, 1, 1));
      const move = wallMatrix(ROOMS.maps, 0, 5, 0, HEX.depth + 0.012).multiply(from.invert());
      for (const o of [s.map.group, s.line.group, s.shoes.group]) {
        o.updateMatrix();
        o.matrix.premultiply(move);
        o.matrix.decompose(o.position, o.quaternion, o.scale);
      }
      // The line remembers where each shirt hangs, for the camera: move those too.
      for (const it of s.line.items) it.focus.applyMatrix4(move);
      s.line.center.applyMatrix4(move);
      // Two brass arms off the panel for the line to hang from.
      s.line.group.updateMatrixWorld(true);
      const arm = new THREE.MeshStandardMaterial({ color: '#8a6430', metalness: 0.8, roughness: 0.35 });
      for (const x of [0, 1.55]) {
        const tip = s.line.group.localToWorld(v(x, 2.8, 0));
        const root = tip.clone().addScaledVector(onWall(ROOMS.maps, 0, 5, 0, 0).out, 0.3);
        const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, tip.distanceTo(root), 8), arm);
        rod.position.copy(tip).add(root).multiplyScalar(0.5);
        rod.quaternion.setFromUnitVectors(v(0, 1, 0), root.clone().sub(tip).normalize());
        hall.group.add(rod);
      }
    },
    // Standing further back than in a room, toward the middle of the gallery, so
    // the walk on to the next one goes through the arch rather than the shelves.
    closeups(s: Studio) {
      const facing = (o: THREE.Object3D) => v(0, 0, 1).applyQuaternion(o.getWorldQuaternion(new THREE.Quaternion())).setY(0).normalize();
      const shelfAt = s.shelf.group.localToWorld(v(0, 1.1, 0.3));
      const mapAt = s.map.group.localToWorld(v(0, 0, 0));
      const honorsAt = s.honors.group.localToWorld(v(0.08, 1.72, 0));
      return {
        honors: { pos: honorsAt.clone().addScaledVector(facing(s.honors.group), 2.7).setY(1.62), target: honorsAt.clone().setY(1.7), fov: 27, lean: 0.03 },
        library: { pos: shelfAt.clone().addScaledVector(facing(s.shelf.group), 2.75).setY(1.5), target: shelfAt.clone().setY(1.2), fov: 40, lean: 0.03, shift: 0.1 },
        map: { pos: mapAt.clone().addScaledVector(facing(s.map.group), 2.6), target: mapAt.clone(), fov: 29, lean: 0.02, shift: 0.13 },
      };
    },
    frame({ t, camera, sound, ready, shot }) {
      // Arriving somewhere: find a book to have just been put back.
      if (ready && shot !== strayShot && SHOTS[shot]) {
        strayShot = shot;
        // Look round from where we're going, and have it slide home once we're there.
        const there = new THREE.PerspectiveCamera(SHOTS[shot].fov, camera.aspect, 0.1, 50);
        there.position.copy(SHOTS[shot].pos);
        there.lookAt(SHOTS[shot].target);
        there.updateMatrixWorld();
        reshelve(t + 3.4, there);
      }
      if (strayStart >= 0) {
        // Out by a hand's width, then home.
        const k = THREE.MathUtils.clamp((t - strayStart - 0.6) / 0.7, 0, 1);
        const out = 0.075 * (1 - k * k * (3 - 2 * k));
        stray.visible = true;
        stray.matrix.copy(strayAt).multiply(new THREE.Matrix4().makeTranslation(0, 0, out));
        stray.matrixAutoUpdate = false;
        stray.matrixWorldNeedsUpdate = true;
        if (k >= 1) {
          if (stray.userData.home !== strayStart) {
            stray.userData.home = strayStart;
            band.shelve(Math.min(1, 3 / (1 + camera.position.distanceTo(v(0, 0, 0).applyMatrix4(strayAt)))));
          }
        }
      }
      hall.tick(t);
      // The great book's leaf turning, heard from wherever you are.
      if (book.turns() !== turnsHeard) {
        turnsHeard = book.turns();
        band.page(Math.min(0.9, 4 / (1 + camera.position.distanceTo(BOOK))));
      }
      // Air from the well stirs the book.
      book.group.position.y = BOOK.y + Math.sin(t * 0.55) * 0.025;
      book.group.rotation.z = Math.sin(t * 0.37) * 0.012;
      book.group.rotation.y = Math.sin(t * 0.23) * 0.03;
      // The lantern, carried down the stair by someone you never quite see.
      const u = ((t + LANTERN_PERIOD * 0.4) % LANTERN_PERIOD) / LANTERN_PERIOD;
      const at = hall.lanternAt(u);
      lantern.position.copy(at);
      lantern.visible = u > 0.01 && u < 0.99;
      LIGHT.uLibLantern.value.copy(lantern.visible ? at : v(0, -1000, 0));
      const stepNo = Math.floor(u * 8 * 24);
      if (stepNo !== lastStep && sound.started) {
        lastStep = stepNo;
        const d = camera.position.distanceTo(at);
        const side = new THREE.Vector3().subVectors(at, camera.position).normalize().dot(new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion));
        if (d < 30) band.footstep(Math.min(1, 6 / (d + 2)), side * 0.7);
      }
    },
    outside(camera) {
      const k = Math.round(camera.position.z / D);
      const rho = Math.hypot(camera.position.x, camera.position.z - k * D);
      return THREE.MathUtils.clamp(1 - (rho - 1.2) / 3.5, 0, 1);
    },
    debug: {
      hall,
      book,
      band,
      shots: SHOTS,
      light: LIGHT,
      galleries: () => hall.copies.length,
      /** For the tests: every walk between two places on the tour, checked for stone along the way. */
      blocked: () => {
        const out: string[] = [];
        const names = [...walls.map((w) => w.id), ...walls.flatMap((w) => w.members ?? [])];
        for (const a of names)
          for (const b of names) {
            if (a === b || !SHOTS[a] || !SHOTS[b]) continue;
            if (!clear(SHOTS[a].pos, SHOTS[b].pos, route(SHOTS[a].pos, SHOTS[b].pos))) out.push(`${a} -> ${b}`);
          }
        return out;
      },
    },
  };
  return kit;
};
