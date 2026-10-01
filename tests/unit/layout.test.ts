import { describe, expect, test } from 'vitest';
import { DravenVizError, effectivePt, themes, validateSpec } from '../../src/core/index';
import { buildModel } from '../../src/render/model/index';
import type { CartesianModel } from '../../src/render/model/types';
import {
  layoutChart,
  labelQuad,
  notoMeasurer,
  noteGlyph,
  polygonsIntersect,
  type Box,
  type LaidOutChart,
  type PlacedTick,
} from '../../src/render/layout/index';
import { NOTO_METRICS } from '../../src/render/layout/noto-metrics.gen';
import { loadFixture } from './helpers/files';

const theme = themes.print;
const ctx = { theme, locale: 'en-US', timezone: 'UTC' };
const model = (id: string): CartesianModel =>
  buildModel(validateSpec(loadFixture(id)), ctx) as CartesianModel;
const lay = (
  id: string,
  width = 680,
  height = 320,
  extra: { printWidthMm?: number; mode?: 'interactive' | 'static' } = {},
): LaidOutChart =>
  layoutChart(
    model(id),
    { width, height, theme, mode: extra.mode ?? 'interactive', ...extra },
    notoMeasurer,
  );

const overlapArea = (a: Box, b: Box): number =>
  Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)) *
  Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
const quad = (t: PlacedTick) => labelQuad(t.x, t.y, t.width, t.height, t.rotate);
const quadsIntersect = (ticks: PlacedTick[]): boolean => {
  for (let i = 0; i < ticks.length; i++)
    for (let j = i + 1; j < ticks.length; j++)
      if (polygonsIntersect(quad(ticks[i]!), quad(ticks[j]!))) return true;
  return false;
};

describe('measurer', () => {
  test('width is the sum of advances scaled by size; ascent/descent from hhea', () => {
    const m = notoMeasurer('A', { size: 1000, weight: 400 });
    expect(m.width).toBe(639);
    expect(m.ascent).toBe(1069);
    expect(m.descent).toBe(293);
    expect(notoMeasurer('AA', { size: 10, weight: 400 }).width).toBeCloseTo(12.78, 9);
  });
  test('missing characters are never zero width', () => {
    expect(notoMeasurer('①', { size: 10, weight: 600 }).width).toBeGreaterThan(0);
  });
});

describe('weekly-flow at 680x320 print', () => {
  const laid = lay('line-weekly-flow', 680, 320, { printWidthMm: 178 });
  test('boxes do not overlap and the plot is large enough', () => {
    const boxes = [
      laid.boxes.title,
      laid.boxes.legend,
      laid.boxes.plot,
      laid.boxes.notes,
      ...Object.values(laid.boxes.axes),
    ];
    for (let i = 0; i < boxes.length; i++)
      for (let j = i + 1; j < boxes.length; j++) expect(overlapArea(boxes[i]!, boxes[j]!)).toBe(0);
    expect(laid.boxes.plot.width).toBeGreaterThanOrEqual(80);
    expect(laid.boxes.plot.height).toBeGreaterThanOrEqual(60);
    expect(laid.metrics.effectivePt!.label).toBeGreaterThanOrEqual(9);
    expect(laid.fontScale).toBe(1);
  });
  test('notes are numbered with parenthesised numerals; axes expose sizes', () => {
    expect(laid.notes[0]!.text).toMatch(/^\(1\) Partial week — Collection paused/);
    expect(laid.boxes.axes['count']!.width).toBeGreaterThan(0);
    expect(laid.boxes.xAxis.height).toBeGreaterThan(0);
  });
  test('layout is deterministic and JSON-serialisable', () => {
    const again = lay('line-weekly-flow', 680, 320, { printWidthMm: 178 });
    expect(JSON.stringify(again)).toBe(JSON.stringify(laid));
  });
});

describe('print scaling', () => {
  test('1200 wide at 178 mm scales up, driven by the caption', () => {
    const l = lay('line-weekly-flow', 1200, 500, { printWidthMm: 178 });
    expect(l.fontScale).toBeCloseTo(8 / effectivePt(11, 1200, 178), 5);
    expect(l.fontScale).toBeGreaterThan(1);
    expect(l.fontScale).toBeCloseTo(1.73, 1);
    expect(l.metrics.effectivePt!.label).toBeGreaterThanOrEqual(9);
    expect(l.metrics.effectivePt!.caption).toBeGreaterThanOrEqual(8);
    expect(l.metrics.effectivePt!.title).toBeGreaterThanOrEqual(12);
    expect(l.metrics.effectivePt!.title).toBeLessThanOrEqual(14);
  });
  test('680 wide at 100 mm scales up', () => {
    expect(lay('line-weekly-flow', 680, 400, { printWidthMm: 100 }).fontScale).toBeGreaterThan(1);
  });
  test('400 wide at 178 mm never scales down', () => {
    expect(lay('line-weekly-flow', 400, 320, { printWidthMm: 178 }).fontScale).toBe(1);
  });
  test('no printWidthMm: scale 1 and no effective pt', () => {
    const l = lay('line-weekly-flow');
    expect(l.fontScale).toBe(1);
    expect(l.metrics.effectivePt).toBeUndefined();
  });
});

describe('category label policy at 680x320 print', () => {
  const source = (id: string): string[] => {
    const x = model(id).x;
    return x.type === 'category' ? x.labels : [];
  };
  const stageOf = (id: string) => lay(id, 680, 320, { printWidthMm: 178 });

  test('wrap: horizontal, some 2 lines, all visible', () => {
    const l = stageOf('line-category-labels-wrap');
    expect(l.metrics.xLabelStage).toBe('wrap');
    expect(l.xTicks.every((t) => t.rotate === 0 && t.visible)).toBe(true);
    expect(l.xTicks.some((t) => t.lines.length === 2)).toBe(true);
    expect(l.xTicks.every((t) => t.lines.length <= 2)).toBe(true);
  });
  test('rotate: -45, all visible, no quad intersects', () => {
    const l = stageOf('line-category-labels-rotate');
    expect(l.metrics.xLabelStage).toBe('rotate');
    expect(l.xTicks.every((t) => t.rotate === -45 && t.visible)).toBe(true);
    expect(quadsIntersect(l.xTicks)).toBe(false);
  });
  test('thin: -45, some hidden, first and last visible, visible quads disjoint', () => {
    const l = stageOf('line-category-labels-thin');
    expect(l.metrics.xLabelStage).toBe('thin');
    expect(l.xTicks.every((t) => t.rotate === -45)).toBe(true);
    expect(l.xTicks.some((t) => !t.visible)).toBe(true);
    expect(l.xTicks[0]!.visible).toBe(true);
    expect(l.xTicks[l.xTicks.length - 1]!.visible).toBe(true);
    expect(quadsIntersect(l.xTicks.filter((t) => t.visible))).toBe(false);
  });
  test('labels are never truncated and stay inside the viewBox', () => {
    for (const id of [
      'line-category-labels-wrap',
      'line-category-labels-rotate',
      'line-category-labels-thin',
    ]) {
      const l = stageOf(id);
      expect(l.xTicks.map((t) => t.lines.join(' '))).toEqual(source(id));
      for (const t of l.xTicks.filter((k) => k.visible)) {
        for (const p of quad(t)) {
          expect(p.x).toBeGreaterThanOrEqual(-1e-3);
          expect(p.x).toBeLessThanOrEqual(680 + 1e-3);
          expect(p.y).toBeLessThanOrEqual(320);
        }
      }
    }
  });
  test('polygonsIntersect: overlap true, touching false', () => {
    const sq = (x: number) => [
      { x, y: 0 },
      { x: x + 1, y: 0 },
      { x: x + 1, y: 1 },
      { x, y: 1 },
    ];
    expect(polygonsIntersect(sq(0), sq(0.5))).toBe(true);
    expect(polygonsIntersect(sq(0), sq(1))).toBe(false);
  });
});

describe('time ticks and annotations', () => {
  test('thinned-annotation: annotation lies between two visible ticks; note present', () => {
    const m = model('line-thinned-annotation');
    const l = lay('line-thinned-annotation');
    const xv = m.annotations[0]!.xValue;
    const vis = l.xTicks.filter((t) => t.visible).map((t) => Number(t.value));
    expect(vis.some((v) => v < xv) && vis.some((v) => v > xv)).toBe(true);
    expect(vis.includes(xv)).toBe(false);
    expect(l.notes[0]!.text).toContain('Policy change');
    expect(l.xTicks.every((t) => t.rotate === 0)).toBe(true);
  });
  test('legend items wrap onto separate rows at a narrow width; boxes do not overlap', () => {
    const l = lay('line-thinned-annotation', 400, 360);
    expect(l.legendRows.flat().length).toBe(2);
    expect(l.legendRows.length).toBe(2);
    expect(overlapArea(l.boxes.legend, l.boxes.plot)).toBe(0);
  });
});

describe('static mode', () => {
  test('adds annotation and reference labels; interactive adds none', () => {
    const s = lay('line-weekly-flow', 680, 320, { mode: 'static' });
    expect(s.staticLabels.map((x) => [x.kind, x.text])).toEqual([
      ['annotation', 'Partial week'],
      ['reference', 'Target'],
    ]);
    expect(lay('line-weekly-flow').staticLabels).toEqual([]);
  });
});

describe('errors and titles', () => {
  test('200x120 throws LAYOUT_ERROR naming the element and the minimum', () => {
    let err: unknown;
    try {
      lay('line-weekly-flow', 200, 120);
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(DravenVizError);
    expect((err as DravenVizError).code).toBe('LAYOUT_ERROR');
    expect((err as Error).message).toContain('minimum');
    expect((err as Error).message).toMatch(/\((\d+ (rows?|lines?),\s*)?\d+ units\)/);
  });
  test('a 180-character title wraps to at most 3 lines within the width', () => {
    const m = {
      ...model('line-weekly-flow'),
      title: 'Quarterly service reliability and responsiveness review '.repeat(4).slice(0, 180),
    };
    const l = layoutChart(m, { width: 680, height: 400, theme, mode: 'interactive' }, notoMeasurer);
    expect(l.titleLines.length).toBeLessThanOrEqual(3);
    for (const line of l.titleLines)
      expect(notoMeasurer(line, { size: theme.text.title, weight: 600 }).width).toBeLessThanOrEqual(
        680 - 2 * theme.spacing.padding,
      );
  });
});

describe('fix round 1', () => {
  const opts = (width: number, height: number) => ({
    width,
    height,
    theme,
    mode: 'interactive' as const,
  });
  const fail = (fn: () => unknown): DravenVizError => {
    try {
      fn();
    } catch (e) {
      return e as DravenVizError;
    }
    throw new Error('expected a throw');
  };

  test('a title needing more than 3 lines throws LAYOUT_ERROR naming the title and width', () => {
    const m = { ...model('line-weekly-flow'), title: 'W'.repeat(180) };
    const e = fail(() => layoutChart(m, opts(680, 400), notoMeasurer));
    expect(e.code).toBe('LAYOUT_ERROR');
    expect(e.message).toContain('title');
    expect(e.message).toMatch(/\d+ units/);
    const ok = {
      ...m,
      title: 'Quarterly service reliability and responsiveness review '.repeat(4).slice(0, 180),
    };
    expect(layoutChart(ok, opts(680, 400), notoMeasurer).titleLines.length).toBeLessThanOrEqual(3);
    expect('titleEllipsized' in layoutChart(ok, opts(680, 400), notoMeasurer).metrics).toBe(false);
  });

  test('x axis box is keyed by its real id; a y axis called "x" does not collide', () => {
    const spec = loadFixture('line-weekly-flow');
    spec.yAxes[0].id = 'x';
    for (const s of spec.series) s.yAxisId = 'x';
    for (const r of spec.referenceLines) r.axisId = 'x';
    const m = buildModel(validateSpec(spec), ctx) as CartesianModel;
    const l = layoutChart(m, opts(680, 320), notoMeasurer);
    expect(l.boxes.axes['week']).toEqual(l.boxes.xAxis);
    expect(l.boxes.axes['x']).not.toEqual(l.boxes.xAxis);
    expect(overlapArea(l.boxes.axes['x']!, l.boxes.xAxis)).toBe(0);
    expect(l.boxes.xAxis.height).toBeGreaterThan(0);
    expect(l.boxes.axes['x']!.width).toBeGreaterThan(0);
  });

  test('a long y axis title wraps into columns inside the plot span, or throws', () => {
    const spec = loadFixture('line-weekly-flow');
    spec.yAxes[0].unit = 'items per engineer per working week across all regional teams';
    const m = buildModel(validateSpec(spec), ctx) as CartesianModel;
    const l = layoutChart(m, opts(680, 320), notoMeasurer);
    const cols = l.yAxisTitles['count']!;
    expect(cols.length).toBeGreaterThan(1);
    expect(cols.length).toBeLessThanOrEqual(3);
    for (const c of cols)
      expect(notoMeasurer(c, { size: theme.text.label, weight: 400 }).width).toBeLessThanOrEqual(
        l.boxes.plot.height + 1e-6,
      );
    const ax = l.boxes.axes['count']!;
    expect(ax.y).toBeCloseTo(l.boxes.plot.y, 6);
    expect(ax.height).toBeCloseTo(l.boxes.plot.height, 6);
    expect(l.boxes.plot.x).toBeCloseTo(ax.x + ax.width, 6);
    spec.yAxes[0].unit = 'items per engineer per working week across all regional teams '.repeat(6);
    const e = fail(() =>
      layoutChart(
        buildModel(validateSpec(spec), ctx) as CartesianModel,
        opts(680, 320),
        notoMeasurer,
      ),
    );
    expect(e.code).toBe('LAYOUT_ERROR');
    expect(e.message).toContain('y axis');
  });

  test('a long legend item label wraps inside the legend box', () => {
    const m0 = model('line-weekly-flow');
    const long = 'Items opened by the regional intake teams during the reporting periods';
    expect(long.length).toBe(70);
    const m: CartesianModel = {
      ...m0,
      legend: [{ ...m0.legend[0]!, label: long }, ...m0.legend.slice(1)],
    };
    const l = layoutChart(m, opts(400, 360), notoMeasurer);
    const lines = l.legendLabels[m0.legend[0]!.id]!;
    expect(lines.length).toBeGreaterThan(1);
    expect(lines.join(' ')).toBe(long);
    const swatch = theme.marker.size * 4;
    const gap = theme.spacing.titleGap / 2;
    for (const line of lines)
      expect(
        swatch + gap + notoMeasurer(line, { size: theme.text.label, weight: 400 }).width,
      ).toBeLessThanOrEqual(l.boxes.legend.width + 1e-6);
    expect(l.boxes.legend.height).toBeGreaterThanOrEqual(
      lines.length * theme.text.label * theme.text.lineHeight,
    );
  });

  test('dash, ellipsis and note numerals have real advances; numbers use parentheses', () => {
    for (const ch of ['\u2013', '\u2014', '\u2026'])
      expect(NOTO_METRICS.advances[400][ch.codePointAt(0)!]).toBeGreaterThan(0);
    expect(noteGlyph(1)).toBe('(1)');
    expect(noteGlyph(21)).toBe('(21)');
  });

  test('canvas measurer reports a typed error outside a browser', async () => {
    const { createCanvasMeasurer } = await import('../../src/render/layout/canvas-measure');
    const e = fail(() => createCanvasMeasurer("'Noto Sans', sans-serif"));
    expect(e.code).toBe('RENDER_FAILED');
  });
});
