import { defineConfig } from '@playwright/test';

// Chromium comes from PW_CHROMIUM_PATH when set; otherwise from the Playwright-managed
// revision (1194) under PLAYWRIGHT_BROWSERS_PATH. Never run `playwright install` here.
const executablePath = process.env['PW_CHROMIUM_PATH'];

// The harness is a Vite dev server over tests/harness (internal tests only).
const HARNESS_URL = 'http://127.0.0.1:4179';

export default defineConfig({
  testDir: 'tests/browser',
  use: {
    baseURL: HARNESS_URL,
    launchOptions: executablePath ? { executablePath } : {},
  },
  webServer: {
    command: 'vite --config tests/harness/vite.config.ts',
    url: HARNESS_URL,
    reuseExistingServer: !process.env['CI'],
    timeout: 60_000,
  },
});
