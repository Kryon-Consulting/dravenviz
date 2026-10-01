import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, test } from 'vitest';

/**
 * Validates the committed measurement evidence (`pnpm measure` writes it) and enforces the P1
 * target of design section 18. This file runs in its own vitest project (`perf-report`, see
 * vitest.config.ts), not in `pnpm test`: that command is Node-unit only and must not depend on
 * measured evidence (ruling R34). Run it with `pnpm test:perf`.
 *
 * A P1 miss fails here with an explicit message. The resolution is an investigation recorded in
 * evidence/perf/README.md and an owner decision; never a change of the threshold in this file.
 */
const DIR = path.resolve(import.meta.dirname, '../../evidence/perf');
const P1_TARGET_MS = 250;
const SAMPLES = 30;

const read = (name: string): unknown => {
  const file = path.join(DIR, name);
  if (!existsSync(file)) throw new Error(`evidence/perf/${name} is missing: run \`pnpm measure\``);
  return JSON.parse(readFileSync(file, 'utf8')) as unknown;
};

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/** Nearest-rank percentile (design section 18). */
const rank = (samples: number[], p: number): number => {
  const sorted = [...samples].sort((a, b) => a - b);
  return sorted[Math.max(1, Math.ceil((p / 100) * sorted.length)) - 1] as number;
};

interface Scenario {
  samples: number[];
  p50: number;
  p95: number;
  warmup: number;
  [k: string]: unknown;
}

describe('size.json', () => {
  const size = read('size.json') as Record<string, unknown>;
  test('has the required fields', () => {
    expect(isObj(size)).toBe(true);
    const bundle = size['bundle'] as Record<string, unknown>;
    expect(isNum(bundle['rawBytes']) && isNum(bundle['gzipBytes'])).toBe(true);
    expect(bundle['gzipBytes'] as number).toBeLessThan(bundle['rawBytes'] as number);
    expect(isObj(size['esm']) && Object.keys(size['esm'] as object).length).toBeGreaterThanOrEqual(
      3,
    );
    for (const v of Object.values(size['esm'] as object)) expect(isNum(v)).toBe(true);
    const fonts = size['fonts'] as { file: string; bytes: number; sha256: string }[];
    expect(fonts.length).toBeGreaterThanOrEqual(2);
    for (const f of fonts) {
      expect(typeof f.file).toBe('string');
      expect(isNum(f.bytes)).toBe(true);
      expect(f.sha256).toMatch(/^[0-9a-f]{64}$/);
    }
    const svgs = size['svg'] as { fixture: string; external: number; embedded: number }[];
    expect(svgs.length).toBeGreaterThanOrEqual(1);
    for (const s of svgs) {
      expect(typeof s.fixture).toBe('string');
      expect(isNum(s.external) && isNum(s.embedded)).toBe(true);
      expect(s.embedded).toBeGreaterThan(s.external);
    }
    const pdf = size['pdf'] as Record<string, unknown>;
    expect(pdf['fixture']).toBe('report-slice1');
    expect(isNum(pdf['bytes']) && isNum(pdf['pages'])).toBe(true);
  });
});

describe('latency.json', () => {
  const latency = read('latency.json') as Record<string, unknown>;
  const scenarios = latency['scenarios'] as Record<string, Scenario>;

  test('has P1, P2 and P4, each with 30 samples, a warm-up count and consistent percentiles', () => {
    for (const id of ['P1', 'P2', 'P4']) {
      const s = scenarios[id];
      expect(s, `scenario ${id}`).toBeDefined();
      const sc = s as Scenario;
      expect(sc.samples.length, `${id} samples`).toBe(SAMPLES);
      for (const v of sc.samples) expect(isNum(v) && v > 0).toBe(true);
      expect(sc.warmup, `${id} warm-up runs`).toBe(5);
      expect(sc.p50, `${id} p50`).toBe(rank(sc.samples, 50));
      expect(sc.p95, `${id} p95`).toBe(rank(sc.samples, 95));
    }
  });

  test('P4 reports its stall accounting', () => {
    const stalls = (scenarios['P4'] as Scenario)['stalls'] as Record<string, unknown>;
    expect(isNum(stalls['count']) && isNum(stalls['rate'])).toBe(true);
    expect(Array.isArray(stalls['durationsMs'])).toBe(true);
    expect((stalls['durationsMs'] as number[]).length).toBe(stalls['count']);
  });

  test('records the machine', () => {
    const m = latency['machine'] as Record<string, unknown>;
    for (const k of ['cpu', 'cores', 'ramBytes', 'os', 'node', 'chromium', 'recharts', 'react']) {
      expect(m[k], `machine.${k}`).toBeDefined();
    }
  });

  test(`P1 p95 is at most ${P1_TARGET_MS} ms (design section 18)`, () => {
    const p1 = scenarios['P1'] as Scenario;
    const message =
      `P1 MISS: warmed mountCharts readiness for perf-line-500x4 has p95 ${p1.p95} ms ` +
      `(p50 ${p1.p50} ms), over the ${P1_TARGET_MS} ms target. Do NOT change the threshold. ` +
      'Investigate where the time goes, record the numbers and the cause in ' +
      'evidence/perf/README.md, and ask the owner; only the owner can accept an exception.';
    expect(p1.p95 <= P1_TARGET_MS, message).toBe(true);
  });
});
