import { defineConfig } from '@playwright/test';
import fs from 'node:fs';

const chromium = '/opt/pw-browsers/chromium';

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 90_000,
  workers: 1,
  use: {
    baseURL: 'http://localhost:4180',
    launchOptions: {
      executablePath: fs.existsSync(chromium) ? chromium : undefined,
      // Software WebGL, so the scene renders without a GPU.
      args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist'],
    },
  },
  webServer: { command: 'npm run build && node scripts/serve.mjs 4180', url: 'http://localhost:4180', timeout: 120_000, reuseExistingServer: false },
});
