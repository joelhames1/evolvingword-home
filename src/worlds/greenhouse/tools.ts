// The gardener's tools, at the end of the staging: a galvanized watering can on
// the floor, shears and a hand lens on a little rack, and the compost bin
// tucked under the staging. Each one goes and does its job when asked: the can
// lifts over a plant and pours, the shears snip, the lens hovers in front of a
// flower, and the bin takes what you don't want with a thunk of its lid.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CAN, COMPOST, RACK } from './plan';

const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

/** A move of an object from one pose to another along an arc, over a time. */
interface Move {
  obj: THREE.Object3D;
  from: { p: THREE.Vector3; q: THREE.Quaternion };
  to: { p: THREE.Vector3; q: THREE.Quaternion };
  lift: number;
  t0: number;
  span: number;
  done: () => void;
}

export interface Tools {
  group: THREE.Group;
  can: THREE.Object3D;
  shears: THREE.Object3D;
  lens: THREE.Object3D;
  bin: THREE.Object3D;
  /** The can goes over to `top` (a plant's top), pours for a moment, and goes home. */
  water(top: THREE.Vector3): Promise<void>;
  /** The shears go to `at`, snip twice, and go home. */
  snip(at: THREE.Vector3): Promise<void>;
  /** The lens hovers at `at`, facing `from` (the camera); null puts it back on its hook. */
  hold(at: THREE.Vector3 | null, from?: THREE.Vector3): void;
  /** A clod of plant flies from `from` into the bin, and the lid comes down. Resolves on the thunk. */
  compost(from: THREE.Vector3, color: THREE.Color): Promise<void>;
  busy(): boolean;
  tick(t: number, dt: number): void;
}

const plain = (g: THREE.BufferGeometry) => {
  const out = g.index ? g.toNonIndexed() : g;
  for (const k of Object.keys(out.attributes)) if (!['position', 'normal'].includes(k)) out.deleteAttribute(k);
  return out;
};

/** A tube from a to b. */
function tube(a: THREE.Vector3, b: THREE.Vector3, r0: number, r1 = r0, sides = 10) {
  const geo = new THREE.CylinderGeometry(r1, r0, a.distanceTo(b), sides, 1);
  geo.applyMatrix4(new THREE.Matrix4().compose(a.clone().add(b).multiplyScalar(0.5), new THREE.Quaternion().setFromUnitVectors(v(0, 1, 0), b.clone().sub(a).normalize()), v(1, 1, 1)));
  return geo;
}

export function buildTools(wood: THREE.Material): Tools {
  const group = new THREE.Group();
  const zinc = new THREE.MeshStandardMaterial({ color: '#a7aeaa', metalness: 0.75, roughness: 0.42 });
  const brass = new THREE.MeshStandardMaterial({ color: '#c39a52', metalness: 0.9, roughness: 0.3 });
  const steel = new THREE.MeshStandardMaterial({ color: '#c8ccd0', metalness: 0.9, roughness: 0.25 });
  const handleWood = new THREE.MeshStandardMaterial({ color: '#8a5a32', roughness: 0.55 });

  // --- the watering can: built with its spout toward +x, its foot at the origin ----------------------
  const can = new THREE.Group();
  const canParts = [
    new THREE.CylinderGeometry(0.095, 0.105, 0.21, 24, 1).translate(0, 0.105, 0),
    new THREE.CylinderGeometry(0.1, 0.1, 0.012, 24).translate(0, 0.214, 0),
    tube(v(0.07, 0.05, 0), v(0.31, 0.27, 0), 0.016, 0.011),
    new THREE.CylinderGeometry(0.03, 0.014, 0.03, 16).rotateZ(-Math.PI / 4.4).translate(0.325, 0.285, 0),
    new THREE.TorusGeometry(0.1, 0.009, 6, 20, Math.PI).translate(0, 0.22, 0),
    tube(v(-0.1, 0.06, 0), v(-0.13, 0.19, 0), 0.008),
  ];
  const canMesh = new THREE.Mesh(mergeGeometries(canParts.map(plain)), zinc);
  canMesh.castShadow = true;
  can.add(canMesh);
  // Where the water comes out: the rose.
  const rose = new THREE.Object3D();
  rose.position.set(0.335, 0.295, 0);
  can.add(rose);
  const canHome = { p: CAN.clone(), q: new THREE.Quaternion().setFromAxisAngle(v(0, 1, 0), 2.5) };
  can.position.copy(canHome.p);
  can.quaternion.copy(canHome.q);
  group.add(can);

  // --- the rack, with the shears and the lens on their pegs -----------------------------------------
  const rack = new THREE.Group();
  const post = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.35, 0.06), wood);
  post.position.set(0, 0.675, 0);
  post.castShadow = true;
  rack.add(post);
  const board = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.3, 0.36), wood);
  board.position.set(0.045, 1.15, 0);
  board.castShadow = true;
  rack.add(board);
  for (const z of [-0.1, 0.1]) {
    const peg = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.05, 8), brass);
    peg.rotation.z = Math.PI / 2;
    peg.position.set(0.075, 1.22, z);
    rack.add(peg);
  }
  rack.position.copy(RACK);
  group.add(rack);

  // The shears: two steel blades on a pivot, wooden handles. Built pointing +y, pivot at the origin.
  const shears = new THREE.Group();
  const blades: THREE.Group[] = [];
  for (const s of [-1, 1]) {
    const half = new THREE.Group();
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.12, 0.004), steel);
    blade.geometry.translate(0, 0.06, 0);
    blade.position.z = s * 0.0025;
    half.add(blade);
    const grip = new THREE.Mesh(tube(v(0, 0, 0), v(s * 0.02, -0.15, 0), 0.009, 0.011, 8), handleWood);
    half.add(grip);
    blades.push(half);
    shears.add(half);
  }
  const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.014, 10), brass);
  pin.rotation.x = Math.PI / 2;
  shears.add(pin);
  shears.traverse((o) => (o.castShadow = true));
  const shearsHome = { p: RACK.clone().add(v(0.085, 1.16, 0.1)), q: new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.PI / 2, Math.PI)) };
  shears.position.copy(shearsHome.p);
  shears.quaternion.copy(shearsHome.q);
  group.add(shears);

  // The hand lens: a brass ring with its glass, on a turned handle. Built facing +z.
  const lens = new THREE.Group();
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.006, 8, 32), brass);
  lens.add(ring);
  const glass = new THREE.Mesh(new THREE.CircleGeometry(0.044, 32), new THREE.MeshStandardMaterial({ color: '#dfeef0', transparent: true, opacity: 0.16, roughness: 0.05, metalness: 0.2, depthWrite: false }));
  lens.add(glass);
  const handle = new THREE.Mesh(tube(v(0, -0.05, 0), v(0, -0.14, 0), 0.008, 0.01), handleWood);
  lens.add(handle);
  lens.traverse((o) => (o.castShadow = o !== glass));
  const lensHome = { p: RACK.clone().add(v(0.09, 1.3, -0.1)), q: new THREE.Quaternion().setFromAxisAngle(v(0, 1, 0), Math.PI / 2) };
  lens.position.copy(lensHome.p);
  lens.quaternion.copy(lensHome.q);
  group.add(lens);

  // --- the compost bin, slatted, with a lid hinged at the back --------------------------------------
  const bin = new THREE.Group();
  const { w, d, h } = COMPOST;
  const slats: THREE.BufferGeometry[] = [];
  for (let k = 0; k < 5; k++) {
    const y = 0.04 + k * (h / 5);
    for (const [sx, sz, lw, ld] of [
      [0, d / 2, w, 0.02],
      [0, -d / 2, w, 0.02],
      [w / 2, 0, 0.02, d],
      [-w / 2, 0, 0.02, d],
    ]) slats.push(new THREE.BoxGeometry(lw, h / 5 - 0.025, ld).translate(sx, y + h / 10, sz));
  }
  for (const [x, z] of [
    [-w / 2, -d / 2],
    [w / 2, -d / 2],
    [-w / 2, d / 2],
    [w / 2, d / 2],
  ]) slats.push(new THREE.BoxGeometry(0.045, h, 0.045).translate(x, h / 2, z));
  const binMesh = new THREE.Mesh(mergeGeometries(slats.map(plain)), wood);
  binMesh.castShadow = true;
  binMesh.receiveShadow = true;
  bin.add(binMesh);
  const heap = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#3a2a1c', roughness: 1 }));
  heap.scale.set(w * 0.46, 0.14, d * 0.44);
  heap.position.y = h * 0.6;
  bin.add(heap);
  const lid = new THREE.Group();
  const lidBoard = new THREE.Mesh(new THREE.BoxGeometry(w + 0.04, 0.025, d + 0.04), wood);
  lidBoard.position.set(0, 0, d / 2 + 0.02);
  lidBoard.castShadow = true;
  lid.add(lidBoard);
  lid.position.set(0, h + 0.012, -d / 2 - 0.02);
  bin.add(lid);
  bin.position.copy(COMPOST.at);
  group.add(bin);
  // The clod that flies into the bin.
  const clod = new THREE.Group();
  const roots = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), new THREE.MeshStandardMaterial({ color: '#3a2818', roughness: 1 }));
  const green = new THREE.Mesh(new THREE.IcosahedronGeometry(0.08, 1), new THREE.MeshStandardMaterial({ color: '#4a7a32', roughness: 0.8 }));
  green.position.y = 0.08;
  green.scale.set(1, 1.4, 1);
  clod.add(roots, green);
  clod.visible = false;
  group.add(clod);

  // --- water: drops from the rose, falling ----------------------------------------------------------
  const DROPS = 60;
  const dropPos = new Float32Array(DROPS * 3);
  const dropVel = new Float32Array(DROPS * 3);
  const dropLife = new Float32Array(DROPS).fill(9);
  const dropGeo = new THREE.BufferGeometry();
  dropGeo.setAttribute('position', new THREE.BufferAttribute(dropPos, 3));
  dropGeo.setAttribute('aLife', new THREE.BufferAttribute(dropLife, 1));
  const drops = new THREE.Points(
    dropGeo,
    new THREE.ShaderMaterial({
      vertexShader: /* glsl */ `
        attribute float aLife;
        varying float vA;
        void main() {
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          vA = step(aLife, 0.9) * smoothstep(0.08, 0.3, -mv.z);
          gl_PointSize = clamp(3.5 / max(-mv.z, 0.05), 1.0, 9.0);
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: /* glsl */ `
        varying float vA;
        void main() {
          float r = length(gl_PointCoord - 0.5) * 2.0;
          gl_FragColor = vec4(vec3(0.75, 0.85, 0.95) * vA * smoothstep(1.0, 0.2, r), 1.0);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  drops.frustumCulled = false;
  group.add(drops);
  let pouring = 0;
  let pourStop = 0;

  // --- moving things about -------------------------------------------------------------------------
  const moves: Move[] = [];
  let now = 0;
  const pose = (o: THREE.Object3D) => ({ p: o.position.clone(), q: o.quaternion.clone() });
  const move = (obj: THREE.Object3D, to: { p: THREE.Vector3; q: THREE.Quaternion }, span: number, lift = 0.15) =>
    new Promise<void>((resolve) => {
      const i = moves.findIndex((m) => m.obj === obj);
      if (i >= 0) moves.splice(i, 1)[0].done();
      moves.push({ obj, from: pose(obj), to, lift, t0: now, span, done: resolve });
    });
  const wait = (s: number) => new Promise<void>((r) => window.setTimeout(r, s * 1000));
  let busy = 0;
  let snipping = 0;
  let lidOpen = 0;
  let lidAim = 0;
  let held = false;

  return {
    group,
    can,
    shears,
    lens,
    bin,
    async water(top) {
      busy++;
      // Over the plant, tipped so the rose is just above it.
      const at = top.clone().add(v(-0.3, 0.2, 0.08));
      const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0.25, -0.5));
      await move(can, { p: at, q }, 0.9, 0.25);
      pouring = 1;
      pourStop = now + 1.5;
      await wait(1.7);
      await move(can, canHome, 0.9, 0.25);
      busy--;
    },
    async snip(at) {
      busy++;
      const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.3, 0, -1.2));
      await move(shears, { p: at.clone().add(v(0.06, 0, 0.1)), q }, 0.8, 0.1);
      snipping = 1.2;
      await wait(1.2);
      await move(shears, shearsHome, 0.8, 0.1);
      busy--;
    },
    hold(at, from) {
      if (!at) {
        if (held) void move(lens, lensHome, 0.8, 0.1);
        held = false;
        return;
      }
      held = true;
      const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().lookAt(at, from ?? at.clone().add(v(0, 0, 1)), v(0, 1, 0)));
      // lookAt points -z at the target; the lens faces +z, so turn it round.
      q.multiply(new THREE.Quaternion().setFromAxisAngle(v(0, 1, 0), Math.PI));
      void move(lens, { p: at, q }, 0.9, 0.06);
    },
    async compost(from, color) {
      busy++;
      (green.material as THREE.MeshStandardMaterial).color.copy(color);
      clod.position.copy(from);
      clod.quaternion.identity();
      clod.visible = true;
      lidAim = 1;
      await wait(0.35);
      await move(clod, { p: COMPOST.at.clone().add(v(0, COMPOST.h + 0.05, 0)), q: new THREE.Quaternion().setFromEuler(new THREE.Euler(0.8, 0.4, 0.3)) }, 1.0, 0.35);
      clod.visible = false;
      lidAim = 0;
      await wait(0.32);
      busy--;
    },
    busy: () => busy > 0 || moves.length > 0,
    tick(t, dt) {
      now = t;
      for (let i = moves.length - 1; i >= 0; i--) {
        const m = moves[i];
        const k = Math.min(1, (t - m.t0) / m.span);
        const e = k * k * (3 - 2 * k);
        m.obj.position.lerpVectors(m.from.p, m.to.p, e);
        m.obj.position.y += Math.sin(Math.PI * e) * m.lift;
        m.obj.quaternion.slerpQuaternions(m.from.q, m.to.q, e);
        if (k >= 1) {
          moves.splice(i, 1);
          m.done();
        }
      }
      // The shears open and close.
      if (snipping > 0) {
        snipping = Math.max(0, snipping - dt);
        const a = Math.abs(Math.sin(snipping * Math.PI * 2.5)) * 0.4;
        blades[0].rotation.z = a;
        blades[1].rotation.z = -a;
      }
      // The lid swings up and drops shut.
      lidOpen += (lidAim - lidOpen) * (1 - Math.exp(-dt * (lidAim > lidOpen ? 6 : 14)));
      lid.rotation.x = -lidOpen * 1.2;
      // Water from the rose while pouring.
      const rosePos = rose.getWorldPosition(scratch);
      for (let i = 0; i < DROPS; i++) {
        dropLife[i] += dt;
        if (pouring && t < pourStop && dropLife[i] > 0.9 && Math.random() < dt * 30) {
          dropLife[i] = 0;
          dropPos[i * 3] = rosePos.x + (Math.random() - 0.5) * 0.03;
          dropPos[i * 3 + 1] = rosePos.y;
          dropPos[i * 3 + 2] = rosePos.z + (Math.random() - 0.5) * 0.03;
          dropVel[i * 3] = 0.35 + (Math.random() - 0.5) * 0.25;
          dropVel[i * 3 + 1] = -0.2;
          dropVel[i * 3 + 2] = (Math.random() - 0.5) * 0.25;
        }
        if (dropLife[i] < 0.9) {
          dropVel[i * 3 + 1] -= 9.8 * dt;
          dropPos[i * 3] += dropVel[i * 3] * dt;
          dropPos[i * 3 + 1] += dropVel[i * 3 + 1] * dt;
          dropPos[i * 3 + 2] += dropVel[i * 3 + 2] * dt;
        }
      }
      if (t >= pourStop) pouring = 0;
      dropGeo.attributes.position.needsUpdate = true;
      dropGeo.attributes.aLife.needsUpdate = true;
    },
  };
}

const scratch = new THREE.Vector3();
