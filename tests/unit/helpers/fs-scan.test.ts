import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, expect, test } from 'vitest';
import { filesImporting, grep, scanImports } from './fs-scan';

let dir: string;

beforeAll(() => {
  dir = mkdtempSync(path.join(tmpdir(), 'fs-scan-'));
  mkdirSync(path.join(dir, 'a'));
  writeFileSync(
    path.join(dir, 'a', 'x.ts'),
    [
      "import React from 'react';",
      "import { Line } from 'recharts/lib/x';",
      "export { y } from '../render/y';",
      "const z = await import('./z');",
      "import type { T } from './t';",
      'const s = el.innerHTML = 1;',
    ].join('\n'),
  );
});

afterAll(() => rmSync(dir, { recursive: true, force: true }));

test('scanImports finds static, re-export and dynamic specifiers', () => {
  const found = scanImports(dir, [/^react/, /^recharts/, /render/]).map((o) => o.specifier);
  expect(found).toEqual(['react', 'recharts/lib/x', '../render/y']);
});

test('scanImports returns nothing for a missing directory', () => {
  expect(scanImports(path.join(dir, 'missing'), [/./])).toEqual([]);
});

test('filesImporting matches a module and its subpaths only', () => {
  expect(filesImporting(dir, 'recharts')).toHaveLength(1);
  expect(filesImporting(dir, 'rechart')).toEqual([]);
});

test('grep reports file, line and text', () => {
  const hits = grep(dir, /\.innerHTML\s*=/);
  expect(hits).toHaveLength(1);
  expect(hits[0]).toMatch(/x\.ts:6: const s = el\.innerHTML = 1;$/);
});
