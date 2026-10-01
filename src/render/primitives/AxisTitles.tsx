import type { ReactElement } from 'react';
import type { Theme } from '../../core/index';
import type { LaidOutChart } from '../layout/types';
import { baselineCentred } from './style';
import { DvText } from './Text';

export interface AxisTitlesProps {
  laid: LaidOutChart;
  theme: Theme;
  family: string;
}

/**
 * Axis titles at the positions layout reserved: rotated y titles in the outer columns of each y
 * axis box, the x title on the last line of the x axis box.
 */
export function AxisTitles({ laid, theme, family }: AxisTitlesProps): ReactElement {
  const size = theme.text.label * laid.fontScale;
  const lh = size * theme.text.lineHeight;
  const plot = laid.boxes.plot;
  const midY = plot.y + plot.height / 2;
  const xTitle = laid.model.x.label;
  const xBox = laid.boxes.xAxis;
  return (
    <g data-dv-axis-titles="">
      {laid.model.yAxes.map((axis) => {
        const columns = laid.yAxisTitles[axis.id] ?? [];
        const box = laid.boxes.axes[axis.id];
        if (box === undefined) return null;
        const left = axis.position === 'left';
        return columns.map((text, j) => {
          // Left titles read bottom to top (columns advance rightwards from the outer edge);
          // right titles read top to bottom (columns advance leftwards from the outer edge).
          const colCentre = left ? box.x + (j + 0.5) * lh : box.x + box.width - (j + 0.5) * lh;
          // The baseline sits below the text's vertical centre in its own frame, which after a
          // quarter turn is a horizontal offset: rightwards for -90, leftwards for +90.
          const offset = baselineCentred(0, size);
          return (
            <DvText
              key={`${axis.id}-${j}`}
              labelId={`axis-title-${axis.id}`}
              role="axis-title"
              x={left ? colCentre + offset : colCentre - offset}
              y={midY}
              size={size}
              weight={400}
              fill={theme.color.mutedText}
              family={family}
              anchor="middle"
              rotate={left ? -90 : 90}
            >
              {text}
            </DvText>
          );
        });
      })}
      {xTitle === undefined || xTitle === '' ? null : (
        <DvText
          labelId="axis-title-x"
          role="axis-title"
          x={xBox.x + xBox.width / 2}
          y={baselineCentred(xBox.y + xBox.height - lh / 2, size)}
          size={size}
          weight={400}
          fill={theme.color.mutedText}
          family={family}
          anchor="middle"
        >
          {xTitle}
        </DvText>
      )}
    </g>
  );
}
