import type { AnnotationModel, LineSeriesModel, MarkManifest, ReferenceLineModel } from './types';

/** Expected-mark manifest (design 5.2): the groups a faithful rendering must contain. */
export function buildManifest(
  series: LineSeriesModel[],
  annotations: AnnotationModel[],
  referenceLines: ReferenceLineModel[],
  empty: boolean,
): MarkManifest {
  const groups: { key: string; count: number }[] = [];
  const add = (key: string, count: number): void => {
    if (count > 0) groups.push({ key, count });
  };
  for (const s of series) {
    add(`series:${s.id}:segment`, s.segments.length);
    add(
      `series:${s.id}:estimated`,
      s.segments.reduce((n, seg) => n + seg.estimatedRanges.length, 0),
    );
    add(`series:${s.id}:marker`, s.markers.length);
    add(`series:${s.id}:clip-indicator`, s.clipped.length);
  }
  add('annotation', annotations.length);
  add('reference', referenceLines.length);
  add('empty-state', empty ? 1 : 0);
  return { groups };
}
