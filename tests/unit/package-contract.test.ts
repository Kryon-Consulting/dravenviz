import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, test } from 'vitest';
import { DEFAULT_TIMEOUT_MS, resolveOptions } from '../../src/print/options';

/** Package-metadata and default constants named by the Global Constraints (design sections 1, 3, 9). */
const pkg = JSON.parse(
  readFileSync(path.resolve(import.meta.dirname, '../../package.json'), 'utf8'),
) as {
  name: string;
  private?: boolean;
  license?: string;
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
  peerDependencies: Record<string, string>;
  peerDependenciesMeta: Record<string, { optional?: boolean }>;
};

describe('package.json (GC-01, GC-03)', () => {
  test('is @draven/viz, private and UNLICENSED', () => {
    expect(pkg.name).toBe('@draven/viz');
    expect(pkg.private).toBe(true);
    expect(pkg.license).toBe('UNLICENSED');
  });

  test('Recharts is pinned exactly at 3.10.1', () => {
    expect(pkg.dependencies['recharts']).toBe('3.10.1');
  });

  test('React, ReactDOM and react-is are 19.3.0 in development', () => {
    for (const name of ['react', 'react-dom', 'react-is']) {
      expect(pkg.devDependencies[name], name).toBe('19.3.0');
    }
  });

  test('peers are ^18.3.0 || ^19.0.0 and all optional', () => {
    for (const name of ['react', 'react-dom', 'react-is']) {
      expect(pkg.peerDependencies[name], name).toBe('^18.3.0 || ^19.0.0');
      expect(pkg.peerDependenciesMeta[name]?.optional, name).toBe(true);
    }
    expect(Object.keys(pkg.peerDependencies).sort()).toEqual(['react', 'react-dom', 'react-is']);
  });
});

describe('default readiness timeout (GC-07)', () => {
  test('is 10,000 ms, and resolveOptions applies it when none is given', () => {
    expect(DEFAULT_TIMEOUT_MS).toBe(10_000);
    expect(resolveOptions({ width: 680, height: 320 }, 1).timeoutMs).toBe(10_000);
    expect(resolveOptions({ width: 680, height: 320, timeoutMs: 500 }, 1).timeoutMs).toBe(500);
  });
});
