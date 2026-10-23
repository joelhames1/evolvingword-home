// The bee that lives in the greenhouse: a round, furry bumblebee that potters
// from flower to flower, and when you pick two to cross, carries the pollen
// from the first to the second (leaving a little trail of gold), then the seed
// from there to an empty pot.
import * as THREE from 'three';
import { canvas, texture } from '../../textures';
import { sparkMaterial } from './sparks';

export interface Bee {
  group: THREE.Group;
  /** Flies through these points over `seconds`; resolves on arrival (or when another flight takes over). */
  fly(points: THREE.Vector3[], seconds: number, opts?: { pollen?: boolean; seed?: boolean }): Promise<boolean>;
  /** Where it is (into `out`, if given), and whether it's on the wing. */
  at(out?: THREE.Vector3): THREE.Vector3;
  flying(): boolean;
  /** How hard its wings are going (0..1), for the buzz. */
  buzz(): number;
  /** Lets go of the seed it's carrying (it falls into the pot below). */
  drop(): THREE.Vector3 | null;
  tick(t: number, dt: number): void;
}

function bodyTexture() {
  const [c, g] = canvas(256, 128);
  // Bands round the body, from the head end (u = 0) to the tail: gold, black, gold, black, a white tail.
  const bands: [number, string][] = [
    [0, '#2a2016'],
    [0.18, '#f0b73a'],
    [0.42, '#1e1812'],
    [0.62, '#f2c24a'],
    [0.78, '#1e1812'],
    [0.9, '#f4ecd8'],
  ];
  for (let i = 0; i < bands.length; i++) {
    const [u, col] = bands[i];
    const next = bands[i + 1]?.[0] ?? 1;
    g.fillStyle = col;
    g.fillRect(u * 256, 0, (next - u) * 256 + 1, 128);
  }
  // Fur: little strokes of light and dark all over.
  for (let k = 0; k < 2400; k++) {
    g.strokeStyle = `rgba(${Math.random() < 0.5 ? '255,240,200' : '0,0,0'},${Math.random() * 0.18})`;
    g.lineWidth = 1;
    const x = Math.random() * 256;
    const y = Math.random() * 128;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + (Math.random() - 0.5) * 4, y + (Math.random() - 0.5) * 4);
    g.stroke();
  }
  return texture(c);
}

function wingTexture() {
  const [c, g] = canvas(128, 64);
  const grad = g.createLinearGradient(0, 0, 128, 0);
  grad.addColorStop(0, 'rgba(230,240,255,0.65)');
  grad.addColorStop(1, 'rgba(220,235,255,0.25)');
  g.fillStyle = grad;
  g.beginPath();
  g.ellipse(64, 32, 62, 28, 0, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = 'rgba(60,50,40,0.5)';
  g.lineWidth = 2;
  g.stroke();
  for (const y of [22, 34, 44]) {
    g.beginPath();
    g.moveTo(4, 32);
    g.quadraticCurveTo(60, y, 118, y);
    g.stroke();
  }
  return texture(c);
}

export function buildBee(): Bee {
  const group = new THREE.Group();
  const bee = new THREE.Group();
  group.add(bee);
  // Built facing +z, 3 cm long: a body, a head, two pairs of wings, antennae.
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.011, 16, 12), new THREE.MeshStandardMaterial({ map: bodyTexture(), roughness: 0.9 }));
  body.scale.set(1, 0.92, 1.45);
  body.rotation.y = Math.PI / 2;
  body.castShadow = true;
  bee.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.0065, 12, 8), new THREE.MeshStandardMaterial({ color: '#1a1410', roughness: 0.6 }));
  head.position.z = 0.017;
  bee.add(head);
  const antenna = new THREE.CylinderGeometry(0.0006, 0.0006, 0.01, 4);
  antenna.translate(0, 0.005, 0);
  for (const s of [-1, 1]) {
    const a = new THREE.Mesh(antenna, head.material);
    a.position.set(s * 0.0025, 0.004, 0.021);
    a.rotation.set(0.9, 0, s * 0.35);
    bee.add(a);
  }
  const wingMat = new THREE.MeshBasicMaterial({ map: wingTexture(), transparent: true, depthWrite: false, side: THREE.DoubleSide });
  const wingGeo = new THREE.PlaneGeometry(0.022, 0.011);
  wingGeo.translate(0.011, 0, 0);
  const wings: THREE.Mesh[] = [];
  for (const s of [-1, 1])
    for (const k of [0, 1]) {
      const w = new THREE.Mesh(wingGeo, wingMat);
      w.position.set(s * 0.004, 0.009, 0.004 - k * 0.006);
      w.scale.set(s * (k ? 0.8 : 1), 1, 1);
      w.rotation.set(-Math.PI / 2, 0, 0);
      w.userData = { side: s, k };
      // (After the house's glass, so the wings aren't fogged by panes behind them.)
      w.renderOrder = 4;
      wings.push(w);
      bee.add(w);
    }

  // A little trail of pollen, and the seed it carries.
  const TRAIL = 24;
  const trailPos = new Float32Array(TRAIL * 3);
  const trailAge = new Float32Array(TRAIL).fill(9);
  const trailGeo = new THREE.BufferGeometry();
  trailGeo.setAttribute('position', new THREE.BufferAttribute(trailPos, 3));
  trailGeo.setAttribute('aAge', new THREE.BufferAttribute(trailAge, 1));
  // Gold, fading over a second and a half, a little bigger while fresh.
  const trail = new THREE.Points(trailGeo, sparkMaterial({ color: new THREE.Color(1, 0.78, 0.3).multiplyScalar(1.6), life: 1.4, fade: true, size: 5, max: 14, grow: true, soft: 0 }));
  trail.frustumCulled = false;
  group.add(trail);
  const seed = new THREE.Mesh(new THREE.SphereGeometry(0.006, 8, 6), new THREE.MeshStandardMaterial({ color: '#5a3a1c', roughness: 0.6 }));
  seed.scale.set(0.8, 0.8, 1.3);
  seed.visible = false;
  group.add(seed);
  let falling: { from: THREE.Vector3; t: number } | null = null;

  let path: THREE.CatmullRomCurve3 | null = null;
  let t0 = 0;
  let span = 1;
  let now = 0;
  let done: ((ok: boolean) => void) | null = null;
  let pollen = false;
  let speed = 0;
  let trailNext = 0;
  let trailLive = false;
  const pos = new THREE.Vector3(-2.6, 1.4, -1.4);
  const last = pos.clone();
  const look = new THREE.Vector3(0, 0, 1);
  const step = new THREE.Vector3();
  const aim = new THREE.Vector3();
  const below = new THREE.Vector3(0, -0.012, 0);
  bee.position.copy(pos);

  return {
    group,
    fly(points, seconds, opts = {}) {
      done?.(false);
      path = new THREE.CatmullRomCurve3([pos.clone(), ...points.map((p) => p.clone())], false, 'centripetal');
      t0 = now;
      span = Math.max(0.3, seconds);
      pollen = !!opts.pollen;
      seed.visible = !!opts.seed;
      return new Promise((resolve) => (done = resolve));
    },
    at: (out) => (out ? out.copy(pos) : pos.clone()),
    flying: () => !!path,
    // On the wing it buzzes; resting on a flower it's quiet.
    buzz: () => (path ? 1 : 0),
    drop() {
      if (!seed.visible) return null;
      seed.visible = false;
      falling = { from: pos.clone().add(new THREE.Vector3(0, -0.01, 0)), t: 0 };
      return falling.from.clone();
    },
    tick(t, dt) {
      now = t;
      if (path) {
        const k = Math.min(1, (t - t0) / span);
        // Ease in and out, with a lazy weave on the way.
        const e = k * k * (3 - 2 * k);
        path.getPoint(e, pos);
        pos.y += Math.sin(t * 7.3) * 0.006 * Math.sin(Math.PI * k);
        pos.x += Math.sin(t * 4.1) * 0.008 * Math.sin(Math.PI * k);
        if (k >= 1) {
          path = null;
          const d = done;
          done = null;
          d?.(true);
        }
      } else {
        // Resting on a flower: a little shuffle now and then.
        pos.y += Math.sin(t * 2.3) * 0.00004;
      }
      speed = last.distanceTo(pos) / Math.max(dt, 1e-3);
      if (last.distanceToSquared(pos) > 1e-8) look.lerp(step.subVectors(pos, last).normalize(), 0.25);
      last.copy(pos);
      bee.position.copy(pos);
      if (look.lengthSq() > 1e-6) bee.lookAt(aim.set(pos.x + look.x, pos.y + look.y * 0.3, pos.z + look.z));
      // Wings: a blur in flight, folded and still at rest.
      const beat = path || speed > 0.05 ? Math.sin(t * 140) : 0;
      for (const w of wings) w.rotation.z = (w.userData.side as number) * (path || speed > 0.05 ? 0.35 + beat * 0.65 : 0.15);
      // The pollen trail (uploaded only while some of it is still in the air).
      let glowing = false;
      for (let i = 0; i < TRAIL; i++) {
        trailAge[i] = Math.min(9, trailAge[i] + dt);
        glowing ||= trailAge[i] < 1.5;
      }
      if (pollen && path && t > trailNext) {
        trailNext = t + 0.05;
        const i = Math.floor(t * 20) % TRAIL;
        pos.toArray(trailPos, i * 3);
        trailAge[i] = 0;
        glowing = true;
      }
      if (glowing || trailLive) {
        trailGeo.attributes.position.needsUpdate = true;
        trailGeo.attributes.aAge.needsUpdate = true;
      }
      trailLive = glowing;
      if (seed.visible && !falling) seed.position.copy(pos).add(below);
      if (falling) {
        // A short drop into the soil.
        falling.t += dt;
        seed.visible = falling.t < 0.24;
        seed.position.copy(falling.from);
        seed.position.y -= 4.9 * falling.t * falling.t;
        if (falling.t >= 0.24) falling = null;
      }
    },
  };
}
