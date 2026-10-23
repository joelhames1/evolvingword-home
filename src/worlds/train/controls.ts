// The three things on the window wall you can pull: the junction lever (it
// lights up when points are coming, and which way it leans is which way the
// train goes), the red emergency brake, and the cord for the engine's horn.
// Each one moves the way its real one would: the lever swings over and
// bounces against its stop, the brake handle drops and stays down until the
// train moves again, the cord stretches and springs back.
import * as THREE from 'three';
import { canvas, glow, texture } from '../../textures';
import { NAMES, type Land } from './journey';
import { ceilingAt, ROOM } from './plan';

const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

/** Where they are, on the window wall. */
export const LEVER_AT = v(1.17, 1.4, ROOM.z0);
export const BRAKE_AT = v(-1.05, 1.6, ROOM.z0);
export const CORD_AT = v(-0.76, 0, ROOM.z0 + 0.1);

export type LeverState = 'idle' | 'live' | 'locked';

/** The lever's two little enamel tabs: the branch names, the one it's set for lit. */
function tabs(names: [string, string] | null, set: 0 | 1, state: LeverState, g: CanvasRenderingContext2D) {
  g.fillStyle = '#0d0f12';
  g.fillRect(0, 0, 512, 128);
  for (const i of [0, 1] as const) {
    const x = 8 + i * 252;
    const on = names && (state === 'live' || state === 'locked') && set === i;
    g.fillStyle = on ? '#f4ead2' : '#2a2b2e';
    g.fillRect(x, 10, 244, 108);
    g.strokeStyle = on ? '#c9a35a' : '#3a3b3e';
    g.lineWidth = 6;
    g.strokeRect(x + 4, 14, 236, 100);
    g.fillStyle = on ? '#1a1410' : '#5a5b5e';
    g.font = '700 50px "Space Mono", monospace';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    const label = names ? names[i].replace(/^The /, '').toUpperCase() : '';
    g.fillText(label, x + 122, 66);
    // An arrow under each: which way the lever leans for it.
    g.fillStyle = on ? '#9c2a22' : '#3a3b3e';
    g.beginPath();
    if (i === 0) g.moveTo(x + 30, 100), g.lineTo(x + 50, 90), g.lineTo(x + 50, 110);
    else g.moveTo(x + 214, 100), g.lineTo(x + 194, 90), g.lineTo(x + 194, 110);
    g.fill();
  }
}

export interface Controls {
  group: THREE.Group;
  lever: THREE.Object3D;
  brake: THREE.Object3D;
  cord: THREE.Object3D;
  /** Shows which junction is coming, which way it's set, and whether it can still be changed. */
  setLever(branches: [Land, Land] | null, set: 0 | 1, state: LeverState): void;
  /** The lever's been thrown: swing it over with a bounce. */
  throwLever(): void;
  /** The brake handle down (pulled) or back up. */
  setBrake(down: boolean): void;
  /** A pull on the cord. */
  pullCord(): void;
  tick(t: number, dt: number): void;
}

export function buildControls(materials: { brass: THREE.Material; iron: THREE.Material }): Controls {
  const group = new THREE.Group();
  group.name = 'controls';
  const { brass, iron } = materials;
  const steel = new THREE.MeshStandardMaterial({ color: '#9aa0a8', roughness: 0.25, metalness: 0.95 });
  const red = new THREE.MeshStandardMaterial({ color: '#a8221c', roughness: 0.35, metalness: 0.1 });

  // --- the lever -------------------------------------------------------------------------
  const lever = new THREE.Group();
  lever.position.copy(LEVER_AT);
  group.add(lever);
  const plate = new THREE.Mesh(new THREE.BoxGeometry(0.27, 0.64, 0.022), iron);
  plate.position.set(0, 0.26, 0.011);
  lever.add(plate);
  const rim = new THREE.Mesh(new THREE.BoxGeometry(0.29, 0.66, 0.012), brass);
  rim.position.set(0, 0.26, 0.006);
  lever.add(rim);
  // The tabs, and the lamp over them.
  const [tc, tg] = canvas(512, 128);
  const tabTex = texture(tc);
  const tabMat = new THREE.MeshBasicMaterial({ map: tabTex, color: new THREE.Color(0.85, 0.82, 0.76) });
  const tabMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.24, 0.06), tabMat);
  tabMesh.position.set(0, 0.45, 0.024);
  lever.add(tabMesh);
  const lens = new THREE.MeshBasicMaterial({ color: '#2a1a10' });
  const lamp = new THREE.Mesh(new THREE.CircleGeometry(0.024, 24), lens);
  lamp.position.set(0, 0.53, 0.026);
  lever.add(lamp);
  const bezel = new THREE.Mesh(new THREE.TorusGeometry(0.027, 0.006, 8, 24), brass);
  bezel.position.set(0, 0.53, 0.026);
  lever.add(bezel);
  const lampGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow('rgba(255,190,90,1)', 64), color: '#ffb44a', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }));
  lampGlow.position.set(0, 0.53, 0.04);
  lampGlow.scale.setScalar(0.16);
  lever.add(lampGlow);
  // The quadrant it moves in, with a notch at each end.
  const quadrant = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.008, 6, 24, 1.1), brass);
  quadrant.rotation.z = Math.PI / 2 - 0.55;
  quadrant.position.set(0, 0, 0.03);
  lever.add(quadrant);
  for (const s of [-1, 1]) {
    const stop = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.03, 0.02), brass);
    stop.position.set(Math.sin(s * 0.55) * 0.26, Math.cos(0.55) * 0.26, 0.032);
    lever.add(stop);
  }
  // The arm itself, from its pivot at the bottom: steel rod, a catch alongside, a brass grip.
  const arm = new THREE.Group();
  arm.position.set(0, 0, 0.05);
  lever.add(arm);
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.04, 16).rotateX(Math.PI / 2), brass);
  arm.add(hub);
  const rodMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.014, 0.33, 10), steel);
  rodMesh.position.y = 0.165;
  arm.add(rodMesh);
  const catchRod = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.22, 6), steel);
  catchRod.position.set(0.02, 0.2, 0.004);
  arm.add(catchRod);
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.019, 0.017, 0.1, 14), brass);
  grip.position.y = 0.37;
  arm.add(grip);
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.021, 14, 10), brass);
  knob.position.y = 0.425;
  arm.add(knob);
  // A generous invisible handle for clicking.
  const leverHit = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.7, 0.1), new THREE.MeshBasicMaterial({ visible: false }));
  leverHit.position.set(0, 0.27, 0.05);
  lever.add(leverHit);

  // --- the brake -------------------------------------------------------------------------
  const brake = new THREE.Group();
  brake.position.copy(BRAKE_AT);
  group.add(brake);
  const bbox = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.36, 0.04), red);
  bbox.position.set(0, 0, 0.02);
  brake.add(bbox);
  const recess = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.18, 0.01), iron);
  recess.position.set(0, -0.05, 0.041);
  brake.add(recess);
  const [lc, lg] = canvas(512, 160);
  lg.fillStyle = '#efe8d8';
  lg.fillRect(0, 0, 512, 160);
  lg.fillStyle = '#a8221c';
  lg.font = '700 52px "Space Mono", monospace';
  lg.textAlign = 'center';
  lg.textBaseline = 'middle';
  lg.fillText('EMERGENCY', 256, 52);
  lg.fillStyle = '#1a1410';
  lg.font = '400 38px "Space Mono", monospace';
  lg.fillText('PULL TO STOP THE TRAIN', 256, 116);
  const label = new THREE.Mesh(new THREE.PlaneGeometry(0.26, 0.08), new THREE.MeshStandardMaterial({ map: texture(lc), roughness: 0.6 }));
  label.position.set(0, 0.12, 0.0415);
  brake.add(label);
  const handle = new THREE.Group();
  handle.position.set(0, 0.02, 0.05);
  brake.add(handle);
  for (const s of [-1, 1]) {
    const a = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.13, 0.016), red);
    a.position.set(s * 0.09, -0.065, 0);
    handle.add(a);
    const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.02, 10).rotateZ(Math.PI / 2), brass);
    pin.position.set(s * 0.09, 0, 0);
    handle.add(pin);
  }
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.017, 0.2, 14).rotateZ(Math.PI / 2), red);
  bar.position.set(0, -0.13, 0);
  handle.add(bar);
  const brakeHit = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.42, 0.12), new THREE.MeshBasicMaterial({ visible: false }));
  brakeHit.position.set(0, 0, 0.05);
  brake.add(brakeHit);

  // --- the horn's cord ---------------------------------------------------------------------
  const cord = new THREE.Group();
  const top = ceilingAt(CORD_AT.z) - 0.02;
  cord.position.set(CORD_AT.x, top, CORD_AT.z);
  group.add(cord);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.016, 0.005, 8, 16), brass);
  ring.position.y = -0.01;
  cord.add(ring);
  const [cc, cg] = canvas(16, 256);
  for (let y = 0; y < 256; y += 16) {
    cg.fillStyle = (y / 16) % 2 ? '#e8e0d0' : '#9c2a22';
    cg.beginPath();
    cg.moveTo(0, y);
    cg.lineTo(16, y + 8);
    cg.lineTo(16, y + 16);
    cg.lineTo(0, y + 8);
    cg.fill();
    cg.fillStyle = (y / 16) % 2 ? '#9c2a22' : '#e8e0d0';
    cg.beginPath();
    cg.moveTo(0, y + 8);
    cg.lineTo(16, y + 16);
    cg.lineTo(16, y + 24);
    cg.lineTo(0, y + 16);
    cg.fill();
  }
  const cordTex = texture(cc, { repeat: [1, 6] });
  const len = top - 1.82;
  const string = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, len, 8), new THREE.MeshStandardMaterial({ map: cordTex, roughness: 0.8 }));
  string.position.y = -len / 2 - 0.02;
  cord.add(string);
  const toggle = new THREE.Group();
  toggle.position.y = -len - 0.03;
  cord.add(toggle);
  const wood = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.1, 12).rotateZ(Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#3a1a0a', roughness: 0.35 }));
  toggle.add(wood);
  for (const s of [-1, 1]) {
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.016, 10, 8), brass);
    cap.position.x = s * 0.052;
    toggle.add(cap);
  }
  const cordHit = new THREE.Mesh(new THREE.BoxGeometry(0.16, len + 0.12, 0.12), new THREE.MeshBasicMaterial({ visible: false }));
  cordHit.position.y = -len / 2 - 0.04;
  cord.add(cordHit);

  // --- state and motion ----------------------------------------------------------------------
  let names: [string, string] | null = null;
  let set: 0 | 1 = 0;
  let state: LeverState = 'idle';
  const angle = { at: -0.42, vel: 0 };
  let brakeAim = 0;
  let brakeAt = 0;
  let cordPull = -1;
  let shake = 0;
  const redraw = () => {
    tabs(names, set, state, tg);
    tabTex.needsUpdate = true;
  };
  redraw();

  return {
    group,
    lever: lever,
    brake,
    cord,
    setLever(branches, s, st) {
      const n: [string, string] | null = branches ? [NAMES[branches[0]], NAMES[branches[1]]] : null;
      if (n?.[0] === names?.[0] && n?.[1] === names?.[1] && s === set && st === state) return;
      names = n;
      set = s;
      state = st;
      redraw();
    },
    throwLever() {
      shake = 1;
      // A shove the way it's going; the spring and the stop do the rest.
      angle.vel += (set === 0 ? -1 : 1) * 9;
    },
    setBrake(down) {
      brakeAim = down ? 1 : 0;
    },
    pullCord() {
      cordPull = 0;
    },
    tick(t, dt) {
      // The lever: a stiff spring to whichever side it's set, a hard stop at each end to bounce off.
      const aim = set === 0 ? -0.42 : 0.42;
      angle.vel += ((aim - angle.at) * 140 - angle.vel * 13) * dt;
      angle.at += angle.vel * dt;
      if (Math.abs(angle.at) > 0.46) {
        angle.at = Math.sign(angle.at) * 0.46;
        angle.vel *= -0.35;
      }
      arm.rotation.z = -angle.at;
      shake = Math.max(0, shake - dt * 4);
      lever.position.x = LEVER_AT.x + Math.sin(t * 90) * 0.0015 * shake;
      // The lamp: amber, pulsing while the points can still be changed; steady green once they're set.
      const on = state === 'live' ? 0.55 + 0.45 * Math.sin(t * 4.2) : state === 'locked' ? 1 : 0;
      lens.color.set(state === 'locked' ? '#3dff8a' : state === 'live' ? '#ffb44a' : '#2a1a10');
      if (state !== 'idle') lens.color.multiplyScalar(0.6 + on * 1.4);
      lampGlow.material.color.set(state === 'locked' ? '#4dff9a' : '#ffb44a');
      lampGlow.material.opacity = on * 0.8;
      tabMat.color.setScalar(state === 'idle' ? 0.5 : 0.85 + on * 0.15);
      // The brake handle drops quickly and comes back up slowly.
      brakeAt += (brakeAim - brakeAt) * Math.min(1, dt * (brakeAim > brakeAt ? 14 : 3));
      handle.rotation.x = brakeAt * 1.15;
      // The cord: down, and back up with a little bounce.
      if (cordPull >= 0) {
        cordPull += dt;
        const k = cordPull;
        const d = k < 0.12 ? (k / 0.12) * 0.07 : 0.07 * Math.exp(-(k - 0.12) * 6) * Math.cos((k - 0.12) * 18);
        toggle.position.y = -len - 0.03 - d;
        string.scale.y = (len + d) / len;
        string.position.y = -(len + d) / 2 - 0.02;
        if (k > 1.2) cordPull = -1;
      }
    },
  };
}
