// The Night Train: the studio in a sleeper compartment, crossing a continent
// at night. The car stands still and the land goes by the window: fields and
// a level crossing, a stone viaduct over a gorge, a snowy pass with its sheds
// and tunnel, a city at 3am, a lake under the moon. At every junction a lever
// on the wall lights up, and which way you throw it is where the train goes
// next. There's an emergency brake, a window that drops open, a horn on a cord,
// a ticket the conductor punches, and stations where the split-flap signs
// breed the evolving word.
import * as THREE from 'three';
import { SHOTS, type Shot } from '../../camera';
import { DESK_Y } from '../../desk';
import { glow } from '../../textures';
import type { Kit, KitModule, Studio, Wall, Wiring } from '../kit';
import { buildBoard } from './board';
import { buildCar } from './car';
import { buildLand } from './chunks';
import { SHED_PILLARS, type Sweep } from './scenery';
import { buildConsist } from './consist';
import { BRAKE_AT, buildControls, LEVER_AT, type LeverState } from './controls';
import { DWELL, FIRST_LEAD, Journey, LAYOUT, LEVER_LIT, LEVER_LOCK, NAMES, VIADUCT_LIMIT, type Land, type Leg, type TrainEvent } from './journey';
import { smooth } from './mesher';
import { nightUniforms, STATION_TEX } from './night';
import { planFor, type StationPlan } from './station';
import { CORRIDOR, MIDDLE, ROOM, route, solid, TABLE, WINDOW, WINDOW_X, clear, where, THROUGH, BUNK } from './plan';
import { buildRouteMap } from './routemap';
import { buildSky } from './sky';
import { buildBand } from './sound';
import { buildSparks } from './sparks';
import { buildTicket, MAX_HOLES } from './ticket';

const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

/** In the open, with a hand's width of air on every side: somewhere the camera can stop without the near plane cutting into anything. */
const roomy = (p: THREE.Vector3) => [v(0, 0, 0), v(0.08, 0, 0), v(-0.08, 0, 0), v(0, 0, 0.08), v(0, 0, -0.08), v(0, 0.08, 0), v(0, -0.08, 0)].every((d) => !solid(p.clone().add(d)));

/** Where the pieces go on the table, along it from the bunk end. */
const ON_TABLE = {
  lamp: v(-0.46, DESK_Y, -1.43),
  pad: v(-0.2, DESK_Y, -1.08),
  watch: v(0.1, DESK_Y, -1.3),
  ticket: v(0.33, DESK_Y + 0.003, -0.98),
  cup: v(0.44, DESK_Y, -1.27),
  bowl: v(0.62, DESK_Y, -1.43),
  rolodex: v(0.7, DESK_Y, -1.08),
  crt: v(1.13, DESK_Y, -1.27),
};

const CARD = 0.13;
/** The window's glass, across the wall's thickness. */
const GLASS_Z = -1.59;

/** The air in each landscape: how thick the haze is, how much mist lies low, and its color. */
const AIR: Record<Land, { haze: number; mist: number; color: THREE.Color }> = {
  fields: { haze: 0.0013, mist: 0.5, color: new THREE.Color('#18223a') },
  gorge: { haze: 0.00095, mist: 0.25, color: new THREE.Color('#172139') },
  pass: { haze: 0.00075, mist: 0.1, color: new THREE.Color('#1b2843') },
  city: { haze: 0.0017, mist: 0.05, color: new THREE.Color('#2a2019') },
  lake: { haze: 0.001, mist: 0.55, color: new THREE.Color('#17223a') },
};
const hazeCol = new THREE.Color();
const NO_SHEDS: [number, number][] = [];
const LAMP_WARM = new THREE.Color('#ffb874');
/** The crossing's lamps flash in turn, once round every this many seconds. */
const CROSSING_BLINK = 1.1;
const LAMP_WHITE = new THREE.Color('#ffe2bc');
const signAt = new THREE.Vector3();

export const buildKit: KitModule['buildKit'] = ({ quality, scene, log }) => {
  log('COUPLING THE CARS', 40);
  scene.background = new THREE.Color('#03050b');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const uniforms = nightUniforms();
  // We join the train on the viaduct, over the gorge.
  // (A longer first stretch than usual, so the first junction's lever lights up a little after you sit down.)
  const VIADUCT = LAYOUT.gorge.viaduct!;
  const journey = new Journey({ land: 'gorge', at: VIADUCT[0] + 150, speed: VIADUCT_LIMIT, lead: FIRST_LEAD });
  const board = buildBoard(1.32);
  board.group.position.set(WINDOW_X, 1.955, ROOM.z0 + 0.032);
  const car = buildCar();
  const consist = buildConsist(car.materials as never);
  const controls = buildControls({ brass: car.materials.brass, iron: car.materials.iron });
  log('LAYING THE LINE', 55);
  const sky = buildSky(quality);
  // (On a slower computer, fewer trees and houses far off.)
  const land = buildLand({ journey, uniforms, flapTexture: board.texture, detail: quality === 'high' ? 1 : 0.55 });
  const ticket = buildTicket();
  const routeMap = buildRouteMap(journey);
  const band = buildBand();
  log('LIGHTING THE LAMPS', 65);

  // What's outside sways as the car rocks (with the camera inside, it's the world that seems to move).
  const outside = new THREE.Group();
  outside.add(land.group);
  const skyHolder = new THREE.Group();
  skyHolder.add(sky.group);

  // --- the brakes' sparks ------------------------------------------------------------------
  const sparks = buildSparks({ count: quality === 'high' ? 360 : 200, reduced });

  // --- the lamps in the glass ---------------------------------------------------------------
  // At night the window gives back the lamps. Each reflection sits where the lamp's mirror image
  // is, behind the pane, so it's only seen in the glass and moves as it should when you move.
  const mirror = (p: THREE.Vector3) => p.clone().setZ(GLASS_Z - (p.z - GLASS_Z));
  const glints = new THREE.Group();
  const glintMat = (c: string) => new THREE.SpriteMaterial({ map: glow('rgba(255,210,150,1)', 64), color: c, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.3 });
  const glintLamp = new THREE.Sprite(glintMat('#ffcf96'));
  glintLamp.position.copy(mirror(ON_TABLE.lamp.clone().add(v(0, 0.29, 0))));
  glintLamp.scale.setScalar(0.2);
  const glintRead = new THREE.Sprite(glintMat('#ffd8a8'));
  glintRead.position.copy(mirror(v(ROOM.x0 + 0.17, 1.31, 0.02)));
  glintRead.scale.setScalar(0.13);
  glints.add(glintLamp, glintRead);

  // --- the station's sign: something to click when one's outside -----------------------------
  const signHit = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.7, 0.2), new THREE.MeshBasicMaterial({ visible: false }));
  signHit.visible = false;

  // --- state -----------------------------------------------------------------------------------
  let fast = 1;
  let windowAim = 0;
  let windowK = 0;
  let wiring: Wiring | null = null;
  let arrived = '';
  let landNow: Land = journey.current().land;
  let flicker = 1;
  let flickerUntil = -1;
  let flickerNext = 0;
  let jolt = 0;
  let whistled = false;
  let crickets = 0;
  let tunnelK = 0;
  let firstHorn = true;
  /** Where we were when the brake was pulled, to go back to when the train moves off. */
  let cameBack = '';
  let deskLamp: { spot: THREE.SpotLight; fill: THREE.PointLight; base: [number, number] } | null = null;
  let lastRenderer: THREE.WebGLRenderer | null = null;
  let lastCalls = 0;
  const look = new THREE.Vector3();
  let lineItems: Studio['line']['items'] = [];
  ticket.stamp(landNow);
  const hintsEl = () => document.getElementById('hints');
  let hints = '';
  let quietAt = 0;

  /** Each stretch's station, worked out once. */
  const plans = new WeakMap<Leg, StationPlan | null>();
  const planOf = (l: Leg) => {
    let p = plans.get(l);
    if (p === undefined) plans.set(l, (p = planFor(l)));
    return p;
  };
  /** The station whose light is in the strip now. */
  let stationNow: StationPlan | null = null;
  /**
   * Fills the strip along the station that its light reads (see STATION_TEX): red where light comes out
   * through the front of the house at platform level (lit windows, the hatch, the fanlights), green under the canopy.
   */
  const fillStation = (P: StationPlan | null) => {
    const tex = uniforms.uStationTex.value as THREE.DataTexture;
    const data = (tex.image as { data: Uint8Array }).data;
    data.fill(0);
    if (P) {
      const T = STATION_TEX;
      const per = T.size / T.length;
      const add = (u0: number, u1: number, ch: number, k: number) => {
        const a = (u0 - P.stop - T.from) * per;
        const e = (u1 - P.stop - T.from) * per;
        for (let i = Math.max(0, Math.floor(a)); i <= Math.min(T.size - 1, Math.ceil(e)); i++) {
          const c = Math.min(1, Math.max(0, Math.min(i + 1, e) - Math.max(i, a)));
          data[i * 4 + ch] = Math.min(255, data[i * 4 + ch] + Math.round(c * k * 255));
        }
      };
      for (const g of P.glows) add(g.u0, g.u1, 0, Math.min(1, g.k * 0.8));
      add(P.c0, P.c1, 1, 1);
    }
    tex.needsUpdate = true;
  };

  /** How deep in the tunnel our window is (0 outside). */
  const tunnelAt = (u: number) => {
    let k = 0;
    for (const l of journey.legs) {
      const t = LAYOUT[l.land].tunnel;
      if (!t) continue;
      const a = l.start + t[0];
      const b = l.start + t[1];
      k = Math.max(k, smooth(a - 4, a + 6, u) * (1 - smooth(b - 6, b + 4, u)));
    }
    return k;
  };
  /** How much moonlight reaches the window: none in the tunnel, in strips through the sheds' pillars. */
  const openness = (u: number) => {
    let k = 1 - tunnelAt(u);
    for (const l of journey.legs) {
      for (const [a, b] of LAYOUT[l.land].sheds ?? NO_SHEDS) {
        const inside = smooth(l.start + a - 3, l.start + a + 3, u) * (1 - smooth(l.start + b - 3, l.start + b + 3, u));
        if (inside <= 0) continue;
        const step = SHED_PILLARS.step;
        const m = ((u % step) + step) % step;
        const gap = Math.min(m, step - m);
        k = Math.min(k, 1 - inside * (1 - 0.55 * smooth(0.25, 0.7, gap)));
      }
    }
    return k;
  };

  // --- what happens when ---------------------------------------------------------------------
  const say = (text: string) => {
    if (!wiring || !document.body.classList.contains('ready')) return;
    wiring.say(text);
    quietAt = performance.now() + 9000;
  };
  const leverState = (): LeverState => {
    const j = journey.junction();
    return j.live ? 'live' : j.left <= LEVER_LOCK && j.left > 0 ? 'locked' : 'idle';
  };
  const branchName = (i: 0 | 1) => NAMES[journey.junction().to[i]].toLowerCase();
  const leverCard = () => {
    const j = journey.junction();
    const st = leverState();
    const set = branchName(j.set);
    const other = branchName(j.set ? 0 : 1);
    const body =
      st === 'live'
        ? [`Points ahead: the line forks for ${branchName(0)} or ${branchName(1)}. They're set for ${set}${j.by === 'you' ? ', your choice' : ''}.`, `Throw the lever and we'll take ${other} instead. Leave it and the train goes the way it's set.`]
        : st === 'locked'
          ? [`Too late to change these: the points are set for ${set}, and the lamp's gone green.`, 'The lever lights up again as the next junction comes.']
          : [`No points for a while. We're in ${NAMES[landNow].toLowerCase()}; at the end of it the line forks for ${branchName(0)} or ${branchName(1)}.`, 'The lamp lights up as the junction comes near. Then pull the lever to pick.'];
    wiring?.card('The points lever', st === 'live' ? 'A junction ahead' : st === 'locked' ? 'Set and locked' : 'No junction yet', body, st === 'live' ? [{ label: 'Throw the lever', run: () => pull() }] : []);
  };
  /** Standing at the lever with its card up: the card follows the junction. */
  const atLever = () => !!wiring && wiring.current() === 'lever' && !wiring.moving();
  const pull = () => {
    if (!journey.pull()) {
      wiring?.goTo('lever');
      return false;
    }
    land.invalidate(journey.changedFrom);
    controls.setLever(journey.junction().to, journey.junction().set, leverState());
    controls.throwLever();
    band.lever();
    say(`POINTS SET FOR ${NAMES[journey.junction().to[journey.junction().set]].toUpperCase()}`);
    if (wiring?.current() === 'lever') leverCard();
    return true;
  };
  const brake = () => {
    if (!journey.brake()) {
      const p = journey.phase;
      say(p === 'dwell' ? "WE'RE STANDING IN A STATION" : p === 'braking' ? 'ALREADY STOPPING' : p === 'still' ? "STOPPED · WE'LL BE OFF IN A MINUTE" : p === 'easing' ? 'THE BRAKES ARE COMING OFF' : "WE'RE BARELY MOVING");
      return false;
    }
    controls.setBrake(true);
    band.brakeOn();
    wiring?.sound.click();
    say('EMERGENCY STOP');
    // Out by the line to watch the sparks, if we're in the compartment: out through the door and the
    // corridor window that's let down. Unless there's no room out there (a tunnel, the sheds), when
    // it's nose to the glass to see them light up the night under the window.
    const here = wiring?.current() ?? '';
    if (wiring && where(SHOTS[here]?.pos ?? MIDDLE) === 'room') {
      cameBack = here;
      wiring.goTo(roomOutside(journey.s, journey.v) ? 'sparks' : 'window');
    }
    return true;
  };
  /**
   * Room to stand beside the line, where the sparks shot is, from here until the train has stopped:
   * no tunnel, sheds or crossing along the way, and the ground (a cutting's side, a hill) well below.
   */
  const roomOutside = (s: number, v: number) => {
    const a = s - 40;
    const b = s + (v * v) / (2 * 1.4) + 60;
    for (const l of journey.legs) {
      const L = LAYOUT[l.land];
      for (const [x0, x1] of [...(L.sheds ?? []), ...(L.tunnel ? [L.tunnel] : []), ...(L.crossing !== undefined ? [[L.crossing, L.crossing] as [number, number]] : [])])
        if (l.start + x1 + 25 > a && l.start + x0 - 25 < b) return false;
    }
    const at = SHOTS.sparks?.pos;
    if (!at) return false;
    for (let u = a; u <= b; u += 4) for (const dz of [-1.2, 0, 1.2]) if (land.ground(u + at.x, at.z + dz) > at.y - 0.6) return false;
    return true;
  };
  const toggleWindow = () => {
    windowAim = windowAim > 0.5 ? 0 : 1;
    band.windowSlide(windowAim > 0.5);
    say(windowAim > 0.5 ? 'THE WINDOW DOWN · THE NIGHT COMES IN' : 'THE WINDOW UP');
  };
  const horn = () => {
    controls.pullCord();
    band.horn(tunnelK > 0.5 ? 'tunnel' : landNow);
    if (firstHorn) {
      firstHorn = false;
      say('THE HORN, FAR UP AT THE FRONT · H TO SOUND IT AGAIN');
    }
  };
  const ticketCard = () => {
    const st = ticket.state();
    const stamps = st.stamps.map((l) => NAMES[l].toLowerCase());
    wiring?.card(
      'The conductor',
      'Your ticket',
      [
        st.holes.length ? `Punched ${st.holes.length} time${st.holes.length === 1 ? '' : 's'}${st.holes.length >= MAX_HOLES ? ', and no room for another.' : '.'}` : 'Not punched yet. Click it and the conductor will.',
        stamps.length ? `Stamped for ${stamps.length === 1 ? stamps[0] : `${stamps.slice(0, -1).join(', ')} and ${stamps[stamps.length - 1]}`}.` : 'A stamp for each landscape you pass through.',
        'It remembers, on this computer.',
      ],
      [
        { label: 'Punch it', run: () => punch() },
        { label: 'A fresh ticket', quiet: true, run: () => (ticket.renew(), ticket.stamp(landNow), wiring?.sound.click(), ticketCard()) },
      ],
    );
  };
  const punch = () => {
    const ok = ticket.punch();
    if (ok) band.punch();
    if (wiring?.current() === 'ticket') ticketCard();
    return ok;
  };
  const onEvent = (e: TrainEvent) => {
    switch (e.kind) {
      case 'points':
        if (atLever()) leverCard();
        band.points();
        flickerUntil = performance.now() + 750;
        jolt = 1;
        if (e.to.land !== e.from.land) {
          landNow = e.to.land;
          if (ticket.stamp(e.to.land)) say(`${NAMES[e.to.land].toUpperCase()} · STAMPED ON YOUR TICKET`);
        }
        break;
      case 'lit': {
        band.lit();
        const j = journey.junction();
        say(`THE LEVER'S LIT · ${NAMES[j.to[j.set ? 0 : 1]].toUpperCase()} OR ${NAMES[j.to[j.set]].toUpperCase()}`);
        if (atLever()) leverCard();
        break;
      }
      case 'locked':
        if (atLever()) leverCard();
        break;
      case 'arrive':
        band.chime();
        board.next();
        whistled = false;
        say(`${e.name} · A FEW MINUTES HERE`);
        break;
      case 'depart':
        say('AND AWAY');
        break;
      case 'stopped':
        band.brakeOff();
        say('STOPPED · LISTEN');
        if (wiring?.current() === 'sparks')
          wiring.card('Emergency stop', 'Stopped', ['Somewhere out in the night, nowhere in particular. Listen: crickets, the wind.', 'In a moment the brakes come off and we ease away again.']);
        break;
      case 'release':
        controls.setBrake(false);
        band.release();
        // Away again: back in out of the night before the line goes on.
        if (wiring && wiring.current() === 'sparks') wiring.goTo(cameBack && SHOTS[cameBack] && cameBack !== 'sparks' ? cameBack : 'brake');
        break;
      case 'away':
        break;
    }
  };

  // --- the shots --------------------------------------------------------------------------------
  const walls: Wall[] = [
    { id: 'desk', name: 'The table', members: ['signal', 'about', 'watch', 'pad', 'treats', 'work', 'ticket', 'lever', 'brake', 'sparks', 'board', 'window'] },
    { id: 'honors', name: 'Medals & books', members: ['medals', 'library'] },
    { id: 'corridor', name: 'The corridor', members: ['diplomas', 'projects'] },
    { id: 'places', name: 'Bunk, map & shoes', members: ['map', 'route', 'shoes'] },
  ];
  const projectShot = (focus: THREE.Vector3): Shot => ({ pos: v(focus.x + 0.12, 1.6, CORRIDOR.z1 - 0.14), target: focus.clone().add(v(0, 0.02, 0)), fov: 48, lean: 0.02, shift: CARD });

  const kit: Kit = {
    objects: [car.group, consist.group, controls.group, board.group, outside, skyHolder, sparks.group, signHit, routeMap.mesh, glints],
    board,
    shots: {
      // Down in the gorge on the corridor's side, the train crossing the viaduct along the top of its
      // arches, its windows lit all along, the moon through an arch.
      vista: { pos: v(28, -19, 66), target: v(-10, -8, 0), fov: 44, lean: 0.3 },
      // Nose to the glass, looking out and a little back, down at what's going by.
      window: { pos: v(0.12, 1.36, -1.2), target: v(-0.9, 0.85, -9), fov: 62, lean: 0.03 },
      board: { pos: v(0.12, 1.86, -0.32), target: v(WINDOW_X, 1.95, ROOM.z0), fov: 40, lean: 0.02 },
    },
    // Up out of the gorge to the train, in through the corridor window across from our door, through the door to the table.
    intro: { via: [v(5.5, -3.5, 19), v(2.4, 0.9, 8), THROUGH.farSide, THROUGH.outsideSide, THROUGH.insideSide, THROUGH.corridor, THROUGH.room], duration: 11, lines: ['EVOLVING WORD', 'A LITTLE STUDIO ON THE NIGHT TRAIN', 'WHERE WE MAKE THINGS TOGETHER'] },
    tagline: 'A LITTLE STUDIO ON THE NIGHT TRAIN.',
    band,
    walls,
    route,
    projectShot: (focus) => projectShot(focus),

    arrange(s: Studio) {
      lineItems = s.line.items;
      // The desk becomes the table under the window: the big desk and the plant go; the
      // CRT on its deck goes to the far end, the lamp to the window.
      const top = DESK_Y;
      const shift = ON_TABLE.crt.clone().sub(v(-0.12, top, -1.6));
      for (const o of [...s.desk.group.children]) {
        if (o === s.desk.lamp) continue;
        if (o.position.y < top - 0.01 || o === s.desk.plant) {
          s.desk.group.remove(o);
          continue;
        }
        if ((o as THREE.SpotLight).isSpotLight || (o as THREE.Sprite).isSprite) continue;
        if ((o as THREE.PointLight).isPointLight && (o as THREE.PointLight).color.getHexString() !== '7fe0c0') continue;
        if (o === (s.desk.group.children.find((c) => (c as THREE.SpotLight).isSpotLight) as THREE.SpotLight | undefined)?.target) continue;
        o.position.add(shift);
      }
      // The lamp: a little brass one with a silk shade, the kind every sleeper had at the window.
      const lamp = s.desk.lamp;
      const bulbMesh = lamp.children.find((c) => (c as THREE.Mesh).geometry instanceof THREE.SphereGeometry) as THREE.Mesh | undefined;
      for (const c of [...lamp.children]) lamp.remove(c);
      lamp.position.copy(ON_TABLE.lamp);
      const brass = car.materials.brass;
      const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.065, 0.02, 24), brass);
      foot.position.y = 0.01;
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.01, 0.26, 10), brass);
      stem.position.y = 0.15;
      const silk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.055, 0.095, 0.11, 24, 1, true),
        new THREE.MeshStandardMaterial({ color: '#f1c99a', emissive: new THREE.Color('#ffb066'), emissiveIntensity: 0.85, roughness: 0.7, side: THREE.DoubleSide }),
      );
      silk.position.y = 0.3;
      lamp.add(foot, stem, silk);
      if (bulbMesh) {
        bulbMesh.position.set(0, 0.27, 0);
        bulbMesh.scale.setScalar(0.6);
        lamp.add(bulbMesh);
      }
      for (const m of [foot, stem, silk]) m.castShadow = true;
      const bulbAt = ON_TABLE.lamp.clone().add(v(0, 0.27, 0));
      const spot = s.desk.group.children.find((o) => (o as THREE.SpotLight).isSpotLight) as THREE.SpotLight | undefined;
      const fill = s.desk.group.children.find((o) => (o as THREE.PointLight).isPointLight && (o as THREE.PointLight).color.getHexString() !== '7fe0c0') as THREE.PointLight | undefined;
      const halo = s.desk.group.children.find((o) => (o as THREE.Sprite).isSprite);
      if (spot) {
        spot.position.copy(bulbAt).add(v(0, -0.02, 0.03));
        spot.target.position.copy(bulbAt).add(v(0.35, -0.3, 0.32));
        spot.angle = 1.05;
        // It lights the table and not much past it, so only what's on the table need cast a shadow for it.
        spot.distance = 1.7;
      }
      fill?.position.copy(bulbAt).add(v(0, 0.05, 0.1));
      if (halo) {
        halo.position.copy(bulbAt);
        halo.scale.setScalar(0.32);
      }
      // (A shaded lamp a hand's breadth over the table: much gentler than the desk's.)
      if (spot && fill) deskLamp = { spot, fill, base: [1.15, 0.45] };
      // Its shadows needn't be as fine on a slower computer.
      if (spot && quality !== 'high') spot.shadow.mapSize.set(512, 512);
      // The rest of the table.
      s.watch.group.position.copy(ON_TABLE.watch);
      s.watch.group.rotation.y = -0.2;
      s.pad.group.position.copy(ON_TABLE.pad);
      s.pad.group.rotation.y = 0.22;
      s.treats.cup.position.copy(ON_TABLE.cup);
      s.treats.bowl.position.copy(ON_TABLE.bowl);
      s.rolodex.group.position.copy(ON_TABLE.rolodex);
      s.rolodex.group.rotation.y = -0.5;
      ticket.mesh.position.copy(ON_TABLE.ticket);
      ticket.mesh.rotation.z = 0.25;
      car.group.add(ticket.mesh);
      // The medals on the coat hooks; the diplomas out in the corridor; the board they hung from, gone.
      const honors = s.honors;
      for (const o of [...honors.group.children]) {
        const g = (o as THREE.Mesh).geometry as THREE.BoxGeometry | THREE.CylinderGeometry | undefined;
        const p = g?.parameters as Record<string, number> | undefined;
        if (p && ((Math.abs((p.width ?? 0) - 0.62) < 1e-3 && Math.abs((p.height ?? 0) - 0.07) < 1e-3) || (p.radiusTop === 0.006 && p.height === 0.03))) honors.group.remove(o);
      }
      honors.medals.forEach((m, i) => {
        const hook = car.spots.hooks[i] ?? car.spots.hooks[0];
        car.group.add(m);
        m.position.copy(hook).add(v(0, (i % 2) * 0.03, 0));
        m.rotation.set(0, -Math.PI / 2, 0);
      });
      honors.diplomas.forEach((d, i) => {
        car.group.add(d);
        d.position.set(-0.9 + i * 0.58, 1.55 + (i % 2) * 0.03, CORRIDOR.z0 + 0.016);
        d.rotation.set(0, 0, 0);
      });
      // The bookshelf, smaller, on the end wall by the door, a brass rail across each shelf.
      s.shelf.group.scale.setScalar(0.6);
      s.shelf.group.position.set(ROOM.x1, 0, -0.25);
      s.shelf.group.rotation.y = -Math.PI / 2;
      for (const y of [0.08, 0.5, 0.92, 1.34])
        for (const h of [0.1, 0.17]) {
          const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 1.5, 8).rotateZ(Math.PI / 2), brass);
          rail.position.set(0, y + h, 0.32);
          s.shelf.group.add(rail);
        }
      // The map over the bunk, the route plate under it; the shoes kicked under the bunk.
      s.map.group.scale.setScalar(0.74);
      // Its picture light, gentler in here: the map's close to it.
      s.map.group.traverse((o) => {
        if ((o as THREE.SpotLight).isSpotLight) Object.assign(o as THREE.SpotLight, { intensity: 0.8, penumbra: 1, angle: 1.2 });
      });
      s.map.group.position.set(ROOM.x0 + 0.016, 1.58, -0.62);
      s.map.group.rotation.y = Math.PI / 2;
      routeMap.mesh.position.copy(car.spots.route);
      routeMap.mesh.rotation.y = Math.PI / 2;
      s.shoes.group.position.set(BUNK.x1 - 0.18, 0, -0.42);
      s.shoes.group.rotation.y = 0.12;
      // The shirts on hangers from a brass rail in the corridor, between two doors.
      const line = s.line;
      line.group.position.set(-4.15, -0.3, CORRIDOR.z0 + 0.13);
      line.group.rotation.y = 0;
      for (const o of [...line.group.children]) {
        const g = (o as THREE.Mesh).geometry;
        if (g instanceof THREE.TubeGeometry || g instanceof THREE.CylinderGeometry) line.group.remove(o);
      }
      for (const it of line.items) {
        for (const o of [...it.object.children]) if ((o as THREE.Mesh).geometry instanceof THREE.BoxGeometry && ((o as THREE.Mesh).geometry as THREE.BoxGeometry).parameters.width < 0.02) it.object.remove(o);
        // A wire hanger: a hook over the rail, a triangle across the shoulders.
        const wire = car.materials.brass;
        const hook = new THREE.Mesh(new THREE.TorusGeometry(0.025, 0.003, 6, 14, Math.PI * 1.4), wire);
        hook.position.set(0, 0.06, 0);
        hook.rotation.z = -0.3;
        it.object.add(hook);
        for (const s2 of [-1, 1]) {
          const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.24, 6), wire);
          bar.position.set(s2 * 0.1, -0.005, 0.006);
          bar.rotation.z = s2 * 1.15;
          it.object.add(bar);
        }
        const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.04, 6), wire);
        neck.position.set(0, 0.035, 0.004);
        it.object.add(neck);
      }
      const railY = 2.32 - 0.3 + 0.075;
      const railMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 1.95, 12).rotateZ(Math.PI / 2), brass);
      railMesh.position.set(-3.38, railY, CORRIDOR.z0 + 0.13);
      car.group.add(railMesh);
      for (const x of [-4.3, -2.46]) {
        const br = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.13, 8).rotateX(Math.PI / 2), brass);
        br.position.set(x, railY, CORRIDOR.z0 + 0.065);
        car.group.add(br);
      }
      line.group.updateMatrixWorld(true);
    },

    closeups(s: Studio) {
      const crtAt = ON_TABLE.crt.clone().add(v(0, 0.33, 0.236));
      return {
        desk: { pos: v(0.3, 1.5, 0.13), target: v(0.14, 1.26, -1.55), fov: 64, lean: 0.04 },
        about: { pos: v(0.25, 1.5, 0.1), target: v(0.05, 1.2, -1.55), fov: 54, lean: 0.03, shift: -CARD },
        signal: { pos: crtAt.clone().add(v(0, 0.01, 0.54)), target: crtAt.clone().add(v(0, -0.004, 0)), fov: 31, lean: 0.012, near: 0.02 },
        treats: { pos: v(0.53, 1.12, -0.86), target: v(0.53, 0.8, -1.36), fov: 34, lean: 0.015, near: 0.02, shift: CARD },
        ticket: { pos: ON_TABLE.ticket.clone().add(v(0.0, 0.3, 0.17)), target: ON_TABLE.ticket.clone().add(v(0, 0, -0.005)), fov: 30, lean: 0.008, near: 0.02, shift: CARD },
        lever: { pos: v(0.9, 1.64, -0.52), target: LEVER_AT.clone().add(v(0, 0.26, 0.05)), fov: 40, lean: 0.015, shift: CARD },
        brake: { pos: v(-0.66, 1.58, -0.9), target: BRAKE_AT.clone().add(v(0, 0, 0.05)), fov: 32, lean: 0.015, shift: CARD },
        // Out by the line on the corridor's side, low, behind our wheels, looking along them: the sparks fly at you.
        sparks: { pos: v(-5.2, 0.05, 4.9), target: v(0.6, -0.9, 0.6), fov: 46, lean: 0.01, shift: CARD },
        honors: { pos: v(-0.45, 1.52, -0.24), target: v(ROOM.x1, 1.32, -0.26), fov: 52, lean: 0.04 },
        medals: { pos: v(0.55, 1.62, -0.27), target: v(ROOM.x1 - 0.05, 1.6, -0.27), fov: 40, lean: 0.015, shift: CARD },
        library: { pos: v(0.22, 1.12, -0.25), target: v(ROOM.x1, 0.66, -0.25), fov: 50, lean: 0.03, shift: 0.1 },
        corridor: { pos: v(1.05, 1.58, 0.98), target: v(-6, 1.32, 0.86), fov: 56, lean: 0.04 },
        diplomas: { pos: v(-0.6, 1.56, CORRIDOR.z1 - 0.16), target: v(-0.6, 1.56, CORRIDOR.z0), fov: 50, lean: 0.015, shift: CARD },
        places: { pos: v(1.12, 1.5, -0.5), target: v(ROOM.x0, 1.1, -0.6), fov: 54, lean: 0.04 },
        map: { pos: v(-0.22, 1.58, -0.62), target: v(ROOM.x0, 1.58, -0.62), fov: 42, lean: 0.015, shift: CARD },
        route: { pos: v(-0.18, 1.16, -0.62), target: v(ROOM.x0, 1.09, -0.62), fov: 46, lean: 0.01, shift: CARD },
        shoes: { pos: v(-0.2, 0.62, -0.18), target: s.shoes.group.position.clone().add(v(0, 0.06, 0)), fov: 40, lean: 0.01, near: 0.02, shift: CARD },
      };
    },

    wire(w) {
      wiring = w;
      w.touch({
        object: controls.lever,
        label: () => (leverState() === 'live' ? `Throw the lever: ${branchName(journey.junction().set ? 0 : 1)}` : 'The points lever'),
        onClick: () => {
          if (leverState() === 'live') pull();
          else w.goTo('lever');
        },
      });
      w.touch({ object: controls.brake, label: 'Emergency brake', onClick: () => brake() });
      w.touch({ object: controls.cord, label: 'The horn', onClick: () => horn() });
      w.touch({ object: car.windowHit, label: () => (windowAim > 0.5 ? 'Put the window up' : 'Drop the window'), noGlow: true, onClick: () => toggleWindow() });
      w.touch({
        object: ticket.mesh,
        label: () => (w.current() === 'ticket' ? 'Punch it' : 'Your ticket'),
        onClick: () => {
          if (w.current() !== 'ticket') return w.goTo('ticket');
          punch();
        },
      });
      w.touch({ object: routeMap.mesh, label: 'The line tonight', when: () => w.current() !== 'route', onClick: () => w.goTo('route') });
      // The station's sign is the word board too: click it to breed your own phrase.
      w.touch({ object: signHit, label: 'Evolve a word', onClick: () => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'e' })) });
      hints = document.getElementById('hints')?.textContent ?? '';
      // H sounds the horn, from anywhere (but not while typing on the CRT or reading).
      window.addEventListener('keydown', (e) => {
        if (e.key.toLowerCase() !== 'h' || e.metaKey || e.ctrlKey || e.altKey) return;
        if (!document.body.classList.contains('ready') || w.current() === 'signal') return;
        if (!(document.getElementById('reader')?.hidden ?? true)) return;
        horn();
      });
    },

    frame({ t, dt, camera, renderer, ready, shot }) {
      if (!lastRenderer) {
        // Every shader the land and the brakes will need, compiled now while we're still at the gate,
        // rather than when the first city or the first emergency stop comes along and stalls a frame.
        const warm = new THREE.Group();
        const tri = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute([0, -500, 0, 1, -500, 0, 0, -500, 1], 3));
        tri.setAttribute('normal', new THREE.Float32BufferAttribute([0, 1, 0, 0, 1, 0, 0, 1, 0], 3));
        for (const m of land.materials) warm.add(new THREE.Mesh(tri, m));
        renderer.compile(warm, camera, scene);
        renderer.compile(sparks.group, camera, scene);
        tri.dispose();
      }
      lastRenderer = renderer;
      // Counting draw calls for the tests: the composer draws in several passes, so add them up over a frame.
      if (!renderer.info.autoReset) {
        lastCalls = renderer.info.render.calls;
        renderer.info.reset();
      }
      // Held on the view from the gorge (a still, or a long look before stepping in): the train goes
      // round the same few arches again, so the camera, which rides along with it, stays over the gorge.
      if (shot === 'vista' && !wiring?.moving() && journey.current().land === 'gorge' && journey.s - journey.current().start > VIADUCT[0] + 230) journey.s -= 120;
      const step = Math.max(0, dt) * fast;
      // Big steps (a slow frame, or the tests' fast clock) in pieces, so nothing's skipped.
      let left = step;
      while (left > 1e-6) {
        const d = Math.min(0.1, left);
        left -= d;
        for (const e of journey.step(d)) onEvent(e);
      }
      const s = journey.s;
      const vNow = journey.v;
      const uWin = s + WINDOW_X;
      // From the compartment looking out, the far side of the train can't be seen; nor from the corridor, this side.
      camera.getWorldDirection(look);
      const at = where(camera.position);
      land.update(s, camera, renderer, at === 'room' && look.z < -0.3 ? -1 : at === 'corridor' && look.z > 0.3 ? 1 : 0);
      sky.tick(t, camera);
      land.clock.tick();
      uniforms.uTime.value = t;
      band.wheels(s, vNow);

      // The landscape we're in sets the haze, the glow and the stars.
      const mix = journey.blend(uWin);
      const airA = AIR[mix.a.land];
      const airB = AIR[mix.b.land];
      const kB = mix.b === mix.a ? 0 : mix.k;
      const haze = airA.haze + (airB.haze - airA.haze) * kB;
      const mist = airA.mist + (airB.mist - airA.mist) * kB;
      const glowK = (mix.a.land === 'city' ? 1 - kB : 0) + (mix.b.land === 'city' ? kB : 0);
      hazeCol.copy(airA.color).lerp(airB.color, kB);
      uniforms.uHazeDensity.value = haze;
      (uniforms.uHaze.value as THREE.Color).copy(hazeCol);
      uniforms.uMist.value = mist;
      (uniforms.uGlow.value as THREE.Color).setRGB(0.07, 0.04, 0.015).multiplyScalar(glowK);
      const fieldsK = (mix.a.land === 'fields' ? 1 - kB : 0) + (mix.b.land === 'fields' ? kB : 0);
      (uniforms.uLand.value as THREE.Vector3).set(((s % 24) + 24) % 24, glowK, fieldsK);
      sky.setCity(glowK);
      sky.setHaze(hazeCol, uniforms.uMoonGlow.value as THREE.Color);

      // A station near us: its platform lamps, its lit windows and its canopy light (and shade) what's round them.
      let close: StationPlan | null = null;
      let nearest = 1500;
      for (const l of journey.legs) {
        const P = planOf(l);
        if (P && Math.abs(P.stop - s) < nearest) ((nearest = Math.abs(P.stop - s)), (close = P));
      }
      if (close !== stationNow) {
        stationNow = close;
        fillStation(close);
      }
      const stationLamps = uniforms.uStation.value as THREE.Vector4;
      const own = uniforms.uStationLights.value as THREE.Vector4[];
      if (close && close.lamps.length) {
        const first = close.lamps[0] - s;
        stationLamps.set(first, first, close.lamps[close.lamps.length - 1] - s, close.kind === 'city' ? 0.85 : 0.75);
        (uniforms.uStationColor.value as THREE.Color).copy(close.kind === 'city' ? LAMP_WHITE : LAMP_WARM);
        (uniforms.uStationGeo.value as THREE.Vector4).x = close.stop + STATION_TEX.from - s;
        for (let i = 0; i < own.length; i++) {
          const q = close.lights[i];
          if (q) own[i].set(q.u - s, q.y, q.z, q.power);
          else own[i].w = 0;
        }
      } else stationLamps.w = 0;

      // Tunnel, sheds and the moon through the window.
      tunnelK = tunnelAt(uWin);
      const open = openness(uWin);
      car.lights.moon.intensity = 0.35 * open;
      uniforms.uMoonK.value = 1 - tunnelK;
      band.setTunnel(tunnelK);

      // The car rocks a little, more at speed; a jolt over the points; a lurch as the brakes bite.
      jolt = Math.max(0, jolt - dt * 2.5);
      const speed = Math.min(1, vNow / 24);
      const braking = journey.phase === 'braking' ? 1 : 0;
      const roll = reduced ? 0 : (Math.sin(t * 1.27) * 0.0016 + Math.sin(t * 0.53 + 1) * 0.0011 + Math.sin(t * 9.1) * 0.0004 * jolt) * speed + braking * Math.sin(t * 3.1) * 0.0025;
      const pitch = reduced ? 0 : braking * -0.004 + Math.sin(t * 0.8) * 0.0004 * speed;
      const bounce = reduced ? 0 : (Math.sin(t * 6.3) * 0.0015 + Math.sin(t * 17) * 0.0008 * jolt) * speed;
      // The camera's in the car: the world outside seems to rock. From outside, the car rocks instead.
      const inside = where(camera.position) !== 'out' ? 1 : 0;
      outside.rotation.set(roll * inside, 0, pitch * inside);
      outside.position.y = -bounce * inside;
      skyHolder.rotation.copy(outside.rotation);
      car.group.rotation.x = consist.group.rotation.x = -roll * (1 - inside);

      // Lamps: steady, but for a stutter as we cross the points.
      const now = performance.now();
      if (now < flickerUntil && !reduced) {
        if (now > flickerNext) {
          flickerNext = now + 40 + Math.random() * 70;
          // A dip as the current gaps at the points, not a blackout.
          flicker = Math.random() < 0.35 ? 0.5 + Math.random() * 0.25 : 0.88 + Math.random() * 0.12;
        }
      } else flicker = 1;
      car.setLamps(flicker);
      // (The desk lamp too, while it's switched on.)
      if (deskLamp && deskLamp.spot.intensity > 0) {
        deskLamp.spot.intensity = deskLamp.base[0] * flicker;
        deskLamp.fill.intensity = deskLamp.base[1] * flicker;
      }

      // The lamps in the glass: brighter the darker it is outside, gone where the window's down or we're outside.
      const dark = (1 + tunnelK * 1.6) * smooth(-1.05, -0.75, camera.position.z);
      glints.visible = inside > 0;
      glintLamp.material.opacity = (deskLamp && deskLamp.spot.intensity > 0 ? 0.22 : 0) * dark * flicker;
      glintRead.material.opacity = 0.2 * dark * flicker * (1 - windowK);

      // A lamp outside going by: its light sweeps across the compartment.
      let bestK = 0;
      let best: Sweep | null = null;
      for (const sw of land.sweeps()) {
        const du = sw.u - uWin;
        if (Math.abs(du) > 16 || sw.z > 0) continue;
        const k = sw.power * Math.exp(-(du * du) / 30);
        if (k > bestK) ((bestK = k), (best = sw));
      }
      const sweep = car.lights.sweep;
      if (best) {
        sweep.position.set(best.u - s, best.y, best.z);
        sweep.color.copy(best.color);
        sweep.intensity = bestK * 1.4;
      } else sweep.intensity = 0;

      // The window: down or up, slowly; the wind for the curtains.
      windowK += (windowAim - windowK) * Math.min(1, dt * 2.2);
      car.setWindow(windowK);
      band.setWindow(windowK);
      car.tick(t, windowK * Math.min(1, vNow / 14) * (1 - tunnelK * 0.3), speed);

      // The lever, its lamp and tabs.
      const j = journey.junction();
      const st = leverState();
      controls.setLever(j.left <= LEVER_LIT ? j.to : null, j.set, st);
      controls.tick(t, dt);
      routeMap.tick(t);

      // The brakes: their sound follows the speed; sparks from the wheels while they bite.
      if (braking) band.brakeLevel(vNow);
      const sparkRate = braking ? Math.min(1, vNow / 6) : 0;
      (uniforms.uSpark.value as THREE.Vector4).set(0.3, -1.2, 0.8, sparkRate * (1.1 + Math.random() * 1.3));
      sparks.tick(sparkRate, vNow, dt, camera, renderer);

      // Stopped out in the country: crickets. At a station, the guard's whistle before we go.
      const still = journey.phase === 'still' || journey.phase === 'dwell';
      const country = landNow !== 'city' && tunnelK < 0.2;
      crickets += ((still && country ? 1 : 0) - crickets) * Math.min(1, dt * 0.8);
      band.setCrickets(crickets);
      if (journey.phase === 'dwell' && journey.held > DWELL - 2.6 && !whistled) {
        whistled = true;
        band.whistle();
      }

      // The level crossing's bells as we come up to it, go by and leave it behind; its red lamps, flashing in turn, light the road.
      let bellLevel = 0;
      let bellPan = 0;
      let closing = 0;
      const red = uniforms.uCross.value as THREE.Vector4[];
      red[0].w = red[1].w = 0;
      for (const l of journey.legs) {
        const c = LAYOUT[l.land].crossing;
        if (c === undefined) continue;
        const du = l.start + c - uWin;
        if (Math.abs(du) > 600) continue;
        // (The pair on each side: the left one lit for the first half of each beat, the right one for the second; see the crossing in scenery.ts.)
        const right = (t / CROSSING_BLINK) % 1 >= 0.5;
        for (const [i, side] of [
          [0, -1],
          [1, 1],
        ] as const) {
          const cu = l.start + c;
          red[i].set(cu - side * 4.2 + (right ? 0.32 : -0.32) - s, land.ground(cu, side * 4.6) + 2.2, side * 4.42, 22);
        }
        const d = Math.hypot(du, 6);
        bellLevel = Math.max(bellLevel, Math.min(1, 40 / d));
        bellPan = Math.max(-1, Math.min(1, du / 40));
        closing = (vNow * du) / d;
      }
      band.setBells(bellLevel > 0.08 ? bellLevel : 0, bellPan, closing);

      // The pantograph flashes blue on the wire now and then.
      consist.flash(Math.random() < 0.004 * speed ? 1 : 0);

      // The station's sign, if there's one near enough to click.
      let sign: THREE.Object3D | null = null;
      let near = 40;
      for (const m of land.signs()) {
        const d = m.getWorldPosition(signAt).distanceTo(camera.position);
        if (d < near) ((near = d), (sign = m));
      }
      if (sign) {
        sign.getWorldPosition(signHit.position);
        signHit.visible = true;
      } else signHit.visible = false;

      // Arriving at a close-up: its card.
      const here = wiring && !wiring.moving() ? shot : '';
      if (here !== arrived) {
        arrived = here;
        if (here === 'lever') leverCard();
        if (here === 'ticket') ticketCard();
        if (here === 'route') {
          const legs = journey.legs.slice(0, journey.legs.indexOf(journey.current()) + 1);
          const been = legs.map((l) => NAMES[l.land].toLowerCase());
          wiring?.card('On the wall', 'The line tonight', [
            `The little light is us, in ${NAMES[landNow].toLowerCase()}. ${been.length > 1 ? `Behind us: ${been.slice(0, -1).join(', then ')}.` : ''}`,
            `At the end of this stretch the line forks for ${branchName(0)} or ${branchName(1)}; it's set for ${branchName(j.set)}${j.by === 'you' ? ', the way you threw it' : ''}. A star marks every junction you chose.`,
          ]);
        }
        if (here === 'brake' && journey.phase !== 'braking')
          wiring?.card('On the wall', 'The emergency brake', ['Pull it and the train stops: a long screeching stop, sparks from the wheels, then quiet.', "Nobody minds. After a minute we'll be on our way."], [{ label: 'Pull it', run: () => brake() }]);
      }
      // After a while, the captions give way to the usual hints.
      if (quietAt && performance.now() > quietAt) {
        quietAt = 0;
        const h = hintsEl();
        if (h && h.classList.contains('caption') && ready) {
          h.classList.remove('caption');
          h.textContent = hints;
        }
      }
    },

    outside(camera) {
      const p = camera.position;
      const w = where(p);
      if (w === 'out') return 1;
      const k = w === 'room' ? THREE.MathUtils.clamp((-p.z - 0.4) / 1.0, 0, 1) : THREE.MathUtils.clamp((p.z - 0.6) / 0.9, 0, 1) * 0.6;
      return Math.max(k * (0.6 + 0.4 * windowK), windowK * 0.5);
    },

    debug: {
      /**
       * For the tests: every vertex outside and in the car has a place and a normal that are real
       * numbers, and every normal has a length (a zero one turns to not-a-number in the shaders and flickers).
       */
      badGeometry: () => {
        const out: string[] = [];
        const check = (root: THREE.Object3D) =>
          root.traverse((o) => {
            const m = o as THREE.Mesh;
            if (!m.isMesh || !m.geometry) return;
            const pos = m.geometry.attributes.position;
            const nrm = m.geometry.attributes.normal;
            if (!pos) return;
            for (let i = 0; i < pos.count; i++)
              if (!Number.isFinite(pos.getX(i)) || !Number.isFinite(pos.getY(i)) || !Number.isFinite(pos.getZ(i))) {
                out.push(`${m.name || m.parent?.name || 'mesh'}: position ${i}`);
                return;
              }
            const needs = (m.material as THREE.Material & { isShaderMaterial?: boolean }).isShaderMaterial ? !!nrm : !(m.material as THREE.Material & { isMeshBasicMaterial?: boolean }).isMeshBasicMaterial;
            if (!needs) return;
            if (!nrm) {
              out.push(`${m.name || m.parent?.name || 'mesh'}: no normals`);
              return;
            }
            for (let i = 0; i < nrm.count; i++) {
              const l = Math.hypot(nrm.getX(i), nrm.getY(i), nrm.getZ(i));
              if (!(l > 0.5 && l < 1.5)) {
                out.push(`${m.name || m.parent?.name || 'mesh'}: normal ${i} is ${l}`);
                return;
              }
            }
          });
        check(land.group);
        check(car.group);
        check(consist.group);
        check(controls.group);
        return out;
      },
      journey,
      land,
      car,
      controls,
      ticket,
      band,
      routeMap,
      consist,
      sparks,
      shots: SHOTS,
      /** Runs the line's clock faster (the tests use this to get to junctions and stations). */
      fast: (k: number) => (fast = k),
      /** Puts the train somewhere: `at` meters into a stretch of `land`. */
      jump: (l: Land, at: number, speed?: number) => {
        journey.reset(l, at, speed);
        landNow = l;
        ticket.stamp(l);
        land.invalidate(-Infinity, true);
      },
      pull: () => pull(),
      brake: () => brake(),
      window: () => (toggleWindow(), windowAim),
      windowOpen: () => windowK,
      punch: () => punch(),
      horn: () => horn(),
      state: () => ({ land: journey.current().land, phase: journey.phase, v: journey.v, s: journey.s, junction: { ...journey.junction() }, tunnel: tunnelK, window: windowAim, shot: wiring?.current() ?? '' }),
      /** Brake sparks flying right now. */
      sparksLive: () => sparks.live(),
      /** Draw calls in the last whole frame (switches on counting the first time it's asked). */
      calls: () => {
        if (lastRenderer) lastRenderer.info.autoReset = false;
        return lastCalls;
      },
      solid: (p: THREE.Vector3) => solid(p),
      roomy: (p: THREE.Vector3) => roomy(p),
      lineItems: () => lineItems,
      /**
       * For the tests: every walk between two places (each shirt's close-up among
       * them, and the way in) checked for walls and furniture, and every place
       * checked for room to stand.
       */
      blocked: () => {
        const out: string[] = [];
        const at: Record<string, THREE.Vector3> = {};
        for (const wl of walls) for (const n of [wl.id, ...(wl.members ?? [])]) if (n !== 'projects' && SHOTS[n]) at[n] = SHOTS[n].pos;
        lineItems.forEach((it, i) => (at[`projects ${i + 1}`] = projectShot(it.focus.clone()).pos));
        for (const [a, p] of Object.entries(at)) if (!roomy(p)) out.push(`${a} has no room`);
        for (const [a, p] of Object.entries(at))
          for (const [b, q] of Object.entries(at)) if (a !== b && !clear(p, q, route(p, q))) out.push(`${a} -> ${b}`);
        if (!clear(kit.shots.vista.pos, SHOTS.desk.pos, kit.intro.via)) out.push('the way in');
        const way = new THREE.CatmullRomCurve3([kit.shots.vista.pos, ...kit.intro.via, SHOTS.desk.pos], false, 'centripetal');
        for (let i = 1; i < 10; i++) {
          const p = way.getPoint(i / 10);
          for (const [b, q] of Object.entries(at)) if (!clear(p, q, route(p, q))) out.push(`the way in (${i}/10) -> ${b}`);
        }
        return out;
      },
    },
  };
  return kit;
};

export { TABLE, WINDOW };
