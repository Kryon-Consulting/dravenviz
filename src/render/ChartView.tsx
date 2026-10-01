import { useMemo } from 'react';
import type { ReactElement } from 'react';
import type { Theme } from '../core/index';
import { createCanvasMeasurer } from './layout/canvas-measure';
import type { LaidOutChart, TextMeasurer } from './layout/types';
import { CartesianChart } from './recharts/CartesianChart';

/** Interaction state the React `Chart` passes in. The print path never sets it. */
export interface InteractionProps {
  /** Where to draw the keyboard focus ring (logical units); null or absent draws none. */
  focus?: { x: number; y: number } | null;
}

export interface ChartViewProps {
  laid: LaidOutChart;
  /** Stamped on the root `<svg>` as `data-dv-render-id`; readiness checks it. */
  renderId: number;
  /** Embedding namespace: the first half of every SVG id and `data-dravenviz-ns`. */
  namespace: string;
  /** Family name of the verified font set (layout was measured with it). */
  fontFamily: string;
  /** The resolved theme layout was computed with. */
  theme: Theme;
  /** Text measurer layout used; defaults to canvas measurement of `fontFamily`. */
  measure?: TextMeasurer;
  interactive?: InteractionProps;
  /** Print `fit` option: `"width"` sizes the chart box to its container. Default `"fixed"`. */
  fit?: 'fixed' | 'width';
}

/**
 * Draws a laid-out chart as one `<svg>` of `laid.width x laid.height` logical units. Slice 1
 * draws Cartesian line charts through Recharts; the other kinds reach the lifecycle as
 * `unsupported` models and never get here.
 */
export function ChartView(props: ChartViewProps): ReactElement {
  const { laid, renderId, namespace, fontFamily, theme } = props;
  const measure = useMemo(
    () => props.measure ?? createCanvasMeasurer(fontFamily),
    [props.measure, fontFamily],
  );
  return (
    <CartesianChart
      laid={laid}
      theme={theme}
      renderId={renderId}
      namespace={namespace}
      family={fontFamily}
      measure={measure}
      focus={props.interactive?.focus ?? null}
      {...(props.fit === undefined ? {} : { fit: props.fit })}
    />
  );
}
