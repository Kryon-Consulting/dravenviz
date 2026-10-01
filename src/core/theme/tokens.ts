import type { Dash, MarkerShape, RoleDef } from '../spec/index';

export type ThemeName = 'light' | 'dark' | 'print';

export interface SeriesStyle {
  dash: Dash;
  shape: MarkerShape;
  pattern: NonNullable<RoleDef['pattern']>;
}

export interface ThemeRole {
  color: string;
  pattern?: RoleDef['pattern'];
  shape?: MarkerShape;
}

/** Resolved theme (design section 7). Every color is `#RRGGBB`; every size is a logical px value. */
export interface Theme {
  name: string;
  /** Theme version, semver; recorded in evidence. */
  version: string;
  font: { family: string; weights: { regular: 400; strong: 600 } };
  text: { title: number; label: number; caption: number; lineHeight: number };
  color: {
    background: string;
    text: string;
    mutedText: string;
    axis: string;
    grid: string;
    focus: string;
    missing: string;
    threshold: string;
    annotation: string;
  };
  /** 8 categorical slots. */
  palette: string[];
  /** Empty in built-in themes; filled by caller overrides. */
  roles: Record<string, ThemeRole>;
  /** 8 slots, parallel to `palette`. */
  seriesStyles: SeriesStyle[];
  sequential: string[];
  diverging: string[];
  spacing: {
    padding: number;
    legendGap: number;
    titleGap: number;
    barGap: number;
    groupGap: number;
  };
  stroke: { line: number; axis: number; grid: number; reference: number; sliceBorder: number };
  marker: { size: number; hollowStroke: number };
  strings: {
    unavailable: string;
    notMeasured: string;
    noData: string;
    incomplete: string;
    target: string;
    clipped: string;
  };
}

export type DeepPartial<T> = T extends readonly unknown[]
  ? T
  : T extends object
    ? { [K in keyof T]?: DeepPartial<T[K]> }
    : T;

/** Typed, validated overrides. Arrays are replaced whole; `roles` merges by role key. */
export type ThemeOverrides = DeepPartial<Omit<Theme, 'name'>>;

export const THEME_VERSION = '1.0.0';

export const FONT = {
  family: "'Noto Sans', sans-serif",
  weights: { regular: 400, strong: 600 },
} as const;

/**
 * Slot pattern: 0 solid/circle, 1 dashed/square, 2 dotted/triangle, 3 solid/diamond; slots 4-7 repeat
 * the dashes with the remaining shapes. Every pair differs in dash or shape; patterns are reserved
 * for the later slots.
 */
export const SERIES_STYLES: readonly SeriesStyle[] = [
  { dash: 'solid', shape: 'circle', pattern: 'none' },
  { dash: 'dashed', shape: 'square', pattern: 'none' },
  { dash: 'dotted', shape: 'triangle', pattern: 'none' },
  { dash: 'solid', shape: 'diamond', pattern: 'none' },
  { dash: 'solid', shape: 'cross', pattern: 'diagonal' },
  { dash: 'dashed', shape: 'cross', pattern: 'dots' },
  { dash: 'dotted', shape: 'cross', pattern: 'crosshatch' },
  { dash: 'solid', shape: 'none', pattern: 'diagonal' },
];

export const STRINGS = {
  unavailable: 'Unavailable',
  notMeasured: 'Not measured',
  noData: 'No data',
  incomplete: 'Incomplete',
  target: 'Target',
  clipped: 'Clipped',
} as const;

export function cloneStyles(): SeriesStyle[] {
  return SERIES_STYLES.map((s) => ({ ...s }));
}
