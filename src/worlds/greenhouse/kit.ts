// The Greenhouse: the studio in a Victorian glasshouse at golden hour.
import * as THREE from 'three';
import type { Kit, KitModule } from '../kit';
import { buildBed } from './bed';
import { buildFlowers } from './flowers';
import { growth, load } from './garden';
import { decode } from './genome';
import { BANK, buildGrounds } from './grounds';
import { buildHouse } from './house';
import { HOUSE, SUN } from './plan';

const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

export const buildKit: KitModule['buildKit'] = ({ quality, scene, log }) => {
  log('OPENING THE VENTS', 40);
  const grounds = buildGrounds(quality);
  const house = buildHouse(quality);
  house.glass.uniforms.uSunDir.value.copy(SUN);
  const bed = buildBed(grounds.daylight);
  const flowers = buildFlowers(quality);
  const garden = load();
  garden.pots.forEach((p, i) => flowers.set(i, p ? decode(p.code) : null));
  scene.environmentIntensity = 0.2;

  // The low sun, through the glass, and the sky's light all round.
  const lights = new THREE.Group();
  const sun = new THREE.DirectionalLight('#ffbb6a', 6.5);
  sun.position.copy(SUN).multiplyScalar(30);
  sun.target.position.set(0, 0, 0.3);
  sun.castShadow = true;
  sun.shadow.mapSize.set(quality === 'high' ? 2048 : 1024, quality === 'high' ? 2048 : 1024);
  const sc = sun.shadow.camera;
  sc.left = -8;
  sc.right = 8;
  sc.top = 6;
  sc.bottom = -6;
  sc.near = 10;
  sc.far = 50;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.025;
  lights.add(sun, sun.target);
  lights.add(new THREE.HemisphereLight('#f0d6b4', '#6a4a30', 0.42));

  const kit: Kit = {
    objects: [grounds.group, house.group, bed.group, flowers.group, lights],
    board: bed,
    shots: {
      vista: { pos: v(-11.5, 2.5, -9.5), target: v(0.2, 2.0, 0.4), fov: 46, lean: 0.25 },
      window: { pos: v(0.75, 1.55, -1.5), target: v(-1.6, 1.4, -14), fov: 54, lean: 0.04 },
      board: { pos: v(0.95, 1.75, -1.35), target: BANK.center.clone(), fov: 26, lean: 0.03 },
    },
    intro: { via: [v(-9.2, 2.0, -3.6), v(HOUSE.x0 - 1.4, 1.55, HOUSE.door.z), v(HOUSE.x0 + 0.9, 1.55, HOUSE.door.z), v(-2.5, 1.5, 0.9)], duration: 10, lines: ['EVOLVING WORD', 'A LITTLE STUDIO UNDER GLASS', 'WHERE WE MAKE THINGS TOGETHER'] },
    tagline: 'A LITTLE STUDIO UNDER GLASS.',
    closeups: () => ({
      staging: { pos: v(-3.9, 1.95, 0.85), target: v(-3.95, 1.05, -1.6), fov: 50, lean: 0.04 },
    }),
    frame({ t, camera, renderer }) {
      const now = Date.now();
      garden.pots.forEach((p, i) => flowers.state(i, p ? growth(p, now) : 0, 0, 0));
      flowers.tick(t);
      grounds.tick(t, camera, renderer);
      house.tick(t, 0);
    },
    outside(camera) {
      const p = camera.position;
      if (p.x < HOUSE.x0 || p.x > HOUSE.x1 || p.z < HOUSE.front || p.z > HOUSE.back) return 1;
      return THREE.MathUtils.clamp(1 - (p.z - HOUSE.front) / 2.5, 0, 1) * 0.6;
    },
    debug: { grounds, house, bed, flowers, garden },
  };
  return kit;
};
