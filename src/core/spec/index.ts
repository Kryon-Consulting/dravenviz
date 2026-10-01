import type { CartesianSpec, DonutSpec, HeatmapSpec, ProgressSpec, VizSpec } from './types.gen';

export type * from './types.gen';

/** Schema major version carried by every spec (`schemaVersion`). */
export type SchemaVersion = 1;

export function isCartesian(spec: VizSpec): spec is CartesianSpec {
  return spec.kind === 'cartesian';
}

export function isDonut(spec: VizSpec): spec is DonutSpec {
  return spec.kind === 'donut';
}

export function isHeatmap(spec: VizSpec): spec is HeatmapSpec {
  return spec.kind === 'heatmap';
}

export function isProgress(spec: VizSpec): spec is ProgressSpec {
  return spec.kind === 'progress';
}
