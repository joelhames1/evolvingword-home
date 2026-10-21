// The Living Word: the studio inside a single living cell, lit like a
// cathedral. The light comes in through the cell wall as through stained glass;
// microtubules rise like columns and actin arches overhead; the nucleus glows
// at the far end like a rose window, and in front of it a strand of DNA spells
// out the evolving word. The studio's pieces are spread through the cell, and
// ‹ › drifts you from one to the next: the desk in a calm clearing, the medals
// and diplomas hung in front of a mitochondrion, the library inside the nucleus,
// the map on the cell wall, the shirts on a strand of messenger RNA with
// ribosomes at work on it, and the shoes by a motor protein out for a walk.
import * as THREE from 'three';
import type { Shot } from '../../camera';
import type { Kit, KitModule, Studio, Wall } from '../kit';
import { buildHelix } from './dna';
import { buildMembrane } from './membrane';
import { buildER, buildGolgi, buildMito, buildNucleus, buildVesicles, ribosomeDots } from './organelles';
import { CELL, glass, HAZE_HIGH, motes, pearl, shared, SUN } from './shaders';
import { actin, arch, buildKinesin, clip, column, filament, pad, thread, tubulin } from './skeleton';
import { buildBand } from './sound';

const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

/** A place in the cell, facing back toward the middle: its local +z is the way it faces. */
function spot(p: THREE.Vector3, face: THREE.Vector3) {
  const g = new THREE.Group();
  g.position.copy(p);
  g.rotation.y = Math.atan2(face.x, face.z);
  g.updateMatrixWorld(true);
  return g;
}

// Where everything is. The desk stays where it always is; the rest are spread round it.
const NUCLEUS = { at: v(-6.4, 3.9, -12.2), r: 4.4 };
const HELIX = v(0, 2.85, -4.4);
const MAP_DIR = v(-0.9926, -0.03, 0.12).normalize();
export const STOPS = {
  honors: spot(v(6.3, 0, -0.6), v(-1, 0, 0.25)),
  library: spot(v(-5.6, 1.3, -13.4), v(0.22, 0, 1)),
  map: spot(CELL.center.clone().addScaledVector(MAP_DIR, CELL.radius - 1.6).setY(1.6), v(-MAP_DIR.x, 0, -MAP_DIR.z)),
  line: spot(v(-6.0, 0, 3.4), v(0.1, 0, 1)),
  track: spot(v(3.2, 0, 4.6), v(-0.95, 0, 0.3)),
};
const at = (s: THREE.Group, x: number, y: number, z: number) => s.localToWorld(v(x, y, z));

export const buildKit: KitModule['buildKit'] = ({ quality, scene, log }) => {
  log('WARMING THE CYTOPLASM', 45);
  scene.background = new THREE.Color('#090305');
  scene.fog = new THREE.FogExp2(HAZE_HIGH.clone().multiplyScalar(0.8), 0.028);
  // A little more of the room's reflections, so the medals and the brass catch the light in here.
  scene.environmentIntensity = 0.22;
  const group = new THREE.Group();
  const high = quality === 'high';

  const membrane = buildMembrane(quality);
  // The map hangs against a bright window.
  membrane.window(MAP_DIR, 0.006);
  // Shafts of light: past the strand, down into the nucleus, onto the mitochondrion behind the medals and the shirts.
  membrane.beam(v(0.45, 0.85, -0.3), v(3.6, 0.2, -8.5), 1.0, '#ffc98a');
  membrane.beam(v(-0.1, 0.95, -0.4), NUCLEUS.at, 1.5, '#ffd8a0');
  membrane.beam(v(0.75, 0.6, 0.1), at(STOPS.honors, 0.6, 2.6, -4.2), 0.9, '#ffd09a');
  membrane.beam(v(-0.35, 0.88, 0.3), at(STOPS.line, 1.1, 1.4, 0.4), 0.9, '#ffb07a');
  group.add(membrane.group);

  // Light for the studio's own pieces: the glow of the wall from above, warm, and
  // a key from the brightest windows.
  group.add(new THREE.HemisphereLight('#ffc49a', '#4a1c2a', 0.75));
  const key = new THREE.DirectionalLight('#ffd2a6', 1.15);
  key.position.copy(SUN).multiplyScalar(20);
  group.add(key);
  // And a little warm light on the medals and diplomas, from the mitochondrion behind them.
  const glowing = new THREE.PointLight('#ffb27a', 2.2, 5, 1.5);
  glowing.position.copy(at(STOPS.honors, 0.2, 2.2, 1.2));
  group.add(glowing);

  log('FOLDING THE MEMBRANES', 55);
  const nucleus = buildNucleus(NUCLEUS.at, NUCLEUS.r, quality);
  group.add(nucleus.group);

  // Mitochondria: a great one behind the medals, and others adrift.
  const mitos = [
    { len: 4.8, r: 1.0, at: at(STOPS.honors, 0.6, 3.0, -4.8), turn: STOPS.honors.rotation.y + 0.25, tilt: 0.12 },
    { len: 4.2, r: 0.85, at: v(-9.5, 7.5, 1.5), turn: 0.6, tilt: 0.4 },
    { len: 3.6, r: 0.75, at: v(9.5, 7.8, -6.5), turn: -0.9, tilt: -0.3 },
    { len: 3.2, r: 0.7, at: v(-2.5, -3.8, -7), turn: 1.4, tilt: 0.2 },
    { len: 3.6, r: 0.75, at: v(8.5, -4.5, 8), turn: 0.2, tilt: -0.5 },
    { len: 3.0, r: 0.65, at: v(-11.5, -0.5, -9), turn: -0.4, tilt: 0.6 },
    { len: 3.4, r: 0.7, at: v(3.5, 9.5, 3), turn: 2.0, tilt: 0.2 },
  ].map((d, i) => {
    const m = buildMito(d.len, d.r, 11 + i);
    // Held at its angle; it turns slowly about its own length inside the holder.
    const holder = new THREE.Group();
    holder.position.copy(d.at);
    holder.rotation.set(0, d.turn, d.tilt);
    holder.add(m.group);
    group.add(holder);
    return m;
  });

  // A second, smaller stack past the shirts: where the things made on the line are sent on.
  const golgi2 = buildGolgi(8);
  golgi2.position.copy(at(STOPS.line, 0.2, 4.6, -7.5));
  golgi2.rotation.set(-0.35, 0.4, 0.25);
  golgi2.scale.setScalar(1.1);
  group.add(golgi2);
  const golgi = buildGolgi(5);
  golgi.position.set(7.8, 4.4, -9.8);
  golgi.rotation.set(0.5, -0.7, 0.35);
  golgi.scale.setScalar(1.5);
  group.add(golgi);

  const er = buildER(3, 7.5, 3.6, 3, quality);
  er.position.set(1.8, 6.6, -14.2);
  er.rotation.set(0.35, -0.25, 0.1);
  group.add(er);
  const er2 = buildER(9, 6, 3.2, 2, quality);
  er2.position.copy(at(STOPS.line, 1.0, 3.4, -4.8));
  er2.rotation.set(0, STOPS.line.rotation.y, 0.08);
  group.add(er2);

  log('RAISING THE COLUMNS', 62);
  // The cytoskeleton: columns rising through the cell, arches between them overhead.
  const tub = tubulin();
  const act = actin();
  const columns: THREE.Vector3[] = [];
  const raise = (p: THREE.Vector3, r = 0.085, seed = columns.length) => {
    group.add(column(p.x, p.z, r, tub, seed + 3));
    columns.push(p);
  };
  // Either side of the view past the desk, like a nave.
  for (const [x, z] of [
    [-3.4, -3.4],
    [3.6, -3.0],
    [-6.5, -6.8],
    [6.8, -6.2],
    [9.8, -11],
    [-9.5, -8.5],
    [10.5, 6.5],
    [4.5, -14],
  ])
    raise(v(x, 0, z));
  // And the ones the studio's pieces hang between.
  const hangers: [THREE.Group, number, number][] = [
    [STOPS.honors, -1.75, -0.12],
    [STOPS.honors, 1.9, -0.12],
    [STOPS.map, -1.3, 0.1],
    [STOPS.map, 1.3, 0.1],
    [STOPS.line, -0.18, -0.08],
    [STOPS.line, 2.25, -0.08],
  ];
  for (const [s, x, z] of hangers) raise(at(s, x, 0, z), 0.06);
  // The vaulting: arches from column to column, high up.
  const vault = (a: number, b: number, h: number, rise: number) => {
    const pa = columns[a].clone().setY(h);
    const pb = columns[b].clone().setY(h + (Math.sin(a + b) * 0.8));
    group.add(arch(pa, pb, rise, 0.045, act));
  };
  vault(0, 1, 7.4, 2.4);
  vault(0, 2, 7.0, 2.0);
  vault(1, 3, 7.2, 2.2);
  vault(2, 3, 9.6, 3.0);
  vault(3, 4, 6.6, 2.0);
  vault(2, 5, 6.6, 2.4);
  vault(1, 7, 8.4, 2.6);
  // The bars things hang from, and the threads that hold them.
  const threadMat = glass({ color: '#ffd6a8', edge: '#ffe6c8', core: 0.9, rim: 0.4, power: 1 });
  const bar = (s: THREE.Group, x0: number, x1: number, y: number, z: number) => group.add(filament([at(s, x0, y, z), at(s, (x0 + x1) / 2, y + 0.04, z), at(s, x1, y, z)], 0.028, act, 8));
  const hang = (s: THREE.Group, x: number, y0: number, y1: number, z = 0.012) => group.add(thread(at(s, x, y0, z), at(s, x, y1, z), threadMat));
  // Honors: the diplomas and the medal board on threads from a bar overhead.
  bar(STOPS.honors, -1.75, 1.9, 2.45, -0.04);
  [-0.75, -0.2, 0.35].forEach((x, i) => {
    const top = 1.62 + (i % 2) * 0.04 + 0.18;
    hang(STOPS.honors, x - 0.16, top, 2.43);
    hang(STOPS.honors, x + 0.16, top, 2.43);
  });
  hang(STOPS.honors, 0.56, 1.985, 2.43);
  hang(STOPS.honors, 1.08, 1.985, 2.43);
  // The map: hung the same way, against the wall.
  bar(STOPS.map, -1.3, 1.3, 0.95, -0.05);
  hang(STOPS.map, -0.6, 0.405, 0.93, -0.01);
  hang(STOPS.map, 0.6, 0.405, 0.93, -0.01);
  // The drying line: a bar overhead for its hooks, and the strand running on to the far column.
  bar(STOPS.line, -0.18, 2.25, 2.8, -0.04);
  const ropeMat = pearl({ color: '#ffd8a8', edge: '#fff0d8', glow: 0.35 });
  group.add(
    filament([at(STOPS.line, -0.18, 2.36, -0.02), at(STOPS.line, -0.02, 2.325, 0), at(STOPS.line, 0, 2.32, 0)], 0.005, ropeMat, 5),
    filament([at(STOPS.line, 1.5, 2.29, 0), at(STOPS.line, 1.705, 2.312, 0), at(STOPS.line, 1.95, 2.34, 0), at(STOPS.line, 2.25, 2.4, -0.04)], 0.005, ropeMat, 5),
  );

  // Ribosomes on the line, each building something: a little chain of beads curling out of it.
  const riboBig = pearl({ color: '#ffb36a', edge: '#ffd9a8', glow: 0.25 });
  const riboSmall = pearl({ color: '#ff8f7a', edge: '#ffc0a8', glow: 0.25 });
  const beadMat = pearl({ color: '#9fe3d6', edge: '#e0fff6', glow: 0.35 });
  const sag = (k: number) => v(1.55 * k, 2.32 - 0.03 * k - Math.sin(k * Math.PI) * 0.09, 0);
  const chains: { beads: THREE.InstancedMesh; root: THREE.Vector3; phase: number }[] = [];
  for (const k of [0.5, 0.9, 1.3]) {
    const p = k > 1 ? v(1.95, 2.345, 0) : sag(k);
    const ribo = new THREE.Group();
    const big = new THREE.Mesh(new THREE.SphereGeometry(0.06, 20, 14), riboBig);
    big.scale.set(1.2, 0.9, 1);
    big.position.y = 0.045;
    const small = new THREE.Mesh(new THREE.SphereGeometry(0.042, 16, 12), riboSmall);
    small.scale.set(1.3, 0.8, 1);
    small.position.set(0.01, -0.025, 0.01);
    ribo.add(big, small);
    ribo.position.copy(at(STOPS.line, p.x, p.y, 0.01));
    ribo.rotation.y = STOPS.line.rotation.y;
    group.add(ribo);
    const beads = new THREE.InstancedMesh(new THREE.SphereGeometry(0.017, 10, 8), beadMat, 14);
    chains.push({ beads, root: at(STOPS.line, p.x, p.y + 0.09, 0.03), phase: k * 5 });
    group.add(beads);
  }

  // Pads for the pieces to rest on: the desk's clearing, the shelf in the nucleus, the shoes.
  const deskPad = pad(3.0, '#24100f', '#ff7a4a');
  deskPad.position.set(0, 0, -0.7);
  const shelfPad = pad(1.35, '#2a1838', '#9a7aff');
  shelfPad.position.copy(STOPS.library.position).add(v(0, 0, 0.2));
  const shoePad = pad(0.8, '#2a1216', '#ff9a6a');
  shoePad.position.copy(at(STOPS.track, 0, 0, 0.25));
  group.add(deskPad, shelfPad, shoePad);

  // The track the kinesin walks, behind the shoes, and the kinesin walking it.
  // It runs right behind the shoes.
  const along = (k: number) => at(STOPS.track, -2.8 + 5.6 * k, 0.24, -0.55 - 0.25 * k);
  // (It starts a little before the kinesin does, so it never crosses the view past the desk.)
  const [trackA, trackB] = clip(along(-0.12), along(4));
  group.add(filament([trackA, trackA.clone().lerp(trackB, 0.5).add(v(0, 0.02, 0)), trackB], 0.05, tub));
  // Walking past the shoes, in from one side and off at the other.
  const kinesin = buildKinesin(along(0).add(v(0, 0.05, 0)), along(1.3).add(v(0, 0.05, 0)), { scale: 2.0, cargo: 0.24 });
  group.add(kinesin.group);
  // Another, high up, walking a long microtubule across the cell.
  const [highA, highB] = clip(v(10.5, 5.2, -14), v(10, 6.2, 12));
  group.add(filament([highA, highA.clone().lerp(highB, 0.5), highB], 0.08, tub));
  const kinesin2 = buildKinesin(highA.clone().lerp(highB, 0.2).add(v(0, 0.09, 0)), highA.clone().lerp(highB, 0.8).add(v(0, 0.09, 0)), { scale: 2.2, cargo: 0.3, color: '#b6a6ff' });
  group.add(kinesin2.group);

  log('LETTING THE VESICLES GO', 70);
  const vesicles = buildVesicles(high ? 70 : 36, 21);
  group.add(vesicles.mesh);
  const dust = motes(high ? 2600 : 1000, { radius: CELL.radius * 0.92, size: 0.012, rise: 0.04, color: '#ffc08a', color2: '#9fe8e0', seed: 5 });
  const sparks = motes(high ? 700 : 280, { radius: CELL.radius * 0.85, size: 0.03, rise: 0.02, color: '#ffd9a0', color2: '#ff9aa8', seed: 9 });
  group.add(dust, sparks);
  // Free ribosomes, scattered in loose clusters.
  const free: number[] = [];
  for (let c = 0; c < (high ? 50 : 24); c++) {
    const cx = (Math.sin(c * 12.9898) * 0.5) * 22;
    const cy = 2 + Math.sin(c * 4.1414) * 8;
    const cz = -4 + Math.cos(c * 7.233) * 11;
    for (let i = 0; i < 12; i++) free.push(cx + Math.sin(i * 2.4 + c) * 0.35, cy + Math.cos(i * 1.7 + c) * 0.25, cz + Math.sin(i * 3.1 + c * 2) * 0.35);
  }
  const freeGeo = new THREE.BufferGeometry();
  freeGeo.setAttribute('position', new THREE.Float32BufferAttribute(free, 3));
  group.add(new THREE.Points(freeGeo, ribosomeDots('#ffcf8a', 0.045)));

  log('SPELLING IT OUT', 75);
  const helix = buildHelix();
  helix.group.position.copy(HELIX);
  group.add(helix.group);

  // The cell, from outside: a lantern in the dark.
  const vista: Shot = { pos: v(19, 11, 37), target: v(0, 1.2, -4), fov: 46, lean: 0.3 };

  // --- the studio, spread through the cell ------------------------------------------
  const put = (o: THREE.Object3D, s: THREE.Group, turn = 0) => {
    o.position.copy(s.position);
    o.rotation.set(0, s.rotation.y + turn, 0);
  };
  const arrange = (st: Studio) => {
    put(st.honors.group, STOPS.honors);
    put(st.shelf.group, STOPS.library);
    put(st.map.group, STOPS.map);
    // The line is built along x; its shirts face +z like everything else here.
    const before = st.line.group.matrixWorld.clone();
    put(st.line.group, STOPS.line);
    st.line.group.updateMatrixWorld(true);
    const moved = st.line.group.matrixWorld.clone().multiply(before.invert());
    for (const it of st.line.items) it.focus.applyMatrix4(moved);
    st.line.center.applyMatrix4(moved);
    st.shoes.group.position.copy(at(STOPS.track, 0.05, 0, 0.3));
    st.shoes.group.rotation.y = STOPS.track.rotation.y + 0.5;
  };

  // The places ‹ › drifts between, and the close-ups that belong to each.
  const walls: Wall[] = [
    { id: 'desk', name: 'The desk' },
    { id: 'honors', name: 'Medals & diplomas', members: ['diplomas', 'medals'] },
    { id: 'library', name: 'The library' },
    { id: 'places', name: 'The map', members: ['map'] },
    { id: 'works', name: 'The projects', members: ['projects'] },
    { id: 'track', name: 'The shoes', members: ['shoes'] },
  ];
  const closeups = (): Record<string, Shot> => ({
    // A step back from the map, with the wall's light round it.
    places: { pos: at(STOPS.map, 0.5, 0.2, 3.3), target: at(STOPS.map, 0.05, -0.1, 0), fov: 50, lean: 0.06 },
    works: { pos: at(STOPS.line, 1.3, 1.85, 3.0), target: at(STOPS.line, 1.05, 1.75, 0), fov: 50, lean: 0.06 },
    track: { pos: at(STOPS.track, 2.3, 1.05, 1.7), target: at(STOPS.track, -0.4, 0.4, -0.5), fov: 50, lean: 0.05 },
  });

  // What to click for the nucleus and the great mitochondrion: plain shapes, cheap to test.
  const hidden = new THREE.MeshBasicMaterial({ visible: false });
  const nucleusHit = new THREE.Mesh(new THREE.SphereGeometry(NUCLEUS.r, 24, 12), hidden);
  nucleusHit.position.copy(NUCLEUS.at);
  const mitoHit = new THREE.Mesh(new THREE.CapsuleGeometry(1.0, 2.8, 4, 12).rotateZ(Math.PI / 2), hidden);
  mitos[0].group.parent!.add(mitoHit);
  group.add(nucleusHit);
  const tmpM = new THREE.Matrix4();
  const tmpV = v(0, 0, 0);
  const UP = v(0, 1, 0);

  const kit: Kit = {
    objects: [group],
    board: helix,
    shots: {
      vista,
      // Out across the cell, past the Golgi and the mitochondria to the far wall.
      window: { pos: v(1.5, 1.75, -0.5), target: v(10, 4.6, -10.5), fov: 52, lean: 0.06 },
      board: { pos: v(0, 1.95, 0.5), target: v(0, 3.05, -4.4), fov: 42, lean: 0.04 },
    },
    // In from the dark, through the cell wall, and down to the desk.
    intro: { via: [v(12, 7.4, 26), v(4.5, 3.6, 13.5), v(1.2, 2.2, 6.5)], duration: 11, lines: ['EVOLVING WORD', 'IN THE BEGINNING WAS THE WORD', 'WHERE WE MAKE THINGS TOGETHER'] },
    tagline: 'A LITTLE STUDIO IN A LIVING CELL.',
    arrange,
    closeups,
    walls,
    band: buildBand(),
    wire(w) {
      const touch = (object: THREE.Object3D, label: string, run: () => void, when?: () => boolean) => w.touch({ object, label, noGlow: true, onClick: run, when });
      // The kinesin by the shoes: say hello, and it hurries along.
      touch(kinesin.group, 'Kinesin, out for a walk', () => {
        kinesin.hurry();
        w.card('Out for a walk', 'Kinesin', ['A motor protein. It carries things across the cell on its two feet, one step at a time, and never trips.', 'It has never needed the shoes. It likes to have them near.']);
      });
      // The nucleus and the great mitochondrion take you to what's kept in them.
      touch(nucleusHit, 'The library of genes', () => w.goTo('library'), () => w.current() !== 'library');
      touch(mitoHit, 'Medals & diplomas', () => w.goTo('honors'), () => !['honors', 'medals', 'diplomas'].includes(w.current()));
    },
    frame({ t, dt: rawDt, camera }) {
      // The first frame's step can come out a hair below zero; nothing here should ever run backward.
      const dt = Math.max(0, rawDt);
      shared.uTime.value = t;
      // Thinner haze looking in from outside, so the lantern shows what's in it.
      const inside = camera.position.distanceTo(CELL.center) < CELL.radius;
      shared.uHazeK.value = inside ? 0.05 : 0.012;
      membrane.outside.visible = !inside;
      nucleus.tick(t);
      mitos.forEach((m) => m.tick(t));
      vesicles.tick(t, dt, camera);
      kinesin.tick(t, dt);
      kinesin2.tick(t, dt);
      helix.group.position.y = HELIX.y + Math.sin(t * 0.4) * 0.03;
      golgi.rotation.y = -0.7 + Math.sin(t * 0.05) * 0.08;
      // The chains coming out of the ribosomes, curling as they fold.
      const m4 = tmpM;
      const p = tmpV;
      for (const c of chains) {
        for (let i = 0; i < 14; i++) {
          const k = i / 13;
          const a = k * 5 + Math.sin(t * 0.8 + c.phase) * 0.8;
          p.set(Math.sin(a) * 0.05 * (1 + k), k * 0.32 + Math.sin(t * 1.3 + i + c.phase) * 0.01, Math.cos(a) * 0.05 * (1 + k));
          p.applyAxisAngle(UP, STOPS.line.rotation.y).add(c.root);
          m4.makeTranslation(p.x, p.y, p.z);
          c.beads.setMatrixAt(i, m4);
        }
        c.beads.instanceMatrix.needsUpdate = true;
      }
    },
    // Closer to the wall, the louder the world outside it.
    outside: (camera) => THREE.MathUtils.clamp((camera.position.distanceTo(CELL.center) - 9) / 5, 0, 1),
    debug: { nucleus, helix, kinesin, mitos, membrane, stops: STOPS },
  };
  return kit;
};
