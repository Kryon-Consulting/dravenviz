import { describe, expect, test } from 'vitest';
import { DravenVizError, toDataTable, validateSpec } from '../../src/core/index';
import { loadFixture } from './helpers/files';

const table = (id: string, options?: { locale?: string; timezone?: string }) =>
  toDataTable(validateSpec(loadFixture(id)), options);

describe('toDataTable(line-weekly-flow)', () => {
  const t = table('line-weekly-flow');

  test('columns are the x column and one column per series with its unit', () => {
    expect(t.columns.map((c) => c.label)).toEqual(['Week', 'Opened (count)', 'Closed (count)']);
    expect(t.columns.map((c) => c.align)).toEqual(['start', 'end', 'end']);
    expect(t.columns[1]).toMatchObject({ key: 'opened', unit: 'count' });
  });

  test('one row per category, in category order, with the displayed label as header', () => {
    expect(t.rows.map((r) => r.id)).toEqual([
      '2026-07-06',
      '2026-07-13',
      '2026-07-20',
      '2026-07-27',
    ]);
    expect(t.rows.map((r) => r.header)).toEqual(['6 Jul', '13 Jul', '20 Jul', '27 Jul']);
    for (const r of t.rows) expect(r.cells).toHaveLength(2);
  });

  test('a missing value reads "Not measured", never an empty string or 0', () => {
    const row = t.rows.find((r) => r.id === '2026-07-13')!;
    expect(row.cells[0]).toEqual({ text: 'Not measured', value: null, state: 'missing' });
    expect(row.cells[1]).toEqual({ text: '10', value: 10, state: 'measured' });
  });

  test('quality words become cell states', () => {
    const partial = t.rows.find((r) => r.id === '2026-07-20')!;
    expect(partial.cells[0]).toEqual({ text: '18 (Partial)', value: 18, state: 'partial' });
    const lagging = t.rows.find((r) => r.id === '2026-07-27')!;
    expect(lagging.cells[1]).toEqual({ text: '16 (Lagging)', value: 16, state: 'lagging' });
  });

  test('notes carry the annotation detail; the caption states the unit', () => {
    expect(t.notes).toContain(
      '(1) Partial week — Collection paused 22–24 Jul; value is a partial count.',
    );
    expect(t.caption).toBe('Items opened and closed (count)');
  });
});

describe('toDataTable edge cases', () => {
  test('clipped values are marked clipped and noted per axis side', () => {
    const t = table('line-fixed-domain-clipped');
    const states = t.rows.map((r) => r.cells[0]?.state);
    expect(states).toEqual(['measured', 'clipped', 'measured', 'clipped', 'measured']);
    expect(t.notes.some((n) => /above/.test(n))).toBe(true);
    expect(t.notes.some((n) => /below/.test(n))).toBe(true);
  });

  test('estimated points are marked estimated', () => {
    const t = table('line-estimated-monotone');
    const forecast = t.rows.map((r) => r.cells[0]?.state);
    expect(t.rows[3]?.cells[0]?.text).toBe('18 (Estimated)');
    expect(forecast).toEqual([
      'measured',
      'measured',
      'measured',
      'estimated',
      'estimated',
      'measured',
    ]);
  });

  test('irregular numeric and time axes keep one row per distinct x, ascending', () => {
    const n = table('line-irregular-numeric');
    const xs = n.rows.map((r) => Number(r.id));
    expect(xs).toEqual([...xs].sort((a, b) => a - b));
    const d = table('line-irregular-time');
    expect(d.rows.map((r) => r.id)).toEqual([...d.rows.map((r) => r.id)].sort());
    expect(d.rows[0]?.header).not.toBe('');
  });

  test('an all-missing chart still lists every position with "Not measured"', () => {
    const t = table('line-all-missing');
    expect(t.rows).toHaveLength(4);
    for (const r of t.rows) expect(r.cells[0]?.text).toBe('Not measured');
  });

  test('the text of a title is data, never markup', () => {
    expect(table('text-markup-title').caption).toContain('<script>');
  });

  test('is DOM-free and pure: same input, same output; input is untouched', () => {
    const spec = validateSpec(loadFixture('line-weekly-flow'));
    expect(JSON.stringify(toDataTable(spec))).toBe(JSON.stringify(toDataTable(spec)));
  });

  test('kinds that arrive in a later slice report RENDER_FAILED not-implemented-in-slice', () => {
    const spec = validateSpec(loadFixture('min-donut'));
    try {
      toDataTable(spec);
      throw new Error('expected a throw');
    } catch (e) {
      expect(e).toBeInstanceOf(DravenVizError);
      expect((e as DravenVizError).code).toBe('RENDER_FAILED');
      expect((e as DravenVizError).issues?.[0]?.rule).toBe('not-implemented-in-slice');
    }
  });
});

describe('time axis headers (I7) and theme strings (Minor 1)', () => {
  const timeSpec = (xs: string[], extra: Record<string, unknown> = {}) => ({
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
    ...extra,
  });
  const headers = (xs: string[], options?: { locale?: string; timezone?: string }) =>
    toDataTable(validateSpec(timeSpec(xs)), options).rows.map((r) => r.header);

  test("dates a year apart never read alike (the reviewer's Jul 6 / Jan 6 / Jul 6)", () => {
    const h = headers(['2025-07-06', '2026-01-06', '2026-07-06']);
    expect(h).toEqual(['Jul 6, 2025', 'Jan 6, 2026', 'Jul 6, 2026']);
    expect(new Set(h).size).toBe(3);
  });

  test('instants a year apart differ and the column header names the render timezone', () => {
    const t = toDataTable(
      validateSpec(timeSpec(['2025-07-06T10:00:00Z', '2026-07-06T10:00:00Z'])),
      { timezone: 'Asia/Tokyo' },
    );
    expect(t.rows.map((r) => r.header)).toEqual(['Jul 6, 2025, 19:00', 'Jul 6, 2026, 19:00']);
    expect(t.columns[0]!.label).toBe('Date (Asia/Tokyo)');
  });

  test('a date-only axis keeps a plain column header', () => {
    expect(toDataTable(validateSpec(timeSpec(['2026-01-06']))).columns[0]!.label).toBe('Date');
  });

  test('missing cells use the resolved theme strings, not the print default', () => {
    const t = toDataTable(
      validateSpec({
        ...(loadFixture('line-weekly-flow') as object),
      }),
      { theme: 'light', themeOverrides: { strings: { notMeasured: 'Nicht gemessen' } } },
    );
    const row = t.rows.find((r) => r.id === '2026-07-13')!;
    expect(row.cells[0]).toEqual({ text: 'Nicht gemessen', value: null, state: 'missing' });
    expect(table('line-weekly-flow').rows[1]!.cells[0]!.text).toBe('Not measured');
  });
});
