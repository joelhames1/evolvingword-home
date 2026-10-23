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
type Win = { __ew: Ew };

/** Watches the camera every frame: it must never be inside a wall or the furniture, on the way or at a stop. */
const watchCamera = (page: Page) =>
  page.evaluate(() => {
    const w = (window as unknown as Win).__ew;
    w.inSolid = [] as string[];
    const look = () => {
      if (w.solid(w.camera.position)) w.inSolid.push(`${w.rig.current} ${w.camera.position.toArray().map((x: number) => x.toFixed(2))}`);
      requestAnimationFrame(look);
    };
    look();
  });

const settled = (page: Page) => page.waitForFunction(() => !(window as unknown as Win).__ew.rig.moving, null, { timeout: 90_000 });
const current = (page: Page) => page.evaluate(() => (window as unknown as Win).__ew.rig.current);
const state = (page: Page) => page.evaluate(() => (window as unknown as Win).__ew.state());

/** Where a point on something in the car is on screen (an offset from its origin, in its own frame), so the mouse can click it for real. */
const onScreen = (page: Page, path: string, offset: [number, number, number] = [0, 0, 0]) =>
  page.evaluate(
    ({ path, offset }) => {
      const w = (window as unknown as Win).__ew;
      const obj = path.split('.').reduce<Ew>((o, k) => o[k], w);
      const p = obj.localToWorld(w.camera.position.clone().set(...offset)).project(w.camera);
      const c = document.querySelector('#scene canvas')!;
      return { x: ((p.x + 1) / 2) * c.clientWidth, y: ((1 - p.y) / 2) * c.clientHeight };
    },
    { path, offset },
  );
const clickOn = async (page: Page, path: string, offset?: [number, number, number]) => {
  const pt = await onScreen(page, path, offset);
  await page.mouse.move(pt.x, pt.y);
  await page.waitForTimeout(1200);
  // The camera leans toward the mouse; on a slow renderer it can still be drifting, so look again.
  const at = await onScreen(page, path, offset);
  await page.mouse.click(at.x, at.y);
};

test('the night train: picked from the globes, the studio in a sleeper, wall by wall', async ({ page }) => {
  test.setTimeout(300_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  const problems = watch(page);
  await page.goto('/?full&worlds=all');
  await page.getByRole('button', { name: /The Night Train/ }).click();
  await page.waitForFunction(() => 'solid' in ((window as unknown as { __ew?: object }).__ew ?? {}), null, { timeout: 90_000 });
  // From the way in on: in through the corridor window and the door, never through the panelling.
  await watchCamera(page);
  await expect(page.locator('body')).toHaveClass(/inside/, { timeout: 90_000 });
  expect(await page.evaluate(() => (window as unknown as Win).__ew.worldId)).toBe('train');

  // The board in the car breeds words; the train's under way on the viaduct; every walk is clear.
  await page.waitForFunction(() => (window as unknown as Win).__ew.flap.evolution().generation > 3, null, { timeout: 30_000 });
  const own = await page.evaluate(() => {
    const w = (window as unknown as Win).__ew;
    const s = w.state();
    return { target: w.flap.evolution().target.trim(), land: s.land, running: s.phase === 'running' && s.v > 1, blocked: w.blocked() };
  });
  expect(own).toEqual({ target: 'EVOLVING WORD', land: 'gorge', running: true, blocked: [] });
  await expect(page.locator('body')).toHaveClass(/ready/, { timeout: 90_000 });
  await settled(page);
  expect(await current(page)).toBe('desk');

  // Its own music and air: the band, the horn echoing off the gorge, the points, the punch.
  await page.evaluate(() => {
    const w = (window as unknown as Win).__ew;
    if (!w.sound.started) w.sound.start();
    w.sound.setMuted(false);
  });
  await page.keyboard.press('h');
  await page.evaluate(() => {
    const w = (window as unknown as Win).__ew;
    w.band.points();
    w.band.punch();
    w.band.chime();
  });
  await page.waitForTimeout(1500);

  // Not too many draws at the table (counted over a whole frame, once counting's switched on).
  await page.waitForFunction(() => (window as unknown as Win).__ew.calls() > 50, null, { timeout: 60_000 });
  expect(await page.evaluate(() => (window as unknown as Win).__ew.calls())).toBeLessThan(400);

  // Wall to wall, all the way round the compartment and out to the corridor.
  for (const next of ['honors', 'corridor', 'places', 'desk']) {
    await page.keyboard.press('ArrowRight');
    await settled(page);
    expect(await current(page)).toBe(next);
  }
  await page.keyboard.press('ArrowLeft');
  await settled(page);
  expect(await current(page)).toBe('places');

  // The map over the bunk, and back to its wall, then the bookshelf by the door.
  await page.keyboard.press('m');
  await expect(page.locator('#card-title')).toHaveText('Places I have been', { timeout: 60_000 });
  await page.keyboard.press('Escape');
  await settled(page);
  expect(await current(page)).toBe('places');
  await page.keyboard.press('b');
  await expect(page.locator('#card-title')).toHaveText('Take one down', { timeout: 60_000 });
  // Esc steps back: to the wall, then to the table.
  await page.keyboard.press('Escape');
  await settled(page);
  expect(await current(page)).toBe('honors');
  await page.keyboard.press('Escape');
  await settled(page);
  expect(await current(page)).toBe('desk');

  // The software renderer is slow here, so the offer of the simple page has come up since the way in.
  await expect(page.locator('#slow')).toBeVisible({ timeout: 20_000 });
  await page.locator('#slow-stay').click();
  expect(await page.evaluate(() => (window as unknown as Win).__ew.inSolid)).toEqual([]);

  // Back to the globes: this one is marked as where you were.
  await page.locator('#worlds-btn').click();
  await expect(page.locator('#chooser')).toBeVisible();
  await page.goto('/?full&worlds=all');
  await expect(page.locator('.globe-wrap.world-train .last')).toHaveText('Where you were last time');
  expect(problems).toEqual([]);
});

test('the night train: the lever picks the line, the brake stops us, the window drops, the ticket punches', async ({ page }) => {
  test.setTimeout(480_000);
  await page.setViewportSize({ width: 1280, height: 800 });
  const problems = watch(page);
  await page.goto('/?shot=desk&full&world=train');
  await page.waitForFunction(() => 'jump' in ((window as unknown as { __ew?: object }).__ew ?? {}), null, { timeout: 90_000 });
  await settled(page);
  // Never through the panelling, nor through glass: out by the door and the corridor window that's let down.
  await watchCamera(page);

  // Out in the fields with a junction coming: the lever's lamp is lit.
  await page.evaluate(() => (window as unknown as Win).__ew.jump('fields', 900));
  await page.waitForFunction(() => (window as unknown as Win).__ew.state().junction.live, null, { timeout: 30_000 });
  const before = (await state(page)).junction;
  expect(before.from).toBe('fields');
  const choice = before.to[before.set ? 0 : 1];
  // Throw it, by clicking it.
  await clickOn(page, 'controls.lever', [0, 0.3, 0.03]);
  await page.waitForFunction((set) => (window as unknown as Win).__ew.state().junction.set !== set, before.set, { timeout: 30_000 });
  expect((await state(page)).junction.by).toBe('you');
  await expect(page.locator('#hints')).toContainText('POINTS SET FOR', { timeout: 10_000 });
  // Run the clock fast: over the points and onto the branch we picked.
  await page.evaluate(() => (window as unknown as Win).__ew.fast(40));
  await page.waitForFunction((land) => (window as unknown as Win).__ew.state().land === land, choice, { timeout: 90_000 });
  await page.evaluate(() => (window as unknown as Win).__ew.fast(1));

  // The emergency brake: a long stop, the stillness, and away again.
  await page.evaluate(() => (window as unknown as Win).__ew.jump('fields', 300, 25));
  await page.evaluate(() => (window as unknown as Win).__ew.goTo('brake'));
  await settled(page);
  await clickOn(page, 'controls.brake');
  await page.waitForFunction(() => (window as unknown as Win).__ew.state().phase === 'braking', null, { timeout: 30_000 });
  // Out by the line to watch the sparks fly: hot streaks off the wheels.
  await settled(page);
  expect(await current(page)).toBe('sparks');
  await page.waitForFunction(() => (window as unknown as Win).__ew.sparksLive() > 10, null, { timeout: 30_000 });
  // Pulling it again while it's stopping does nothing but say so.
  await page.evaluate(() => (window as unknown as Win).__ew.brake());
  await expect(page.locator('#hints')).toContainText('ALREADY STOPPING', { timeout: 10_000 });
  await page.evaluate(() => (window as unknown as Win).__ew.fast(6));
  await page.waitForFunction(() => (window as unknown as Win).__ew.state().phase === 'still', null, { timeout: 90_000 });
  expect((await state(page)).v).toBe(0);
  await page.waitForFunction(
    () => {
      const s = (window as unknown as Win).__ew.state();
      return s.phase === 'running' && s.v > 2;
    },
    null,
    { timeout: 90_000 },
  );
  await page.evaluate(() => (window as unknown as Win).__ew.fast(1));
  // Away again: back in from the line, to the brake where we were.
  await settled(page);
  expect(await current(page)).toBe('brake');
  expect(await page.evaluate(() => (window as unknown as Win).__ew.sparksLive())).toBe(0);

  // In a tunnel there's no room by the line: it's nose to the glass instead.
  await page.evaluate(() => (window as unknown as Win).__ew.jump('pass', 1150, 19));
  await page.evaluate(() => (window as unknown as Win).__ew.brake());
  await settled(page);
  expect(await current(page)).toBe('window');
  await page.evaluate(() => (window as unknown as Win).__ew.fast(8));
  await page.waitForFunction(() => (window as unknown as Win).__ew.state().phase === 'running', null, { timeout: 90_000 });
  await page.evaluate(() => (window as unknown as Win).__ew.fast(1));

  // The window drops open, and goes back up.
  await page.keyboard.press('Escape');
  await settled(page);
  expect(await current(page)).toBe('desk');
  await clickOn(page, 'car.windowHit');
  await page.waitForFunction(() => (window as unknown as Win).__ew.windowOpen() > 0.9, null, { timeout: 60_000 });
  await clickOn(page, 'car.windowHit');
  await page.waitForFunction(() => (window as unknown as Win).__ew.windowOpen() < 0.1, null, { timeout: 60_000 });

  // The ticket: over to it, then a new hole with each click.
  await clickOn(page, 'ticket.mesh');
  await settled(page);
  expect(await current(page)).toBe('ticket');
  const holes = await page.evaluate(() => (window as unknown as Win).__ew.ticket.state().holes.length);
  await clickOn(page, 'ticket.mesh');
  await page.waitForFunction((n) => (window as unknown as Win).__ew.ticket.state().holes.length === n + 1, holes, { timeout: 30_000 });
  // The fields and the branch we took are stamped on it.
  const stamps = await page.evaluate(() => (window as unknown as Win).__ew.ticket.state().stamps);
  expect(stamps).toEqual(expect.arrayContaining(['fields', choice]));
  expect(await page.evaluate(() => (window as unknown as Win).__ew.inSolid)).toEqual([]);
  expect(problems).toEqual([]);
});

test('the night train: every surface out there and in the car has real normals, in every landscape', async ({ page }) => {
  test.setTimeout(240_000);
  await page.setViewportSize({ width: 960, height: 600 });
  const problems = watch(page);
  await page.goto('/?shot=window&full&world=train');
  await page.waitForFunction(() => 'badGeometry' in ((window as unknown as { __ew?: object }).__ew ?? {}), null, { timeout: 90_000 });
  // Each landscape, and the stations, the crossing, the viaduct, the sheds and the tunnel in them.
  for (const [land, at] of [
    ['fields', 820],
    ['gorge', 800],
    ['pass', 400],
    ['pass', 1300],
    ['pass', 2000],
    ['city', 1050],
    ['lake', 1100],
  ] as const) {
    await page.evaluate(({ land, at }) => (window as unknown as Win).__ew.jump(land, at), { land, at });
    await page.waitForTimeout(500);
    expect(await page.evaluate(() => (window as unknown as Win).__ew.badGeometry()), `${land} ${at}`).toEqual([]);
  }
  expect(problems).toEqual([]);
});

test('the night train: a ticket that was tampered with, or no storage at all', async ({ page }) => {
  test.setTimeout(240_000);
  await page.setViewportSize({ width: 960, height: 600 });
  const problems = watch(page);
  // Junk where the ticket's kept: a fresh one, and no errors.
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('ew.test.blocked')) localStorage.setItem('ew.train.ticket', '{"v":1,"holes":[{"x":"<img src=x>","y":1e999}],"stamps":["moon"]}');
  });
  await page.goto('/?shot=ticket&full&world=train');
  await page.waitForFunction(() => 'ticket' in ((window as unknown as { __ew?: object }).__ew ?? {}), null, { timeout: 90_000 });
  const fresh = await page.evaluate(() => (window as unknown as Win).__ew.ticket.state());
  expect(fresh.holes).toEqual([]);
  expect(fresh.stamps.every((s: string) => ['fields', 'gorge', 'pass', 'city', 'lake'].includes(s))).toBe(true);
  // Storage that throws at every touch: the ticket still punches, it just won't remember.
  await page.evaluate(() => sessionStorage.setItem('ew.test.blocked', '1'));
  await page.addInitScript(() => {
    const no = () => {
      throw new DOMException('blocked', 'SecurityError');
    };
    Object.defineProperty(window, 'localStorage', { get: no, configurable: true });
  });
  await page.goto('/?shot=ticket&full&world=train');
  await page.waitForFunction(() => 'ticket' in ((window as unknown as { __ew?: object }).__ew ?? {}), null, { timeout: 90_000 });
  await settled(page);
  expect(await page.evaluate(() => (window as unknown as Win).__ew.punch())).toBe(true);
  expect(await page.evaluate(() => (window as unknown as Win).__ew.ticket.state().holes.length)).toBe(1);
  expect(problems).toEqual([]);
});

test('the night train: into a station, its sign spelling out a word, and away', async ({ page }) => {
  test.setTimeout(240_000);
  await page.setViewportSize({ width: 1280, height: 800 });
  const problems = watch(page);
  await page.goto('/?shot=window&full&world=train');
  await page.waitForFunction(() => 'jump' in ((window as unknown as { __ew?: object }).__ew ?? {}), null, { timeout: 90_000 });
  await settled(page);
  // Into the city, a little way short of the station, and the clock run fast.
  await page.evaluate(() => {
    const w = (window as unknown as Win).__ew;
    w.jump('city', 700, 16);
    w.fast(8);
  });
  await page.waitForFunction(() => (window as unknown as Win).__ew.state().phase === 'dwell', null, { timeout: 120_000 });
  await page.evaluate(() => (window as unknown as Win).__ew.fast(1));
  const at = await page.evaluate(() => {
    const w = (window as unknown as Win).__ew;
    return { v: w.state().v, signs: w.land.signs().length > 0 };
  });
  expect(at).toEqual({ v: 0, signs: true });
  await expect(page.locator('#hints')).toContainText('CENTRAL', { timeout: 20_000 });
  // The sign's split flaps are the word board's: it goes on breeding its phrase.
  const gen = await page.evaluate(() => (window as unknown as Win).__ew.flap.evolution().generation);
  await page.waitForFunction((g) => (window as unknown as Win).__ew.flap.evolution().generation > g, gen, { timeout: 30_000 });
  // And away again.
  await page.evaluate(() => (window as unknown as Win).__ew.fast(8));
  await page.waitForFunction(
    () => {
      const s = (window as unknown as Win).__ew.state();
      return s.phase === 'running' && s.v > 1;
    },
    null,
    { timeout: 120_000 },
  );
  expect(problems).toEqual([]);
});

test('the night train: each kind of station built and lit, its sign by our window, nothing in the way of the train', async ({ page }) => {
  test.setTimeout(240_000);
  await page.setViewportSize({ width: 960, height: 600 });
  const problems = watch(page);
  await page.goto('/?shot=window&full&world=train');
  await page.waitForFunction(() => 'jump' in ((window as unknown as { __ew?: object }).__ew ?? {}), null, { timeout: 90_000 });
  await settled(page);
  for (const [land, at] of [
    ['city', 1050],
    ['lake', 1100],
    ['pass', 2000],
  ] as const) {
    // Standing at the platform, the clock held.
    await page.evaluate(({ land, at }) => {
      const w = (window as unknown as Win).__ew;
      w.jump(land, at, 0);
      w.fast(0);
    }, { land, at });
    await page.waitForTimeout(1500);
    const seen = await page.evaluate(() => {
      const w = (window as unknown as Win).__ew;
      const v = w.camera.position.clone();
      // The sign's flaps, right outside our window.
      const signs = w.land.signs().map((m: Ew) => m.getWorldPosition(v.clone()).toArray().map((n: number) => Math.round(n * 10) / 10));
      // The station's own geometry: how much of it, and whether any of it reaches into the train's way (over the platform's edge, above its top).
      let tris = 0;
      let inTheWay = 0;
      let uniforms: Ew | null = null;
      w.land.group.traverse((o: Ew) => {
        if (!o.isMesh || !o.visible || !o.material?.uniforms?.uAtlas) return;
        uniforms = o.material.uniforms;
        o.updateWorldMatrix(true, false);
        const pos = o.geometry.attributes.position;
        tris += pos.count / 3;
        for (let i = 0; i < pos.count; i++) {
          v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);
          if (v.z > -1.66 && v.y > -0.43 && Math.abs(v.x) < 200) inTheWay++;
        }
      });
      const u = uniforms as Ew | null;
      return { signs, tris, inTheWay, lit: !!u && u.uStation.value.w > 0 && u.uStationLights.value[0].w > 0 };
    });
    expect(seen.signs.length, land).toBeGreaterThan(0);
    expect(seen.signs.some(([x, , z]: number[]) => Math.abs(x - 0.1) < 0.6 && Math.abs(z + 3.05) < 0.2), `${land} sign ${JSON.stringify(seen.signs)}`).toBe(true);
    expect(seen.tris, land).toBeGreaterThan(4000);
    expect(seen.inTheWay, land).toBe(0);
    expect(seen.lit, land).toBe(true);
    expect(await page.evaluate(() => (window as unknown as Win).__ew.badGeometry()), land).toEqual([]);
  }
  // Not too many draws looking out at a station either.
  await page.waitForFunction(() => (window as unknown as Win).__ew.calls() > 50, null, { timeout: 60_000 });
  expect(await page.evaluate(() => (window as unknown as Win).__ew.calls())).toBeLessThan(320);
  expect(problems).toEqual([]);
});

test('the night train: every shirt in the corridor from open floor, however you go back and forth', async ({ page }) => {
  test.setTimeout(300_000);
  await page.setViewportSize({ width: 960, height: 600 });
  const problems = watch(page);
  await page.goto('/?shot=desk&full&world=train');
  await page.waitForFunction(() => 'solid' in ((window as unknown as { __ew?: object }).__ew ?? {}), null, { timeout: 90_000 });
  await watchCamera(page);
  /** Where the camera stopped: in the corridor with room round it, near the shirt and looking at it. */
  const stop = () =>
    page.evaluate(() => {
      const w = (window as unknown as Win).__ew;
      const shirt = w.lineItems().find((it: Ew) => it.project.title === document.getElementById('project-title')!.textContent).focus;
      const to = shirt.clone().sub(w.camera.position);
      const ahead = w.camera.getWorldDirection(shirt.clone());
      return { shot: w.rig.current, roomy: w.roomy(w.camera.position), near: to.length() > 0.6 && to.length() < 1.8, facing: to.normalize().dot(ahead) > 0.97 };
    });
  const good = { shot: 'projects', roomy: true, near: true, facing: true };
  const count = await page.evaluate(() => (window as unknown as Win).__ew.lineItems().length);
  await settled(page);
  await page.keyboard.press('1');
  await settled(page);
  expect(await stop()).toEqual(good);
  // Along the whole rail and round again, then back.
  for (let i = 0; i < count + 1; i++) {
    await page.keyboard.press('ArrowRight');
    await settled(page);
    expect(await stop()).toEqual(good);
  }
  for (let i = 0; i < 2; i++) {
    await page.locator('#project-prev').click();
    await settled(page);
    expect(await stop()).toEqual(good);
  }
  // Impatient: out, in again from the window and on before arriving, back and forth mid-flight.
  for (const keys of [['Escape', 'Escape', '1', 'ArrowRight'], ['w', '1', 'ArrowLeft', 'ArrowRight', 'ArrowRight'], ['m', '1', 'ArrowLeft']]) {
    for (const k of keys) {
      await page.keyboard.press(k);
      await page.waitForTimeout(250);
    }
    await settled(page);
    expect(await stop()).toEqual(good);
  }
  expect(await page.evaluate(() => (window as unknown as Win).__ew.inSolid)).toEqual([]);
  expect(problems).toEqual([]);
});
