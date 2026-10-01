import { parseTime } from '../../format/time';
import type { CartesianSpec } from '../../spec/index';
import type { IssueSink } from '../issues';

/**
 * Checks values placed on the x scale (points, reference lines, annotations, time domains) and
 * returns their numeric position: category index, number, or epoch milliseconds.
 */
export interface XChecker {
  check(value: unknown, path: string): number | undefined;
}

export function makeXChecker(spec: CartesianSpec, sink: IssueSink): XChecker {
  const axis = spec.xAxis;
  const categoryIndex = new Map<string, number>();
  if (axis.scale === 'category') axis.categories.forEach((c, i) => categoryIndex.set(c, i));
  let timeKind: 'date' | 'instant' | undefined;

  return {
    check(value, path) {
      if (axis.scale === 'linear') {
        if (typeof value === 'number') return value;
        sink.add('mixed-x-types', path, 'This x axis is linear; use a number here.');
        return undefined;
      }
      if (typeof value !== 'string') {
        sink.add(
          'mixed-x-types',
          path,
          axis.scale === 'category'
            ? 'This x axis is a category axis; use a category key (string) here.'
            : 'This x axis is a time axis; use an ISO 8601 string here.',
        );
        return undefined;
      }
      if (axis.scale === 'category') {
        const idx = categoryIndex.get(value);
        if (idx === undefined) {
          sink.add(
            'x-not-in-categories',
            path,
            `'${value.length > 40 ? value.slice(0, 40) + '…' : value}' is not one of the axis categories; use a listed category key or add it to categories.`,
          );
        }
        return idx;
      }
      const parsed = parseTime(value);
      if (!parsed.ok) {
        sink.add(parsed.rule, path, parsed.message);
        return undefined;
      }
      if (timeKind === undefined) timeKind = parsed.kind;
      else if (timeKind !== parsed.kind) {
        sink.add(
          'mixed-x-types',
          path,
          'A time axis cannot mix date-only values (YYYY-MM-DD) with date-times; use one form throughout.',
        );
        return undefined;
      }
      return parsed.epochMs;
    },
  };
}
