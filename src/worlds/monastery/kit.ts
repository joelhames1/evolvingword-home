// The Monastery: the studio in a plain stone cell in Assisi, the afternoon sun
// coming in colored through a small round window, two arches open onto a garden,
// a cloister and the valley below in its haze. Simple things: Brother Sun, Sister
// Moon, the birds, water, candlelight.
import * as THREE from 'three';
import type { Kit, KitModule } from '../kit';
import { buildBand } from './band';
import { ARCH, buildCell, OCULUS } from './room';
import { buildValley } from './valley';

const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

export const buildKit: KitModule['buildKit'] = ({ quality, log }) => {
  log('RAKING THE GRAVEL', 45);
  const valley = buildValley(quality);
  log('LIGHTING THE CANDLES', 60);
  const cell = buildCell(valley.daylight);
  const band = buildBand(4.2, 0.34);
  band.mesh.position.set(0, ARCH.top + 0.33, -2.0 + 0.004);
  const oc = v(OCULUS.x, OCULUS.y, 2.85);

  const kit: Kit = {
    objects: [cell.group, valley.group, band.mesh],
    board: band,
    shots: {
      // Up on the hill behind the house, looking over the roof to the valley; in
      // through the round window.
      vista: { pos: v(2.8, 8.4, 12.5), target: v(0.6, -2.2, -24), fov: 46, lean: 0.25 },
      window: { pos: v(-0.85, 1.6, -1.7), target: v(-5, -3, -40), fov: 50, lean: 0.04 },
      board: { pos: v(0, 1.72, 0.7), target: v(0, 2.85, -2), fov: 40, lean: 0.03 },
    },
    intro: { via: [v(1.6, 5.6, 8.6), v(0.45, 3.4, 5.4), oc.clone().add(v(0.01, 0.01, 1.2)), oc.clone(), v(0.22, 2.55, 2.0)], duration: 9.5, lines: ['EVOLVING WORD', 'A LITTLE STUDIO ABOVE THE VALLEY', 'WHERE WE MAKE THINGS TOGETHER'] },
    tagline: 'A LITTLE STUDIO ABOVE THE VALLEY.',
    frame({ t, dt, camera }) {
      cell.tick(t);
      valley.tick(t, dt, camera);
    },
    outside: (camera) => THREE.MathUtils.clamp((-camera.position.z - 0.6) / 1.2, 0, 1),
    debug: { cell, valley, band },
  };
  return kit;
};
