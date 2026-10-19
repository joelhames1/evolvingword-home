// The way in: a row of snow globes, one per world, each holding a still of its
// view with its own weather falling inside the glass. Pick one and it shakes,
// then you dive into it while the world loads behind.
import { unlockAudio } from './audio-unlock';
import { WORLDS, type WorldId, type WorldInfo } from './worlds';

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

/** Snow drifting, or rain slanting, inside one globe. */
function weather(canvas: HTMLCanvasElement, kind: WorldInfo['weather']) {
  const g = canvas.getContext('2d')!;
  const n = kind === 'snow' ? 70 : 90;
  const bits = Array.from({ length: n }, () => ({ x: Math.random(), y: Math.random(), s: 0.4 + Math.random() * 0.8, p: Math.random() * 6.28 }));
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
      } else {
        // Rain comes down at a slant, faster when shaken.
        b.y += dt * (0.9 + b.s * 0.6) * (1 + stir * 2);
        b.x += dt * 0.12;
        g.strokeStyle = `rgba(190,215,255,${0.18 + b.s * 0.3})`;
        g.lineWidth = w / 360;
        g.beginPath();
        g.moveTo(b.x * w, b.y * h);
        g.lineTo((b.x - 0.012) * w, (b.y - 0.05 * b.s) * h);
        g.stroke();
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
 * Shows the globes. Resolves with the world picked and whether to start with
 * sound, once the dive into it is underway.
 */
export function choose(): Promise<{ world: WorldId; sound: boolean }> {
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
  const skies: ReturnType<typeof weather>[] = [];
  root.hidden = false;
  document.body.classList.add('choosing');

  return new Promise((resolve) => {
    let picked = false;
    for (const w of WORLDS) {
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
        const r = globe.getBoundingClientRect();
        const dx = window.innerWidth / 2 - (r.left + r.width / 2);
        const dy = window.innerHeight / 2 - (r.top + r.height / 2);
        const scale = (Math.hypot(window.innerWidth, window.innerHeight) / r.width) * 1.08;
        globe.animate(
          [
            { transform: 'translate(0, 0) rotate(0deg)' },
            { transform: 'translate(0, 0) rotate(-4deg)', offset: 0.08 },
            { transform: 'translate(0, 0) rotate(4deg)', offset: 0.16 },
            { transform: 'translate(0, 0) rotate(-2deg)', offset: 0.24 },
            { transform: 'translate(0, 0) rotate(0deg)', offset: 0.3 },
            { transform: `translate(${dx}px, ${dy}px) scale(${scale})` },
          ],
          { duration: 1700, easing: 'cubic-bezier(0.6, 0, 0.4, 1)', fill: 'forwards' },
        );
        window.setTimeout(() => resolve({ world: w.id, sound }), 1250);
      });
    }
  });
}

/** Clears the chooser away once the world is showing. */
export function dismiss() {
  const root = document.getElementById('chooser')!;
  root.classList.add('gone');
  document.body.classList.remove('choosing');
  window.setTimeout(() => (root.hidden = true), 900);
}
