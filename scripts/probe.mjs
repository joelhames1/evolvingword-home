// Ad-hoc look at the scene: node scripts/probe.mjs <url> <out.png> "<js run in page with w = window.__ew>"
import { chromium } from '@playwright/test';
const [url, out, js = '', wait = '800'] = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1200, height: 750 } });
page.on('pageerror', (e) => console.log('[pageerror]', String(e).slice(0, 500)));
page.on('console', (m) => m.type() === 'error' && console.log('[console]', m.text().slice(0, 300)));
await page.goto(url);
await page.waitForTimeout(5000);
if (js) console.log(await page.evaluate(`(() => { const w = window.__ew; ${js} })()`));
await page.waitForTimeout(Number(wait));
await page.screenshot({ path: out });
await browser.close();
