import { parseTime } from '../../format/time';
import type { CartesianSpec } from '../../spec/index';
import type { IssueSink } from '../issues';

/**
 * Checks values placed on the x scale (points, reference lines, annotations, time domains) and
 * returns their numeric position: category index, number, or epoch milliseconds.
 */
export interface XChecker {
  /** Validate `value`, reporting problems at `path`. Returns its position when valid. */
  check(value: unknown, path: string): number | undefined;
  /** Position of `value` without reporting anything (undefined when invalid). */
  position(value: unknown): number | undefined;
}

type Resolved = { pos: number } | { rule: string; message: string };

/** Date-only or instant, decided by the first point of the first series that has points. */
function firstSeriesTimeKind(spec: CartesianSpec): 'date' | 'instant' | undefined {
  for (const s of spec.series) {
    const first = s.points[0];
    if (first === undefined) continue;
    if (typeof first.x !== 'string') return undefined;
    const parsed = parseTime(first.x);
    return parsed.ok ? parsed.kind : undefined;
  }
  return undefined;
}

export function makeXChecker(spec: CartesianSpec, sink: IssueSink): XChecker {
  const axis = spec.xAxis;
  const categoryIndex = new Map<string, number>();
  if (axis.scale === 'category') axis.categories.forEach((c, i) => categoryIndex.set(c, i));
  // The time form is fixed up front so the outlier gets the error, whatever the check order.
  const timeKind = axis.scale === 'time' ? firstSeriesTimeKind(spec) : undefined;
  let seenKind = timeKind;

  function resolve(value: unknown, commit: boolean): Resolved {
    if (axis.scale === 'linear') {
      if (typeof value === 'number') return { pos: value };
      return { rule: 'mixed-x-types', message: 'This x axis is linear; use a number here.' };
    }
    if (typeof value !== 'string') {
      return {
        rule: 'mixed-x-types',
        message:
          axis.scale === 'category'
            ? 'This x axis is a category axis; use a category key (string) here.'
            : 'This x axis is a time axis; use an ISO 8601 string here.',
      };
    }
    if (axis.scale === 'category') {
      const idx = categoryIndex.get(value);
      if (idx !== undefined) return { pos: idx };
      const shown = value.length > 40 ? value.slice(0, 40) + '…' : value;
      return {
        rule: 'x-not-in-categories',
        message: `'${shown}' is not one of the axis categories; use a listed category key or add it to categories.`,
      };
    }
    const parsed = parseTime(value);
    if (!parsed.ok) return { rule: parsed.rule, message: parsed.message };
    if (seenKind === undefined && commit) seenKind = parsed.kind;
    if (seenKind !== undefined && seenKind !== parsed.kind) {
      return {
        rule: 'mixed-x-types',
        message:
          'A time axis cannot mix date-only values (YYYY-MM-DD) with date-times; use the same form as the first point of the first series.',
      };
    }
    return { pos: parsed.epochMs };
  }

  return {
    check(value, path) {
      const r = resolve(value, true);
      if ('pos' in r) return r.pos;
      sink.add(r.rule, path, r.message);
      return undefined;
    },
    position(value) {
      const r = resolve(value, false);
      return 'pos' in r ? r.pos : undefined;
    },
  };
}
