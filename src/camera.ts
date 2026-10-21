// The camera flies between named shots along smooth curves, turning the shortest
// way round (so it can spin from the desk to the bookshelf), breathes a little
// when it's still, and leans toward the mouse.
import * as THREE from 'three';

export interface Shot {
  pos: THREE.Vector3;
  target: THREE.Vector3;
  fov: number;
  /** Seconds for the move. */
  duration?: number;
  /** How far the mouse can lean the view, in meters. */
  lean?: number;
  /** Near clipping distance; small for close-ups. */
  near?: number;
  /** Slide the picture right by this share of its width, to clear a card on the left (negative: left, for the notepad). */
  shift?: number;
}

const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

/** Every place the camera can go. The world adds its vista, window and board;
 * props add their own close-ups at startup. */
export const SHOTS: Record<string, Shot> = {
  desk: { pos: v(0, 1.4, 1.35), target: v(0, 1.36, -1.9), fov: 46, lean: 0.1 },
  projects: { pos: v(-0.75, 1.88, 1.6), target: v(-2.1, 1.86, 1.9), fov: 40, lean: 0.06 },
  signal: { pos: v(-0.12, 1.1, -0.86), target: v(-0.12, 1.09, -1.4), fov: 31, lean: 0.015, near: 0.02 },
};

export type ShotName = string;

const ease = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const UP = new THREE.Vector3(0, 1, 0);
// What the card and the notepad cover on the 1440x900 screen the shots were framed on (see cardInset in scene.ts).
const DESIGN_INSET = 72 + 400 + 24;
const DESIGN_PAD = 72 + 460 + 24;
const look = (pos: THREE.Vector3, target: THREE.Vector3, out = new THREE.Quaternion()) => out.setFromRotationMatrix(new THREE.Matrix4().lookAt(pos, target, UP));

export class Rig {
  private pos = new THREE.Vector3();
  private target = new THREE.Vector3();
  private quat = new THREE.Quaternion();
  private fov = 42;
  private near = 0.05;
  private path: THREE.CatmullRomCurve3 | null = null;
  private fromQ = new THREE.Quaternion();
  private toQ = new THREE.Quaternion();
  private fromFov = 42;
  private toFov = 42;
  private toNear = 0.05;
  private shift = 0;
  private fromShift = 0;
  private toShift = 0;
  private t0 = 0;
  private duration = 1;
  private now = 0;
  private lean = 0.1;
  private leanIn = 1;
  private pointer = new THREE.Vector2();
  private smoothPointer = new THREE.Vector2();
  private done: (() => void) | null = null;
  moving = false;
  current: ShotName = 'desk';
  /** How much of the frame's height the letterbox leaves showing (1 = all). */
  visible = 1;
  /** Pixels a card covers on the left (or the notepad on the right); shifted shots clear at least this. */
  inset = 0;
  insetRight = 0;

  constructor(
    private camera: THREE.PerspectiveCamera,
    private reducedMotion: boolean,
  ) {
    window.addEventListener('pointermove', (e) => this.pointer.set((e.clientX / window.innerWidth) * 2 - 1, (e.clientY / window.innerHeight) * 2 - 1));
  }

  jump(name: ShotName) {
    const s = SHOTS[name];
    this.current = name;
    this.pos.copy(s.pos);
    this.target.copy(s.target);
    look(s.pos, s.target, this.quat);
    this.fov = s.fov;
    this.near = s.near ?? 0.05;
    this.shift = s.shift ?? 0;
    this.lean = s.lean ?? 0.1;
    this.leanIn = 1;
    this.path = null;
    this.moving = false;
    this.finish();
  }

  /** A flight cut short by a jump or a new flight still counts as over, so whatever waits on it carries on. */
  private finish() {
    const done = this.done;
    this.done = null;
    done?.();
  }

  go(name: ShotName, opts: { via?: THREE.Vector3[]; duration?: number } = {}): Promise<void> {
    const s = SHOTS[name];
    this.current = name;
    if (this.reducedMotion) {
      this.jump(name);
      return Promise.resolve();
    }
    // Start from wherever the camera actually is, lean and all.
    this.pos.copy(this.camera.position);
    this.fromQ.copy(this.camera.quaternion);
    const via = opts.via ?? [];
    const mid = via.length ? [] : [this.pos.clone().lerp(s.pos, 0.5).add(new THREE.Vector3(0, 0.06, 0))];
    this.path = new THREE.CatmullRomCurve3([this.pos.clone(), ...via, ...mid, s.pos.clone()], false, 'centripetal');
    this.target.copy(s.target);
    look(s.pos, s.target, this.toQ);
    this.fromFov = this.fov;
    this.toFov = s.fov;
    this.toNear = s.near ?? 0.05;
    this.near = Math.min(this.near, this.toNear);
    this.fromShift = this.shift;
    this.toShift = s.shift ?? 0;
    this.t0 = this.now;
    const turn = this.fromQ.angleTo(this.toQ);
    this.duration = opts.duration ?? s.duration ?? Math.min(3, 1.1 + this.pos.distanceTo(s.pos) * 0.4 + turn * 0.35);
    this.lean = s.lean ?? 0.1;
    this.leanIn = 0;
    this.moving = true;
    this.finish();
    return new Promise((resolve) => (this.done = resolve));
  }

  update(t: number, dt: number) {
    this.now = t;
    const cam = this.camera;
    if (this.path) {
      const k = Math.min(1, (t - this.t0) / this.duration);
      const e = ease(k);
      cam.position.copy(this.path.getPoint(e));
      // Turn a touch ahead of the move, like a person turning their head.
      cam.quaternion.slerpQuaternions(this.fromQ, this.toQ, ease(Math.min(1, k * 1.12)));
      this.fov = this.fromFov + (this.toFov - this.fromFov) * e;
      this.shift = this.fromShift + (this.toShift - this.fromShift) * e;
      if (k >= 1) {
        this.path = null;
        this.moving = false;
        this.pos.copy(cam.position);
        this.near = this.toNear;
        this.finish();
      }
    } else {
      this.smoothPointer.lerp(this.pointer, 0.04);
      this.leanIn = Math.min(1, this.leanIn + dt * 1.5);
      cam.position.copy(this.pos);
      if (!this.reducedMotion) {
        // Breathing, plus a lean toward the mouse, always looking at the subject.
        const amount = this.lean * this.leanIn;
        const right = new THREE.Vector3().subVectors(this.target, this.pos).cross(UP).normalize();
        cam.position.addScaledVector(right, this.smoothPointer.x * amount + Math.sin(t * 0.31) * 0.004 * this.leanIn);
        cam.position.y += -this.smoothPointer.y * amount * 0.5 + Math.sin(t * 0.43) * 0.003 * this.leanIn;
      }
      cam.lookAt(this.target);
    }
    // Widen the lens as the letterbox closes, so each shot keeps its framing
    // in the picture between the bars.
    const w = window.innerWidth;
    const h = window.innerHeight;
    // Shots are framed on a 1440x900 screen. Where the room left beside a card
    // (or the whole screen, for a shot without one) is narrower than that, widen
    // the lens so the subject still fits beside the card instead of under it.
    const m = Math.min(1, Math.abs(this.shift) / 0.08);
    const covers = (this.shift >= 0 ? this.inset : this.insetRight) * m;
    const designed = (1440 - (this.shift >= 0 ? DESIGN_INSET : DESIGN_PAD) * m) / 900;
    const room = Math.max(1, w - covers) / h;
    const squeeze = Math.min(2.4, Math.max(1, (designed * (1 - 0.18 * (1 - m))) / room));
    const tall = Math.tan(THREE.MathUtils.degToRad(this.fov) / 2) * squeeze / (this.visible < 1 ? this.visible : 1);
    const fov = Math.min(78, THREE.MathUtils.radToDeg(2 * Math.atan(tall)));
    // Slide the picture sideways (a lens shift, not a turn) to make room for a card.

    const sideways = (inset: number, k: number) => Math.round(Math.max(k * w, (inset / 2) * Math.min(1, k / 0.08)));
    const offset = this.shift > 0 ? sideways(this.inset, this.shift) : this.shift < 0 ? -sideways(this.insetRight, -this.shift) : 0;
    const view = cam.view;
    const shifted = view?.enabled ? view.offsetX : 0;
    if (Math.abs(cam.fov - fov) > 1e-4 || cam.near !== this.near || -offset !== shifted || (view?.enabled && view.fullWidth !== w)) {
      cam.fov = fov;
      cam.near = this.near;
      if (offset) cam.setViewOffset(w, h, -offset, 0, w, h);
      else cam.clearViewOffset();
      cam.updateProjectionMatrix();
    }
  }
}
