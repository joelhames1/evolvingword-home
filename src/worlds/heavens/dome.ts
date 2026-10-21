// The observatory: a round room under a turning dome. A low wall runs all the
// way round, lined with curved bookcases, and above it the dome turns on its
// ring, its slit open from the wall's top up over the zenith. The dome turns
// with you, so wherever you look the slit is there and the sky with it. Inside
// it's night-dark: the desk lamp, the CRT, a work light up on the dome that
// turns with it, and the small red lights observatories use so your eyes stay
// used to the dark.
import * as THREE from 'three';
import { canvas, paneling, rng, texture, boards } from '../../textures';
import type { Quality } from '../../world';
import { outdoor, type DaylightUniforms } from '../outdoor';
import { CENTER } from './peak';

/** The low wall's top, where the dome's ring sits. */
export const LEDGE = 1.07;
/** The dome springs from here. */
export const SPRING = 2.6;
/** Inside face of the turning dome, and outside. */
export const R_IN = 4.62;
export const R_OUT = 4.78;
/** The low wall: its inside face, and how deep the bookcases built into it are. */
export const WALL = 4.55;
export const CASE = 0.3;
/** Half the slit's width. */
export const SLIT = 1.6;
/** The slit runs on past the zenith this far (radians), toward the back. */
const PAST = 0.28;

/** A point on the floor plan: `r` out from the middle toward azimuth `az` (degrees, 0 toward the desk, then round to the right). */
export const around = (az: number, r: number, y = 0) => {
  const a = THREE.MathUtils.degToRad(az);
  return new THREE.Vector3(CENTER.x + Math.sin(a) * r, y, CENTER.z - Math.cos(a) * r);
};

/**
 * One shell of the dome with the slit cut out, `R` meters round. The slit faces
 * local −z and runs from the spring line up over the top. Built as two sides
 * (everything wider than the slit) and the closed strip behind the slit's end.
 */
function domeShell(R: number, segs: number) {
  const pos: number[] = [];
  const nrm: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  const b0 = Math.asin(SLIT / R);
  // A patch over (beta, phi): x = R sin(beta), and round the y-z circle by phi
  // (0 at the back, pi at the front, down by the slit).
  const patch = (bFrom: number, bTo: number, pFrom: number, pTo: number, nb: number, np: number, flip: boolean) => {
    const start = pos.length / 3;
    for (let i = 0; i <= nb; i++) {
      const b = bFrom + ((bTo - bFrom) * i) / nb;
      for (let j = 0; j <= np; j++) {
        const p = pFrom + ((pTo - pFrom) * j) / np;
        const x = R * Math.sin(b);
        const y = R * Math.cos(b) * Math.sin(p);
        const z = R * Math.cos(b) * Math.cos(p);
        pos.push(x, y, z);
        nrm.push(x / R, y / R, z / R);
        uv.push(Math.atan2(x, z) / (Math.PI * 2) + 0.5, y / R);
      }
    }
    for (let i = 0; i < nb; i++)
      for (let j = 0; j < np; j++) {
        const a = start + i * (np + 1) + j;
        const b = a + np + 1;
        if (flip) idx.push(a, a + 1, b, b, a + 1, b + 1);
        else idx.push(a, b, a + 1, b, b + 1, a + 1);
      }
  };
  const nb = Math.round(segs / 3);
  patch(b0, Math.PI / 2, 0, Math.PI, nb, segs, false);
  patch(-b0, -Math.PI / 2, 0, Math.PI, nb, segs, true);
  patch(-b0, b0, 0, Math.PI / 2 - PAST, 6, Math.round(segs / 2.4), false);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  return geo;
}

/** The dome's drum: a band of wall from the ledge up to the spring line, open where the slit comes down. */
function drumShell(R: number, y0: number, y1: number, segs: number) {
  const a0 = Math.asin(SLIT / R);
  const pos: number[] = [];
  const nrm: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  // theta from just past the slit's right edge, round the back, to its left edge.
  const from = Math.PI + a0;
  const span = Math.PI * 2 - a0 * 2;
  for (let i = 0; i <= segs; i++) {
    const t = from + (span * i) / segs;
    for (const [j, y] of [y0, y1].entries()) {
      pos.push(R * Math.sin(t), y, R * Math.cos(t));
      nrm.push(Math.sin(t), 0, Math.cos(t));
      uv.push(i / segs, j);
    }
  }
  for (let i = 0; i < segs; i++) {
    const a = i * 2;
    idx.push(a, a + 2, a + 1, a + 2, a + 3, a + 1);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  return geo;
}

/** A curve along the slit's edge (x = ±SLIT), from the ledge up the drum and over the dome, `R` round. */
function slitEdge(side: number, R: number) {
  const pts: THREE.Vector3[] = [];
  const zr = Math.sqrt(R * R - SLIT * SLIT);
  pts.push(new THREE.Vector3(side * SLIT, LEDGE + 0.02 - SPRING, -zr));
  for (let i = 0; i <= 40; i++) {
    const p = Math.PI - ((Math.PI / 2 + PAST) * i) / 40;
    pts.push(new THREE.Vector3(side * SLIT, zr * Math.sin(p), zr * Math.cos(p)));
  }
  return pts;
}

/** Painted steel plates for the inside of the dome: dark blue-gray, bolted at the seams. */
function plates() {
  const [c, g] = canvas(512, 512);
  const r = rng(3);
  g.fillStyle = '#2a3140';
  g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 7000; i++) {
    g.fillStyle = `rgba(${r() < 0.5 ? '255,255,255' : '0,0,0'},${r() * 0.04})`;
    g.fillRect(r() * 512, r() * 512, 2, 2);
  }
  g.fillStyle = 'rgba(0,0,0,0.4)';
  for (const x of [0, 256]) g.fillRect(x, 0, 3, 512);
  for (const y of [0, 256]) g.fillRect(0, y, 512, 3);
  g.fillStyle = 'rgba(200,210,230,0.18)';
  for (let x = 12; x < 512; x += 32) for (const y of [8, 264]) g.fillRect(x, y, 3, 3);
  return texture(c, { repeat: [24, 3] });
}

/** Aluminum skin for the outside: pale panels in long gores. */
function skin() {
  const [c, g] = canvas(512, 256);
  g.fillStyle = '#d9dde4';
  g.fillRect(0, 0, 512, 256);
  const r = rng(5);
  for (let i = 0; i < 3000; i++) {
    g.fillStyle = `rgba(0,0,0,${r() * 0.04})`;
    g.fillRect(r() * 512, r() * 256, 3, 1);
  }
  g.fillStyle = 'rgba(60,70,90,0.35)';
  for (let x = 0; x < 512; x += 32) g.fillRect(x, 0, 2, 256);
  return texture(c, { repeat: [3, 1] });
}

export interface Observatory {
  group: THREE.Group;
  /** The part that turns: the drum, the dome, the slit, the work light. */
  turret: THREE.Group;
  /** Turns the slit to face this azimuth (degrees). */
  setAzimuth(az: number): void;
  /** The red lamp over the door, for the snow outside. */
  doorLamp: THREE.Vector3;
  /** The bookcases, for tests. */
  books: number;
  /** Seen from outside, the work light turns to light the telescope in the slit. */
  lightFrom(outside: boolean): void;
  tick(t: number): void;
}

/** Arcs of the wall (degrees) lined with low bookcases: wherever nothing else stands. */
const CASES: [number, number][] = [
  [30, 63],
  [97, 133],
  [161, 249],
  [-52, -31],
];

export function buildObservatory(night: DaylightUniforms, quality: Quality): Observatory {
  const group = new THREE.Group();
  const segs = quality === 'high' ? 96 : 64;
  const r = rng(61);

  // --- the floor: old boards, a circle of them ------------------------------------------
  const floorTex = boards(17);
  floorTex.repeat.set(5, 5);
  const floor = new THREE.Mesh(new THREE.CircleGeometry(WALL + 0.01, 96), new THREE.MeshStandardMaterial({ map: floorTex, color: '#a08870', roughness: 0.72 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(CENTER.x, 0, CENTER.z);
  floor.receiveShadow = true;
  group.add(floor);

  // --- the low wall: paneled inside, a varnished ledge on top, white outside ----------------
  const panelTex = paneling(41, '#5b3a22');
  panelTex.wrapS = panelTex.wrapT = THREE.RepeatWrapping;
  panelTex.repeat.set(18, 0.5);
  const inside = new THREE.Mesh(new THREE.CylinderGeometry(WALL, WALL, LEDGE, segs, 1, true), new THREE.MeshStandardMaterial({ map: panelTex, color: '#8a6a52', roughness: 0.7, side: THREE.BackSide }));
  inside.position.set(CENTER.x, LEDGE / 2, CENTER.z);
  inside.receiveShadow = true;
  inside.castShadow = true;
  group.add(inside);
  const ledgeMat = new THREE.MeshStandardMaterial({ color: '#3a2416', roughness: 0.38, metalness: 0.05 });
  const ledge = new THREE.Mesh(
    new THREE.LatheGeometry(
      [
        [WALL - CASE - 0.03, LEDGE - 0.035],
        [WALL - CASE - 0.04, LEDGE - 0.01],
        [WALL - CASE - 0.02, LEDGE],
        [R_OUT + 0.06, LEDGE],
        [R_OUT + 0.07, LEDGE - 0.03],
      ].map(([x, y]) => new THREE.Vector2(x, y)),
      segs,
    ),
    ledgeMat,
  );
  ledge.position.copy(CENTER);
  ledge.receiveShadow = true;
  ledge.castShadow = true;
  group.add(ledge);
  const outside = new THREE.Mesh(new THREE.CylinderGeometry(R_OUT + 0.06, R_OUT + 0.06, LEDGE + 2.2, segs, 1, true), outdoor(night, { map: skin(), color: '#e2e5ea' }));
  outside.position.set(CENTER.x, (LEDGE - 2.2) / 2, CENTER.z);
  group.add(outside);
  // The door, round the back, and a red lamp over it.
  const doorAz = 170;
  const door = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 2.0), outdoor(night, { color: '#5a606b' }));
  const doorAt = around(doorAz, R_OUT + 0.075, 0.6);
  door.position.copy(doorAt);
  door.rotation.y = -THREE.MathUtils.degToRad(doorAz) + Math.PI;
  group.add(door);
  const doorLamp = around(doorAz, R_OUT + 0.2, 1.75);
  const lampBulb = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 0.2, 0.1) }));
  lampBulb.position.copy(doorLamp);
  group.add(lampBulb);

  // --- the bookcases in the wall: curved shelves of books, all the way round -----------------
  const caseMat = new THREE.MeshStandardMaterial({ map: paneling(43, '#4a2c18'), color: '#7a5a42', roughness: 0.6 });
  const shelfYs = [0.05, 0.53];
  let total = 0;
  const bookSlots: { az: number; y: number; w: number; h: number; d: number; lean: number }[] = [];
  for (const [a0, a1] of CASES) {
    const t0 = THREE.MathUtils.degToRad(a0);
    const span = THREE.MathUtils.degToRad(a1 - a0);
    // Shelves (and the kick under the bottom one): flat rings, the front edge a band.
    for (const y of [...shelfYs, LEDGE - 0.045]) {
      const ring = new THREE.Mesh(new THREE.RingGeometry(WALL - CASE, WALL, 48, 1, Math.PI / 2 - t0 - span, span), caseMat);
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(CENTER.x, y, CENTER.z);
      ring.receiveShadow = true;
      group.add(ring);
      const lip = new THREE.Mesh(new THREE.CylinderGeometry(WALL - CASE, WALL - CASE, 0.03, 48, 1, true, Math.PI - t0 - span, span), caseMat);
      lip.position.set(CENTER.x, y - 0.012, CENTER.z);
      group.add(lip);
    }
    const kick = new THREE.Mesh(new THREE.CylinderGeometry(WALL - CASE + 0.02, WALL - CASE + 0.02, 0.05, 48, 1, true, Math.PI - t0 - span, span), new THREE.MeshStandardMaterial({ color: '#1c120b', roughness: 0.8 }));
    kick.position.set(CENTER.x, 0.025, CENTER.z);
    group.add(kick);
    // Uprights every meter or so, and at each end.
    const n = Math.max(2, Math.round(((a1 - a0) / 360) * Math.PI * 2 * WALL));
    for (let i = 0; i <= n; i++) {
      const az = a0 + ((a1 - a0) * i) / n;
      const side = new THREE.Mesh(new THREE.BoxGeometry(0.03, LEDGE - 0.05, CASE), caseMat);
      side.position.copy(around(az, WALL - CASE / 2, (LEDGE - 0.05) / 2));
      side.rotation.y = -THREE.MathUtils.degToRad(az);
      side.castShadow = true;
      group.add(side);
    }
    // Books on both shelves, leaning now and then, a gap here and there.
    for (const y of shelfYs) {
      let az = a0 + 0.4;
      while (az < a1 - 0.4) {
        const w = 0.025 + r() * 0.035;
        const step = THREE.MathUtils.radToDeg(w / (WALL - CASE));
        if (r() < 0.06) {
          az += step * 3;
          continue;
        }
        const h = 0.2 + r() * 0.17;
        bookSlots.push({ az: az + step / 2, y, w, h, d: 0.17 + r() * 0.08, lean: r() < 0.05 ? (r() - 0.5) * 0.5 : 0 });
        az += step + 0.02;
      }
    }
  }
  const keep = quality === 'high' ? bookSlots : bookSlots.filter((_, i) => i % 2 === 0);
  const bookColors = ['#6a2424', '#24405e', '#344e32', '#b8a27a', '#4c3050', '#1c1c22', '#7a5c30', '#963a28', '#d4c8aa', '#20394e', '#5e4a2a'];
  const books = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ roughness: 0.8 }), keep.length);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  keep.forEach((b, i) => {
    const at = around(b.az, WALL - CASE + 0.02 + b.d / 2, b.y + 0.0125 + b.h / 2);
    q.setFromEuler(new THREE.Euler(0, -THREE.MathUtils.degToRad(b.az), b.lean));
    m.compose(at, q, new THREE.Vector3(b.w, b.h, b.d));
    books.setMatrixAt(i, m);
    books.setColorAt(i, new THREE.Color(bookColors[Math.floor(r() * bookColors.length)]).multiplyScalar(0.7 + r() * 0.5));
  });
  books.castShadow = true;
  books.receiveShadow = true;
  group.add(books);
  total = keep.length;

  // --- the turret: drum, dome, slit, and the work light, all turning together --------------------
  const turret = new THREE.Group();
  turret.position.set(CENTER.x, SPRING, CENTER.z);
  group.add(turret);
  const plateTex = plates();
  const innerMat = new THREE.MeshStandardMaterial({ map: plateTex, color: '#7d8698', roughness: 0.78, metalness: 0.25, side: THREE.BackSide });
  const outerMat = outdoor(night, { map: skin(), color: '#ffffff', emissive: '#0a0d14' });
  const domeIn = new THREE.Mesh(domeShell(R_IN, segs), innerMat);
  domeIn.receiveShadow = true;
  domeIn.castShadow = true;
  turret.add(domeIn);
  const domeOut = new THREE.Mesh(domeShell(R_OUT, segs), outerMat);
  turret.add(domeOut);
  const drumMat = new THREE.MeshStandardMaterial({ map: plateTex.clone(), color: '#6c7486', roughness: 0.8, metalness: 0.2, side: THREE.BackSide });
  (drumMat.map as THREE.Texture).repeat.set(24, 1);
  const drumIn = new THREE.Mesh(drumShell(R_IN, LEDGE + 0.02 - SPRING, 0, segs * 2), drumMat);
  drumIn.receiveShadow = true;
  drumIn.castShadow = true;
  turret.add(drumIn);
  const drumOut = new THREE.Mesh(drumShell(R_OUT, LEDGE + 0.02 - SPRING, 0, segs * 2), outerMat);
  turret.add(drumOut);
  // The bottom of the drum, closing the gap between its two skins.
  const sole = new THREE.Mesh(new THREE.RingGeometry(R_IN, R_OUT, segs * 2, 1, -Math.PI / 2 + Math.asin(SLIT / R_IN), Math.PI * 2 - 2 * Math.asin(SLIT / R_IN)), new THREE.MeshStandardMaterial({ color: '#1a1d24', roughness: 0.8, side: THREE.DoubleSide }));
  sole.rotation.x = Math.PI / 2;
  sole.position.y = LEDGE + 0.02 - SPRING;
  turret.add(sole);

  // The slit's two edges: deep steel arches, inside and out, with a jamb between.
  const steel = new THREE.MeshStandardMaterial({ color: '#1d2129', roughness: 0.55, metalness: 0.6 });
  for (const side of [-1, 1]) {
    const inner = slitEdge(side, R_IN - 0.02);
    const outer = slitEdge(side, R_OUT + 0.02);
    const pos: number[] = [];
    const idx: number[] = [];
    inner.forEach((p, i) => {
      pos.push(p.x, p.y, p.z, outer[i].x, outer[i].y, outer[i].z);
      if (i < inner.length - 1) {
        const a = i * 2;
        if (side > 0) idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
        else idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
      }
    });
    const jambGeo = new THREE.BufferGeometry();
    jambGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    jambGeo.setIndex(idx);
    jambGeo.computeVertexNormals();
    const jamb = new THREE.Mesh(jambGeo, new THREE.MeshStandardMaterial({ color: '#2a2f38', roughness: 0.7, metalness: 0.3, side: THREE.DoubleSide }));
    jamb.castShadow = true;
    turret.add(jamb);
    // The arch girder inside, a fat rib along the edge.
    const girder = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(slitEdge(side, R_IN - 0.09).map((p) => p.setX(p.x + side * 0.07))), 60, 0.07, 6), steel);
    girder.castShadow = true;
    turret.add(girder);
    // And outside, the rail the shutter runs on.
    const rail = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(slitEdge(side, R_OUT + 0.06).map((p) => p.setX(p.x + side * 0.1))), 60, 0.06, 6), outdoor(night, { color: '#9aa1ad' }));
    turret.add(rail);
  }
  // The slit's top end, past the zenith: a crossbeam.
  {
    const p = Math.PI / 2 - PAST;
    const zr = Math.sqrt(R_IN * R_IN - SLIT * SLIT) - 0.09;
    const beam = new THREE.Mesh(new THREE.BoxGeometry(SLIT * 2 + 0.2, 0.14, 0.14), steel);
    beam.position.set(0, zr * Math.sin(p), zr * Math.cos(p));
    beam.rotation.x = -p + Math.PI / 2;
    turret.add(beam);
  }
  // Ribs down the dome's sides, meeting the ring at the bottom.
  const ribR = R_IN - 0.05;
  for (let k = 0; k < 16; k++) {
    const psi = (k / 16) * Math.PI * 2 + Math.PI / 16;
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 30; i++) {
      const e = (i / 30) * (Math.PI / 2 - 0.06);
      const p = new THREE.Vector3(ribR * Math.cos(e) * Math.sin(psi), ribR * Math.sin(e), ribR * Math.cos(e) * Math.cos(psi));
      // Stop at the slit's girder.
      const inSlit = Math.abs(p.x) < SLIT + 0.16 && (p.z < 0 || Math.atan2(p.y, p.z) > Math.PI / 2 - PAST - 0.05);
      if (inSlit) break;
      pts.push(p);
    }
    if (pts.length < 3) continue;
    const rib = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 30, 0.035, 5), steel);
    turret.add(rib);
  }
  // The ring the dome rides on, a little lip round the inside at the spring line, and the rack it turns on.
  // (Torus arcs start along +x; turned flat, they run round toward −z, so start just past the slit.)
  const gap = Math.asin((SLIT + 0.16) / R_IN);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(R_IN - 0.06, 0.05, 6, segs * 2, Math.PI * 2 - gap * 2), steel);
  ring.rotation.set(Math.PI / 2, 0, -Math.PI / 2 + gap);
  turret.add(ring);
  const track = new THREE.Mesh(new THREE.TorusGeometry(R_IN - 0.02, 0.035, 6, segs * 2), steel);
  track.rotation.x = Math.PI / 2;
  track.position.set(CENTER.x, LEDGE + 0.05, CENTER.z);
  group.add(track);

  // The work light: a lamp on the dome's back wall, high up, shining across at
  // whatever is under the slit. It turns with the dome, so it lights where you look.
  const work = new THREE.SpotLight('#ffcf9c', 30, 13, 0.46, 1, 1.7);
  work.position.set(0, 0.9, R_IN - 0.4);
  work.target.position.set(0, 1.25 - SPRING, -3.6);
  turret.add(work, work.target);
  const workLamp = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.13, 0.16, 16), steel);
  workLamp.position.copy(work.position).add(new THREE.Vector3(0, 0, 0.12));
  workLamp.rotation.x = 1.2;
  turret.add(workLamp);

  // --- the red lights: small caged lamps low on the wall, and one by the pier --------------------
  const redGlass = new THREE.MeshBasicMaterial({ color: new THREE.Color(3.2, 0.18, 0.1) });
  const cage = new THREE.MeshStandardMaterial({ color: '#15171c', roughness: 0.5, metalness: 0.6 });
  for (const az of [16, 70, 95, 140, 158, 200, 252, 290, 322, 345]) {
    const at = around(az, WALL - CASE - 0.06, 0.22);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.022, 10, 8), redGlass);
    bulb.position.copy(at);
    group.add(bulb);
    const hood = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.05, 10, 1, true), cage);
    hood.position.copy(at).setY(0.24);
    group.add(hood);
  }
  const red = new THREE.PointLight('#ff3018', 1.6, 7, 1.4);
  red.position.copy(around(250, 1.1, 0.3));
  group.add(red);
  // Starlight through the slit, and the faint glow off the inside of the dome.
  group.add(new THREE.HemisphereLight('#3b4866', '#120b08', 0.55));

  let aim = 0;
  return {
    group,
    turret,
    doorLamp,
    books: total,
    lightFrom(out) {
      if (out) work.target.position.set(0, -0.3, 0.6);
      else work.target.position.set(0, 1.25 - SPRING, -3.6);
    },
    setAzimuth(az) {
      aim = az;
      turret.rotation.y = -THREE.MathUtils.degToRad(az);
    },
    tick() {
      void aim;
    },
  };
}
