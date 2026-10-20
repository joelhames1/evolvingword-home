// The pictures inside the chooser's globes: each world's opening view, square,
// with the interface hidden. node scripts/stills.mjs [base] [worlds...]
// (writes public/worlds/<id>.jpg via a PNG in shots/; all four worlds unless you name some)
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import { chromium } from '@playwright/test';
const [base = 'http://localhost:5180', ...picked] = process.argv.slice(2);
const worlds = picked.length ? picked : ['alps', 'city', 'tower', 'monastery'];
fs.mkdirSync('shots', { recursive: true });
fs.mkdirSync('public/worlds', { recursive: true });
const browser = await chromium.launch({
  executablePath: fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined,
  args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist'],
});
for (const world of worlds) {
  const page = await browser.newPage({ viewport: { width: 900, height: 900 } });
  await page.goto(`${base}/?shot=vista&full&world=${world}`);
  await page.addStyleTag({ content: '.top,.controls,.letterbox,#tooltip,#hints{display:none!important}' });
  await page.waitForTimeout(8000);
  await page.evaluate(() => {
    window.__ew.rig.visible = 1;
    document.documentElement.style.setProperty('--bar', '0px');
  });
  await page.waitForTimeout(3000);
  const png = `shots/still-${world}.png`;
  await page.screenshot({ path: png });
  // ImageMagick, if it's there, makes a small progressive JPEG.
  try {
    execFileSync('convert', [png, '-resize', '640x640', '-strip', '-interlace', 'JPEG', '-quality', '82', `public/worlds/${world}.jpg`]);
    console.log('wrote', `public/worlds/${world}.jpg`);
  } catch {
    console.log('wrote', png, '(convert it to public/worlds/', world, '.jpg)');
  }
  await page.close();
}
await browser.close();
