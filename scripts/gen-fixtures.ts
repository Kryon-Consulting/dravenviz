/**
 * Generates the seeded fixtures. Today that is `fixtures/valid/perf-line-500x4.json`.
 *
 * Determinism: values come from mulberry32 with the fixed seed `PERF_SEED` (20260930), so the
 * output is byte-identical on every machine. The generated file is committed, and
 * `pnpm check:drift` and tests/unit/fixtures.test.ts compare a fresh run with it byte for byte.
 *
 * Usage: `tsx scripts/gen-fixtures.ts [--out <dir>]` (default: the repository root).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { ROOT, isMain, outRoot } from './gen-lib';

export const PERF_SEED = 20260930;
export const PERF_FILE = 'fixtures/valid/perf-line-500x4.json';

/** mulberry32: a 32-bit PRNG returning floats in [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const DAY_MS = 86_400_000;
const START = Date.UTC(2026, 0, 1);

/** 4 series x 125 daily points: a bounded random walk per series, values rounded to 2 dp. */
export function generatePerfLine500x4(): string {
  const rand = mulberry32(PERF_SEED);
  const series = [1, 2, 3, 4].map((n) => {
    let value = 40 + n * 15;
    const points = Array.from({ length: 125 }, (_, i) => {
      value = Math.min(200, Math.max(5, value + (rand() - 0.5) * 8));
      return {
        id: `s${n}p${String(i + 1).padStart(3, '0')}`,
        x: new Date(START + i * DAY_MS).toISOString().slice(0, 10),
        value: Math.round(value * 100) / 100,
      };
    });
    return {
      id: `s${n}`,
      label: `Series ${n}`,
      mark: 'line',
      yAxisId: 'v',
      points,
    };
  });
  const spec = {
    schemaVersion: 1,
    id: 'perf-line-500x4',
    kind: 'cartesian',
    title: 'Performance: 4 series of 125 points',
    xAxis: { id: 'day', scale: 'time' },
    yAxes: [{ id: 'v', label: 'Value', unit: 'count' }],
    series,
  };
  return `${JSON.stringify(spec, null, 2)}\n`;
}

if (isMain(import.meta.url)) {
  const root = process.argv.includes('--out') ? outRoot(process.argv) : ROOT;
  const file = path.join(root, PERF_FILE);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, generatePerfLine500x4());
  console.log(`wrote ${PERF_FILE}`);
}
