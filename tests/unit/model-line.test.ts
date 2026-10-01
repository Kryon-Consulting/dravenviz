import { describe, expect, test } from 'vitest';
import { themes, validateSpec } from '../../src/core/index';
import { buildModel } from '../../src/render/model/index';
import type { CartesianModel, TickModel } from '../../src/render/model/types';
import { loadFixture } from './helpers/files';

const ctx = { theme: themes.print, locale: 'en-US', timezone: 'UTC' };
const model = (id: string): CartesianModel =>
  buildModel(validateSpec(loadFixture(id)), ctx) as CartesianModel;
const model2 = (spec: unknown): CartesianModel =>
  buildModel(validateSpec(spec), ctx) as CartesianModel;
const yDomain = (id: string) => model(id).yAxes[0]?.domain;
const markers = (id: string) => model(id).series[0]?.markers.map((k) => [k.pointId, k.reason]);

describe('line model', () => {
  test('weekly-flow segments and markers', () => {
    const m = model('line-weekly-flow');
    const opened = m.series.find((s) => s.id === 'opened')!;
    expect(opened.segments).toEqual([]); // o1 isolated (next is null), o3 marker-only, o4 isolated
    expect(opened.markers.map((k) => [k.pointId, k.reason])).toEqual([
      ['o1', 'isolated'],
      ['o3', 'marker-only'],
      ['o4', 'isolated'],
    ]);
    const closed = m.series.find((s) => s.id === 'closed')!;
    expect(closed.segments).toEqual([{ pointIds: ['c1', 'c2', 'c3', 'c4'], estimatedRanges: [] }]);
    expect(closed.markers).toEqual([{ pointId: 'c4', reason: 'quality', variant: 'ringed' }]);
  });

  test('include-zero domain and 4–6 distinct ticks', () => {
    const y = model('line-weekly-flow').yAxes[0]!;
    expect(y.domain[0]).toBe(0);
    expect(y.ticks.length).toBeGreaterThanOrEqual(4);
    expect(y.ticks.length).toBeLessThanOrEqual(6);
    expect(new Set(y.ticks.map((t) => t.label)).size).toBe(y.ticks.length);
  });

  test('flat, singleton, zero and all-missing', () => {
    expect(yDomain('line-all-equal')).toEqual([6, 8]); // value 7, ±1
    expect(markers('line-singleton')).toEqual([['p1', 'isolated']]);
    expect(yDomain('line-measured-zero')).toEqual([0, 1]);
    expect(model('line-all-missing').state).toBe('empty');
    expect(model('line-all-missing').manifest.groups).toContainEqual({
      key: 'empty-state',
      count: 1,
    });
  });

  test('annotation x independent of ticks', () => {
    const m = model('line-thinned-annotation');
    expect(m.annotations[0]!.xKey).toBe('2026-08-12');
    expect(
      (m.x as { ticks?: TickModel[] }).ticks?.some((t) => t.value === Date.UTC(2026, 7, 12)) ??
        false,
    ).toBe(false);
  });

  test('fixed clip-indicated domain is kept and clipped points recorded', () => {
    const m = model('line-fixed-domain-clipped');
    expect(m.yAxes[0]!.domain).toEqual([0, 100]);
    expect(m.yAxes[0]!.overflow).toBe('clip-indicated');
    expect(m.series[0]!.clipped).toEqual([
      { pointId: 'p2', side: 'above' },
      { pointId: 'p4', side: 'below' },
    ]);
    expect(m.notes).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/1 value above 100%? .*clipped/),
        expect.stringMatching(/1 value below 0%? .*clipped/),
      ]),
    );
    expect(m.manifest.groups).toContainEqual({ key: 'series:s:clip-indicator', count: 2 });
  });

  test('estimated points produce dashed ranges; monotone kept', () => {
    const f = model('line-estimated-monotone').series.find((s) => s.id === 'forecast')!;
    expect(f.interpolation).toBe('monotone');
    expect(f.segments).toEqual([
      { pointIds: ['f1', 'f2', 'f3', 'f4', 'f5', 'f6'], estimatedRanges: [['f3', 'f6']] },
    ]);
    expect(model('line-estimated-monotone').manifest.groups).toContainEqual({
      key: 'series:forecast:estimated',
      count: 1,
    });
  });

  test('model is deterministic and does not touch the DOM', () => {
    expect(JSON.stringify(model('line-weekly-flow'))).toBe(
      JSON.stringify(model('line-weekly-flow')),
    );
    expect(typeof (globalThis as { document?: unknown }).document).toBe('undefined');
  });

  test('non-line kinds report unsupported in slice 1', () => {
    expect(buildModel(validateSpec(loadFixture('min-donut')), ctx)).toMatchObject({
      kind: 'unsupported',
    });
  });

  test('time ticks sit on calendar boundaries; dates in UTC, instants in the render zone', () => {
    const m = model('line-thinned-annotation');
    const ticks = (m.x as { ticks: TickModel[] }).ticks;
    expect(ticks.map((t) => t.label)).toEqual(['Jul 2026', 'Aug 2026', 'Sep 2026']);
    expect(ticks.map((t) => t.essential)).toEqual([true, false, true]);
    expect(ticks[1]!.value).toBe(Date.UTC(2026, 7, 1));

    const spec = loadFixture('line-irregular-time');
    spec.xAxis.tickFormat = 'month';
    spec.series[0].points = [
      { id: 'a', x: '2026-01-15T12:00:00Z', value: 1 },
      { id: 'b', x: '2026-06-15T12:00:00Z', value: 2 },
    ];
    const berlin = buildModel(validateSpec(spec), {
      ...ctx,
      timezone: 'Europe/Berlin',
    }) as CartesianModel;
    const first = (berlin.x as { ticks: TickModel[] }).ticks[0]!;
    // Berlin is UTC+1 in February: local midnight on the 1st is 23:00 UTC the day before.
    expect(first.value).toBe(Date.UTC(2026, 0, 31, 23));
    expect(first.label).toBe('Feb 2026');
  });

  test('an explicit tick unit coarsens until at most six distinct ticks', () => {
    const spec = loadFixture('line-irregular-time');
    spec.xAxis.tickFormat = 'day';
    spec.series[0].points = [
      { id: 'a', x: '2024-01-01', value: 1 },
      { id: 'b', x: '2026-01-01', value: 2 },
    ];
    const ticks = (model2(spec).x as { ticks: TickModel[] }).ticks;
    expect(new Set(ticks.map((t) => t.label)).size).toBe(ticks.length);
    expect(ticks.length).toBeLessThanOrEqual(6);
  });

  test('marker.show none keeps isolated and marker-only points; all marks measured points', () => {
    const spec = loadFixture('line-weekly-flow');
    spec.series[0].marker = { show: 'none' };
    spec.series[1].marker = { show: 'all' };
    const m = model2(spec);
    expect(m.series[0]!.markers.map((k) => k.reason)).toEqual([
      'isolated',
      'marker-only',
      'isolated',
    ]);
    expect(m.series[0]!.markers[1]!.variant).toBe('hollow');
    expect(m.series[1]!.markers.map((k) => [k.pointId, k.reason])).toEqual([
      ['c1', 'all'],
      ['c2', 'all'],
      ['c3', 'all'],
      ['c4', 'quality'],
    ]);
  });

  test('notes, legend, labels and style resolution', () => {
    const m = model('line-weekly-flow');
    expect(m.annotations[0]).toMatchObject({ xKey: '2026-07-20', xValue: 2, noteNumber: 1 });
    expect(m.notes[0]).toMatch(/Collection paused/);
    expect(m.legend.map((l) => l.label)).toEqual(['Opened', 'Closed', 'Partial', 'Lagging']);
    expect(m.series[0]!.points[0]).toMatchObject({ label: '6 Jul', display: '12' });
    expect(m.series[0]!.points[1]).toMatchObject({ display: themes.print.strings.notMeasured });
    expect(m.series[0]!.style).toMatchObject({
      color: themes.print.palette[0],
      dash: 'solid',
      width: themes.print.stroke.line,
    });
    expect(m.series[1]!.style).toMatchObject({ color: themes.print.palette[1], dash: 'dashed' });

    const spec = loadFixture('line-weekly-flow');
    spec.roles = { hot: { color: '#112233' } };
    spec.series[0].role = 'hot';
    spec.series[0].points[0].color = '#445566';
    const styled = model2(spec);
    expect(styled.series[0]!.style.color).toBe('#112233');
    expect(styled.series[0]!.points[0]!.color).toBe('#445566');
  });

  test('ticks honour values and count; fractional data gets enough digits', () => {
    const spec = loadFixture('line-weekly-flow');
    spec.yAxes[0].ticks = { values: [0, 10, 30] };
    expect(model2(spec).yAxes[0]!.ticks.map((t) => t.label)).toEqual(['0', '10', '30']);
    const spec2 = loadFixture('line-weekly-flow');
    spec2.yAxes[0].ticks = { count: 3 };
    expect(model2(spec2).yAxes[0]!.ticks).toHaveLength(3);
    const spec3 = loadFixture('line-weekly-flow');
    spec3.series[0].points[0].value = 0.25;
    spec3.series[1].points[0].value = 0.5;
    for (const sr of spec3.series) for (const p of sr.points) if (p.value > 1) p.value = 0.75;
    const y = model2(spec3).yAxes[0]!;
    expect(new Set(y.ticks.map((t) => t.label)).size).toBe(y.ticks.length);
    expect(y.ticks.length).toBeGreaterThanOrEqual(4);
  });

  test('bar, area and scatter series report their slice', () => {
    const bar = loadFixture('min-bar');
    expect(buildModel(validateSpec(bar), ctx)).toMatchObject({ kind: 'unsupported' });
    expect(
      (buildModel(validateSpec(loadFixture('min-scatter')), ctx) as { reason: string }).reason,
    ).toMatch(/slice 3/);
    expect(
      (buildModel(validateSpec(loadFixture('min-area')), ctx) as { reason: string }).reason,
    ).toMatch(/slice 2/);
  });

  const labels = (m: CartesianModel, axis = 0) => m.yAxes[axis]!.ticks.map((t) => t.label);

  test('Heckbert nice ticks, hand-computed', () => {
    // weekly-flow include-zero [0, 21]: nicenum(21, ceil) = 50, nicenum(50 / 4 = 12.5, round) = 10,
    // so the step is 10 and the domain [0, 30] with 4 ticks (inside 4-6).
    const weekly = model('line-weekly-flow').yAxes[0]!;
    expect(weekly.domain).toEqual([0, 30]);
    expect(labels(model('line-weekly-flow'))).toEqual(['0', '10', '20', '30']);
    // fit [10, 35]: nicenum(25, ceil) = 50, nicenum(12.5, round) = 10, ticks 10..40.
    expect(model('line-category-labels-thin').yAxes[0]!.domain).toEqual([10, 40]);
    // flat 7 -> [6, 8]: nicenum(2) = 2, nicenum(0.5, round) = 0.5: 6, 6.5, ..., 8.
    expect(labels(model('line-all-equal'))).toEqual(['6', '6.5', '7', '7.5', '8']);
    // fit [3, 6]: nicenum(3, ceil) = 5, nicenum(1.25, round) = 1: 3, 4, 5, 6.
    expect(labels(model('line-irregular-time'))).toEqual(['3', '4', '5', '6']);
    // fixed [0, 100]: steps {1,2,5}: only 20 gives 4-6 ticks covering both ends.
    expect(labels(model('line-fixed-domain-clipped'))).toEqual([
      '0%',
      '20%',
      '40%',
      '60%',
      '80%',
      '100%',
    ]);
  });

  test('estimated points get no quality marker; the legend lists only drawn qualities', () => {
    const m = model('line-estimated-monotone');
    expect(m.series[0]!.markers).toEqual([]);
    expect(m.manifest.groups.some((g) => g.key === 'series:forecast:marker')).toBe(false);
    expect(m.legend.map((l) => l.label)).toContain('Estimated');
    const spec = loadFixture('line-estimated-monotone');
    spec.series[0].marker = { show: 'all' };
    expect(model2(spec).series[0]!.markers.map((k) => k.reason)).toEqual(Array(6).fill('all'));
    // A partial point clipped away draws no marker, so its quality is not listed.
    const clipped = loadFixture('line-fixed-domain-clipped');
    clipped.series[0].points[1].quality = 'partial';
    expect(model2(clipped).legend.map((l) => l.label)).toEqual(['Coverage']);
  });

  test('clip notes print the formatted value naturally', () => {
    expect(model('line-fixed-domain-clipped').notes).toEqual([
      '1 value above 100% is clipped at the top edge (max 130%)',
      '1 value below 0% is clipped at the bottom edge (min -10%)',
    ]);
  });

  test('hourly ticks across a spring-forward gap are distinct', () => {
    const spec = loadFixture('line-irregular-time');
    spec.xAxis.tickFormat = 'hour';
    spec.series[0].points = [
      { id: 'a', x: '2026-03-08T01:00:00-05:00', value: 1 },
      { id: 'b', x: '2026-03-08T05:30:00-04:00', value: 2 },
    ];
    const m = buildModel(validateSpec(spec), {
      ...ctx,
      timezone: 'America/New_York',
    }) as CartesianModel;
    const ticks = (m.x as { ticks: TickModel[] }).ticks;
    expect(new Set(ticks.map((t) => t.value)).size).toBe(ticks.length);
    expect(ticks.length).toBeGreaterThanOrEqual(3);
    expect(ticks.map((t) => t.label)).not.toContain('Mar 8, 02:00');
  });
});

describe('omitted category positions (R27)', () => {
  const cats = ['a', 'b', 'c', 'd', 'e'];
  const spec = (xs: string[], axis: object = { scale: 'category', categories: cats }) => ({
    schemaVersion: 1,
    id: 'gap',
    kind: 'cartesian',
    title: 'gap',
    xAxis: { id: 'x', ...axis },
    yAxes: [{ id: 'v' }],
    series: [
      {
        id: 's',
        label: 's',
        mark: 'line',
        yAxisId: 'v',
        points: xs.map((x, i) => ({ id: `p${i}`, x, value: i + 1 })),
      },
    ],
  });

  test('a category with no point closes the segment like a null', () => {
    const m = model2(spec(['a', 'b', 'd', 'e']));
    expect(m.series[0]!.segments.map((g) => g.pointIds)).toEqual([
      ['p0', 'p1'],
      ['p2', 'p3'],
    ]);
  });

  test('consecutive categories stay one segment; an isolated survivor becomes a marker', () => {
    expect(model2(spec(['a', 'b', 'c'])).series[0]!.segments).toHaveLength(1);
    const m = model2(spec(['a', 'c', 'd']));
    expect(m.series[0]!.markers.map((k) => [k.pointId, k.reason])).toEqual([['p0', 'isolated']]);
  });

  test('irregular numeric x is not a gap', () => {
    const raw = spec(['a'], { scale: 'linear' });
    raw.series[0]!.points = [0, 5, 9].map((x, i) => ({ id: `p${i}`, x, value: i + 1 })) as never;
    expect(model2(raw).series[0]!.segments).toHaveLength(1);
  });
});

describe('time point labels are unambiguous (I7)', () => {
  const spec = (xs: string[]) => ({
    schemaVersion: 1,
    id: 'time-labels',
    kind: 'cartesian',
    title: 'Time labels',
    xAxis: { id: 'when', scale: 'time' },
    yAxes: [{ id: 'v' }],
    series: [
      {
        id: 's',
        label: 'S',
        mark: 'line',
        yAxisId: 'v',
        points: xs.map((x, i) => ({ id: `p${i}`, x, value: i + 1 })),
      },
    ],
  });
  test('dates carry the year; instants carry the year and the render zone', () => {
    const d = model2(spec(['2025-07-06', '2026-01-06', '2026-07-06']));
    expect(d.series[0]!.points.map((p) => p.label)).toEqual([
      'Jul 6, 2025',
      'Jan 6, 2026',
      'Jul 6, 2026',
    ]);
    const i = buildModel(validateSpec(spec(['2025-07-06T10:00:00Z', '2026-07-06T10:00:00Z'])), {
      ...ctx,
      timezone: 'Asia/Tokyo',
    }) as CartesianModel;
    const labels = i.series[0]!.points.map((p) => p.label);
    expect(new Set(labels).size).toBe(2);
    expect(labels[0]).toMatch(/2025/);
    expect(labels[0]).toMatch(/GMT\+9|JST/);
  });
});
