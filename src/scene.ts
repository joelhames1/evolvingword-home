// The scene: the studio every world shares (the desk, the props, the cards,
// the keys) plus the chosen world's kit, which brings the room shell, what's
// outside the window, the word board and the way in. Loaded only when someone
// steps inside; the simple page never fetches any of this.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { Sound } from './audio';
import { BOOKS, loadBook } from './books';
import { Rig, SHOTS, type ShotName } from './camera';
import { ABOUT, DIPLOMAS, MEDALS, SHOES, VISITED, WATCH, WORK } from './content';
import { buildDesk, DESK_Y } from './desk';
import { Interactions } from './interact';
import { ROOM } from './layout';
import { buildLine } from './line';
import { PROJECTS } from './projects';
import { buildHonors } from './props/honors';
import { buildMap } from './props/map';
import { buildPad } from './props/pad';
import { buildRolodex } from './props/rolodex';
import { buildShelf } from './props/shelf';
import { buildShoes } from './props/shoes';
import { buildTreats } from './props/treats';
import { buildWatch } from './props/watch';
import { switchTo } from './plain';
import { buildReader } from './reader';
import { buildTerminal, type Page } from './terminal';
import { createWorld } from './world';
import type { WorldId } from './worlds';
import type { KitModule, Studio, Wall } from './worlds/kit';

/** Each world's 3D code, loaded only when it's picked. */
const KITS: Record<WorldId, () => Promise<KitModule>> = {
  alps: () => import('./worlds/alps/kit'),
  city: () => import('./worlds/city/kit'),
  tower: () => import('./worlds/tower/kit'),
  monastery: () => import('./worlds/monastery/kit'),
  cell: () => import('./worlds/cell/kit'),
  heavens: () => import('./worlds/heavens/kit'),
  library: () => import('./worlds/library/kit'),
  greenhouse: () => import('./worlds/greenhouse/kit'),
};

const CONTACT = 'studio@evolvingword.com';
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

const el = (tag: string, text?: string, cls?: string) => {
  const e = document.createElement(tag);
  if (text !== undefined) e.textContent = text;
  if (cls) e.className = cls;
  return e;
};

function fillAbout() {
  const body = $('about-body');
  body.replaceChildren(...ABOUT.lines.map((l) => el('p', l)));
}

/**
 * Builds the studio around the chosen world and steps inside once it's ready,
 * with sound if the visitor asked for it on the way in.
 */
export async function startScene(worldId: WorldId, opts: { sound: boolean; onEnter?: () => void }) {
  fillAbout();
  const kitModule = KITS[worldId]();

  const bootLog = $('boot');
  const bar = $('bar');
  const log = (text: string, pct: number) => {
    bootLog.append(el('li', text));
    bar.style.width = `${pct}%`;
  };

  log('WARMING UP THE TUBES', 10);
  await Promise.all(
    [
      '400 64px "Archivo Black"',
      '400 40px "VT323"',
      '400 40px "Caveat"',
      '600 40px "Caveat"',
      '400 40px "Space Mono"',
      '700 40px "Space Mono"',
      '400 40px "EB Garamond"',
      'italic 400 40px "EB Garamond"',
      '500 40px "EB Garamond"',
      '600 40px "EB Garamond"',
      '400 40px "UnifrakturMaguntia"',
    ].map((f) => document.fonts.load(f)),
  );
  log('FILLING THE PEN', 25);

  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const quality = navigator.hardwareConcurrency >= 8 && window.devicePixelRatio <= 2 ? 'high' : 'low';
  const world = createWorld($('scene'), quality);
  const { scene, camera, renderer } = world;
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.06;

  const sound = new Sound(worldId);
  const rig = new Rig(camera, reduced);

  // --- the world: its room, what's outside, and where the word evolves -----------------
  const kit = (await kitModule).buildKit({ quality, renderer, scene, log });
  const board = kit.board;
  Object.assign(SHOTS, kit.shots);
  if (kit.band) sound.useBand(kit.band);

  // --- the room and everything in it -------------------------------------------------
  const terminal = buildTerminal({
    open: (url) => {
      sound.click();
      if (url.startsWith('mailto:')) location.href = url;
      else window.open(url, '_blank', 'noopener');
    },
    go: (page) => {
      if (page === 'menu') terminal.show('menu');
      else if (page === 'about' || page === 'projects' || page === 'library') goTo(page);
      else if (rig.current === 'signal' && !rig.moving) terminal.show(page);
      else goTo('signal', page);
    },
    evolve: (text) => {
      board.evolve(text);
      watching = text;
      goTo('board');
      say(`BREEDING "${text}" FROM NOISE · ESC TO COME BACK`);
    },
    contact: CONTACT,
    tagline: kit.tagline,
  });
  terminal.show('menu');

  const desk = buildDesk(terminal.texture);
  const line = buildLine();
  const watch = buildWatch();
  watch.group.position.set(0.33, DESK_Y, -1.37);
  watch.group.rotation.y = -0.25;
  const pad = buildPad();
  pad.group.position.set(-0.64, DESK_Y, -1.42);
  pad.group.rotation.y = 0.14;
  const treats = buildTreats();
  treats.cup.position.set(0.62, DESK_Y, -1.42);
  treats.bowl.position.set(0.88, DESK_Y, -1.58);
  const rolodex = buildRolodex();
  rolodex.group.position.set(1.3, DESK_Y, -1.66);
  rolodex.group.rotation.y = -0.35;
  const honors = buildHonors();
  honors.group.position.set(ROOM.x1, 0, 0);
  const map = buildMap();
  map.group.position.set(ROOM.x0 + 0.02, 1.62, 0.15);
  map.group.rotation.y = Math.PI / 2;
  const shelf = buildShelf();
  shelf.group.position.set(0.35, 0, ROOM.z1);
  shelf.group.rotation.y = Math.PI;
  const shoes = buildShoes();
  // Kicked off under the map, toes out into the room.
  shoes.group.position.set(-1.95, 0, -0.1);
  shoes.group.rotation.y = -0.35;
  log('POURING THE CAPPUCCINO', 80);
  scene.add(...kit.objects, desk.group, line.group, watch.group, pad.group, treats.group, rolodex.group, honors.group, map.group, shelf.group, shoes.group);
  scene.updateMatrixWorld(true);

  // --- close-ups, worked out from where things ended up ----------------------------------
  const at = (o: THREE.Object3D, x = 0, y = 0, z = 0) => o.localToWorld(v(x, y, z));
  const watchAt = at(watch.body);
  const padAt = at(pad.group);
  const rolodexAt = at(rolodex.group);
  const shoesAt = at(shoes.group);
  // Shots with a card on the left slide their picture right to make room.
  const CARD = 0.13;
  SHOTS.watch = { pos: watchAt.clone().add(v(0, 0.125, 0.085)), target: watchAt.clone().add(v(0, 0.004, -0.004)), fov: 27, near: 0.01, lean: 0.006, shift: CARD };
  SHOTS.pad = { pos: padAt.clone().add(v(0.02, 0.34, 0.2)), target: padAt.clone().add(v(0, 0, -0.01)), fov: 36, near: 0.02, lean: 0.015 };
  SHOTS.treats = { pos: v(0.74, 1.16, -0.92), target: v(0.74, 0.8, -1.5), fov: 32, near: 0.02, lean: 0.02, shift: CARD };
  SHOTS.work = { pos: rolodexAt.clone().add(v(-0.05, 0.16, 0.25)), target: rolodexAt.clone().add(v(0, 0.05, 0)), fov: 34, near: 0.02, lean: 0.01, shift: CARD };
  SHOTS.map = { pos: v(-0.55, 1.63, 0.15), target: v(ROOM.x0, 1.6, 0.15), fov: 40, lean: 0.03, shift: CARD };
  // About is read at the desk: the picture slides left to make room for the notepad.
  SHOTS.about = { pos: v(-0.15, 1.42, 1.15), target: v(-0.15, 1.3, -1.9), fov: 48, lean: 0.06, shift: -CARD };
  // The walls you turn between: the desk faces the window, then round to the right.
  SHOTS.honors = { pos: v(0.72, 1.6, 0.18), target: v(ROOM.x1, 1.58, 0.18), fov: 44, lean: 0.05 };
  SHOTS.places = { pos: v(0.45, 1.5, 0.55), target: v(ROOM.x0, 1.0, 0.55), fov: 56, lean: 0.05 };
  SHOTS.diplomas = { pos: v(1.12, 1.64, -0.47), target: v(ROOM.x1, 1.64, -0.47), fov: 40, lean: 0.02, shift: CARD };
  SHOTS.medals = { pos: v(1.7, 1.72, 0.82), target: v(ROOM.x1, 1.72, 0.82), fov: 38, lean: 0.02, shift: CARD };
  SHOTS.library = { pos: v(0.35, 1.45, 1.05), target: v(0.35, 1.22, ROOM.z1), fov: 54, lean: 0.04, shift: 0.1 };
  SHOTS.shoes = { pos: shoesAt.clone().add(v(0.42, 0.55, 0.5)), target: shoesAt.clone().add(v(0, 0.05, 0)), fov: 38, lean: 0.02, shift: CARD };

  // --- a world that presents the studio its own way -------------------------------------
  // It may move the pieces; each close-up moves with the piece it looks at.
  const studio: Studio = { desk, line, watch, pad, treats, rolodex, honors, map, shelf, shoes };
  const lineTurn = new THREE.Quaternion();
  if (kit.arrange) {
    const anchors = { desk: desk.group, watch: watch.group, pad: pad.group, treats: treats.group, rolodex: rolodex.group, honors: honors.group, map: map.group, shelf: shelf.group, shoes: shoes.group, line: line.group };
    const before = new Map(Object.entries(anchors).map(([k, o]) => [k, o.matrixWorld.clone()]));
    kit.arrange(studio);
    scene.updateMatrixWorld(true);
    const moved = (k: keyof typeof anchors) => anchors[k].matrixWorld.clone().multiply(before.get(k)!.clone().invert());
    const follows: Record<string, keyof typeof anchors> = {
      desk: 'desk',
      signal: 'desk',
      about: 'desk',
      watch: 'watch',
      pad: 'pad',
      treats: 'treats',
      work: 'rolodex',
      honors: 'honors',
      diplomas: 'honors',
      medals: 'honors',
      map: 'map',
      places: 'map',
      library: 'shelf',
      shoes: 'shoes',
    };
    for (const [shot, k] of Object.entries(follows)) {
      const m = moved(k);
      SHOTS[shot].pos.applyMatrix4(m);
      SHOTS[shot].target.applyMatrix4(m);
    }
    moved('line').decompose(v(0, 0, 0), lineTurn, v(1, 1, 1));
    // The line keeps world positions for its shirts; bring them along too.
    const lineMoved = moved('line');
    for (const item of line.items) item.focus.applyMatrix4(lineMoved);
    line.center.applyMatrix4(lineMoved);
  }
  Object.assign(SHOTS, kit.closeups?.(studio) ?? {});

  // --- panels and captions ---------------------------------------------------------------
  const panels = { about: $('about'), project: $('project'), card: $('card') };
  const navButtons = [...document.querySelectorAll<HTMLButtonElement>('nav button')];
  const navFor: Record<string, string> = { desk: 'desk', projects: 'projects', about: 'about', library: 'library', signal: 'signal' };
  let projectIndex = 0;

  type Body = string | { list: { head: string; text: string }[] } | { note: string };
  const showCard = (kicker: string, title: string, body: Body[], actions: { label: string; quiet?: boolean; href?: string; run?: () => void }[] = []) => {
    $('card-kicker').textContent = kicker;
    $('card-title').textContent = title;
    $('card-body').replaceChildren(
      ...body.map((b) => {
        if (typeof b === 'string') return el('p', b);
        if ('note' in b) return el('p', b.note, 'note');
        const ul = el('ul');
        for (const item of b.list) {
          const li = el('li');
          li.append(el('strong', item.head), document.createTextNode(item.text));
          ul.append(li);
        }
        return ul;
      }),
    );
    $('card-actions').replaceChildren(
      ...actions.map((a) => {
        if (a.href) {
          const link = el('a', a.label) as HTMLAnchorElement;
          link.href = a.href;
          link.target = '_blank';
          link.rel = 'noopener';
          return link;
        }
        const b = el('button', a.label, a.quiet ? 'quiet' : undefined) as HTMLButtonElement;
        b.addEventListener('click', () => a.run?.());
        return b;
      }),
    );
    panels.card.hidden = false;
  };

  const showProject = (i: number) => {
    projectIndex = (i + PROJECTS.length) % PROJECTS.length;
    const p = PROJECTS[projectIndex];
    $('project-no').textContent = `JOB ${String(projectIndex + 1).padStart(3, '0')} · ${p.year}`;
    $('project-title').textContent = p.title;
    $('project-tagline').textContent = p.tagline;
    $('project-blurb').textContent = p.blurb;
    $('project-meta').textContent = p.status;
    const open = $<HTMLAnchorElement>('project-open');
    open.textContent = p.url ? `Open ${p.title} →` : 'On the press';
    open.href = p.url ?? '#';
    open.setAttribute('aria-disabled', String(!p.url));
    const focus = line.items[projectIndex].focus;
    // Stand back from the wall, a little to one side, with room for the ticket.
    SHOTS.projects.target.copy(focus).add(v(0, 0.05, 0));
    SHOTS.projects.pos.copy(focus).add(v(1.35, 0.05, -0.3).applyQuaternion(lineTurn));
    SHOTS.projects.shift = CARD;
    const own = kit.projectShot?.(focus.clone(), projectIndex);
    if (own) Object.assign(SHOTS.projects, { ...own, pos: own.pos.clone(), target: own.target.clone() });
  };

  // On along the line to the next shirt; if the camera is still on its way in
  // from another room, the rest of the way round (a world may have walls between).
  const toShirt = () => {
    const via = kit.route?.(camera.position.clone(), SHOTS.projects.pos);
    void rig.go('projects', via ? { via } : { duration: 0.9 });
  };

  // The frame and the subtitles.
  const FRAME = 2.1;
  const barFor = () => Math.round(Math.min(window.innerHeight * 0.13, Math.max(48, (window.innerHeight - window.innerWidth / FRAME) / 2)));
  let lid = 0;
  let lidAim = 0;
  let lastFrame = performance.now();
  // Where the card's right edge falls (see .card in style.css), so close-ups clear it.
  const cardInset = () => Math.max(window.innerWidth * 0.04, 72) + Math.min(400, window.innerWidth * 0.36) + 24;
  // And the notepad's, on the right (see .notepad).
  const padInset = () => Math.max(window.innerWidth * 0.04, 72) + Math.min(460, window.innerWidth * 0.4) + 24;
  rig.inset = cardInset();
  rig.insetRight = padInset();
  window.addEventListener('resize', () => {
    if (lidAim > 0) lidAim = barFor();
    rig.inset = cardInset();
    rig.insetRight = padInset();
  });
  const rootStyle = document.documentElement.style;
  const hints = $('hints');
  const HINTS = hints.textContent ?? '';
  let typing = 0;
  let watching = '';
  const STATUS = 'NODE 1 OF 1 · 28800 BPS · ALWAYS OPEN';
  const say = (text: string, caption = true) => {
    window.clearInterval(typing);
    hints.classList.toggle('caption', caption);
    if (!caption || reduced) {
      hints.textContent = text;
      return;
    }
    let i = 0;
    hints.textContent = '';
    typing = window.setInterval(() => {
      hints.textContent = text.slice(0, ++i);
      if (i >= text.length) window.clearInterval(typing);
    }, 34);
  };

  // What each place shows when the camera arrives.
  let chocolates = (() => {
    try {
      return Number(localStorage.getItem('ew.chocolate') ?? 0) || 0;
    } catch {
      return 0;
    }
  })();
  const chronoText = () => {
    const e = watch.elapsed();
    const m = Math.floor(e / 60);
    const s = e - m * 60;
    return `Chronograph ${String(m).padStart(2, '0')}:${s.toFixed(1).padStart(4, '0')}`;
  };
  const treatsCard = () =>
    showCard('On the desk', 'Coffee and chocolate', [
      `Felchlin chocolate: ${treats.left()} left in the bowl.${treats.left() === 0 ? ' Click the bowl to refill it.' : ' Click one to eat it.'}`,
      `Cappuccino: ${treats.sipsLeft() === 0 ? 'all gone. Click the cup for another.' : `${treats.sipsLeft()} sip${treats.sipsLeft() === 1 ? '' : 's'} left.`}`,
      { note: chocolates ? `Chocolates eaten here, all time: ${chocolates}.` : 'No judgment.' },
    ]);
  // The map's card, with a way to take back a mistake: undo the last stroke, lay
  // foil back where it shouldn't have come off, or start over from the list.
  const mapCard = (): void =>
    showCard(
      'The map',
      'Places I have been',
      [
        `${VISITED.length} countries scratched off so far.`,
        { note: map.covering() ? 'Drag across a country to lay the foil back over it.' : 'Drag across the foil to scratch. It remembers, on this computer.' },
      ],
      [
        { label: map.covering() ? 'Back to scratching' : 'Lay foil back', run: () => (map.setCovering(!map.covering()), sound.click(), mapCard()) },
        { label: 'Undo', quiet: true, run: () => (map.undo() && sound.scratch(), mapCard()) },
        { label: 'Start over', quiet: true, run: () => (map.reset(), sound.click(), mapCard()) },
      ],
    );
  const onArrive: Record<string, () => void> = {
    about: () => (panels.about.hidden = false),
    projects: () => (panels.project.hidden = false),
    signal: () => sound.modem(),
    watch: () => showCard('On the desk', 'The watch', [WATCH.note, { note: chronoText() }], [
      { label: 'Start · Stop', run: () => pressWatch('start') },
      { label: 'Reset', quiet: true, run: () => pressWatch('reset') },
    ]),
    pad: () => {
      if (!pad.writing()) {
        const title = pad.next();
        say(`"${title.toUpperCase()}" · CLICK THE PAD FOR ANOTHER`);
        sound.page();
      }
    },
    treats: treatsCard,
    work: () => showCard('Work', 'The Rolodex', [{ list: WORK.map((w) => ({ head: `${w.role}, ${w.company}`, text: w.years })) }, { note: 'Click the cards to flick through.' }]),
    map: () => mapCard(),
    diplomas: () => showCard('On the wall', 'Diplomas', [{ list: DIPLOMAS.map((d) => ({ head: `${d.degree} in ${d.field}`, text: `${d.school}, ${d.year}` })) }]),
    medals: () => showCard('On the wall', 'Medals', [{ list: MEDALS.map((m) => ({ head: m.distance, text: `${m.race} · ${m.year} · ${m.time}` })) }, { note: 'Click one for the story, and to set it swinging.' }]),
    library: () =>
      showCard('The library', 'Take one down', [{ note: 'Every book here is in the public domain. Click a spine, or pick one:' }], BOOKS.map((b) => ({ label: b.short ?? (b.title.length > 18 ? b.author.split(' ').pop()! : b.title), run: () => openBook(b.id) }))),
    shoes: () => {
      shoes.hop();
      window.setTimeout(() => sound.thud(), 180);
      showCard('Under the map', SHOES.label, SHOES.lines);
    },
  };

  // --- looking around: four walls, and which wall each close-up belongs to -------------
  // The room's four walls, unless the world has its own places to turn between.
  const WALLS: Wall[] = kit.walls ?? [
    { id: 'desk', name: 'The desk' },
    { id: 'honors', name: 'Medals & diplomas', members: ['diplomas', 'medals'] },
    { id: 'library', name: 'The library' },
    { id: 'places', name: 'Map, shirts & shoes', members: ['map', 'shoes', 'projects'] },
  ];
  const WALL_NAMES: Record<string, string> = Object.fromEntries(WALLS.map((w) => [w.id, w.name]));
  const PARENT: Record<string, string> = {};
  for (const w of WALLS) {
    PARENT[w.id] = w.id;
    for (const m of w.members ?? []) PARENT[m] = w.id;
  }
  const wallOf = (shot: string): string => PARENT[shot] ?? 'desk';
  const turnLeft = $<HTMLButtonElement>('turn-left');
  const turnRight = $<HTMLButtonElement>('turn-right');
  const neighbors = (shot: string) => {
    const n = WALLS.length;
    const i = Math.max(0, WALLS.findIndex((w) => w.id === wallOf(shot)));
    return { left: WALLS[(i + n - 1) % n].id, right: WALLS[(i + 1) % n].id };
  };
  const labelTurns = (shot: string) => {
    const n = neighbors(shot);
    turnLeft.querySelector('.label')!.textContent = WALL_NAMES[n.left];
    turnRight.querySelector('.label')!.textContent = WALL_NAMES[n.right];
    turnLeft.setAttribute('aria-label', `Turn left, to ${WALL_NAMES[n.left].toLowerCase()}`);
    turnRight.setAttribute('aria-label', `Turn right, to ${WALL_NAMES[n.right].toLowerCase()}`);
  };
  const turn = (dir: 1 | -1) => {
    const n = neighbors(rig.current);
    goTo(dir > 0 ? n.right : n.left);
  };
  turnLeft.addEventListener('click', () => turn(-1));
  turnRight.addEventListener('click', () => turn(1));
  labelTurns('desk');

  function goTo(name: ShotName, page: Page = 'signal') {
    labelTurns(name);
    sound.click();
    panels.about.hidden = true;
    panels.project.hidden = true;
    panels.card.hidden = true;
    if (reader.isOpen()) reader.close();
    if (name !== 'signal' && terminal.page() !== 'menu') terminal.show('menu');
    if (name !== 'board' && watching) {
      watching = '';
      say(HINTS, false);
    }
    if (name === 'projects') showProject(projectIndex);
    if (name !== 'map') map.setCovering(false);
    navButtons.forEach((b) => b.setAttribute('aria-current', String(b.dataset.go === (navFor[name] ?? ''))));
    return rig.go(name, { via: kit.route?.(camera.position.clone(), SHOTS[name].pos) }).then(() => {
      if (rig.current !== name) return;
      if (name === 'signal') terminal.show(page);
      onArrive[name]?.();
    });
  }
  navButtons.forEach((b) => b.addEventListener('click', () => goTo(b.dataset.go!)));
  $('project-prev').addEventListener('click', () => {
    showProject(projectIndex - 1);
    toShirt();
  });
  $('project-next').addEventListener('click', () => {
    showProject(projectIndex + 1);
    toShirt();
  });

  // The reader.
  const reader = buildReader($('reader'), { turn: () => sound.page(), closed: () => shelf.pull(null) });
  const openBook = (id: string) => {
    const book = BOOKS.find((b) => b.id === id);
    if (!book) return;
    shelf.pull(id);
    sound.page();
    const pause = new Promise((r) => window.setTimeout(r, reduced ? 0 : 350));
    void Promise.all([loadBook(book), pause])
      .then(() => reader.open(book))
      .catch(() => {
        shelf.pull(null);
        say(`${book.title.toUpperCase()} WON'T OPEN RIGHT NOW · TRY AGAIN IN A MOMENT`);
      });
  };

  const pressWatch = (button: 'start' | 'reset') => {
    sound.pusher();
    watch.press(button);
  };

  // --- things you can touch ----------------------------------------------------------
  const tooltip = $('tooltip');
  const touch = new Interactions(camera, renderer.domElement, tooltip);
  const here = (...names: string[]) => () => names.includes(rig.current) && !rig.moving;
  const away = (...names: string[]) => () => !names.includes(rig.current);

  touch.add({
    object: desk.crtScreen,
    label: () => (rig.current === 'signal' ? 'Pick a line' : 'The terminal'),
    noGlow: true,
    onClick: (hit) => {
      if (rig.current === 'signal' && hit.uv) terminal.clickAt(hit.uv.x, hit.uv.y);
      else goTo('signal');
    },
  });
  touch.add({ object: desk.lamp, label: () => (desk.lampOn() ? 'Lamp off' : 'Lamp on'), onClick: () => toggleLamp() });
  touch.add({ object: desk.deck, label: () => (sound.started && sound.musicOn && !sound.muted ? 'Stop the tape' : 'Play the tape'), onClick: () => toggleTape() });
  touch.add({ object: shelf.boombox, label: () => (sound.started && sound.musicOn && !sound.muted ? 'Stop the tape' : 'Play the tape'), onClick: () => toggleTape() });
  touch.add({ object: board.face, label: 'Evolve a word', onClick: () => goTo('signal', 'evolve') });
  // The watch: look closer, then work the pushers.
  touch.add({ object: watch.body, label: 'The watch', when: away('watch'), onClick: () => goTo('watch') });
  touch.add({ object: watch.startStop, label: 'Start · stop', when: here('watch'), onClick: () => pressWatch('start') });
  touch.add({ object: watch.reset, label: 'Reset', when: here('watch'), onClick: () => pressWatch('reset') });
  // The pad: a poem, then another.
  touch.add({
    object: pad.paper,
    label: () => (rig.current === 'pad' ? (pad.writing() ? 'Writing…' : 'Another poem') : 'The pad'),
    onClick: () => {
      if (rig.current !== 'pad') return goTo('pad');
      if (pad.writing()) return;
      sound.page();
      const title = pad.next();
      say(`"${title.toUpperCase()}" · CLICK THE PAD FOR ANOTHER`);
    },
  });
  touch.add({ object: pad.pen, label: 'The fountain pen', when: away('pad'), onClick: () => goTo('pad') });
  // Treats.
  for (const d of treats.discs)
    touch.add({
      object: d,
      label: () => (rig.current === 'treats' ? 'Eat one' : 'Chocolate'),
      onClick: () => {
        if (rig.current !== 'treats') return goTo('treats');
        treats.eat(d);
        sound.crunch();
        chocolates++;
        try {
          localStorage.setItem('ew.chocolate', String(chocolates));
        } catch {
          // Fine: it just won't remember.
        }
        treatsCard();
      },
    });
  touch.add({
    object: treats.bowl,
    label: () => (treats.left() === 0 ? 'Refill the bowl' : 'Chocolate'),
    onClick: () => {
      if (rig.current !== 'treats') return goTo('treats');
      if (treats.left() === 0) {
        treats.refill();
        sound.click();
        treatsCard();
      }
    },
  });
  touch.add({
    object: treats.cup,
    label: () => (rig.current !== 'treats' ? 'Cappuccino' : treats.sipsLeft() === 0 ? 'Another one' : 'Take a sip'),
    onClick: () => {
      if (rig.current !== 'treats') return goTo('treats');
      const empty = treats.sipsLeft() === 0;
      treats.sip();
      if (empty) sound.steam();
      else sound.sip();
      treatsCard();
    },
  });
  // Work history.
  touch.add({
    object: rolodex.body,
    label: () => (rig.current === 'work' ? 'Next card' : 'Work history'),
    onClick: () => {
      if (rig.current !== 'work') return goTo('work');
      rolodex.flip(1);
      sound.flick();
    },
  });
  // The map.
  touch.add({
    object: map.surface,
    label: () => mapLabel,
    noGlow: true,
    onClick: () => rig.current !== 'map' && goTo('map'),
    onDrag: (hit) => {
      if (rig.current !== 'map' || rig.moving || !hit.uv) return;
      map.scratch(hit.uv.x, hit.uv.y);
      sound.scratch();
    },
  });
  let mapLabel = 'Scratch map';
  // The wall of honors.
  honors.diplomas.forEach((d) => touch.add({ object: d, label: 'Diplomas', onClick: () => rig.current !== 'diplomas' && goTo('diplomas') }));
  honors.medals.forEach((m, i) =>
    touch.add({
      object: m,
      label: MEDALS[i].distance,
      onClick: () => {
        honors.swing(i);
        sound.jingle();
        if (rig.current !== 'medals') goTo('medals');
        else showCard('On the wall', MEDALS[i].distance, [MEDALS[i].race, { list: [{ head: 'Year', text: MEDALS[i].year }, { head: 'Time', text: MEDALS[i].time }] }, { note: MEDALS[i].note }]);
      },
    }),
  );
  // Books.
  shelf.books.forEach(({ book, mesh }) =>
    touch.add({
      object: mesh,
      label: `${book.title} · ${book.author}`,
      onClick: () => {
        if (rig.current !== 'library') goTo('library');
        else openBook(book.id);
      },
    }),
  );
  touch.add({ object: shoes.group, label: 'Running shoes', onClick: () => goTo('shoes') });
  line.items.forEach((item, i) =>
    touch.add({
      object: item.object,
      label: item.project.title,
      onClick: () => {
        showProject(i);
        if (rig.current === 'projects') toShirt();
        else goTo('projects');
      },
    }),
  );

  const toggleLamp = () => {
    desk.setLamp(!desk.lampOn());
    sound.click();
  };
  const soundBtn = $('sound-btn');
  const setSound = (on: boolean) => {
    if (on && !sound.started) sound.start();
    else sound.setMuted(!on);
    soundBtn.textContent = on ? 'Sound on' : 'Sound off';
    soundBtn.setAttribute('aria-pressed', String(on));
  };
  const toggleTape = () => {
    if (!sound.started || sound.muted) {
      setSound(true);
      sound.setMusic(true);
    } else sound.setMusic(!sound.musicOn);
  };
  soundBtn.addEventListener('click', () => setSound(!sound.started || sound.muted));
  const lofiBtn = $('lofi-btn');
  let lofi = false;
  lofiBtn.addEventListener('click', () => {
    lofi = !lofi;
    world.setLofi(lofi);
    lofiBtn.setAttribute('aria-pressed', String(lofi));
  });
  $('credits-btn').addEventListener('click', () => ($('credits').hidden = false));
  $('simple-btn').addEventListener('click', () => switchTo('simple'));
  // Back to the globes: a fresh page is the cleanest way to put one world down for
  // another. The chooser then pulls back out of this world's globe (see returnTo).
  $('worlds-btn').addEventListener('click', () => {
    try {
      sessionStorage.setItem('ew.from', worldId);
    } catch {
      // No session storage: the globes just appear, without the pull back.
    }
    location.href = '/';
  });

  // If frames come slowly once we're inside, offer the simple page, once.
  const watchSpeed = () => {
    try {
      if (localStorage.getItem('ew.slow') === 'stay') return;
    } catch {
      // No memory of an earlier answer; ask anyway.
    }
    const gaps: number[] = [];
    const start = performance.now();
    let last = start;
    const sample = (now: number) => {
      gaps.push(now - last);
      last = now;
      if (gaps.length < 150 && now - start < 8000) return void requestAnimationFrame(sample);
      gaps.sort((a, b) => a - b);
      // Slower than about 22 frames a second, most of the time.
      if (gaps[Math.floor(gaps.length / 2)] > 45) $('slow').hidden = false;
    };
    requestAnimationFrame(sample);
  };
  $('slow-simple').addEventListener('click', () => switchTo('simple'));
  $('slow-stay').addEventListener('click', () => {
    $('slow').hidden = true;
    try {
      localStorage.setItem('ew.slow', 'stay');
    } catch {
      // It'll ask again next time; no harm.
    }
  });
  $('credits-close').addEventListener('click', () => ($('credits').hidden = true));

  let entered = false;
  window.addEventListener('keydown', (e) => {
    // Cmd/Ctrl+Z at the map takes back the last stroke.
    if (entered && rig.current === 'map' && (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      if (map.undo()) sound.scratch();
      return;
    }
    if (!entered || e.metaKey || e.ctrlKey || e.altKey) return;
    if (reader.isOpen()) {
      if (e.key === 'Escape') reader.close();
      else if (e.key === 'ArrowRight' || e.key === ' ') reader.turn(1);
      else if (e.key === 'ArrowLeft') reader.turn(-1);
      e.preventDefault();
      return;
    }
    if (rig.current === 'signal' && terminal.press(e.key)) {
      e.preventDefault();
      return;
    }
    const k = e.key.toLowerCase();
    if (k === 'escape') {
      // Out of a close-up to the wall it's on; from a wall, back to the desk.
      $('credits').hidden = true;
      const wall = wallOf(rig.current);
      goTo(rig.current === wall ? 'desk' : wall);
    } else if (k === '1') goTo('projects');
    else if (k === '2') goTo('about');
    else if (k === '3') goTo('signal');
    else if (k === 'e' || k === '4') goTo('signal', 'evolve');
    else if (k === 'b' || k === '5') goTo('library');
    else if (k === 'm') goTo('map');
    else if (k === 'w') goTo('window');
    else if (k === 'l') toggleLamp();
    else if (k === 't') toggleTape();
    else if (k === 'arrowright' || k === 'arrowleft') {
      const dir = k === 'arrowright' ? 1 : -1;
      if (rig.current === 'projects') {
        showProject(projectIndex + dir);
        toShirt();
      } else if (rig.current === 'work') {
        rolodex.flip(dir);
        sound.flick();
      } else turn(dir);
    }
  });

  // The world's own clickable things.
  kit.wire?.({
    touch: (t) => touch.add(t),
    goTo: (shot) => void goTo(shot),
    card: (kicker, title, body, actions) => showCard(kicker, title, body, actions),
    say: (text) => say(text),
    sound,
    current: () => rig.current,
    moving: () => rig.moving,
  });

  // --- the loop ----------------------------------------------------------------------
  let announced = '';
  let lastTick = 0;
  let lastMapCheck = 0;
  world.onTick((t, dt) => {
    desk.tick(t, dt);
    kit.frame({ t, dt, camera, renderer, sound, ready: document.body.classList.contains('ready'), shot: rig.current });
    line.tick(t);
    terminal.tick(t);
    watch.tick();
    pad.tick(t, dt);
    treats.tick(t, dt);
    rolodex.tick(t, dt);
    honors.tick(t, dt);
    map.tick();
    shelf.tick(t, dt);
    shoes.tick(t, dt);
    sound.flaps(board.tick(t));
    sound.pen(pad.writing() && rig.current === 'pad');
    // The letterbox eases in real time, not the scene's capped frame time, so it
    // settles promptly even when frames are slow.
    const now = performance.now();
    const real = Math.min(2, (now - lastFrame) / 1000);
    lastFrame = now;
    if (lid !== lidAim) {
      lid = Math.abs(lidAim - lid) < 0.2 ? lidAim : lid + (lidAim - lid) * (1 - Math.exp(-real * 1.4));
      rootStyle.setProperty('--bar', `${lid.toFixed(1)}px`);
    }
    rig.visible = 1 - (2 * lid) / window.innerHeight;
    rig.update(t, dt);
    touch.update();
    // Close up on the watch: it ticks, and the card keeps time.
    if (rig.current === 'watch' && !rig.moving && t - lastTick > 0.25) {
      lastTick = t;
      sound.tick();
      const note = panels.card.querySelector('.note');
      if (note && !panels.card.hidden) note.textContent = chronoText();
    }
    // Close up on the map: name the country under the pointer.
    if (rig.current === 'map' && t - lastMapCheck > 0.1) {
      lastMapCheck = t;
      const ray = new THREE.Raycaster();
      ray.setFromCamera(pointer, camera);
      const hit = ray.intersectObject(map.surface)[0];
      mapLabel = hit?.uv ? (map.countryAt(hit.uv.x, hit.uv.y) ?? 'Ocean') : 'Scratch map';
    } else if (rig.current !== 'map') mapLabel = 'Scratch map';
    // Someone's phrase on the board: report back when it arrives.
    const evo = board.evolution();
    if (evo.custom) {
      terminal.setStatus(`GEN ${String(evo.generation).padStart(4, '0')} · FITNESS ${Math.round(evo.fitness * 100)}%`);
      if (evo.done && announced !== evo.target) {
        announced = evo.target;
        if (watching) say(`"${evo.target.trim()}" IN ${evo.generation} GENERATIONS · ESC TO COME BACK`);
      }
    } else if (announced) {
      announced = '';
      terminal.setStatus(STATUS);
    }
    // Louder weather with your nose to the glass.
    sound.setOutside(kit.outside(camera));
  });
  const pointer = new THREE.Vector2();
  renderer.domElement.addEventListener('pointermove', (e) => pointer.set((e.clientX / renderer.domElement.clientWidth) * 2 - 1, -(e.clientY / renderer.domElement.clientHeight) * 2 + 1));
  touch.enabled = false;
  world.start();
  log('READY', 100);

  // --- the way in ------------------------------------------------------------------
  rig.jump('vista');
  const gate = $('gate');
  const enter = (withSound: boolean) => {
    if (entered) return;
    entered = true;
    if (withSound) setSound(true);
    gate.classList.add('gone');
    opts.onEnter?.();
    lidAim = barFor();
    document.body.classList.add('inside');
    const gap = (kit.intro.duration * 1000) / (kit.intro.lines.length + 0.5);
    if (!reduced) kit.intro.lines.forEach((l, i) => window.setTimeout(() => !document.body.classList.contains('ready') && say(l), 600 + i * gap));
    void rig.go('desk', { via: kit.intro.via, duration: reduced ? 0 : kit.intro.duration }).then(() => {
      document.body.classList.add('ready');
      touch.enabled = true;
      say(HINTS, false);
      watchSpeed();
      // Name the walls either side for a moment, so it's clear you can turn.
      document.body.classList.add('show-turns');
      window.setTimeout(() => document.body.classList.remove('show-turns'), 6000);
    });
  };

  // For screenshots and tests: jump straight to a shot, no gate.
  const q = new URLSearchParams(location.search);
  const shot = q.get('shot');
  if (shot && Object.hasOwn(SHOTS, shot)) {
    entered = true;
    gate.style.transition = 'none';
    gate.classList.add('gone');
    opts.onEnter?.();
    document.body.classList.add('inside', 'ready');
    lid = lidAim = barFor();
    rootStyle.setProperty('--bar', `${lid}px`);
    touch.enabled = true;
    if (shot === 'projects') showProject(0);
    rig.jump(shot);
    if (shot === 'signal') terminal.show('signal');
    onArrive[shot]?.();
  } else {
    // Ready: a beat to let the first frame settle, then in we go.
    window.setTimeout(() => enter(opts.sound), reduced ? 0 : 400);
  }
  (window as unknown as { __ew: unknown }).__ew = { worldId, rig, sound, flap: board, kit, terminal, goTo, world, watch, pad, treats, rolodex, map, honors, shoes, shelf, camera, reader, openBook, ...kit.debug };
}

