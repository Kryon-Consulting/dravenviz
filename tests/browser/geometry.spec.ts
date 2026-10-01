import { PNG } from 'pngjs';
import { expect, test, type Page } from '@playwright/test';
import { DEFAULT_OPTS as opts, h, openHarness } from './helpers';

test.beforeEach(async ({ page }) => {
  await openHarness(page);
});

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}
interface Tick {
  value: number | string;
  label: string;
}
interface Point {
  id: string;
  xValue: number;
  value: number | null;
}
interface Laid {
  boxes: { plot: Box };
  width: number;
  height: number;
  model: {
    x: { type: string; keys?: string[]; domain?: [number, number] };
    yAxes: { id: string; domain: [number, number]; ticks: Tick[]; position: string }[];
    series: {
      id: string;
      axisId: string;
      points: Point[];
      segments: { pointIds: string[]; estimatedRanges: [string, string][] }[];
    }[];
    notes: string[];
  };
}

const TOL = 0.5;
const layoutOf = (page: Page, item: string | object): Promise<Laid> =>
  page.evaluate((i) => window.__h.layoutOf(i), item) as Promise<Laid>;

/** The oracle: category k of n at plot.x + (k + 0.5) * w / n; y linear from the model domain. */
function oracle(laid: Laid) {
  const plot = laid.boxes.plot;
  const model = laid.model;
  const axisOf = (axisId: string) => model.yAxes.find((a) => a.id === axisId)!;
  const x = (p: Point): number => {
    if (model.x.type === 'category')
      return plot.x + ((p.xValue + 0.5) * plot.width) / model.x.keys!.length;
    const [d0, d1] = model.x.domain!;
    return plot.x + ((p.xValue - d0) / (d1 - d0)) * plot.width;
  };
  const y = (axisId: string, v: number): number => {
    const [d0, d1] = axisOf(axisId).domain;
    return plot.y + plot.height * (1 - (v - d0) / (d1 - d0));
  };
  const point = (seriesId: string, pointId: string): { x: number; y: number } => {
    const s = model.series.find((q) => q.id === seriesId)!;
    const p = s.points.find((q) => q.id === pointId)!;
    return { x: x(p), y: y(s.axisId, p.value as number) };
  };
  return { x, y, point };
}

/** Absolute vertices of a path `d` (M/L points; the end point of each C/S/Q segment). */
function vertices(d: string): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  const re = /([MLCSQZ])([^MLCSQZ]*)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(d))) {
    const nums = (m[2] ?? '').match(/-?\d*\.?\d+(?:e[+-]?\d+)?/gi)?.map(Number) ?? [];
    const cmd = (m[1] as string).toUpperCase();
    const size = cmd === 'C' ? 6 : cmd === 'S' || cmd === 'Q' ? 4 : 2;
    for (let i = 0; i + size <= nums.length; i += size) {
      out.push({ x: nums[i + size - 2] as number, y: nums[i + size - 1] as number });
    }
  }
  return out;
}

const attr = (page: Page, selector: string, name: string): Promise<(string | null)[]> =>
  page.locator(selector).evaluateAll((els, n) => els.map((e) => e.getAttribute(n)), name);

async function plotProbe(page: Page, ns: string, chartId: string): Promise<Box> {
  const raw = await page
    .locator(`svg[data-dravenviz-ns="${ns}"][data-dravenviz-chart="${chartId}"] [data-dv-probe]`)
    .getAttribute('data-dv-plot');
  const [x, y, width, height] = (raw ?? '').split(' ').map(Number);
  return { x: x!, y: y!, width: width!, height: height! };
}

async function domains(page: Page, ns: string, chartId: string): Promise<Record<string, unknown>> {
  return page.evaluate(
    ([n, c]) => {
      const probe = document.querySelector(
        `svg[data-dravenviz-ns="${n}"][data-dravenviz-chart="${c}"] [data-dv-probe]`,
      )!;
      const out: Record<string, unknown> = {
        x: JSON.parse(probe.querySelector('[data-dv-probe-x]')!.getAttribute('data-dv-domain')!),
      };
      for (const el of probe.querySelectorAll('[data-dv-probe-y]'))
        out[el.getAttribute('data-dv-probe-y')!] = JSON.parse(el.getAttribute('data-dv-domain')!);
      return out;
    },
    [ns, chartId],
  );
}

/** Bounding-box centre of every `[data-dv-item]` under a mark group, by point id. */
async function itemCentres(
  page: Page,
  key: string,
): Promise<Record<string, { x: number; y: number }>> {
  return page.evaluate((k) => {
    const out: Record<string, { x: number; y: number }> = {};
    const group = Array.from(document.querySelectorAll('[data-dv-mark]')).find(
      (g) => g.getAttribute('data-dv-mark') === k,
    );
    for (const item of group?.querySelectorAll('[data-dv-item]') ?? []) {
      const b = (item as SVGGraphicsElement).getBBox();
      out[item.getAttribute('data-dv-point') ?? ''] = {
        x: b.x + b.width / 2,
        y: b.y + b.height / 2,
      };
    }
    return out;
  }, key);
}

test('the Recharts plot area equals the layout plot box (one y axis)', async ({ page }) => {
  await h(page).mount(['line-weekly-flow'], opts);
  const laid = await layoutOf(page, 'line-weekly-flow');
  const plot = await plotProbe(page, 'r', 'weekly-flow');
  for (const k of ['x', 'y', 'width', 'height'] as const) {
    expect(Math.abs(plot[k] - laid.boxes.plot[k])).toBeLessThanOrEqual(TOL);
  }
  const d = await domains(page, 'r', 'weekly-flow');
  expect(d['x']).toEqual(laid.model.x.keys);
  expect(d['count']).toEqual(laid.model.yAxes[0]!.domain);
});

test('the Recharts plot area equals the layout plot box (two y axes)', async ({ page }) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- the test edits a fixture dynamically
  const spec = await h(page).fixture<any>('line-weekly-flow');
  spec.id = 'two-axes';
  spec.yAxes.push({
    id: 'rate',
    label: 'Rate',
    unit: 'per day',
    position: 'right',
    domain: { policy: 'include-zero' },
  });
  spec.series[1].yAxisId = 'rate';
  spec.referenceLines = [];
  await h(page).mount([spec], opts);
  const laid = await layoutOf(page, spec);
  expect(laid.model.yAxes.map((a) => a.position)).toEqual(['left', 'right']);
  const plot = await plotProbe(page, 'r', 'two-axes');
  for (const k of ['x', 'y', 'width', 'height'] as const) {
    expect(Math.abs(plot[k] - laid.boxes.plot[k])).toBeLessThanOrEqual(TOL);
  }
  const d = await domains(page, 'r', 'two-axes');
  expect(d['count']).toEqual(laid.model.yAxes[0]!.domain);
  expect(d['rate']).toEqual(laid.model.yAxes[1]!.domain);
  // The right axis labels sit right of the plot, the left ones left of it.
  const sides = await page.evaluate(() => {
    const out: Record<string, number[]> = {};
    for (const t of document.querySelectorAll(
      'svg[data-dravenviz-chart] text[data-dv-text-role="tick"]',
    )) {
      const id = t.getAttribute('data-dv-label-id') ?? '';
      if (!id.startsWith('y-tick-')) continue;
      const axis = id.split('-')[2] as string;
      (out[axis] ??= []).push((t as SVGGraphicsElement).getBBox().x);
    }
    return out;
  });
  expect(Math.max(...sides['count']!)).toBeLessThan(laid.boxes.plot.x);
  expect(Math.min(...sides['rate']!)).toBeGreaterThan(laid.boxes.plot.x + laid.boxes.plot.width);
});

test('weekly-flow: markers and path vertices sit at the model pixel positions', async ({
  page,
}) => {
  await h(page).mount(['line-weekly-flow'], opts);
  const laid = await layoutOf(page, 'line-weekly-flow');
  const o = oracle(laid);
  let checked = 0;
  for (const s of laid.model.series) {
    const centres = await itemCentres(page, `series:${s.id}:marker`);
    for (const [pointId, c] of Object.entries(centres)) {
      const want = o.point(s.id, pointId);
      expect(Math.abs(c.x - want.x), `${pointId} x`).toBeLessThanOrEqual(TOL);
      expect(Math.abs(c.y - want.y), `${pointId} y`).toBeLessThanOrEqual(TOL);
      checked += 1;
    }
    const ds = await attr(page, `[data-dv-mark="series:${s.id}:segment"] path`, 'd');
    s.segments.forEach((seg, i) => {
      const got = vertices(ds[i] as string);
      expect(got).toHaveLength(seg.pointIds.length);
      seg.pointIds.forEach((id, k) => {
        const want = o.point(s.id, id);
        expect(Math.abs(got[k]!.x - want.x)).toBeLessThanOrEqual(TOL);
        expect(Math.abs(got[k]!.y - want.y)).toBeLessThanOrEqual(TOL);
        checked += 1;
      });
    });
  }
  // opened: o1, o3, o4 as markers; closed: c4 ringed marker plus a 4-vertex segment.
  expect(checked).toBe(3 + 1 + 4);
});

test('weekly-flow: the annotation line is at the scaled x of 2026-07-20', async ({ page }) => {
  await h(page).mount(['line-weekly-flow'], opts);
  const laid = await layoutOf(page, 'line-weekly-flow');
  const x = await attr(page, '[data-dv-mark="annotation"] line', 'x1');
  const want = laid.boxes.plot.x + (2.5 * laid.boxes.plot.width) / 4;
  expect(x).toHaveLength(1);
  expect(Math.abs(Number(x[0]) - want)).toBeLessThanOrEqual(TOL);
  // The reference line sits at the y of 15.
  const y = await attr(page, '[data-dv-mark="reference"] line', 'y1');
  expect(Math.abs(Number(y[0]) - oracle(laid).y('count', 15))).toBeLessThanOrEqual(TOL);
});

test('fixed domain with clipping: ticks, domain, chevrons, notes and a clipped series layer', async ({
  page,
}) => {
  await h(page).mount(['line-fixed-domain-clipped'], opts);
  const laid = await layoutOf(page, 'line-fixed-domain-clipped');
  const axis = laid.model.yAxes[0]!;
  // The tick values are exactly 0, 20, ..., 100; the drawn label is the axis-formatted form.
  expect(axis.ticks.map((t) => t.value)).toEqual([0, 20, 40, 60, 80, 100]);
  const labels = await page
    .locator('svg[data-dravenviz-chart] text[data-dv-label-id^="y-tick-"]')
    .allTextContents();
  expect(labels).toEqual(axis.ticks.map((t) => t.label));
  expect(labels).toEqual(['0%', '20%', '40%', '60%', '80%', '100%']);
  const d = await domains(page, 'r', 'line-fixed-domain-clipped');
  expect(d['pct']).toEqual([0, 100]);

  const o = oracle(laid);
  const chevrons = await page.evaluate(() => {
    const group = Array.from(document.querySelectorAll('[data-dv-mark]')).find(
      (g) => g.getAttribute('data-dv-mark') === 'series:s:clip-indicator',
    )!;
    return Array.from(group.querySelectorAll('[data-dv-item]')).map((i) => {
      const b = (i as SVGGraphicsElement).getBBox();
      return {
        side: i.getAttribute('data-dv-side'),
        cx: b.x + b.width / 2,
        top: b.y,
        bottom: b.y + b.height,
      };
    });
  });
  expect(chevrons.map((c) => c.side)).toEqual(['above', 'below']);
  const plot = laid.boxes.plot;
  const [p2, p4] = [o.point('s', 'p2'), o.point('s', 'p4')];
  expect(Math.abs(chevrons[0]!.cx - p2.x)).toBeLessThanOrEqual(TOL);
  expect(Math.abs(chevrons[1]!.cx - p4.x)).toBeLessThanOrEqual(TOL);
  // Category 2 and 4 of 5, and each chevron sits on its plot edge, inside the plot box.
  expect(Math.abs(chevrons[0]!.cx - (plot.x + (1.5 * plot.width) / 5))).toBeLessThanOrEqual(TOL);
  expect(Math.abs(chevrons[1]!.cx - (plot.x + (3.5 * plot.width) / 5))).toBeLessThanOrEqual(TOL);
  expect(chevrons[0]!.top).toBeGreaterThanOrEqual(plot.y - TOL);
  expect(chevrons[0]!.top).toBeLessThanOrEqual(plot.y + 4);
  expect(chevrons[1]!.bottom).toBeLessThanOrEqual(plot.y + plot.height + TOL);
  expect(chevrons[1]!.bottom).toBeGreaterThanOrEqual(plot.y + plot.height - 4);

  // Notes are drawn as text.
  const notes = await page.locator('text[data-dv-text-role="note"]').allTextContents();
  expect(notes.join(' ')).toContain('above 100%');
  expect(notes.join(' ')).toContain('below 0%');
  expect(laid.model.notes).toHaveLength(2);

  // Geometric clipping check on the series layer alone: nothing of the stroke is painted outside
  // the plot box. Every other layer is hidden, so only the segment paths can colour a pixel.
  await page.addStyleTag({
    content: `svg[data-dravenviz-chart] * { visibility: hidden !important; }
      svg[data-dravenviz-chart] [data-dv-mark$=":segment"], svg[data-dravenviz-chart] [data-dv-mark$=":segment"] * { visibility: visible !important; }`,
  });
  const svg = page.locator('svg[data-dravenviz-chart]');
  const png = PNG.sync.read(await svg.screenshot());
  const strokeColor = await page.evaluate(
    () =>
      getComputedStyle(document.querySelector('[data-dv-mark="series:s:segment"] path')!).stroke,
  );
  const [sr, sg, sb] = strokeColor.match(/\d+/g)!.map(Number) as [number, number, number];
  let inside = 0;
  let outside = 0;
  const top = Math.floor(plot.y);
  const bottom = Math.ceil(plot.y + plot.height);
  const left = Math.floor(plot.x);
  const right = Math.ceil(plot.x + plot.width);
  for (let py = 0; py < png.height; py++) {
    for (let px = 0; px < png.width; px++) {
      const i = (py * png.width + px) * 4;
      const near =
        Math.abs(png.data[i]! - sr) < 40 &&
        Math.abs(png.data[i + 1]! - sg) < 40 &&
        Math.abs(png.data[i + 2]! - sb) < 40;
      if (!near) continue;
      if (py < top || py >= bottom || px < left || px >= right) outside += 1;
      else inside += 1;
    }
  }
  expect(inside).toBeGreaterThan(100);
  expect(outside).toBe(0);
});

test('estimated monotone: cubic path through every point, clip rects x(f3)..x(f6), no overshoot', async ({
  page,
}) => {
  await h(page).mount(['line-estimated-monotone'], opts);
  const laid = await layoutOf(page, 'line-estimated-monotone');
  const o = oracle(laid);
  const forecast = laid.model.series.find((s) => s.id === 'forecast')!;
  const seg = forecast.segments[0]!;
  const [d] = await attr(page, '[data-dv-mark="series:forecast:segment"] path', 'd');
  expect(d).toContain('C');
  const vs = vertices(d as string);
  expect(vs).toHaveLength(seg.pointIds.length);
  seg.pointIds.forEach((id, k) => {
    const want = o.point('forecast', id);
    expect(Math.abs(vs[k]!.x - want.x)).toBeLessThanOrEqual(TOL);
    expect(Math.abs(vs[k]!.y - want.y)).toBeLessThanOrEqual(TOL);
  });

  // The dashed copy is clipped to exactly x(f3)..x(f6); the solid copy to the complement.
  const clips = await page.evaluate(() => {
    const rectsOf = (item: Element) => {
      const ref = item.getAttribute('clip-path') ?? '';
      const id = /url\(#(.+)\)/.exec(ref)?.[1] ?? '';
      const clip = Array.from(document.querySelectorAll('clipPath')).find((c) => c.id === id);
      return Array.from(clip?.querySelectorAll('rect') ?? []).map((r) => ({
        x: Number(r.getAttribute('x')),
        w: Number(r.getAttribute('width')),
      }));
    };
    const group = (key: string) =>
      Array.from(document.querySelectorAll('[data-dv-mark]')).find(
        (g) => g.getAttribute('data-dv-mark') === key,
      );
    return {
      dashed: Array.from(
        group('series:forecast:estimated')!.querySelectorAll('[data-dv-item]'),
      ).map(rectsOf),
      solid: Array.from(group('series:forecast:segment')!.querySelectorAll('[data-dv-item]')).map(
        rectsOf,
      ),
      dashArray: getComputedStyle(group('series:forecast:estimated')!.querySelector('path')!)
        .strokeDasharray,
      solidDash: getComputedStyle(group('series:forecast:segment')!.querySelector('path')!)
        .strokeDasharray,
    };
  });
  const x3 = o.point('forecast', 'f3').x;
  const x6 = o.point('forecast', 'f6').x;
  expect(clips.dashed).toHaveLength(1);
  expect(clips.dashed[0]).toHaveLength(1);
  expect(Math.abs(clips.dashed[0]![0]!.x - x3)).toBeLessThanOrEqual(TOL);
  expect(Math.abs(clips.dashed[0]![0]!.x + clips.dashed[0]![0]!.w - x6)).toBeLessThanOrEqual(TOL);
  // Solid covers everything left of x(f3) and nothing inside (f3..f6): complementary, no overlap.
  const solidRects = clips.solid[0]!;
  expect(solidRects.every((r) => r.x + r.w <= x3 + TOL || r.x >= x6 - TOL)).toBe(true);
  expect(Math.max(...solidRects.map((r) => r.x + r.w))).toBeGreaterThanOrEqual(x3 - TOL);
  expect(clips.dashArray).not.toBe('none');
  expect(clips.solidDash).toBe('none');

  // Sample the curve: within each monotone run of the data it stays inside the run's value range.
  const values = forecast.points.map((p) => p.value as number);
  const pts = vs;
  const curves = (d as string)
    .match(/C[^C]*/g)!
    .map((c) => c.slice(1).split(/[ ,]+/).filter(Boolean).map(Number));
  const bez = (p0: number, p1: number, p2: number, p3: number, t: number) =>
    (1 - t) ** 3 * p0 + 3 * (1 - t) ** 2 * t * p1 + 3 * (1 - t) * t * t * p2 + t ** 3 * p3;
  const runs: [number, number][] = [];
  let start = 0;
  for (let i = 1; i < values.length; i++) {
    if (
      i < values.length - 1 &&
      (values[i]! - values[i - 1]!) * (values[i + 1]! - values[i]!) < 0
    ) {
      runs.push([start, i]);
      start = i;
    }
  }
  runs.push([start, values.length - 1]);
  expect(runs.length).toBeGreaterThanOrEqual(3);
  for (const [a, b] of runs) {
    const ys = [pts[a]!.y, pts[b]!.y];
    const lo = Math.min(...ys) - TOL;
    const hi = Math.max(...ys) + TOL;
    for (let k = a; k < b; k++) {
      const c = curves[k]!;
      for (let s = 0; s <= 50; s++) {
        const y = bez(pts[k]!.y, c[1]!, c[3]!, c[5]!, s / 50);
        expect(y).toBeGreaterThanOrEqual(lo);
        expect(y).toBeLessThanOrEqual(hi);
      }
    }
  }
});

for (const [fixture, ids, ratio] of [
  ['line-irregular-numeric', ['p1', 'p2', 'p3', 'p4', 'p5'], 8],
  ['line-irregular-time', ['p1', 'p2', 'p3', 'p4'], 31 / 7],
] as const) {
  test(`${fixture}: vertex x positions are proportional to their x values`, async ({ page }) => {
    await h(page).mount([fixture], opts);
    const laid = await layoutOf(page, fixture);
    const [d] = await attr(page, '[data-dv-mark="series:s:segment"] path', 'd');
    const vs = vertices(d as string);
    expect(vs).toHaveLength(ids.length);
    const o = oracle(laid);
    ids.forEach((id, k) => {
      expect(Math.abs(vs[k]!.x - o.point('s', id).x)).toBeLessThanOrEqual(TOL);
    });
    // numeric: gap(x=2 -> 10) is 8x gap(0 -> 1); time: gap(07-09 -> 08-09) is 31/7x gap(07-02 -> 07-09).
    const gap =
      fixture === 'line-irregular-numeric'
        ? [vs[3]!.x - vs[2]!.x, vs[1]!.x - vs[0]!.x]
        : [vs[3]!.x - vs[2]!.x, vs[2]!.x - vs[1]!.x];
    expect(Math.abs(gap[0]! - ratio * gap[1]!)).toBeLessThanOrEqual(TOL);
  });
}

test('a rotated-label chart keeps its tick text where layout placed it', async ({ page }) => {
  await h(page).mount(['line-category-labels-rotate'], opts);
  const laid = (await page.evaluate(() =>
    window.__h.layoutOf('line-category-labels-rotate'),
  )) as Laid & {
    xTicks: { value: string; rotate: number; visible: boolean; x: number; y: number }[];
  };
  const rotated = laid.xTicks.filter((t) => t.visible && t.rotate === -45);
  expect(rotated.length).toBeGreaterThan(0);
  const transforms = await attr(
    page,
    'svg[data-dravenviz-chart] g[data-dv-x-tick] text',
    'transform',
  );
  expect(transforms.filter((t) => t?.startsWith('rotate(-45'))).toHaveLength(rotated.length);
});
