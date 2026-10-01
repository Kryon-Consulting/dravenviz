import type { ProgressSpec } from '../../spec/index';
import { type IssueSink, ptr } from '../issues';
import { checkFormat, checkRole, checkUniqueIds } from './common';

const RING_MAX_ITEMS = 6;

export function checkProgress(spec: ProgressSpec, sink: IssueSink): void {
  checkUniqueIds(sink, spec.items, '/items', 'item');
  const { min, max } = spec.domain;
  if (!(min < max)) {
    sink.add('invalid-domain', '/domain', 'domain.min must be less than domain.max.');
  }
  if (spec.variant === 'ring' && spec.items.length > RING_MAX_ITEMS) {
    sink.add(
      'too-many-items',
      '/items',
      `A ring shows at most ${RING_MAX_ITEMS} items; remove items or use variant 'bar'.`,
    );
  }
  const clip = spec.overflow === 'clip-indicated';
  spec.items.forEach((item, i) => {
    checkRole(sink, spec, item.role, ptr('items', i, 'role'));
    if (clip || !(min < max)) return;
    for (const field of ['value', 'target'] as const) {
      const v = item[field];
      if (v !== null && v !== undefined && (v < min || v > max)) {
        sink.add(
          'outside-progress-domain',
          ptr('items', i, field),
          `Item '${item.id}' has a ${field} outside the domain [${min}, ${max}]. Fix it, widen the domain, or set overflow to 'clip-indicated'.`,
        );
      }
    }
  });
  checkFormat(sink, spec.format, '/format');
}
