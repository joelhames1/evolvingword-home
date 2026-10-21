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

test('the heavens: picked from the globes, the dome, the sky, the telescope, and the whole studio inside', async ({ page }) => {
  test.setTimeout(240_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  const problems = watch(page);
  await page.goto('/?full&worlds=all');
  await page.getByRole('button', { name: /The Heavens/ }).click();
  await expect(page.locator('body')).toHaveClass(/inside/, { timeout: 90_000 });
  expect(await page.evaluate(() => (window as unknown as { __ew: Ew }).__ew.worldId)).toBe('heavens');

  // Its board breeds words in the stars; its own things are there.
  await page.waitForFunction(() => (window as unknown as { __ew: Ew }).__ew.flap.evolution().generation > 3, null, { timeout: 30_000 });
  const own = await page.evaluate(() => {
    const w = (window as unknown as { __ew: Ew }).__ew;
    return {
      stars: w.sky.stars > 1000,
      books: w.observatory.books > 100,
      dome: typeof w.domeAz() === 'number',
      telescope: w.telescope.group.children.length > 0,
      letters: w.stars.group.visible !== undefined,
    };
  });
  expect(own).toEqual({ stars: true, books: true, dome: true, telescope: true, letters: true });
  await expect(page.locator('body')).toHaveClass(/ready/, { timeout: 60_000 });

  // The world's sound runs: the band, the wind, the dome's motor and a meteor's chime.
  await page.evaluate(() => {
    const w = (window as unknown as { __ew: Ew }).__ew;
    if (!w.sound.started) w.sound.start();
    w.sound.setMuted(false);
    w.kit.band.motor(1);
    w.kit.band.meteor();
    w.sky.meteor(w.camera);
  });
  await page.waitForTimeout(1500);
  await page.evaluate(() => (window as unknown as { __ew: Ew }).__ew.kit.band.motor(0));

  const settled = () => page.waitForFunction(() => !(window as unknown as { __ew: Ew }).__ew.rig.moving, null, { timeout: 60_000 });
  const current = () => page.evaluate(() => (window as unknown as { __ew: Ew }).__ew.rig.current);

  // The map, on its easel; Esc steps back to its station.
  await page.keyboard.press('m');
  await expect(page.locator('#card-title')).toHaveText('Places I have been', { timeout: 20_000 });
  await page.keyboard.press('Escape');
  await settled();
  expect(await current()).toBe('places');

  // Round the room: every station in turn, the dome turning with you, back to the map.
  for (const station of ['desk', 'honors', 'library', 'scope', 'places']) {
    await page.keyboard.press('ArrowRight');
    await settled();
    expect(await current()).toBe(station);
  }

  // The library.
  await page.keyboard.press('b');
  await expect(page.locator('#card-title')).toHaveText('Take one down', { timeout: 20_000 });

  // The telescope: it swings to Saturn and you look through it; then on to Jupiter.
  await page.evaluate(() => (window as unknown as { __ew: Ew }).__ew.goTo('scope'));
  await settled();
  await expect(page.locator('#card-title')).toHaveText('Have a look', { timeout: 20_000 });
  await page.evaluate(() => (window as unknown as { __ew: Ew }).__ew.telescope.look());
  await page.waitForFunction(() => (window as unknown as { __ew: Ew }).__ew.rig.current === 'eyepiece', null, { timeout: 60_000 });
  await settled();
  await expect(page.locator('#card-title')).toHaveText('Saturn', { timeout: 20_000 });
  expect(await page.evaluate(() => (window as unknown as { __ew: Ew }).__ew.telescope.view.isOpen())).toBe(true);
  await page.locator('#card-actions button', { hasText: 'Next' }).click();
  await expect(page.locator('#card-title')).toHaveText('Jupiter');
  await page.keyboard.press('Escape');
  await settled();
  expect(await current()).toBe('scope');
  expect(await page.evaluate(() => (window as unknown as { __ew: Ew }).__ew.telescope.view.isOpen())).toBe(false);

  // Back to the globes: this one is marked as where you were.
  await page.locator('#worlds-btn').click();
  await expect(page.locator('#chooser')).toBeVisible();
  await expect(page.locator('.globe-wrap.world-heavens .last')).toHaveText('Where you were last time');
  expect(problems).toEqual([]);
});
