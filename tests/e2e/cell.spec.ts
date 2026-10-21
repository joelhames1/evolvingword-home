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

type EW = Record<string, any>;

test('the living word: picked from the globes, its strand and its cell, and the studio spread through it', async ({ page }) => {
  test.setTimeout(240_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  const problems = watch(page);
  await page.goto('/?full&worlds=all');
  await page.getByRole('button', { name: /The Living Word/ }).click();
  await expect(page.locator('body')).toHaveClass(/inside/, { timeout: 90_000 });
  expect(await page.evaluate(() => (window as unknown as { __ew: EW }).__ew.worldId)).toBe('cell');
  // The strand breeds words; the cell's own things are there.
  await page.waitForFunction(() => (window as unknown as { __ew: EW }).__ew.flap.evolution().generation > 3, null, { timeout: 30_000 });
  const own = await page.evaluate(() => {
    const w = (window as unknown as { __ew: EW }).__ew;
    return {
      nucleus: w.nucleus.radius > 0,
      strand: w.helix.group.children.length > 0,
      mitochondria: w.mitos.length,
      walking: typeof w.kinesin.progress() === 'number',
      stops: Object.keys(w.stops).sort(),
    };
  });
  expect(own).toEqual({ nucleus: true, strand: true, mitochondria: expect.any(Number), walking: true, stops: ['honors', 'library', 'line', 'map', 'track'] });
  expect(own.mitochondria).toBeGreaterThan(2);
  await expect(page.locator('body')).toHaveClass(/ready/, { timeout: 60_000 });
  // Its band and its weather run.
  await page.evaluate(() => {
    const s = (window as unknown as { __ew: EW }).__ew.sound;
    if (!s.started) s.start();
    s.setMuted(false);
  });
  await page.waitForTimeout(2500);
  expect(await page.evaluate(() => (window as unknown as { __ew: EW }).__ew.sound.started)).toBe(true);

  // The map on the cell wall, then back to its stop.
  await page.keyboard.press('m');
  await expect(page.locator('#card-title')).toHaveText('Places I have been', { timeout: 20_000 });
  const settled = () => page.waitForFunction(() => !(window as unknown as { __ew: EW }).__ew.rig.moving, null, { timeout: 60_000 });
  const current = () => page.evaluate(() => (window as unknown as { __ew: EW }).__ew.rig.current as string);
  await page.keyboard.press('Escape');
  await settled();
  expect(await current()).toBe('places');
  await page.keyboard.press('Escape');
  await settled();
  expect(await current()).toBe('desk');
  // Round every stop and back to the desk.
  for (const stop of ['honors', 'library', 'places', 'works', 'track', 'desk']) {
    await page.keyboard.press('ArrowRight');
    await settled();
    expect(await current()).toBe(stop);
  }
  // And the other way, a step.
  await page.keyboard.press('ArrowLeft');
  await settled();
  expect(await current()).toBe('track');
  await page.keyboard.press('b');
  await expect(page.locator('#card-title')).toHaveText('Take one down', { timeout: 20_000 });
  // Back to the globes: this one is marked as where you were.
  await page.locator('#worlds-btn').click();
  await expect(page.locator('#chooser')).toBeVisible();
  await expect(page.locator('.globe-wrap.world-cell .last')).toHaveText('Where you were last time');
  expect(problems).toEqual([]);
});

test('the living word: every close-up is there, and the shoes and the projects step back to their stops', async ({ page }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1280, height: 800 });
  const problems = watch(page);
  await page.goto('/?shot=desk&full&world=cell');
  await page.waitForFunction(() => 'world' in ((window as unknown as { __ew?: object }).__ew ?? {}));
  const shots = await page.evaluate(() => Object.keys((window as unknown as { __ew: EW }).__ew.kit.shots));
  expect(shots.sort()).toEqual(['board', 'vista', 'window']);
  const settled = () => page.waitForFunction(() => !(window as unknown as { __ew: EW }).__ew.rig.moving, null, { timeout: 60_000 });
  const current = () => page.evaluate(() => (window as unknown as { __ew: EW }).__ew.rig.current as string);
  for (const [key, shot, back] of [
    ['1', 'projects', 'works'],
    ['w', 'window', 'desk'],
  ] as const) {
    await page.keyboard.press(key);
    await settled();
    expect(await current()).toBe(shot);
    await page.keyboard.press('Escape');
    await settled();
    expect(await current()).toBe(back);
  }
  await expect(page.locator('#project')).toBeHidden();
  // The shoes, clicked from their stop.
  await page.evaluate(() => (window as unknown as { __ew: EW }).__ew.goTo('shoes'));
  await expect(page.locator('#card')).toBeVisible({ timeout: 20_000 });
  await page.keyboard.press('Escape');
  await settled();
  expect(await current()).toBe('track');
  expect(problems).toEqual([]);
});
