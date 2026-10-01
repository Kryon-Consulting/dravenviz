import { describe, expect, test } from 'vitest';
import { NOTO_METRICS } from '../../src/render/layout/noto-metrics.gen';
import { NOTO_SERIF_METRICS } from '../assets/fonts/noto-serif-metrics.gen';
import { read, readProvenance, sha256File } from './helpers/provenance';

describe('Noto Sans (shipped)', () => {
  test('shipped font files match PROVENANCE hashes', () => {
    const entries = readProvenance('assets/fonts/PROVENANCE.md');
    expect(entries.map((e) => e.file).sort()).toEqual([
      'NotoSans-Regular.woff2',
      'NotoSans-SemiBold.woff2',
      'OFL.txt',
      'noto-sans.css',
    ]);
    for (const { file, sha256 } of entries) expect(sha256File(`assets/fonts/${file}`)).toBe(sha256);
  });

  test('OFL license present and css references both weights', () => {
    expect(read('assets/fonts/OFL.txt')).toMatch(/SIL OPEN FONT LICENSE Version 1.1/);
    const css = read('assets/fonts/noto-sans.css');
    expect(css).toMatch(/font-weight:\s*400[\s\S]*font-weight:\s*600/);
    expect(css).toMatch(/NotoSans-Regular\.woff2/);
    expect(css).toMatch(/NotoSans-SemiBold\.woff2/);
    expect(css).toMatch(/font-display:\s*block/);
  });

  test('provenance pins the tag, commit and source zip', () => {
    const md = read('assets/fonts/PROVENANCE.md');
    expect(md).toContain('NotoSans-v2.015');
    expect(md).toContain('Tag object: `0aabc14885f9edaf467f05a2499a1a00c09f0b56`');
    expect(md).toContain('Tag commit: `c4a321e123e4d4ff315f57f4e0adf294fe3a95be`');
    expect(md).toContain('0c34df072a3fa7efbb7cbf34950e1f971a4447cffe365d3a359e2d4089b958f5');
  });

  test('metrics cover ASCII for both weights', () => {
    for (const w of [400, 600] as const)
      for (let cp = 0x20; cp < 0x7f; cp++) expect(NOTO_METRICS.advances[w][cp]).toBeGreaterThan(0);
  });

  test('metrics cover Latin Extended, Greek and Cyrillic basics', () => {
    for (const w of [400, 600] as const)
      for (const cp of [0xe9, 0x24f, 0x3b1, 0x3a9, 0x416, 0x44f])
        expect(NOTO_METRICS.advances[w][cp]).toBeGreaterThan(0);
    expect(NOTO_METRICS.unitsPerEm).toBe(1000);
    expect(NOTO_METRICS.ascender).toBeGreaterThan(0);
    expect(NOTO_METRICS.descender).toBeLessThan(0);
  });

  test('semibold is wider than regular for "W"', () => {
    expect(NOTO_METRICS.advances[600][0x57]).toBeGreaterThan(NOTO_METRICS.advances[400][0x57] ?? 0);
  });
});

describe('Noto Serif (test fixture)', () => {
  test('files match PROVENANCE hashes and OFL present', () => {
    const entries = readProvenance('tests/assets/fonts/PROVENANCE.md');
    expect(entries.map((e) => e.file).sort()).toEqual([
      'NotoSerif-Regular.woff2',
      'NotoSerif-SemiBold.woff2',
      'OFL.txt',
    ]);
    for (const { file, sha256 } of entries)
      expect(sha256File(`tests/assets/fonts/${file}`)).toBe(sha256);
    expect(read('tests/assets/fonts/OFL.txt')).toMatch(/SIL OPEN FONT LICENSE Version 1.1/);
    const md = read('tests/assets/fonts/PROVENANCE.md');
    expect(md).toContain('Tag object: `1eee5de7230d240118f8ad8d1e5fe4c91acae943`');
    expect(md).toContain('Tag commit: `c4a321e123e4d4ff315f57f4e0adf294fe3a95be`');
  });

  test('metrics cover ASCII and differ from Noto Sans', () => {
    for (const w of [400, 600] as const)
      for (let cp = 0x20; cp < 0x7f; cp++)
        expect(NOTO_SERIF_METRICS.advances[w][cp]).toBeGreaterThan(0);
    expect(NOTO_SERIF_METRICS.advances[400][0x4d]).not.toBe(NOTO_METRICS.advances[400][0x4d]);
  });
});
