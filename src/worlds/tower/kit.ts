// The Tower: the studio up in the cab of an airport control tower at first
// light, glass all round the front, the departures board hanging over it, and
// the morning's first flights going out and coming in below.
import * as THREE from 'three';
import type { Kit, KitModule } from '../kit';
import { buildAirfield } from './airfield';
import { buildDotBoard } from './board';
import { buildCab } from './cab';

const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

export const buildKit: KitModule['buildKit'] = ({ quality, log }) => {
  log('LIGHTING THE RUNWAY', 45);
  const field = buildAirfield(quality);
  log('FUELING THE FIRST FLIGHTS', 60);
  const cab = buildCab(field.daylight);
  const board = buildDotBoard(2.6);
  board.group.position.set(0, 2.43, -1.74);

  const kit: Kit = {
    objects: [cab.group, field.group, board.group],
    board,
    shots: {
      // Out over the field, looking back up at the cab catching the sunrise.
      vista: { pos: v(-9, -7, -27), target: v(0, -3, 0), fov: 46, lean: 0.3 },
      window: { pos: v(0.55, 1.6, -1.55), target: v(-120, -40, -620), fov: 48, lean: 0.04 },
      board: { pos: v(0, 1.66, 0.75), target: v(0, 2.36, -1.8), fov: 42, lean: 0.03 },
    },
    // Up to the cab and straight in through the glass.
    intro: { via: [v(-5, -1.5, -15), v(-1.2, 1.6, -6), v(-0.2, 1.55, -2.6)], duration: 9, lines: ['EVOLVING WORD', 'A LITTLE STUDIO UP IN THE TOWER', 'WHERE WE MAKE THINGS TOGETHER'] },
    tagline: 'A LITTLE STUDIO UP IN THE TOWER.',
    frame({ t, dt, camera, renderer, sound, ready }) {
      cab.tick(t);
      const heard = field.tick(t, dt, camera, renderer);
      cab.setBlips(field.blips());
      // Engines spooling up down on the runway: louder with your nose to the glass.
      if (ready && heard.takeoff) sound.jet(48, 'takeoff');
      if (ready && heard.landing) sound.jet(18, 'landing');
    },
    outside: (camera) => THREE.MathUtils.clamp((-camera.position.z - 0.4) / 1.2, 0, 1),
    debug: { cab, field, board },
  };
  return kit;
};
