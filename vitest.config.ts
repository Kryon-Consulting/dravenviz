import { defineConfig } from 'vitest/config';

// The format tests run in their own project under a fixed non-UTC machine timezone, so a
// formatter that leaks the machine zone cannot pass. The rest of the suite keeps the default.
const TZ_FILES = ['tests/unit/format.test.ts'];
// Hand-built SVG DOM for the strict validator; normalization needs real computed style and is tested in the browser.
const DOM_FILES = ['tests/unit/svg-validate.test.ts'];

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'unit',
          environment: 'node',
          include: ['tests/unit/**/*.test.ts'],
          exclude: [...TZ_FILES, ...DOM_FILES],
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
