// The way in: a row of snow globes, one per world, each holding a still of its
// view with its own weather falling inside the glass. Pick one and it shakes,
// then you dive into it while the world loads behind.
import { unlockAudio } from './audio-unlock';
import { cleanShown, WORLDS, type WorldId, type WorldInfo } from './worlds';
import { SHOWN } from './worlds/shown';

const WORLD_KEY = 'ew.world';
const SOUND_KEY = 'ew.sound';

const read = (key: string) => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};
const write = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Nowhere to remember it; the choice still works this once.
  }
};

/** The world picked last time, if any. */
export const lastWorld = (): WorldId | null => {
  const id = read(WORLD_KEY);
  return WORLDS.some((w) => w.id === id) ? (id as WorldId) : null;
};
export const rememberWorld = (id: WorldId) => write(WORLD_KEY, id);

/** The world just left with the Worlds button, if any: the chooser pulls back out of its globe. */
const cameFrom = (): string | null => {
  try {
    const id = sessionStorage.getItem('ew.from');
    sessionStorage.removeItem('ew.from');
    return id;
  } catch {
    return null;
  }
};

/** Where a globe has to move, and how big it has to get, for its glass to fill the screen. */
const fillScreen = (globe: HTMLElement) => {
  const r = globe.getBoundingClientRect();
  const dx = window.innerWidth / 2 - (r.left + r.width / 2);
  const dy = window.innerHeight / 2 - (r.top + r.height / 2);
  const scale = (Math.hypot(window.innerWidth, window.innerHeight) / r.width) * 1.08;
  return `translate(${dx}px, ${dy}px) scale(${scale})`;
};

/** The weather running in each globe, stopped once a world takes over. */
const skies: { stop(): void }[] = [];

/** Snow drifting, rain slanting, morning mist or falling petals, inside one globe. */
function weather(canvas: HTMLCanvasElement, kind: WorldInfo['weather']) {
  const g = canvas.getContext('2d')!;
  const n = { snow: 70, rain: 90, mist: 46, petals: 34 }[kind];
  const bits = Array.from({ length: n }, (_, i) => ({ x: Math.random(), y: Math.random(), s: 0.4 + Math.random() * 0.8, p: Math.random() * 6.28, spin: Math.random() * 6.28, leaf: i % 3 === 0 }));
  let stir = 0;
  let last = performance.now();
  let running = true;
  const frame = (now: number) => {
    if (!running) return;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    stir = Math.max(0, stir - dt * 0.6);
    const w = canvas.width;
    const h = canvas.height;
    g.clearRect(0, 0, w, h);
    for (const b of bits) {
      if (kind === 'snow') {
        // Snow drifts down and sways; a shake whirls it round the middle.
        b.y += dt * (0.05 + b.s * 0.05) * (1 - stir * 1.6);
        b.x += dt * (Math.sin(now / 900 + b.p) * 0.02 + stir * Math.cos(b.p + now / 300) * 0.5);
        g.fillStyle = `rgba(255,255,255,${0.45 + b.s * 0.45})`;
        g.beginPath();
        g.arc(b.x * w, b.y * h, (1 + b.s * 1.6) * (w / 320), 0, Math.PI * 2);
        g.fill();
      } else if (kind === 'rain') {
        // Rain comes down at a slant, faster when shaken.
        b.y += dt * (0.9 + b.s * 0.6) * (1 + stir * 2);
        b.x += dt * 0.12;
        g.strokeStyle = `rgba(190,215,255,${0.18 + b.s * 0.3})`;
        g.lineWidth = w / 360;
        g.beginPath();
        g.moveTo(b.x * w, b.y * h);
        g.lineTo((b.x - 0.012) * w, (b.y - 0.05 * b.s) * h);
        g.stroke();
      } else if (kind === 'mist') {
        // Morning mist: soft wisps drifting low across the glass, with a glint of
        // dew here and there. A shake sends them curling round.
        b.x += dt * (0.018 + b.s * 0.02 + stir * Math.cos(b.p + now / 400) * 0.4);
        b.y += dt * (Math.sin(now / 1700 + b.p) * 0.008 - stir * Math.sin(b.p + now / 350) * 0.3);
        if (b.leaf) {
          const tw = 0.5 + 0.5 * Math.sin(now / 260 + b.p * 3);
          g.fillStyle = `rgba(255,226,170,${0.25 + tw * 0.55})`;
          g.beginPath();
          g.arc(b.x * w, b.y * h, (0.8 + b.s) * (w / 380), 0, Math.PI * 2);
          g.fill();
        } else {
          const r = (0.06 + b.s * 0.08) * w;
          const low = 0.4 + 0.6 * Math.min(1, Math.max(0, (b.y - 0.35) / 0.5));
          const grad = g.createRadialGradient(b.x * w, b.y * h, 0, b.x * w, b.y * h, r);
          grad.addColorStop(0, `rgba(255,236,220,${0.16 * low})`);
          grad.addColorStop(1, 'rgba(255,236,220,0)');
          g.fillStyle = grad;
          g.beginPath();
          g.ellipse(b.x * w, b.y * h, r * 1.8, r * 0.6, 0, 0, Math.PI * 2);
          g.fill();
        }
      } else {
        // Petals and the odd olive leaf, tumbling and side-slipping as they fall.
        b.y += dt * (0.045 + b.s * 0.035) * (1 - stir * 1.6);
        b.x += dt * (Math.sin(now / 700 + b.p) * 0.05 + stir * Math.cos(b.p + now / 300) * 0.5);
        b.spin += dt * (1.2 + b.s * 1.5) * (1 + stir * 4);
        const size = (2.4 + b.s * 2.6) * (w / 320);
        g.save();
        g.translate(b.x * w, b.y * h);
        g.rotate(b.spin * 0.6 + b.p);
        // Seen edge-on as they turn over.
        g.scale(1, 0.25 + 0.75 * Math.abs(Math.cos(b.spin)));
        g.fillStyle = b.leaf ? `rgba(158,170,120,${0.6 + b.s * 0.3})` : `rgba(255,${206 + Math.round(b.s * 30)},${214 + Math.round(b.s * 20)},${0.7 + b.s * 0.25})`;
        g.beginPath();
        if (b.leaf) g.ellipse(0, 0, size * 1.7, size * 0.45, 0, 0, Math.PI * 2);
        else g.ellipse(0, 0, size, size * 0.7, 0, 0, Math.PI * 2);
        g.fill();
        g.restore();
      }
      if (b.y > 1.05) {
        b.y = -0.05;
        b.x = Math.random();
      }
      if (b.y < -0.1) b.y = 1;
      if (b.x > 1.05) b.x = -0.05;
      if (b.x < -0.05) b.x = 1.05;
    }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
  return {
    shake: () => (stir = 1),
    stop: () => (running = false),
  };
}

/**
 * The globes to show: every world for ?worlds=all; otherwise the owner's live
 * choice (api/worlds.ts) if it answers quickly, and failing that the list in
 * worlds/shown.ts.
 */
export async function shownWorlds(): Promise<WorldInfo[]> {
  if (new URLSearchParams(location.search).get('worlds') === 'all') return WORLDS;
  let ids: WorldId[] = SHOWN;
  try {
    const stop = new AbortController();
    const timer = window.setTimeout(() => stop.abort(), 1200);
    const res = await fetch('/api/worlds', { signal: stop.signal, cache: 'no-store' });
    window.clearTimeout(timer);
    if (res.ok && res.headers.get('content-type')?.includes('json')) ids = cleanShown(((await res.json()) as { shown?: unknown }).shown) ?? ids;
  } catch {
    // Not set up, or too slow: the list in the repo it is.
  }
  return ids.map((id) => WORLDS.find((w) => w.id === id)!).filter(Boolean);
}

/**
 * Shows the globes. Resolves with the world picked and whether to start with
 * sound, once the dive into it is underway.
 */
export function choose(worlds: WorldInfo[] = WORLDS): Promise<{ world: WorldId; sound: boolean }> {
  const root = document.getElementById('chooser')!;
  const row = document.getElementById('globes')!;
  const soundBtn = document.getElementById('chooser-sound') as HTMLButtonElement;
  let sound = read(SOUND_KEY) !== 'off';
  const showSound = () => {
    soundBtn.textContent = sound ? 'Sound on' : 'Sound off';
    soundBtn.setAttribute('aria-pressed', String(sound));
  };
  showSound();
  soundBtn.addEventListener('click', () => {
    sound = !sound;
    write(SOUND_KEY, sound ? 'on' : 'off');
    showSound();
  });

  const last = lastWorld();
  const from = cameFrom();
  // The layout keys off how many globes there are: one row, or two (see .globes in style.css).
  row.dataset.count = String(worlds.length);
  root.hidden = false;
  document.body.classList.add('choosing');

  return new Promise((resolve) => {
    let picked = false;
    let returning: { wrap: HTMLElement; globe: HTMLElement; sky: { shake(): void } } | null = null;
    for (const w of worlds) {
      const wrap = document.createElement('button');
      wrap.type = 'button';
      wrap.className = `globe-wrap world-${w.id}`;
      wrap.setAttribute('aria-label', `${w.name}. ${w.line}`);
      wrap.style.setProperty('--glow', w.glow);
      const globe = document.createElement('span');
      globe.className = 'globe';
      const img = document.createElement('img');
      img.src = w.still;
      img.alt = '';
      const canvas = document.createElement('canvas');
      canvas.width = 480;
      canvas.height = 480;
      const glass = document.createElement('span');
      glass.className = 'glass';
      globe.append(img, canvas, glass);
      const base = document.createElement('span');
      base.className = 'base';
      const plaque = document.createElement('span');
      plaque.className = 'plaque';
      plaque.textContent = w.name;
      base.append(plaque);
      const caption = document.createElement('span');
      caption.className = 'caption';
      const line = document.createElement('span');
      line.textContent = w.line;
      caption.append(line);
      if (w.id === last) {
        const tag = document.createElement('span');
        tag.className = 'last';
        tag.textContent = 'Where you were last time';
        caption.append(tag);
      }
      wrap.append(globe, base, caption);
      row.append(wrap);
      const sky = weather(canvas, w.weather);
      skies.push(sky);
      wrap.addEventListener('pointerenter', () => sky.shake());
      wrap.addEventListener('click', () => {
        if (picked) return;
        picked = true;
        rememberWorld(w.id);
        // The world's sound starts once it's built, too late to count as this
        // click; opening the audio now is what lets it play then.
        if (sound) unlockAudio();
        sky.shake();
        root.classList.add('picked');
        wrap.classList.add('picked');
        // Shake, then dive: the globe grows from where it sits until its glass
        // fills the screen, and the world takes over from there.
        globe.animate(
          [
            { transform: 'translate(0, 0) rotate(0deg)' },
            { transform: 'translate(0, 0) rotate(-4deg)', offset: 0.08 },
            { transform: 'translate(0, 0) rotate(4deg)', offset: 0.16 },
            { transform: 'translate(0, 0) rotate(-2deg)', offset: 0.24 },
            { transform: 'translate(0, 0) rotate(0deg)', offset: 0.3 },
            { transform: fillScreen(globe) },
          ],
          { duration: 1700, easing: 'cubic-bezier(0.6, 0, 0.4, 1)', fill: 'forwards' },
        );
        window.setTimeout(() => resolve({ world: w.id, sound }), 1250);
      });
      if (w.id === from) returning = { wrap, globe, sky };
    }
    // Back from a world: start inside its globe, filling the screen, and pull back
    // out of it to where it sits, the dive in reverse, while the rest fades up.
    if (returning) {
      const { wrap, globe, sky } = returning;
      root.classList.add('returning');
      wrap.classList.add('back');
      globe.animate([{ transform: fillScreen(globe) }, { transform: 'translate(0, 0) scale(1)', offset: 0.85 }, { transform: 'translate(0, 0) rotate(2deg)', offset: 0.92 }, { transform: 'none' }], {
        duration: 1600,
        easing: 'cubic-bezier(0.5, 0, 0.3, 1)',
      });
      // The weather inside is still swirling from the trip.
      sky.shake();
      window.setTimeout(() => root.classList.remove('returning'), 700);
      window.setTimeout(() => wrap.classList.remove('back'), 1700);
    }
  });
}

/** Clears the chooser away once the world is showing. */
export function dismiss() {
  const root = document.getElementById('chooser')!;
  root.classList.add('gone');
  document.body.classList.remove('choosing');
  // Nobody's looking at the globes now; don't spend frames on their weather.
  for (const sky of skies.splice(0)) sky.stop();
  window.setTimeout(() => (root.hidden = true), 900);
}
