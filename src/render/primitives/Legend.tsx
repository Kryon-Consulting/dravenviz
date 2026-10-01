import type { ReactElement } from 'react';
import type { Theme } from '../../core/index';
import type { LaidOutChart, TextMeasurer } from '../layout/types';
import type { LegendItem } from '../model/types';
import { Marker } from './Marker';
import { baselineAt, estimatedDashArray, strokeStyle } from './style';
import { DvText } from './Text';

export interface LegendProps {
  laid: LaidOutChart;
  theme: Theme;
  family: string;
  measure: TextMeasurer;
}

function Swatch(props: {
  item: LegendItem;
  x: number;
  width: number;
  midY: number;
  theme: Theme;
  /** Whether the series draws markers on its line (`marker.show: "all"`). */
  withMarker: boolean;
}): ReactElement {
  const { item, x, width, midY, theme, withMarker } = props;
  const cx = x + width / 2;
  const color = item.color ?? theme.color.text;
  const line = (extra: Parameters<typeof strokeStyle>[0]): ReactElement => (
    <line x1={x} y1={midY} x2={x + width} y2={midY} style={strokeStyle(extra)} />
  );
  if (item.kind === 'quality') {
    if (item.variant === 'dashed-segment') {
      return line({
        color,
        width: theme.stroke.line,
        dashArray: estimatedDashArray(theme.stroke.line),
      });
    }
    return (
      <Marker
        cx={cx}
        cy={midY}
        shape="circle"
        variant={item.variant === 'ringed' ? 'ringed' : 'hollow'}
        color={color}
        background={theme.color.background}
        size={theme.marker.size}
        hollowStroke={theme.marker.hollowStroke}
      />
    );
  }
  return (
    <g>
      {line({ color, width: theme.stroke.line, dash: item.dash ?? 'solid' })}
      {!withMarker || item.shape === undefined || item.shape === 'none' ? null : (
        <Marker
          cx={cx}
          cy={midY}
          shape={item.shape}
          variant="filled"
          color={color}
          background={theme.color.background}
          size={theme.marker.size}
          hollowStroke={theme.marker.hollowStroke}
        />
      )}
    </g>
  );
}

/**
 * Legend rows as layout wrapped them: items run left to right from the padding, `legendGap`
 * apart, each a swatch, a gap and the wrapped label. Mirrors the allocation in `layoutChart`.
 */
export function Legend({ laid, theme, family, measure }: LegendProps): ReactElement | null {
  if (laid.legendRows.length === 0) return null;
  const sp = theme.spacing;
  const size = theme.text.label * laid.fontScale;
  const lh = size * theme.text.lineHeight;
  const swatch = theme.marker.size * 4;
  const gap = sp.titleGap / 2;
  const rowGap = sp.legendGap / 3;
  const box = laid.boxes.legend;
  let top = box.y;
  return (
    <g data-dv-legend="">
      {laid.legendRows.map((row, r) => {
        const rowTop = top;
        const lines = row.map((item) => laid.legendLabels[item.id] ?? [item.label]);
        top += Math.max(...lines.map((l) => l.length)) * lh + rowGap;
        let x = box.x;
        return (
          <g key={r} data-dv-legend-row="">
            {row.map((item, i) => {
              const itemLines = lines[i] as string[];
              const textW = Math.max(
                0,
                ...itemLines.map((l) => measure(l, { size, weight: 400 }).width),
              );
              const itemX = x;
              x += swatch + gap + textW + sp.legendGap;
              return (
                <g key={item.id} data-dv-legend-item={item.id}>
                  <Swatch
                    item={item}
                    x={itemX}
                    width={swatch}
                    midY={rowTop + lh / 2}
                    theme={theme}
                    withMarker={laid.model.series.some(
                      (s) => s.id === item.id && s.markers.some((m) => m.reason === 'all'),
                    )}
                  />
                  {itemLines.map((line, k) => (
                    <DvText
                      key={k}
                      labelId={`legend-${item.id}`}
                      role="legend"
                      x={itemX + swatch + gap}
                      y={baselineAt(rowTop + k * lh, lh, size)}
                      size={size}
                      weight={400}
                      fill={theme.color.text}
                      family={family}
                    >
                      {line}
                    </DvText>
                  ))}
                </g>
              );
            })}
          </g>
        );
      })}
    </g>
  );
}
