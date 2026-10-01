import { defineConfig } from 'vitest/config';

// The format tests run in their own project under a fixed non-UTC machine timezone, so a
// formatter that leaks the machine zone cannot pass. The rest of the suite keeps the default.
const TZ_FILES = ['tests/unit/format.test.ts'];
// Hand-built SVG DOM for the strict validator; normalization needs real computed style and is tested in the browser.
const DOM_FILES = ['tests/unit/svg-validate.test.ts'];
// Reads committed measurement evidence and enforces the P1 target; run by `pnpm test:perf`, not by
// `pnpm test` (R34: no dependence on measured evidence, and a P1 miss must not turn `pnpm test` red).
const PERF_FILES = ['tests/unit/perf-report.test.ts'];
// Verifies evidence/verification-matrix.md against committed evidence; run by `pnpm test:matrix`
// (R34: `pnpm test` stays Node-unit only and independent of committed evidence).
const MATRIX_FILES = ['tests/unit/matrix.test.ts'];

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'unit',
          environment: 'node',
          include: ['tests/unit/**/*.test.ts'],
          exclude: [...TZ_FILES, ...DOM_FILES, ...PERF_FILES, ...MATRIX_FILES],
        },
      },
      {
        test: { name: 'perf-report', environment: 'node', include: PERF_FILES },
      },
      {
        test: { name: 'matrix', environment: 'node', include: MATRIX_FILES },
      },
      {
        // Reads build output and installs from the registry: run by `pnpm test:dist` only (R34).
        test: {
          name: 'dist',
          environment: 'node',
          include: ['tests/dist/**/*.test.ts'],
          testTimeout: 600_000,
          hookTimeout: 600_000,
        },
      },
      {
        test: {
          name: 'unit-jsdom',
          environment: 'jsdom',
          include: DOM_FILES,
        },
      },
      {
        test: {
          name: 'unit-tz-new-york',
          environment: 'node',
          include: TZ_FILES,
          pool: 'forks',
          env: { TZ: 'America/New_York' },
        },
      },
    ],
  },
});
