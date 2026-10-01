import type { ReactElement } from 'react';
import type { Theme } from '../../core/index';
import type { LaidOutChart } from '../layout/types';
import { baselineCentred } from './style';
import { DvText } from './Text';

export interface EmptyStateProps {
  laid: LaidOutChart;
  theme: Theme;
  family: string;
}

/** The text drawn when no series has a measured value (design section 9 readiness fixtures). */
export const EMPTY_STATE_TEXT = 'No measured data';

export function EmptyState({ laid, theme, family }: EmptyStateProps): ReactElement {
  const plot = laid.boxes.plot;
  const size = theme.text.label * laid.fontScale;
  return (
    <g data-dv-mark="empty-state">
      <g data-dv-item="">
        <DvText
          labelId="empty-state"
          role="annotation"
          x={plot.x + plot.width / 2}
          y={baselineCentred(plot.y + plot.height / 2, size)}
          size={size}
          weight={400}
          fill={theme.color.mutedText}
          family={family}
          anchor="middle"
        >
          {EMPTY_STATE_TEXT}
        </DvText>
      </g>
    </g>
  );
}
