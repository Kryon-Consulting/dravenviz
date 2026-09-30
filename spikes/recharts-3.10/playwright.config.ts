import { defineConfig, devices } from '@playwright/test';

// Use the preinstalled Chromium revision 1194 (Chromium 141); never download browsers.
process.env.PLAYWRIGHT_BROWSERS_PATH ??= '/opt/pw-browsers';

export default defineConfig({
  globalSetup: './global-setup.ts',
  testDir: '.',
  testMatch: 'run.spec.ts',
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:5178',
    viewport: { width: 1000, height: 800 },
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1000, height: 800 } } }],
  webServer: {
    command: 'pnpm exec vite --port 5178 --strictPort',
    url: 'http://localhost:5178',
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
