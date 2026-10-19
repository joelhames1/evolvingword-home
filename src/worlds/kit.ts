// What a world brings to the shared studio: its own room shell and what's
// outside the window, somewhere for the evolving word to show, its shots and
// way in, and whatever has to happen each frame. Everything else (the desk,
// the props, the cards, the keys) is the same in every world.
import type * as THREE from 'three';
import type { Sound } from '../audio';
import type { Shot } from '../camera';
import type { Quality } from '../world';

export interface Evolution {
  text: string;
  target: string;
  generation: number;
  fitness: number;
  done: boolean;
  custom: boolean;
}

/** Wherever this world shows the weasel program at work. */
export interface Board {
  /** What to click to breed your own word. */
  face: THREE.Object3D;
  evolution(): Evolution;
  evolve(text: string): void;
  /** Advances it; returns how many flaps fell this frame, for the sound (0 if it doesn't clatter). */
  tick(t: number): number;
}

export interface Frame {
  t: number;
  dt: number;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  sound: Sound;
  /** True once the visitor is inside and the camera has settled. */
  ready: boolean;
  /** The shot the camera is at or heading to. */
  shot: string;
}

export interface Kit {
  /** Everything this world adds to the scene. */
  objects: THREE.Object3D[];
  board: Board;
  /** The world's own shots: the way in, the view out, and the board. */
  shots: { vista: Shot; window: Shot; board: Shot };
  /** The flight from the vista to the desk, and the captions along the way. */
  intro: { via: THREE.Vector3[]; duration: number; lines: string[] };
  /** The line under EVOLVING WORD on the CRT. */
  tagline: string;
  /** Per frame: the light through the window, weather, passers-by. */
  frame(f: Frame): void;
  /** 0 at the desk, 1 with your nose to the glass (or out in the street): how loud outside is. */
  outside(camera: THREE.Camera): number;
  /** Anything worth reaching from tests and the console. */
  debug: Record<string, unknown>;
}

export interface KitModule {
  buildKit(opts: { quality: Quality; renderer: THREE.WebGLRenderer; scene: THREE.Scene; log: (text: string, pct: number) => void }): Kit;
}
