// The link-preview image: a still of the scene with the interface hidden.
// node scripts/og.mjs <shot> <out.png> [base]   (then save it as public/og.jpg)
import fs from 'node:fs';
import { chromium } from '@playwright/test';
const [shot = 'street', out = 'shots/og.png', base = 'http://localhost:5180'] = process.argv.slice(2);
const browser = await chromium.launch({
  executablePath: fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined,
  args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await page.goto(`${base}/?shot=${shot}&full`);
await page.addStyleTag({ content: '.top,.controls,.letterbox,#tooltip{display:none!important}' });
await page.waitForTimeout(7000);
await page.evaluate(() => window.__ew.rig.visible = 1);
await page.evaluate(() => {
  // No letterbox in the still, so no wider lens either.
  document.documentElement.style.setProperty('--bar', '0px');
});
await page.waitForTimeout(2500);
await page.screenshot({ path: out });
await browser.close();
console.log('wrote', out);
