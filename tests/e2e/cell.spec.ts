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
  test.setTimeout(480_000);
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
  // The globes the owner shows may not include this one yet; with all of them showing, it's marked.
  await page.goto('/?full&worlds=all');
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

test('the living word: no surface without a normal, and no flight through a column or the nucleus', async ({ page }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1280, height: 800 });
  const problems = watch(page);
  await page.goto('/?shot=desk&full&world=cell');
  await page.waitForFunction(() => 'world' in ((window as unknown as { __ew?: object }).__ew ?? {}));
  // A vertex with no normal shades as NaN, and a NaN flashes black.
  const zero = await page.evaluate(() => {
    const w = (window as unknown as { __ew: EW }).__ew;
    let n = 0;
    w.world.scene.traverse((o: EW) => {
      const a = o.geometry?.attributes?.normal;
      if (a) for (let i = 0; i < a.count; i++) if (!(Math.hypot(a.getX(i), a.getY(i), a.getZ(i)) > 1e-6)) n++;
    });
    return n;
  });
  expect(zero).toBe(0);
  // Every flight between the stops and close-ups keeps clear of the columns, and in
  // and out of the nucleus goes by its door.
  const bad = await page.evaluate(() => {
    const w = (window as unknown as { __ew: EW }).__ew;
    const V = w.camera.position.constructor;
    const shots: Record<string, EW> = w.shots;
    const names = ['desk', 'signal', 'watch', 'honors', 'diplomas', 'medals', 'library', 'places', 'map', 'works', 'track', 'shoes', 'window', 'board'];
    const out: string[] = [];
    for (const a of names)
      for (const b of names) {
        if (a === b) continue;
        const via = w.kit.route(shots[a].pos.clone(), shots[b].pos.clone()) ?? [];
        const pts = [shots[a].pos, ...via, shots[b].pos];
        for (let i = 1; i < pts.length; i++)
          for (let k = 0; k <= 40; k++) {
            const p = new V().lerpVectors(pts[i - 1], pts[i], k / 40);
            for (const c of w.columns) if (Math.hypot(p.x - c.x, p.z - c.z) < 0.25) out.push(`${a} -> ${b} by a column`);
            // Through the envelope only near the library's own door.
            const r = p.distanceTo(w.nucleus.center);
            if (Math.abs(r - w.nucleus.radius) < 0.05 && a !== 'library' && b !== 'library') out.push(`${a} -> ${b} through the nucleus`);
          }
      }
    return [...new Set(out)];
  });
  expect(bad).toEqual([]);
  expect(problems).toEqual([]);
});
