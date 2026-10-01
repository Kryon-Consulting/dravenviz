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

test('react and print never import each other', () => {
  expect(scanImports('src/react', [/^\.{1,2}\/(?:.*\/)?print(?:\/|$)|src\/print/])).toEqual([]);
  expect(scanImports('src/print', [/^\.{1,2}\/(?:.*\/)?react(?:\/|$)|src\/react/])).toEqual([]);
  expect(listFiles('src/react').length).toBeGreaterThan(0);
});

test('src/react touches no DOM at module top level', () => {
  expect(grep('src/react', /^(?:window|document|navigator)\./m)).toEqual([]);
});
