import { describe, expect, test } from 'vitest';
import { runDriftCheck } from '../../scripts/check-drift';
import { schemaValidate } from '../../src/core/validate/ajv.gen.js';
import {
  isCartesian,
  isDonut,
  isHeatmap,
  isProgress,
  type VizSpec,
} from '../../src/core/spec/index';
import { loadFixture, read, readJson } from './helpers/files';

const MIN_FIXTURES = [
  'min-bar',
  'min-line',
  'min-area',
  'min-composed',
  'min-scatter',
  'min-donut',
  'min-heatmap',
  'min-progress',
];

const valid = (spec: unknown): boolean => schemaValidate(spec);
const withTitle = (title: string) => ({ ...loadFixture('min-donut'), title });
const line = () => loadFixture('min-line');

test.each(MIN_FIXTURES)('%s passes the schema', (id) => {
  expect(schemaValidate(loadFixture(id))).toBe(true);
});

test('unknown field rejected with its path', () => {
  const bad = { ...loadFixture('min-line'), colour: 'red' };
  expect(schemaValidate(bad)).toBe(false);
  expect(schemaValidate.errors![0]).toMatchObject({ keyword: 'additionalProperties' });
});

test('schema file declares 2020-12 and schemaVersion const 1', () => {
  const s = readJson('schema/viz-spec-v1.schema.json');
  expect(s.$schema).toBe('https://json-schema.org/draft/2020-12/schema');
  expect(s.$defs.SpecBase.properties.schemaVersion.const).toBe(1);
});

test('generated files are up to date', () => {
  expect(runDriftCheck()).toEqual({ ok: true, diffs: [] });
});

test('generated validator has no runtime ajv import', () => {
  expect(read('src/core/validate/ajv.gen.js')).not.toMatch(/from ["']ajv|require\(["']ajv/);
});

describe('§5 constraints expressed by the schema', () => {
  test('unknown field is reported at its path in nested objects', () => {
    const bad = line();
    bad.series[0].points[0].extra = 1;
    expect(valid(bad)).toBe(false);
    expect(schemaValidate.errors).toContainEqual(
      expect.objectContaining({
        keyword: 'additionalProperties',
        instancePath: '/series/0/points/0',
      }),
    );
  });

  test.each([
    ['unknown kind', { kind: 'pie' }],
    ['schemaVersion 2', { schemaVersion: 2 }],
    ['missing title', { title: undefined }],
    ['id starting with a digit', { id: '1abc' }],
    ['id too long', { id: 'a'.repeat(65) }],
    ['id with a space', { id: 'a b' }],
  ])('rejects %s', (_name, patch) => {
    expect(valid({ ...line(), ...patch })).toBe(false);
  });

  test('accepts a 64 character id', () => {
    expect(valid({ ...line(), id: 'a'.repeat(64) })).toBe(true);
  });

  test('text lengths and control characters', () => {
    expect(valid(withTitle(''))).toBe(false);
    expect(valid(withTitle('t'.repeat(200)))).toBe(true);
    expect(valid(withTitle('t'.repeat(201)))).toBe(false);
    expect(valid(withTitle('a\nb'))).toBe(false);
    expect(valid(withTitle('a\u0000b'))).toBe(false);
    expect(valid(withTitle('a\u007fb'))).toBe(false);
    expect(valid(withTitle('a\ud800b'))).toBe(false);
    expect(valid(withTitle('a\udc00b'))).toBe(false);
    expect(valid({ ...loadFixture('min-donut'), description: 'a\ud800b' })).toBe(false);
    expect(valid(withTitle('</text><script>'))).toBe(true);
    const d = (description: string) => ({ ...loadFixture('min-donut'), description });
    expect(valid(d('line one\nline two'))).toBe(true);
    expect(valid(d(''))).toBe(true);
    expect(valid(d('x'.repeat(2000)))).toBe(true);
    expect(valid(d('x'.repeat(2001)))).toBe(false);
    expect(valid(d('tab\there'))).toBe(false);
    const c = (caption: string) => ({ ...loadFixture('min-donut'), caption });
    expect(valid(c('a\nb'))).toBe(true);
    expect(valid(c('x'.repeat(501)))).toBe(false);
  });

  test('newline allowed in annotation detail but not label', () => {
    const spec = (patch: object) => {
      const s = line();
      s.annotations = [{ id: 'n', x: '2026-07-02', label: 'ok', ...patch }];
      return s;
    };
    expect(valid(spec({ detail: 'a\nb' }))).toBe(true);
    expect(valid(spec({ label: 'a\nb' }))).toBe(false);
  });

  test('text length counts characters, not UTF-16 units', () => {
    expect(valid(withTitle('😀'.repeat(200)))).toBe(true);
  });

  test('colors must be #RRGGBB', () => {
    const color = (c: string) => {
      const s = line();
      s.series[0].color = c;
      return s;
    };
    expect(valid(color('#1f4e79'))).toBe(true);
    expect(valid(color('#ABCDEF'))).toBe(true);
    expect(valid(color('#fff'))).toBe(false);
    expect(valid(color('red'))).toBe(false);
    expect(valid(color('#1f4e79ff'))).toBe(false);
  });

  test('enums are enforced', () => {
    const s = line();
    s.series[0].mark = 'pie';
    expect(valid(s)).toBe(false);
    const q = line();
    q.series[0].points[0].quality = 'guess';
    expect(valid(q)).toBe(false);
  });

  test('array bounds: series, yAxes, categories, slices, rows, columns, items', () => {
    const many = (n: number) =>
      Array.from({ length: n }, (_, i) => ({ ...line().series[0], id: `s${i}` }));
    expect(valid({ ...line(), series: many(16) })).toBe(true);
    expect(valid({ ...line(), series: many(17) })).toBe(false);
    expect(valid({ ...line(), series: [] })).toBe(false);
    const axis = line().yAxes[0];
    expect(valid({ ...line(), yAxes: [] })).toBe(false);
    expect(valid({ ...line(), yAxes: [axis, { ...axis, id: 'b' }] })).toBe(true);
    expect(valid({ ...line(), yAxes: [axis, axis, axis] })).toBe(false);

    const cats = (n: number) => {
      const s = loadFixture('min-bar');
      s.xAxis.categories = Array.from({ length: n }, (_, i) => `c${i}`);
      delete s.xAxis.labels;
      return s;
    };
    expect(valid(cats(250))).toBe(true);
    expect(valid(cats(251))).toBe(false);
    expect(valid(cats(0))).toBe(false);

    const slices = (n: number) => ({
      ...loadFixture('min-donut'),
      slices: Array.from({ length: n }, (_, i) => ({ id: `s${i}`, label: 'x', value: 1 })),
    });
    expect(valid(slices(32))).toBe(true);
    expect(valid(slices(33))).toBe(false);
    expect(valid(slices(0))).toBe(false);

    const rc = (key: 'rows' | 'columns', n: number) => ({
      ...loadFixture('min-heatmap'),
      [key]: Array.from({ length: n }, (_, i) => ({ id: `i${i}`, label: 'x' })),
    });
    for (const key of ['rows', 'columns'] as const) {
      expect(valid(rc(key, 100))).toBe(true);
      expect(valid(rc(key, 101))).toBe(false);
      expect(valid(rc(key, 0))).toBe(false);
    }

    const items = (n: number) => ({
      ...loadFixture('min-progress'),
      variant: 'bar',
      items: Array.from({ length: n }, (_, i) => ({ id: `i${i}`, label: 'x', value: 1 })),
    });
    expect(valid(items(20))).toBe(true);
    expect(valid(items(21))).toBe(false);
    expect(valid(items(0))).toBe(false);

    const lines = (key: 'referenceLines' | 'annotations', n: number) => ({
      ...line(),
      [key]: Array.from({ length: n }, (_, i) =>
        key === 'referenceLines'
          ? { id: `r${i}`, axisId: 'v', value: 1 }
          : { id: `a${i}`, x: '2026-07-01', label: 'x' },
      ),
    });
    for (const key of ['referenceLines', 'annotations'] as const) {
      expect(valid(lines(key, 0))).toBe(true);
      expect(valid(lines(key, 16))).toBe(true);
      expect(valid(lines(key, 17))).toBe(false);
    }
  });

  test('number ranges: fraction digits and tick count', () => {
    const fmt = (format: object) => {
      const s = line();
      s.yAxes[0].format = format;
      return s;
    };
    expect(valid(fmt({ maximumFractionDigits: 6, minimumFractionDigits: 0 }))).toBe(true);
    expect(valid(fmt({ maximumFractionDigits: 7 }))).toBe(false);
    expect(valid(fmt({ minimumFractionDigits: -1 }))).toBe(false);
    expect(valid(fmt({ maximumFractionDigits: 1.5 }))).toBe(false);
    const ticks = (count: number) => {
      const s = line();
      s.yAxes[0].ticks = { count };
      return s;
    };
    expect(valid(ticks(2))).toBe(true);
    expect(valid(ticks(10))).toBe(true);
    expect(valid(ticks(1))).toBe(false);
    expect(valid(ticks(11))).toBe(false);
  });

  test('non-finite numbers are rejected', () => {
    const s = JSON.parse(JSON.stringify(line()).replace('"value":3', '"value":1e400'));
    s.series[0].points[0].value = Infinity;
    expect(valid(s)).toBe(false);
  });

  test('domain policy union and bubble tuples', () => {
    const dom = (domain: object) => {
      const s = line();
      s.yAxes[0].domain = domain;
      return s;
    };
    expect(valid(dom({ policy: 'fit' }))).toBe(true);
    expect(valid(dom({ policy: 'fixed', min: 0, max: 1, overflow: 'clip-indicated' }))).toBe(true);
    expect(valid(dom({ policy: 'fixed', min: 0 }))).toBe(false);
    expect(valid(dom({ policy: 'fit', min: 0 }))).toBe(false);
    const bubble = (b: object) => ({ ...loadFixture('min-scatter'), bubble: b });
    expect(valid(bubble({ mode: 'area', domain: [0, 100], range: [2, 18] }))).toBe(true);
    expect(valid(bubble({ mode: 'area', domain: [0, 100, 1], range: [2, 18] }))).toBe(false);
    expect(valid(bubble({ mode: 'area', domain: [-1, 100], range: [2, 18] }))).toBe(false);
    expect(valid(bubble({ mode: 'area', domain: [0, 100], range: [2, -18] }))).toBe(false);
  });

  test('time axis domain accepts ISO days and offset date-times only', () => {
    const dom = (min: string) => {
      const s = line();
      s.xAxis.domain = { min };
      return s;
    };
    expect(valid(dom('2026-07-01'))).toBe(true);
    expect(valid(dom('2026-07-01T10:00:00Z'))).toBe(true);
    expect(valid(dom('2026-07-01T10:00:00+02:00'))).toBe(true);
    expect(valid(dom('2026-07-01T10:00:00'))).toBe(false);
    expect(valid(dom('July'))).toBe(false);
  });

  test('roles is a map of id to RoleDef', () => {
    const roles = (r: object) => ({ ...line(), roles: r });
    expect(valid(roles({ risk: { label: 'Risk', color: '#aa0000', pattern: 'dots' } }))).toBe(true);
    expect(valid(roles({ '1bad': {} }))).toBe(false);
    expect(valid(roles({ risk: { colour: '#aa0000' } }))).toBe(false);
  });

  test('cross-field rules are left to the semantic layer', () => {
    // Schema-valid but semantically wrong; Task 5 owns these.
    const s = line();
    s.series[0].yAxisId = 'does-not-exist';
    s.series.push({ ...s.series[0] });
    expect(valid(s)).toBe(true);
  });
});

describe('first error is the real error (discriminated unions)', () => {
  const first = (spec: unknown) => {
    expect(schemaValidate(spec)).toBe(false);
    return schemaValidate.errors![0];
  };

  test.each(['min-donut', 'min-heatmap', 'min-progress'])(
    '%s with an unknown field reports additionalProperties at the root',
    (id) => {
      expect(first({ ...loadFixture(id), colour: 'red' })).toMatchObject({
        keyword: 'additionalProperties',
        instancePath: '',
        params: { additionalProperty: 'colour' },
      });
    },
  );

  test('donut with a multi-line title reports the title pattern', () => {
    expect(first(withTitle('a\nb'))).toMatchObject({ keyword: 'pattern', instancePath: '/title' });
  });

  test('unknown kind is reported on kind', () => {
    expect(first({ ...line(), kind: 'pie' })).toMatchObject({ instancePath: '' });
  });

  test('time axis with an invalid domain reports under /xAxis/domain', () => {
    const s = line();
    s.xAxis.domain = { min: 'July' };
    const e = first(s);
    expect(e?.instancePath).toBe('/xAxis/domain/min');
    expect(e?.keyword).toBe('pattern');
  });

  test('fixed domain missing max reports the missing property', () => {
    const s = line();
    s.yAxes[0].domain = { policy: 'fixed', min: 0 };
    expect(first(s)).toMatchObject({
      keyword: 'required',
      instancePath: '/yAxes/0/domain',
      params: { missingProperty: 'max' },
    });
  });
});

describe('SpecBase and the kind defs stay in step', () => {
  const schema = readJson('schema/viz-spec-v1.schema.json');
  const base = schema.$defs.SpecBase;
  const kindDefs = ['CartesianSpec', 'DonutSpec', 'HeatmapSpec', 'ProgressSpec'];

  test('SpecBase is closed', () => {
    expect(base.additionalProperties).toBe(false);
  });

  test.each(kindDefs)('%s mirrors SpecBase', (name) => {
    const def = schema.$defs[name];
    for (const key of Object.keys(base.properties).filter((k) => k !== 'kind')) {
      expect(def.properties[key], `${name}.${key}`).toEqual({
        $ref: `#/$defs/SpecBase/properties/${key}`,
      });
    }
    expect(typeof def.properties.kind.const).toBe('string');
    expect(base.properties.kind.enum).toContain(def.properties.kind.const);
    for (const key of base.required) expect(def.required).toContain(key);
  });

  test('every SpecBase kind has a kind def', () => {
    const kinds = kindDefs.map((n) => schema.$defs[n].properties.kind.const).sort();
    expect(kinds).toEqual([...base.properties.kind.enum].sort());
  });
});

describe('kind guards', () => {
  const kinds: [string, (s: VizSpec) => boolean][] = [
    ['min-line', isCartesian],
    ['min-donut', isDonut],
    ['min-heatmap', isHeatmap],
    ['min-progress', isProgress],
  ];
  test.each(kinds)('%s is matched by exactly its own guard', (id, guard) => {
    const spec = loadFixture(id) as VizSpec;
    const matches = [isCartesian, isDonut, isHeatmap, isProgress].filter((g) => g(spec));
    expect(matches).toEqual([guard]);
  });
});
