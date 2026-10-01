/* eslint-disable @typescript-eslint/no-explicit-any -- tests mutate fixture JSON dynamically */
import { readdirSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, test } from 'vitest';
import {
  DEFAULT_LIMITS,
  DravenVizError,
  InvalidSpecError,
  SCHEMA_VERSION,
  isValidSpec,
  validateSpec,
  version,
} from '../../src/core/index';
import { DUPLICATE_CHART_EMBEDDING } from '../../src/core/validate/index';
import { ROOT, loadFixture, read, readJson } from './helpers/files';

const INVALID_DIR = path.join(ROOT, 'fixtures/invalid');
const INVALID_FIXTURES = readdirSync(INVALID_DIR)
  .filter((f) => f.endsWith('.json') && !f.endsWith('.expected.json'))
  .map((f) => f.replace(/\.json$/, ''))
  .sort();

const loadInvalid = (id: string): unknown => JSON.parse(read(`fixtures/invalid/${id}.json`));
const loadExpected = (id: string): { code: string; rule: string; path: string } =>
  readJson(`fixtures/invalid/${id}.expected.json`);

function catchErr(fn: () => unknown): any {
  try {
    fn();
  } catch (e) {
    return e;
  }
  throw new Error('expected the call to throw');
}

function deepFreeze<T>(v: T): T {
  if (v && typeof v === 'object' && !Object.isFrozen(v)) {
    Object.freeze(v);
    for (const child of Object.values(v)) deepFreeze(child);
  }
  return v;
}

const issuesOf = (spec: unknown, options?: Parameters<typeof validateSpec>[1]) =>
  catchErr(() => validateSpec(spec, options)).issues as { rule: string; path: string }[];

/** Every rule id named in design section 6. */
const SECTION_6_RULES = [
  'duplicate-id',
  'unknown-axis',
  'unknown-role',
  'x-not-in-categories',
  'point-order',
  'labels-length',
  'horizontal-requires-bars',
  'bar-on-continuous-axis',
  'stack-mixed-marks',
  'stack-mixed-axes',
  'negative-in-percent-stack',
  'bar-domain-excludes-data',
  'fixed-domain-excludes-data',
  'invalid-domain',
  'marker-without-value',
  'render-hint-on-bar',
  'size-without-bubble',
  'invalid-time',
  'time-without-offset',
  'mixed-x-types',
  'negative-slice',
  'missing-cell',
  'duplicate-cell',
  'value-outside-scale',
  'scale-colors-length',
  'outside-progress-domain',
  'too-many-axes',
  'non-finite-number',
  'preset-incompatible',
  'currency-required',
  'static-label-without-name',
  'percent-axis-configured',
  'percent-axis-shared',
  'percent-value-unit-required',
];

describe('fixtures', () => {
  test.each(INVALID_FIXTURES)('%s rejected with expected rule and path', (id) => {
    const expected = loadExpected(id);
    const err = catchErr(() => validateSpec(loadInvalid(id)));
    expect(err).toBeInstanceOf(InvalidSpecError);
    expect(err).toMatchObject(expected);
    expect(err.message).toMatch(/\S/);
    expect(err.issues[0]).toMatchObject({ rule: expected.rule, path: expected.path });
  });

  test.each(SECTION_6_RULES)('section 6 rule %s has a fixture', (rule) => {
    expect(INVALID_FIXTURES).toContain(rule);
    expect(loadExpected(rule).rule).toBe(rule);
  });

  test('the design item-9 fixtures exist', () => {
    for (const id of [
      'invalid-infinite-value',
      'invalid-string-number',
      'invalid-unknown-field',
      'invalid-bar-domain',
      'invalid-percent-negative',
    ]) {
      expect(INVALID_FIXTURES).toContain(id);
    }
    expect(loadExpected('invalid-unknown-field')).toMatchObject({ path: '/colour' });
  });

  test('duplicate-chart-embedding is an options rule id only', () => {
    expect(DUPLICATE_CHART_EMBEDDING).toBe('duplicate-chart-embedding');
  });

  test.each([
    'min-bar',
    'min-line',
    'min-area',
    'min-composed',
    'min-scatter',
    'min-donut',
    'min-heatmap',
    'min-progress',
  ])('valid fixture %s passes', (id) => {
    expect(validateSpec(loadFixture(id))).toMatchObject({ id });
  });
});

describe('contract', () => {
  test('Infinity from JSON parse is non-finite-number', () => {
    const spec = JSON.parse(
      read('fixtures/valid/min-line.json').replace('"value": 3', '"value": 1e400'),
    );
    expect(catchErr(() => validateSpec(spec))).toMatchObject({
      rule: 'non-finite-number',
      path: '/series/0/points/0/value',
    });
  });

  test('NaN is non-finite-number too', () => {
    const spec = loadFixture('min-line');
    spec.series[0].points[0].value = NaN;
    expect(catchErr(() => validateSpec(spec))).toMatchObject({ rule: 'non-finite-number' });
  });

  test('does not mutate input and returns frozen clone', () => {
    const input = loadFixture('min-line');
    const snapshot = structuredClone(input);
    const out: any = validateSpec(deepFreeze(input));
    expect(input).toEqual(snapshot);
    expect(out).not.toBe(input);
    expect(Object.isFrozen(out)).toBe(true);
    expect(Object.isFrozen(out.series[0])).toBe(true);
    expect(Object.isFrozen(out.series[0].points[0])).toBe(true);
  });

  test('mutating the input after validation does not change the result', () => {
    const input = loadFixture('min-line');
    const out: any = validateSpec(input);
    input.title = 'changed';
    expect(out.title).toBe('Daily total');
  });

  test('markup-looking title is valid text', () => {
    expect(validateSpec(loadFixture('text-markup-title')).title).toBe(
      '</text><script>alert(1)</script>',
    );
  });

  test('whitespace-only text stays valid (ruling R11)', () => {
    const spec = loadFixture('min-line');
    spec.title = '   ';
    expect(validateSpec(spec).title).toBe('   ');
  });

  test('oversized input -> LIMIT_EXCEEDED before schema', () => {
    const spec = loadFixture('min-line');
    spec.description = 'x'.repeat(2 * 1024 * 1024); // also schema-invalid (too long)
    const err = catchErr(() => validateSpec(spec));
    expect(err).toMatchObject({ code: 'LIMIT_EXCEEDED', rule: 'json-bytes', path: '' });
    expect(err.issues).toHaveLength(1);
  });

  test('size is measured in UTF-8 bytes, not characters', () => {
    const spec = loadFixture('min-line');
    spec.title = '€'.repeat(150); // 3 bytes per character
    const text = JSON.stringify(spec);
    const bytes = Buffer.byteLength(text, 'utf8');
    expect(bytes).toBeGreaterThan(text.length);
    expect(
      catchErr(() => validateSpec(spec, { limits: { jsonBytes: text.length } })),
    ).toMatchObject({
      code: 'LIMIT_EXCEEDED',
      rule: 'json-bytes',
    });
    expect(validateSpec(spec, { limits: { jsonBytes: bytes } }).title).toBe(spec.title);
  });

  test('lower limits allowed, raising throws INVALID_OPTIONS', () => {
    const twoSeries = loadFixture('min-line');
    twoSeries.series.push({ ...structuredClone(twoSeries.series[0]), id: 't2' });
    expect(
      catchErr(() => validateSpec(loadFixture('min-line'), { limits: { series: 17 } })),
    ).toMatchObject({ code: 'INVALID_OPTIONS' });
    expect(catchErr(() => validateSpec(twoSeries, { limits: { series: 1 } }))).toMatchObject({
      code: 'LIMIT_EXCEEDED',
      rule: 'series-count',
      path: '/series',
    });
    expect(validateSpec(twoSeries, { limits: { series: 2 } })).toBeTruthy();
  });

  test('invalid limit options throw INVALID_OPTIONS', () => {
    const spec = loadFixture('min-line');
    for (const limits of [{ series: 1.5 }, { series: -1 }, { bogus: 1 }, { series: 'x' }, 5]) {
      const err = catchErr(() => validateSpec(spec, { limits } as any));
      expect(err).toBeInstanceOf(DravenVizError);
      expect(err).not.toBeInstanceOf(InvalidSpecError);
      expect(err.code).toBe('INVALID_OPTIONS');
    }
    expect(catchErr(() => isValidSpec(spec, { limits: { jsonBytes: 1e9 } }))).toMatchObject({
      code: 'INVALID_OPTIONS',
    });
  });

  test('DEFAULT_LIMITS matches design section 6 and is frozen', () => {
    expect(DEFAULT_LIMITS).toEqual({
      series: 16,
      cartesianPoints: 10_000,
      barCategories: 250,
      donutSlices: 32,
      heatmapCells: 2_500,
      jsonBytes: 2 * 1024 * 1024,
      annotations: 16,
      referenceLines: 16,
      progressItems: 20,
    });
    expect(Object.isFrozen(DEFAULT_LIMITS)).toBe(true);
  });

  test('each limit can be lowered and yields LIMIT_EXCEEDED', () => {
    const cases: [string, unknown, Record<string, number>, string, string][] = [
      [
        'cartesianPoints',
        loadFixture('min-line'),
        { cartesianPoints: 2 },
        'cartesian-points',
        '/series',
      ],
      [
        'barCategories',
        loadFixture('min-bar'),
        { barCategories: 1 },
        'bar-categories',
        '/xAxis/categories',
      ],
      ['donutSlices', loadFixture('min-donut'), { donutSlices: 1 }, 'donut-slices', '/slices'],
      ['heatmapCells', loadFixture('min-heatmap'), { heatmapCells: 1 }, 'heatmap-cells', '/cells'],
      [
        'progressItems',
        loadFixture('min-progress'),
        { progressItems: 1 },
        'progress-items',
        '/items',
      ],
      ['jsonBytes', loadFixture('min-line'), { jsonBytes: 100 }, 'json-bytes', ''],
      [
        'referenceLines',
        loadFixture('min-composed'),
        { referenceLines: 0 },
        'reference-line-count',
        '/referenceLines',
      ],
      [
        'annotations',
        { ...loadFixture('min-line'), annotations: [{ id: 'n1', x: '2026-07-01', label: 'Note' }] },
        { annotations: 0 },
        'annotation-count',
        '/annotations',
      ],
    ];
    for (const [name, spec, limits, rule, p] of cases) {
      const err = catchErr(() => validateSpec(spec, { limits }));
      expect(err, name).toMatchObject({ code: 'LIMIT_EXCEEDED', rule, path: p });
    }
  });

  test('semantic errors win over limits (order: bytes, schema, semantic, limits)', () => {
    const spec = loadFixture('min-bar');
    spec.series[0].points[1].x = 'east';
    expect(catchErr(() => validateSpec(spec, { limits: { barCategories: 1 } }))).toMatchObject({
      rule: 'x-not-in-categories',
    });
  });

  test('schema errors stop before semantic rules', () => {
    const spec = loadFixture('min-bar');
    spec.series[0].points[1].x = 'east';
    spec.colour = 'red';
    const rules = issuesOf(spec).map((i) => i.rule);
    expect(rules).toEqual(['schema-additionalProperties']);
  });

  test('chartId is set when readable', () => {
    const spec = loadFixture('min-bar');
    spec.series[0].yAxisId = 'nope';
    expect(catchErr(() => validateSpec(spec)).chartId).toBe('min-bar');
    expect(catchErr(() => validateSpec({ id: 'bad id!' })).chartId).toBeUndefined();
    expect(catchErr(() => validateSpec(null)).chartId).toBeUndefined();
  });

  test('error message is the first issue message; no data values', () => {
    const err = catchErr(() => validateSpec(loadInvalid('negative-slice')));
    expect(err.message).toBe(err.issues[0].message);
    expect(err.message).not.toMatch(/-3/);
  });

  test('issues are capped at 50', () => {
    const spec = loadFixture('min-donut');
    spec.slices = Array.from({ length: 32 }, (_, i) => ({ id: `s${i}`, label: 'x', value: -1 }));
    const spec2 = loadFixture('min-heatmap');
    expect(issuesOf(spec)).toHaveLength(32);
    // 100 x 100 heatmap with no cells: 10,000 missing pairs, capped.
    spec2.rows = Array.from({ length: 100 }, (_, i) => ({ id: `r${i}`, label: 'r' }));
    spec2.columns = Array.from({ length: 100 }, (_, i) => ({ id: `c${i}`, label: 'c' }));
    spec2.cells = [];
    expect(issuesOf(spec2).length).toBe(50);
  });

  test('isValidSpec returns ok/errors', () => {
    const ok = isValidSpec(loadFixture('min-bar'));
    expect(ok.ok).toBe(true);
    if (ok.ok) expect(ok.spec.kind).toBe('cartesian');
    const bad = isValidSpec(loadInvalid('unknown-axis'));
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.errors[0]).toMatchObject({ rule: 'unknown-axis' });
  });

  test('non-JSON input is rejected with an InvalidSpecError, not a crash', () => {
    const circular: any = {};
    circular.self = circular;
    for (const bad of [undefined, null, 5, 'x', [], circular, { a: 1n }, () => 1]) {
      const err = catchErr(() => validateSpec(bad));
      expect(err).toBeInstanceOf(InvalidSpecError);
      expect(err.message).toMatch(/\S/);
    }
  });

  test('version constants', () => {
    expect(version).toBe('0.1.0');
    expect(version).toBe(readJson('package.json').version);
    expect(SCHEMA_VERSION).toBe(1);
  });

  test('error class shape', () => {
    const err = new InvalidSpecError([{ rule: 'r', path: '/p', message: 'fix it' }], {
      chartId: 'c',
    });
    expect(err).toBeInstanceOf(DravenVizError);
    expect(err).toBeInstanceOf(Error);
    expect(err).toMatchObject({
      name: 'InvalidSpecError',
      code: 'INVALID_SPEC',
      rule: 'r',
      path: '/p',
      message: 'fix it',
      chartId: 'c',
    });
    expect(Object.isFrozen(err.issues)).toBe(true);
  });
});

describe('Ajv error mapping', () => {
  const kindless = () => {
    const s = loadFixture('min-line');
    delete s.kind;
    return s;
  };

  test('unknown field: path is the field, message says how to fix', () => {
    const e = issuesOf({ ...loadFixture('min-line'), colour: 'red' })[0] as any;
    expect(e).toMatchObject({ rule: 'schema-additionalProperties', path: '/colour' });
    expect(e.message).toMatch(/Remove unknown field 'colour'/);
  });

  test('missing required field: path is the missing field', () => {
    const s = loadFixture('min-line');
    delete s.xAxis;
    const e = issuesOf(s)[0] as any;
    expect(e).toMatchObject({ rule: 'schema-required', path: '/xAxis' });
    expect(e.message).toMatch(/Add the required field 'xAxis'/);
  });

  test('nested missing field keeps the full pointer', () => {
    const s = loadFixture('min-bar');
    delete s.series[0].points[0].value;
    expect(issuesOf(s)[0]).toMatchObject({ path: '/series/0/points/0/value' });
  });

  test('discriminator: missing and non-string tag', () => {
    const e = issuesOf(kindless())[0] as any;
    expect(e).toMatchObject({ rule: 'schema-discriminator', path: '/kind' });
    expect(e.message).toMatch(/missing or not a string/);
    expect(e.message).toMatch(/cartesian/);
    expect(issuesOf({ ...loadFixture('min-line'), kind: 42 })[0]).toMatchObject({
      rule: 'schema-discriminator',
      path: '/kind',
    });
  });

  test('discriminator: unknown value lists the allowed ones', () => {
    const e = issuesOf({ ...loadFixture('min-line'), kind: 'pie' })[0] as any;
    expect(e.path).toBe('/kind');
    expect(e.message).toMatch(/Unknown value "pie"/);
    expect(e.message).toMatch(/allowed: .*donut.*heatmap.*progress/);
  });

  test('discriminator on nested axis scale and domain policy', () => {
    const s = loadFixture('min-bar');
    s.xAxis.scale = 'log';
    expect(issuesOf(s)[0]).toMatchObject({ rule: 'schema-discriminator', path: '/xAxis/scale' });
    const t = loadFixture('min-bar');
    t.yAxes[0].domain = {};
    expect(issuesOf(t)[0]).toMatchObject({
      rule: 'schema-discriminator',
      path: '/yAxes/0/domain/policy',
    });
  });

  test('wrong type mentions expected and found types, not the value', () => {
    const e = issuesOf(loadInvalid('invalid-string-number'))[0] as any;
    expect(e.message).toMatch(/number or null/);
    expect(e.message).toMatch(/string/);
    expect(e.message).not.toMatch(/"4"/);
  });

  test('enum lists allowed values', () => {
    const s = loadFixture('min-bar');
    s.series[0].mark = 'pie';
    const e = issuesOf(s)[0] as any;
    expect(e).toMatchObject({ rule: 'schema-enum', path: '/series/0/mark' });
    expect(e.message).toMatch(/bar, line, area, scatter/);
  });

  test('role keys that are not ids are reported once on the key', () => {
    const s = loadFixture('min-bar');
    s.roles = { '1x': {} };
    const issues = issuesOf(s);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ rule: 'schema-propertyNames', path: '/roles/1x' });
  });

  test('time domain pattern failures are classified as time rules', () => {
    const s = loadFixture('min-line');
    s.xAxis.domain = { min: '2026-07-01T10:00', max: 'July' };
    expect(issuesOf(s)).toEqual([
      expect.objectContaining({ rule: 'time-without-offset', path: '/xAxis/domain/min' }),
      expect.objectContaining({ rule: 'invalid-time', path: '/xAxis/domain/max' }),
    ]);
  });

  test('pointer segments are escaped', () => {
    const s = loadFixture('min-bar');
    s.roles = { ok: {} };
    s['a/b~c'] = 1;
    expect(issuesOf(s)[0]).toMatchObject({ path: '/a~1b~0c' });
  });

  test('every message is non-empty and never contains the offending value', () => {
    const s = loadFixture('min-bar');
    s.title = 'secret-value-xyz\u0000';
    const e = issuesOf(s)[0] as any;
    expect(e.message).toMatch(/\S/);
    expect(e.message).not.toMatch(/secret-value-xyz/);
  });
});

describe('semantic rule variants', () => {
  type Case = [string, string, (s: any) => void, string, string];
  const cases: Case[] = [
    // [name, fixture, mutate, rule, path]
    [
      'duplicate series id',
      'min-area',
      (s) => (s.series[1].id = 'a'),
      'duplicate-id',
      '/series/1/id',
    ],
    [
      'duplicate category',
      'min-bar',
      (s) => (s.xAxis.categories = ['north', 'north']),
      'duplicate-id',
      '/xAxis/categories/1',
    ],
    [
      'y axis id equals x axis id',
      'min-bar',
      (s) => (s.yAxes[0].id = 'region'),
      'duplicate-id',
      '/yAxes/0/id',
    ],
    [
      'duplicate slice id',
      'min-donut',
      (s) => (s.slices[1].id = 'a'),
      'duplicate-id',
      '/slices/1/id',
    ],
    [
      'duplicate heatmap column id',
      'min-heatmap',
      (s) => (s.columns[1].id = 'c1'),
      'duplicate-id',
      '/columns/1/id',
    ],
    [
      'duplicate progress item id',
      'min-progress',
      (s) => (s.items[1].id = 'a'),
      'duplicate-id',
      '/items/1/id',
    ],
    [
      'duplicate reference line id',
      'min-composed',
      (s) => s.referenceLines.push({ id: 'goal', axisId: 'pct', value: 5 }),
      'duplicate-id',
      '/referenceLines/1/id',
    ],
    [
      'reference line on unknown axis',
      'min-composed',
      (s) => (s.referenceLines[0].axisId = 'zz'),
      'unknown-axis',
      '/referenceLines/0/axisId',
    ],
    [
      'reference line role unknown',
      'min-composed',
      (s) => (s.referenceLines[0].role = 'zz'),
      'unknown-role',
      '/referenceLines/0/role',
    ],
    [
      'point role unknown',
      'min-bar',
      (s) => (s.series[0].points[0].role = 'zz'),
      'unknown-role',
      '/series/0/points/0/role',
    ],
    [
      'slice role unknown',
      'min-donut',
      (s) => (s.slices[0].role = 'zz'),
      'unknown-role',
      '/slices/0/role',
    ],
    [
      'item role unknown',
      'min-progress',
      (s) => (s.items[0].role = 'zz'),
      'unknown-role',
      '/items/0/role',
    ],
    [
      'annotation on unknown axis',
      'min-line',
      (s) => (s.annotations = [{ id: 'n', x: '2026-07-01', yAxisId: 'zz', y: 1, label: 'L' }]),
      'unknown-axis',
      '/annotations/0/yAxisId',
    ],
    [
      'annotation y without axis',
      'min-line',
      (s) => (s.annotations = [{ id: 'n', x: '2026-07-01', y: 1, label: 'L' }]),
      'unknown-axis',
      '/annotations/0/yAxisId',
    ],
    [
      'annotation x not in categories',
      'min-bar',
      (s) => (s.annotations = [{ id: 'n', x: 'east', label: 'L' }]),
      'x-not-in-categories',
      '/annotations/0/x',
    ],
    [
      'reference line x not in categories',
      'min-bar',
      (s) => (s.referenceLines = [{ id: 'r', axisId: 'region', value: 'east' }]),
      'x-not-in-categories',
      '/referenceLines/0/value',
    ],
    [
      'number x on a category axis',
      'min-bar',
      (s) => (s.series[0].points[0].x = 3),
      'mixed-x-types',
      '/series/0/points/0/x',
    ],
    [
      'string x on a linear axis',
      'min-scatter',
      (s) => (s.series[0].points[0].x = 'four'),
      'mixed-x-types',
      '/series/0/points/0/x',
    ],
    [
      'date and instant mixed on one time axis',
      'min-line',
      (s) => (s.series[0].points[2].x = '2026-07-03T00:00:00Z'),
      'mixed-x-types',
      '/series/0/points/2/x',
    ],
    [
      'reference line number on time axis',
      'min-line',
      (s) => (s.referenceLines = [{ id: 'r', axisId: 'day', value: 5 }]),
      'mixed-x-types',
      '/referenceLines/0/value',
    ],
    [
      'duplicate category x in series',
      'min-bar',
      (s) => (s.series[0].points[1].x = 'north'),
      'point-order',
      '/series/0/points/1/x',
    ],
    [
      'line points descending on time axis',
      'min-line',
      (s) => s.series[0].points.reverse(),
      'point-order',
      '/series/0/points/1/x',
    ],
    [
      'two points at the same time',
      'min-line',
      (s) => (s.series[0].points[1].x = '2026-07-01'),
      'point-order',
      '/series/0/points/1/x',
    ],
    [
      'stacked area stackId on a line',
      'min-area',
      (s) => (s.series[1].mark = 'line'),
      'stack-mixed-marks',
      '/series/1/stackId',
    ],
    [
      'stackId on a scatter series',
      'min-scatter',
      (s) => (s.series[0].stackId = 's'),
      'stack-mixed-marks',
      '/series/0/stackId',
    ],
    [
      'fit domain on a bar axis',
      'min-bar',
      (s) => (s.yAxes[0].domain = { policy: 'fit' }),
      'invalid-domain',
      '/yAxes/0/domain/policy',
    ],
    [
      'bubble domain not ascending',
      'min-scatter',
      (s) => (s.bubble.domain = [10, 10]),
      'invalid-domain',
      '/bubble/domain',
    ],
    [
      'time axis domain reversed',
      'min-line',
      (s) => (s.xAxis.domain = { min: '2026-08-01', max: '2026-07-01' }),
      'invalid-domain',
      '/xAxis/domain',
    ],
    [
      'progress domain min >= max',
      'min-progress',
      (s) => (s.domain = { min: 5, max: 5 }),
      'invalid-domain',
      '/domain',
    ],
    [
      'diverging domain wrong length',
      'min-heatmap',
      (s) =>
        (s.scale = {
          type: 'diverging',
          domain: [0, 10],
          colors: ['#000000', '#888888', '#ffffff'],
        }),
      'invalid-domain',
      '/scale/domain',
    ],
    [
      'threshold domain not ascending',
      'min-heatmap',
      (s) =>
        (s.scale = {
          type: 'threshold',
          domain: [5, 5],
          colors: ['#000000', '#888888', '#ffffff'],
        }),
      'invalid-domain',
      '/scale/domain',
    ],
    [
      'sequential colors count',
      'min-heatmap',
      (s) => (s.scale = { type: 'threshold', domain: [1, 2], colors: ['#000000', '#ffffff'] }),
      'scale-colors-length',
      '/scale/colors',
    ],
    [
      'clip-indicated bar domain is allowed',
      'min-bar',
      (s) =>
        (s.yAxes[0].domain = { policy: 'fixed', min: 10, max: 20, overflow: 'clip-indicated' }),
      '',
      '',
    ],
    [
      'marker-only on a null gives the point path',
      'min-line',
      (s) => (s.series[0].points[1].renderHint = 'marker-only'),
      'marker-without-value',
      '/series/0/points/1/renderHint',
    ],
    [
      'render hint on scatter',
      'min-scatter',
      (s) => (s.series[0].points[0].renderHint = 'gap'),
      'render-hint-on-bar',
      '/series/0/points/0/renderHint',
    ],
    [
      'size on a line point',
      'min-line',
      (s) => (s.series[0].points[0].size = 5),
      'size-without-bubble',
      '/series/0/points/0/size',
    ],
    [
      'ISO day 30 of February',
      'min-line',
      (s) => (s.series[0].points[0].x = '2026-02-30'),
      'invalid-time',
      '/series/0/points/0/x',
    ],
    [
      'unrecognised time text',
      'min-line',
      (s) => (s.series[0].points[0].x = 'July'),
      'invalid-time',
      '/series/0/points/0/x',
    ],
    [
      'negative donut slice -0.001',
      'min-donut',
      (s) => (s.slices[0].value = -0.001),
      'negative-slice',
      '/slices/0/value',
    ],
    [
      'heatmap cell with unknown row',
      'min-heatmap',
      (s) => (s.cells[0].row = 'zz'),
      'unknown-cell-ref',
      '/cells/0/row',
    ],
    [
      'heatmap cell below scale',
      'min-heatmap',
      (s) => (s.cells[0].value = -1),
      'value-outside-scale',
      '/cells/0/value',
    ],
    [
      'progress target outside domain',
      'min-progress',
      (s) => (s.items[0].target = 101),
      'outside-progress-domain',
      '/items/0/target',
    ],
    [
      'progress overflow clip-indicated allows it',
      'min-progress',
      (s) => ((s.overflow = 'clip-indicated'), (s.items[0].value = 120)),
      '',
      '',
    ],
    [
      'ring with seven items',
      'min-progress',
      (s) =>
        (s.items = Array.from({ length: 7 }, (_, i) => ({ id: `i${i}`, label: 'x', value: 1 }))),
      'too-many-items',
      '/items',
    ],
    [
      'bar progress with seven items is fine',
      'min-progress',
      (s) => (
        (s.variant = 'bar'),
        (s.items = Array.from({ length: 7 }, (_, i) => ({ id: `i${i}`, label: 'x', value: 1 })))
      ),
      '',
      '',
    ],
    [
      'sparkline with two y axes',
      'min-composed',
      (s) => ((s.preset = 'sparkline'), (s.series[0].mark = 'line')),
      'preset-incompatible',
      '/yAxes',
    ],
    [
      'sparkline with always-on legend',
      'min-line',
      (s) => ((s.preset = 'sparkline'), (s.legend = { show: 'always' })),
      'preset-incompatible',
      '/legend/show',
    ],
    [
      'compact-stack needs percent stacking',
      'min-bar',
      (s) => ((s.preset = 'compact-stack'), (s.orientation = 'horizontal')),
      'preset-incompatible',
      '/stacking',
    ],
    [
      'compact-stack needs horizontal',
      'min-area',
      (s) => (
        (s.preset = 'compact-stack'),
        (s.stacking = { mode: 'percent', valueUnit: 'u' }),
        (s.yAxes[0] = { id: 'n' }),
        (s.series[0].mark = 'bar'),
        (s.series[1].mark = 'bar')
      ),
      'preset-incompatible',
      '/orientation',
    ],
    [
      'currency code unknown',
      'min-composed',
      (s) => (s.yAxes[0].format.currency = 'ZZZ'),
      'invalid-currency',
      '/yAxes/0/format/currency',
    ],
    [
      'donut currency without code',
      'min-donut',
      (s) => (s.format = { style: 'currency' }),
      'currency-required',
      '/format/currency',
    ],
    [
      'fraction digits reversed',
      'min-donut',
      (s) => (s.format = { minimumFractionDigits: 3, maximumFractionDigits: 1 }),
      'invalid-format',
      '/format/maximumFractionDigits',
    ],
    [
      'static label false needs no name',
      'min-scatter',
      (s) => (delete s.series[0].points[0].datumLabel, (s.series[0].points[0].staticLabel = false)),
      '',
      '',
    ],
    [
      'two stacks on the percent axis',
      'min-area',
      (s) => (
        (s.stacking = { mode: 'percent', valueUnit: 'u' }),
        (s.yAxes[0] = { id: 'n' }),
        (s.series[1].stackId = 't')
      ),
      'percent-axis-shared',
      '/series/1/yAxisId',
    ],
    [
      'percent axis with unit',
      'min-area',
      (s) => (
        (s.stacking = { mode: 'percent', valueUnit: 'u' }),
        (s.yAxes[0] = { id: 'n', unit: 'x' })
      ),
      'percent-axis-configured',
      '/yAxes/0/unit',
    ],
    [
      'percent axis with format',
      'min-area',
      (s) => (
        (s.stacking = { mode: 'percent', valueUnit: 'u' }),
        (s.yAxes[0] = { id: 'n', format: { style: 'percent' } })
      ),
      'percent-axis-configured',
      '/yAxes/0/format',
    ],
    [
      'percent stack on its own axis plus a line on the second axis is valid',
      'min-area',
      (s) => (
        (s.stacking = { mode: 'percent', valueUnit: 'u' }),
        (s.yAxes = [{ id: 'n' }, { id: 'c', unit: 'count' }]),
        s.series.push({
          id: 'l',
          label: 'Count',
          mark: 'line',
          yAxisId: 'c',
          points: [{ id: 'l1', x: 'jan', value: 1 }],
        })
      ),
      '',
      '',
    ],
    [
      'fixed domain excludes a line value',
      'min-line',
      (s) => (s.yAxes[0].domain = { policy: 'fixed', min: 0, max: 4 }),
      'fixed-domain-excludes-data',
      '/yAxes/0/domain',
    ],
    [
      'fixed domain with clip-indicated is fine',
      'min-line',
      (s) => (s.yAxes[0].domain = { policy: 'fixed', min: 0, max: 4, overflow: 'clip-indicated' }),
      '',
      '',
    ],
    [
      'stack total exceeds fixed domain',
      'min-area',
      (s) => (s.yAxes[0].domain = { policy: 'fixed', min: 0, max: 14 }),
      'fixed-domain-excludes-data',
      '/yAxes/0/domain',
    ],
    [
      'bar stack total exceeds fixed domain',
      'min-area',
      (s) => {
        s.yAxes[0].domain = { policy: 'fixed', min: 0, max: 14 };
        for (const x of s.series) x.mark = 'bar';
      },
      'bar-domain-excludes-data',
      '/yAxes/0/domain',
    ],
  ];

  test.each(cases)('%s', (_name, fixture, mutate, rule, p) => {
    const spec = loadFixture(fixture);
    mutate(spec);
    if (rule === '') {
      expect(isValidSpec(spec)).toMatchObject({ ok: true });
      return;
    }
    const issues = issuesOf(spec);
    expect(issues[0], JSON.stringify(issues)).toMatchObject({ rule, path: p });
  });
});
