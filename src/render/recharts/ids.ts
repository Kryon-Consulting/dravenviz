import type { LaidOutChart } from '../layout/types';
import { idPrefix } from '../svg/ids';

/** Deterministic, namespaced SVG ids: `<namespace>_<chartId>-<n>` (design section 9). */
export interface ChartIds {
  /** The id for a structural key such as `clip:solid:0:1`. Throws for a key that was never planned. */
  get(key: string): string;
}

/**
 * Plans every id this chart needs, in a fixed order, so the same chart always gets the same ids
 * and two embeddings with different (namespace, chartId) pairs share none. Pure: render order
 * never changes an id.
 */
export function planIds(laid: LaidOutChart, namespace: string): ChartIds {
  const ids = new Map<string, string>();
  const add = (key: string): void => {
    ids.set(key, `${idPrefix(namespace, laid.model.chartId)}${ids.size + 1}`);
  };
  laid.model.series.forEach((s, si) => {
    s.segments.forEach((seg, gi) => {
      if (seg.estimatedRanges.length === 0) return;
      add(`clip:solid:${si}:${gi}`);
      seg.estimatedRanges.forEach((_, ri) => add(`clip:est:${si}:${gi}:${ri}`));
    });
  });
  return {
    get(key) {
      const id = ids.get(key);
      if (id === undefined) throw new Error(`unplanned id ${key}`);
      return id;
    },
  };
}
