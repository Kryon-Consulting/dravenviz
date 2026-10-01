import type { CartesianSpec } from '../../spec/index';
import { type IssueSink, ptr } from '../issues';
import {
  checkDomainShapes,
  checkTickValues,
  checkXDomainData,
  checkYDomains,
  checkYOverlayDomains,
} from './cartesian-domains';
import { checkSeriesPoints } from './cartesian-points';
import { checkOrientationAndPreset } from './cartesian-presets';
import { checkPercentStacks, checkStackMembers } from './cartesian-stacks';
import { checkFormat, checkRole, checkUniqueIds } from './common';
import { makeXChecker } from './x-values';

function checkAxes(spec: CartesianSpec, sink: IssueSink): void {
  const ax = spec.xAxis;
  // Axis ids are one namespace: reference lines may name either an x or a y axis.
  const seen = new Set<string>([ax.id]);
  spec.yAxes.forEach((axis, a) => {
    if (seen.has(axis.id)) {
      sink.add(
        'duplicate-id',
        ptr('yAxes', a, 'id'),
        `Duplicate axis id '${axis.id}'; x and y axis ids must all be unique. Rename this axis.`,
      );
    }
    seen.add(axis.id);
    checkFormat(sink, axis.format, ptr('yAxes', a, 'format'));
  });
  if (ax.scale === 'linear') checkFormat(sink, ax.format, '/xAxis/format');
  if (ax.scale === 'category') {
    const cats = new Set<string>();
    ax.categories.forEach((c, i) => {
      if (cats.has(c)) {
        sink.add(
          'duplicate-id',
          ptr('xAxis', 'categories', i),
          `Duplicate category '${c}'; categories must be unique keys.`,
        );
      }
      cats.add(c);
    });
    if (ax.labels !== undefined && ax.labels.length !== ax.categories.length) {
      sink.add(
        'labels-length',
        '/xAxis/labels',
        `labels has ${ax.labels.length} entries but categories has ${ax.categories.length}; provide exactly one label per category.`,
      );
    }
  }
}

function checkAxisReferences(spec: CartesianSpec, sink: IssueSink): void {
  const yIds = new Set(spec.yAxes.map((a) => a.id));
  const allIds = new Set([spec.xAxis.id, ...yIds]);
  spec.series.forEach((s, i) => {
    if (!yIds.has(s.yAxisId)) {
      sink.add(
        'unknown-axis',
        ptr('series', i, 'yAxisId'),
        `Series '${s.id}' refers to y axis '${s.yAxisId}', which is not in yAxes; use an existing axis id.`,
      );
    }
  });
  spec.referenceLines?.forEach((r, i) => {
    if (!allIds.has(r.axisId)) {
      sink.add(
        'unknown-axis',
        ptr('referenceLines', i, 'axisId'),
        `Reference line '${r.id}' refers to axis '${r.axisId}', which does not exist; use an x or y axis id.`,
      );
    }
  });
}

function checkOverlays(
  spec: CartesianSpec,
  sink: IssueSink,
  x: ReturnType<typeof makeXChecker>,
): void {
  const yIds = new Set(spec.yAxes.map((a) => a.id));
  checkUniqueIds(sink, spec.referenceLines, '/referenceLines', 'reference line');
  spec.referenceLines?.forEach((r, i) => {
    checkRole(sink, spec, r.role, ptr('referenceLines', i, 'role'));
    if (r.axisId === spec.xAxis.id) x.check(r.value, ptr('referenceLines', i, 'value'));
    else if (yIds.has(r.axisId) && typeof r.value !== 'number') {
      sink.add(
        'reference-value-type',
        ptr('referenceLines', i, 'value'),
        `Axis '${r.axisId}' is a value axis; use a number for this reference line.`,
      );
    }
  });
  checkUniqueIds(sink, spec.annotations, '/annotations', 'annotation');
  spec.annotations?.forEach((n, i) => {
    x.check(n.x, ptr('annotations', i, 'x'));
    if (n.x2 !== undefined) x.check(n.x2, ptr('annotations', i, 'x2'));
    if (n.yAxisId !== undefined && !yIds.has(n.yAxisId)) {
      sink.add(
        'unknown-axis',
        ptr('annotations', i, 'yAxisId'),
        `Annotation '${n.id}' refers to y axis '${n.yAxisId}', which is not in yAxes.`,
      );
    }
    if (n.y !== undefined && n.yAxisId === undefined) {
      sink.add(
        'unknown-axis',
        ptr('annotations', i, 'yAxisId'),
        `Annotation '${n.id}' has a y position; add 'yAxisId' to name the axis it is bound to.`,
      );
    }
  });
}

export function checkCartesian(spec: CartesianSpec, sink: IssueSink): void {
  checkUniqueIds(sink, spec.series, '/series', 'series');
  checkAxes(spec, sink);
  checkAxisReferences(spec, sink);
  checkOrientationAndPreset(spec, sink);
  const x = makeXChecker(spec, sink);
  checkDomainShapes(spec, sink, x);
  checkTickValues(spec, sink);
  checkSeriesPoints(spec, sink, x);
  checkOverlays(spec, sink, x);
  checkStackMembers(spec, sink);
  checkPercentStacks(spec, sink);
  checkYDomains(spec, sink, x);
  checkXDomainData(spec, sink, x);
  checkYOverlayDomains(spec, sink);
}
