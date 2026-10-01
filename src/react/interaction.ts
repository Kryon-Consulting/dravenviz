import type { Quality } from '../core/index';
import type { LaidOutChart } from '../render/layout/types';
import type { LineSeriesModel, PointModel } from '../render/model/types';

/** A datum the keyboard and pointer can reach: it has a measured value and is not a gap. */
export interface Datum {
  seriesId: string;
  seriesLabel: string;
  seriesIndex: number;
  pointId: string;
  /** Index in the series' navigable list (not in `series.points`). */
  order: number;
  label: string;
  value: number;
  /** `displayValue ?? formatted value`. */
  display: string;
  unit: string | undefined;
  quality: Quality;
  /** Position in the chart's logical units (the svg viewBox). */
  x: number;
  y: number;
  xValue: number;
}

export interface FocusKey {
  seriesId: string;
  pointId: string;
}

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

/** Horizontal position of a point: the middle of its band, or its place on the numeric domain. */
function xOf(laid: LaidOutChart, p: PointModel): number {
  const plot = laid.boxes.plot;
  const x = laid.model.x;
  if (x.type === 'category') {
    const n = x.keys.length;
    return n === 0 ? plot.x : plot.x + ((p.xValue + 0.5) / n) * plot.width;
  }
  const [lo, hi] = x.domain;
  return hi === lo ? plot.x + plot.width / 2 : plot.x + ((p.xValue - lo) / (hi - lo)) * plot.width;
}

function yOf(laid: LaidOutChart, series: LineSeriesModel, value: number): number {
  const plot = laid.boxes.plot;
  const axis = laid.model.yAxes.find((a) => a.id === series.axisId);
  if (axis === undefined) return plot.y + plot.height / 2;
  const [lo, hi] = axis.domain;
  const t = hi === lo ? 0.5 : (value - lo) / (hi - lo);
  // A clipped value is held on the plot edge, where its clip indicator is drawn.
  return plot.y + plot.height * (1 - clamp(t, 0, 1));
}

/**
 * Every datum with a value, in series then point order. Null and gap points are skipped (a gap is
 * missing data, never a stop). Positions come from the layout scales, so they equal the drawn marks
 * (the commit check holds the plot box to the chart library's within 0.5 units).
 */
export function navigableDatums(laid: LaidOutChart): Datum[][] {
  return laid.model.series.map((series, seriesIndex) => {
    const unit = laid.model.yAxes.find((a) => a.id === series.axisId)?.unit;
    const out: Datum[] = [];
    for (const p of series.points) {
      if (p.value === null || p.renderHint === 'gap') continue;
      out.push({
        seriesId: series.id,
        seriesLabel: series.label,
        seriesIndex,
        pointId: p.id,
        order: out.length,
        label: p.label,
        value: p.value,
        display: p.display,
        unit,
        quality: p.quality,
        x: xOf(laid, p),
        y: yOf(laid, series, p.value),
        xValue: p.xValue,
      });
    }
    return out;
  });
}

export function findDatum(all: Datum[][], key: FocusKey | null): Datum | undefined {
  if (key === null) return undefined;
  return all.flat().find((d) => d.seriesId === key.seriesId && d.pointId === key.pointId);
}

export type NavKey = 'ArrowLeft' | 'ArrowRight' | 'ArrowUp' | 'ArrowDown';

export const isNavKey = (k: string): k is NavKey =>
  k === 'ArrowLeft' || k === 'ArrowRight' || k === 'ArrowUp' || k === 'ArrowDown';

/**
 * The datum an arrow key moves to. With nothing focused, any arrow focuses the first datum.
 * Left and Right move within the series (and stop at its ends); Up and Down move to the previous
 * or next series that has data, landing on the datum closest in x. Returns `current` when there is
 * nowhere to go.
 */
export function moveFocus(
  all: Datum[][],
  current: Datum | undefined,
  key: NavKey,
): Datum | undefined {
  const first = all.find((s) => s.length > 0)?.[0];
  if (current === undefined) return first;
  const own = all[current.seriesIndex] ?? [];
  if (key === 'ArrowLeft' || key === 'ArrowRight') {
    const next = own[current.order + (key === 'ArrowRight' ? 1 : -1)];
    return next ?? current;
  }
  const step = key === 'ArrowDown' ? 1 : -1;
  for (let i = current.seriesIndex + step; i >= 0 && i < all.length; i += step) {
    const candidates = all[i] ?? [];
    if (candidates.length === 0) continue;
    let best = candidates[0] as Datum;
    for (const c of candidates) {
      if (Math.abs(c.xValue - current.xValue) < Math.abs(best.xValue - current.xValue)) best = c;
    }
    return best;
  }
  return current;
}

/** The datum nearest to a point within `radius` logical units, or undefined. */
export function nearestDatum(
  all: Datum[][],
  x: number,
  y: number,
  radius: number,
): Datum | undefined {
  let best: Datum | undefined;
  let bestD = radius * radius;
  for (const d of all.flat()) {
    const dist = (d.x - x) ** 2 + (d.y - y) ** 2;
    if (dist <= bestD) {
      bestD = dist;
      best = d;
    }
  }
  return best;
}

/** The value with its unit, without repeating a unit the display text already carries. */
export function valueText(d: Datum): string {
  if (d.unit === undefined || d.unit === '' || d.display.includes(d.unit)) return d.display;
  return `${d.display} ${d.unit}`;
}

/** Live region text: series label, datum label, value with unit, quality word. */
export function announcement(d: Datum): string {
  return `${d.seriesLabel}, ${d.label}, ${valueText(d)}, ${d.quality}`;
}
