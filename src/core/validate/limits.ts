import { DravenVizError } from '../errors';
import type { VizSpec } from '../spec/index';
import type { IssueSink } from './issues';

export interface Limits {
  series: number;
  /** Total points across all series of a Cartesian chart. */
  cartesianPoints: number;
  /** Category positions of a category axis that carries bars. */
  barCategories: number;
  donutSlices: number;
  /** Heatmap rows x columns. */
  heatmapCells: number;
  /** UTF-8 bytes of `JSON.stringify(input)`. */
  jsonBytes: number;
  annotations: number;
  referenceLines: number;
  progressItems: number;
}

export const DEFAULT_LIMITS: Readonly<Limits> = Object.freeze({
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

const KEYS = Object.keys(DEFAULT_LIMITS) as (keyof Limits)[];

/** Merge per-call limits over the defaults. Only lowering is allowed. */
export function resolveLimits(partial: unknown): Limits {
  const resolved: Limits = { ...DEFAULT_LIMITS };
  if (partial === undefined) return resolved;
  if (partial === null || typeof partial !== 'object' || Array.isArray(partial)) {
    throw new DravenVizError(
      'INVALID_OPTIONS',
      'options.limits must be an object of limit names to numbers.',
    );
  }
  for (const [name, value] of Object.entries(partial)) {
    if (value === undefined) continue;
    if (!(KEYS as string[]).includes(name)) {
      throw new DravenVizError(
        'INVALID_OPTIONS',
        `Unknown limit '${name}'; known limits: ${KEYS.join(', ')}.`,
      );
    }
    const key = name as keyof Limits;
    if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
      throw new DravenVizError(
        'INVALID_OPTIONS',
        `Limit '${name}' must be a non-negative integer.`,
      );
    }
    if (value > DEFAULT_LIMITS[key]) {
      throw new DravenVizError(
        'INVALID_OPTIONS',
        `Limit '${name}' can only be lowered; the maximum is ${DEFAULT_LIMITS[key]}.`,
      );
    }
    resolved[key] = value;
  }
  return resolved;
}

/** Protection limits on a schema- and semantically-valid spec. */
export function checkLimits(spec: VizSpec, limits: Limits, sink: IssueSink): void {
  const over = (rule: string, path: string, what: string, count: number, max: number) => {
    if (count > max)
      sink.add(
        rule,
        path,
        `${what} is ${count}, over the limit of ${max}. Reduce it or split the chart.`,
      );
  };
  switch (spec.kind) {
    case 'cartesian': {
      over('series-count', '/series', 'Series count', spec.series.length, limits.series);
      let points = 0;
      for (const s of spec.series) points += s.points.length;
      over('cartesian-points', '/series', 'Total point count', points, limits.cartesianPoints);
      if (spec.xAxis.scale === 'category' && spec.series.some((s) => s.mark === 'bar')) {
        over(
          'bar-categories',
          '/xAxis/categories',
          'Bar category count',
          spec.xAxis.categories.length,
          limits.barCategories,
        );
      }
      over(
        'reference-line-count',
        '/referenceLines',
        'Reference line count',
        spec.referenceLines?.length ?? 0,
        limits.referenceLines,
      );
      over(
        'annotation-count',
        '/annotations',
        'Annotation count',
        spec.annotations?.length ?? 0,
        limits.annotations,
      );
      break;
    }
    case 'donut':
      over('donut-slices', '/slices', 'Slice count', spec.slices.length, limits.donutSlices);
      break;
    case 'heatmap':
      over(
        'heatmap-cells',
        '/cells',
        'Heatmap cell count (rows x columns)',
        spec.rows.length * spec.columns.length,
        limits.heatmapCells,
      );
      break;
    case 'progress':
      over('progress-items', '/items', 'Item count', spec.items.length, limits.progressItems);
      break;
  }
}

/** Rule ids of limit issues; an error made only of these has code LIMIT_EXCEEDED. */
export const LIMIT_RULES: ReadonlySet<string> = new Set([
  'json-bytes',
  'series-count',
  'cartesian-points',
  'bar-categories',
  'donut-slices',
  'heatmap-cells',
  'reference-line-count',
  'annotation-count',
  'progress-items',
]);
