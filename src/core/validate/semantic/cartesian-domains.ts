import type { CartesianSpec } from '../../spec/index';
import { type IssueSink, ptr } from '../issues';
import { percentAxisIds, stackGroups } from './cartesian-stacks';
import type { XChecker } from './x-values';

/** Shape of every declared domain: fixed min < max; bubble domain; time axis domain. */
export function checkDomainShapes(spec: CartesianSpec, sink: IssueSink, x: XChecker): void {
  const minLessThanMax = (min: number, max: number) => min < max;
  spec.yAxes.forEach((axis, a) => {
    if (axis.domain?.policy === 'fixed' && !minLessThanMax(axis.domain.min, axis.domain.max)) {
      sink.add(
        'invalid-domain',
        ptr('yAxes', a, 'domain'),
        'A fixed domain needs min less than max.',
      );
    }
  });
  const ax = spec.xAxis;
  if (
    ax.scale === 'linear' &&
    ax.domain?.policy === 'fixed' &&
    !minLessThanMax(ax.domain.min, ax.domain.max)
  ) {
    sink.add('invalid-domain', '/xAxis/domain', 'A fixed domain needs min less than max.');
  }
  if (ax.scale === 'time' && ax.domain) {
    const min =
      ax.domain.min === undefined ? undefined : x.check(ax.domain.min, '/xAxis/domain/min');
    const max =
      ax.domain.max === undefined ? undefined : x.check(ax.domain.max, '/xAxis/domain/max');
    if (min !== undefined && max !== undefined && min >= max) {
      sink.add('invalid-domain', '/xAxis/domain', 'The time domain needs min earlier than max.');
    }
  }
  if (spec.bubble && !(spec.bubble.domain[0] < spec.bubble.domain[1])) {
    sink.add('invalid-domain', '/bubble/domain', 'The bubble domain needs min less than max.');
  }
}

/** The first offending series per source kind (bar vs other) on an axis. */
interface Offender {
  seriesId: string;
  pointId: string | undefined;
}

/**
 * Axis domain rules: fit is forbidden on bar axes (invalid-domain), and a fixed domain with
 * overflow "error" must contain zero (bar axes) and all data, stack totals included
 * (bar-domain-excludes-data, fixed-domain-excludes-data).
 */
export function checkYDomains(spec: CartesianSpec, sink: IssueSink): void {
  const percent = percentAxisIds(spec);
  const stacked = new Set<number>();
  for (const members of stackGroups(spec).values()) {
    for (const i of members) {
      const mark = spec.series[i]!.mark;
      if (mark === 'bar' || mark === 'area') stacked.add(i);
    }
  }

  spec.yAxes.forEach((axis, a) => {
    if (percent.has(axis.id)) return;
    const onAxis = spec.series.filter((s) => s.yAxisId === axis.id);
    const hasBars = onAxis.some((s) => s.mark === 'bar');
    const d = axis.domain;
    if (hasBars && d?.policy === 'fit') {
      sink.add(
        'invalid-domain',
        ptr('yAxes', a, 'domain', 'policy'),
        `Axis '${axis.id}' carries bars, which must start at zero; use 'include-zero' or a fixed domain that includes 0.`,
      );
    }
    if (d?.policy !== 'fixed' || d.overflow === 'clip-indicated' || !(d.min < d.max)) return;
    const path = ptr('yAxes', a, 'domain');

    if (hasBars && (d.min > 0 || d.max < 0)) {
      sink.add(
        'bar-domain-excludes-data',
        path,
        `Axis '${axis.id}' carries bars but its fixed domain [${d.min}, ${d.max}] excludes zero; include 0 or set overflow to 'clip-indicated'.`,
      );
    }
    const found: { bar?: Offender; other?: Offender } = {};
    const outside = (v: number) => v < d.min || v > d.max;
    const note = (mark: string, o: Offender) => {
      if (mark === 'bar') found.bar ??= o;
      else found.other ??= o;
    };
    // Free-standing series: every value.
    spec.series.forEach((s, i) => {
      if (s.yAxisId !== axis.id || stacked.has(i)) return;
      for (const pt of s.points) {
        if (pt.value !== null && outside(pt.value))
          note(s.mark, { seriesId: s.id, pointId: pt.id });
      }
    });
    // Stacks: per x position, positives and negatives accumulate from zero.
    for (const members of stackGroups(spec).values()) {
      const first = spec.series[members[0]!]!;
      if (first.yAxisId !== axis.id) continue;
      const sums = new Map<string, { pos: number; neg: number }>();
      for (const i of members) {
        for (const pt of spec.series[i]!.points) {
          if (pt.value === null) continue;
          const key = String(pt.x);
          const acc = sums.get(key) ?? { pos: 0, neg: 0 };
          if (pt.value >= 0) acc.pos += pt.value;
          else acc.neg += pt.value;
          sums.set(key, acc);
        }
      }
      for (const [, acc] of sums) {
        if (outside(acc.pos) || outside(acc.neg))
          note(first.mark, { seriesId: first.id, pointId: undefined });
      }
    }
    if (found.bar) {
      sink.add(
        'bar-domain-excludes-data',
        path,
        `Axis '${axis.id}' has a bar value outside its fixed domain [${d.min}, ${d.max}] (series '${found.bar.seriesId}'); widen the domain or set overflow to 'clip-indicated'.`,
      );
    }
    if (found.other) {
      sink.add(
        'fixed-domain-excludes-data',
        path,
        `Axis '${axis.id}' has a value outside its fixed domain [${d.min}, ${d.max}] (series '${found.other.seriesId}'); widen the domain or set overflow to 'clip-indicated'.`,
      );
    }
  });
}
