// Evolving Word: a night print studio five floors above a rainy city.
import '@fontsource/archivo-black/400.css';
import '@fontsource/vt323/400.css';
import '@fontsource/caveat/400.css';
import '@fontsource/space-mono/400.css';
import '@fontsource/space-mono/700.css';
import './style.css';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { Sound } from './audio';
import { INTRO_VIA, Rig, SHOTS, type ShotName } from './camera';
import { buildCity } from './city';
import { buildDesk } from './desk';
import { buildFlyby } from './flyby';
import { Interactions } from './interact';
import { buildLine } from './line';
import { PROJECTS } from './projects';
import { buildRoom } from './room';
import { buildTerminal, type Page } from './terminal';
import { createWorld } from './world';

const CONTACT = 'studio@evolvingword.com';
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

/** The plain page: phones, reduced motion, no WebGL, or ?lite. */
function wantsLite(): boolean {
  const q = new URLSearchParams(location.search);
  if (q.has('full')) return false;
  if (q.has('lite')) return true;
  const gl = document.createElement('canvas').getContext('webgl2');
  if (!gl) return true;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return true;
  return window.innerWidth < 760 || (matchMedia('(pointer: coarse)').matches && window.innerWidth < 1100);
}

function fillPlain() {
  const list = $('plain-list');
  list.innerHTML = '';
  for (const p of PROJECTS) {
    const li = document.createElement('li');
    const h = document.createElement('h3');
    h.textContent = p.title;
    const tag = document.createElement('p');
    tag.textContent = `${p.tagline} ${p.blurb}`;
    li.append(h, tag);
    if (p.url) {
      const a = document.createElement('a');
      a.href = p.url;
      a.textContent = `Open ${p.title} →`;
      li.append(a);
    } else {
      const s = document.createElement('p');
      s.textContent = p.status;
      li.append(s);
    }
    list.append(li);
  }
}

async function boot() {
  fillPlain();
  if (wantsLite()) {
    document.documentElement.classList.add('lite');
    document.body.classList.add('lite');
    return;
  }

  const bootLog = $('boot');
  const bar = $('bar');
  const log = (text: string, pct: number) => {
    const li = document.createElement('li');
    li.textContent = text;
    bootLog.append(li);
    bar.style.width = `${pct}%`;
  };

  log('WARMING UP THE TUBES', 10);
  await Promise.all(
    ['400 64px "Archivo Black"', '400 40px "VT323"', '400 40px "Caveat"', '400 40px "Space Mono"', '700 40px "Space Mono"'].map((f) => document.fonts.load(f)),
  );
  log('LOADING INK', 30);

  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const quality = navigator.hardwareConcurrency >= 8 && window.devicePixelRatio <= 2 ? 'high' : 'low';
  const world = createWorld($('scene'), quality);
  const { scene, camera, renderer } = world;
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.035;

  const sound = new Sound();
  const rig = new Rig(camera, reduced);

  const terminal = buildTerminal({
    open: (url) => {
      sound.click();
      if (url.startsWith('mailto:')) location.href = url;
      else window.open(url, '_blank', 'noopener');
    },
    go: (page) => {
      if (page === 'menu') terminal.show('menu');
      else if (page === 'about' || page === 'projects') goTo(page);
      else if (rig.current === 'signal' && !rig.moving) terminal.show(page);
      else goTo('signal', page);
    },
    evolve: (text) => {
      city.evolve(text);
      watching = text;
      goTo('window');
      say(`BREEDING "${text}" FROM NOISE · ESC TO COME BACK`);
    },
    contact: CONTACT,
  });
  terminal.show('menu');

  const room = buildRoom();
  const desk = buildDesk(terminal.texture);
  log('SWEEPING THE STREET', 55);
  const city = buildCity(quality);
  const line = buildLine();
  const flyby = buildFlyby(room.rainLight.map);
  scene.add(room.group, desk.group, city.group, line.group, flyby.group);
  log('TUNING THE BILLBOARD', 80);

  // --- moving around ------------------------------------------------------------
  let projectIndex = 0;
  const panels = { about: $('about'), project: $('project') };
  const navButtons = [...document.querySelectorAll<HTMLButtonElement>('nav button')];
  const navFor: Partial<Record<ShotName, string>> = { desk: 'desk', projects: 'projects', about: 'about', signal: 'signal' };

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
    SHOTS.projects.target.copy(focus).add(new THREE.Vector3(0, 0.05, 0));
    SHOTS.projects.pos.set(focus.x - 0.25, focus.y + 0.05, 0.55);
  };

  function goTo(name: ShotName, page: Page = 'signal') {
    sound.click();
    panels.about.hidden = true;
    panels.project.hidden = true;
    if (name !== 'signal' && terminal.page() !== 'menu') terminal.show('menu');
    if (name !== 'window' && watching) {
      watching = '';
      say(HINTS, false);
    }
    if (name === 'projects') showProject(projectIndex);
    navButtons.forEach((b) => b.setAttribute('aria-current', String(b.dataset.go === (navFor[name] ?? ''))));
    void rig.go(name).then(() => {
      if (rig.current !== name) return;
      if (name === 'about') panels.about.hidden = false;
      if (name === 'projects') panels.project.hidden = false;
      if (name === 'signal') {
        terminal.show(page);
        sound.modem();
      }
    });
  }
  navButtons.forEach((b) => b.addEventListener('click', () => goTo(b.dataset.go as ShotName)));
  $('project-prev').addEventListener('click', () => {
    showProject(projectIndex - 1);
    void rig.go('projects', { duration: 0.9 });
  });
  $('project-next').addEventListener('click', () => {
    showProject(projectIndex + 1);
    void rig.go('projects', { duration: 0.9 });
  });

  // --- things you can touch ----------------------------------------------------------
  const tooltip = $('tooltip');
  const touch = new Interactions(camera, renderer.domElement, tooltip);
  touch.add({ object: desk.notepad, label: 'About', onClick: () => goTo('about') });
  touch.add({
    object: desk.crtScreen,
    label: () => (rig.current === 'signal' ? 'Pick a line' : 'Signal'),
    noGlow: true,
    onClick: (hit) => {
      if (rig.current === 'signal' && hit.uv) terminal.clickAt(hit.uv.x, hit.uv.y);
      else goTo('signal');
    },
  });
  touch.add({ object: desk.phone, label: 'Signal', onClick: () => goTo('signal') });
  touch.add({ object: desk.lamp, label: () => (desk.lampOn() ? 'Lamp off' : 'Lamp on'), onClick: () => toggleLamp() });
  touch.add({ object: desk.tapes, label: () => (sound.started && sound.musicOn && !sound.muted ? 'Stop the tape' : 'Play the tape'), onClick: () => toggleTape() });
  touch.add({ object: city.billboard, label: 'Evolve a word', onClick: () => goTo('signal', 'evolve') });
  line.items.forEach((item, i) =>
    touch.add({
      object: item.object,
      label: item.project.title,
      onClick: () => {
        showProject(i);
        if (rig.current === 'projects') void rig.go('projects', { duration: 0.9 });
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
  $('credits-close').addEventListener('click', () => ($('credits').hidden = true));

  let entered = false;
  window.addEventListener('keydown', (e) => {
    if (!entered || e.metaKey || e.ctrlKey || e.altKey) return;
    if (rig.current === 'signal' && terminal.press(e.key)) {
      e.preventDefault();
      return;
    }
    const k = e.key.toLowerCase();
    if (k === 'escape') {
      $('credits').hidden = true;
      goTo('desk');
    } else if (k === '1') goTo('projects');
    else if (k === '2') goTo('about');
    else if (k === '3') goTo('signal');
    else if (k === 'w') goTo('window');
    else if (k === 'e' || k === '4') goTo('signal', 'evolve');
    else if (k === 'l') toggleLamp();
    else if (k === 't') toggleTape();
    else if (rig.current === 'projects' && (k === 'arrowright' || k === 'arrowleft')) {
      showProject(projectIndex + (k === 'arrowright' ? 1 : -1));
      void rig.go('projects', { duration: 0.9 });
    }
  });

  // --- the frame and the subtitles --------------------------------------------------
  const FRAME = 2.1;
  const barFor = () => Math.round(Math.min(window.innerHeight * 0.13, Math.max(48, (window.innerHeight - window.innerWidth / FRAME) / 2)));
  let lid = 0;
  let lidAim = 0;
  window.addEventListener('resize', () => lidAim > 0 && (lidAim = barFor()));
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
    }, 38);
  };

  // --- the loop ----------------------------------------------------------------------
  const windowBlue = new THREE.Color('#7f9cff');
  let nextFlyby = 0;
  let announced = '';
  rig.jump('street');
  world.onTick((t, dt) => {
    room.tick(t);
    room.renderRain(renderer);
    desk.tick(t, dt);
    city.tick(t, dt, camera);
    // The light through the window takes on the billboard's color.
    room.rainLight.color.copy(windowBlue).lerp(city.billboardColor, 0.55);
    line.tick(t);
    terminal.tick(t);
    if (Math.abs(lidAim - lid) > 0.2) {
      lid += (lidAim - lid) * Math.min(1, dt * 1.4);
      rootStyle.setProperty('--bar', `${lid.toFixed(1)}px`);
    }
    rig.visible = 1 - (2 * lid) / window.innerHeight;
    rig.update(t);
    touch.update();
    // Now and then, a patrol goes by. Only worth it when we're inside to see it.
    if (document.body.classList.contains('ready') && !flyby.active && rig.current !== 'street') {
      if (nextFlyby === 0) nextFlyby = t + 16;
      else if (t > nextFlyby) {
        sound.flyby(flyby.pass(t));
        nextFlyby = t + 55 + Math.random() * 40;
      }
    }
    flyby.tick(t);
    // Someone's phrase on the billboard: report back when it arrives.
    const evo = city.evolution();
    if (evo.custom) {
      terminal.setStatus(`GEN ${String(evo.generation).padStart(4, '0')} · FITNESS ${Math.round(evo.fitness * 100)}%`);
      if (evo.done && announced !== evo.target) {
        announced = evo.target;
        if (watching) say(`"${evo.target}" IN ${evo.generation} GENERATIONS · ESC TO COME BACK`);
      }
    } else if (announced) {
      announced = '';
      terminal.setStatus(STATUS);
    }
    // Louder rain the further out the camera is.
    sound.setOutside(THREE.MathUtils.clamp((-camera.position.z - 2) / 10, 0, 1));
  });
  touch.enabled = false;
  world.start();
  log('READY', 100);

  // --- the way in ------------------------------------------------------------------
  const gate = $('gate');
  const enter = (withSound: boolean) => {
    if (entered) return;
    entered = true;
    if (withSound) setSound(true);
    gate.classList.add('gone');
    lidAim = barFor();
    document.body.classList.add('inside');
    const lines = ['EVOLVING WORD', 'A LITTLE STUDIO FIVE FLOORS UP', 'WHERE WE MAKE THINGS TOGETHER'];
    if (!reduced) lines.forEach((line, i) => window.setTimeout(() => !document.body.classList.contains('ready') && say(line), 700 + i * 2900));
    void rig.go('desk', { via: INTRO_VIA, duration: reduced ? 0 : 9.5 }).then(() => {
      document.body.classList.add('ready');
      touch.enabled = true;
      say(HINTS, false);
    });
  };
  const enterBtn = $<HTMLButtonElement>('enter');
  const mutedBtn = $<HTMLButtonElement>('enter-muted');
  enterBtn.disabled = false;
  mutedBtn.disabled = false;
  enterBtn.focus();
  enterBtn.addEventListener('click', () => enter(true));
  mutedBtn.addEventListener('click', () => enter(false));

  // For screenshots and tests: jump straight to a shot, no gate.
  const q = new URLSearchParams(location.search);
  const shot = q.get('shot') as ShotName | null;
  if (shot && shot in SHOTS) {
    entered = true;
    gate.classList.add('gone');
    document.body.classList.add('inside', 'ready');
    lid = lidAim = barFor();
    rootStyle.setProperty('--bar', `${lid}px`);
    touch.enabled = true;
    if (shot === 'projects') showProject(0);
    rig.jump(shot);
    if (shot === 'signal') terminal.show('signal' as Page);
    if (shot === 'about') panels.about.hidden = false;
    if (shot === 'projects') panels.project.hidden = false;
  }
  (window as unknown as { __ew: unknown }).__ew = { rig, city, room, flyby, terminal, goTo, world };
}

void boot();
