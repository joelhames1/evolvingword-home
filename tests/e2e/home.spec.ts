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

test('desktop: the gate, the flight in, and the rooms', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const problems = watch(page);
  const res = await page.goto('/');
  expect(res?.headers()['content-security-policy']).toContain("default-src 'self'");

  await expect(page.locator('#enter')).toBeEnabled({ timeout: 30_000 });
  // The plain page stays in the document for screen readers, clipped to nothing on screen.
  expect((await page.locator('#plain').boundingBox())?.width ?? 0).toBeLessThanOrEqual(1);
  await page.locator('#enter-muted').click();
  await expect(page.locator('#gate')).toHaveClass(/gone/);
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

test('evolving a word: type on the CRT, watch the billboard breed it', async ({ page }) => {
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
  const done = await page.waitForFunction(
    () => {
      const e = (window as unknown as { __ew: { city: { evolution(): { done: boolean; target: string; custom: boolean } } } }).__ew.city.evolution();
      return e.custom && e.done ? e.target : null;
    },
    null,
    { timeout: 100_000 },
  );
  expect(await done.jsonValue()).toBe('HELLO 31');
  await expect(page.locator('#hints')).toContainText('GENERATIONS', { timeout: 10_000 });
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
