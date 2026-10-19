// The Lake House: a pine-paneled study above an alpine lake at dusk, snow
// falling, a split-flap board over the window.
import * as THREE from 'three';
import { ROOM } from '../../layout';
import type { Kit, KitModule } from '../kit';
import { buildFlap } from './flap';
import { buildRoom, WINDOW } from './room';
import { buildAlps } from './valley';

const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

export const buildKit: KitModule['buildKit'] = ({ quality, log }) => {
  const room = buildRoom();
  log('RAISING THE MOUNTAINS', 45);
  const valley = buildAlps(quality);
  log('CHILLING THE LAKE', 60);
  const flap = buildFlap(WINDOW.x1 - WINDOW.x0, 0.24);
  flap.group.position.set(0, 2.53, ROOM.z0 + 0.045);

  const kit: Kit = {
    objects: [room.group, valley.group, flap.group],
    board: flap,
    shots: {
      vista: { pos: v(0.4, 1.66, -2.7), target: v(-70, 30, -1200), fov: 50, lean: 0.02 },
      window: { pos: v(0.1, 1.55, -1.25), target: v(-60, 26, -1200), fov: 46, lean: 0.04 },
      board: { pos: v(0, 1.75, -0.55), target: v(0, 2.42, -2), fov: 46, lean: 0.03 },
    },
    intro: { via: [v(0.08, 1.62, -1.2), v(0.06, 1.56, 0.1)], duration: 8.5, lines: ['EVOLVING WORD', 'A LITTLE STUDIO BY THE LAKE', 'WHERE WE MAKE THINGS TOGETHER'] },
    tagline: 'A LITTLE STUDIO BY THE LAKE.',
    frame({ t, dt, camera }) {
      room.tick(t);
      valley.tick(t, dt, camera);
      // The window light takes the sky's color as the dusk moves on.
      room.windowLight.color.copy(valley.skyLight);
    },
    outside: (camera) => THREE.MathUtils.clamp((-camera.position.z - 0.8) / 1.1, 0, 1),
    debug: { room, alps: valley, flap },
  };
  return kit;
};
