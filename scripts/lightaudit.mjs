// Screenshot the desk with each light switched off in turn: node scripts/lightaudit.mjs <outdir>
import fs from 'node:fs';
import { chromium } from '@playwright/test';
const out = process.argv[2] ?? 'shots/audit';
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 800, height: 500 } });
await page.goto(process.argv[3] ?? 'http://localhost:5180/?shot=desk&full');
await page.waitForTimeout(5000);
const lights = await page.evaluate(() => {
  const L = [];
  window.__ew.world.scene.traverse((o) => o.isLight && L.push(`${o.type}:${o.color.getHexString()}`));
  return L;
});
await page.screenshot({ path: `${out}/all.png` });
for (let i = 0; i < lights.length; i++) {
  await page.evaluate((i) => {
    let k = 0;
    window.__ew.world.scene.traverse((o) => o.isLight && (o.visible = k++ !== i));
  }, i);
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${out}/off-${i}.png` });
}
console.log(lights.map((l, i) => `${i} ${l}`).join('\n'));
await browser.close();
