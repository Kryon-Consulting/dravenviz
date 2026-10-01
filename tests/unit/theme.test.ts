import { describe, expect, test } from 'vitest';
import { DravenVizError } from '../../src/core/errors';
import {
  effectivePt,
  resolveTheme,
  themes,
  type Theme,
  type ThemeName,
  type ThemeOverrides,
} from '../../src/core/index';
import { readJson } from './helpers/files';

const NAMES: ThemeName[] = ['light', 'dark', 'print'];

function catchErr(fn: () => unknown): DravenVizError {
  try {
    fn();
  } catch (e) {
    expect(e).toBeInstanceOf(DravenVizError);
    return e as DravenVizError;
  }
  throw new Error('expected a throw');
}

function rel(hex: string): number {
  const ch = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}
function contrast(a: string, b: string): number {
  const [hi, lo] = [rel(a), rel(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

describe('built-in themes', () => {
  test('print sizes meet A4 minima at 680 units / 178 mm', () => {
    const t = themes.print;
    expect(effectivePt(t.text.title, 680, 178)).toBeGreaterThanOrEqual(12);
    expect(effectivePt(t.text.title, 680, 178)).toBeLessThanOrEqual(14);
    expect(effectivePt(t.text.label, 680, 178)).toBeGreaterThanOrEqual(9);
    expect(effectivePt(t.text.caption, 680, 178)).toBeGreaterThanOrEqual(8);
  });

  test('effectivePt formula and input guards', () => {
    expect(effectivePt(17, 680, 178)).toBeCloseTo((17 * 504.5669) / 680, 3);
    expect(catchErr(() => effectivePt(10, 0, 178)).code).toBe('INVALID_OPTIONS');
    expect(catchErr(() => effectivePt(Number.NaN, 680, 178)).code).toBe('INVALID_OPTIONS');
  });

  test('print text tokens and white background', () => {
    expect(themes.print.text).toEqual({ title: 17, label: 13, caption: 11, lineHeight: 1.25 });
    expect(themes.print.color.background).toBe('#ffffff');
    for (const n of ['light', 'dark'] as const) {
      expect(themes[n].text).toMatchObject({ title: 16, label: 12, caption: 11 });
    }
  });

  test('series slots differ by dash or shape, not color alone', () => {
    for (const n of NAMES) {
      const s = themes[n].seriesStyles;
      expect(s).toHaveLength(8);
      expect(themes[n].palette).toHaveLength(8);
      for (let i = 1; i < 8; i++)
        for (let j = 0; j < i; j++)
          expect(s[i]!.dash !== s[j]!.dash || s[i]!.shape !== s[j]!.shape).toBe(true);
    }
  });

  test('print palette is grayscale-distinguishable across the first 4 slots', () => {
    const lum = themes.print.palette.slice(0, 4).map(rel);
    for (let i = 1; i < 4; i++)
      for (let j = 0; j < i; j++) expect(Math.abs(lum[i]! - lum[j]!)).toBeGreaterThanOrEqual(0.08);
  });

  test('text/background contrast is at least 4.5:1 in every theme', () => {
    for (const n of NAMES) {
      const c = themes[n].color;
      expect(contrast(c.text, c.background)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(c.mutedText, c.background)).toBeGreaterThanOrEqual(4.5);
    }
  });

  test('dark has a dark background and light text', () => {
    expect(rel(themes.dark.color.background)).toBeLessThan(0.05);
    expect(rel(themes.dark.color.text)).toBeGreaterThan(0.5);
  });

  test('roles are empty, strings are en-US defaults, version is semver', () => {
    for (const n of NAMES) {
      expect(themes[n].roles).toEqual({});
      expect(themes[n].version).toMatch(/^\d+\.\d+\.\d+$/);
      expect(themes[n].strings).toEqual({
        unavailable: 'Unavailable',
        notMeasured: 'Not measured',
        noData: 'No data',
        incomplete: 'Incomplete',
        target: 'Target',
        clipped: 'Clipped',
      });
    }
  });

  test('no business words in built-in themes', () => {
    expect(JSON.stringify(themes)).not.toMatch(/critical|severity|vulnerab|finding|sla/i);
  });

  test('themes are deep-frozen', () => {
    expect(Object.isFrozen(themes)).toBe(true);
    expect(Object.isFrozen(themes.print.palette)).toBe(true);
    expect(Object.isFrozen(themes.print.seriesStyles[0])).toBe(true);
  });
});

describe('resolveTheme', () => {
  const bad = (o: unknown): DravenVizError =>
    catchErr(() => resolveTheme('light', o as ThemeOverrides));

  test('override rejects non-hex color with path', () => {
    expect(bad({ color: { text: 'red' } })).toMatchObject({
      code: 'INVALID_OPTIONS',
      path: '/color/text',
    });
  });

  test('rejects unknown keys, bad numbers, and bad enums with pointer paths', () => {
    expect(bad({ colour: {} })).toMatchObject({ code: 'INVALID_OPTIONS', path: '/colour' });
    expect(bad({ color: { nope: '#000000' } }).path).toBe('/color/nope');
    expect(bad({ stroke: { line: 0 } }).path).toBe('/stroke/line');
    expect(bad({ marker: { size: -1 } }).path).toBe('/marker/size');
    expect(bad({ text: { label: Number.NaN } }).path).toBe('/text/label');
    expect(bad({ text: { label: Infinity } }).path).toBe('/text/label');
    expect(bad({ spacing: { padding: '4' } }).path).toBe('/spacing/padding');
    expect(bad({ strings: { noData: '' } }).path).toBe('/strings/noData');
    expect(bad({ roles: { a: { color: '#000000', shape: 'star' } } }).path).toBe('/roles/a/shape');
    expect(bad({ roles: { a: { pattern: 'dots' } } }).path).toBe('/roles/a/color');
    expect(bad('x').code).toBe('INVALID_OPTIONS');
  });

  test('arrays are replaced whole and keep exactly 8 entries', () => {
    expect(bad({ palette: ['#000000'] }).path).toBe('/palette');
    expect(bad({ palette: Array(8).fill('#00000') }).path).toBe('/palette/0');
    expect(bad({ seriesStyles: [{ dash: 'solid', shape: 'circle', pattern: 'none' }] }).path).toBe(
      '/seriesStyles',
    );
    const ss = themes.light.seriesStyles.map((s) => ({ ...s }));
    ss[3] = { dash: 'dotted', shape: 'cross', pattern: 'dots' };
    expect(
      bad({ seriesStyles: ss.map((s, i) => (i === 2 ? { ...s, dash: 'wavy' } : s)) }).path,
    ).toBe('/seriesStyles/2/dash');
    const pal = [
      '#111111',
      '#222222',
      '#333333',
      '#444444',
      '#555555',
      '#666666',
      '#777777',
      '#888888',
    ];
    const t = resolveTheme('light', { palette: pal, sequential: ['#000000', '#ffffff'] });
    expect(t.palette).toEqual(pal);
    expect(t.sequential).toEqual(['#000000', '#ffffff']);
    expect(t.diverging).toEqual(themes.light.diverging);
  });

  test('merges nested keys and never mutates inputs', () => {
    const overrides = { color: { text: '#000000' }, text: { label: 14 } };
    const snap = JSON.stringify(overrides);
    const baseSnap = JSON.stringify(themes.light);
    const t = resolveTheme('light', overrides);
    expect(t.color.text).toBe('#000000');
    expect(t.color.background).toBe(themes.light.color.background);
    expect(t.text).toMatchObject({ label: 14, title: 16 });
    expect(JSON.stringify(overrides)).toBe(snap);
    expect(JSON.stringify(themes.light)).toBe(baseSnap);
    expect(Object.isFrozen(t)).toBe(true);
    expect(Object.isFrozen(t.color)).toBe(true);
    expect(t).not.toBe(themes.light);
    expect(resolveTheme('dark').name).toBe('dark');
  });

  test('accepts a full Theme as base and validates it', () => {
    const t = resolveTheme(themes.print, { marker: { size: 9 } });
    expect(t.marker.size).toBe(9);
    expect(t.name).toBe('print');
    const broken = { ...themes.print, color: { ...themes.print.color, grid: 'grey' } } as Theme;
    expect(catchErr(() => resolveTheme(broken)).path).toBe('/color/grid');
  });

  test('security example override supplies role colors', () => {
    const t = resolveTheme('print', readJson('examples/themes/security.json'));
    expect(t.roles.critical!.color).toMatch(/^#[0-9a-f]{6}$/i);
    const keys = ['critical', 'high', 'medium', 'low'];
    for (const k of keys) expect(t.roles[k]!.color).toMatch(/^#[0-9a-f]{6}$/i);
    const marks = keys.map((k) => `${t.roles[k]!.pattern}/${t.roles[k]!.shape}`);
    expect(new Set(marks).size).toBe(4);
  });
});
