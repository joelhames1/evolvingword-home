// The Heavens: the studio in an observatory on a high, remote peak, at night.
// The room is round and the dome turns with you, so each "wall" is a station
// under a different part of the sky: the desk, the medals and diplomas, the
// library, the telescope, and the map with the shirts. Click the telescope and it
// swings to Saturn, Jupiter, a nebula or a cluster, and you look through it. The
// word board is out in the sky: loose stars that settle into a constellation.
import * as THREE from 'three';
import { SHOTS } from '../../camera';
import type { Kit, KitModule, Studio, Wiring } from '../kit';
import { buildStarBoard } from './board';
import { around, buildObservatory, LEDGE, R_IN, SPRING } from './dome';
import { buildEyepiece, TARGETS } from './eyepiece';
import { buildPeak, CENTER, height } from './peak';
import { buildSky } from './sky';
import { buildBand } from './sound';
import { celestialGlobe, easel, honorsRail, lineFrame, medalGlints } from './stations';
import { buildTelescope } from './telescope';

const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const RAD = THREE.MathUtils.DEG2RAD;

/** Where each station stands round the room (degrees from the desk, turning right). */
export const STATIONS = { desk: 0, honors: 80, library: 146, scope: 213, map: 298, line: 277 };
/** You stand here to look at the telescope: across the room from where it's pointing, and a little to one side. */
const SCOPE_FROM = around(STATIONS.scope - 180 + 26, 3.15, 1.45);
/** The telescope rests pointing out of the slit at this height. */
const PARK = 40;
/** The desk shot's camera: the board hangs in the sky ahead of it. */
const DESK_EYE = v(0, 1.4, 1.35);

/** Shortest way round from a to b, in degrees. */
const delta = (a: number, b: number) => ((((b - a) % 360) + 540) % 360) - 180;

/** A slow follow with a top speed: how the dome and the telescope move. */
function follower(rate: number, top: number) {
  let at = NaN;
  let vel = 0;
  return {
    get: () => at,
    speed: () => Math.abs(vel),
    snap: (x: number) => ((at = x), (vel = 0)),
    step(aim: number, dt: number, wrap = true) {
      if (Number.isNaN(at)) at = aim;
      const d = wrap ? delta(at, aim) : aim - at;
      // A damped spring, held under a top speed.
      vel += (d * rate * rate - vel * 2 * rate) * dt;
      vel = THREE.MathUtils.clamp(vel, -top, top);
      at += vel * dt;
      if (wrap) at = ((at % 360) + 360) % 360;
      return at;
    },
  };
}

export const buildKit: KitModule['buildKit'] = ({ quality, renderer, log }) => {
  log('OPENING THE DOME', 45);
  const sky = buildSky(quality, renderer);
  const peak = buildPeak(quality);
  log('LETTING OUR EYES ADJUST', 60);
  const obs = buildObservatory(peak.night, quality);
  peak.lamp.copy(obs.doorLamp);
  const scope = buildTelescope(STATIONS.scope - 180);
  const band = buildBand();
  const furniture = new THREE.Group();

  // The board: out past the slit in front of the desk, a little above the horizon, facing the desk.
  const board = buildStarBoard(0.34);
  const boardAt = DESK_EYE.clone().add(new THREE.Vector3(0, Math.sin(11 * RAD), -Math.cos(11 * RAD)).multiplyScalar(40));
  board.group.position.copy(boardAt);
  board.group.lookAt(DESK_EYE);

  // The view through the eyepiece, and which target the telescope is on.
  let target = 0;
  let looking = false;
  let wiring: Wiring | null = null;
  let glints: ReturnType<typeof medalGlints> | null = null;
  const eyepiece = buildEyepiece(() => next());
  const card = () => {
    const t = TARGETS[target];
    wiring?.card('Through the telescope', t.name, [...t.lines, t.note], [
      { label: 'Next', run: () => next() },
      { label: 'Step back', quiet: true, run: () => wiring?.goTo('scope') },
    ]);
  };
  /** On to the next target: the telescope swings, the view slides across. */
  const next = () => {
    target = (target + 1) % TARGETS.length;
    eyepiece.show(target);
    wiring?.sound.click();
    if (wiring?.current() === 'eyepiece') card();
  };

  // Where you stand to look through it, worked out from where it's pointing.
  const eyepieceShot = () => {
    const keep = [scope.fork.rotation.y, scope.tube.rotation.x];
    scope.point(STATIONS.scope + TARGETS[target].offset, TARGETS[target].el);
    const e = scope.eyepiece();
    scope.fork.rotation.y = keep[0];
    scope.tube.rotation.x = keep[1];
    return { pos: e.at.clone().addScaledVector(e.up, 0.2).addScaledVector(e.back, 0.12), target: e.at.clone(), fov: 38, near: 0.01, lean: 0.004, shift: 0.13 };
  };

  // How the dome and the telescope move, and where the light through the slit falls.
  const dome = follower(1.6, 42);
  const tubeAz = follower(1.8, 36);
  const tubeEl = follower(1.8, 22);
  let yaw = 0;
  let domeAim = 0;
  let arrived = '';
  let said = false;
  let started = false;
  const fwd = new THREE.Vector3();
  const lastEye = new THREE.Vector3(1e6, 0, 0);

  const kit: Kit = {
    objects: [sky.group, peak.group, obs.group, scope.group, board.group, furniture],
    board,
    shots: {
      // Out on the snow below the summit, looking up at the dome with its slit
      // open and the Milky Way standing over it.
      vista: (() => {
        const at = v(5.5, 0, 25);
        at.y = height(at.x, at.z) + 1.7;
        return { pos: at, target: v(-1.2, 8.2, 1.95), fov: 50, lean: 0.3 };
      })(),
      window: { pos: v(0.3, 1.3, 0.7), target: v(-3, 26, -28), fov: 54, lean: 0.04 },
      board: { pos: v(0, 1.66, 0.1), target: boardAt.clone().add(v(0, 0.6, 0)), fov: 44, lean: 0.03 },
    },
    // Up the snow to the dome, in through the slit past the telescope, and down to the desk.
    intro: { via: [v(3.6, 3, 17), v(1.6, 4.1, 10), v(0.9, 3.7, 6.1), v(1.55, 2.7, 3.2), v(1.45, 1.85, 1.75)], duration: 10, lines: ['EVOLVING WORD', 'A LITTLE STUDIO UNDER THE STARS', 'WHERE WE MAKE THINGS TOGETHER'] },
    tagline: 'A LITTLE STUDIO UNDER THE STARS.',
    band,

    arrange(studio: Studio) {
      const { line, honors, map, shelf, shoes } = studio;
      /** Stands a piece at a station, `r` out from the middle, its front (local +z) turned to face in. */
      const stand = (o: THREE.Object3D, az: number, r: number, y = o.position.y, turn = 0) => {
        o.position.copy(around(az, r, y));
        o.rotation.y = -az * RAD + turn;
      };
      stand(honors.group, STATIONS.honors, 4.3);
      stand(shelf.group, STATIONS.library, 4.12);
      stand(map.group, STATIONS.map, 4.18);
      // The shoes kicked off in front of the easel.
      stand(shoes.group, STATIONS.map - 3, 3.88, 0, 0.75);
      // The line: its middle at its station, running along the wall.
      const before = line.group.matrixWorld.clone();
      const mid = 0.775;
      const a = -STATIONS.line * RAD;
      line.group.rotation.y = a;
      line.group.position.copy(around(STATIONS.line, 4.08)).addScaledVector(v(Math.cos(a), 0, -Math.sin(a)), -mid);
      line.group.updateMatrixWorld(true);
      // Its shirts' places move with it (the projects shot is worked out from them).
      const moved = line.group.matrixWorld.clone().multiply(before.invert());
      for (const item of line.items) item.focus.applyMatrix4(moved);
      line.center.applyMatrix4(moved);
      // The medal board, brass now, a bar hung from the rail.
      honors.group.traverse((o) => {
        const m = o as THREE.Mesh;
        const p = (m.geometry as THREE.BoxGeometry | undefined)?.parameters;
        if (m.isMesh && p && Math.abs(p.width - 0.62) < 1e-3 && Math.abs(p.height - 0.07) < 1e-3) m.material = new THREE.MeshStandardMaterial({ color: '#b98d4a', roughness: 0.32, metalness: 0.9 });
      });
      // Now everything they stand on.
      for (const o of [honors.group, shelf.group, map.group, line.group, shoes.group]) o.updateMatrixWorld(true);
      furniture.add(honorsRail(honors.group, honors.diplomas), easel(map.group, map.group.position.y), lineFrame(line.group));
      glints = medalGlints(honors.medals);
      furniture.add(glints.group);
      const globe = celestialGlobe();
      globe.group.position.copy(around(STATIONS.library - 17, 3.75));
      globe.group.rotation.y = 0.6;
      furniture.add(globe.group);
    },

    closeups() {
      const placesAz = (STATIONS.map + STATIONS.line) / 2;
      return {
        // Back from the wall, so the map, the line and the shoes all fit.
        places: { pos: around(placesAz + 3, 1.3, 1.6), target: around(placesAz + 3, 4.2, 1.12), fov: 58, lean: 0.05 },
        // Across the room at the telescope, the slit's sky behind it.
        scope: { pos: SCOPE_FROM.clone(), target: CENTER.clone().setY(1.95), fov: 56, lean: 0.06, shift: 0.13 },
        eyepiece: eyepieceShot(),
      };
    },

    walls: [
      { id: 'desk', name: 'The desk' },
      { id: 'honors', name: 'Medals & diplomas', members: ['diplomas', 'medals'] },
      { id: 'library', name: 'The library' },
      { id: 'scope', name: 'The telescope', members: ['eyepiece'] },
      { id: 'places', name: 'Map, shirts & shoes', members: ['map', 'shoes', 'projects'] },
    ],

    wire(w) {
      wiring = w;
      w.touch({
        object: scope.group,
        label: () => (w.current() === 'eyepiece' ? 'Next' : w.current() === 'scope' ? 'Look through it' : 'The telescope'),
        onClick: () => {
          const here = w.current();
          if (here === 'eyepiece') return next();
          if (here !== 'scope') return w.goTo('scope');
          if (w.moving() || looking) return;
          // Swing to the next thing and go and look.
          if (started) target = (target + 1) % TARGETS.length;
          started = true;
          looking = true;
          w.sound.click();
        },
      });
    },

    frame({ t, dt, camera, renderer, shot }) {
      if (sky.tick(t, dt, camera, renderer)) band.meteor();
      peak.tick(t, camera, renderer);
      board.setPixelRatio(renderer.getPixelRatio());
      glints?.tick(t, shot === 'honors' || shot === 'medals' || shot === 'diplomas' ? 1 : 0);
      eyepiece.tick(t, dt);

      // Which way you're looking, and whether you're in the dome or out on the snow.
      camera.getWorldDirection(fwd);
      if (Math.abs(fwd.y) < 0.97) yaw = Math.atan2(fwd.x, -fwd.z) / RAD;
      const dx = camera.position.x - CENTER.x;
      const dz = camera.position.z - CENTER.z;
      const r = Math.hypot(dx, dz);
      const up = Math.max(0, camera.position.y - SPRING);
      const inside = camera.position.y < SPRING + R_IN && r < Math.sqrt(Math.max(0, R_IN * R_IN - up * up)) - 0.35;
      const from = Math.atan2(dx, -dz) / RAD;

      // At the telescope, the dome turns to wherever it's pointed; otherwise it
      // follows your eyes (from outside, it turns its slit to you).
      const atScope = shot === 'scope' || shot === 'eyepiece';
      const aimAz = atScope ? STATIONS.scope + TARGETS[target].offset : yaw;
      const aimEl = atScope ? TARGETS[target].el : PARK;
      // Like a real one, the dome doesn't chase every glance: it waits until
      // you've looked a little way off the slit's middle, then comes round.
      const wanted = atScope ? aimAz : inside ? yaw : from;
      if (atScope || Math.abs(delta(domeAim, wanted)) > 6) domeAim = wanted;
      // A jump (not a flight) lands with the dome already round.
      const jumped = camera.position.distanceTo(lastEye) > 1.5;
      lastEye.copy(camera.position);
      if (jumped) {
        domeAim = wanted;
        dome.snap(domeAim);
        tubeAz.snap(atScope ? aimAz : inside ? domeAim : yaw);
        tubeEl.snap(aimEl);
      }
      const domeAz = dome.step(domeAim, dt);
      obs.setAzimuth(domeAz);
      obs.lightFrom(!inside);
      const az = tubeAz.step(atScope ? aimAz : inside ? domeAim : yaw, dt);
      const el = tubeEl.step(aimEl, dt, false);
      scope.point(az, el);
      band.motor(Math.max(0, dome.speed() + tubeAz.speed() * 0.3 - 1.5) / 38);
      peak.spill.copy(around(domeAz, 4.9, 2.3));
      // The constellation only out there in the slit's sky, not from outside.
      board.group.visible = inside;

      // Swung round and settled: go and look.
      if (looking && Math.abs(delta(az, aimAz)) < 0.6 && Math.abs(el - aimEl) < 0.6) {
        looking = false;
        Object.assign(SHOTS.eyepiece, eyepieceShot());
        wiring?.goTo('eyepiece');
      }

      // Arriving somewhere of ours: the cards, the view, the words on the plate.
      const still = wiring ? !wiring.moving() : true;
      const here = still ? shot : '';
      if (here !== arrived) {
        arrived = here;
        if (here === 'scope') {
          wiring?.card(
            'The telescope',
            'Have a look',
            [
              'A big old refractor, a lens as wide as a dinner plate at the top of a tube three meters long. Wherever the dome turns, it points out of the slit.',
              'Click it and it swings round to something worth seeing, and you put your eye to it: Saturn, Jupiter, a nebula, a cluster of stars.',
            ],
            [{ label: 'Look through it', run: () => ((started && !looking ? (target = (target + 1) % TARGETS.length) : 0), (started = true), (looking = true)) }],
          );
          if (!said) {
            said = true;
            wiring?.say('THE HEAVENS DECLARE THE GLORY OF GOD · PSALM 19:1');
          }
        }
        if (here === 'eyepiece') {
          started = true;
          eyepiece.open(target);
          card();
        }
      }
      if (eyepiece.isOpen() && shot !== 'eyepiece') eyepiece.close();
    },

    outside(camera) {
      const r = Math.hypot(camera.position.x - CENTER.x, camera.position.z - CENTER.z);
      if (r > R_IN || camera.position.y > SPRING + R_IN) return 1;
      // Inside, the wind is louder the nearer the slit you stand.
      return THREE.MathUtils.clamp((r - 1.2) / 3, 0, 1) * 0.6 + (camera.position.y > LEDGE + 1.5 ? 0.15 : 0);
    },

    debug: {
      sky,
      peak,
      observatory: obs,
      telescope: Object.assign(scope, {
        /** Points it at the next target and goes to look, as a click at the telescope would. */
        look: () => ((started = true), (looking = true)),
        target: () => target,
        view: eyepiece,
      }),
      stars: board,
      domeAz: () => dome.get(),
    },
  };
  return kit;
};
