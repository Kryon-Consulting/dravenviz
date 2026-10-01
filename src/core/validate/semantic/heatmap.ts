import type { HeatmapSpec } from '../../spec/index';
import { type IssueSink, ptr } from '../issues';
import { checkFormat, checkUniqueIds } from './common';

/** True when every value is strictly greater than the one before it. */
const ascending = (xs: readonly number[]): boolean => xs.every((x, i) => i === 0 || x > xs[i - 1]!);

/** Validates the scale shape; returns the [min, max] range values must lie in, if one applies. */
function checkScale(spec: HeatmapSpec, sink: IssueSink): [number, number] | undefined {
  const { type, domain, colors } = spec.scale;
  const want: Record<string, number> = { sequential: 2, diverging: 3 };
  let shapeOk = true;
  if (type !== 'threshold' && domain.length !== want[type]) {
    shapeOk = false;
    sink.add(
      'invalid-domain',
      '/scale/domain',
      type === 'sequential'
        ? 'A sequential scale needs a domain of exactly 2 numbers: [min, max].'
        : 'A diverging scale needs a domain of exactly 3 numbers: [min, mid, max].',
    );
  }
  if (!ascending(domain)) {
    shapeOk = false;
    sink.add('invalid-domain', '/scale/domain', 'Scale domain values must be strictly ascending.');
  }
  const minColors = type === 'threshold' ? domain.length + 1 : type === 'diverging' ? 3 : 2;
  const colorsOk = type === 'threshold' ? colors.length === minColors : colors.length >= minColors;
  if (!colorsOk) {
    sink.add(
      'scale-colors-length',
      '/scale/colors',
      type === 'threshold'
        ? `A threshold scale with ${domain.length} breakpoint(s) needs exactly ${minColors} colors.`
        : `A ${type} scale needs at least ${minColors} colors.`,
    );
  }
  if (!shapeOk || type === 'threshold') return undefined;
  return [domain[0], domain[domain.length - 1]!];
}

export function checkHeatmap(spec: HeatmapSpec, sink: IssueSink): void {
  checkUniqueIds(sink, spec.rows, '/rows', 'row');
  checkUniqueIds(sink, spec.columns, '/columns', 'column');
  const range = checkScale(spec, sink);
  checkFormat(sink, spec.format, '/format');

  const rowIds = new Set(spec.rows.map((r) => r.id));
  const colIds = new Set(spec.columns.map((c) => c.id));
  const seen = new Set<string>();
  spec.cells.forEach((cell, i) => {
    let known = true;
    if (!rowIds.has(cell.row)) {
      known = false;
      sink.add(
        'unknown-cell-ref',
        ptr('cells', i, 'row'),
        `Cell row '${cell.row}' is not a row id; use one of the declared rows.`,
      );
    }
    if (!colIds.has(cell.column)) {
      known = false;
      sink.add(
        'unknown-cell-ref',
        ptr('cells', i, 'column'),
        `Cell column '${cell.column}' is not a column id; use one of the declared columns.`,
      );
    }
    if (known) {
      const key = `${cell.row}\u0000${cell.column}`;
      if (seen.has(key)) {
        sink.add(
          'duplicate-cell',
          ptr('cells', i),
          `Row '${cell.row}' and column '${cell.column}' already have a cell; keep exactly one.`,
        );
      }
      seen.add(key);
    }
    if (range && cell.value !== null && (cell.value < range[0] || cell.value > range[1])) {
      sink.add(
        'value-outside-scale',
        ptr('cells', i, 'value'),
        `Cell (${cell.row}, ${cell.column}) is outside the scale domain [${range[0]}, ${range[1]}]; widen the domain or fix the value.`,
      );
    }
  });
  for (const row of spec.rows) {
    for (const col of spec.columns) {
      if (sink.full) return;
      if (!seen.has(`${row.id}\u0000${col.id}`)) {
        sink.add(
          'missing-cell',
          '/cells',
          `No cell for row '${row.id}' and column '${col.id}'; add one (value null if not measured).`,
        );
      }
    }
  }
}
