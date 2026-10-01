import type { ClippedModel, MarkerModel, MarkerVariant, PointModel, SegmentModel } from './types';

export interface SegmentResult {
  segments: SegmentModel[];
  /** Ids of measured points left without a connected neighbor (one-point segments). */
  isolated: Set<string>;
}

const connects = (p: PointModel): boolean => p.value !== null && p.renderHint === 'line';

/**
 * Split points, in order, into line segments (design 5.2). A point joins the current segment only
 * when it has a value and `renderHint` is "line". `marker-only` and `gap` points and nulls close
 * the segment. A one-point segment is dropped and its point reported as isolated. Clipped points
 * stay in their segment: the curve is clipped at the plot edge, not broken.
 */
export function buildSegments(points: PointModel[]): SegmentResult {
  const runs: PointModel[][] = [];
  let current: PointModel[] = [];
  const close = (): void => {
    if (current.length > 0) runs.push(current);
    current = [];
  };
  for (const p of points) {
    if (connects(p)) current.push(p);
    else close();
  }
  close();

  const segments: SegmentModel[] = [];
  const isolated = new Set<string>();
  for (const run of runs) {
    const first = run[0] as PointModel;
    if (run.length === 1) isolated.add(first.id);
    else segments.push({ pointIds: run.map((p) => p.id), estimatedRanges: estimatedRanges(run) });
  }
  return { segments, isolated };
}

/**
 * Dashed x ranges: for each run of consecutive `estimated` points, from the point before the run
 * to the point after it, clamped to the segment. Ranges that overlap or touch are merged.
 */
function estimatedRanges(run: PointModel[]): [string, string][] {
  const ranges: [number, number][] = [];
  let i = 0;
  while (i < run.length) {
    if ((run[i] as PointModel).quality !== 'estimated') {
      i++;
      continue;
    }
    let j = i;
    while (j + 1 < run.length && (run[j + 1] as PointModel).quality === 'estimated') j++;
    const start = Math.max(0, i - 1);
    const end = Math.min(run.length - 1, j + 1);
    const prev = ranges[ranges.length - 1];
    if (prev && start <= prev[1]) prev[1] = end;
    else ranges.push([start, end]);
    i = j + 1;
  }
  return ranges.map(([a, b]) => [(run[a] as PointModel).id, (run[b] as PointModel).id]);
}

export function variantOf(quality: PointModel['quality']): MarkerVariant {
  return quality === 'partial' ? 'hollow' : quality === 'lagging' ? 'ringed' : 'filled';
}

/**
 * One marker per point, in point order. Priority when reasons overlap: marker-only > isolated >
 * quality > all. `show: "none"` still marks isolated points (design 5.2) and marker-only points
 * (their only mark). Clipped points get no marker: they get a clip indicator instead.
 */
export function buildMarkers(
  points: PointModel[],
  isolated: Set<string>,
  show: 'all' | 'none' | 'quality',
  clipped: ClippedModel[],
): MarkerModel[] {
  const clippedIds = new Set(clipped.map((c) => c.pointId));
  const out: MarkerModel[] = [];
  for (const p of points) {
    if (p.value === null || clippedIds.has(p.id)) continue;
    const variant = variantOf(p.quality);
    if (p.renderHint === 'marker-only') out.push({ pointId: p.id, reason: 'marker-only', variant });
    else if (p.renderHint === 'gap') continue;
    else if (isolated.has(p.id)) out.push({ pointId: p.id, reason: 'isolated', variant });
    else if (show !== 'none' && p.quality !== 'measured')
      out.push({ pointId: p.id, reason: 'quality', variant });
    else if (show === 'all') out.push({ pointId: p.id, reason: 'all', variant });
  }
  return out;
}
