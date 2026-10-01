import type { CSSProperties, ReactElement } from 'react';
import type { MarkerShape } from '../../core/index';
import type { MarkerVariant } from '../model/types';

export interface MarkerProps {
  cx: number;
  cy: number;
  /** `none` is drawn as a circle: a marker that is asked for is never invisible. */
  shape: MarkerShape;
  variant: MarkerVariant;
  color: string;
  /** Chart background, used for hollow fills and the halo that separates filled markers. */
  background: string;
  /** Marker diameter in logical units (theme `marker.size`). */
  size: number;
  hollowStroke: number;
}

const style = (s: { fill: string; stroke: string; strokeWidth: number }): CSSProperties => ({
  fill: s.fill,
  stroke: s.stroke,
  strokeWidth: s.strokeWidth,
  strokeDasharray: 'none',
  opacity: 1,
});

/** Closed outline of `shape` centred on (cx, cy) with bounding-box centre exactly (cx, cy). */
function outline(shape: Exclude<MarkerShape, 'none' | 'cross'>, cx: number, cy: number, r: number) {
  switch (shape) {
    case 'square': {
      const h = r * 0.9;
      return { kind: 'rect' as const, x: cx - h, y: cy - h, size: 2 * h };
    }
    case 'diamond': {
      const d = r * 1.3;
      return {
        kind: 'poly' as const,
        d: `M${cx} ${cy - d}L${cx + d} ${cy}L${cx} ${cy + d}L${cx - d} ${cy}Z`,
      };
    }
    case 'triangle': {
      const w = r * 1.15;
      const h = r * 0.95;
      return {
        kind: 'poly' as const,
        d: `M${cx} ${cy - h}L${cx + w} ${cy + h}L${cx - w} ${cy + h}Z`,
      };
    }
    default:
      return { kind: 'circle' as const, r };
  }
}

/**
 * Marker shapes (design 5.2): `filled`, `hollow` (partial: background fill, coloured outline) and
 * `ringed` (lagging: filled with an outer ring). Everything is absolute coordinates inside one
 * `<g>`, so the group's bounding-box centre is the data position.
 */
export function Marker(props: MarkerProps): ReactElement {
  const { cx, cy, variant, color, background, size, hollowStroke } = props;
  const shape: MarkerShape = props.shape === 'none' ? 'circle' : props.shape;
  const r = size / 2;
  const halo = Math.max(1, hollowStroke / 2);

  if (shape === 'cross') {
    const arm = r * 1.2;
    const w = Math.max(hollowStroke, 1.5);
    const cross = `M${cx - arm} ${cy}L${cx + arm} ${cy}M${cx} ${cy - arm}L${cx} ${cy + arm}`;
    return (
      <g>
        {variant === 'ringed' ? (
          <circle
            cx={cx}
            cy={cy}
            r={arm * 1.6}
            style={style({ fill: 'none', stroke: color, strokeWidth: hollowStroke })}
          />
        ) : null}
        <path
          d={cross}
          style={style({
            fill: 'none',
            stroke: color,
            strokeWidth: variant === 'hollow' ? w * 0.7 : w,
          })}
        />
      </g>
    );
  }

  const o = outline(shape, cx, cy, r);
  const fill = variant === 'hollow' ? background : color;
  const stroke = variant === 'hollow' ? color : background;
  const strokeWidth = variant === 'hollow' ? hollowStroke : halo;
  const body =
    o.kind === 'circle' ? (
      <circle cx={cx} cy={cy} r={o.r} style={style({ fill, stroke, strokeWidth })} />
    ) : o.kind === 'rect' ? (
      <rect
        x={o.x}
        y={o.y}
        width={o.size}
        height={o.size}
        style={style({ fill, stroke, strokeWidth })}
      />
    ) : (
      <path d={o.d} style={style({ fill, stroke, strokeWidth })} />
    );
  return (
    <g>
      {variant === 'ringed' ? (
        <circle
          cx={cx}
          cy={cy}
          r={r * 1.75}
          style={style({ fill: 'none', stroke: color, strokeWidth: hollowStroke })}
        />
      ) : null}
      {body}
    </g>
  );
}
