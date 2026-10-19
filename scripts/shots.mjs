// Screenshots of each shot, for checking the look. node scripts/shots.mjs <outdir> [base] [shots...]
import fs from 'node:fs';
import { chromium } from '@playwright/test';
const [out = 'shots', base = 'http://localhost:5180', ...names] = process.argv.slice(2);
const list = names.length ? names : ['gate', 'desk', 'window', 'board', 'projects', 'about', 'signal', 'watch', 'pad', 'treats', 'work', 'map', 'diplomas', 'medals', 'library', 'shoes'];
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({
  executablePath: fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined,
  args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => (m.type() === 'error' || /GL_INVALID/.test(m.text())) && errors.push(m.text()));
for (const name of list) {
  await page.goto(`${base}/${name === 'gate' ? '' : `?shot=${name}&full`}`.replace('/?', '/?') + (name === 'gate' ? '?full' : ''));
  await page.waitForTimeout(name === 'gate' ? 9000 : 9000);
  await page.screenshot({ path: `${out}/${name}.png` });
  console.log('shot', name);
}
console.log('errors:', JSON.stringify(errors.slice(0, 10)));
await browser.close();
