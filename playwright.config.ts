import { existsSync } from 'node:fs';
import { defineConfig } from '@playwright/test';
import { HARNESS_PORT } from './tests/harness/vite.config';

// Chromium comes from PW_CHROMIUM_PATH when set; otherwise from the Playwright-managed
// revision (1194) under PLAYWRIGHT_BROWSERS_PATH. Never run `playwright install` here.
const executablePath = process.env['PW_CHROMIUM_PATH'];

const FULL_CHROMIUM = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const visualPath = executablePath ?? (existsSync(FULL_CHROMIUM) ? FULL_CHROMIUM : undefined);
const visualLaunch = visualPath ? { executablePath: visualPath } : {};

// The harness is a Vite dev server over tests/harness (internal tests only).
const HARNESS_URL = `http://127.0.0.1:${HARNESS_PORT}`;

const use = {
  baseURL: HARNESS_URL,
  launchOptions: executablePath ? { executablePath } : {},
};

// Two projects, both run by `pnpm test:browser`. `visual` holds the reference-image tests of
// tests/visual; they fail with "pending owner review" until the owner approves the baselines
// (design D4), so run `playwright test --project=browser` for everything else.
export default defineConfig({
  projects: [
    { name: 'browser', testDir: 'tests/browser', use },
    // The visual references are pixel-compared, so they always use the full Chromium the baselines
    // were rendered with (PW_CHROMIUM_PATH, else the preinstalled revision), never the headless shell.
    { name: 'visual', testDir: 'tests/visual', use: { ...use, launchOptions: visualLaunch } },
  ],
  webServer: {
    command: 'vite --config tests/harness/vite.config.ts',
    url: HARNESS_URL,
    reuseExistingServer: !process.env['CI'],
    timeout: 60_000,
  },
});
