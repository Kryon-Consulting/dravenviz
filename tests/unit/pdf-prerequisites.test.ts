import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { expect, test } from 'vitest';

/**
 * GC-14: missing PDF prerequisites exit 3 and print `UNVERIFIED:`, never a pass. A nonexistent
 * Chromium path trips the check (or an earlier uv/Python check, which uses the same exit); the
 * driver stops before any build, so this is offline-safe and takes well under a second.
 */
const ROOT = path.resolve(import.meta.dirname, '../..');

test('test:pdf with no Chromium prints UNVERIFIED and exits 3', () => {
  const run = spawnSync(path.join(ROOT, 'node_modules/.bin/tsx'), ['scripts/test-pdf.ts'], {
    cwd: ROOT,
    encoding: 'utf8',
    env: { ...process.env, PW_CHROMIUM_PATH: '/nonexistent/chrome' },
    timeout: 60_000,
  });
  expect(run.status).toBe(3);
  expect(run.stdout).toMatch(/^UNVERIFIED: /m);
  expect(run.stdout).not.toMatch(/\bPASS\b/);
});
