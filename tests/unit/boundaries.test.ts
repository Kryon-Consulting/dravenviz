import { expect, test } from 'vitest';
import { filesImporting, grep, scanImports } from './helpers/fs-scan';

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
