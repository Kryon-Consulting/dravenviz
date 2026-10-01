import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { expect, test } from 'vitest';

// `import('@draven/viz')` is resolved against the BUILT package (dist) through Node's package
// self-reference: the repository's own package.json has name "@draven/viz" and an exports map, so
// the specifier resolves to dist/core/index.js with the same rules a consumer gets. The full
// installed-tarball consumer check is `test:package` (Task 18).
const ROOT = process.cwd();

test('importing @draven/viz exits 0 and loads neither react nor recharts', () => {
  const trace = pathToFileURL(join(ROOT, 'tests/dist/register-trace.mjs')).href;
  const r = spawnSync(
    process.execPath,
    [
      '--import',
      trace,
      '--input-type=module',
      '-e',
      "const m = await import('@draven/viz'); if (typeof m.validateSpec !== 'function') process.exit(2);",
    ],
    { cwd: ROOT, encoding: 'utf8' },
  );
  expect(r.status, r.stderr).toBe(0);
  const loaded = r.stderr
    .split('\n')
    .filter((l) => l.startsWith('DV_LOAD '))
    .map((l) => l.slice('DV_LOAD '.length));
  expect(loaded.some((u) => u.endsWith('/dist/core/index.js'))).toBe(true);
  const heavy = loaded.filter((u) =>
    /(\/node_modules\/(?:\.pnpm\/[^/]+\/node_modules\/)?(?:react|react-dom|react-is|recharts)\/)/.test(
      u,
    ),
  );
  expect(heavy).toEqual([]);
  expect(loaded.filter((u) => /recharts|\/dist\/(react|print)\//.test(u))).toEqual([]);
});
