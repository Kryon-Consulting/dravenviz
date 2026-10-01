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
}

/**
 * Axis domain rules: fit is forbidden on bar axes (invalid-domain), and a fixed domain with
 * overflow "error" must contain zero (bar axes) and all data, stack totals included
 * (bar-domain-excludes-data, fixed-domain-excludes-data).
 */
export function checkYDomains(spec: CartesianSpec, sink: IssueSink, x: XChecker): void {
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

    let barReported = false;
    if (hasBars && (d.min > 0 || d.max < 0)) {
      barReported = true;
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
        if (pt.value !== null && outside(pt.value)) note(s.mark, { seriesId: s.id });
      }
    });
    // Stacks: per x position, positives and negatives accumulate from zero.
    for (const members of stackGroups(spec).values()) {
      const stackable = members.filter((i) => stacked.has(i));
      const first = spec.series[stackable[0] ?? -1];
      if (first === undefined || first.yAxisId !== axis.id) continue;
      // Keyed by the resolved x position, so equal instants written differently share a total.
      const sums = new Map<
        number,
        { pos: number; neg: number; hasPos: boolean; hasNeg: boolean }
      >();
      for (const i of stackable) {
        for (const pt of spec.series[i]!.points) {
          const at = x.position(pt.x);
          if (pt.value === null || at === undefined) continue;
          const acc = sums.get(at) ?? { pos: 0, neg: 0, hasPos: false, hasNeg: false };
          if (pt.value >= 0) {
            acc.pos += pt.value;
            acc.hasPos = true;
          } else {
            acc.neg += pt.value;
            acc.hasNeg = true;
          }
          sums.set(at, acc);
        }
      }
      for (const acc of sums.values()) {
        if ((acc.hasPos && outside(acc.pos)) || (acc.hasNeg && outside(acc.neg)))
          note(first.mark, { seriesId: first.id });
      }
    }
    if (found.bar && !barReported) {
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

const OUT = 'fixed-domain-excludes-data';

/** Declared x range data must stay inside: linear fixed domain (not clip-indicated) or time domain. */
function declaredXRange(spec: CartesianSpec, x: XChecker): [number, number] | undefined {
  const ax = spec.xAxis;
  if (
    ax.scale === 'linear' &&
    ax.domain?.policy === 'fixed' &&
    ax.domain.overflow !== 'clip-indicated'
  ) {
    return ax.domain.min < ax.domain.max ? [ax.domain.min, ax.domain.max] : undefined;
  }
  if (ax.scale === 'time' && ax.domain) {
    const min = ax.domain.min === undefined ? -Infinity : x.position(ax.domain.min);
    const max = ax.domain.max === undefined ? Infinity : x.position(ax.domain.max);
    if (min === undefined || max === undefined) return undefined;
    return [min, max];
  }
  return undefined;
}

/** fixed-domain-excludes-data for the x axis: points, reference lines and annotations. */
export function checkXDomainData(spec: CartesianSpec, sink: IssueSink, x: XChecker): void {
  const range = declaredXRange(spec, x);
  if (!range) return;
  const outside = (v: unknown): boolean => {
    const at = x.position(v);
    return at !== undefined && (at < range[0] || at > range[1]);
  };
  let reported = false;
  for (const s of spec.series) {
    if (reported) break;
    if (s.points.some((pt) => outside(pt.x))) {
      reported = true;
      sink.add(
        OUT,
        '/xAxis/domain',
        `Series '${s.id}' has points outside the x axis domain; widen the domain or remove those points.`,
      );
    }
  }
  spec.referenceLines?.forEach((r, i) => {
    if (r.axisId === spec.xAxis.id && outside(r.value)) {
      sink.add(
        OUT,
        ptr('referenceLines', i, 'value'),
        `Reference line '${r.id}' is outside the x axis domain; move it or widen the domain.`,
      );
    }
  });
  spec.annotations?.forEach((n, i) => {
    for (const field of ['x', 'x2'] as const) {
      if (outside(n[field])) {
        sink.add(
          OUT,
          ptr('annotations', i, field),
          `Annotation '${n.id}' is outside the x axis domain; move it or widen the domain.`,
        );
      }
    }
  });
}

/** fixed-domain-excludes-data for reference lines and annotation markers bound to a y axis. */
export function checkYOverlayDomains(spec: CartesianSpec, sink: IssueSink): void {
  const percent = percentAxisIds(spec);
  const fixed = new Map<string, { min: number; max: number }>();
  for (const axis of spec.yAxes) {
    const d = axis.domain;
    if (
      d?.policy === 'fixed' &&
      d.overflow !== 'clip-indicated' &&
      d.min < d.max &&
      !percent.has(axis.id)
    ) {
      fixed.set(axis.id, { min: d.min, max: d.max });
    }
  }
  const outside = (axisId: string | undefined, v: unknown): boolean => {
    const d = axisId === undefined ? undefined : fixed.get(axisId);
    return d !== undefined && typeof v === 'number' && (v < d.min || v > d.max);
  };
  spec.referenceLines?.forEach((r, i) => {
    if (outside(r.axisId, r.value)) {
      sink.add(
        OUT,
        ptr('referenceLines', i, 'value'),
        `Reference line '${r.id}' is outside the fixed domain of axis '${r.axisId}'; move it or widen the domain.`,
      );
    }
  });
  spec.annotations?.forEach((n, i) => {
    if (outside(n.yAxisId, n.y)) {
      sink.add(
        OUT,
        ptr('annotations', i, 'y'),
        `Annotation '${n.id}' is outside the fixed domain of axis '${n.yAxisId}'; move it or widen the domain.`,
      );
    }
  });
}
