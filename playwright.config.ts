import { defineConfig } from '@playwright/test';
import { HARNESS_PORT } from './tests/harness/vite.config';

// Chromium comes from PW_CHROMIUM_PATH when set; otherwise from the Playwright-managed
// revision (1194) under PLAYWRIGHT_BROWSERS_PATH. Never run `playwright install` here.
const executablePath = process.env['PW_CHROMIUM_PATH'];

// The harness is a Vite dev server over tests/harness (internal tests only).
const HARNESS_URL = `http://127.0.0.1:${HARNESS_PORT}`;

const use = {
  baseURL: HARNESS_URL,
  launchOptions: executablePath ? { executablePath } : {},
};

// Two projects, both run by `pnpm test:browser`. `visual` holds the pixel-compared reference
// images of tests/visual (approved by the owner, design D4); `browser` is everything else and is
// the CI gating step.
export default defineConfig({
  projects: [
    { name: 'browser', testDir: 'tests/browser', use },
    // The baselines were rendered in the full Chromium of revision 1194, whose text rasterization
    // differs from the headless shell the `browser` project uses by default. `channel: 'chromium'`
    // selects the full binary from the active PLAYWRIGHT_BROWSERS_PATH (ruling R46); an explicit
    // PW_CHROMIUM_PATH still wins.
    {
      name: 'visual',
      testDir: 'tests/visual',
      use: { ...use, channel: 'chromium', launchOptions: use.launchOptions },
    },
  ],
  webServer: {
    command: 'vite --config tests/harness/vite.config.ts',
    url: HARNESS_URL,
    reuseExistingServer: !process.env['CI'],
    timeout: 60_000,
  },
});
