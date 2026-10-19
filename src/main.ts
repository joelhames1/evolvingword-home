// Evolving Word. Everyone gets the simple page in the document; computers that
// can take it step inside the scene, which loads separately (src/scene.ts).
import '@fontsource/archivo-black/400.css';
import '@fontsource/vt323/400.css';
import '@fontsource/caveat/400.css';
import '@fontsource/caveat/600.css';
import '@fontsource/space-mono/400.css';
import '@fontsource/space-mono/700.css';
import '@fontsource/eb-garamond/400.css';
import '@fontsource/eb-garamond/400-italic.css';
import '@fontsource/eb-garamond/500.css';
import '@fontsource/eb-garamond/600.css';
import '@fontsource/unifrakturmaguntia/400.css';
import './style.css';
import { BOOKS, loadBook } from './books';
import { choose, dismiss, lastWorld, rememberWorld } from './chooser';
import { fillPlain, switchTo, wantsLite } from './plain';
import { buildReader } from './reader';
import { isWorld, WORLDS, type WorldId } from './worlds';

/** The simple page on its own: the books open in the same reader, no 3D at all. */
function startSimple() {
  document.documentElement.classList.add('lite');
  document.body.classList.add('lite');
  const reader = buildReader(document.getElementById('reader')!, { turn: () => {}, closed: () => {} });
  fillPlain((id) => {
    const book = BOOKS.find((b) => b.id === id);
    if (book) void loadBook(book).then(() => reader.open(book));
  });
  window.addEventListener('keydown', (e) => {
    if (!reader.isOpen()) return;
    if (e.key === 'Escape') reader.close();
    else if (e.key === 'ArrowRight' || e.key === ' ') reader.turn(1);
    else if (e.key === 'ArrowLeft') reader.turn(-1);
    else return;
    e.preventDefault();
  });
  for (const id of ['plain-full', 'plain-full-2'])
    document.getElementById(id)?.addEventListener('click', (e) => {
      e.preventDefault();
      switchTo('full');
    });
}

/** Loads the studio around a world and steps in. */
function enter(world: WorldId, sound: boolean) {
  rememberWorld(world);
  document.getElementById('gate')!.hidden = false;
  // Each world is a channel on the old set.
  document.getElementById('gate-ch')!.textContent = `CH ${String(WORLDS.findIndex((w) => w.id === world) + 1).padStart(2, '0')}`;
  document.body.dataset.world = world;
  void import('./scene').then((m) => m.startScene(world, { sound, onEnter: dismiss }));
}

if (wantsLite()) startSimple();
else {
  // Screen readers still get the simple page, hidden under the scene.
  fillPlain(() => {});
  for (const id of ['gate-simple', 'chooser-simple'])
    document.getElementById(id)?.addEventListener('click', (e) => {
      e.preventDefault();
      switchTo('simple');
    });
  const q = new URLSearchParams(location.search);
  const asked = q.get('world');
  if (isWorld(asked)) enter(asked, false);
  // Screenshots and tests jump straight to a shot, in the world asked for or the last one.
  else if (q.has('shot')) enter(lastWorld() ?? 'alps', false);
  else {
    // Fetch the studio while they choose; it only runs once they've picked.
    void import('./scene');
    void choose().then(({ world, sound }) => enter(world, sound));
  }
}
