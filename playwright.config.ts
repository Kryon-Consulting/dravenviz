import { defineConfig } from '@playwright/test';

// Chromium comes from PW_CHROMIUM_PATH when set; otherwise from the Playwright-managed
// revision (1194) under PLAYWRIGHT_BROWSERS_PATH. Never run `playwright install` here.
const executablePath = process.env['PW_CHROMIUM_PATH'];

export default defineConfig({
  testDir: 'tests/browser',
  use: {
    launchOptions: executablePath ? { executablePath } : {},
  },
});
