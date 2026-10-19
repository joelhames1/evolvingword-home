// The Night Studio: the same room five floors above a rainy neon city, the
// evolving word on a billboard across the street, and a patrol spinner going
// by now and then.
import * as THREE from 'three';
import type { Kit, KitModule } from '../kit';
import { buildCity } from './city';
import { buildFlyby } from './flyby';
import { buildRoom } from './room';

const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

export const buildKit: KitModule['buildKit'] = ({ quality, scene, log }) => {
  const room = buildRoom();
  log('SWEEPING THE STREET', 45);
  const city = buildCity(quality);
  log('WIRING THE NEON', 60);
  const flyby = buildFlyby(room.rainLight.map);
  // The city fades into its own wet haze.
  scene.fog = new THREE.FogExp2('#0b0f22', 0.012);

  const windowBlue = new THREE.Color('#7f9cff');
  let nextFlyby = 0;

  const kit: Kit = {
    objects: [room.group, city.group, flyby.group],
    // The billboard runs itself in the city's tick.
    board: { face: city.billboard, evolution: city.evolution, evolve: city.evolve, tick: () => 0 },
    shots: {
      vista: { pos: v(8.5, -4.5, -15.5), target: v(0.6, 2.6, -2.4), fov: 44, lean: 0.4 },
      window: { pos: v(0.95, 1.6, -1.62), target: v(5, -1, -36), fov: 50, lean: 0.04 },
      board: { pos: v(-0.5, 1.7, -1.9), target: city.billboardCenter.clone(), fov: 29, lean: 0.04 },
    },
    // Up from the street, across the face of the building and in through the window.
    intro: { via: [v(6.4, -1.2, -11.5), v(2.6, 1.9, -6.4), v(0.95, 1.62, -2.6), v(0.9, 1.55, -1.5)], duration: 9.5, lines: ['EVOLVING WORD', 'A LITTLE STUDIO FIVE FLOORS UP', 'WHERE WE MAKE THINGS TOGETHER'] },
    tagline: 'A LITTLE STUDIO FIVE FLOORS UP.',
    frame({ t, dt, camera, renderer, sound, ready, shot }) {
      room.tick(t);
      room.renderRain(renderer);
      city.tick(t, dt, camera);
      // The light through the window takes on the billboard's color.
      room.rainLight.color.copy(windowBlue).lerp(city.billboardColor, 0.55);
      // Now and then a patrol goes by: only worth it once we're inside to see it.
      if (ready && !flyby.active && shot !== 'vista') {
        if (nextFlyby === 0) nextFlyby = t + 16;
        else if (t > nextFlyby) {
          sound.flyby(flyby.pass(t));
          nextFlyby = t + 55 + Math.random() * 40;
        }
      }
      flyby.tick(t);
    },
    outside: (camera) => THREE.MathUtils.clamp((-camera.position.z - 2) / 10, 0, 1),
    debug: { room, city, flyby },
  };
  return kit;
};
