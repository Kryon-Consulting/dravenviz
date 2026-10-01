import { readdirSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, test } from 'vitest';
import { validateSpec } from '../../src/core/index';
import { FIXTURES, loadFixture, specHash } from '../../fixtures/index';
import { generatePerfLine500x4, PERF_SEED } from '../../scripts/gen-fixtures';
import { ROOT, read, readJson } from './helpers/files';

const VALID_DIR = path.join(ROOT, 'fixtures/valid');
const onDisk = readdirSync(VALID_DIR)
  .filter((f) => f.endsWith('.json'))
  .map((f) => f.replace(/\.json$/, ''))
  .sort();

describe('fixture catalog', () => {
  test('catalogs exactly the files in fixtures/valid', () => {
    expect(FIXTURES.map((f) => f.id).sort()).toEqual(onDisk);
    expect(new Set(FIXTURES.map((f) => f.id)).size).toBe(FIXTURES.length);
  });

  test.each(FIXTURES.map((f) => f.id))('%s passes validateSpec', (id) => {
    expect(validateSpec(loadFixture(id))).toMatchObject({ id: expect.any(String) });
  });

  test('every entry has modes, coverage and a slice', () => {
    for (const f of FIXTURES) {
      expect(f.modes.length).toBeGreaterThan(0);
      expect(f.coverage.length).toBeGreaterThan(0);
      expect([1, 2, 3]).toContain(f.slice);
    }
  });

  test('loadFixture throws for unknown ids', () => {
    expect(() => loadFixture('nope')).toThrow(/unknown fixture/);
  });

  test('line-weekly-flow has the ids and values later tasks assert', () => {
    const spec = validateSpec(loadFixture('line-weekly-flow'));
    expect(spec.id).toBe('weekly-flow');
    if (spec.kind !== 'cartesian') throw new Error('cartesian expected');
    expect(spec.series.map((s) => s.points.map((p) => [p.id, p.value]))).toEqual([
      [
        ['o1', 12],
        ['o2', null],
        ['o3', 18],
        ['o4', 21],
      ],
      [
        ['c1', 8],
        ['c2', 10],
        ['c3', 14],
        ['c4', 16],
      ],
    ]);
    expect(spec.annotations?.[0]).toMatchObject({ x: '2026-07-20', label: 'Partial week' });
    expect(spec.referenceLines?.[0]).toMatchObject({ axisId: 'count', value: 15, label: 'Target' });
  });
});

describe('specHash', () => {
  test('is stable across key order at every depth', () => {
    const a = { x: 1, y: { b: [1, { q: 1, r: 2 }], a: null } };
    const b = { y: { a: null, b: [1, { r: 2, q: 1 }] }, x: 1 };
    expect(specHash(a)).toBe(specHash(b));
    expect(specHash(a)).toMatch(/^[0-9a-f]{64}$/);
  });

  test('changes with content and array order', () => {
    expect(specHash({ a: 1 })).not.toBe(specHash({ a: 2 }));
    expect(specHash([1, 2])).not.toBe(specHash([2, 1]));
  });
});

describe('generated fixtures', () => {
  test('gen-fixtures output equals the committed perf-line-500x4 byte for byte', () => {
    expect(generatePerfLine500x4()).toBe(read('fixtures/valid/perf-line-500x4.json'));
  });

  test('perf fixture is 4 series x 125 points from the documented seed', () => {
    expect(PERF_SEED).toBe(20260930);
    const spec = loadFixture('perf-line-500x4') as { series: { points: unknown[] }[] };
    expect(spec.series.map((s) => s.points.length)).toEqual([125, 125, 125, 125]);
  });
});

describe('report-slice1', () => {
  const report = readJson('fixtures/reports/report-slice1.json') as {
    fixture: string;
    namespace: string;
  }[];

  test('lists eight instances with distinct namespaces', () => {
    expect(report).toHaveLength(8);
    expect(new Set(report.map((r) => r.namespace)).size).toBe(8);
  });

  test('lists line-weekly-flow twice with distinct namespaces', () => {
    const wf = report.filter((r) => r.fixture === 'line-weekly-flow');
    expect(wf.map((r) => r.namespace)).toEqual(['wf-a', 'wf-b']);
  });

  test('every entry names a catalogued fixture', () => {
    const ids = new Set(FIXTURES.map((f) => f.id));
    for (const r of report) expect(ids.has(r.fixture)).toBe(true);
  });
});
