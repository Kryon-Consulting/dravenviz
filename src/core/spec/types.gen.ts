// GENERATED — do not edit. Source: schema/viz-spec-v1.schema.json. Regenerate with `pnpm gen`.
// Produced by json-schema-to-typescript; `pnpm check:drift` fails if this file is stale.

/**
 * DravenViz chart specification, schema version 1.
 */
export type VizSpec = CartesianSpec | DonutSpec | HeatmapSpec | ProgressSpec;
/**
 * Identifier; unique within its collection.
 */
export type Id = string;
/**
 * Plain text, 1-500 characters, no control characters. Always rendered as text.
 */
export type Text = string;
/**
 * #RRGGBB only.
 */
export type Color = string;
export type MarkerShape = 'circle' | 'square' | 'triangle' | 'diamond' | 'cross' | 'none';
export type Domain = IncludeZeroDomain | FitDomain | FixedDomain;
/**
 * ISO calendar day, or date-time carrying Z or an offset.
 */
export type IsoTime = string;
export type Dash = 'solid' | 'dashed' | 'dotted';
export type Quality = 'measured' | 'partial' | 'lagging' | 'estimated';
/**
 * Plain text, 1-500 characters; newline is allowed.
 */
export type MultilineText = string;

/**
 * Cartesian chart: bar, line, area and scatter series on shared axes.
 */
export interface CartesianSpec extends SpecBase {
  /**
   * Schema major version.
   */
  schemaVersion: 1;
  id: Id;
  kind: 'cartesian';
  /**
   * Chart title, 1-200 characters.
   */
  title: string;
  /**
   * Chart summary; used for <desc> and the table caption.
   */
  description?: string;
  /**
   * Printed footnote under the chart (at least 8 pt in print).
   */
  caption?: string;
  roles?: Roles;
  legend?: LegendOptions;
  orientation?: 'vertical' | 'horizontal';
  preset?: 'standard' | 'sparkline' | 'compact-stack';
  xAxis: CategoryAxis | LinearAxis | TimeAxis;
  /**
   * @minItems 1
   * @maxItems 2
   */
  yAxes: [ValueAxis, ...ValueAxis[]];
  /**
   * @minItems 1
   * @maxItems 16
   */
  series: [Series, ...Series[]];
  stacking?: {
    mode: 'absolute' | 'percent';
    valueUnit?: Text;
    segmentLabels?: 'none' | 'share' | 'value' | 'value-and-share';
  };
  bubble?: BubbleEncoding;
  /**
   * @minItems 0
   * @maxItems 16
   */
  referenceLines?: ReferenceLine[];
  /**
   * @minItems 0
   * @maxItems 16
   */
  annotations?: Annotation[];
  labels?: {
    values?: 'none' | 'totals' | 'all';
  };
}
/**
 * Caller-defined semantic roles.
 */
export interface Roles {
  [k: string]: RoleDef | undefined;
}
/**
 * Caller-defined semantic role; no business meaning in core.
 */
export interface RoleDef {
  label?: Text;
  color?: Color;
  pattern?: 'none' | 'diagonal' | 'dots' | 'crosshatch';
  shape?: MarkerShape;
}
export interface LegendOptions {
  /**
   * auto: shown when there is more than one series, slice or role.
   */
  show?: 'auto' | 'always' | 'never';
  /**
   * Default "bottom".
   */
  position?: 'top' | 'bottom';
}
export interface CategoryAxis {
  id: Id;
  scale: 'category';
  /**
   * Unique keys in display order.
   *
   * @minItems 1
   * @maxItems 250
   */
  categories: [Text, ...Text[]];
  /**
   * Same length as categories; displayed verbatim.
   *
   * @minItems 1
   * @maxItems 250
   */
  labels?: [Text, ...Text[]];
  label?: Text;
  labelPolicy?: 'auto' | 'wrap' | 'rotate';
}
export interface LinearAxis {
  id: Id;
  scale: 'linear';
  label?: Text;
  unit?: Text;
  format?: NumberFormat;
  domain?: Domain;
}
export interface NumberFormat {
  /**
   * Default "decimal". "percent" treats raw values as percentage points.
   */
  style?: 'decimal' | 'percent' | 'currency' | 'compact';
  /**
   * ISO 4217 code; required when style is "currency".
   */
  currency?: string;
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
  signDisplay?: 'auto' | 'always' | 'exceptZero';
}
export interface IncludeZeroDomain {
  policy: 'include-zero';
}
export interface FitDomain {
  policy: 'fit';
}
export interface FixedDomain {
  policy: 'fixed';
  min: number;
  max: number;
  /**
   * Default "error".
   */
  overflow?: 'error' | 'clip-indicated';
}
export interface TimeAxis {
  id: Id;
  scale: 'time';
  label?: Text;
  domain?: {
    min?: IsoTime;
    max?: IsoTime;
  };
  tickFormat?: 'auto' | 'day' | 'week' | 'month' | 'quarter' | 'year' | 'hour';
}
export interface ValueAxis {
  id: Id;
  label?: Text;
  unit?: Text;
  format?: NumberFormat;
  position?: 'left' | 'right';
  domain?: Domain;
  ticks?: {
    count?: number;
    values?: number[];
  };
}
export interface Series {
  id: Id;
  label: Text;
  mark: 'bar' | 'line' | 'area' | 'scatter';
  yAxisId: Id;
  role?: Id;
  color?: Color;
  stackId?: Id;
  interpolation?: 'linear' | 'monotone';
  dash?: Dash;
  marker?: {
    shape?: MarkerShape;
    show?: 'all' | 'none' | 'quality';
  };
  points: Point[];
}
export interface Point {
  id: Id;
  x: Text | number;
  /**
   * y value; null means missing.
   */
  value: number | null;
  displayValue?: Text;
  quality?: Quality;
  renderHint?: 'line' | 'marker-only' | 'gap';
  role?: Id;
  color?: Color;
  shape?: MarkerShape;
  /**
   * Scatter only; requires `bubble`.
   */
  size?: number | null;
  datumLabel?: Text;
  staticLabel?: boolean;
  note?: Text;
}
export interface BubbleEncoding {
  mode: 'area' | 'radius';
  /**
   * Size values mapped; 0 <= min < max.
   *
   * @minItems 2
   * @maxItems 2
   */
  domain: [number, number];
  /**
   * Logical px radius at domain min and max.
   *
   * @minItems 2
   * @maxItems 2
   */
  range: [number, number];
  minVisibleRadius?: number;
}
export interface ReferenceLine {
  id: Id;
  axisId: Id;
  value: Text | number;
  label?: Text;
  dash?: Dash;
  role?: Id;
}
export interface Annotation {
  id: Id;
  x: Text | number;
  x2?: Text | number;
  yAxisId?: Id;
  y?: number;
  label: Text;
  detail?: MultilineText;
}
/**
 * Fields shared by every chart kind.
 */
export interface SpecBase {
  /**
   * Schema major version.
   */
  schemaVersion: 1;
  id: Id;
  kind: 'cartesian' | 'donut' | 'heatmap' | 'progress';
  /**
   * Chart title, 1-200 characters.
   */
  title: string;
  /**
   * Chart summary; used for <desc> and the table caption.
   */
  description?: string;
  /**
   * Printed footnote under the chart (at least 8 pt in print).
   */
  caption?: string;
  roles?: Roles;
  legend?: LegendOptions;
}
/**
 * Donut chart.
 */
export interface DonutSpec extends SpecBase {
  /**
   * Schema major version.
   */
  schemaVersion: 1;
  id: Id;
  kind: 'donut';
  /**
   * Chart title, 1-200 characters.
   */
  title: string;
  /**
   * Chart summary; used for <desc> and the table caption.
   */
  description?: string;
  /**
   * Printed footnote under the chart (at least 8 pt in print).
   */
  caption?: string;
  roles?: Roles;
  legend?: LegendOptions;
  /**
   * @minItems 1
   * @maxItems 32
   */
  slices: [Slice, ...Slice[]];
  unit?: Text;
  format?: NumberFormat;
  center?: {
    /**
     * Plain text, 1-500 characters, no control characters. Always rendered as text.
     */
    value?: string;
    label?: Text;
  };
  legendValues?: 'none' | 'value' | 'value-share';
}
export interface Slice {
  id: Id;
  label: Text;
  /**
   * >= 0; null means missing.
   */
  value: number | null;
  displayValue?: Text;
  role?: Id;
  color?: Color;
}
/**
 * Heatmap.
 */
export interface HeatmapSpec extends SpecBase {
  /**
   * Schema major version.
   */
  schemaVersion: 1;
  id: Id;
  kind: 'heatmap';
  /**
   * Chart title, 1-200 characters.
   */
  title: string;
  /**
   * Chart summary; used for <desc> and the table caption.
   */
  description?: string;
  /**
   * Printed footnote under the chart (at least 8 pt in print).
   */
  caption?: string;
  roles?: Roles;
  legend?: LegendOptions;
  /**
   * @minItems 1
   * @maxItems 100
   */
  rows: [HeatmapAxisItem, ...HeatmapAxisItem[]];
  /**
   * @minItems 1
   * @maxItems 100
   */
  columns: [HeatmapAxisItem, ...HeatmapAxisItem[]];
  cells: HeatmapCell[];
  scale: HeatmapScale;
  unit?: Text;
  format?: NumberFormat;
  cellLabels?: 'all' | 'none';
  rowAxisLabel?: Text;
  columnAxisLabel?: Text;
}
export interface HeatmapAxisItem {
  id: Id;
  label: Text;
}
export interface HeatmapCell {
  row: Id;
  column: Id;
  value: number | null;
  displayValue?: Text;
  note?: Text;
}
export interface HeatmapScale {
  type: 'sequential' | 'diverging' | 'threshold';
  /**
   * sequential: [min, max]; diverging: [min, mid, max]; threshold: ascending breakpoints.
   *
   * @minItems 1
   */
  domain: [number, ...number[]];
  /**
   * sequential: 2+ stops; diverging: 3+; threshold: n + 1.
   *
   * @minItems 2
   */
  colors: [Color, Color, ...Color[]];
}
/**
 * Progress bars or rings.
 */
export interface ProgressSpec extends SpecBase {
  /**
   * Schema major version.
   */
  schemaVersion: 1;
  id: Id;
  kind: 'progress';
  /**
   * Chart title, 1-200 characters.
   */
  title: string;
  /**
   * Chart summary; used for <desc> and the table caption.
   */
  description?: string;
  /**
   * Printed footnote under the chart (at least 8 pt in print).
   */
  caption?: string;
  roles?: Roles;
  legend?: LegendOptions;
  variant: 'bar' | 'ring';
  domain: {
    min: number;
    max: number;
  };
  overflow?: 'error' | 'clip-indicated';
  unit?: Text;
  format?: NumberFormat;
  /**
   * @minItems 1
   * @maxItems 20
   */
  items: [ProgressItem, ...ProgressItem[]];
}
export interface ProgressItem {
  id: Id;
  label: Text;
  value: number | null;
  displayValue?: Text;
  target?: number | null;
  targetLabel?: Text;
  role?: Id;
  color?: Color;
}
