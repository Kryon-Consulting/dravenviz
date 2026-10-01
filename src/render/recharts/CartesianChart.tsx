import { useMemo } from 'react';
import type { ReactElement } from 'react';
import { ComposedChart, XAxis, YAxis } from 'recharts';
import type { Theme } from '../../core/index';
import type { LaidOutChart, PlacedTick, TextMeasurer } from '../layout/types';
import { AxisTitles } from '../primitives/AxisTitles';
import { EmptyState } from '../primitives/EmptyState';
import { Legend } from '../primitives/Legend';
import { Notes } from '../primitives/Notes';
import { baselineCentred } from '../primitives/style';
import { DvText } from '../primitives/Text';
import { Title } from '../primitives/Title';
import { planIds } from './ids';
import { StyleGuard } from './StyleGuard';
import {
  Annotations,
  chartRows,
  Backdrop,
  ClipIndicators,
  GridLines,
  Probe,
  ReferenceLines,
  SeriesLines,
  SeriesMarkers,
  type OverlayCtx,
} from './overlays';

export interface CartesianChartProps {
  laid: LaidOutChart;
  theme: Theme;
  renderId: number;
  namespace: string;
  family: string;
  measure: TextMeasurer;
}

/** The part of Recharts' tick render props DravenViz reads. */
interface TickRenderProps {
  x?: number | string;
  y?: number | string;
  payload: { value?: unknown };
}

/**
 * The chart `margin` is the space outside the axis boxes, so Recharts' own offset equals
 * `laid.boxes.plot` (design section 4, plot bounds come from DravenViz layout).
 */
export function chartMargin(laid: LaidOutChart): {
  top: number;
  right: number;
  bottom: number;
  left: number;
} {
  const { plot, xAxis } = laid.boxes;
  const widthOf = (side: 'left' | 'right'): number =>
    laid.model.yAxes
      .filter((a) => a.position === side)
      .reduce((sum, a) => sum + (laid.boxes.axes[a.id]?.width ?? 0), 0);
  return {
    top: plot.y,
    left: plot.x - widthOf('left'),
    right: laid.width - (plot.x + plot.width) - widthOf('right'),
    bottom: laid.height - (plot.y + plot.height) - xAxis.height,
  };
}

/**
 * The Cartesian line adapter: one Recharts `ComposedChart` sized to the layout, axes with explicit
 * sizes, scales and domains, and DravenViz overlays as chart children. Recharts' Tooltip, Legend
 * and ResponsiveContainer are not used.
 */
export function CartesianChart(props: CartesianChartProps): ReactElement {
  const { laid, theme, renderId, namespace, family, measure } = props;
  const model = laid.model;
  const x = model.x;
  const ids = useMemo(() => planIds(laid, namespace), [laid, namespace]);
  const ctx: OverlayCtx = { laid, theme, family, ids };
  const size = theme.text.label * laid.fontScale;
  const margin = chartMargin(laid);
  const plotSideGap = theme.spacing.titleGap / 2;

  const xTicks = new Map<string, PlacedTick>(laid.xTicks.map((t) => [String(t.value), t]));
  const renderXTick = (p: TickRenderProps): ReactElement | null => {
    const t = xTicks.get(String(p.payload.value));
    if (t === undefined || !t.visible) return null;
    const lh = size * theme.text.lineHeight;
    if (t.rotate === 0) {
      return (
        <g data-dv-x-tick="">
          {t.lines.map((line, i) => (
            <DvText
              key={i}
              labelId={`x-tick-${String(t.value)}`}
              role="tick"
              x={t.x}
              y={baselineCentred(t.y + (i + 0.5) * lh, size)}
              size={size}
              weight={400}
              fill={theme.color.text}
              family={family}
              anchor="middle"
            >
              {line}
            </DvText>
          ))}
        </g>
      );
    }
    // Rotated -45: layout anchors the end of the text's centre line at (t.x, t.y). Rotating about
    // the baseline point that lands the centre line there keeps text and footprint aligned.
    const off = baselineCentred(0, size) * Math.SQRT1_2;
    return (
      <g data-dv-x-tick="">
        <DvText
          labelId={`x-tick-${String(t.value)}`}
          role="tick"
          x={t.x + off}
          y={t.y + off}
          size={size}
          weight={400}
          fill={theme.color.text}
          family={family}
          anchor="end"
          rotate={-45}
        >
          {t.lines.join(' ')}
        </DvText>
      </g>
    );
  };

  const xAxisCommon = {
    xAxisId: x.id,
    dataKey: 'x',
    interval: 0 as const,
    height: laid.boxes.xAxis.height,
    orientation: 'bottom' as const,
    axisLine: false,
    tickLine: false,
    allowDataOverflow: true,
    padding: { left: 0, right: 0 },
    tick: renderXTick,
  };
  const xAxis =
    x.type === 'category' ? (
      <XAxis {...xAxisCommon} type="category" scale="band" />
    ) : (
      <XAxis
        {...xAxisCommon}
        type="number"
        scale="linear"
        domain={x.domain}
        ticks={x.ticks.map((t) => Number(t.value))}
      />
    );

  const yAxes = model.yAxes.map((axis) => {
    const box = laid.boxes.axes[axis.id];
    const labels = new Map(axis.ticks.map((t) => [String(t.value), t.label]));
    const left = axis.position === 'left';
    const renderYTick = (p: TickRenderProps): ReactElement | null => {
      const label = labels.get(String(p.payload.value));
      if (label === undefined || box === undefined) return null;
      return (
        <DvText
          labelId={`y-tick-${axis.id}-${String(p.payload.value)}`}
          role="tick"
          x={left ? box.x + box.width - plotSideGap : box.x + plotSideGap}
          y={baselineCentred(Number(p.y), size)}
          size={size}
          weight={400}
          fill={theme.color.text}
          family={family}
          anchor={left ? 'end' : 'start'}
        >
          {label}
        </DvText>
      );
    };
    return (
      <YAxis
        key={axis.id}
        yAxisId={axis.id}
        type="number"
        scale="linear"
        domain={axis.domain}
        ticks={axis.ticks.map((t) => Number(t.value))}
        allowDataOverflow={true}
        interval={0}
        width={box?.width ?? 0}
        orientation={axis.position}
        axisLine={false}
        tickLine={false}
        tick={renderYTick}
      />
    );
  });

  const rows = useMemo(() => chartRows(laid), [laid]);

  return (
    <ComposedChart
      width={laid.width}
      height={laid.height}
      margin={margin}
      data={rows}
      accessibilityLayer={false}
      data-dv-render-id={renderId}
      data-dravenviz-ns={namespace}
      data-dravenviz-chart={model.chartId}
      role="img"
      style={{ opacity: 1 }}
      title={model.title}
      {...(model.description === undefined ? {} : { desc: model.description })}
    >
      <StyleGuard />
      <Backdrop {...ctx} />
      <GridLines {...ctx} />
      {xAxis}
      {yAxes}
      {model.series.map((s, i) => (
        <SeriesLines key={`l-${s.id}`} {...ctx} series={s} index={i} />
      ))}
      {model.series.map((s) => (
        <ClipIndicators key={`c-${s.id}`} {...ctx} series={s} />
      ))}
      {model.series.map((s) => (
        <SeriesMarkers key={`m-${s.id}`} {...ctx} series={s} />
      ))}
      <ReferenceLines {...ctx} />
      <Annotations {...ctx} />
      {model.state === 'empty' ? <EmptyState laid={laid} theme={theme} family={family} /> : null}
      <AxisTitles laid={laid} theme={theme} family={family} />
      <Title laid={laid} theme={theme} family={family} />
      <Legend laid={laid} theme={theme} family={family} measure={measure} />
      <Notes laid={laid} theme={theme} family={family} />
      <Probe {...ctx} />
    </ComposedChart>
  );
}
