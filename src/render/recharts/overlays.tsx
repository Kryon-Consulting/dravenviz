/**
 * Overlay components: children of the Recharts surface that compute pixel positions with the
 * public hooks `useXAxisScale`, `useYAxisScale`, `usePlotArea` and the domain hooks. They never
 * read Recharts DOM, class names or private state (design section 4).
 */
import { useMemo } from 'react';
import type { ReactElement } from 'react';
import {
  Line,
  usePlotArea,
  useXAxisDomain,
  useXAxisScale,
  useYAxisDomain,
  useYAxisScale,
} from 'recharts';
import type { Theme } from '../../core/index';
import { parseTimeValue } from '../../core/format/time';
import { noteGlyph } from '../layout/index';
import type { LaidOutChart } from '../layout/types';
import type { LineSeriesModel, PointModel } from '../model/types';
import { Marker } from '../primitives/Marker';
import { baselineAt, estimatedDashArray, strokeStyle } from '../primitives/style';
import { DvText } from '../primitives/Text';
import type { ChartIds } from './ids';

export interface OverlayCtx {
  laid: LaidOutChart;
  theme: Theme;
  family: string;
  ids: ChartIds;
}

const finite = (v: number | undefined): v is number => v !== undefined && Number.isFinite(v);

/** The value the x axis scale takes for a point or annotation position. */
function xData(laid: LaidOutChart, p: { xKey: string | number; xValue: number }): string | number {
  return laid.model.x.type === 'category' ? String(p.xKey) : p.xValue;
}

function useXPosition(laid: LaidOutChart): (v: string | number) => number | undefined {
  const xs = useXAxisScale(laid.model.x.id);
  return (v) => xs?.(v, { position: 'middle' });
}

// ---- background, grid and baseline (not part of the manifest) -----------------------------------

export function Backdrop({ laid, theme }: OverlayCtx): ReactElement {
  return (
    <rect
      data-dv-background=""
      x={0}
      y={0}
      width={laid.width}
      height={laid.height}
      style={{ fill: theme.color.background, stroke: 'none', opacity: 1 }}
    />
  );
}

export function GridLines({ laid, theme }: OverlayCtx): ReactElement | null {
  const first = laid.model.yAxes[0];
  const ys = useYAxisScale(first?.id);
  if (first === undefined || ys === undefined) return null;
  const plot = laid.boxes.plot;
  const style = strokeStyle({ color: theme.color.grid, width: theme.stroke.grid });
  const axis = strokeStyle({ color: theme.color.axis, width: theme.stroke.axis });
  const bottom = plot.y + plot.height;
  return (
    <g data-dv-grid="">
      {first.ticks.map((t) => {
        const y = ys(Number(t.value));
        if (!finite(y)) return null;
        return (
          <line
            key={String(t.value)}
            x1={plot.x}
            x2={plot.x + plot.width}
            y1={y}
            y2={y}
            style={style}
          />
        );
      })}
      <line
        data-dv-axis-line="x"
        x1={plot.x}
        x2={plot.x + plot.width}
        y1={bottom}
        y2={bottom}
        style={axis}
      />
    </g>
  );
}

// ---- series: segments and estimated ranges --------------------------------------------------------

/** The chart-data key that carries the values of one segment. */
export const segmentKey = (seriesIndex: number, segmentIndex: number): string =>
  `s${seriesIndex}g${segmentIndex}`;

/**
 * Chart data for the Recharts adapter: one row per x position (every category, or every distinct
 * numeric/time x in ascending order); each segment owns one key, set only at its own points. A
 * row without a value for a segment holds `null`.
 */
export function chartRows(laid: LaidOutChart): Record<string, string | number | null>[] {
  const x = laid.model.x;
  const rows = new Map<number, Record<string, string | number | null>>();
  const rowFor = (p: { xKey: string | number; xValue: number }) => {
    let row = rows.get(p.xValue);
    if (row === undefined) {
      row = { x: xData(laid, p) };
      rows.set(p.xValue, row);
    }
    return row;
  };
  if (x.type === 'category') {
    x.keys.forEach((key, k) => rows.set(k, { x: key }));
  }
  laid.model.series.forEach((series, si) => {
    const points = new Map(series.points.map((p) => [p.id, p]));
    series.segments.forEach((seg, gi) => {
      for (const id of seg.pointIds) {
        const p = points.get(id) as PointModel;
        rowFor(p)[segmentKey(si, gi)] = p.value;
      }
    });
  });
  const ordered = [...rows.entries()].sort((a, b) => a[0] - b[0]).map(([, row]) => row);
  const keys = new Set(
    laid.model.series.flatMap((s, si) => s.segments.map((_, gi) => segmentKey(si, gi))),
  );
  for (const row of ordered) for (const k of keys) row[k] ??= null;
  return ordered;
}

/**
 * One Recharts `Line` per segment, each fed its own data so a break is exact and never depends on
 * null handling. Segments with estimated ranges draw the same curve twice (design 5.2): solid
 * outside the ranges, dashed inside, each clipped by x-range rectangles from the x scale.
 */
export function SeriesLines(
  props: OverlayCtx & { series: LineSeriesModel; index: number },
): ReactElement | null {
  const { laid, ids, series, index } = props;
  const xs = useXAxisScale(laid.model.x.id);
  const plot = laid.boxes.plot;
  const points = useMemo(() => new Map(series.points.map((p) => [p.id, p])), [series]);
  // Recharts re-registers a graphical item whenever one of its object props changes identity, and
  // that updates the store this component subscribes to through the scale hook. Styles are
  // therefore built once per laid-out series, never per render, or the update loops.
  const plans = useMemo(() => {
    const width = series.style.width;
    const base = strokeStyle({ color: series.style.color, width, dash: series.style.dash });
    const solidDash =
      typeof base.strokeDasharray === 'string' && base.strokeDasharray !== 'none'
        ? base.strokeDasharray
        : undefined;
    const estDash = estimatedDashArray(width);
    const estStyle = strokeStyle({ color: series.style.color, width, dashArray: estDash });
    return series.segments.map(() => ({
      base,
      solidDash,
      estDash,
      estStyle,
    }));
  }, [series]);
  const xPx = (id: string): number | undefined => {
    const p = points.get(id);
    return p === undefined ? undefined : xs?.(xData(laid, p), { position: 'middle' });
  };
  const width = series.style.width;
  const lineProps = (
    dataKey: string,
    style: ReturnType<typeof strokeStyle>,
    dashArray: string | undefined,
  ): ReactElement => (
    <Line
      xAxisId={laid.model.x.id}
      yAxisId={series.axisId}
      dataKey={dataKey}
      type={series.interpolation}
      stroke={series.style.color}
      strokeWidth={width}
      {...(dashArray === undefined ? {} : { strokeDasharray: dashArray })}
      style={style}
      dot={false}
      activeDot={false}
      isAnimationActive={false}
      // A segment owns its key; rows between its points that belong to other series or categories
      // hold null, which must be bridged, never broken (breaks between segments are separate keys).
      connectNulls={true}
      legendType="none"
      tooltipType="none"
      zIndex={0}
    />
  );

  const solid: ReactElement[] = [];
  const estimated: ReactElement[] = [];
  const defs: ReactElement[] = [];
  series.segments.forEach((seg, gi) => {
    const { base, solidDash: baseDash, estDash, estStyle } = plans[gi] as (typeof plans)[number];
    const data = segmentKey(index, gi);
    if (seg.estimatedRanges.length === 0) {
      solid.push(
        <g key={gi} data-dv-item="">
          {lineProps(data, base, baseDash)}
        </g>,
      );
      return;
    }
    const spans = seg.estimatedRanges.map(([a, b]) => [xPx(a), xPx(b)] as const);
    const ready = xs !== undefined && spans.every(([a, b]) => finite(a) && finite(b));
    const rect = (x0: number, x1: number, key: string): ReactElement => (
      <rect key={key} x={x0} y={plot.y} width={x1 - x0} height={plot.height} />
    );
    if (!ready) {
      // The scale is not available yet: draw the plain segment; a later render adds the dashes.
      solid.push(
        <g key={gi} data-dv-item="">
          {lineProps(data, base, baseDash)}
        </g>,
      );
      return;
    }
    const edges: [number, number][] = [];
    let cursor = 0;
    for (const [a, b] of spans as [number, number][]) {
      if (a > cursor) edges.push([cursor, a]);
      cursor = Math.max(cursor, b);
    }
    if (laid.width > cursor) edges.push([cursor, laid.width]);
    const solidId = ids.get(`clip:solid:${index}:${gi}`);
    defs.push(
      <clipPath key={`s${gi}`} id={solidId}>
        {edges.map(([x0, x1], k) => rect(x0, x1, String(k)))}
      </clipPath>,
    );
    solid.push(
      <g key={gi} data-dv-item="" clipPath={`url(#${solidId})`}>
        {lineProps(data, base, baseDash)}
      </g>,
    );
    (spans as [number, number][]).forEach(([a, b], ri) => {
      const id = ids.get(`clip:est:${index}:${gi}:${ri}`);
      defs.push(
        <clipPath key={`e${gi}-${ri}`} id={id}>
          {rect(a, b, 'r')}
        </clipPath>,
      );
      estimated.push(
        <g key={`${gi}-${ri}`} data-dv-item="" clipPath={`url(#${id})`}>
          {lineProps(data, estStyle, estDash)}
        </g>,
      );
    });
  });
  return (
    <g data-dv-series={series.id}>
      {defs.length > 0 ? <defs>{defs}</defs> : null}
      {solid.length > 0 ? <g data-dv-mark={`series:${series.id}:segment`}>{solid}</g> : null}
      {estimated.length > 0 ? (
        <g data-dv-mark={`series:${series.id}:estimated`}>{estimated}</g>
      ) : null}
    </g>
  );
}

// ---- markers and clip indicators ----------------------------------------------------------------------

export function SeriesMarkers(
  props: OverlayCtx & { series: LineSeriesModel },
): ReactElement | null {
  const { laid, theme, series } = props;
  const xPos = useXPosition(laid);
  const ys = useYAxisScale(series.axisId);
  if (series.markers.length === 0) return null;
  const points = new Map(series.points.map((p) => [p.id, p]));
  return (
    <g data-dv-mark={`series:${series.id}:marker`}>
      {series.markers.map((m) => {
        const p = points.get(m.pointId) as PointModel;
        const cx = xPos(xData(laid, p));
        const cy = p.value === null ? undefined : ys?.(p.value);
        if (!finite(cx) || !finite(cy)) return null;
        return (
          <g key={m.pointId} data-dv-item="" data-dv-point={m.pointId} data-dv-reason={m.reason}>
            <Marker
              cx={cx}
              cy={cy}
              shape={p.shape ?? series.style.shape}
              variant={m.variant}
              color={p.color ?? series.style.color}
              background={theme.color.background}
              size={theme.marker.size}
              hollowStroke={theme.marker.hollowStroke}
            />
          </g>
        );
      })}
    </g>
  );
}

/** A chevron on the plot edge at the clipped point's x: up for above the maximum, down for below. */
export function ClipIndicators(
  props: OverlayCtx & { series: LineSeriesModel },
): ReactElement | null {
  const { laid, theme, series } = props;
  const xPos = useXPosition(laid);
  if (series.clipped.length === 0) return null;
  const plot = laid.boxes.plot;
  const arm = theme.marker.size * 0.9;
  const depth = theme.marker.size * 0.8;
  const inset = theme.stroke.line;
  const points = new Map(series.points.map((p) => [p.id, p]));
  return (
    <g data-dv-mark={`series:${series.id}:clip-indicator`}>
      {series.clipped.map((c) => {
        const p = points.get(c.pointId) as PointModel;
        const cx = xPos(xData(laid, p));
        if (!finite(cx)) return null;
        const above = c.side === 'above';
        const apex = above ? plot.y + inset : plot.y + plot.height - inset;
        const base = above ? apex + depth : apex - depth;
        return (
          <g key={c.pointId} data-dv-item="" data-dv-point={c.pointId} data-dv-side={c.side}>
            <path
              d={`M${cx - arm} ${base}L${cx} ${apex}L${cx + arm} ${base}`}
              style={strokeStyle({ color: series.style.color, width: theme.stroke.line })}
            />
          </g>
        );
      })}
    </g>
  );
}

// ---- annotations and reference lines --------------------------------------------------------------------

export function Annotations({ laid, theme, family }: OverlayCtx): ReactElement | null {
  const xPos = useXPosition(laid);
  const ysDefault = useYAxisScale(laid.model.yAxes[0]?.id);
  const ysSecond = useYAxisScale(laid.model.yAxes[1]?.id);
  if (laid.model.annotations.length === 0) return null;
  const plot = laid.boxes.plot;
  const size = theme.text.label * laid.fontScale;
  const lh = size * theme.text.lineHeight;
  return (
    <g data-dv-mark="annotation">
      {laid.model.annotations.map((a) => {
        const x = xPos(xData(laid, a));
        if (!finite(x)) return null;
        const x2 =
          a.x2Value === undefined
            ? undefined
            : xPos(xData(laid, { xKey: a.x2Key as string | number, xValue: a.x2Value }));
        const stroke = strokeStyle({
          color: theme.color.annotation,
          width: theme.stroke.reference,
          dash: 'dashed',
        });
        const staticLabel = laid.staticLabels.find((l) => l.kind === 'annotation' && l.id === a.id);
        const glyph = a.noteNumber === undefined ? '' : noteGlyph(a.noteNumber);
        const text = [staticLabel === undefined ? '' : a.label, glyph]
          .filter((s) => s !== '')
          .join(' ');
        const labelWidth = staticLabel?.width ?? 0;
        const left = Math.min(x, x2 ?? x);
        const right = Math.max(x, x2 ?? x);
        // Keep the label inside the plot: flip to the left of the line when it would overflow.
        const flip = right + 4 + labelWidth > plot.x + plot.width;
        const axisY =
          a.yAxisId === undefined
            ? undefined
            : a.yAxisId === laid.model.yAxes[0]?.id
              ? ysDefault
              : ysSecond;
        const pointY = a.y === undefined ? undefined : axisY?.(a.y);
        return (
          <g key={a.id} data-dv-item="" data-dv-annotation={a.id}>
            {x2 !== undefined && finite(x2) ? (
              <rect
                x={left}
                y={plot.y}
                width={Math.max(0, right - left)}
                height={plot.height}
                style={{
                  fill: theme.color.annotation,
                  fillOpacity: 0.08,
                  stroke: 'none',
                  opacity: 1,
                }}
              />
            ) : finite(pointY) ? (
              <circle
                cx={x}
                cy={pointY}
                r={theme.marker.size * 0.9}
                style={strokeStyle({
                  color: theme.color.annotation,
                  width: theme.stroke.reference,
                })}
              />
            ) : (
              <line x1={x} x2={x} y1={plot.y} y2={plot.y + plot.height} style={stroke} />
            )}
            {text === '' ? null : (
              <DvText
                labelId={`annotation-${a.id}`}
                role="annotation"
                x={flip ? left - 4 : right + 4}
                y={baselineAt(plot.y + 2, lh, size)}
                size={size}
                weight={400}
                fill={theme.color.annotation}
                family={family}
                anchor={flip ? 'end' : 'start'}
              >
                {text}
              </DvText>
            )}
          </g>
        );
      })}
    </g>
  );
}

export function ReferenceLines({ laid, theme, family }: OverlayCtx): ReactElement | null {
  const xPos = useXPosition(laid);
  const ys0 = useYAxisScale(laid.model.yAxes[0]?.id);
  const ys1 = useYAxisScale(laid.model.yAxes[1]?.id);
  if (laid.model.referenceLines.length === 0) return null;
  const plot = laid.boxes.plot;
  const size = theme.text.label * laid.fontScale;
  const lh = size * theme.text.lineHeight;
  return (
    <g data-dv-mark="reference">
      {laid.model.referenceLines.map((r) => {
        const label = laid.staticLabels.find((l) => l.kind === 'reference' && l.id === r.id);
        const style = strokeStyle({ color: r.color, width: theme.stroke.reference, dash: r.dash });
        const onX = r.axisId === laid.model.x.id;
        if (onX) {
          const raw =
            laid.model.x.type === 'time' && typeof r.value === 'string'
              ? parseTimeValue(r.value).epochMs
              : laid.model.x.type === 'category'
                ? String(r.value)
                : Number(r.value);
          const x = xPos(raw);
          if (!finite(x)) return null;
          return (
            <g key={r.id} data-dv-item="" data-dv-reference={r.id}>
              <line x1={x} x2={x} y1={plot.y} y2={plot.y + plot.height} style={style} />
              {r.label === undefined || label === undefined ? null : (
                <DvText
                  labelId={`reference-${r.id}`}
                  role="reference"
                  x={x + 4}
                  y={baselineAt(plot.y + 2, lh, size)}
                  size={size}
                  weight={400}
                  fill={r.color}
                  family={family}
                >
                  {r.label}
                </DvText>
              )}
            </g>
          );
        }
        const ys = r.axisId === laid.model.yAxes[0]?.id ? ys0 : ys1;
        const y = ys?.(Number(r.value));
        if (!finite(y)) return null;
        // Label above the line at the right edge; below it when there is no room above.
        const above = y - lh >= plot.y;
        return (
          <g key={r.id} data-dv-item="" data-dv-reference={r.id}>
            <line x1={plot.x} x2={plot.x + plot.width} y1={y} y2={y} style={style} />
            {r.label === undefined || label === undefined ? null : (
              <DvText
                labelId={`reference-${r.id}`}
                role="reference"
                x={plot.x + plot.width - 4}
                y={baselineAt(above ? y - 2 - lh : y + 2, lh, size)}
                size={size}
                weight={400}
                fill={r.color}
                family={family}
                anchor="end"
              >
                {r.label}
              </DvText>
            )}
          </g>
        );
      })}
    </g>
  );
}

// ---- readiness probe ----------------------------------------------------------------------------------------

function YProbe({ id }: { id: string }): ReactElement {
  const domain = useYAxisDomain(id);
  return <g data-dv-probe-y={id} data-dv-domain={JSON.stringify(domain ?? null)} />;
}

/**
 * Reports what Recharts actually computed (plot area and axis domains) as data attributes on a
 * hidden group, so `verifyCommitted` can compare them with layout and the model (design section 9,
 * step 5). `data-dv-interactive` keeps it out of the exported SVG.
 */
export function Probe({ laid }: OverlayCtx): ReactElement {
  const plot = usePlotArea();
  const xDomain = useXAxisDomain(laid.model.x.id);
  return (
    <g
      data-dv-probe=""
      data-dv-interactive=""
      data-dv-plot={plot === undefined ? '' : `${plot.x} ${plot.y} ${plot.width} ${plot.height}`}
      style={{ display: 'none' }}
    >
      <g data-dv-probe-x="" data-dv-domain={JSON.stringify(xDomain ?? null)} />
      {laid.model.yAxes.map((a) => (
        <YProbe key={a.id} id={a.id} />
      ))}
    </g>
  );
}

// ---- keyboard focus ring ----------------------------------------------------------------------------------

/**
 * The visible focus ring for the datum the keyboard has selected. `data-dv-interactive` keeps it
 * out of any exported SVG. It carries no `data-dv-mark`, so it is not part of the manifest.
 */
export function FocusRing({ theme, x, y }: OverlayCtx & { x: number; y: number }): ReactElement {
  return (
    <circle
      data-dv-focus-ring=""
      data-dv-interactive=""
      cx={x}
      cy={y}
      r={theme.marker.size / 2 + 4}
      style={{
        fill: 'none',
        stroke: theme.color.focus,
        strokeWidth: 2,
        strokeDasharray: 'none',
        opacity: 1,
        pointerEvents: 'none',
      }}
    />
  );
}
