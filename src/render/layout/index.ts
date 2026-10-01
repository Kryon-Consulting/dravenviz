/**
 * DOM-free layout (design section 8). Allocation order: title -> legend -> axis titles with
 * units -> tick labels -> plot area -> notes. Text is measured through a `TextMeasurer`, so the
 * same code runs in Node (`notoMeasurer`) and in the browser (`createCanvasMeasurer`, which lives
 * in `canvas-measure.ts` and is deliberately not imported here).
 *
 * TODO(slice 2): the sparkline preset omits axes and legend on purpose; it is not laid out here
 * (see docs/plans, slice 2). TODO(slice 3): collision handling for static scatter labels plugs in
 * through `StaticLabelPlacer`.
 */
import { DravenVizError } from '../../core/index';
import type { LegendItem } from '../model/types';
import type { CartesianModel } from '../model/types';
import { planXTicks, wrapWords } from './labels';
import { computeFontScale, scaledEffectivePt } from './print-scale';
import type {
  Box,
  LaidOutChart,
  LayoutOptions,
  NoteLine,
  StaticLabel,
  TextMeasurer,
  XLabelStage,
} from './types';

export type * from './types';
export { notoMeasurer, createNotoMeasurer } from './measure';
export { computeFontScale } from './print-scale';
export { labelQuad, polygonsIntersect } from './labels';

export const MIN_PLOT = { width: 80, height: 60 } as const;
const MAX_TITLE_LINES = 3;
const ELLIPSIS = '…';

/** Circled digits for 1-20, then "(21)". */
export function noteGlyph(n: number): string {
  return n >= 1 && n <= 20 ? String.fromCodePoint(0x2460 + n - 1) : `(${n})`;
}

const r = (v: number): number => Math.round(v * 1e6) / 1e6;
const box = (x: number, y: number, width: number, height: number): Box => ({
  x: r(x),
  y: r(y),
  width: r(Math.max(0, width)),
  height: r(Math.max(0, height)),
});

interface Consumer {
  name: string;
  size: number;
  detail: string;
}

function layoutError(
  model: CartesianModel,
  plot: { width: number; height: number },
  consumers: { vertical: Consumer[]; horizontal: Consumer[] },
): DravenVizError {
  const needW = MIN_PLOT.width - plot.width;
  const needH = MIN_PLOT.height - plot.height;
  const pool = needH >= needW ? consumers.vertical : consumers.horizontal;
  const top = [...pool].sort((a, b) => b.size - a.size)[0];
  const who = top === undefined ? 'the surrounding elements' : `${top.name} (${top.detail})`;
  return new DravenVizError(
    'LAYOUT_ERROR',
    `The plot area would be ${Math.max(0, Math.floor(plot.width))} x ${Math.max(0, Math.floor(plot.height))} units, below the minimum of ${MIN_PLOT.width} x ${MIN_PLOT.height}. The ${who} consumed the most space; enlarge the chart or shorten that element.`,
    { chartId: model.chartId },
  );
}

interface Pass {
  chart: LaidOutChart;
  minX: number;
  maxX: number;
}

export function layoutChart(
  model: CartesianModel,
  opts: LayoutOptions,
  measure: TextMeasurer,
): LaidOutChart {
  const { width, height, theme, printWidthMm } = opts;
  if (!(Number.isFinite(width) && width > 0 && Number.isFinite(height) && height > 0)) {
    throw new DravenVizError(
      'INVALID_OPTIONS',
      'Layout width and height must be positive numbers.',
      {
        chartId: model.chartId,
      },
    );
  }
  const fontScale = computeFontScale(theme, width, printWidthMm);
  let leftExtra = 0;
  let rightExtra = 0;
  let last: Pass | undefined;
  // Rotated labels can overhang the viewBox edge; widen that side and lay out again.
  for (let attempt = 0; attempt < 6; attempt++) {
    last = pass(model, opts, measure, fontScale, leftExtra, rightExtra);
    const needL = last.minX < 0 ? -last.minX : 0;
    const needR = last.maxX > width ? last.maxX - width : 0;
    if (needL < 1e-6 && needR < 1e-6) break;
    leftExtra += needL;
    rightExtra += needR;
  }
  return last!.chart;
}

function pass(
  model: CartesianModel,
  opts: LayoutOptions,
  measure: TextMeasurer,
  fontScale: number,
  leftExtra: number,
  rightExtra: number,
): Pass {
  const { width, height, theme, mode, printWidthMm } = opts;
  const sp = theme.spacing;
  const tickGap = sp.titleGap / 2;
  const rowGap = sp.legendGap / 3;
  const sizeTitle = theme.text.title * fontScale;
  const sizeLabel = theme.text.label * fontScale;
  const sizeCaption = theme.text.caption * fontScale;
  const lh = (size: number): number => size * theme.text.lineHeight;
  const fTitle = { size: sizeTitle, weight: 600 } as const;
  const fLabel = { size: sizeLabel, weight: 400 } as const;
  const fCaption = { size: sizeCaption, weight: 400 } as const;
  const innerX = sp.padding;
  const innerW = width - 2 * sp.padding;

  // ---- title (wrapped, at most 3 lines) --------------------------------------------------------
  let titleLines = wrapWords(model.title, innerW, measure, fTitle);
  let titleEllipsized = false;
  if (titleLines.length > MAX_TITLE_LINES) {
    titleEllipsized = true;
    let tail = titleLines[MAX_TITLE_LINES - 1]!;
    while (tail.length > 0 && measure(tail + ELLIPSIS, fTitle).width > innerW)
      tail = tail.slice(0, -1);
    titleLines = [...titleLines.slice(0, MAX_TITLE_LINES - 1), tail + ELLIPSIS];
  }
  const titleH = titleLines.length * lh(sizeTitle);

  // ---- legend (wrapped rows) -------------------------------------------------------------------
  const showLegend =
    model.legendOptions.show === 'always' ||
    (model.legendOptions.show === 'auto' && model.legend.length > 1);
  const swatch = theme.marker.size * 4;
  const legendRows: LegendItem[][] = [];
  if (showLegend) {
    let row: LegendItem[] = [];
    let used = 0;
    for (const item of model.legend) {
      const w = swatch + tickGap + measure(item.label, fLabel).width;
      if (row.length > 0 && used + sp.legendGap + w > innerW) {
        legendRows.push(row);
        row = [];
        used = 0;
      }
      used += (row.length > 0 ? sp.legendGap : 0) + w;
      row.push(item);
    }
    if (row.length > 0) legendRows.push(row);
  }
  const legendH =
    legendRows.length === 0
      ? 0
      : legendRows.length * lh(sizeLabel) + (legendRows.length - 1) * rowGap;

  // ---- y axes: widest tick label + gap + rotated title height ----------------------------------
  const yWidths = model.yAxes.map((axis) => {
    const tickW = Math.max(0, ...axis.ticks.map((t) => measure(t.label, fLabel).width));
    const title =
      axis.label !== undefined
        ? axis.unit !== undefined
          ? `${axis.label} (${axis.unit})`
          : axis.label
        : axis.unit !== undefined
          ? `(${axis.unit})`
          : '';
    return tickW + tickGap + (title === '' ? 0 : tickGap + lh(sizeLabel));
  });
  const sideTotal = (side: 'left' | 'right'): number =>
    model.yAxes.reduce((s, a, i) => s + (a.position === side ? yWidths[i]! : 0), 0);
  const leftW = sideTotal('left');
  const rightW = sideTotal('right');

  // ---- notes: annotation details, clip notes, caption ------------------------------------------
  const notes: NoteLine[] = [];
  const numbered = model.annotations.filter(
    (a) => a.noteNumber !== undefined && a.detail !== undefined,
  );
  for (const a of [...numbered].sort((p, q) => p.noteNumber! - q.noteNumber!)) {
    const text = `${noteGlyph(a.noteNumber!)} ${a.label} — ${a.detail!}`;
    notes.push({ kind: 'annotation', number: a.noteNumber!, text, lines: [] });
  }
  for (const text of model.notes.slice(numbered.length))
    notes.push({ kind: 'clip', text, lines: [] });
  if (model.caption !== undefined && model.caption !== '') {
    notes.push({ kind: 'caption', text: model.caption, lines: [] });
  }
  for (const n of notes) n.lines = wrapWords(n.text, innerW, measure, fCaption);
  const noteLines = notes.reduce((s, n) => s + n.lines.length, 0);
  const notesH = noteLines * lh(sizeCaption);

  // ---- vertical allocation ---------------------------------------------------------------------
  const legendTop = showLegend && model.legendOptions.position === 'top';
  const legendBottom = showLegend && model.legendOptions.position === 'bottom';
  let y = sp.padding;
  const titleY = y;
  y += titleH + sp.titleGap;
  const legendTopY = y;
  if (legendTop && legendH > 0) y += legendH + sp.legendGap;
  const plotY = y;
  let bottom = height - sp.padding;
  const notesY = bottom - notesH;
  if (notesH > 0) bottom = notesY - sp.titleGap;
  const legendBottomY = bottom - legendH;
  if (legendBottom && legendH > 0) bottom = legendBottomY - sp.legendGap;

  // ---- plot width, then x tick policy, then plot height ----------------------------------------
  const plotX = innerX + leftExtra + leftW;
  const plotW = width - sp.padding - rightExtra - rightW - plotX;
  const verticalConsumers = (xH: number): Consumer[] => [
    {
      name: 'title',
      size: titleH,
      detail: `${titleLines.length} ${titleLines.length === 1 ? 'line' : 'lines'}, ${Math.round(titleH)} units`,
    },
    {
      name: 'legend',
      size: legendH,
      detail: `${legendRows.length} ${legendRows.length === 1 ? 'row' : 'rows'}, ${Math.round(legendH)} units`,
    },
    {
      name: 'notes',
      size: notesH,
      detail: `${noteLines} ${noteLines === 1 ? 'line' : 'lines'}, ${Math.round(notesH)} units`,
    },
    { name: 'x axis', size: xH, detail: `${Math.round(xH)} units` },
  ];
  const horizontalConsumers: Consumer[] = model.yAxes.map((a, i) => ({
    name: `y axis "${a.id}"`,
    size: yWidths[i]!,
    detail: `${Math.round(yWidths[i]!)} units`,
  }));
  if (plotW < MIN_PLOT.width) {
    throw layoutError(
      model,
      { width: plotW, height: bottom - plotY },
      {
        vertical: verticalConsumers(0),
        horizontal: horizontalConsumers,
      },
    );
  }
  // x tick region sits below the plot; its height does not depend on the plot height.
  const xTitle = model.x.label;
  const xTitleH = xTitle === undefined || xTitle === '' ? 0 : sp.titleGap / 2 + lh(sizeLabel);
  const probeBase = 0; // tick region height is relative to its top, so any base works for sizing
  const sizing = planXTicks({
    x: model.x,
    plotX,
    plotWidth: plotW,
    baseY: probeBase,
    measure,
    font: fLabel,
    lineHeight: lh(sizeLabel),
    gap: tickGap,
  });
  const xH = tickGap + sizing.labelsHeight + xTitleH;
  const plotH = bottom - xH - plotY;
  if (plotH < MIN_PLOT.height) {
    throw layoutError(
      model,
      { width: plotW, height: plotH },
      {
        vertical: verticalConsumers(xH),
        horizontal: horizontalConsumers,
      },
    );
  }
  const plotBottom = plotY + plotH;
  const plan = planXTicks({
    x: model.x,
    plotX,
    plotWidth: plotW,
    baseY: plotBottom + tickGap,
    measure,
    font: fLabel,
    lineHeight: lh(sizeLabel),
    gap: tickGap,
  });

  // ---- boxes -----------------------------------------------------------------------------------
  const axes: Record<string, Box> = {};
  let leftCursor = innerX + leftExtra;
  let rightCursor = plotX + plotW;
  model.yAxes.forEach((a, i) => {
    const w = yWidths[i]!;
    if (a.position === 'left') {
      axes[a.id] = box(leftCursor, plotY, w, plotH);
      leftCursor += w;
    } else {
      axes[a.id] = box(rightCursor, plotY, w, plotH);
      rightCursor += w;
    }
  });
  axes['x'] = box(plotX, plotBottom, plotW, xH);

  const staticLabels: StaticLabel[] = [];
  if (mode === 'static') {
    for (const a of model.annotations) {
      staticLabels.push({
        kind: 'annotation',
        id: a.id,
        text: a.label,
        width: r(measure(a.label, fLabel).width),
        height: r(lh(sizeLabel)),
      });
    }
    for (const ref of model.referenceLines) {
      if (ref.label === undefined) continue;
      staticLabels.push({
        kind: 'reference',
        id: ref.id,
        text: ref.label,
        width: r(measure(ref.label, fLabel).width),
        height: r(lh(sizeLabel)),
      });
    }
  }

  const stage: XLabelStage = plan.stage;
  const chart: LaidOutChart = {
    model,
    width,
    height,
    fontScale,
    boxes: {
      title: box(innerX, titleY, innerW, titleH),
      legend: box(innerX, legendTop ? legendTopY : legendBottomY, innerW, legendH),
      plot: box(plotX, plotY, plotW, plotH),
      axes,
      notes: box(innerX, notesY, innerW, notesH),
    },
    titleLines,
    legendRows,
    xTicks: plan.ticks.map((t) => ({
      ...t,
      x: r(t.x),
      y: r(t.y),
      width: r(t.width),
      height: r(t.height),
    })),
    notes,
    staticLabels,
    metrics: {
      ...(printWidthMm === undefined
        ? {}
        : { effectivePt: scaledEffectivePt(theme, width, printWidthMm, fontScale) }),
      xLabelStage: stage,
      titleEllipsized,
    },
  };
  return { chart, minX: plan.minX, maxX: plan.maxX };
}
