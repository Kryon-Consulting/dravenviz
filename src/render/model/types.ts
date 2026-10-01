/**
 * DOM-free chart model (design section 4). The model turns a validated spec into data meaning:
 * scales, ticks, segments, markers, clipping and an expected-mark manifest. Layout (Task 10) and
 * drawing (Task 12) consume it. Everything here is plain JSON-serialisable data: no Map, Set,
 * Date or function, so two builds from the same input compare equal with `JSON.stringify`.
 */
import type { Dash, MarkerShape, NumberFormat, Quality, Theme } from '../../core/index';

export interface ModelContext {
  theme: Theme;
  locale: string;
  timezone: string;
}

export interface TickModel {
  /** Number for linear, time (epoch ms) and value axes. */
  value: number | string;
  label: string;
  /** First and last ticks are essential: layout may thin the others, never these. */
  essential: boolean;
}

export type XScaleModel =
  | {
      type: 'category';
      /** The spec's x axis id. */
      id: string;
      keys: string[];
      labels: string[];
      /** Axis title, when the spec gives one. */
      label?: string;
    }
  | {
      type: 'linear' | 'time';
      id: string;
      domain: [number, number];
      ticks: TickModel[];
      label?: string;
      /** Time axes only: whether x values are calendar days or absolute instants (D15). */
      timeKind?: 'date' | 'instant';
    };

export interface YAxisModel {
  id: string;
  label?: string;
  unit?: string;
  domain: [number, number];
  ticks: TickModel[];
  position: 'left' | 'right';
  overflow: 'error' | 'clip-indicated';
  /** Effective number format: the spec format plus the axis-level fraction digits (design 5.1). */
  format: NumberFormat;
}

export type MarkerVariant = 'filled' | 'hollow' | 'ringed';

export interface MarkerModel {
  pointId: string;
  reason: 'quality' | 'marker-only' | 'isolated' | 'all';
  variant: MarkerVariant;
}

export interface ClippedModel {
  pointId: string;
  side: 'above' | 'below';
}

export interface SegmentModel {
  pointIds: string[];
  /** Each range holds the ids bounding one dashed x range, clamped to the segment. */
  estimatedRanges: [string, string][];
}

export interface PointModel {
  id: string;
  /** The raw spec x (category key, number, or ISO string). */
  xKey: string | number;
  /** Position input for scaling: category index, linear x, or epoch ms for time. */
  xValue: number;
  value: number | null;
  /** `datumLabel ?? category label ?? formatted x`. */
  label: string;
  /** `displayValue ?? formatted value`, or the theme's not-measured string for null. */
  display: string;
  quality: Quality;
  renderHint: 'line' | 'marker-only' | 'gap';
  note?: string;
  /** Present only when the datum overrides the series color (datum color or role). */
  color?: string;
  /** Present only when the datum overrides the series marker shape. */
  shape?: MarkerShape;
}

export interface LineSeriesModel {
  id: string;
  label: string;
  axisId: string;
  style: { color: string; dash: Dash; shape: MarkerShape; width: number };
  interpolation: 'linear' | 'monotone';
  points: PointModel[];
  segments: SegmentModel[];
  markers: MarkerModel[];
  clipped: ClippedModel[];
}

export interface AnnotationModel {
  id: string;
  label: string;
  /** Raw x of the annotation (and `x2` for a range), independent of which ticks are drawn. */
  xKey: string | number;
  xValue: number;
  x2Key?: string | number;
  x2Value?: number;
  yAxisId?: string;
  y?: number;
  detail?: string;
  /** 1-based number of the note carrying `detail`; the glyph formatting belongs to layout. */
  noteNumber?: number;
}

export interface ReferenceLineModel {
  id: string;
  axisId: string;
  value: number | string;
  label?: string;
  dash: Dash;
  color: string;
}

export interface LegendItem {
  kind: 'series' | 'quality';
  id: string;
  label: string;
  /** Quality entries only: what the quality's mark means. */
  meaning?: string;
  color?: string;
  dash?: Dash;
  shape?: MarkerShape;
  /** Quality entries only. */
  quality?: Exclude<Quality, 'measured'>;
  variant?: MarkerVariant | 'dashed-segment';
}

export interface MarkManifest {
  /** Only groups with a non-zero count are listed, in a fixed order. */
  groups: { key: string; count: number }[];
}

export interface CartesianModel {
  kind: 'cartesian';
  chartId: string;
  title: string;
  description?: string;
  caption?: string;
  x: XScaleModel;
  yAxes: YAxisModel[];
  series: LineSeriesModel[];
  annotations: AnnotationModel[];
  referenceLines: ReferenceLineModel[];
  state: 'ok' | 'empty';
  legend: LegendItem[];
  legendOptions: { show: 'auto' | 'always' | 'never'; position: 'top' | 'bottom' };
  /**
   * Plain strings in print order: annotation details first (numbered by `noteNumber`, in
   * annotation order), then clipping notes (one per axis and side).
   */
  notes: string[];
  manifest: MarkManifest;
}

export interface UnsupportedModel {
  kind: 'unsupported';
  reason: string;
}

export type ChartModel = CartesianModel | UnsupportedModel;
