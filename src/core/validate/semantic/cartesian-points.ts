import type { CartesianSpec } from '../../spec/index';
import { type IssueSink, ptr } from '../issues';
import { checkRole, checkUniqueIds } from './common';
import type { XChecker } from './x-values';

/** Per-series and per-point rules: placement on the x scale, order, hints, sizes and labels. */
export function checkSeriesPoints(spec: CartesianSpec, sink: IssueSink, x: XChecker): void {
  const continuous = spec.xAxis.scale !== 'category';
  spec.series.forEach((series, i) => {
    if (sink.full) return;
    checkRole(sink, spec, series.role, ptr('series', i, 'role'));
    if (series.mark === 'bar' && continuous) {
      sink.add(
        'bar-on-continuous-axis',
        ptr('series', i, 'mark'),
        `Series '${series.id}' is a bar series, but the x axis is ${spec.xAxis.scale}; bars need a category x axis. Use a category axis or another mark.`,
      );
    }
    checkUniqueIds(sink, series.points, ptr('series', i, 'points'), 'point');

    const ordered = series.mark === 'line' || series.mark === 'area';
    let last: number | undefined;
    series.points.forEach((pt, j) => {
      const at = (field: string) => ptr('series', i, 'points', j, field);
      const pos = x.check(pt.x, at('x'));
      if (pos !== undefined && (!continuous || ordered)) {
        if (last !== undefined && pos <= last) {
          sink.add(
            'point-order',
            at('x'),
            continuous
              ? `Points of ${series.mark} series '${series.id}' must be in strictly ascending x order; sort them (DravenViz never reorders data).`
              : `Points of series '${series.id}' must follow the category order, once per category; reorder or remove this point.`,
          );
        }
        last = pos;
      }
      checkRole(sink, spec, pt.role, at('role'));
      if (pt.renderHint === 'marker-only' && pt.value === null) {
        sink.add(
          'marker-without-value',
          at('renderHint'),
          "renderHint 'marker-only' needs a value; set a number or remove the hint.",
        );
      }
      if (pt.renderHint !== undefined && series.mark !== 'line' && series.mark !== 'area') {
        sink.add(
          'render-hint-on-bar',
          at('renderHint'),
          `renderHint is valid on line and area points only; remove it from this ${series.mark} point.`,
        );
      }
      if (pt.size !== undefined && series.mark !== 'scatter') {
        sink.add(
          'size-without-bubble',
          at('size'),
          'size is valid on scatter points only; remove it.',
        );
      } else if (typeof pt.size === 'number' && spec.bubble === undefined) {
        sink.add(
          'size-without-bubble',
          at('size'),
          "A point has a size, so add a 'bubble' encoding to the chart (mode, domain, range).",
        );
      }
      if (pt.staticLabel === true && series.mark === 'scatter' && pt.datumLabel === undefined) {
        sink.add(
          'static-label-without-name',
          at('staticLabel'),
          "staticLabel needs a human-readable 'datumLabel' so no machine id is shown; add one.",
        );
      }
    });
  });
}
