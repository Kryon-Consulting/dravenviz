import { isCartesian } from '../../core/index';
import type { VizSpec } from '../../core/index';
import { buildCartesianModel, unsupported } from './cartesian';
import type { ChartModel, ModelContext } from './types';

export type * from './types';

/**
 * Build the DOM-free chart model from a validated spec (it does not re-validate). Slice 1 models
 * Cartesian line series; every other kind or mark reports `unsupported` with the slice that adds it.
 */
export function buildModel(spec: VizSpec, ctx: ModelContext): ChartModel {
  if (!isCartesian(spec)) {
    return unsupported(spec) as ChartModel;
  }
  return buildCartesianModel(spec, ctx);
}
