// What the CRT shows: a little bulletin board system, typed out a character at
// a time, with lines you can click (or press the number of).
import * as THREE from 'three';
import { clean, MAX_PHRASE } from './evolve';
import { PROJECTS } from './projects';
import { canvas, texture } from './textures';

export type Page = 'menu' | 'signal' | 'projects' | 'about' | 'evolve';

export interface Line {
  text: string;
  color?: string;
  big?: boolean;
  /** Clicking (or pressing `key`) does this. */
  action?: () => void;
  key?: string;
  /** The line you type into. */
  input?: boolean;
}

export interface Terminal {
  texture: THREE.CanvasTexture;
  show(page: Page): void;
  page(): Page;
  /** A click at this point on the screen (uv, 0..1, y up). */
  clickAt(u: number, v: number): boolean;
  press(key: string): boolean;
  setStatus(text: string): void;
  tick(t: number): void;
}

const W = 1024;
const H = 768;
const GREEN = '#9dffc0';
const DIM = '#4a8f68';
const AMBER = '#ffcf7a';

export function buildTerminal(on: { open: (url: string) => void; go: (page: Page) => void; evolve: (text: string) => void; contact: string }): Terminal {
  const [c, g] = canvas(W, H);
  const tex = texture(c);
  let current: Page = 'menu';
  let lines: Line[] = [];
  let shownAt = 0;
  let now = 0;
  let status = 'NODE 1 OF 1 · 28800 BPS · ALWAYS OPEN';
  const rows: { y: number; h: number; line: Line }[] = [];
  let typed = '';
  let note = '';

  const pages: Record<Page, () => Line[]> = {
    menu: () => [
      { text: 'EVOLVING WORD', big: true },
      { text: '' },
      { text: 'A LITTLE STUDIO AT THE EDGE OF THE CITY.', color: DIM },
      { text: '' },
      { text: '[1] PROJECTS', action: () => on.go('projects'), key: '1' },
      { text: '[2] ABOUT', action: () => on.go('about'), key: '2' },
      { text: '[3] SIGNAL  (WRITE TO US)', action: () => on.go('signal'), key: '3' },
      { text: '[4] EVOLVE A WORD', action: () => on.go('evolve'), key: '4' },
    ],
    evolve: () => [
      { text: 'EVOLVE', big: true },
      { text: '' },
      { text: 'TYPE A WORD OR TWO. THE BILLBOARD', color: DIM },
      { text: 'WILL BREED IT OUT OF RANDOM LETTERS.', color: DIM },
      { text: '' },
      { text: '', input: true },
      { text: note, color: note.startsWith('!') ? AMBER : DIM },
      { text: '[ENTER] SEND TO THE BILLBOARD', action: () => send(), key: 'enter' },
      { text: '[ESC] MAIN MENU', action: () => on.go('menu'), key: 'escape' },
    ],
    projects: () => [
      { text: 'PROJECTS', big: true },
      { text: '' },
      ...PROJECTS.map((p, i) => ({
        text: `[${i + 1}] ${p.title.toUpperCase().padEnd(16)} ${p.status.toUpperCase()}`,
        color: p.url ? GREEN : DIM,
        action: p.url ? () => on.open(p.url!) : undefined,
        key: String(i + 1),
      })),
      { text: '' },
      { text: '[M] MAIN MENU', action: () => on.go('menu'), key: 'm' },
    ],
    signal: () => [
      { text: 'SIGNAL', big: true },
      { text: '' },
      { text: 'WHERE TO FIND US:', color: DIM },
      { text: '' },
      { text: `[1] WRITE    ${on.contact.toUpperCase()}`, action: () => on.open(`mailto:${on.contact}`), key: '1' },
      { text: '[2] STUDIO   STUDIO.EVOLVINGWORD.COM', action: () => on.open('https://studio.evolvingword.com'), key: '2' },
      { text: '' },
      { text: '[M] MAIN MENU', action: () => on.go('menu'), key: 'm' },
    ],
    about: () => [
      { text: 'ABOUT', big: true },
      { text: '' },
      { text: 'THE NOTEPAD HAS IT. ->', color: DIM },
      { text: '' },
      { text: '[M] MAIN MENU', action: () => on.go('menu'), key: 'm' },
    ],
  };

  const send = () => {
    const phrase = clean(typed);
    if (!phrase) {
      note = '! LETTERS AND NUMBERS, PLEASE';
      lines = pages.evolve();
      return;
    }
    note = `SENT: ${phrase}`;
    typed = '';
    lines = pages.evolve();
    on.evolve(phrase);
  };

  const draw = () => {
    g.fillStyle = '#04120b';
    g.fillRect(0, 0, W, H);
    // Header and footer bars, like an old BBS.
    g.fillStyle = GREEN;
    g.fillRect(48, 40, W - 96, 44);
    g.fillRect(48, H - 84, W - 96, 44);
    g.font = '400 38px "VT323", monospace';
    g.textBaseline = 'middle';
    g.fillStyle = '#04120b';
    g.textAlign = 'left';
    g.fillText(`EVOLVING WORD BBS · ${current.toUpperCase()}`, 62, 63);
    g.textAlign = 'right';
    const d = new Date();
    g.fillText(`${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`, W - 62, 63);
    g.textAlign = 'left';
    g.fillText(status, 62, H - 61);

    // Typed out: each line appears after the one before it.
    const elapsed = (now - shownAt) * 90;
    let budget = elapsed;
    let y = 150;
    rows.length = 0;
    g.shadowColor = '#3dff9a';
    g.shadowBlur = 14;
    for (const line of lines) {
      const big = !!line.big;
      const h = big ? 110 : 48;
      const full = line.input ? `> ${typed}${Math.floor(now * 2.5) % 2 === 0 ? '_' : ' '}` : line.text;
      const text = budget >= full.length ? full : full.slice(0, Math.max(0, Math.floor(budget)));
      budget -= full.length + 4;
      g.font = big ? '400 112px "VT323", monospace' : '400 42px "VT323", monospace';
      g.fillStyle = line.color ?? (line.action || line.input ? GREEN : AMBER);
      if (big) g.fillStyle = GREEN;
      g.fillText(text, 80, y + h / 2);
      rows.push({ y, h, line });
      y += h;
      if (budget < 0) {
        if (Math.floor(now * 2.5) % 2 === 0) g.fillRect(80 + g.measureText(text).width + 6, y - h + 8, 22, h - 16);
        break;
      }
    }
    if (budget >= 0 && current !== 'evolve' && Math.floor(now * 2.5) % 2 === 0) {
      g.fillStyle = GREEN;
      g.fillRect(80, y + 14, 22, 34);
    }
    g.shadowBlur = 0;
    tex.needsUpdate = true;
  };

  let lastDraw = -1;
  return {
    texture: tex,
    show(page) {
      if (page === 'evolve' && current !== 'evolve') note = `UP TO ${MAX_PHRASE} LETTERS`;
      current = page;
      lines = pages[page]();
      shownAt = now;
      lastDraw = -1;
    },
    page: () => current,
    clickAt(u, v) {
      const y = (1 - v) * H;
      const row = rows.find((r) => y >= r.y && y < r.y + r.h && u > 0.06 && u < 0.94);
      if (row?.line.action) {
        row.line.action();
        return true;
      }
      return false;
    },
    press(key) {
      if (current === 'evolve') {
        // Everything typed goes to the phrase; only Enter and Esc do anything else.
        if (key === 'Backspace') typed = typed.slice(0, -1);
        else if (key.length === 1 && typed.length < MAX_PHRASE && clean(`A${key}`).length === 2) typed += key.toUpperCase();
        else if (key === ' ' && typed.length < MAX_PHRASE && !typed.endsWith(' ')) typed += ' ';
        else if (key !== 'Enter' && key !== 'Escape') return key.length === 1;
        if (key !== 'Enter' && key !== 'Escape') {
          note = '';
          lines = pages.evolve();
          return true;
        }
      }
      const line = lines.find((l) => l.key && l.key === key.toLowerCase());
      if (line?.action) {
        line.action();
        return true;
      }
      return false;
    },
    setStatus(text) {
      status = text;
    },
    tick(t) {
      now = t;
      // Redraw at 20 fps: plenty for typing and a blinking cursor.
      if (t - lastDraw > 0.05) {
        lastDraw = t;
        draw();
      }
    },
  };
}
