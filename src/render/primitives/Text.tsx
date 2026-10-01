import type { ReactElement } from 'react';
import { textStyle } from './style';

export type TextRole =
  | 'title'
  | 'tick'
  | 'axis-title'
  | 'legend'
  | 'annotation'
  | 'reference'
  | 'direct'
  | 'note'
  | 'caption';

export interface DvTextProps {
  /** Logical label id: every `<text>` of one label (wrapped lines) shares it. */
  labelId: string;
  role: TextRole;
  x: number;
  /** Baseline y. */
  y: number;
  size: number;
  weight: 400 | 600;
  fill: string;
  family: string;
  anchor?: 'start' | 'middle' | 'end';
  /** Rotation in degrees about (x, y). */
  rotate?: number;
  children: string;
}

/**
 * Every `<text>` DravenViz draws goes through here: inline style (host-style isolation), a label
 * id and a role for the PDF text-to-role mapping (design section 13). The content is a React text
 * child, so spec text is never interpreted as markup.
 */
export function DvText(props: DvTextProps): ReactElement {
  const { labelId, role, x, y, rotate, children } = props;
  return (
    <text
      data-dv-label-id={labelId}
      data-dv-text-role={role}
      x={x}
      y={y}
      {...(rotate === undefined || rotate === 0
        ? {}
        : { transform: `rotate(${rotate} ${x} ${y})` })}
      style={textStyle({
        family: props.family,
        size: props.size,
        weight: props.weight,
        fill: props.fill,
        ...(props.anchor === undefined ? {} : { anchor: props.anchor }),
      })}
    >
      {children}
    </text>
  );
}
