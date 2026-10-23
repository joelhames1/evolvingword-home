// The rest of the train, as it looks from outside: more sleepers behind ours
// and one ahead, their blinds down and lit, and the engine at the front with
// its headlights on and its pantograph up against the wire. None of them can
// be gone into, so each is only a painted shell, merged by material.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { glow } from '../../textures';
import { RAIL_TOP } from './ground';
import { CAR, CARS, COMPARTMENT_STEP, CORRIDOR_WINDOWS, WINDOW } from './plan';

const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

/** The car's cross-section: its sides and the arc of its roof. */
function section(roofTop = CAR.roof) {
  const outer = CAR.outer;
  const rise = roofTop - CAR.shoulder;
  const arcR = (outer * outer + rise * rise) / (2 * rise);
  const cy = roofTop - arcR;
  const half = Math.asin(outer / arcR);
  const pts: THREE.Vector2[] = [new THREE.Vector2(-outer, CAR.skirt)];
  for (let i = 0; i <= 16; i++) {
    const a = -half + (2 * half * i) / 16;
    pts.push(new THREE.Vector2(Math.sin(a) * arcR, cy + Math.cos(a) * arcR));
  }
  pts.push(new THREE.Vector2(outer, CAR.skirt));
  return pts;
}

/** A shell along x from x0 to x1 with the given cross-section, its ends closed. */
function shell(x0: number, x1: number, pts: THREE.Vector2[]) {
  const pos: number[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p = pts[i];
    const q = pts[i + 1];
    pos.push(x0, p.y, p.x, x1, p.y, p.x, x1, q.y, q.x, x0, p.y, p.x, x1, q.y, q.x, x0, q.y, q.x);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  const ends = new THREE.ShapeGeometry(new THREE.Shape(pts));
  const a = ends.clone().rotateY(-Math.PI / 2).translate(x0, 0, 0);
  const b = ends.clone().rotateY(Math.PI / 2).translate(x1, 0, 0);
  const all = mergeGeometries([g, a.toNonIndexed(), b.toNonIndexed()].map((x) => {
    x.deleteAttribute('uv');
    if (!x.attributes.normal) x.computeVertexNormals();
    return x;
  }))!;
  return all;
}

const boxGeo = (w: number, h: number, d: number, x: number, y: number, z: number) => {
  const g = new THREE.BoxGeometry(w, h, d).translate(x, y, z);
  g.deleteAttribute('uv');
  return g;
};

export function buildConsist(materials: { paint: THREE.Material; roofMat: THREE.Material; iron: THREE.Material; gold: THREE.Material }) {
  const group = new THREE.Group();
  group.name = 'consist';
  const paint: THREE.BufferGeometry[] = [];
  const roof: THREE.BufferGeometry[] = [];
  const iron: THREE.BufferGeometry[] = [];
  const gold: THREE.BufferGeometry[] = [];
  const lit: THREE.BufferGeometry[] = [];
  const dark: THREE.BufferGeometry[] = [];
  const pts = section();
  const W = WINDOW;
  const ww = W.x1 - W.x0;
  const wh = W.y1 - W.y0;

  const bogie = (bx: number) => {
    iron.push(boxGeo(3.0, 0.28, 2.0, bx, -0.72, 0));
    for (const ax of [-1.25, 1.25])
      for (const az of [-0.75, 0.75]) {
        const w = new THREE.CylinderGeometry(0.46, 0.46, 0.12, 16).rotateX(Math.PI / 2).translate(bx + ax, RAIL_TOP + 0.46, az);
        w.deleteAttribute('uv');
        iron.push(w);
      }
  };

  // The sleepers: our car's twin, ahead and behind.
  CARS.slice(0, 4).forEach(([a, b], k) => {
    // (Their front is the +x end; the compartments run back from it, the corridor on the other side.)
    const front = b;
    const back = a;
    const len = front - back;
    // Body: the sides are drawn a hair inside the windows, which sit flush on top.
    paint.push(shell(back, front, pts));
    // Lower body, and the frame under it.
    iron.push(boxGeo(len, 0.36, 2 * CAR.outer - 0.06, (back + front) / 2, CAR.skirt - 0.16, 0));
    for (const ex of [-12.5, -8, -4.5]) iron.push(boxGeo(1.6, 0.5, 1.6, front - 3.5 + ex + 3.5, CAR.skirt - 0.5, 0.3));
    bogie(front - 3.2);
    bogie(back + 3.2);
    // Bellows to the next car.
    iron.push(boxGeo(1.0, 2.3, 1.3, front + 0.5, 1.1, 0));
    // Gold lines.
    for (const z of [-CAR.outer - 0.004, CAR.outer + 0.004]) for (const y of [0.66, 1.98]) gold.push(boxGeo(len, 0.018, 0.004, (back + front) / 2, y, z));
    // The compartments' windows on the window side, blinds down, lit or dark.
    for (let c = 0; c < 7; c++) {
      const cx = front - CAR.front + (W.x0 + W.x1) / 2 - c * COMPARTMENT_STEP;
      const on = (c * 7 + k * 3) % 5 !== 0;
      const g = new THREE.PlaneGeometry(ww, wh).rotateY(Math.PI).translate(cx, (W.y0 + W.y1) / 2, -CAR.outer - 0.005);
      g.deleteAttribute('uv');
      (on ? lit : dark).push(g);
    }
    // The corridor's windows on the other side: lit all along.
    for (let c = 0; c < CORRIDOR_WINDOWS.count; c++) {
      const cx = front - CAR.front + CORRIDOR_WINDOWS.first + c * CORRIDOR_WINDOWS.step;
      const g = new THREE.PlaneGeometry(CORRIDOR_WINDOWS.width, CORRIDOR_WINDOWS.y1 - CORRIDOR_WINDOWS.y0).translate(cx, (CORRIDOR_WINDOWS.y0 + CORRIDOR_WINDOWS.y1) / 2, CAR.outer + 0.005);
      g.deleteAttribute('uv');
      lit.push(g);
    }
    for (let r = 0; r < 8; r++) roof.push(boxGeo(0.5, 0.12, 0.5, back + 2 + r * 2.9, CAR.roof + 0.04, 0));
  });

  // The engine: a long body with a sloped cab at the front, louvres, a pantograph up to the wire.
  const [ea, eb] = CARS[4];
  const elen = eb - ea;
  const epts = section(CAR.roof + 0.15);
  paint.push(shell(ea, eb - 1.6, epts));
  // The cab's nose: tapered toward the front.
  const nose = new THREE.BufferGeometry();
  const n0 = eb - 1.6;
  const n1 = eb;
  const npos: number[] = [];
  for (let i = 0; i < epts.length - 1; i++) {
    const p = epts[i];
    const q = epts[i + 1];
    // The front face leans back: at the top it's 1.4 m behind the bottom.
    const tip = (y: number) => n1 - Math.max(0, (y - 0.9) / (CAR.roof + 0.15 - 0.9)) * 1.4;
    const s = 0.93;
    npos.push(n0, p.y, p.x, tip(p.y), p.y, p.x * s, tip(q.y), q.y, q.x * s, n0, p.y, p.x, tip(q.y), q.y, q.x * s, n0, q.y, q.x);
  }
  nose.setAttribute('position', new THREE.Float32BufferAttribute(npos, 3));
  nose.computeVertexNormals();
  paint.push(nose);
  // Its front face, flat between the tapered sides.
  const face = new THREE.BufferGeometry().setFromPoints([v(n1, CAR.skirt, -CAR.outer * 0.93), v(n1, CAR.skirt, CAR.outer * 0.93), v(n1 - 1.4, CAR.roof + 0.1, CAR.outer * 0.6), v(n1, CAR.skirt, -CAR.outer * 0.93), v(n1 - 1.4, CAR.roof + 0.1, CAR.outer * 0.6), v(n1 - 1.4, CAR.roof + 0.1, -CAR.outer * 0.6)]);
  face.computeVertexNormals();
  paint.push(face);
  // The windscreen, dark with a glow of instruments; the side windows of the cab.
  const screen = new THREE.BufferGeometry().setFromPoints([v(n1 - 0.62, 1.4, -1.25), v(n1 - 0.62, 1.4, 1.25), v(n1 - 1.18, 2.4, 1.0), v(n1 - 0.62, 1.4, -1.25), v(n1 - 1.18, 2.4, 1.0), v(n1 - 1.18, 2.4, -1.0)]);
  screen.computeVertexNormals();
  dark.push(screen);
  for (const z of [-CAR.outer - 0.005, CAR.outer + 0.005]) {
    const g = new THREE.PlaneGeometry(0.9, 0.7).rotateY(z < 0 ? Math.PI : 0).translate(n0 - 0.7, 1.75, z);
    g.deleteAttribute('uv');
    dark.push(g);
    // Louvres along the engine room.
    for (let i = 0; i < 9; i++) {
      const lg = new THREE.PlaneGeometry(1.1, 0.9).rotateY(z < 0 ? Math.PI : 0).translate(ea + 2 + i * 1.5, 1.6, z * 1.001);
      lg.deleteAttribute('uv');
      iron.push(lg);
    }
    gold.push(boxGeo(elen, 0.05, 0.004, (ea + eb) / 2, 0.9, z));
  }
  iron.push(boxGeo(elen, 0.4, 2 * CAR.outer - 0.06, (ea + eb) / 2, CAR.skirt - 0.18, 0));
  bogie(ea + 3.6);
  bogie(eb - 4.2);
  // The pantograph: a frame folded up from the roof to the wire, and its head under the wire.
  const wire = RAIL_TOP + 5.1;
  const base = CAR.roof + 0.2;
  const px = ea + 5;
  const arm = (a: THREE.Vector3, b: THREE.Vector3) => {
    const g = new THREE.CylinderGeometry(0.025, 0.025, a.distanceTo(b), 6);
    g.deleteAttribute('uv');
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(v(0, 1, 0), b.clone().sub(a).normalize()));
    g.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
    iron.push(g);
  };
  for (const z of [-0.4, 0.4]) {
    arm(v(px - 0.9, base, z), v(px + 0.4, (base + wire) / 2 + 0.1, z * 0.6));
    arm(v(px + 0.4, (base + wire) / 2 + 0.1, z * 0.6), v(px - 0.2, wire - 0.08, z * 0.3));
  }
  iron.push(boxGeo(0.1, 0.06, 1.7, px - 0.2, wire - 0.05, 0));
  for (const z of [-0.6, 0.6]) iron.push(boxGeo(0.25, 0.2, 0.25, px - 0.9, base - 0.05, z));
  roof.push(boxGeo(6, 0.3, 1.8, ea + 11, CAR.roof + 0.25, 0));

  const add = (list: THREE.BufferGeometry[], mat: THREE.Material) => {
    if (!list.length) return;
    for (const g of list) if (g.attributes.uv) g.deleteAttribute('uv');
    const m = new THREE.Mesh(mergeGeometries(list.map((g) => (g.index ? g.toNonIndexed() : g)))!, mat);
    group.add(m);
    return m;
  };
  const sideMat = (m: THREE.Material) => {
    const c = m.clone();
    c.side = THREE.DoubleSide;
    return c;
  };
  add(paint, sideMat(materials.paint));
  add(roof, materials.roofMat);
  add(iron, sideMat(materials.iron));
  add(gold, materials.gold);
  add(lit, new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffb86a').multiplyScalar(0.9) }));
  add(dark, new THREE.MeshStandardMaterial({ color: '#141a22', roughness: 0.15, metalness: 0.5, emissive: new THREE.Color('#2a3a2c'), emissiveIntensity: 0.4, side: THREE.DoubleSide }));

  // Headlights: two low, one high, and their glow.
  const beam = new THREE.SpriteMaterial({ map: glow('rgba(255,250,235,1)', 64), color: '#fff4dc', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  for (const [y, z, s] of [
    [0.25, -0.95, 1.4],
    [0.25, 0.95, 1.4],
    [2.65, 0, 1.0],
  ] as const) {
    const sp = new THREE.Sprite(beam);
    sp.position.set(eb + 0.05 - (y > 1 ? 1.25 : 0), y, z);
    sp.scale.setScalar(s);
    group.add(sp);
  }
  // A spark at the pantograph now and then: kept, and lit by the kit.
  const arc = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow('rgba(170,200,255,1)', 64), color: '#b8ccff', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }));
  arc.position.set(px - 0.2, wire, 0);
  arc.scale.setScalar(2.4);
  group.add(arc);
  return {
    group,
    /** The pantograph's flash, 0..1. */
    flash(k: number) {
      arc.material.opacity = k;
    },
    /** Where the engine's horn is. */
    horn: v(eb - 2, CAR.roof, 0),
  };
}
