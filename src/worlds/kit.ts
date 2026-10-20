// What a world brings to the shared studio: its own room shell and what's
// outside the window, somewhere for the evolving word to show, its shots and
// way in, and whatever has to happen each frame. Everything else (the desk,
// the props, the cards, the keys) is the same in every world.
import type * as THREE from 'three';
import type { Band, Sound } from '../audio';
import type { Shot } from '../camera';
import type { Desk } from '../desk';
import type { Target } from '../interact';
import type { Line } from '../line';
import type { Honors } from '../props/honors';
import type { ScratchMap } from '../props/map';
import type { Pad } from '../props/pad';
import type { Rolodex } from '../props/rolodex';
import type { Shelf } from '../props/shelf';
import type { Shoes } from '../props/shoes';
import type { Treats } from '../props/treats';
import type { Watch } from '../props/watch';
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

/**
 * The studio's shared pieces, as built and placed in the usual room. A world may
 * move, turn, hide or restyle them (their materials), but they keep working as
 * they always do. Each one's `group` is what to move.
 */
export interface Studio {
  desk: Desk;
  line: Line;
  watch: Watch;
  pad: Pad;
  treats: Treats;
  rolodex: Rolodex;
  honors: Honors;
  map: ScratchMap;
  shelf: Shelf;
  shoes: Shoes;
}

/** A place you turn to with ‹ ›, and the close-ups that belong to it (Esc steps back to it). */
export interface Wall {
  /** A shot name; the world provides the shot unless it's one of the usual four. */
  id: string;
  /** What the ‹ › button says. */
  name: string;
  /** Close-up shots that step back to this wall. */
  members?: string[];
}

/** What a world can hook into once the studio is built: its own clickable things and cards. */
export interface Wiring {
  /** Something to hover and click. */
  touch(target: Target): void;
  /** Fly to a shot. */
  goTo(shot: string): void;
  /** The card on the left, as the props use it. */
  card(kicker: string, title: string, body: string[], actions?: { label: string; quiet?: boolean; href?: string; run?: () => void }[]): void;
  /** A line in the caption bar. */
  say(text: string): void;
  sound: Sound;
  /** The shot the camera is at or heading to, and whether it's still moving. */
  current(): string;
  moving(): boolean;
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

  // --- optional: a world that presents the studio its own way ------------------------
  /**
   * Rearranges the studio. The shared pieces arrive placed as in the usual room;
   * close-ups that follow a piece (the watch, the pad, the map, the shelf...) move
   * with it, so only shots that don't follow need giving in `closeups`.
   */
  arrange?(studio: Studio): void;
  /** Shots to add or replace once the studio is arranged (called after `arrange`). */
  closeups?(studio: Studio): Record<string, Shot>;
  /** The places ‹ › turns between, in order, instead of the room's four walls. Must include 'desk'. */
  walls?: Wall[];
  /** Hooks for the world's own clickable things, called once the studio is wired up. */
  wire?(w: Wiring): void;
  /** The world's own music and weather (see Band in audio.ts). */
  band?: Band;
}

export interface KitModule {
  buildKit(opts: { quality: Quality; renderer: THREE.WebGLRenderer; scene: THREE.Scene; log: (text: string, pct: number) => void }): Kit;
}
