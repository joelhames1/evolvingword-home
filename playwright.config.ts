import { defineConfig } from '@playwright/test';
import fs from 'node:fs';

const chromium = '/opt/pw-browsers/chromium';
// Another port for running suites side by side: PW_PORT=4181 npx playwright test
const port = Number(process.env.PW_PORT ?? 4180);

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 90_000,
  workers: 1,
  use: {
    baseURL: `http://localhost:${port}`,
    launchOptions: {
      executablePath: fs.existsSync(chromium) ? chromium : undefined,
      // Software WebGL, so the scene renders without a GPU.
      args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist'],
    },
  },
  webServer: { command: `npm run build && node scripts/serve.mjs ${port}`, url: `http://localhost:${port}`, timeout: 120_000, reuseExistingServer: false },
});
