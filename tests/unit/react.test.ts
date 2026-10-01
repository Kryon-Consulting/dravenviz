import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { expect, test } from 'vitest';
import { validateSpec } from '../../src/core/index';
import { defaultNamespace } from '../../src/react/Chart';
import { Chart, DataTable } from '../../src/react/index';
import {
  announcement,
  moveFocus,
  navigableDatums,
  nearestDatum,
} from '../../src/react/interaction';
import fixture from '../../fixtures/valid/line-weekly-flow.json';
import { buildModel } from '../../src/render/model/index';
import { layoutChart } from '../../src/render/layout/index';
import { resolveTheme } from '../../src/core/index';

const spec = validateSpec(structuredClone(fixture));

test('default namespaces are valid, deterministic, and distinguish ids that differ only by case', () => {
  const ids = ['_R_0_', '_r_0_', '_R_1_', '«r0»', ':r1:', '_a_r_0_', 'x'.repeat(200), ''];
  const ns = ids.map(defaultNamespace);
  for (const n of ns) expect(n).toMatch(/^[a-z][a-z0-9-]{0,31}$/);
  expect(ns.every((n) => n.startsWith('dv-'))).toBe(true);
  expect(new Set(ns).size).toBe(ids.length);
  expect(ids.map(defaultNamespace)).toEqual(ns);
});

test('Chart renders only a placeholder root on the server (SSR-safe, no DOM access)', () => {
  const html = renderToString(
    createElement(Chart, { spec: fixture, height: 300, width: 400, namespace: 'ssr' }),
  );
  expect(html).toBe(
    '<div class="dravenviz-root" data-dravenviz-ns="ssr" style="position:relative;width:400px"></div>',
  );
  expect(renderToString(createElement(Chart, { spec: fixture, height: 300 }))).toMatch(
    /^<div class="dravenviz-root" data-dravenviz-ns="dv[a-z0-9-]*"/,
  );
});

test('DataTable renders the table with escaped text and a hidden variant', () => {
  const html = renderToString(createElement(DataTable, { spec, visuallyHidden: true }));
  expect(html).toContain('dravenviz-visually-hidden');
  expect(html).toContain('<table class="dravenviz-table">');
  expect(html).toContain('Opened');
  expect(html).toContain('data-state=');
  const evil = structuredClone(fixture) as { title: string };
  evil.title = '<script>x</script>';
  const out = renderToString(createElement(DataTable, { spec: validateSpec(evil) }));
  expect(out).not.toContain('<script>');
});

function datums() {
  const theme = resolveTheme('light');
  const model = buildModel(spec, { theme, locale: 'en-US', timezone: 'UTC' });
  if (model.kind !== 'cartesian') throw new Error('expected cartesian');
  const measure = (t: string, f: { size: number }) => ({
    width: t.length * f.size * 0.55,
    ascent: f.size * 0.9,
    descent: f.size * 0.25,
  });
  const laid = layoutChart(model, { width: 600, height: 320, theme, mode: 'interactive' }, measure);
  return { all: navigableDatums(laid), laid };
}

test('navigation skips null points and follows series then point order', () => {
  const { all } = datums();
  expect(all.map((s) => s.map((d) => d.pointId))).toEqual([
    ['o1', 'o3', 'o4'],
    ['c1', 'c2', 'c3', 'c4'],
  ]);
  const o1 = moveFocus(all, undefined, 'ArrowLeft')!;
  expect(o1.pointId).toBe('o1');
  const o3 = moveFocus(all, o1, 'ArrowRight')!;
  expect(o3.pointId).toBe('o3');
  expect(moveFocus(all, o3, 'ArrowDown')!.pointId).toBe('c3'); // closest in x
  expect(moveFocus(all, o3, 'ArrowUp')).toBe(o3);
  const o4 = moveFocus(all, o3, 'ArrowRight')!;
  expect(moveFocus(all, o4, 'ArrowRight')).toBe(o4);
  expect(announcement(o3)).toBe('Opened, 20 Jul, 18 count, partial');
});

test('positions put each datum inside the plot and nearest picks the closest within radius', () => {
  const { all, laid } = datums();
  const plot = laid.boxes.plot;
  for (const d of all.flat()) {
    expect(d.x).toBeGreaterThanOrEqual(plot.x);
    expect(d.x).toBeLessThanOrEqual(plot.x + plot.width);
    expect(d.y).toBeGreaterThanOrEqual(plot.y);
    expect(d.y).toBeLessThanOrEqual(plot.y + plot.height);
  }
  const o1 = all[0]![0]!;
  expect(nearestDatum(all, o1.x + 2, o1.y - 2, 10)?.pointId).toBe('o1');
  expect(nearestDatum(all, o1.x + 300, o1.y, 10)).toBeUndefined();
});
