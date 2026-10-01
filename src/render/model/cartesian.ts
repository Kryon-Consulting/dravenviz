import { formatNumber, formatTime, parseTimeValue } from '../../core/format/index';
import type {
  CartesianSpec,
  Dash,
  MarkerShape,
  NumberFormat,
  Point,
  Quality,
  Series,
  Theme,
} from '../../core/index';
import { buildManifest } from './manifest';
import { buildValueScale, toTicks } from './scale';
import { buildMarkers, buildSegments } from './segments';
import { timeTicks } from './ticks';
import type { TimeKind } from './ticks';
import type {
  AnnotationModel,
  CartesianModel,
  ClippedModel,
  LegendItem,
  LineSeriesModel,
  ModelContext,
  PointModel,
  ReferenceLineModel,
  UnsupportedModel,
  XScaleModel,
  YAxisModel,
} from './types';

const DAY = 86_400_000;
const HOUR = 3_600_000;

/** First slice that draws each unsupported thing (design plan: slices 2 and 3). */
function unsupported(spec: { kind: string }): UnsupportedModel | undefined {
  switch (spec.kind) {
    case 'donut':
      return { kind: 'unsupported', reason: 'donut charts are added in slice 2' };
    case 'heatmap':
      return { kind: 'unsupported', reason: 'heatmap charts are added in slice 3' };
    case 'progress':
      return { kind: 'unsupported', reason: 'progress charts are added in slice 3' };
    default:
      return undefined;
  }
}

function unsupportedMark(mark: Series['mark']): UnsupportedModel | undefined {
  if (mark === 'line') return undefined;
  const slice = mark === 'scatter' ? 3 : 2;
  const what = mark === 'bar' ? 'bar series' : mark === 'area' ? 'area series' : 'scatter series';
  return { kind: 'unsupported', reason: `${what} are added in slice ${slice}` };
}

interface RoleLookup {
  color(roleId: string | undefined): string | undefined;
  shape(roleId: string | undefined): MarkerShape | undefined;
}

function roleLookup(spec: CartesianSpec, theme: Theme): RoleLookup {
  return {
    color: (id) => {
      if (id === undefined) return undefined;
      return spec.roles?.[id]?.color ?? theme.roles[id]?.color;
    },
    shape: (id) => {
      if (id === undefined) return undefined;
      return spec.roles?.[id]?.shape ?? theme.roles[id]?.shape;
    },
  };
}

const finite = (v: number | null): v is number => v !== null && Number.isFinite(v);

export function buildCartesianModel(
  spec: CartesianSpec,
  ctx: ModelContext,
): CartesianModel | UnsupportedModel {
  const { theme, locale, timezone } = ctx;
  for (const s of spec.series) {
    const u = unsupportedMark(s.mark);
    if (u) return u;
  }

  const roles = roleLookup(spec, theme);
  const xAxis = spec.xAxis;

  // ---- x positions -------------------------------------------------------------------------
  let timeKind: TimeKind = 'date';
  if (xAxis.scale === 'time') {
    for (const s of spec.series) {
      for (const p of s.points) {
        if (typeof p.x === 'string' && parseTimeValue(p.x).kind === 'instant') timeKind = 'instant';
      }
    }
  }
  const epochOf = (x: string | number): number =>
    typeof x === 'string' ? parseTimeValue(x).epochMs : x;
  const xValueOf = (x: string | number): number => {
    if (xAxis.scale === 'category') return xAxis.categories.indexOf(String(x));
    if (xAxis.scale === 'time') return epochOf(x);
    return Number(x);
  };

  const allX = spec.series.flatMap((s) => s.points.map((p) => xValueOf(p.x)));
  let x: XScaleModel;
  let formatX: (xv: number, raw: string | number) => string;
  if (xAxis.scale === 'category') {
    const labels = xAxis.labels ? [...xAxis.labels] : [...xAxis.categories];
    x = {
      type: 'category',
      id: xAxis.id,
      keys: [...xAxis.categories],
      labels,
      ...(xAxis.label !== undefined ? { label: xAxis.label } : {}),
    };
    formatX = (xv, raw) => labels[xv] ?? String(raw);
  } else if (xAxis.scale === 'time') {
    const declared = xAxis.domain;
    let min =
      declared?.min !== undefined ? parseTimeValue(declared.min).epochMs : Math.min(...allX);
    let max =
      declared?.max !== undefined ? parseTimeValue(declared.max).epochMs : Math.max(...allX);
    if (!Number.isFinite(min) || !Number.isFinite(max)) {
      min = 0;
      max = DAY;
    }
    if (min === max) {
      const pad = timeKind === 'date' ? DAY : HOUR;
      min -= pad;
      max += pad;
    }
    const t = timeTicks(min, max, timeKind, xAxis.tickFormat ?? 'auto', locale, timezone);
    x = {
      type: 'time',
      id: xAxis.id,
      domain: [min, max],
      ticks: t.ticks,
      timeKind,
      ...(xAxis.label !== undefined ? { label: xAxis.label } : {}),
    };
    const unit = timeKind === 'date' ? 'day' : 'hour';
    formatX = (xv) => formatTime(xv, timeKind, unit, locale, timezone);
  } else {
    const vs = buildValueScale({
      data: allX,
      domain: xAxis.domain,
      defaultPolicy: 'fit',
      format: xAxis.format,
      ticks: undefined,
      locale,
    });
    x = {
      type: 'linear',
      id: xAxis.id,
      domain: vs.domain,
      ticks: toTicks(vs.tickValues, vs.format, locale),
      ...(xAxis.label !== undefined ? { label: xAxis.label } : {}),
    };
    formatX = (xv) => formatNumber(xv, vs.format, locale);
  }

  // ---- y axes ------------------------------------------------------------------------------
  const yFormats = new Map<string, NumberFormat>();
  const yAxes: YAxisModel[] = spec.yAxes.map((axis, i) => {
    const data: number[] = [];
    for (const s of spec.series) {
      if (s.yAxisId !== axis.id) continue;
      for (const p of s.points) if (finite(p.value)) data.push(p.value);
    }
    const vs = buildValueScale({
      data,
      domain: axis.domain,
      defaultPolicy: 'fit',
      format: axis.format,
      ticks: axis.ticks,
      locale,
    });
    yFormats.set(axis.id, vs.format);
    const overflow = axis.domain?.policy === 'fixed' ? (axis.domain.overflow ?? 'error') : 'error';
    return {
      id: axis.id,
      ...(axis.label !== undefined ? { label: axis.label } : {}),
      ...(axis.unit !== undefined ? { unit: axis.unit } : {}),
      domain: vs.domain,
      ticks: toTicks(vs.tickValues, vs.format, locale),
      position: axis.position ?? (i === 0 ? 'left' : 'right'),
      overflow,
      format: vs.format,
    };
  });
  const yById = new Map(yAxes.map((a) => [a.id, a]));

  // ---- series ------------------------------------------------------------------------------
  const nStyles = theme.seriesStyles.length;
  const series: LineSeriesModel[] = spec.series.map((s, index) => {
    const style = theme.seriesStyles[index % nStyles];
    const axis = yById.get(s.yAxisId) as YAxisModel;
    const yFormat = axis.format;
    const color =
      s.color ?? roles.color(s.role) ?? (theme.palette[index % theme.palette.length] as string);
    const dash: Dash = s.dash ?? style?.dash ?? 'solid';
    const shape: MarkerShape = s.marker?.shape ?? roles.shape(s.role) ?? style?.shape ?? 'circle';

    const points: PointModel[] = s.points.map((p: Point) => {
      const xv = xValueOf(p.x);
      const quality: Quality = p.quality ?? 'measured';
      const datumColor = p.color ?? roles.color(p.role);
      const datumShape = p.shape ?? roles.shape(p.role);
      return {
        id: p.id,
        xKey: p.x,
        xValue: xv,
        value: p.value,
        label: p.datumLabel ?? formatX(xv, p.x),
        display:
          p.displayValue ??
          (finite(p.value) ? formatNumber(p.value, yFormat, locale) : theme.strings.notMeasured),
        quality,
        renderHint: p.renderHint ?? 'line',
        ...(p.note !== undefined ? { note: p.note } : {}),
        ...(datumColor !== undefined ? { color: datumColor } : {}),
        ...(datumShape !== undefined ? { shape: datumShape } : {}),
      };
    });

    const clipped: ClippedModel[] = [];
    if (axis.overflow === 'clip-indicated') {
      for (const p of points) {
        if (!finite(p.value)) continue;
        if (p.value > axis.domain[1]) clipped.push({ pointId: p.id, side: 'above' });
        else if (p.value < axis.domain[0]) clipped.push({ pointId: p.id, side: 'below' });
      }
    }
    const { segments, isolated } = buildSegments(points, xAxis.scale === 'category');
    const markers = buildMarkers(points, isolated, s.marker?.show ?? 'quality', clipped);
    return {
      id: s.id,
      label: s.label,
      axisId: s.yAxisId,
      style: { color, dash, shape, width: theme.stroke.line },
      interpolation: s.interpolation ?? 'linear',
      points,
      segments,
      markers,
      clipped,
    };
  });

  // ---- annotations, reference lines, notes -------------------------------------------------
  const notes: string[] = [];
  const annotations: AnnotationModel[] = (spec.annotations ?? []).map((a) => {
    const model: AnnotationModel = {
      id: a.id,
      label: a.label,
      xKey: a.x,
      xValue: xValueOf(a.x),
      ...(a.x2 !== undefined ? { x2Key: a.x2, x2Value: xValueOf(a.x2) } : {}),
      ...(a.yAxisId !== undefined ? { yAxisId: a.yAxisId } : {}),
      ...(a.y !== undefined ? { y: a.y } : {}),
    };
    if (a.detail !== undefined) {
      notes.push(a.detail);
      model.detail = a.detail;
      model.noteNumber = notes.length;
    }
    return model;
  });

  const referenceLines: ReferenceLineModel[] = (spec.referenceLines ?? []).map((r) => ({
    id: r.id,
    axisId: r.axisId,
    value: r.value,
    ...(r.label !== undefined ? { label: r.label } : {}),
    dash: r.dash ?? 'dashed',
    color: roles.color(r.role) ?? theme.color.threshold,
  }));

  for (const axis of yAxes) {
    if (axis.overflow !== 'clip-indicated') continue;
    const num = (v: number): string => formatNumber(v, axis.format, locale);
    const above: number[] = [];
    const below: number[] = [];
    for (const s of series) {
      if (s.axisId !== axis.id) continue;
      for (const c of s.clipped) {
        const v = (s.points.find((p) => p.id === c.pointId) as PointModel).value as number;
        (c.side === 'above' ? above : below).push(v);
      }
    }
    if (above.length > 0) {
      const n = above.length;
      notes.push(
        `${n} ${n === 1 ? 'value' : 'values'} above ${num(axis.domain[1])} ${n === 1 ? 'is' : 'are'} clipped at the top edge (max ${num(Math.max(...above))})`,
      );
    }
    if (below.length > 0) {
      const n = below.length;
      notes.push(
        `${n} ${n === 1 ? 'value' : 'values'} below ${num(axis.domain[0])} ${n === 1 ? 'is' : 'are'} clipped at the bottom edge (min ${num(Math.min(...below))})`,
      );
    }
  }

  // ---- legend ------------------------------------------------------------------------------
  const legend: LegendItem[] = series.map((s) => ({
    kind: 'series',
    id: s.id,
    label: s.label,
    color: s.style.color,
    dash: s.style.dash,
    shape: s.style.shape,
  }));
  // A quality is listed only when it draws a mark: partial/lagging through an emitted marker,
  // estimated through a non-empty dashed range.
  const markerQuality = (q: Quality): boolean =>
    series.some((s) =>
      s.markers.some((m) => s.points.find((p) => p.id === m.pointId)?.quality === q),
    );
  const hasEstimatedRange = series.some((s) =>
    s.segments.some((g) => g.estimatedRanges.length > 0),
  );
  const present = (q: Quality): boolean =>
    q === 'estimated' ? hasEstimatedRange : markerQuality(q);
  if (present('partial'))
    legend.push({
      kind: 'quality',
      id: 'quality:partial',
      label: 'Partial',
      meaning: 'Hollow marker: the value covers incomplete data.',
      quality: 'partial',
      variant: 'hollow',
    });
  if (present('lagging'))
    legend.push({
      kind: 'quality',
      id: 'quality:lagging',
      label: 'Lagging',
      meaning: 'Ringed marker: the value may still be revised.',
      quality: 'lagging',
      variant: 'ringed',
    });
  if (present('estimated'))
    legend.push({
      kind: 'quality',
      id: 'quality:estimated',
      label: 'Estimated',
      meaning: 'Dashed line: the value is estimated.',
      quality: 'estimated',
      variant: 'dashed-segment',
    });

  const empty = !series.some((s) => s.points.some((p) => finite(p.value)));
  return {
    kind: 'cartesian',
    chartId: spec.id,
    title: spec.title,
    ...(spec.description !== undefined ? { description: spec.description } : {}),
    ...(spec.caption !== undefined ? { caption: spec.caption } : {}),
    x,
    yAxes,
    series,
    annotations,
    referenceLines,
    state: empty ? 'empty' : 'ok',
    legend,
    legendOptions: {
      show: spec.legend?.show ?? 'auto',
      position: spec.legend?.position ?? 'bottom',
    },
    notes,
    manifest: buildManifest(series, annotations, referenceLines, empty),
  };
}

export { unsupported };
