/**
 * Time x ticks at calendar boundaries (design 8). Date-only data is positioned and labelled in UTC
 * (D15); instants use the render timezone. The machine timezone is never read: wall-clock fields
 * come from `Intl.DateTimeFormat` with an explicit `timeZone`.
 */
import { formatTime } from '../../core/format/index';
import type { TimeTickUnit } from '../../core/format/index';
import type { TickModel } from './types';

export type TimeKind = 'date' | 'instant';
export type TimeTickFormat = 'auto' | 'day' | 'week' | 'month' | 'quarter' | 'year' | 'hour';

interface Rung {
  unit: TimeTickUnit;
  /** Step in units of the rung's base ("month" steps are months, "quarter" steps are quarters). */
  k: number;
}

/** Fine to coarse. Coarsening on a duplicate label or an over-full axis walks down this list. */
const LADDER: readonly Rung[] = [
  { unit: 'hour', k: 1 },
  { unit: 'hour', k: 2 },
  { unit: 'hour', k: 3 },
  { unit: 'hour', k: 6 },
  { unit: 'hour', k: 12 },
  { unit: 'day', k: 1 },
  { unit: 'day', k: 2 },
  { unit: 'week', k: 1 },
  { unit: 'week', k: 2 },
  { unit: 'month', k: 1 },
  { unit: 'month', k: 2 },
  { unit: 'quarter', k: 1 },
  { unit: 'month', k: 6 },
  { unit: 'year', k: 1 },
  { unit: 'year', k: 2 },
  { unit: 'year', k: 5 },
  { unit: 'year', k: 10 },
  { unit: 'year', k: 20 },
  { unit: 'year', k: 50 },
  { unit: 'year', k: 100 },
];

const APPROX_MS: Record<TimeTickUnit, number> = {
  hour: 3_600_000,
  day: 86_400_000,
  week: 604_800_000,
  month: 2_629_800_000,
  quarter: 7_889_400_000,
  year: 31_557_600_000,
};

const MAX_TICKS = 6;
const DAY = 86_400_000;
const HOUR = 3_600_000;

const dtfs = new Map<string, Intl.DateTimeFormat>();
function wallFormat(timeZone: string): Intl.DateTimeFormat {
  let f = dtfs.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
    });
    dtfs.set(timeZone, f);
  }
  return f;
}

/** Wall-clock fields of an instant, packed as the UTC epoch of the same fields. */
function wallEpoch(epochMs: number, timeZone: string): number {
  const p = wallFormat(timeZone).formatToParts(epochMs);
  const get = (t: string): number => Number(p.find((x) => x.type === t)?.value);
  const d = new Date(0);
  d.setUTCFullYear(get('year'), get('month') - 1, get('day'));
  d.setUTCHours(get('hour'), get('minute'), get('second'), 0);
  return d.getTime();
}

/**
 * The instant whose wall-clock fields in `timeZone` equal the UTC fields of `wall`. A wall time
 * that falls in a spring-forward gap does not exist: it maps forward to the next existing instant
 * (the first moment after the gap). An ambiguous fall-back time takes the earlier instant.
 */
function fromWall(wall: number, timeZone: string): number {
  if (timeZone === 'UTC') return wall;
  const t1 = wall - (wallEpoch(wall, timeZone) - wall);
  const t2 = wall - (wallEpoch(t1, timeZone) - t1);
  const valid = [t1, t2].filter((t) => wallEpoch(t, timeZone) === wall);
  if (valid.length > 0) return Math.min(...valid);
  return Math.max(t1, t2);
}

function utcParts(wall: number): { y: number; m: number; d: number } {
  const dt = new Date(wall);
  return { y: dt.getUTCFullYear(), m: dt.getUTCMonth(), d: dt.getUTCDate() };
}

function wallOf(y: number, m: number, d: number, h = 0): number {
  const dt = new Date(0);
  dt.setUTCFullYear(y, m, d);
  dt.setUTCHours(h, 0, 0, 0);
  return dt.getTime();
}

/** Tick instants in [min, max] for one ladder rung, or null when there would be too many. */
function generate(rung: Rung, min: number, max: number, timeZone: string): number[] | null {
  if ((max - min) / (APPROX_MS[rung.unit] * rung.k) > 60) return null;
  const startWall = wallEpoch(min, timeZone);
  const out: number[] = [];
  const push = (wall: number): boolean => {
    const t = fromWall(wall, timeZone);
    if (t > max) return false;
    if (t >= min && t !== out[out.length - 1]) out.push(t);
    return true;
  };
  const guard = 400;
  if (rung.unit === 'hour') {
    let h = Math.floor(startWall / HOUR / rung.k) * rung.k;
    for (let i = 0; i < guard && push(h * HOUR); i++) h += rung.k;
  } else if (rung.unit === 'day') {
    let d = Math.floor(startWall / DAY / rung.k) * rung.k;
    for (let i = 0; i < guard && push(d * DAY); i++) d += rung.k;
  } else if (rung.unit === 'week') {
    // Weeks start on Monday; 1970-01-01 was a Thursday, so day 4 is the first Monday.
    let w = Math.floor((startWall / DAY - 4) / (7 * rung.k)) * rung.k;
    for (let i = 0; i < guard && push((4 + 7 * w) * DAY); i++) w += rung.k;
  } else if (rung.unit === 'month' || rung.unit === 'quarter') {
    const step = rung.unit === 'quarter' ? 3 * rung.k : rung.k;
    const { y, m } = utcParts(startWall);
    let idx = Math.floor((y * 12 + m) / step) * step;
    for (let i = 0; i < guard; i++) {
      if (!push(wallOf(Math.floor(idx / 12), idx % 12, 1))) break;
      idx += step;
    }
  } else {
    const { y } = utcParts(startWall);
    let yr = Math.floor(y / rung.k) * rung.k;
    for (let i = 0; i < guard; i++) {
      if (!push(wallOf(yr, 0, 1))) break;
      yr += rung.k;
    }
  }
  return out;
}

export interface TimeTicks {
  ticks: TickModel[];
  unit: TimeTickUnit;
}

/**
 * Ticks for a time axis domain. `tickFormat` fixes the starting unit; "auto" picks the rung whose
 * tick count is closest to 5 (preferring 4-6, then the coarser rung). A duplicate formatted label
 * coarsens the unit (design 8). First and last ticks are essential.
 */
export function timeTicks(
  min: number,
  max: number,
  kind: TimeKind,
  tickFormat: TimeTickFormat,
  locale: string,
  timezone: string,
): TimeTicks {
  const zone = kind === 'date' ? 'UTC' : timezone;
  const label = (t: number, unit: TimeTickUnit): string =>
    formatTime(t, kind, unit, locale, timezone);
  const build = (rung: Rung): { values: number[]; labels: string[] } | null => {
    const values = generate(rung, min, max, zone);
    if (!values) return null;
    return { values, labels: values.map((t) => label(t, rung.unit)) };
  };
  const isDistinct = (labels: string[]): boolean => new Set(labels).size === labels.length;

  let startIdx = 0;
  const explicit = tickFormat !== 'auto';
  // Calendar days have no time of day, so date-only axes never tick by the hour.
  const ladder = kind === 'date' ? LADDER.filter((r) => r.unit !== 'hour') : LADDER;
  if (explicit)
    startIdx = Math.max(
      0,
      ladder.findIndex((r) => r.unit === tickFormat),
    );

  let chosen: { rung: Rung; values: number[]; labels: string[] } | undefined;
  if (explicit) {
    for (let i = startIdx; i < ladder.length; i++) {
      const rung = ladder[i] as Rung;
      const b = build(rung);
      if (!b) continue;
      if (b.values.length > MAX_TICKS || !isDistinct(b.labels)) continue;
      if (b.values.length >= 2) chosen = { rung, ...b };
      break;
    }
  }
  if (!chosen) {
    let bestScore: number[] | undefined;
    for (const rung of ladder) {
      const b = build(rung);
      if (!b || b.values.length < 2 || !isDistinct(b.labels)) continue;
      const n = b.values.length;
      const score = [n >= 4 && n <= 6 ? 0 : 1, Math.abs(n - 5)];
      // `<=` on the second term prefers the coarser rung on a tie (later rungs are coarser).
      if (
        !bestScore ||
        (score[0] as number) < (bestScore[0] as number) ||
        (score[0] === bestScore[0] && (score[1] as number) <= (bestScore[1] as number))
      ) {
        bestScore = score;
        chosen = { rung, ...b };
      }
    }
  }
  if (!chosen) {
    // Span too short for two boundaries: label the domain ends so the axis is never bare.
    const unit: TimeTickUnit = kind === 'date' ? 'day' : 'hour';
    const values = max > min ? [min, max] : [min];
    return {
      ticks: toTickModels(
        values,
        values.map((t) => label(t, unit)),
      ),
      unit,
    };
  }
  return { ticks: toTickModels(chosen.values, chosen.labels), unit: chosen.rung.unit };
}

function toTickModels(values: number[], labels: string[]): TickModel[] {
  return values.map((value, i) => ({
    value,
    label: labels[i] as string,
    essential: i === 0 || i === values.length - 1,
  }));
}
