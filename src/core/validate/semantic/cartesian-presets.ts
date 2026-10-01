import type { CartesianSpec } from '../../spec/index';
import { type IssueSink, ptr } from '../issues';

/** horizontal-requires-bars and preset-incompatible. */
export function checkOrientationAndPreset(spec: CartesianSpec, sink: IssueSink): void {
  if (spec.orientation === 'horizontal' && spec.series.some((s) => s.mark !== 'bar')) {
    sink.add(
      'horizontal-requires-bars',
      '/orientation',
      "Horizontal orientation is allowed only when every series is a bar series; use 'vertical' or change the marks.",
    );
  }
  if (spec.preset === 'sparkline') {
    const bad = spec.series.findIndex((s) => s.mark !== 'line' && s.mark !== 'area');
    if (bad >= 0) {
      sink.add(
        'preset-incompatible',
        ptr('series', bad, 'mark'),
        "The 'sparkline' preset allows line and area series only; change the mark or use another preset.",
      );
    }
    if (spec.yAxes.length > 1) {
      sink.add(
        'preset-incompatible',
        '/yAxes',
        "The 'sparkline' preset allows one y axis; remove the second axis.",
      );
    }
    if (spec.legend?.show === 'always') {
      sink.add(
        'preset-incompatible',
        '/legend/show',
        "The 'sparkline' preset omits the legend; remove legend.show 'always'.",
      );
    }
  }
  if (spec.preset === 'compact-stack') {
    if (spec.orientation !== 'horizontal') {
      sink.add(
        'preset-incompatible',
        '/orientation',
        "The 'compact-stack' preset needs orientation 'horizontal'; set it.",
      );
    }
    if (spec.stacking?.mode !== 'percent') {
      sink.add(
        'preset-incompatible',
        '/stacking',
        "The 'compact-stack' preset needs percent stacking; set stacking.mode to 'percent'.",
      );
    }
    const bad = spec.series.findIndex((s) => s.mark !== 'bar');
    if (bad >= 0) {
      sink.add(
        'preset-incompatible',
        ptr('series', bad, 'mark'),
        "The 'compact-stack' preset allows bar series only.",
      );
    }
  }
}
