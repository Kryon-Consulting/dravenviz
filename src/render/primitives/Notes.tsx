import type { ReactElement } from 'react';
import type { Theme } from '../../core/index';
import type { LaidOutChart } from '../layout/types';
import { baselineAt } from './style';
import { DvText } from './Text';

export interface NotesProps {
  laid: LaidOutChart;
  theme: Theme;
  family: string;
}

/** Annotation details, clipping notes and the caption, in layout order, at the caption size. */
export function Notes({ laid, theme, family }: NotesProps): ReactElement | null {
  if (laid.notes.length === 0) return null;
  const size = theme.text.caption * laid.fontScale;
  const lh = size * theme.text.lineHeight;
  const box = laid.boxes.notes;
  let row = 0;
  return (
    <g data-dv-notes="">
      {laid.notes.map((note, n) => {
        const lines = note.lines.map((line) => {
          const y = baselineAt(box.y + row * lh, lh, size);
          row += 1;
          return { line, y };
        });
        return lines.map(({ line, y }, i) => (
          <DvText
            key={`${n}-${i}`}
            labelId={note.kind === 'caption' ? 'caption' : `note-${n}`}
            role={note.kind === 'caption' ? 'caption' : 'note'}
            x={box.x}
            y={y}
            size={size}
            weight={400}
            fill={theme.color.mutedText}
            family={family}
          >
            {line}
          </DvText>
        ));
      })}
    </g>
  );
}
