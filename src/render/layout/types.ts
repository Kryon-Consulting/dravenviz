/**
 * Layout types (design section 8). Everything a `LaidOutChart` holds is plain JSON-serialisable
 * data, so two layouts of the same model, options and measurer compare equal with `JSON.stringify`.
 */
import type { Theme } from '../../core/index';
import type { CartesianModel, LegendItem } from '../model/types';

/** Measures one run of text. Sizes are logical units; the result is in the same units. */
export type TextMeasurer = (
  text: string,
  font: { size: number; weight: 400 | 600 },
) => { width: number; ascent: number; descent: number };

export interface LayoutOptions {
  width: number;
  height: number;
  theme: Theme;
  mode: 'interactive' | 'static';
  /** Physical width the viewBox is fitted to (aspect-preserving). Enables print font scaling. */
  printWidthMm?: number;
}

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * One x tick label. `x` is the absolute anchor x in the viewBox: the label centre for
 * `rotate: 0`, the end of the text for `rotate: -45`. `y` is the anchor y (top of the label
 * line for `rotate: 0`, the end of the text's centre line for `rotate: -45`). `width` and
 * `height` are the unrotated footprint of the label (widest line, all lines).
 * A hidden (`visible: false`) tick keeps its fields so the data table and tooltip still have it.
 */
export interface PlacedTick {
  value: number | string;
  lines: string[];
  rotate: 0 | -45;
  visible: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface NoteLine {
  kind: 'annotation' | 'clip' | 'caption';
  /** Annotation notes only: the 1-based number shown as a circled digit. */
  number?: number;
  /** The full note text, e.g. "① Partial week — Collection paused…". */
  text: string;
  /** `text` wrapped to the notes width. Joined with a space it equals `text`. */
  lines: string[];
}

/**
 * Static-mode label that is drawn inside the plot at its scaled position. Layout only measures
 * it; positions come from the scales, and collision handling for selected scatter labels is a
 * slice-3 concern (see `StaticLabelPlacer`).
 */
export interface StaticLabel {
  kind: 'annotation' | 'reference';
  id: string;
  text: string;
  width: number;
  height: number;
}

/** Seam for slice 3: resolves collisions among static scatter labels. Slice 1 has no implementation. */
export type StaticLabelPlacer = (labels: StaticLabel[], plot: Box) => StaticLabel[];

export type XLabelStage = 'horizontal' | 'wrap' | 'rotate' | 'thin' | 'none';

export interface LaidOutChart {
  model: CartesianModel;
  width: number;
  height: number;
  fontScale: number;
  boxes: {
    title: Box;
    legend: Box;
    plot: Box;
    /** One box per y axis id, plus `x` for the x axis. */
    axes: Record<string, Box>;
    notes: Box;
  };
  titleLines: string[];
  legendRows: LegendItem[][];
  xTicks: PlacedTick[];
  notes: NoteLine[];
  /** Static mode only; empty in interactive mode. */
  staticLabels: StaticLabel[];
  metrics: {
    /** Present only when `printWidthMm` is set. Effective printed pt after `fontScale`. */
    effectivePt?: { title: number; label: number; caption: number };
    /** Which stage of the x label policy was reached. */
    xLabelStage: XLabelStage;
    /** True when the title needed more than 3 lines and its third line ends in an ellipsis. */
    titleEllipsized: boolean;
  };
}
