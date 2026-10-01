import type { CSSProperties } from 'react';
import type { Dash } from '../../core/index';

/**
 * Host-style isolation (design section 4): every visual property DravenViz draws is set as an
 * inline `style` on the element, because a host rule such as `text { fill: red }` beats an SVG
 * presentation attribute. Export normalization (Task 13) turns these into attributes again.
 */

/** Noto Sans ascent and descent in em, the values layout and the canvas measurer use. */
const ASCENT = 1.069;
const DESCENT = 0.293;

/** A CSS font-family value: a list or already-quoted name is used as given; a bare name is quoted. */
export function cssFamily(family: string): string {
  if (/[,'"]/.test(family)) return family;
  return `"${family.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}", sans-serif`;
}

/** Baseline of the first line of a text block whose line box starts at `top`. */
export function baselineAt(top: number, lineHeight: number, size: number): number {
  return top + (lineHeight - (ASCENT + DESCENT) * size) / 2 + ASCENT * size;
}

/** Baseline of a single line whose vertical centre is `centre`. */
export function baselineCentred(centre: number, size: number): number {
  return centre + ((ASCENT - DESCENT) / 2) * size;
}

/** Stroke dash array for a series or reference line (`undefined` means solid). */
export function dashArray(dash: Dash, width: number): string | undefined {
  if (dash === 'dashed') return `${round(width * 4)} ${round(width * 2.5)}`;
  if (dash === 'dotted') return `${round(width * 0.1)} ${round(width * 2.2)}`;
  return undefined;
}

/** The dash of an estimated range: shorter than the series dash so the two stay distinguishable. */
export function estimatedDashArray(width: number): string {
  return `${round(width * 2.5)} ${round(width * 2)}`;
}

const round = (v: number): number => Math.round(v * 1000) / 1000;

export interface StrokeStyleInput {
  color: string;
  width: number;
  dash?: Dash;
  /** Replace the dash array of `dash` (the estimated dash). */
  dashArray?: string | undefined;
}

/** Inline style of a stroked, unfilled path or line. Every property the spec lists is set. */
export function strokeStyle(input: StrokeStyleInput): CSSProperties {
  const dash = input.dashArray ?? dashArray(input.dash ?? 'solid', input.width);
  return {
    fill: 'none',
    stroke: input.color,
    strokeWidth: input.width,
    strokeDasharray: dash ?? 'none',
    strokeLinecap: input.dash === 'dotted' ? 'round' : 'butt',
    strokeLinejoin: 'round',
    opacity: 1,
  };
}

export interface TextStyleInput {
  family: string;
  size: number;
  weight: 400 | 600;
  fill: string;
  anchor?: 'start' | 'middle' | 'end';
}

export function textStyle(input: TextStyleInput): CSSProperties {
  return {
    fill: input.fill,
    stroke: 'none',
    opacity: 1,
    fontFamily: cssFamily(input.family),
    fontSize: input.size,
    fontWeight: input.weight,
    textAnchor: input.anchor ?? 'start',
  };
}
