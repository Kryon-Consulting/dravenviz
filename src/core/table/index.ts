/**
 * Data table projection (design section 11). Pure and DOM-free: the React `DataTable`, the print
 * `renderDataTable` and the docs all render this one model. Missing cells read the theme's
 * "Not measured" string, never an empty string or zero.
 *
 * `columns[0]` is the row-header column (the x position); `rows[i].cells[j]` belongs to
 * `columns[j + 1]`. Row `id` is the raw x value (category key, number or ISO string).
 */
import { DravenVizError } from '../errors';
import { formatNumber } from '../format/number';
import { formatTime, parseTimeValue, type TimeKind } from '../format/time';
import type { CartesianSpec, Point, Quality, Series, ValueAxis, VizSpec } from '../spec/index';
import { themes } from '../theme/resolve';

export type CellState =
  | 'measured'
  | 'missing'
  | 'partial'
  | 'lagging'
  | 'estimated'
  | 'clipped'
  | 'unavailable'
  | 'empty';

export interface DataTableCell {
  text: string;
  value: number | string | null;
  state: CellState;
}

export interface DataTable {
  /** Title plus a unit summary. */
  caption: string;
  columns: { key: string; label: string; unit?: string; align: 'start' | 'end' }[];
  rows: { id: string; header: string; cells: DataTableCell[] }[];
  /** Annotation details, point notes and clipping notes. */
  notes: string[];
}

export interface DataTableOptions {
  locale?: string;
  timezone?: string;
}

const NOT_MEASURED = themes.print.strings.notMeasured;

function notImplemented(spec: VizSpec): never {
  throw new DravenVizError(
    'RENDER_FAILED',
    `Data tables for ${spec.kind} charts are added in a later slice.`,
    {
      chartId: spec.id,
      issues: [
        {
          rule: 'not-implemented-in-slice',
          path: '/kind',
          message: `Data tables for ${spec.kind} charts are added in a later slice.`,
        },
      ],
    },
  );
}

const capitalise = (s: string): string => (s === '' ? s : s[0]!.toUpperCase() + s.slice(1));

interface Position {
  /** Raw spec x, used as the row id. */
  raw: string | number;
  /** Sort/lookup key: category index, linear x or epoch ms. */
  at: number;
}

function qualityState(q: Quality | undefined): CellState {
  return q === 'partial' || q === 'lagging' || q === 'estimated' ? q : 'measured';
}

function cartesianTable(spec: CartesianSpec, options: DataTableOptions): DataTable {
  const locale = options.locale ?? 'en-US';
  const timezone = options.timezone ?? 'UTC';
  const axis = spec.xAxis;
  const yById = new Map<string, ValueAxis>(spec.yAxes.map((a) => [a.id, a]));
  const num = (v: number, a: ValueAxis | undefined): string => formatNumber(v, a?.format, locale);

  // ---- row positions ---------------------------------------------------------------------
  let timeKind: TimeKind = 'date';
  const atOf = (x: string | number): number => {
    if (axis.scale === 'category') return axis.categories.indexOf(String(x));
    if (axis.scale === 'time') return parseTimeValue(String(x)).epochMs;
    return Number(x);
  };
  if (axis.scale === 'time') {
    for (const s of spec.series)
      for (const p of s.points)
        if (typeof p.x === 'string' && parseTimeValue(p.x).kind === 'instant') timeKind = 'instant';
  }
  let positions: Position[];
  if (axis.scale === 'category') {
    positions = axis.categories.map((key, at) => ({ raw: key, at }));
  } else {
    const seen = new Map<number, Position>();
    for (const s of spec.series)
      for (const p of s.points) {
        const at = atOf(p.x);
        if (!seen.has(at)) seen.set(at, { raw: p.x, at });
      }
    positions = [...seen.values()].sort((a, b) => a.at - b.at);
  }
  const headerOf = (p: Position): string => {
    if (axis.scale === 'category') return axis.labels?.[p.at] ?? String(p.raw);
    if (axis.scale === 'time')
      return formatTime(p.at, timeKind, timeKind === 'date' ? 'day' : 'hour', locale, timezone);
    return formatNumber(p.at, axis.format, locale);
  };

  // ---- clipping ----------------------------------------------------------------------------
  const clipRange = (a: ValueAxis | undefined): [number, number] | undefined =>
    a?.domain?.policy === 'fixed' && a.domain.overflow === 'clip-indicated'
      ? [a.domain.min, a.domain.max]
      : undefined;

  // ---- cells -------------------------------------------------------------------------------
  const clipped = new Map<string, { above: number[]; below: number[] }>();
  const cellFor = (s: Series, p: Point | undefined): DataTableCell => {
    if (p === undefined || p.value === null) {
      return { text: NOT_MEASURED, value: null, state: 'missing' };
    }
    const a = yById.get(s.yAxisId);
    const range = clipRange(a);
    let state = qualityState(p.quality);
    if (range !== undefined && (p.value > range[1] || p.value < range[0])) {
      state = 'clipped';
      const entry = clipped.get(s.yAxisId) ?? { above: [], below: [] };
      (p.value > range[1] ? entry.above : entry.below).push(p.value);
      clipped.set(s.yAxisId, entry);
    }
    const shown = p.displayValue ?? num(p.value, a);
    // The quality word travels with the number (also in the legend): a table has no marks.
    const word =
      state === 'partial' || state === 'lagging' || state === 'estimated' ? state : undefined;
    return {
      text: word === undefined ? shown : `${shown} (${capitalise(word)})`,
      value: p.value,
      state,
    };
  };

  const notes: string[] = [];
  const rows = positions.map((pos) => {
    const header = headerOf(pos);
    const cells = spec.series.map((s) => {
      const point = s.points.find((p) => atOf(p.x) === pos.at);
      if (point?.note !== undefined) notes.push(`${s.label}, ${header}: ${point.note}`);
      return cellFor(s, point);
    });
    return { id: String(pos.raw), header, cells };
  });

  const annotationNotes = (spec.annotations ?? [])
    .filter((a) => a.detail !== undefined)
    .map((a, i) => `(${i + 1}) ${a.label} — ${a.detail as string}`);
  const clipNotes: string[] = [];
  for (const a of spec.yAxes) {
    const entry = clipped.get(a.id);
    const range = clipRange(a);
    if (entry === undefined || range === undefined) continue;
    const side = (values: number[], dir: 'above' | 'below'): void => {
      if (values.length === 0) return;
      const n = values.length;
      const bound = dir === 'above' ? range[1] : range[0];
      const extreme = dir === 'above' ? Math.max(...values) : Math.min(...values);
      clipNotes.push(
        `${n} ${n === 1 ? 'value' : 'values'} ${dir} ${num(bound, a)} ${n === 1 ? 'is' : 'are'} clipped at the ${dir === 'above' ? 'top' : 'bottom'} edge (${dir === 'above' ? 'max' : 'min'} ${num(extreme, a)})`,
      );
    };
    side(entry.above, 'above');
    side(entry.below, 'below');
  }

  const units = [
    ...new Set(spec.yAxes.map((a) => a.unit).filter((u): u is string => u !== undefined)),
  ];
  const xLabel =
    axis.label ?? (axis.scale === 'time' ? 'Date' : capitalise(axis.id.replace(/[-_]+/g, ' ')));
  return {
    caption: units.length > 0 ? `${spec.title} (${units.join(', ')})` : spec.title,
    columns: [
      { key: axis.id, label: xLabel, align: 'start' },
      ...spec.series.map((s) => {
        const unit = yById.get(s.yAxisId)?.unit;
        return {
          key: s.id,
          label: unit === undefined ? s.label : `${s.label} (${unit})`,
          ...(unit === undefined ? {} : { unit }),
          align: 'end' as const,
        };
      }),
    ],
    rows,
    notes: [...annotationNotes, ...notes, ...clipNotes],
  };
}

/** The data table for a validated spec. Slice 1 projects Cartesian charts. */
export function toDataTable(spec: VizSpec, options: DataTableOptions = {}): DataTable {
  if (spec.kind === 'cartesian') return cartesianTable(spec, options);
  return notImplemented(spec);
}
