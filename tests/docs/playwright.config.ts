import { defineConfig } from '@playwright/test';

// `pnpm test:docs` (scripts/docs-cli.ts) serves .stage/docs/dist, prints the actual URL, and passes
// it here. Chromium comes from PW_CHROMIUM_PATH when set; never run `playwright install` locally.
const baseURL = process.env['DOCS_URL'];
if (baseURL === undefined || baseURL === '') {
  throw new Error('DOCS_URL is not set. Run `pnpm test:docs`, which starts the preview server.');
}
const executablePath = process.env['PW_CHROMIUM_PATH'];

export default defineConfig({
  testDir: '.',
  testMatch: 'docs.spec.ts',
  timeout: 60_000,
  use: {
    baseURL,
    acceptDownloads: true,
    launchOptions: executablePath ? { executablePath } : {},
  },
});
