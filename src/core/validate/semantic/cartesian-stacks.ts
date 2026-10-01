import type { CartesianSpec, Series } from '../../spec/index';
import { type IssueSink, ptr } from '../issues';

const STACKABLE = new Set(['bar', 'area']);

/** Series indices sharing each stackId, in series order. */
export function stackGroups(spec: CartesianSpec): Map<string, number[]> {
  const groups = new Map<string, number[]>();
  spec.series.forEach((s, i) => {
    if (s.stackId === undefined) return;
    const g = groups.get(s.stackId);
    if (g) g.push(i);
    else groups.set(s.stackId, [i]);
  });
  return groups;
}

/** stack-mixed-marks and stack-mixed-axes. */
export function checkStackMembers(spec: CartesianSpec, sink: IssueSink): void {
  for (const [stackId, members] of stackGroups(spec)) {
    const stackable = members.filter((i) => STACKABLE.has(spec.series[i]!.mark));
    for (const i of members) {
      if (!STACKABLE.has(spec.series[i]!.mark)) {
        sink.add(
          'stack-mixed-marks',
          ptr('series', i, 'stackId'),
          `Only bar and area series can be stacked; remove stackId '${stackId}' from this ${spec.series[i]!.mark} series.`,
        );
      }
    }
    const first: Series | undefined = spec.series[stackable[0] ?? -1];
    if (!first) continue;
    for (const i of stackable.slice(1)) {
      const s = spec.series[i]!;
      if (s.mark !== first.mark) {
        sink.add(
          'stack-mixed-marks',
          ptr('series', i, 'mark'),
          `Stack '${stackId}' mixes ${first.mark} and ${s.mark} series; all members must share one mark.`,
        );
      }
      if (s.yAxisId !== first.yAxisId) {
        sink.add(
          'stack-mixed-axes',
          ptr('series', i, 'yAxisId'),
          `Stack '${stackId}' spans two y axes; all members must use the axis '${first.yAxisId}'.`,
        );
      }
    }
  }
}

/** Y-axis ids dedicated to a percent stack (implicit 0-100 domain). */
export function percentAxisIds(spec: CartesianSpec): Set<string> {
  const ids = new Set<string>();
  if (spec.stacking?.mode !== 'percent') return ids;
  for (const members of stackGroups(spec).values()) {
    for (const i of members) {
      if (STACKABLE.has(spec.series[i]!.mark)) ids.add(spec.series[i]!.yAxisId);
    }
  }
  return ids;
}

/**
 * Percent stacking rules: percent-value-unit-required, negative-in-percent-stack,
 * percent-axis-configured, percent-axis-shared.
 */
export function checkPercentStacks(spec: CartesianSpec, sink: IssueSink): void {
  if (spec.stacking?.mode !== 'percent') return;
  if (spec.stacking.valueUnit === undefined) {
    sink.add(
      'percent-value-unit-required',
      '/stacking/valueUnit',
      'A percent stack needs \'valueUnit\', the unit of the raw member values (for example "items"); add it.',
    );
  }
  const groups = stackGroups(spec);
  for (const members of groups.values()) {
    for (const i of members) {
      if (!STACKABLE.has(spec.series[i]!.mark)) continue;
      spec.series[i]!.points.forEach((pt, j) => {
        if (pt.value !== null && pt.value < 0) {
          sink.add(
            'negative-in-percent-stack',
            ptr('series', i, 'points', j, 'value'),
            'Percent stacks need values >= 0; fix this value or use an absolute stack.',
          );
        }
      });
    }
  }
  // Axis owner: the stack that first uses an axis. Any other series bound to it shares it.
  const owner = new Map<string, string>();
  for (const [stackId, members] of groups) {
    for (const i of members) {
      const s = spec.series[i]!;
      if (STACKABLE.has(s.mark) && !owner.has(s.yAxisId)) owner.set(s.yAxisId, stackId);
    }
  }
  spec.yAxes.forEach((axis, a) => {
    if (!owner.has(axis.id)) return;
    for (const prop of ['domain', 'format', 'unit'] as const) {
      if (axis[prop] !== undefined) {
        sink.add(
          'percent-axis-configured',
          ptr('yAxes', a, prop),
          `Axis '${axis.id}' carries a percent stack: its domain is 0-100 % and its format and title are implied. Remove '${prop}'.`,
        );
      }
    }
  });
  spec.series.forEach((s, i) => {
    const stackOwner = owner.get(s.yAxisId);
    if (stackOwner !== undefined && (s.stackId !== stackOwner || !STACKABLE.has(s.mark))) {
      sink.add(
        'percent-axis-shared',
        ptr('series', i, 'yAxisId'),
        `Axis '${s.yAxisId}' is dedicated to the percent stack '${stackOwner}'; bind this series to the other y axis.`,
      );
    }
  });
}
