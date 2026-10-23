import { expect, test, type Page } from '@playwright/test';

/** Fails the test on any page error, console error or CSP violation. */
function watch(page: Page) {
  const problems: string[] = [];
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    // WebGL reports failed draws as warnings, but they're bugs: something didn't render.
    if (m.type() === 'error' || /GL_INVALID|WebGL: INVALID/.test(m.text())) problems.push(`console: ${m.text()}`);
  });
  page.on('dialog', (d) => {
    problems.push(`dialog: ${d.message()}`);
    void d.dismiss();
  });
  return problems;
}

type Ew = Record<string, any>;
const ew = <T>(page: Page, fn: (w: Ew) => T) => page.evaluate(`(${fn.toString()})(window.__ew)`) as Promise<T>;
const settled = (page: Page) => page.waitForFunction(() => !(window as unknown as { __ew: Ew }).__ew.rig.moving, null, { timeout: 60_000 });
const current = (page: Page) => ew(page, (w) => w.rig.current as string);
/** A fresh garden: nothing kept from an earlier test (cleared on the first page only, then kept as usual). */
const fresh = (page: Page) =>
  page.addInitScript(() => {
    if (sessionStorage.getItem('ew.test.fresh')) return;
    sessionStorage.setItem('ew.test.fresh', '1');
    localStorage.removeItem('ew.greenhouse.v1');
  });

test('the greenhouse: picked from the globes, the flowers, the bed of words, and the studio round the house', async ({ page }) => {
  test.setTimeout(420_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  const problems = watch(page);
  await fresh(page);
  await page.goto('/?full&worlds=all');
  await page.getByRole('button', { name: /The Greenhouse/ }).click();
  await expect(page.locator('body')).toHaveClass(/inside/, { timeout: 120_000 });
  expect(await ew(page, (w) => w.worldId)).toBe('greenhouse');

  // The bed on the bank breeds words; the house has its own things, and a starter garden in flower.
  await page.waitForFunction(() => (window as unknown as { __ew: Ew }).__ew.flap.evolution().generation > 3, null, { timeout: 60_000 });
  const own = await ew(page, (w) => ({
    target: w.flap.evolution().target,
    plants: w.garden().pots.filter(Boolean).length,
    pots: w.garden().pots.length,
    bee: w.bee.group.children.length > 0,
    catalog: w.catalog.page(),
    // Every walk between two places keeps clear of the benches, the plants, the glass and the brick.
    blocked: w.blocked(),
  }));
  expect(own).toEqual({ target: 'EVOLVING WORD', plants: 8, pots: 16, bee: true, catalog: 0, blocked: [] });
  await expect(page.locator('body')).toHaveClass(/ready/, { timeout: 90_000 });

  // Its music and weather: the band, a shower, the bee, the small sounds of gardening.
  await ew(page, (w) => {
    if (!w.sound.started) w.sound.start();
    w.sound.setMuted(false);
    w.shower(true);
    w.band.bloom(3);
    w.band.pour();
    w.band.snip();
    w.band.thunk();
    w.band.stamp();
    w.band.plop();
  });
  await page.waitForTimeout(2500);
  await ew(page, (w) => w.shower(null));

  // The map, then back to its wall.
  await page.keyboard.press('m');
  await expect(page.locator('#card-title')).toHaveText('Places I have been', { timeout: 30_000 });
  await page.keyboard.press('Escape');
  await settled(page);
  expect(await current(page)).toBe('places');

  // Round the house: the flowers, the bench, the prizes, the books and seeds, the map and the line.
  for (const next of ['staging', 'desk', 'honors', 'library', 'places']) {
    await page.keyboard.press('ArrowRight');
    await settled(page);
    expect(await current(page)).toBe(next);
  }
  await page.keyboard.press('ArrowLeft');
  await settled(page);
  expect(await current(page)).toBe('library');

  // Every one of the studio's stops is there, works, and has what it looks at in view.
  for (const [shot, title] of [
    ['watch', 'The watch'],
    ['treats', 'Coffee and chocolate'],
    ['work', 'The Rolodex'],
    ['diplomas', 'Diplomas'],
    ['medals', 'Medals'],
    ['library', 'Take one down'],
    ['map', 'Places I have been'],
    ['shoes', null],
    ['catalog', null],
    ['about', null],
    ['signal', null],
    ['pad', null],
  ] as const) {
    await page.evaluate((s) => (window as unknown as { __ew: Ew }).__ew.goTo(s), shot);
    await settled(page);
    expect(await current(page)).toBe(shot);
    if (title) await expect(page.locator('#card-title')).toHaveText(title, { timeout: 20_000 });
    // What the shot looks at is in front of the camera and on screen.
    const framed = await page.evaluate((s) => {
      const w = (window as unknown as { __ew: Ew }).__ew;
      const p = w.shots[s].target.clone().project(w.camera);
      return Math.abs(p.x) < 1 && Math.abs(p.y) < 1 && p.z < 1 && w.roomy(w.camera.position);
    }, shot);
    expect(framed, shot).toBe(true);
  }
  // The catalog's card turns its pages.
  await page.evaluate(() => (window as unknown as { __ew: Ew }).__ew.goTo('catalog'));
  await settled(page);
  await expect(page.locator('#card-kicker')).toContainText('The seed catalog', { timeout: 20_000 });
  const first = await page.locator('#card-title').textContent();
  await page.locator('#card-actions button', { hasText: 'Next page' }).click();
  await expect(page.locator('#card-title')).not.toHaveText(first ?? '');
  expect(await ew(page, (w) => w.catalog.page())).toBe(1);

  // The software renderer is slow, so the offer of the simple page has come up by now.
  await expect(page.locator('#slow')).toBeVisible({ timeout: 30_000 });
  await page.locator('#slow-stay').click();

  // Back to the globes: this one is marked as where you were.
  await page.locator('#worlds-btn').click();
  await expect(page.locator('#chooser')).toBeVisible();
  if (!(await page.locator('.globe-wrap.world-greenhouse').count())) await page.goto('/?full&worlds=all');
  await expect(page.locator('.globe-wrap.world-greenhouse .last')).toHaveText('Where you were last time');
  expect(problems).toEqual([]);
});

test('the greenhouse: breed a flower by clicking two, watch it grow, and find it there after a reload', async ({ page }) => {
  test.setTimeout(420_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  const problems = watch(page);
  await page.goto('/?shot=staging&full&world=greenhouse');
  await page.waitForFunction(() => 'garden' in ((window as unknown as { __ew?: object }).__ew ?? {}));
  await ew(page, () => localStorage.removeItem('ew.greenhouse.v1'));
  await page.reload();
  await page.waitForFunction(() => 'garden' in ((window as unknown as { __ew?: object }).__ew ?? {}));
  await expect(page.locator('#card-title')).toHaveText('Breed a flower', { timeout: 60_000 });
  // Grow twenty times as fast, for the test.
  await ew(page, (w) => w.speed(20));

  const pots = await ew(page, (w) => w.garden().pots.map((p: Ew | null) => (p ? p.code : null)));
  const [a, b] = pots.map((p: string | null, i: number) => (p ? i : -1)).filter((i: number) => i >= 0);
  // (Seeds go into the most visible empty pot first: the near row, from the bench end.)
  const empty = await ew(page, (w) => w.nextPot() as number);
  expect(pots[empty]).toBeNull();
  /** Where a pot's plant is on screen, to click it for real. */
  const onScreen = (i: number) =>
    page.evaluate((i) => {
      const w = (window as unknown as { __ew: Ew }).__ew;
      const m = w.flowers.pick[i];
      const p = m.getWorldPosition(w.camera.position.clone());
      p.y += m.scale.y * 0.3;
      p.project(w.camera);
      const c = document.querySelector('#scene canvas')!;
      return { x: ((p.x + 1) / 2) * c.clientWidth, y: ((1 - p.y) / 2) * c.clientHeight };
    }, i);
  const click = async (i: number) => {
    const pt = await onScreen(i);
    await page.mouse.move(pt.x, pt.y);
    await page.waitForTimeout(1500);
    const at = await onScreen(i);
    await page.mouse.click(at.x, at.y);
  };
  // The first flower: picked, its card shows.
  await click(a);
  await expect(page.locator('#card-kicker')).toHaveText(`On the staging · pot ${a + 1}`, { timeout: 30_000 });
  expect(await ew(page, (w) => w.garden().crosses)).toBe(0);
  // The second: the bee carries the pollen across, and the seed into the first empty pot.
  await click(b);
  await expect(page.locator('#card-title')).toHaveText('Off it goes', { timeout: 30_000 });
  await page.waitForFunction((i) => (window as unknown as { __ew: Ew }).__ew.garden().pots[i] !== null, empty, { timeout: 90_000 });
  const child = await ew(page, (w) => w.garden().pots.find((p: Ew | null) => p && p.parents)!);
  expect(child.parents).toEqual([pots[a], pots[b]]);
  expect(await ew(page, (w) => w.garden().crosses)).toBe(1);
  // The camera goes to watch it come up; the card says which pot (and, grown this fast, soon what it is).
  await page.waitForFunction(() => (window as unknown as { __ew: Ew }).__ew.rig.current === 'grow', null, { timeout: 30_000 });
  await settled(page);
  await expect(page.locator('#card-kicker')).toContainText(new RegExp(`pot ${empty + 1}\\b`, 'i'), { timeout: 30_000 });
  // It grows: sprout, stem, leaves, buds, and in flower.
  await page.waitForFunction(
    (i) => {
      const w = (window as unknown as { __ew: Ew }).__ew;
      const p = w.garden().pots[i];
      return p && (Date.now() - p.born) * 20 >= 0.9 * 20_000;
    },
    empty,
    { timeout: 60_000 },
  );
  // Under the lens: its name, its traits, its parents.
  await page.evaluate((i) => (window as unknown as { __ew: Ew }).__ew.lens(i), empty);
  await page.waitForFunction(() => (window as unknown as { __ew: Ew }).__ew.rig.current === 'bloom', null, { timeout: 30_000 });
  await settled(page);
  await expect(page.locator('#card-kicker')).toContainText('Under the lens', { timeout: 30_000 });
  await expect(page.locator('#card-body')).toContainText('Seed of');
  await expect(page.locator('#card-body li').first()).toContainText('Petals');

  // Kept in this browser: after a reload it's still there, the same flower.
  await page.reload();
  await page.waitForFunction(() => 'garden' in ((window as unknown as { __ew?: object }).__ew ?? {}));
  expect(await page.evaluate((i) => (window as unknown as { __ew: Ew }).__ew.garden().pots[i]?.code, empty)).toBe(child.code);
  expect(await ew(page, (w) => w.garden().crosses)).toBe(1);

  // The tools: water it, cut it back, and compost it (with a thunk), which frees the pot.
  await expect(page.locator('#card-title')).toHaveText('Breed a flower', { timeout: 60_000 });
  await page.evaluate((i) => (window as unknown as { __ew: Ew }).__ew.water(i), empty);
  await page.evaluate((i) => (window as unknown as { __ew: Ew }).__ew.compost(i), empty);
  await page.waitForFunction((i) => (window as unknown as { __ew: Ew }).__ew.garden().pots[i] === null, empty, { timeout: 30_000 });
  expect(await ew(page, (w) => w.garden().composted)).toBe(1);
  // Start over puts the first seeds back.
  await page.waitForFunction(() => !(window as unknown as { __ew: Ew }).__ew.busy(), null, { timeout: 60_000 });
  await page.locator('#card-actions button', { hasText: 'Start the garden over' }).click();
  await page.locator('#card-actions button', { hasText: 'Start over' }).click();
  await expect(page.locator('#card-title')).toHaveText('Breed a flower');
  expect(await ew(page, (w) => [w.garden().crosses, w.garden().composted, w.garden().pots.filter(Boolean).length])).toEqual([0, 0, 8]);
  expect(problems).toEqual([]);
});

test('the greenhouse: a shared flower grows in a friend’s greenhouse, and odd links do nothing', async ({ page }) => {
  test.setTimeout(420_000);
  await page.setViewportSize({ width: 1280, height: 800 });
  const problems = watch(page);
  await fresh(page);
  // Someone shares one of their flowers.
  await page.goto('/?shot=staging&full&world=greenhouse');
  await page.waitForFunction(() => 'garden' in ((window as unknown as { __ew?: object }).__ew ?? {}));
  const link = await ew(page, (w) => w.shareLink(w.garden().pots.findIndex(Boolean)) as string);
  expect(link).toMatch(/\/\?bloom=[A-Za-z0-9_-]{13}$/);
  const code = new URL(link).searchParams.get('bloom')!;

  // A friend opens it (no world named: the greenhouse opens), with a garden of their own.
  await page.goto(`/?bloom=${code}&full`);
  await page.waitForFunction(() => 'garden' in ((window as unknown as { __ew?: object }).__ew ?? {}), null, { timeout: 90_000 });
  expect(await ew(page, (w) => w.worldId)).toBe('greenhouse');
  const gift = await page.evaluate((c) => {
    const g = (window as unknown as { __ew: Ew }).__ew.garden();
    return g.pots.findIndex((p: Ew | null) => p && p.code === c && p.gift);
  }, code);
  expect(gift).toBeGreaterThanOrEqual(0);
  await expect(page.locator('#hints')).toContainText('A GIFT FROM A FRIEND', { timeout: 120_000 });
  // Opening the same link again doesn't plant it twice; with the world named it's the same.
  await page.goto(`/?bloom=${code}&world=greenhouse&shot=staging&full`);
  await page.waitForFunction(() => 'garden' in ((window as unknown as { __ew?: object }).__ew ?? {}));
  expect(await page.evaluate((c) => (window as unknown as { __ew: Ew }).__ew.garden().pots.filter((p: Ew | null) => p && p.code === c && p.gift).length, code)).toBe(1);

  // Hostile or broken links: nothing planted, nothing put on the page, nothing breaks.
  // (A few through the page here; the unit tests put many more through the decoder.)
  const before = await ew(page, (w) => JSON.stringify(w.garden()));
  for (const bad of ['<img src=x onerror=alert(1)>', '__proto__', `${code.slice(0, 12)}${code[12] === 'A' ? 'B' : 'A'}`, `${code}${'A'.repeat(5000)}`]) {
    await page.goto(`/?bloom=${encodeURIComponent(bad)}&world=greenhouse&shot=staging&full`);
    await page.waitForFunction(() => 'garden' in ((window as unknown as { __ew?: object }).__ew ?? {}));
    expect(await ew(page, (w) => JSON.stringify(w.garden())), bad.slice(0, 30)).toBe(before);
    expect(await page.locator('img[src="x"], script:not([src])').count()).toBe(0);
  }
  // A garden with every pot full: the gift waits on the potting bench, and moves in when there's room.
  await page.goto('/?shot=staging&full&world=greenhouse');
  await page.waitForFunction(() => 'garden' in ((window as unknown as { __ew?: object }).__ew ?? {}));
  await ew(page, (w) => {
    const g = w.garden();
    const full = g.pots.find(Boolean);
    for (let i = 0; i < g.pots.length; i++) if (!g.pots[i]) g.pots[i] = { ...full, gift: false };
    localStorage.setItem('ew.greenhouse.v1', JSON.stringify(g));
  });
  const other = await ew(page, (w) => w.shareLink(w.garden().pots.findIndex(Boolean)) as string);
  // (A different flower from the one already given, so it's a new gift.)
  await ew(page, (w) => {
    const g = w.garden();
    g.pots = g.pots.map((p: Ew) => ({ ...p, gift: false }));
    localStorage.setItem('ew.greenhouse.v1', JSON.stringify(g));
  });
  await page.goto(`/${new URL(other).search}&full`);
  await page.waitForFunction(() => 'garden' in ((window as unknown as { __ew?: object }).__ew ?? {}), null, { timeout: 90_000 });
  expect(await ew(page, (w) => !!w.garden().waiting)).toBe(true);
  await ew(page, (w) => w.compost(0));
  await page.waitForFunction(() => (window as unknown as { __ew: Ew }).__ew.garden().waiting === null, null, { timeout: 30_000 });
  expect(problems).toEqual([]);
});

test('the greenhouse: the camera never goes through a bench, a plant, the glass or the brick, and every shirt is seen from the aisle', async ({ page }) => {
  test.setTimeout(420_000);
  await page.setViewportSize({ width: 1280, height: 800 });
  const problems = watch(page);
  await fresh(page);
  await page.goto('/?shot=desk&full&world=greenhouse');
  await page.waitForFunction(() => 'garden' in ((window as unknown as { __ew?: object }).__ew ?? {}));
  // Watch the camera every frame: never inside anything, on the way or at a stop.
  await ew(page, (w) => {
    w.inside = [] as string[];
    const look = () => {
      if (w.solid(w.camera.position)) w.inside.push(`${w.rig.current} ${w.camera.position.toArray().map((x: number) => x.toFixed(2))}`);
      requestAnimationFrame(look);
    };
    look();
  });
  /** Where the camera stopped at a shirt: in the open, near it and looking at it. */
  const stop = () =>
    page.evaluate(() => {
      const w = (window as unknown as { __ew: Ew }).__ew;
      const shirt = w.line().items.find((it: Ew) => it.project.title === document.getElementById('project-title')!.textContent).focus;
      const to = shirt.clone().sub(w.camera.position);
      const ahead = w.camera.getWorldDirection(shirt.clone());
      return { shot: w.rig.current, roomy: w.roomy(w.camera.position), near: to.length() > 1.2 && to.length() < 2.4, facing: to.normalize().dot(ahead) > 0.97 };
    });
  const good = { shot: 'projects', roomy: true, near: true, facing: true };
  const count = await ew(page, (w) => w.line().items.length);
  await page.keyboard.press('1');
  await settled(page);
  expect(await stop()).toEqual(good);
  for (let i = 0; i < count + 1; i++) {
    await page.keyboard.press('ArrowRight');
    await settled(page);
    expect(await stop()).toEqual(good);
  }
  // Impatient: across the house and back, changing course mid-flight, out to the window and the bed.
  for (const keys of [
    ['Escape', 'ArrowLeft', '1'],
    ['w', 'ArrowLeft', 'Escape'],
    ['b', 'm', 'ArrowRight', 'ArrowRight'],
    ['e', 'Escape', 'Escape', 'ArrowLeft', 'ArrowLeft'],
  ]) {
    for (const k of keys) {
      await page.keyboard.press(k);
      await page.waitForTimeout(300);
    }
    await settled(page);
  }
  // A flower's close look, and back to the desk from it.
  await ew(page, (w) => w.lens(w.garden().pots.findIndex(Boolean)));
  await settled(page);
  expect(await current(page)).toBe('bloom');
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  await settled(page);
  expect(await ew(page, (w) => w.inside)).toEqual([]);
  expect(problems).toEqual([]);
});

test('the greenhouse: letting go of a pick, the lens from flower to flower, the catalog by arrow keys, a link to copy by hand', async ({ page }) => {
  test.setTimeout(420_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  const problems = watch(page);
  await fresh(page);
  await page.goto('/?shot=staging&full&world=greenhouse');
  await page.waitForFunction(() => 'garden' in ((window as unknown as { __ew?: object }).__ew ?? {}));
  await expect(page.locator('#card-title')).toHaveText('Breed a flower', { timeout: 60_000 });
  const [a, b] = await ew(page, (w) => w.garden().pots.map((p: Ew | null, i: number) => (p ? i : -1)).filter((i: number) => i >= 0));

  // Pick one, then think better of it: Esc lets go (and stays at the flowers), Esc again steps back to the bench.
  await ew(page, (w) => w.select(w.garden().pots.findIndex(Boolean)));
  await expect(page.locator('#card-kicker')).toHaveText(`On the staging · pot ${a + 1}`, { timeout: 30_000 });
  expect(await ew(page, (w) => w.picked())).toBe(a);
  await page.keyboard.press('Escape');
  await expect(page.locator('#card-title')).toHaveText('Breed a flower', { timeout: 30_000 });
  expect(await ew(page, (w) => [w.picked(), w.rig.current])).toEqual([-1, 'staging']);
  // "Never mind" on the card does the same.
  await page.evaluate((i) => (window as unknown as { __ew: Ew }).__ew.select(i), b);
  await page.locator('#card-actions button', { hasText: 'Never mind' }).click();
  expect(await ew(page, (w) => w.picked())).toBe(-1);

  // Under the lens, one flower and then another: the camera goes to each, and the card names each.
  const look = async (i: number, before?: string | null) => {
    await page.evaluate((i) => (window as unknown as { __ew: Ew }).__ew.lens(i), i);
    await page.waitForFunction(() => (window as unknown as { __ew: Ew }).__ew.rig.current === 'bloom', null, { timeout: 30_000 });
    await settled(page);
    // The card comes up once the camera is there (the one before it is hidden while it flies).
    await expect(page.locator('#card')).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('#card-kicker')).toHaveText('Under the lens', { timeout: 30_000 });
    if (before) await expect(page.locator('#card-title')).not.toHaveText(before, { timeout: 30_000 });
    return { at: await ew(page, (w) => w.camera.position.toArray() as number[]), name: await page.locator('#card-title').textContent() };
  };
  const first = await look(a);
  const second = await look(b, first.name);
  expect(Math.hypot(...first.at.map((x, k) => x - second.at[k]))).toBeGreaterThan(0.2);
  await page.keyboard.press('Escape');
  await settled(page);
  expect(await current(page)).toBe('staging');

  // The catalog's pages turn with the arrows, and stay put on the catalog.
  await page.evaluate(() => (window as unknown as { __ew: Ew }).__ew.goTo('catalog'));
  await settled(page);
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  expect(await ew(page, (w) => [w.catalog.page(), w.rig.current])).toEqual([2, 'catalog']);
  await page.keyboard.press('ArrowLeft');
  expect(await ew(page, (w) => w.catalog.page())).toBe(1);

  // Sharing: copied if the browser lets it, and either way the link is on the card.
  await page.evaluate(() => (window as unknown as { __ew: Ew }).__ew.goTo('staging'));
  await settled(page);
  await page.evaluate((i) => (window as unknown as { __ew: Ew }).__ew.select(i), a);
  await page.locator('#card-actions button', { hasText: 'Share this flower' }).click();
  await expect(page.locator('#card-body .note')).toContainText('/?bloom=', { timeout: 30_000 });
  expect(problems).toEqual([]);
});

test('the greenhouse: grows and breeds with no storage at all, and from a garden kept wrong', async ({ page }) => {
  test.setTimeout(300_000);
  await page.setViewportSize({ width: 1280, height: 800 });
  const problems = watch(page);
  // Storage that refuses everything (a locked-down browser): the garden still grows this visit.
  await page.addInitScript(() => {
    for (const k of ['getItem', 'setItem', 'removeItem'] as const)
      Storage.prototype[k] = () => {
        throw new DOMException('No storage here', 'SecurityError');
      };
  });
  await page.goto('/?shot=staging&full&world=greenhouse');
  await page.waitForFunction(() => 'garden' in ((window as unknown as { __ew?: object }).__ew ?? {}), null, { timeout: 120_000 });
  expect(await ew(page, (w) => w.garden().pots.filter(Boolean).length)).toBe(8);
  await ew(page, (w) => w.speed(20));
  const pots = await ew(page, (w) => w.garden().pots.map((p: Ew | null, i: number) => (p ? i : -1)).filter((i: number) => i >= 0));
  await page.evaluate(([a, b]) => (window as unknown as { __ew: Ew }).__ew.breed(a, b), [pots[0], pots[1]]);
  expect(await ew(page, (w) => w.garden().crosses)).toBe(1);
  expect(problems).toEqual([]);
});

/**
 * Where points land on screen, and which of them are off the picture, behind
 * the letterbox's bars or under the card: run in the page, for the pots (by
 * slot) or for any world points.
 */
const hidden = (page: Page, slots: number[], extra: number[][] = []) =>
  page.evaluate(
    ([slots, extra]) => {
      const w = (window as unknown as { __ew: Ew }).__ew;
      const canvas = document.querySelector('#scene canvas')!.getBoundingClientRect();
      const bar = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--bar')) || 0;
      const card = document.getElementById('card')!;
      const shown = !card.hidden && !document.body.classList.contains('tucked') && getComputedStyle(card).display !== 'none';
      const r = shown ? card.getBoundingClientRect() : null;
      const at = w.camera.position.clone();
      const pts: [string, unknown][] = [
        ...slots.map((i): [string, unknown] => {
          const m = w.flowers.pick[i];
          return [`pot ${i + 1}`, at.clone().set(m.position.x, m.position.y - m.scale.y / 2 + 0.09, m.position.z)];
        }),
        ...extra.map((p, k): [string, unknown] => [`point ${k}`, at.clone().set(p[0], p[1], p[2])]),
      ];
      const out: string[] = [];
      for (const [name, p] of pts) {
        const q = (p as { project(c: unknown): { x: number; y: number; z: number } }).project(w.camera);
        const x = canvas.left + ((q.x + 1) / 2) * canvas.width;
        const y = canvas.top + ((1 - q.y) / 2) * canvas.height;
        if (q.z > 1 || x < canvas.left || x > canvas.right || y < canvas.top + bar || y > canvas.bottom - bar) out.push(`${name} off the picture at ${Math.round(x)},${Math.round(y)}`);
        else if (r && x > r.left && x < r.right && y > r.top && y < r.bottom) out.push(`${name} under the card at ${Math.round(x)},${Math.round(y)}`);
      }
      return out;
    },
    [slots, extra] as const,
  );

test('the greenhouse: every pot clear of the card at any window shape, and after a cross the camera goes to watch the seed come up', async ({ page }) => {
  test.setTimeout(420_000);
  const problems = watch(page);
  await fresh(page);
  const all = Array.from({ length: 16 }, (_, i) => i);
  for (const [width, height] of [
    [1440, 900],
    [900, 900],
    [1100, 1250],
    [800, 1000],
  ]) {
    await page.setViewportSize({ width, height });
    await page.goto('/?shot=staging&full&world=greenhouse');
    await page.waitForFunction(() => 'garden' in ((window as unknown as { __ew?: object }).__ew ?? {}), null, { timeout: 120_000 });
    await expect(page.locator('#card-title')).toHaveText('Breed a flower', { timeout: 60_000 });
    await settled(page);
    expect(await hidden(page, all), `the staging at ${width}x${height}`).toEqual([]);
    // With the card tucked away, the picture slides back to the middle and every pot is still in it.
    await page.locator('#card .tuck').click();
    await page.waitForFunction(() => !(window as unknown as { __ew: Ew }).__ew.camera.view?.enabled, null, { timeout: 30_000 });
    await page.waitForTimeout(500);
    expect(await hidden(page, all), `the staging at ${width}x${height}, card hidden`).toEqual([]);
    await page.locator('#untuck').click();
  }

  // At 900x900: a cross, and the camera goes to the pot the seed went into, clear of the card.
  await page.setViewportSize({ width: 900, height: 900 });
  await page.goto('/?shot=staging&full&world=greenhouse');
  await page.waitForFunction(() => 'garden' in ((window as unknown as { __ew?: object }).__ew ?? {}), null, { timeout: 120_000 });
  await expect(page.locator('#card-title')).toHaveText('Breed a flower', { timeout: 60_000 });
  await settled(page);
  // Slow enough to watch: about five seconds from seed to flower.
  await ew(page, (w) => w.speed(4));
  // And on the way there and back, the camera never inside anything.
  await ew(page, (w) => {
    w.inside = [] as string[];
    const look = () => {
      if (w.solid(w.camera.position)) w.inside.push(`${w.rig.current} ${w.camera.position.toArray().map((x: number) => x.toFixed(2))}`);
      requestAnimationFrame(look);
    };
    look();
  });
  const [a, b] = await ew(page, (w) => w.garden().pots.map((p: Ew | null, i: number) => (p ? i : -1)).filter((i: number) => i >= 0));
  const next = await ew(page, (w) => w.nextPot() as number);
  // The first pot a seed goes into is in the near row, at the end by the potting bench.
  expect(next).toBe(6);
  await page.evaluate(([a, b]) => void (window as unknown as { __ew: Ew }).__ew.breed(a, b), [a, b]);
  await page.waitForFunction(() => (window as unknown as { __ew: Ew }).__ew.rig.current === 'grow', null, { timeout: 60_000 });
  await settled(page);
  expect(await ew(page, (w) => w.growing())).toBe(next);
  await expect(page.locator('#card-kicker')).toContainText(new RegExp(`pot ${next + 1}\\b`, 'i'), { timeout: 30_000 });
  expect(await hidden(page, [next]), 'the new pot, while it grows').toEqual([]);
  // Once it opens: what it is, the flower still clear of the card.
  await expect(page.locator('#card-kicker')).toContainText('Just opened', { timeout: 60_000 });
  await expect(page.locator('#card-actions button', { hasText: 'Share it' })).toBeVisible();
  const bloom = await ew(page, (w) => w.flowers.blooms(w.growing()).map((b: { at: { x: number; y: number; z: number } }) => [b.at.x, b.at.y, b.at.z]));
  expect(await hidden(page, [next], bloom), 'the new flower, open').toEqual([]);
  // Esc steps back to the staging.
  await page.keyboard.press('Escape');
  await settled(page);
  expect(await current(page)).toBe('staging');
  expect(await ew(page, (w) => w.inside)).toEqual([]);

  // Leaving while it grows: nothing about it turns up anywhere else.
  const [c, d] = await ew(page, (w) => w.garden().pots.map((p: Ew | null, i: number) => (p && i !== w.growing() ? i : -1)).filter((i: number) => i >= 0));
  await ew(page, (w) => w.speed(1));
  await page.evaluate(([c, d]) => void (window as unknown as { __ew: Ew }).__ew.breed(c, d), [c, d]);
  await page.waitForFunction(() => (window as unknown as { __ew: Ew }).__ew.rig.current === 'grow', null, { timeout: 60_000 });
  await page.keyboard.press('ArrowRight');
  await settled(page);
  expect(await current(page)).toBe('desk');
  await ew(page, (w) => w.speed(20));
  await page.waitForTimeout(3000);
  expect(await current(page)).toBe('desk');
  await expect(page.locator('#card-kicker')).not.toContainText('Just opened');
  expect(problems).toEqual([]);
});
