import { expect, test } from 'vitest';
import { filesImporting, grep, listFiles, scanImports } from './helpers/fs-scan';

test('scans are not vacuous: src and src/core contain source files', () => {
  expect(listFiles('src/core').length).toBeGreaterThan(0);
  expect(listFiles('src').length).toBeGreaterThan(0);
});

test('core imports no DOM/React/Recharts', () => {
  const offenders = scanImports('src/core', [/^react/, /^recharts/, /src\/(render|react|print)/]);
  expect(offenders).toEqual([]);
});

test('recharts only under src/render/recharts', () => {
  expect(filesImporting('src', 'recharts').every((f) => f.startsWith('src/render/recharts/'))).toBe(
    true,
  );
});

test('no eval / Function / innerHTML in src', () => {
  expect(grep('src', /\beval\(|new Function\(|\.innerHTML\s*=/)).toEqual([]);
});
