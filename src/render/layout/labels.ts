import type { TickModel, XScaleModel } from '../model/types';
import type { PlacedTick, TextMeasurer, XLabelStage } from './types';

export interface Point {
  x: number;
  y: number;
}

export interface Font {
  size: number;
  weight: 400 | 600;
}

const EPS = 1e-9;

/** Greedy word wrap. A single word wider than `maxWidth` is broken by characters when `breakLongWords`. */
export function wrapWords(
  text: string,
  maxWidth: number,
  measure: TextMeasurer,
  font: Font,
  breakLongWords = true,
): string[] {
  const w = (s: string): number => measure(s, font).width;
  const words = text.split(/\s+/).filter((s) => s.length > 0);
  const lines: string[] = [];
  let line = '';
  const push = (): void => {
    if (line !== '') lines.push(line);
    line = '';
  };
  for (const word of words) {
    const candidate = line === '' ? word : `${line} ${word}`;
    if (w(candidate) <= maxWidth) {
      line = candidate;
      continue;
    }
    push();
    if (w(word) <= maxWidth || !breakLongWords) {
      line = word;
      continue;
    }
    for (const ch of word) {
      if (line !== '' && w(line + ch) > maxWidth) push();
      line += ch;
    }
  }
  push();
  return lines.length === 0 ? [''] : lines;
}

/**
 * Wrap a category label to at most `maxLines` lines of at most `maxWidth` by words.
 * Returns null when it cannot (a single word is wider than the band, or more lines are needed):
 * that is the rotate trigger. The label is never truncated.
 */
export function wrapCategory(
  label: string,
  maxWidth: number,
  measure: TextMeasurer,
  font: Font,
  maxLines = 2,
): string[] | null {
  const lines = wrapWords(label, maxWidth, measure, font, false);
  if (lines.length > maxLines) return null;
  if (lines.some((l) => measure(l, font).width > maxWidth)) return null;
  return lines;
}

/**
 * Corners of a label's footprint. `rotate: 0`: `(x, y)` is the top centre and the box is
 * `width x height`. `rotate: -45`: the text ends at `(x, y)` on its centre line and runs
 * down-left; the box is rotated -45 degrees about that anchor (screen coordinates, y down).
 */
export function labelQuad(
  x: number,
  y: number,
  width: number,
  height: number,
  rotate: 0 | -45,
): Point[] {
  if (rotate === 0) {
    const l = x - width / 2;
    return [
      { x: l, y },
      { x: l + width, y },
      { x: l + width, y: y + height },
      { x: l, y: y + height },
    ];
  }
  const c = Math.SQRT1_2;
  const s = -Math.SQRT1_2;
  const local: Point[] = [
    { x: -width, y: -height / 2 },
    { x: 0, y: -height / 2 },
    { x: 0, y: height / 2 },
    { x: -width, y: height / 2 },
  ];
  return local.map((p) => ({ x: x + p.x * c - p.y * s, y: y + p.x * s + p.y * c }));
}

/** Vertical offset from the top of a rotated label's quad to its anchor y. */
export function rotatedTopOffset(height: number): number {
  return (height / 2) * Math.SQRT1_2;
}

/** Separating-axis test for convex polygons. Touching edges do not count as intersecting. */
export function polygonsIntersect(a: readonly Point[], b: readonly Point[]): boolean {
  for (const poly of [a, b]) {
    for (let i = 0; i < poly.length; i++) {
      const p = poly[i]!;
      const q = poly[(i + 1) % poly.length]!;
      const nx = p.y - q.y;
      const ny = q.x - p.x;
      let minA = Infinity;
      let maxA = -Infinity;
      let minB = Infinity;
      let maxB = -Infinity;
      for (const v of a) {
        const d = v.x * nx + v.y * ny;
        minA = Math.min(minA, d);
        maxA = Math.max(maxA, d);
      }
      for (const v of b) {
        const d = v.x * nx + v.y * ny;
        minB = Math.min(minB, d);
        maxB = Math.max(maxB, d);
      }
      const len = Math.hypot(nx, ny) || 1;
      if (maxA - minB <= EPS * len || maxB - minA <= EPS * len) return false;
    }
  }
  return true;
}

export function bounds(points: readonly Point[]): {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
} {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
  }
  return { minX, maxX, minY, maxY };
}

/**
 * Indices kept when thinning `quads` (ordered along x, translated copies of one shape) to every
 * n-th label with the first and last always kept. Returns the smallest n whose kept labels do
 * not intersect. A kept multiple of n that collides with the last label is dropped (the last stays).
 */
export function thinIndices(quads: readonly (readonly Point[])[]): { n: number; keep: number[] } {
  const count = quads.length;
  if (count <= 2) return { n: 1, keep: quads.map((_, i) => i) };
  const last = count - 1;
  for (let n = 1; n < count; n++) {
    const keep: number[] = [];
    for (let i = 0; i < last; i += n) keep.push(i);
    keep.push(last);
    const prev = keep[keep.length - 2]!;
    if (prev !== 0 && polygonsIntersect(quads[prev]!, quads[last]!)) {
      keep.splice(keep.length - 2, 1);
    }
    let ok = true;
    for (let k = 1; k < keep.length && ok; k++) {
      ok = !polygonsIntersect(quads[keep[k - 1]!]!, quads[keep[k]!]!);
    }
    if (ok) return { n, keep };
  }
  return { n: last, keep: [0, last] };
}

// ---- x tick planning ---------------------------------------------------------------------------

export interface XPlanInput {
  x: XScaleModel;
  plotX: number;
  plotWidth: number;
  /** Top of the tick label region (plot bottom plus the tick gap). */
  baseY: number;
  measure: TextMeasurer;
  font: Font;
  lineHeight: number;
  /** Minimum clear space between neighbouring labels. */
  gap: number;
}

export interface XPlan {
  ticks: PlacedTick[];
  stage: XLabelStage;
  /** Height of the tick label region below `baseY`, from visible labels only. */
  labelsHeight: number;
  /** Horizontal extent of visible label footprints (for overhang past the viewBox). */
  minX: number;
  maxX: number;
}

function maxLineWidth(lines: string[], measure: TextMeasurer, font: Font): number {
  return Math.max(0, ...lines.map((l) => measure(l, font).width));
}

function extent(ticks: readonly PlacedTick[]): {
  labelsBottom: number;
  minX: number;
  maxX: number;
} {
  let labelsBottom = -Infinity;
  let minX = Infinity;
  let maxX = -Infinity;
  for (const t of ticks) {
    if (!t.visible) continue;
    const b = bounds(labelQuad(t.x, t.y, t.width, t.height, t.rotate));
    labelsBottom = Math.max(labelsBottom, b.maxY);
    minX = Math.min(minX, b.minX);
    maxX = Math.max(maxX, b.maxX);
  }
  return { labelsBottom, minX, maxX };
}

function finish(ticks: PlacedTick[], stage: XLabelStage, baseY: number): XPlan {
  const e = extent(ticks);
  if (!Number.isFinite(e.labelsBottom)) {
    return { ticks, stage, labelsHeight: 0, minX: Infinity, maxX: -Infinity };
  }
  return { ticks, stage, labelsHeight: e.labelsBottom - baseY, minX: e.minX, maxX: e.maxX };
}

/** Category policy: wrap (<= 2 lines) -> rotate -45 -> thin every n-th keeping first and last. */
function planCategory(x: Extract<XScaleModel, { type: 'category' }>, input: XPlanInput): XPlan {
  const { plotX, plotWidth, baseY, measure, font, lineHeight, gap } = input;
  const n = x.keys.length;
  if (n === 0) return finish([], 'none', baseY);
  const band = plotWidth / n;
  const cx = (k: number): number => plotX + (k + 0.5) * band;
  const labelOf = (k: number): string => x.labels[k] ?? String(x.keys[k]);
  const wraps = x.keys.map((_, k) => wrapCategory(labelOf(k), band - gap, measure, font, 2));
  if (wraps.every((w) => w !== null)) {
    const ticks: PlacedTick[] = wraps.map((lines, k) => ({
      value: x.keys[k]!,
      lines: lines!,
      rotate: 0,
      visible: true,
      x: cx(k),
      y: baseY,
      width: maxLineWidth(lines!, measure, font),
      height: lines!.length * lineHeight,
    }));
    return finish(ticks, wraps.some((w) => w!.length > 1) ? 'wrap' : 'horizontal', baseY);
  }
  const top = rotatedTopOffset(lineHeight);
  const ticks: PlacedTick[] = x.keys.map((key, k) => ({
    value: key,
    lines: [labelOf(k)],
    rotate: -45,
    visible: true,
    x: cx(k),
    y: baseY + top,
    width: measure(labelOf(k), font).width,
    height: lineHeight,
  }));
  const quads = ticks.map((t) => labelQuad(t.x, t.y, t.width, t.height, -45));
  const { n: step, keep } = thinIndices(quads);
  const kept = new Set(keep);
  ticks.forEach((t, i) => {
    t.visible = kept.has(i);
  });
  return finish(ticks, step === 1 ? 'rotate' : 'thin', baseY);
}

/** Time and linear ticks: the model's ticks; overlapping non-essential labels are hidden. */
function planValueTicks(
  x: Extract<XScaleModel, { type: 'linear' | 'time' }>,
  input: XPlanInput,
): XPlan {
  const { plotX, plotWidth, baseY, measure, font, lineHeight, gap } = input;
  const [d0, d1] = x.domain;
  const span = d1 - d0;
  const pos = (v: number): number => plotX + (span === 0 ? 0.5 : (v - d0) / span) * plotWidth;
  const ticks: PlacedTick[] = x.ticks.map((t: TickModel) => ({
    value: t.value,
    lines: [t.label],
    rotate: 0,
    visible: true,
    x: pos(Number(t.value)),
    y: baseY,
    width: measure(t.label, font).width,
    height: lineHeight,
  }));
  const overlaps = (a: PlacedTick, b: PlacedTick): boolean =>
    a.x + a.width / 2 + gap > b.x - b.width / 2;
  for (;;) {
    const vis = ticks.map((t, i) => ({ t, i })).filter((e) => e.t.visible);
    let hid = false;
    for (let k = 1; k < vis.length && !hid; k++) {
      const a = vis[k - 1]!;
      const b = vis[k]!;
      if (!overlaps(a.t, b.t)) continue;
      const aEss = x.ticks[a.i]!.essential;
      const bEss = x.ticks[b.i]!.essential;
      if (!bEss) {
        b.t.visible = false;
        hid = true;
      } else if (!aEss) {
        a.t.visible = false;
        hid = true;
      }
    }
    if (!hid) break;
  }
  return finish(ticks, ticks.some((t) => !t.visible) ? 'thin' : 'horizontal', baseY);
}

export function planXTicks(input: XPlanInput): XPlan {
  return input.x.type === 'category'
    ? planCategory(input.x, input)
    : planValueTicks(input.x, input);
}
