// The camera flies between named shots along smooth curves, breathes a little
// when it's still (a handheld feel), and leans toward the mouse.
import * as THREE from 'three';

export interface Shot {
  pos: THREE.Vector3;
  target: THREE.Vector3;
  fov: number;
  /** Points to pass through on the way here. */
  via?: THREE.Vector3[];
  /** Seconds for the move. */
  duration?: number;
  /** How far the mouse can lean the view, in meters. */
  lean?: number;
}

const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

export const SHOTS = {
  street: { pos: v(8.5, -4.5, -15.5), target: v(0.6, 2.6, -2.4), fov: 44, lean: 0.4 },
  desk: { pos: v(0, 1.42, 1.25), target: v(0.05, 1.14, -1.9), fov: 42, lean: 0.12 },
  projects: { pos: v(1.05, 1.82, 0.62), target: v(1.2, 1.86, -0.95), fov: 40, lean: 0.06 },
  about: { pos: v(0.38, 1.22, -0.72), target: v(0.62, 0.86, -1.36), fov: 38, lean: 0.03 },
  signal: { pos: v(-0.12, 1.1, -0.86), target: v(-0.12, 1.09, -1.4), fov: 31, lean: 0.015 },
  window: { pos: v(-0.5, 1.7, -1.9), target: v(-9, 6, -19.9), fov: 29, lean: 0.04 },
} satisfies Record<string, Shot>;

export type ShotName = keyof typeof SHOTS;

const ease = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);

export class Rig {
  private pos = new THREE.Vector3();
  private target = new THREE.Vector3();
  private fov = 42;
  private path: THREE.CatmullRomCurve3 | null = null;
  private fromTarget = new THREE.Vector3();
  private toTarget = new THREE.Vector3();
  private fromFov = 42;
  private toFov = 42;
  private t0 = 0;
  private duration = 1;
  private now = 0;
  private lean = 0.1;
  private pointer = new THREE.Vector2();
  private smoothPointer = new THREE.Vector2();
  private done: (() => void) | null = null;
  moving = false;
  current: ShotName = 'desk';
  /** How much of the frame's height the letterbox leaves showing (1 = all). */
  visible = 1;

  constructor(
    private camera: THREE.PerspectiveCamera,
    private reducedMotion: boolean,
  ) {
    window.addEventListener('pointermove', (e) => this.pointer.set((e.clientX / window.innerWidth) * 2 - 1, (e.clientY / window.innerHeight) * 2 - 1));
  }

  jump(name: ShotName) {
    const s: Shot = SHOTS[name];
    this.current = name;
    this.pos.copy(s.pos);
    this.target.copy(s.target);
    this.fov = s.fov;
    this.lean = s.lean ?? 0.1;
    this.path = null;
    this.moving = false;
  }

  go(name: ShotName, opts: { via?: THREE.Vector3[]; duration?: number } = {}): Promise<void> {
    const s: Shot = SHOTS[name];
    this.current = name;
    if (this.reducedMotion) {
      this.jump(name);
      return Promise.resolve();
    }
    const via = opts.via ?? s.via ?? [];
    const mid = via.length ? [] : [this.pos.clone().lerp(s.pos, 0.5).add(new THREE.Vector3(0, 0.08, 0))];
    this.path = new THREE.CatmullRomCurve3([this.pos.clone(), ...via, ...mid, s.pos.clone()], false, 'centripetal');
    this.fromTarget.copy(this.target);
    this.toTarget.copy(s.target);
    this.fromFov = this.fov;
    this.toFov = s.fov;
    this.t0 = this.now;
    this.duration = opts.duration ?? s.duration ?? Math.min(2.6, 1.1 + this.pos.distanceTo(s.pos) * 0.45);
    this.lean = s.lean ?? 0.1;
    this.moving = true;
    return new Promise((resolve) => (this.done = resolve));
  }

  update(t: number) {
    this.now = t;
    if (this.path) {
      const k = Math.min(1, (t - this.t0) / this.duration);
      const e = ease(k);
      this.pos.copy(this.path.getPoint(e));
      // Look ahead slightly early, so turns feel like a person turning their head.
      this.target.lerpVectors(this.fromTarget, this.toTarget, ease(Math.min(1, k * 1.15)));
      this.fov = this.fromFov + (this.toFov - this.fromFov) * e;
      if (k >= 1) {
        this.path = null;
        this.moving = false;
        this.done?.();
        this.done = null;
      }
    }
    this.smoothPointer.lerp(this.pointer, 0.04);
    const cam = this.camera;
    cam.position.copy(this.pos);
    if (!this.reducedMotion) {
      // Breathing, plus a lean toward the mouse.
      const right = new THREE.Vector3().subVectors(this.target, this.pos).cross(cam.up).normalize();
      cam.position.addScaledVector(right, this.smoothPointer.x * this.lean + Math.sin(t * 0.31) * 0.006);
      cam.position.y += -this.smoothPointer.y * this.lean * 0.5 + Math.sin(t * 0.43) * 0.005;
    }
    cam.lookAt(this.target);
    // Widen the lens as the letterbox closes, so each shot keeps its framing
    // in the picture between the bars.
    const fov = this.visible < 1 ? THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(this.fov) / 2) / this.visible)) : this.fov;
    if (Math.abs(cam.fov - fov) > 1e-4) {
      cam.fov = fov;
      cam.updateProjectionMatrix();
    }
  }
}

/** The opening flight: up from the street, past the blade sign, through the glass, to the desk. */
export const INTRO_VIA = [v(6.4, -1.2, -11.5), v(2.6, 1.9, -6.4), v(0.95, 1.62, -2.6), v(0.9, 1.55, -1.5)];
