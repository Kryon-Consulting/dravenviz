import type { ReactElement } from 'react';
import type { Theme } from '../../core/index';
import type { LaidOutChart } from '../layout/types';
import { baselineAt } from './style';
import { DvText } from './Text';

export interface TitleProps {
  laid: LaidOutChart;
  theme: Theme;
  family: string;
}

/** The chart title, wrapped by layout; one `<text>` per line sharing one label id. */
export function Title({ laid, theme, family }: TitleProps): ReactElement {
  const size = theme.text.title * laid.fontScale;
  const lh = size * theme.text.lineHeight;
  const box = laid.boxes.title;
  return (
    <g data-dv-title="">
      {laid.titleLines.map((line, i) => (
        <DvText
          key={i}
          labelId="title"
          role="title"
          x={box.x}
          y={baselineAt(box.y + i * lh, lh, size)}
          size={size}
          weight={600}
          fill={theme.color.text}
          family={family}
        >
          {line}
        </DvText>
      ))}
    </g>
  );
}
