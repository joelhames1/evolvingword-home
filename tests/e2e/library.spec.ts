import { expect, test, type Page } from '@playwright/test';

/** Fails the test on any page error, console error or CSP violation. */
function watch(page: Page) {
  const problems: string[] = [];
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    // WebGL reports failed draws as warnings, but they're bugs: something didn't render.
    if (m.type() === 'error' || /GL_INVALID|WebGL: INVALID/.test(m.text())) problems.push(`console: ${m.text()}`);
  });
  return problems;
}

type Ew = Record<string, any>;

test('the library: picked from the globes, the book over the well, and the studio gallery by gallery', async ({ page }) => {
  test.setTimeout(240_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  const problems = watch(page);
  await page.goto('/?full&worlds=all');
  await page.getByRole('button', { name: /The Library/ }).click();
  await expect(page.locator('body')).toHaveClass(/inside/, { timeout: 90_000 });
  expect(await page.evaluate(() => (window as unknown as { __ew: Ew }).__ew.worldId)).toBe('library');

  // The book breeds words out of its noise; the library goes on in every direction.
  await page.waitForFunction(() => (window as unknown as { __ew: Ew }).__ew.flap.evolution().generation > 3, null, { timeout: 30_000 });
  const own = await page.evaluate(() => {
    const w = (window as unknown as { __ew: Ew }).__ew;
    return {
      book: w.book.group.isGroup,
      target: w.flap.evolution().target,
      galleries: w.galleries() >= 15,
      shelves: w.hall.slots.length > 200,
      // Every walk between two places on the tour goes through the arches, not the stone.
      blocked: w.blocked(),
    };
  });
  expect(own).toEqual({ book: true, target: 'EVOLVING WORD', galleries: true, shelves: true, blocked: [] });
  await expect(page.locator('body')).toHaveClass(/ready/, { timeout: 60_000 });

  // Its own music and air: the organ, the voices, a footstep on the stair, a page turning.
  await page.evaluate(() => {
    const w = (window as unknown as { __ew: Ew }).__ew;
    if (!w.sound.started) w.sound.start();
    w.sound.setMuted(false);
    w.band.footstep(0.5, 0.2);
    w.band.page(0.4);
    w.band.shelve(0.3);
  });
  await page.waitForTimeout(1500);

  const settled = () => page.waitForFunction(() => !(window as unknown as { __ew: Ew }).__ew.rig.moving, null, { timeout: 60_000 });
  const current = () => page.evaluate(() => (window as unknown as { __ew: Ew }).__ew.rig.current);

  // The map, in its own gallery, then back out to the wall it's on.
  await page.keyboard.press('m');
  await expect(page.locator('#card-title')).toHaveText('Places I have been', { timeout: 30_000 });
  await page.keyboard.press('Escape');
  await settled();
  expect(await current()).toBe('places');

  // Gallery to gallery, all the way round.
  for (const next of ['window', 'desk', 'honors', 'library', 'places']) {
    await page.keyboard.press('ArrowRight');
    await settled();
    expect(await current()).toBe(next);
  }
  await page.keyboard.press('ArrowLeft');
  await settled();
  expect(await current()).toBe('library');

  await page.keyboard.press('b');
  await expect(page.locator('#card-title')).toHaveText('Take one down', { timeout: 30_000 });

  // The software renderer is slow here, so the offer of the simple page has come up since the way in.
  await expect(page.locator('#slow')).toBeVisible({ timeout: 20_000 });
  await page.locator('#slow-stay').click();

  // Back to the globes: this one is marked as where you were.
  // (Until the owner shows its globe, only ?worlds=all has one for it.)
  await page.locator('#worlds-btn').click();
  await expect(page.locator('#chooser')).toBeVisible();
  await page.goto('/?full&worlds=all');
  await expect(page.locator('.globe-wrap.world-library .last')).toHaveText('Where you were last time');
  expect(problems).toEqual([]);
});

test('the library: a phrase of your own, bred on a fresh page', async ({ page }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1280, height: 800 });
  const problems = watch(page);
  await page.goto('/?shot=desk&full&world=library');
  await page.waitForFunction(() => 'world' in ((window as unknown as { __ew?: object }).__ew ?? {}));
  const turns = await page.evaluate(() => (window as unknown as { __ew: Ew }).__ew.book.turns());
  await page.keyboard.press('e');
  await page.waitForFunction(() => (window as unknown as { __ew: Ew }).__ew.terminal.page() === 'evolve', null, { timeout: 30_000 });
  await page.keyboard.type('read me');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => (window as unknown as { __ew: Ew }).__ew.rig.current === 'board');
  const done = await page.waitForFunction(
    () => {
      const e = (window as unknown as { __ew: Ew }).__ew.flap.evolution();
      return e.custom && e.done ? e.target : null;
    },
    null,
    { timeout: 120_000 },
  );
  expect((await done.jsonValue())?.trim()).toBe('READ ME');
  // The leaf turned for it.
  expect(await page.evaluate(() => (window as unknown as { __ew: Ew }).__ew.book.turns())).toBe(turns + 1);
  await expect(page.locator('#hints')).toContainText('GENERATIONS', { timeout: 10_000 });
  expect(problems).toEqual([]);
});

test('the library: every shirt on the line from open floor, however you go back and forth', async ({ page }) => {
  test.setTimeout(240_000);
  await page.setViewportSize({ width: 1280, height: 800 });
  const problems = watch(page);
  await page.goto('/?shot=desk&full&world=library');
  await page.waitForFunction(() => 'world' in ((window as unknown as { __ew?: object }).__ew ?? {}));
  // Watch the camera every frame: it must never be inside stone, on the way or at a stop.
  await page.evaluate(() => {
    const w = (window as unknown as { __ew: Ew }).__ew;
    w.inStone = [] as string[];
    const look = () => {
      if (w.solid(w.camera.position)) w.inStone.push(`${w.rig.current} ${w.camera.position.toArray().map((x: number) => x.toFixed(2))}`);
      requestAnimationFrame(look);
    };
    look();
  });
  const settled = () => page.waitForFunction(() => !(window as unknown as { __ew: Ew }).__ew.rig.moving, null, { timeout: 60_000 });
  /** Where the camera stopped: in open floor with room round it, near the shirt and looking at it. */
  const stop = () =>
    page.evaluate(() => {
      const w = (window as unknown as { __ew: Ew }).__ew;
      const shirt = w.line.items.find((it: Ew) => it.project.title === document.getElementById('project-title')!.textContent).focus;
      const to = shirt.clone().sub(w.camera.position);
      const ahead = w.camera.getWorldDirection(shirt.clone());
      return { shot: w.rig.current, roomy: w.roomy(w.camera.position), near: to.length() > 1.2 && to.length() < 2.6, facing: to.normalize().dot(ahead) > 0.97 };
    });
  const good = { shot: 'projects', roomy: true, near: true, facing: true };
  const count = await page.evaluate(() => (window as unknown as { __ew: Ew }).__ew.line.items.length);
  await page.keyboard.press('1');
  await settled();
  expect(await stop()).toEqual(good);
  // Along the whole line and round again, then back.
  for (let i = 0; i < count + 1; i++) {
    await page.keyboard.press('ArrowRight');
    await settled();
    expect(await stop()).toEqual(good);
  }
  for (let i = 0; i < count; i++) {
    await page.locator('#project-prev').click();
    await settled();
    expect(await stop()).toEqual(good);
  }
  // Impatient: out, in again from the reading room and on before arriving, back and forth mid-flight.
  for (const keys of [['Escape', 'Escape', '1', 'ArrowRight'], ['w', '1', 'ArrowLeft', 'ArrowRight', 'ArrowRight'], ['b', '1', 'ArrowLeft']]) {
    for (const k of keys) {
      await page.keyboard.press(k);
      await page.waitForTimeout(250);
    }
    await settled();
    expect(await stop()).toEqual(good);
  }
  expect(await page.evaluate(() => (window as unknown as { __ew: Ew }).__ew.inStone)).toEqual([]);
  expect(problems).toEqual([]);
});
