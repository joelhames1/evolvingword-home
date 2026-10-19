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

test('desktop: the globes, the dive, the flight in, and the rooms', async ({ page }) => {
  test.setTimeout(150_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  const problems = watch(page);
  const res = await page.goto('/');
  expect(res?.headers()['content-security-policy']).toContain("default-src 'self'");

  // A globe for each world; the plain page stays in the document for screen
  // readers, clipped to nothing on screen.
  await expect(page.locator('#chooser .globe-wrap')).toHaveCount(2);
  expect((await page.locator('#plain').boundingBox())?.width ?? 0).toBeLessThanOrEqual(1);
  await page.locator('#chooser-sound').click();
  await expect(page.locator('#chooser-sound')).toHaveAttribute('aria-pressed', 'false');
  await page.getByRole('button', { name: /The Lake House/ }).click();
  await expect(page.locator('#chooser')).toHaveClass(/picked/);
  // The loading screen comes up during the dive and goes once the world is built
  // (which, on the software renderer the tests use, takes a while).
  await expect(page.locator('#gate')).toHaveClass(/gone/, { timeout: 80_000 });
  expect(await page.evaluate(() => (window as unknown as { __ew: { worldId: string } }).__ew.worldId)).toBe('alps');
  // The letterbox closes in and the captions start.
  await expect(page.locator('body')).toHaveClass(/inside/);
  await expect(page.locator('body')).toHaveClass(/ready/, { timeout: 40_000 });
  const bar = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--bar'));
  expect(parseFloat(bar)).toBeGreaterThan(40);

  await page.locator('nav button[data-go="projects"]').click();
  await expect(page.locator('#project')).toBeVisible({ timeout: 20_000 });
  await expect(page.locator('#project-title')).toHaveText('Our Studio');
  await expect(page.locator('#project-open')).toHaveAttribute('href', 'https://studio.evolvingword.com');

  await page.keyboard.press('2');
  await expect(page.locator('#about')).toBeVisible({ timeout: 20_000 });
  await expect(page.locator('#project')).toBeHidden();

  await page.locator('#credits-btn').click();
  await expect(page.locator('#credits')).toBeVisible();
  await page.locator('#credits-close').click();
  await expect(page.locator('#credits')).toBeHidden();

  expect(problems).toEqual([]);
});

test('evolving a word: type on the CRT, watch the board breed it', async ({ page }) => {
  test.setTimeout(150_000);
  await page.setViewportSize({ width: 1280, height: 800 });
  const problems = watch(page);
  await page.goto('/?shot=desk&full');
  await page.waitForFunction(() => 'world' in ((window as unknown as { __ew?: object }).__ew ?? {}));
  await page.keyboard.press('e');
  await page.waitForFunction(() => (window as unknown as { __ew: { terminal: { page(): string } } }).__ew.terminal.page() === 'evolve', null, { timeout: 30_000 });
  await page.keyboard.type('hello 31');
  await page.keyboard.press('Enter');
  await expect(page.locator('#hints')).toContainText('HELLO 31', { timeout: 10_000 });
  // The camera turns up to the board over the window.
  await page.waitForFunction(() => (window as unknown as { __ew: { rig: { current: string } } }).__ew.rig.current === 'board');
  const done = await page.waitForFunction(
    () => {
      const e = (window as unknown as { __ew: { flap: { evolution(): { done: boolean; target: string; custom: boolean } } } }).__ew.flap.evolution();
      return e.custom && e.done ? e.target : null;
    },
    null,
    { timeout: 100_000 },
  );
  expect((await done.jsonValue())?.trim()).toBe('HELLO 31');
  await expect(page.locator('#hints')).toContainText('GENERATIONS', { timeout: 10_000 });
  expect(problems).toEqual([]);
});

type Ew = {
  rig: { current: string; moving: boolean };
  goTo(name: string): void;
  watch: { press(b: 'start' | 'reset'): boolean; elapsed(): number };
  pad: { next(): string; writing(): boolean };
  treats: { discs: unknown[]; eat(d: unknown): number; left(): number; sip(): number; sipsLeft(): number };
  rolodex: { flip(dir?: 1 | -1): number; index(): number };
  map: { countryAt(u: number, v: number): string | null; visited(): number };
  reader: { isOpen(): boolean };
};

test('the things on the desk and walls', async ({ page }) => {
  test.setTimeout(150_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  const problems = watch(page);
  await page.goto('/?shot=desk&full');
  await page.waitForFunction(() => 'world' in ((window as unknown as { __ew?: object }).__ew ?? {}));
  const ew = <T,>(fn: (w: Ew) => T) => page.evaluate(`(${fn.toString()})(window.__ew)`) as Promise<T>;

  // The watch: start the chronograph, and it runs.
  expect(await ew((w) => w.watch.press('start'))).toBe(true);
  await page.waitForTimeout(1500);
  expect(await ew((w) => w.watch.elapsed())).toBeGreaterThan(0);
  await ew((w) => (w.watch.press('start'), w.watch.press('reset')));
  expect(await ew((w) => w.watch.elapsed())).toBe(0);

  // Chocolate disappears; the cappuccino goes down.
  const before = await ew((w) => w.treats.left());
  expect(await ew((w) => w.treats.eat(w.treats.discs[0]))).toBe(before - 1);
  expect(await ew((w) => w.treats.sip())).toBe(2);

  // The pen starts a poem; the Rolodex turns.
  expect(await ew((w) => w.pad.next())).toBeTruthy();
  expect(await ew((w) => w.pad.writing())).toBe(true);
  expect(await ew((w) => w.rolodex.flip(1))).toBe(1);

  // The map knows where things are, and starts with some already scratched.
  expect(await ew((w) => w.map.visited())).toBeGreaterThan(0);
  expect(await ew((w) => w.map.countryAt(0.5, 0.5))).toBeNull();

  // A close-up brings its card; the library opens a book you can page through.
  await page.keyboard.press('m');
  await expect(page.locator('#card-title')).toHaveText('Places I have been', { timeout: 20_000 });
  await page.keyboard.press('b');
  await expect(page.locator('#card-title')).toHaveText('Take one down', { timeout: 20_000 });
  await page.locator('#card-actions button', { hasText: 'Sonnets' }).click();
  await expect(page.locator('#reader')).toBeVisible();
  await expect(page.locator('#reader .page.left')).toContainText('Shakespeare');
  await expect(page.locator('#reader .page.right')).toContainText("summer's day");
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('#reader .page.left')).toContainText('disgrace');
  await page.keyboard.press('Escape');
  await expect(page.locator('#reader')).toBeHidden();
  expect(await ew((w) => w.reader.isOpen())).toBe(false);

  expect(problems).toEqual([]);
});

test('the simple page has everything, and its books open', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 860 });
  const problems = watch(page);
  await page.goto('/?lite');
  await expect(page.locator('#plain')).toBeVisible();
  await expect(page.locator('#plain .q-poems .poem')).toHaveCount(5);
  await expect(page.locator('#plain-medals li')).toHaveCount(4);
  await expect(page.locator('#plain-medals')).toContainText('Los Angeles Marathon');
  await expect(page.locator('#plain-work-list li').first()).toContainText('ParentSquare');
  expect(await page.locator('#plain-map path.been').count()).toBeGreaterThan(20);
  // A long book is fetched when opened, and its contents page jumps to a canto.
  await page.getByRole('button', { name: 'Read Inferno, by Dante Alighieri' }).click();
  await expect(page.locator('#reader')).toBeVisible();
  await expect(page.locator('#reader .page.left')).toContainText('Longfellow');
  await page.locator('#reader .contents button', { hasText: /^Canto I$/ }).click();
  await expect(page.locator('#reader')).toContainText('Midway upon the journey of our life');
  await page.keyboard.press('Escape');
  await expect(page.locator('#reader')).toBeHidden();
  expect(problems).toEqual([]);
});

test('the Simple button switches over, and the choice sticks until you step back in', async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/?shot=desk&full');
  await page.waitForFunction(() => 'world' in ((window as unknown as { __ew?: object }).__ew ?? {}));
  await page.locator('#simple-btn').click();
  await expect(page).toHaveURL(/\?lite/);
  await expect(page.locator('#plain')).toBeVisible();
  await page.goto('/');
  await expect(page.locator('html')).toHaveClass(/lite/);
  await page.locator('#plain-full').click();
  await expect(page).toHaveURL(/\?full/);
  await expect(page.locator('#chooser')).toBeVisible();
  await expect(page.locator('html')).not.toHaveClass(/lite/);
});

test('the night studio: the same room, the city outside, and the choice remembered', async ({ page }) => {
  test.setTimeout(150_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  const problems = watch(page);
  await page.goto('/?full');
  await page.getByRole('button', { name: /Night Studio/ }).click();
  await expect(page.locator('body')).toHaveClass(/inside/, { timeout: 60_000 });
  const ew = () => page.evaluate(() => {
    const w = (window as unknown as { __ew: { worldId: string; flap: { evolution(): { generation: number } }; map: { visited(): number } } }).__ew;
    return { world: w.worldId, generation: w.flap.evolution().generation, visited: w.map.visited() };
  });
  // The billboard across the street is breeding words; the map is on the wall as ever.
  const first = await ew();
  expect(first.world).toBe('city');
  expect(first.visited).toBeGreaterThan(0);
  await page.waitForFunction(() => (window as unknown as { __ew: { flap: { evolution(): { generation: number } } } }).__ew.flap.evolution().generation > 3, null, { timeout: 30_000 });
  await expect(page.locator('body')).toHaveClass(/ready/, { timeout: 60_000 });
  await page.keyboard.press('m');
  await expect(page.locator('#card-title')).toHaveText('Places I have been', { timeout: 20_000 });
  // Back to the globes: the city is marked as where you were.
  await page.locator('#worlds-btn').click();
  await expect(page.locator('#chooser')).toBeVisible();
  await expect(page.locator('.globe-wrap.world-city .last')).toHaveText('Where you were last time');
  expect(problems).toEqual([]);
});

test('phones get the plain page, with the project link', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const problems = watch(page);
  await page.goto('/');
  await expect(page.locator('html')).toHaveClass(/lite/);
  await expect(page.locator('#plain')).toBeVisible();
  await expect(page.locator('#gate')).toBeHidden();
  await expect(page.getByRole('link', { name: /Open Our Studio/ })).toHaveAttribute('href', 'https://studio.evolvingword.com');
  await expect(page.getByRole('link', { name: 'studio@evolvingword.com' })).toBeVisible();
  // Nothing wider than the screen.
  const wide = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(wide).toBeLessThanOrEqual(390);
  expect(problems).toEqual([]);
});

test('reduced motion gets the plain page too', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await expect(page.locator('#plain')).toBeVisible();
});
