// The owner page: choose which worlds have a globe, and in what order. Saving
// needs the owner password (checked by api/worlds.ts, never stored here).
import '@fontsource/eb-garamond/400.css';
import '@fontsource/eb-garamond/400-italic.css';
import '@fontsource/eb-garamond/500.css';
import '@fontsource/space-mono/400.css';
import './owner.css';
import { cleanShown, MAX_WORLDS, WORLDS, type WorldId } from './worlds';
import { SHOWN } from './worlds/shown';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const status = $('status');
const list = $('worlds');
const tell = (text: string, bad = false) => {
  status.textContent = text;
  status.classList.toggle('bad', bad);
};

/** Every world, the shown ones first in their order, each with a tick. */
let order: WorldId[] = WORLDS.map((w) => w.id);
let on = new Set<WorldId>();
const draw = () => {
  list.replaceChildren(
    ...order.map((id, i) => {
      const w = WORLDS.find((x) => x.id === id)!;
      const li = document.createElement('li');
      li.classList.toggle('on', on.has(id));
      const img = document.createElement('img');
      img.src = w.still;
      img.alt = '';
      const box = document.createElement('input');
      box.type = 'checkbox';
      box.id = `w-${id}`;
      box.checked = on.has(id);
      box.addEventListener('change', () => {
        if (box.checked && on.size >= MAX_WORLDS) {
          box.checked = false;
          tell(`Five at most: untick one first.`, true);
          return;
        }
        if (box.checked) on.add(id);
        else on.delete(id);
        tell(`${on.size} ticked. Save to show them.`);
        draw();
      });
      const label = document.createElement('label');
      label.htmlFor = box.id;
      const name = document.createElement('span');
      name.className = 'name';
      name.textContent = w.name;
      const line = document.createElement('span');
      line.className = 'line';
      line.textContent = w.line;
      label.append(name, line);
      const move = document.createElement('span');
      move.className = 'move';
      for (const [text, d] of [
        ['↑', -1],
        ['↓', 1],
      ] as const) {
        const b = document.createElement('button');
        b.type = 'button';
        b.textContent = text;
        b.setAttribute('aria-label', `Move ${w.name} ${d < 0 ? 'up' : 'down'}`);
        b.disabled = i + d < 0 || i + d >= order.length;
        b.addEventListener('click', () => {
          [order[i], order[i + d]] = [order[i + d], order[i]];
          draw();
        });
        move.append(b);
      }
      li.append(img, label, box, move);
      return li;
    }),
  );
};

const show = (ids: WorldId[]) => {
  on = new Set(ids);
  order = [...ids, ...WORLDS.map((w) => w.id).filter((id) => !on.has(id))];
  draw();
};

async function load() {
  show(SHOWN);
  try {
    const res = await fetch('/api/worlds', { cache: 'no-store' });
    if (!res.ok || !res.headers.get('content-type')?.includes('json')) throw new Error();
    const live = cleanShown(((await res.json()) as { shown?: unknown }).shown);
    if (live) {
      show(live);
      tell('Showing your live choice.');
    } else tell('Showing the list in the repo (src/worlds/shown.ts).');
  } catch {
    tell('The live switch isn’t reachable here, so this is the list in the repo.', true);
  }
}

async function save(shown: WorldId[] | null) {
  const password = $<HTMLInputElement>('password').value;
  if (!password) return tell('Type the password first.', true);
  tell('Saving…');
  try {
    const res = await fetch('/api/worlds', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ password, shown }) });
    const body = (await res.json().catch(() => ({}))) as { shown?: WorldId[] | null; error?: string };
    if (!res.ok) return tell(body.error ?? `That didn’t work (${res.status}).`, true);
    if (body.shown) {
      show(body.shown);
      tell(`Saved. The globes now show ${body.shown.length}: ${body.shown.map((id) => WORLDS.find((w) => w.id === id)?.name).join(', ')}.`);
    } else {
      show(SHOWN);
      tell('Saved. The globes follow the list in the repo again.');
    }
  } catch {
    tell('Couldn’t reach the switch. Try again in a moment.', true);
  }
}

$('form').addEventListener('submit', (e) => {
  e.preventDefault();
  const shown = order.filter((id) => on.has(id));
  if (!shown.length) return tell('Tick at least one world.', true);
  void save(shown);
});
$('clear').addEventListener('click', () => void save(null));
void load();
