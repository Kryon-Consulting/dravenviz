import type { DonutSpec } from '../../spec/index';
import { type IssueSink, ptr } from '../issues';
import { checkFormat, checkRole, checkUniqueIds } from './common';

export function checkDonut(spec: DonutSpec, sink: IssueSink): void {
  checkUniqueIds(sink, spec.slices, '/slices', 'slice');
  spec.slices.forEach((slice, i) => {
    if (slice.value !== null && slice.value < 0) {
      sink.add(
        'negative-slice',
        ptr('slices', i, 'value'),
        `Slice '${slice.id}' is negative; slice values must be >= 0 (use null for a missing value).`,
      );
    }
    checkRole(sink, spec, slice.role, ptr('slices', i, 'role'));
  });
  checkFormat(sink, spec.format, '/format');
}
