// Our sleeper car, inside and out. Inside: the compartment, paneled in
// mahogany with a boxwood line round every panel, the made-up bunk along one
// end, the fold-down table under the window, velvet curtains, brass lamps, the
// luggage rack over the door; and through the door the corridor, its windows
// on the other side of the train, a brass rail under them, a lamp at every
// door. Outside: green lacquer with a gold line, a curved roof, the bogies.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { canvas, glow, texture } from '../../textures';
import { carName, carpet, ceiling, dado, livery, panel, plaid, poster } from './paint';
import { BUNK, CAR, ceilingAt, COMPARTMENT_STEP, CORRIDOR, CORRIDOR_WINDOWS, DOOR, PARTITION, ROOM, TABLE, WINDOW, WINDOW_X } from './plan';

const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

/** A rounded rectangle, as a path. */
function roundRect<T extends THREE.Path>(p: T, x0: number, y0: number, x1: number, y1: number, r: number) {
  p.moveTo(x0 + r, y0);
  p.lineTo(x1 - r, y0);
  p.quadraticCurveTo(x1, y0, x1, y0 + r);
  p.lineTo(x1, y1 - r);
  p.quadraticCurveTo(x1, y1, x1 - r, y1);
  p.lineTo(x0 + r, y1);
  p.quadraticCurveTo(x0, y1, x0, y1 - r);
  p.lineTo(x0, y0 + r);
  p.quadraticCurveTo(x0, y0, x0 + r, y0);
  return p;
}

/** A flat shape laid into the car: `to` takes its 2D coordinates (meters) to the car's; uvs stay in meters. */
function shaped(shape: THREE.Shape, to: (a: number, b: number) => THREE.Vector3, segments = 8) {
  const geo = new THREE.ShapeGeometry(shape, segments);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const w = to(p.getX(i), p.getY(i));
    p.setXYZ(i, w.x, w.y, w.z);
  }
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  return geo;
}

function mesh(geo: THREE.BufferGeometry, mat: THREE.Material, opts: { cast?: boolean; receive?: boolean } = {}) {
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = opts.cast ?? false;
  m.receiveShadow = opts.receive ?? true;
  return m;
}

/** Adds a mesh at a place and hands it back. */
function put<T extends THREE.Object3D>(parent: THREE.Object3D, o: T, at: THREE.Vector3) {
  o.position.copy(at);
  parent.add(o);
  return o;
}

function box(w: number, h: number, d: number, mat: THREE.Material, x: number, y: number, z: number) {
  const m = mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  return m;
}

/** A rod from a to b. */
function rod(a: THREE.Vector3, b: THREE.Vector3, r: number, mat: THREE.Material, sides = 10) {
  const m = mesh(new THREE.CylinderGeometry(r, r, a.distanceTo(b), sides), mat);
  m.position.copy(a).add(b).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(v(0, 1, 0), b.clone().sub(a).normalize());
  return m;
}

/** The ceiling's curve across the car, as a strip along x from x0 to x1 over z from za to zb, facing down. */
function ceilingStrip(x0: number, x1: number, za: number, zb: number, n = 18) {
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  let arc = 0;
  let prev = v(0, ceilingAt(za), za);
  for (let i = 0; i <= n; i++) {
    const z = za + ((zb - za) * i) / n;
    const y = ceilingAt(z) - 0.002;
    arc += prev.distanceTo(v(0, y, z));
    prev = v(0, y, z);
    pos.push(x0, y, z, x1, y, z);
    uv.push(x0, arc, x1, arc);
    if (i < n) {
      const a = i * 2;
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  // Facing down, into the room.
  const nrm = geo.attributes.normal;
  if (nrm.getY(0) > 0) {
    for (let i = 0; i < idx.length; i += 3) [idx[i + 1], idx[i + 2]] = [idx[i + 2], idx[i + 1]];
    geo.setIndex(idx);
    geo.computeVertexNormals();
  }
  return geo;
}

export interface Car {
  group: THREE.Group;
  /** The window pane: lowered by `setWindow`. */
  glass: THREE.Mesh;
  /** What to click to drop the window or put it back up. */
  windowHit: THREE.Object3D;
  /** 0 shut .. 1 dropped open. */
  setWindow(k: number): void;
  /** Lamps on (1), off (0), or flickering in between. */
  setLamps(k: number): void;
  /** Wind through the open window, 0..1, for the curtains; the time for their flutter. */
  tick(t: number, wind: number, sway: number): void;
  /** Where the studio's pieces go. */
  spots: {
    hooks: THREE.Vector3[];
    route: THREE.Vector3;
  };
  lights: {
    ceiling: THREE.PointLight;
    reading: THREE.SpotLight;
    corridor: THREE.PointLight[];
    moon: THREE.DirectionalLight;
    sweep: THREE.PointLight;
  };
  materials: Record<string, THREE.Material>;
}

export function buildCar(): Car {
  const group = new THREE.Group();
  group.name = 'car';

  // --- materials ---------------------------------------------------------------------
  const panelMat = new THREE.MeshStandardMaterial({ map: panel(), roughness: 0.42, metalness: 0.02 });
  const dadoMat = new THREE.MeshStandardMaterial({ map: dado(), roughness: 0.5 });
  const ceilMat = new THREE.MeshStandardMaterial({ map: ceiling(), roughness: 0.85 });
  const trim = new THREE.MeshStandardMaterial({ color: '#3a170a', roughness: 0.38 });
  const brass = new THREE.MeshStandardMaterial({ color: '#c49a52', roughness: 0.28, metalness: 0.92 });
  const darkBrass = new THREE.MeshStandardMaterial({ color: '#8a6a34', roughness: 0.4, metalness: 0.85 });
  const carpetMat = new THREE.MeshStandardMaterial({ map: carpet('room'), roughness: 0.95 });
  const runnerMat = new THREE.MeshStandardMaterial({ map: carpet('runner'), roughness: 0.95 });
  const corridorFloor = new THREE.MeshStandardMaterial({ color: '#3a2216', roughness: 0.6 });
  const sheet = new THREE.MeshStandardMaterial({ color: '#d6cfc2', roughness: 0.92 });
  const blanket = new THREE.MeshStandardMaterial({ map: plaid(), roughness: 0.95 });
  const velvet = new THREE.MeshStandardMaterial({ color: '#5c1622', roughness: 0.82, side: THREE.DoubleSide });
  const leather = new THREE.MeshStandardMaterial({ color: '#5a3018', roughness: 0.6 });
  const paint = new THREE.MeshStandardMaterial({ map: livery(), roughness: 0.32, metalness: 0.25 });
  (paint.map as THREE.Texture).repeat.set(0.2, 0.8);
  const roofMat = new THREE.MeshStandardMaterial({ color: '#2c2f33', roughness: 0.7, metalness: 0.3 });
  const iron = new THREE.MeshStandardMaterial({ color: '#16171a', roughness: 0.75, metalness: 0.4 });
  const gold = new THREE.MeshStandardMaterial({ color: '#c9a35a', roughness: 0.35, metalness: 0.8 });
  const reveal = new THREE.MeshStandardMaterial({ color: '#3a170a', roughness: 0.4, side: THREE.DoubleSide });
  const bulb = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffd9a0').multiplyScalar(2.6) });
  const dome = new THREE.MeshStandardMaterial({ color: '#f1e3c8', emissive: new THREE.Color('#ffcf8a'), emissiveIntensity: 1.6, roughness: 0.5 });
  const night = new THREE.MeshBasicMaterial({ color: new THREE.Color('#4f6dff').multiplyScalar(1.6) });
  const blind = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffb86a').multiplyScalar(0.85) });
  const blindDark = new THREE.MeshStandardMaterial({ color: '#2a2018', roughness: 0.9 });

  // --- the compartment's shell ---------------------------------------------------------
  const W = WINDOW;
  const R = 0.09;
  const { x0, x1, z0, z1 } = ROOM;
  // The window wall: dado up to the sill line, paneling above with the window in it.
  const sill = W.y0 - 0.04;
  const lower = new THREE.Shape();
  lower.moveTo(x0, 0).lineTo(x1, 0).lineTo(x1, sill).lineTo(x0, sill).closePath();
  group.add(mesh(shaped(lower, (a, b) => v(a, b, z0)), dadoMat));
  const upper = new THREE.Shape();
  upper.moveTo(x0, sill).lineTo(x1, sill).lineTo(x1, CAR.eaves).lineTo(x0, CAR.eaves).closePath();
  upper.holes.push(roundRect(new THREE.Path(), W.x0, W.y0, W.x1, W.y1, R));
  group.add(mesh(shaped(upper, (a, b) => v(a, b, z0)), panelMat));
  group.add(box(x1 - x0, 0.035, 0.03, trim, 0, sill, z0 + 0.012));
  // The end walls, up to the ceiling's curve.
  const endWall = (atX: number, facing: 1 | -1) => {
    const s = new THREE.Shape();
    const n = 10;
    // In shape coordinates a = −z (left wall) or z (right wall), so the wall faces into the room.
    const za = (a: number) => (facing > 0 ? -a : a);
    const pts: THREE.Vector2[] = [];
    const aFrom = facing > 0 ? -z1 : z0;
    const aTo = facing > 0 ? -z0 : z1;
    pts.push(new THREE.Vector2(aFrom, 0), new THREE.Vector2(aTo, 0));
    for (let i = 0; i <= n; i++) {
      const a = aTo + ((aFrom - aTo) * i) / n;
      pts.push(new THREE.Vector2(a, ceilingAt(za(a))));
    }
    s.setFromPoints(pts);
    s.closePath();
    const top = shaped(s, (a, b) => v(atX, b, za(a)));
    return top;
  };
  group.add(mesh(endWall(x0, 1), panelMat));
  group.add(mesh(endWall(x1, -1), panelMat));
  // The partition, with the door in it: its compartment side.
  const part = new THREE.Shape();
  part.moveTo(-x1, 0).lineTo(-x0, 0).lineTo(-x0, CAR.ceiling).lineTo(-x1, CAR.ceiling).closePath();
  const doorHole = new THREE.Path();
  doorHole.moveTo(-DOOR.x1, 0).lineTo(-DOOR.x0, 0).lineTo(-DOOR.x0, DOOR.y1).lineTo(-DOOR.x1, DOOR.y1).closePath();
  part.holes.push(doorHole);
  group.add(mesh(shaped(part, (a, b) => v(-a, b, z1)), panelMat));
  // Floor and ceiling.
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0), carpetMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, 0, (z0 + z1) / 2);
  floor.receiveShadow = true;
  (carpetMat.map as THREE.Texture).repeat.set((x1 - x0) / 0.5, (z1 - z0) / 0.5);
  group.add(floor);
  group.add(mesh(ceilingStrip(x0, x1, z0, z1), ceilMat));
  // A brass-capped skirting all round, and a cornice where the walls meet the ceiling.
  for (const [w, x, z, ry] of [
    [x1 - x0, 0, z0 + 0.012, 0],
    [x1 - x0, 0, z1 - 0.012, 0],
    [z1 - z0, x0 + 0.012, (z0 + z1) / 2, Math.PI / 2],
    [z1 - z0, x1 - 0.012, (z0 + z1) / 2, Math.PI / 2],
  ] as const) {
    const sk = box(w, 0.1, 0.025, trim, x, 0.05, z);
    sk.rotation.y = ry;
    group.add(sk);
  }
  group.add(box(x1 - x0, 0.05, 0.05, trim, 0, ceilingAt(z1) - 0.03, z1 - 0.025));

  // --- the window: its brass frame, the pane that drops, the strap ---------------------
  const ring = new THREE.Shape();
  roundRect(ring, W.x0 - 0.045, W.y0 - 0.045, W.x1 + 0.045, W.y1 + 0.045, R + 0.045);
  ring.holes.push(roundRect(new THREE.Path(), W.x0, W.y0, W.x1, W.y1, R));
  const ringGeo = shaped(ring, (a, b) => v(a, b, z0 + 0.004));
  group.add(mesh(ringGeo, brass));
  // The reveal through the wall's thickness.
  for (const [a, b, c, d] of [
    [v(W.x0, W.y0 + R, z0), v(W.x0, W.y1 - R, z0), v(W.x0, W.y1 - R, -CAR.outer), v(W.x0, W.y0 + R, -CAR.outer)],
    [v(W.x1, W.y1 - R, z0), v(W.x1, W.y0 + R, z0), v(W.x1, W.y0 + R, -CAR.outer), v(W.x1, W.y1 - R, -CAR.outer)],
    [v(W.x0 + R, W.y1, z0), v(W.x1 - R, W.y1, z0), v(W.x1 - R, W.y1, -CAR.outer), v(W.x0 + R, W.y1, -CAR.outer)],
    [v(W.x1 - R, W.y0, z0), v(W.x0 + R, W.y0, z0), v(W.x0 + R, W.y0, -CAR.outer), v(W.x1 - R, W.y0, -CAR.outer)],
  ]) {
    const g = new THREE.BufferGeometry().setFromPoints([a, b, c, a, c, d]);
    g.computeVertexNormals();
    group.add(mesh(g, reveal));
  }
  // The pane: a little smaller than the opening, in a thin brass channel, a rail along its top.
  const pane = new THREE.Group();
  const glassShape = roundRect(new THREE.Shape(), W.x0 + 0.01, W.y0 + 0.01, W.x1 - 0.01, W.y1 - 0.01, R - 0.01);
  const glass = mesh(
    shaped(glassShape, (a, b) => v(a, b, -1.59)),
    // Dark, and unlit: lit like a surface, glass greys out the whole night behind it. It only darkens the
    // view a little; the lamps' reflections in it are placed behind it (see the kit).
    new THREE.MeshBasicMaterial({ color: '#0a0e14', transparent: true, opacity: 0.14, depthWrite: false }),
    { receive: false },
  );
  glass.renderOrder = 3;
  pane.add(glass);
  const rail = box(W.x1 - W.x0 - 0.06, 0.035, 0.03, brass, WINDOW_X, W.y1 - 0.028, -1.585);
  pane.add(rail);
  // The leather strap, to pull it down by.
  const strap = box(0.045, 0.15, 0.008, leather, WINDOW_X, W.y1 - 0.11, -1.565);
  pane.add(strap);
  const buckle = box(0.055, 0.025, 0.012, brass, WINDOW_X, W.y1 - 0.18, -1.562);
  pane.add(buckle);
  group.add(pane);
  // Something generous to click: the whole opening.
  const windowHit = new THREE.Mesh(new THREE.PlaneGeometry(W.x1 - W.x0, W.y1 - W.y0), new THREE.MeshBasicMaterial({ visible: false }));
  windowHit.position.set(WINDOW_X, (W.y0 + W.y1) / 2, z0 + 0.02);
  group.add(windowHit);

  // The pelmet over the window, the curtains gathered either side, their tie-backs.
  group.add(box(W.x1 - W.x0 + 0.5, 0.09, 0.13, trim, WINDOW_X, W.y1 + 0.075, z0 + 0.065));
  group.add(box(W.x1 - W.x0 + 0.5, 0.012, 0.135, brass, WINDOW_X, W.y1 + 0.03, z0 + 0.067));
  const curtainGeo = (w: number, h: number) => new THREE.PlaneGeometry(w, h, 10, 18);
  const curtains: { mesh: THREE.Mesh; base: Float32Array; side: number }[] = [];
  for (const side of [-1, 1]) {
    const g = curtainGeo(0.3, 1.04);
    const p = g.attributes.position;
    // Gathered folds, deeper toward the bottom where they hang free below the tie-back.
    // Gathered in at the tie-back (a little below the middle), falling in folds above and below it.
    const tieY = 1.14 - (W.y1 - 0.47);
    for (let i = 0; i < p.count; i++) {
      const px = p.getX(i);
      const py = p.getY(i);
      const pinch = 1 - 0.55 * Math.exp(-Math.pow((py - tieY) / 0.16, 2));
      const x = px * pinch + side * (1 - pinch) * 0.04;
      p.setXYZ(i, x, py, Math.sin(px * 42) * 0.022 * pinch + Math.sin(px * 17 + 1) * 0.01 + (1 - pinch) * 0.03);
    }
    g.computeVertexNormals();
    const m = mesh(g, velvet, { cast: false });
    m.position.set(side < 0 ? W.x0 - 0.06 : W.x1 + 0.06, W.y1 - 0.47, z0 + 0.07);
    group.add(m);
    curtains.push({ mesh: m, base: Float32Array.from(p.array as Float32Array), side });
    // The tie-back: a gold rope round the gathered curtain.
    const tie = mesh(new THREE.TorusGeometry(0.07, 0.011, 8, 20), gold);
    tie.position.set(m.position.x + side * 0.04, 1.14, z0 + 0.09);
    tie.rotation.x = Math.PI / 2;
    tie.scale.set(1.05, 0.62, 1);
    group.add(tie);
  }

  // --- the table under the window --------------------------------------------------------
  const T = TABLE;
  const tableTop = mesh(new RoundedBoxGeometry(T.x1 - T.x0, 0.034, T.z1 - T.z0, 3, 0.012), new THREE.MeshStandardMaterial({ map: dado(), roughness: 0.32 }), { cast: true });
  ((tableTop.material as THREE.MeshStandardMaterial).map as THREE.Texture).repeat.set(1.2, 1.5);
  tableTop.position.set((T.x0 + T.x1) / 2, T.y - 0.017, (T.z0 + T.z1) / 2);
  group.add(tableTop);
  group.add(rod(v(T.x0 + 0.01, T.y - 0.015, T.z1 + 0.004), v(T.x1, T.y - 0.015, T.z1 + 0.004), 0.008, brass, 8));
  // Two brass brackets under it, folded out to hold it.
  for (const bx of [-0.3, 1.18]) {
    const s = new THREE.Shape();
    s.moveTo(0, 0).lineTo(0.55, 0).lineTo(0, -0.42).closePath();
    const geo = new THREE.ExtrudeGeometry(s, { depth: 0.02, bevelEnabled: false });
    geo.rotateY(-Math.PI / 2);
    const br = mesh(geo, darkBrass);
    br.position.set(bx + 0.01, T.y - 0.035, z0);
    group.add(br);
  }

  // --- the bunk --------------------------------------------------------------------------
  const B = BUNK;
  const bunkW = B.x1 - B.x0;
  const bunkL = B.z1 - B.z0;
  const bunk = new THREE.Group();
  bunk.add(box(bunkW, 0.08, bunkL, trim, (B.x0 + B.x1) / 2, 0.42, (B.z0 + B.z1) / 2));
  // The front rail, and the posts at its ends.
  bunk.add(box(0.03, 0.2, bunkL, trim, B.x1 - 0.015, 0.52, (B.z0 + B.z1) / 2));
  bunk.add(box(0.04, 0.42, 0.04, trim, B.x1 - 0.02, 0.21, B.z0 + 0.03));
  bunk.add(box(0.04, 0.42, 0.04, trim, B.x1 - 0.02, 0.21, B.z1 - 0.03));
  // A brass rail along the front, to hold on to.
  bunk.add(rod(v(B.x1 - 0.005, 0.64, B.z0 + 0.06), v(B.x1 - 0.005, 0.64, B.z1 - 0.06), 0.009, brass));
  // Mattress, sheet, the blanket turned down, and the pillow at the corridor end.
  const mattress = mesh(new RoundedBoxGeometry(bunkW - 0.05, 0.14, bunkL - 0.04, 3, 0.04), sheet, { cast: true });
  mattress.position.set((B.x0 + B.x1) / 2 - 0.01, 0.53, (B.z0 + B.z1) / 2);
  bunk.add(mattress);
  const blanketGeo = new RoundedBoxGeometry(bunkW - 0.02, 0.05, 1.2, 3, 0.02);
  const blanketMesh = mesh(blanketGeo, blanket, { cast: true });
  blanketMesh.position.set((B.x0 + B.x1) / 2 - 0.01, 0.6, B.z0 + 0.62);
  bunk.add(blanketMesh);
  // The sheet folded back over the blanket's top edge.
  const fold = mesh(new RoundedBoxGeometry(bunkW - 0.015, 0.06, 0.16, 2, 0.02), sheet);
  fold.position.set((B.x0 + B.x1) / 2 - 0.01, 0.615, B.z0 + 1.2);
  bunk.add(fold);
  // A corner of the blanket turned back, a triangle of sheet showing.
  const corner = new THREE.Shape();
  corner.moveTo(0, 0).lineTo(0.32, 0).lineTo(0, 0.32).closePath();
  const cornerMesh = mesh(shaped(corner, (a, b) => v(B.x1 - 0.04 - a, 0.627, B.z0 + 1.14 - b)), sheet);
  bunk.add(cornerMesh);
  const pillow = mesh(new RoundedBoxGeometry(bunkW - 0.16, 0.12, 0.36, 4, 0.05), sheet, { cast: true });
  pillow.position.set((B.x0 + B.x1) / 2 - 0.02, 0.66, B.z1 - 0.26);
  pillow.rotation.x = -0.12;
  bunk.add(pillow);
  group.add(bunk);

  // The reading lamp over the head of the bunk: a brass arm and a little tulip shade.
  const readAt = v(x0 + 0.17, 1.33, 0.02);
  group.add(rod(v(x0, 1.42, 0.02), v(x0 + 0.15, 1.42, 0.02), 0.008, brass));
  group.add(rod(v(x0 + 0.15, 1.42, 0.02), readAt.clone().add(v(0, 0.04, 0)), 0.007, brass));
  const tulip = mesh(new THREE.CylinderGeometry(0.03, 0.06, 0.08, 18, 1, true), new THREE.MeshStandardMaterial({ color: '#f3dcae', emissive: new THREE.Color('#ffc477'), emissiveIntensity: 0.9, roughness: 0.5, side: THREE.DoubleSide }));
  tulip.position.copy(readAt);
  group.add(tulip);
  const readBulb = mesh(new THREE.SphereGeometry(0.018, 10, 8), bulb);
  readBulb.position.copy(readAt).add(v(0, -0.02, 0));
  group.add(readBulb);
  put(group, mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.012, 16), brass), v(x0 + 0.006, 1.42, 0.02)).rotation.z = Math.PI / 2;

  // --- the ceiling lamp, the night light, the luggage rack, the coat hooks ---------------
  const lampAt = v(0.1, ceilingAt(-0.65), -0.65);
  put(group, mesh(new THREE.CylinderGeometry(0.09, 0.11, 0.025, 24), brass), lampAt.clone().add(v(0, -0.012, 0)));
  const shade = mesh(new THREE.SphereGeometry(0.13, 24, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), dome, { receive: false });
  shade.position.copy(lampAt).add(v(0, -0.022, 0));
  group.add(shade);
  put(group, mesh(new THREE.TorusGeometry(0.132, 0.008, 6, 32), brass), lampAt.clone().add(v(0, -0.022, 0))).rotation.x = Math.PI / 2;
  const nightLight = mesh(new THREE.SphereGeometry(0.035, 16, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), night, { receive: false });
  nightLight.position.set(-0.3, ceilingAt(0.1) - 0.004, 0.1);
  group.add(nightLight);

  // The luggage rack over the door: brass rails on brackets, a suitcase and a hat box on it.
  const rackY = 2.02;
  for (let i = 0; i < 4; i++) group.add(rod(v(x0 + 0.04, rackY, z1 - 0.04 - i * 0.075), v(x1 - 0.04, rackY, z1 - 0.04 - i * 0.075), 0.008, brass));
  for (const bx of [x0 + 0.25, 0, x1 - 0.25]) {
    group.add(rod(v(bx, rackY + 0.12, z1 - 0.005), v(bx, rackY, z1 - 0.24), 0.008, brass));
    group.add(rod(v(bx, rackY, z1 - 0.005), v(bx, rackY, z1 - 0.24), 0.008, brass));
  }
  const suitcase = mesh(new RoundedBoxGeometry(0.66, 0.2, 0.36, 3, 0.03), leather, { cast: true });
  suitcase.position.set(-0.55, rackY + 0.11, z1 - 0.2);
  group.add(suitcase);
  for (const dx of [-0.18, 0.18]) group.add(box(0.035, 0.205, 0.365, new THREE.MeshStandardMaterial({ color: '#2a1608', roughness: 0.7 }), -0.55 + dx, rackY + 0.11, z1 - 0.2));
  const hatbox = mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.18, 24), new THREE.MeshStandardMaterial({ color: '#2d3d52', roughness: 0.7 }), { cast: true });
  hatbox.position.set(0.25, rackY + 0.1, z1 - 0.19);
  group.add(hatbox);

  // Coat hooks on the right end wall, over the bookshelf: a rail and four double hooks.
  const hookY = 1.88;
  const hooks: THREE.Vector3[] = [];
  group.add(box(0.025, 0.07, 0.8, trim, x1 - 0.012, hookY + 0.02, -0.29));
  for (let i = 0; i < 4; i++) {
    const z = -0.55 + i * 0.175;
    group.add(rod(v(x1 - 0.02, hookY, z), v(x1 - 0.085, hookY + 0.02, z), 0.006, brass));
    group.add(rod(v(x1 - 0.02, hookY + 0.04, z), v(x1 - 0.06, hookY + 0.1, z), 0.005, brass));
    const knob = mesh(new THREE.SphereGeometry(0.01, 8, 6), brass);
    knob.position.set(x1 - 0.087, hookY + 0.024, z);
    group.add(knob);
    hooks.push(v(x1 - 0.075, hookY + 0.008, z));
  }

  // A poster on the partition between the bunk and the door, in a thin brass frame.
  const posterMesh = mesh(new THREE.PlaneGeometry(0.34, 0.453), new THREE.MeshStandardMaterial({ map: poster(), roughness: 0.6 }));
  posterMesh.position.set(-0.12, 1.42, z1 - 0.012);
  posterMesh.rotation.y = Math.PI;
  group.add(posterMesh);
  group.add(box(0.37, 0.48, 0.008, brass, -0.12, 1.42, z1 - 0.006));

  // The door frame, both sides, and our number.
  for (const zz of [z1 - 0.01, CORRIDOR.z0 + 0.01]) {
    group.add(box(0.05, DOOR.y1, 0.03, trim, DOOR.x0 - 0.02, DOOR.y1 / 2, zz));
    group.add(box(0.05, DOOR.y1, 0.03, trim, DOOR.x1 + 0.02, DOOR.y1 / 2, zz));
    group.add(box(DOOR.x1 - DOOR.x0 + 0.09, 0.06, 0.03, trim, (DOOR.x0 + DOOR.x1) / 2, DOOR.y1 + 0.03, zz));
  }
  // The door's own edge, slid back into its pocket.
  group.add(box(0.03, DOOR.y1 - 0.02, PARTITION - 0.012, trim, DOOR.x0 + 0.015, DOOR.y1 / 2, z1 + PARTITION / 2));
  group.add(box(0.012, 0.18, 0.02, brass, DOOR.x0 + 0.04, 1.0, z1 + PARTITION / 2));

  // --- the corridor ----------------------------------------------------------------------
  const C = CORRIDOR;
  const cw = CORRIDOR_WINDOWS;
  // The partition's corridor side: a door for every compartment, ours open, the rest shut.
  const doors: number[] = [];
  for (let k = 0; k < 7; k++) doors.push(DOOR.x0 - k * COMPARTMENT_STEP);
  const side = new THREE.Shape();
  side.moveTo(C.x0, 0).lineTo(C.x1, 0).lineTo(C.x1, CAR.ceiling).lineTo(C.x0, CAR.ceiling).closePath();
  for (const d of doors) {
    const h = new THREE.Path();
    h.moveTo(d, 0).lineTo(d + DOOR.x1 - DOOR.x0, 0).lineTo(d + DOOR.x1 - DOOR.x0, DOOR.y1).lineTo(d, DOOR.y1).closePath();
    if (d > C.x0 + 0.1) side.holes.push(h);
  }
  group.add(mesh(shaped(side, (a, b) => v(a, b, C.z0)), panelMat));
  // The shut doors: a paneled leaf with a frosted light and a brass handle and number.
  const doorLeaf = new THREE.MeshStandardMaterial({ map: dado(), roughness: 0.4 });
  const frosted = new THREE.MeshStandardMaterial({ color: '#d8c8a8', emissive: new THREE.Color('#ffc880'), emissiveIntensity: 0.35, roughness: 0.4 });
  doors.forEach((d, k) => {
    if (k === 0 || d < C.x0 + 0.1) return;
    const dw = DOOR.x1 - DOOR.x0;
    group.add(box(dw, DOOR.y1, 0.04, doorLeaf, d + dw / 2, DOOR.y1 / 2, C.z0 - 0.01));
    group.add(box(dw * 0.55, 0.5, 0.01, frosted, d + dw / 2, 1.5, C.z0 + 0.012));
    group.add(box(0.014, 0.2, 0.025, brass, d + dw - 0.07, 1.0, C.z0 + 0.02));
    for (const zz of [C.z0 + 0.01]) {
      group.add(box(0.05, DOOR.y1, 0.03, trim, d - 0.02, DOOR.y1 / 2, zz));
      group.add(box(0.05, DOOR.y1, 0.03, trim, d + dw + 0.02, DOOR.y1 / 2, zz));
      group.add(box(dw + 0.09, 0.06, 0.03, trim, d + dw / 2, DOOR.y1 + 0.03, zz));
    }
  });
  // The outer wall with its windows.
  const outerIn = new THREE.Shape();
  outerIn.moveTo(-C.x1, 0).lineTo(-C.x0, 0).lineTo(-C.x0, CAR.eaves).lineTo(-C.x1, CAR.eaves).closePath();
  const corridorWindows: number[] = [];
  for (let i = 0; i < cw.count; i++) corridorWindows.push(cw.first + i * cw.step);
  for (const cx of corridorWindows) outerIn.holes.push(roundRect(new THREE.Path(), -cx - cw.width / 2, cw.y0, -cx + cw.width / 2, cw.y1, 0.08));
  group.add(mesh(shaped(outerIn, (a, b) => v(-a, b, C.z1)), panelMat));
  // The corridor's ends: a door through to the next car, shut.
  for (const [ex, facing] of [
    [C.x0, 1],
    [C.x1, -1],
  ] as const) {
    const s = new THREE.Shape();
    const za = (a: number) => (facing > 0 ? -a : a);
    const aFrom = facing > 0 ? -C.z1 : C.z0;
    const aTo = facing > 0 ? -C.z0 : C.z1;
    const pts: THREE.Vector2[] = [new THREE.Vector2(aFrom, 0), new THREE.Vector2(aTo, 0)];
    for (let i = 0; i <= 8; i++) {
      const a = aTo + ((aFrom - aTo) * i) / 8;
      pts.push(new THREE.Vector2(a, ceilingAt(za(a))));
    }
    s.setFromPoints(pts);
    s.closePath();
    group.add(mesh(shaped(s, (a, b) => v(ex, b, za(a))), panelMat));
    const mid = (C.z0 + C.z1) / 2;
    group.add(box(0.04, 1.95, 0.72, doorLeaf, ex + facing * 0.02, 0.975, mid));
    group.add(box(0.012, 0.45, 0.4, frosted, ex + facing * 0.042, 1.5, mid));
  }
  // Floor, runner, ceiling.
  const cFloor = new THREE.Mesh(new THREE.PlaneGeometry(C.x1 - C.x0, C.z1 - C.z0), corridorFloor);
  cFloor.rotation.x = -Math.PI / 2;
  cFloor.position.set((C.x0 + C.x1) / 2, 0, (C.z0 + C.z1) / 2);
  cFloor.receiveShadow = true;
  group.add(cFloor);
  const runner = new THREE.Mesh(new THREE.PlaneGeometry(C.x1 - C.x0, 0.82), runnerMat);
  runner.rotation.x = -Math.PI / 2;
  runner.position.set((C.x0 + C.x1) / 2, 0.004, (C.z0 + C.z1) / 2);
  (runnerMat.map as THREE.Texture).repeat.set((C.x1 - C.x0) / 0.82, 1);
  runner.receiveShadow = true;
  group.add(runner);
  group.add(mesh(ceilingStrip(C.x0, C.x1, C.z0, C.z1), ceilMat));
  // The brass rail under the windows, and a bracket at every window.
  group.add(rod(v(C.x0 + 0.05, 0.98, C.z1 - 0.075), v(C.x1 - 0.05, 0.98, C.z1 - 0.075), 0.014, brass, 12));
  for (const cx of corridorWindows) {
    for (const dx of [-0.66, 0.66]) group.add(rod(v(cx + dx, 0.98, C.z1 - 0.075), v(cx + dx, 0.98, C.z1), 0.008, brass));
    // A tip-up seat, folded against the wall.
    group.add(box(0.36, 0.26, 0.05, doorLeaf, cx, 0.5, C.z1 - 0.03));
    group.add(box(0.36, 0.02, 0.06, brass, cx, 0.37, C.z1 - 0.035));
    // The window's frame and reveal.
    const fr = new THREE.Shape();
    roundRect(fr, -cx - cw.width / 2 - 0.035, cw.y0 - 0.035, -cx + cw.width / 2 + 0.035, cw.y1 + 0.035, 0.11);
    fr.holes.push(roundRect(new THREE.Path(), -cx - cw.width / 2, cw.y0, -cx + cw.width / 2, cw.y1, 0.08));
    group.add(mesh(shaped(fr, (a, b) => v(-a, b, C.z1 - 0.004)), trim));
  }
  // The corridor's glass, all in one.
  const panes = corridorWindows.map((cx) => shaped(roundRect(new THREE.Shape(), -cx - cw.width / 2, cw.y0, -cx + cw.width / 2, cw.y1, 0.08), (a, b) => v(-a, b, C.z1 + 0.04)));
  const cGlass = mesh(mergeGeometries(panes)!, glass.material as THREE.Material, { receive: false });
  cGlass.renderOrder = 3;
  group.add(cGlass);
  // Lamps along the corridor ceiling, one at every door.
  const cLamps: THREE.Vector3[] = [];
  for (let k = 0; k < 8; k++) {
    const lx = 0.98 - k * COMPARTMENT_STEP;
    if (lx < C.x0 + 0.3) continue;
    const at = v(lx, ceilingAt(0.8), 0.8);
    cLamps.push(at);
    put(group, mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.02, 16), brass), at.clone().add(v(0, -0.01, 0)));
    const g = mesh(new THREE.SphereGeometry(0.085, 16, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), dome, { receive: false });
    g.position.copy(at).add(v(0, -0.018, 0));
    group.add(g);
  }

  // --- our car, outside ------------------------------------------------------------------
  const outer = CAR.outer;
  // The sides, with holes for the windows: every compartment's on this side, the corridor's on the other.
  const compWindows: number[] = [];
  for (let k = 0; k < 7; k++) compWindows.push(WINDOW_X - k * COMPARTMENT_STEP);
  const sideA = new THREE.Shape();
  sideA.moveTo(-CAR.front, CAR.skirt).lineTo(-CAR.back, CAR.skirt).lineTo(-CAR.back, CAR.shoulder).lineTo(-CAR.front, CAR.shoulder).closePath();
  for (const cx of compWindows) sideA.holes.push(roundRect(new THREE.Path(), -cx - (W.x1 - W.x0) / 2, W.y0, -cx + (W.x1 - W.x0) / 2, W.y1, R));
  const skinA = mesh(shaped(sideA, (a, b) => v(-a, b, -outer)), paint);
  (skinA.geometry.attributes.uv as THREE.BufferAttribute).needsUpdate = true;
  group.add(skinA);
  const sideB = new THREE.Shape();
  sideB.moveTo(CAR.back, CAR.skirt).lineTo(CAR.front, CAR.skirt).lineTo(CAR.front, CAR.shoulder).lineTo(CAR.back, CAR.shoulder).closePath();
  for (const cx of corridorWindows) sideB.holes.push(roundRect(new THREE.Path(), cx - cw.width / 2, cw.y0, cx + cw.width / 2, cw.y1, 0.08));
  group.add(mesh(shaped(sideB, (a, b) => v(a, b, outer)), paint));
  // The other compartments' windows: blinds down, most lit from inside.
  compWindows.forEach((cx, k) => {
    if (k === 0) return;
    const lit = k !== 3 && k !== 5;
    const bl = mesh(new THREE.PlaneGeometry(W.x1 - W.x0, W.y1 - W.y0), lit ? blind : blindDark, { receive: false });
    bl.position.set(cx, (W.y0 + W.y1) / 2, -1.6);
    bl.rotation.y = Math.PI;
    group.add(bl);
    // The cavity behind them, so nothing shows through at the sides.
    group.add(box(W.x1 - W.x0 + 0.02, W.y1 - W.y0 + 0.02, 0.02, blindDark, cx, (W.y0 + W.y1) / 2, -1.555));
  });
  // Corridor windows' reveals, seen from outside.
  for (const cx of corridorWindows) {
    for (const [a, b, c, d] of [
      [v(cx - cw.width / 2, cw.y0, C.z1), v(cx + cw.width / 2, cw.y0, C.z1), v(cx + cw.width / 2, cw.y0, outer), v(cx - cw.width / 2, cw.y0, outer)],
      [v(cx + cw.width / 2, cw.y1, C.z1), v(cx - cw.width / 2, cw.y1, C.z1), v(cx - cw.width / 2, cw.y1, outer), v(cx + cw.width / 2, cw.y1, outer)],
    ]) {
      const g = new THREE.BufferGeometry().setFromPoints([a, b, c, a, c, d]);
      g.computeVertexNormals();
      group.add(mesh(g, reveal));
    }
  }
  // Gold lines along the sides, and the name under the windows.
  for (const zz of [-outer - 0.003, outer + 0.003])
    for (const yy of [0.66, 1.98]) group.add(box(CAR.front - CAR.back, 0.018, 0.004, gold, (CAR.front + CAR.back) / 2, yy, zz));
  const nameTex = carName('SLEEPING CAR');
  for (const [zz, ry] of [
    [-outer - 0.006, Math.PI],
    [outer + 0.006, 0],
  ] as const) {
    const n = mesh(new THREE.PlaneGeometry(3.2, 0.4), new THREE.MeshStandardMaterial({ map: nameTex, transparent: true, roughness: 0.4, metalness: 0.6, depthWrite: false }), { receive: false });
    n.position.set(-8.5, 0.3, zz);
    n.rotation.y = ry;
    group.add(n);
  }
  // The roof: a shallow arc from shoulder to shoulder, ventilators along its crown.
  const arcR = (outer * outer + Math.pow(CAR.roof - CAR.shoulder, 2)) / (2 * (CAR.roof - CAR.shoulder));
  const cy = CAR.roof - arcR;
  const half = Math.asin(outer / arcR);
  const roofPts: THREE.Vector2[] = [];
  for (let i = 0; i <= 20; i++) {
    const a = -half + (2 * half * i) / 20;
    roofPts.push(new THREE.Vector2(Math.sin(a) * arcR, cy + Math.cos(a) * arcR));
  }
  const roofGeo = new THREE.BufferGeometry();
  const rp: number[] = [];
  for (let i = 0; i < 20; i++) {
    const p = roofPts[i];
    const q = roofPts[i + 1];
    rp.push(CAR.back, p.y, p.x, CAR.front, q.y, q.x, CAR.front, p.y, p.x, CAR.back, p.y, p.x, CAR.back, q.y, q.x, CAR.front, q.y, q.x);
  }
  roofGeo.setAttribute('position', new THREE.Float32BufferAttribute(rp, 3));
  roofGeo.computeVertexNormals();
  const roof = mesh(roofGeo, roofMat);
  roof.material = roofMat.clone();
  (roof.material as THREE.MeshStandardMaterial).side = THREE.DoubleSide;
  group.add(roof);
  for (let k = 0; k < 8; k++) group.add(box(0.5, 0.12, 0.5, roofMat, CAR.back + 2 + k * 2.9, CAR.roof + 0.04, 0));
  // The ends, and the bellows to the next car.
  for (const [ex, dir] of [
    [CAR.back, -1],
    [CAR.front, 1],
  ] as const) {
    const s = new THREE.Shape();
    s.moveTo(-outer, CAR.skirt);
    s.lineTo(outer, CAR.skirt);
    s.lineTo(outer, CAR.shoulder);
    for (const p of [...roofPts].reverse()) s.lineTo(p.x, p.y);
    s.lineTo(-outer, CAR.shoulder);
    s.closePath();
    group.add(mesh(shaped(s, (a, b) => v(ex, b, dir > 0 ? -a : a)), paint));
    group.add(box(1.0, 2.3, 1.3, iron, ex + dir * 0.5, 1.1, 0));
  }
  // Under the floor: the frame, boxes of gear, the two bogies.
  group.add(box(CAR.front - CAR.back, 0.36, 2 * outer - 0.06, iron, (CAR.front + CAR.back) / 2, CAR.skirt + 0.2, 0));
  for (const ex of [-12.5, -8, -4.5]) group.add(box(1.6 + (ex % 2), 0.5, 1.6, iron, ex, CAR.skirt - 0.25, 0.3));
  for (const bx of [0.3, CAR.back + 3.2]) group.add(bogie(bx, iron));

  // --- light ---------------------------------------------------------------------------
  const ceilingLight = new THREE.PointLight('#ffd6a0', 2.4, 5.5, 1.4);
  ceilingLight.position.copy(lampAt).add(v(0, -0.18, 0));
  group.add(ceilingLight);
  const reading = new THREE.SpotLight('#ffcf8e', 5, 3.2, 0.75, 0.7, 1.4);
  reading.position.copy(readAt);
  reading.target.position.set(x0 + 0.45, 0.6, -0.25);
  group.add(reading, reading.target);
  const corridor = [0.95, -1.0, -3.4].map((lx) => {
    const l = new THREE.PointLight('#ffd2a0', 1.7, 4.6, 1.5);
    l.position.set(lx, 2.05, 0.9);
    group.add(l);
    return l;
  });
  const moon = new THREE.DirectionalLight('#8aa2d8', 0.35);
  moon.position.set(-1.2, 2.2, -2.4);
  moon.target.position.set(0, 0, 0);
  group.add(moon, moon.target);
  const sweep = new THREE.PointLight('#ffb060', 0, 9, 1.6);
  sweep.position.set(0, 1, -4);
  group.add(sweep);
  group.add(new THREE.HemisphereLight('#ffdcb0', '#2a1408', 0.22));
  // Little halos round the bulbs, for the lens.
  const halo = new THREE.SpriteMaterial({ map: glow('rgba(255,210,150,1)', 64), color: '#ffcf96', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.4 });
  const halos: THREE.Sprite[] = [];
  for (const [at, s] of [
    [shade.position.clone().add(v(0, -0.05, 0)), 0.5],
    [readAt, 0.22],
    ...cLamps.map((p) => [p.clone().add(v(0, -0.05, 0)), 0.38] as const),
  ] as const) {
    const sp = new THREE.Sprite(halo);
    sp.position.copy(at as THREE.Vector3);
    sp.scale.setScalar(s as number);
    group.add(sp);
    halos.push(sp);
  }

  // Everything inside casts no shadow but the desk lamp's (the studio's); the shell takes them.
  group.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh && m.castShadow === undefined) m.castShadow = false;
  });

  let paneDrop = 0;
  const bulbBase = bulb.color.clone();
  const domeBase = dome.emissiveIntensity;
  const lampBase = { ceiling: ceilingLight.intensity, reading: reading.intensity, corridor: corridor[0].intensity, frosted: frosted.emissiveIntensity, tulip: (tulip.material as THREE.MeshStandardMaterial).emissiveIntensity, blind: blind.color.clone() };

  return {
    group,
    glass,
    windowHit,
    setWindow(k) {
      paneDrop = k;
      pane.position.y = -0.44 * k;
    },
    setLamps(k) {
      ceilingLight.intensity = lampBase.ceiling * k;
      reading.intensity = lampBase.reading * k;
      for (const l of corridor) l.intensity = lampBase.corridor * k;
      bulb.color.copy(bulbBase).multiplyScalar(Math.max(0.15, k));
      dome.emissiveIntensity = domeBase * Math.max(0.1, k);
      frosted.emissiveIntensity = lampBase.frosted * k;
      (tulip.material as THREE.MeshStandardMaterial).emissiveIntensity = lampBase.tulip * Math.max(0.1, k);
      blind.color.copy(lampBase.blind).multiplyScalar(Math.max(0.2, k));
      halo.opacity = 0.4 * k;
    },
    tick(t, wind, sway) {
      // The curtains: a slow stir from the car's motion, and with the window down they billow in.
      const stir = 0.15 * sway + wind;
      if (stir < 0.002 && !curtains[0].mesh.userData.moved) return;
      for (const c of curtains) {
        const p = c.mesh.geometry.attributes.position as THREE.BufferAttribute;
        for (let i = 0; i < p.count; i++) {
          const bx = c.base[i * 3];
          const by = c.base[i * 3 + 1];
          // Free below the tie-back (about 0.1 m below the middle), held above it.
          const free = Math.max(0, (-0.1 - by) / 0.42);
          const top = Math.max(0, (by - 0.0) / 0.52) * 0.25;
          const k = free + top;
          const gust = 0.5 + 0.5 * Math.sin(t * 2.3 + by * 3 + c.side) * Math.sin(t * 0.7 + bx * 9);
          const out = k * (wind * (0.12 + 0.1 * gust) + 0.004 * sway * Math.sin(t * 1.6 + by * 2));
          p.setXYZ(i, bx + c.side * k * wind * 0.05 * gust, by + k * wind * 0.02, c.base[i * 3 + 2] + out);
        }
        p.needsUpdate = true;
        c.mesh.geometry.computeVertexNormals();
        c.mesh.userData.moved = stir > 0.002;
      }
      void paneDrop;
    },
    spots: { hooks, route: v(x0 + 0.02, 1.08, -0.62) },
    lights: { ceiling: ceilingLight, reading, corridor, moon, sweep },
    materials: { brass, trim, velvet, iron, paint, roofMat, gold, leather, darkBrass },
  };
}

/** A bogie under the car at x: its frame, four wheels, springs. */
export function bogie(bx: number, iron: THREE.Material) {
  const g = new THREE.Group();
  const frame = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.28, 2.0), iron);
  frame.position.set(bx, -0.72, 0);
  g.add(frame);
  const wheelGeo = new THREE.CylinderGeometry(0.46, 0.46, 0.12, 20);
  wheelGeo.rotateX(Math.PI / 2);
  for (const ax of [-1.25, 1.25])
    for (const az of [-0.75, 0.75]) {
      const w = new THREE.Mesh(wheelGeo, iron);
      w.position.set(bx + ax, CAR.rail + 0.46, az);
      g.add(w);
    }
  for (const ax of [-0.6, 0.6]) {
    const s = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.3, 10), iron);
    s.position.set(bx + ax, -0.52, 0.85);
    g.add(s);
    const s2 = s.clone();
    s2.position.z = -0.85;
    g.add(s2);
  }
  return g;
}

/** The label painted on a texture, for a car's number. */
export function numberPlate(text: string) {
  const [c, g] = canvas(128, 128);
  g.fillStyle = '#c9a35a';
  g.beginPath();
  g.arc(64, 64, 60, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#1a120a';
  g.font = '700 64px "Space Mono", monospace';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, 64, 68);
  return texture(c);
}
