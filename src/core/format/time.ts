import { InvalidSpecError } from '../errors';

export type TimeKind = 'date' | 'instant';

export interface ParsedTime {
  /** Milliseconds since the Unix epoch, UTC. */
  epochMs: number;
  /** `date`: a calendar day (UTC midnight). `instant`: a date-time that carried Z or an offset. */
  kind: TimeKind;
}

export type TimeParseResult =
  | ({ ok: true } & ParsedTime)
  | { ok: false; rule: 'invalid-time' | 'time-without-offset'; message: string };

const ISO =
  /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,9}))?)?(Z|[+-]\d{2}:\d{2})?)?$/;

const INVALID_MESSAGE =
  'Use an ISO 8601 calendar day (YYYY-MM-DD) or a date-time ending in Z or an offset (YYYY-MM-DDTHH:mm:ssZ or +HH:mm) with a real date and time.';
const NO_OFFSET_MESSAGE =
  'This date-time has no UTC offset. Append Z or an offset such as +02:00, or use a date-only YYYY-MM-DD value.';

function daysInMonth(year: number, month: number): number {
  if (month === 2) return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 29 : 28;
  return month === 4 || month === 6 || month === 9 || month === 11 ? 30 : 31;
}

/**
 * Strict ISO 8601 parser. Pure UTC arithmetic: never the platform text date parser, never the
 * machine timezone. Returns a result instead of throwing so callers can attach their own path.
 */
export function parseTime(value: string): TimeParseResult {
  const m = ISO.exec(value);
  if (!m) return { ok: false, rule: 'invalid-time', message: INVALID_MESSAGE };
  const [, ys, mos, ds, hs, mis, ss, fs, zone] = m;
  const year = Number(ys);
  const month = Number(mos);
  const day = Number(ds);
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) {
    return { ok: false, rule: 'invalid-time', message: INVALID_MESSAGE };
  }
  // setUTCFullYear avoids Date.UTC's 0-99 -> 1900-1999 mapping.
  const d = new Date(0);
  d.setUTCFullYear(year, month - 1, day);
  if (hs === undefined) return { ok: true, epochMs: d.getTime(), kind: 'date' };

  const hour = Number(hs);
  const minute = Number(mis);
  const second = ss === undefined ? 0 : Number(ss);
  if (hour > 23 || minute > 59 || second > 59) {
    return { ok: false, rule: 'invalid-time', message: INVALID_MESSAGE };
  }
  if (zone === undefined)
    return { ok: false, rule: 'time-without-offset', message: NO_OFFSET_MESSAGE };

  const millis = fs === undefined ? 0 : Number(fs.padEnd(3, '0').slice(0, 3));
  let offsetMinutes = 0;
  if (zone !== 'Z') {
    const oh = Number(zone.slice(1, 3));
    const om = Number(zone.slice(4, 6));
    if (oh > 23 || om > 59) return { ok: false, rule: 'invalid-time', message: INVALID_MESSAGE };
    offsetMinutes = (zone.startsWith('-') ? -1 : 1) * (oh * 60 + om);
  }
  d.setUTCHours(hour, minute, second, millis);
  return { ok: true, epochMs: d.getTime() - offsetMinutes * 60_000, kind: 'instant' };
}

/**
 * Parse a spec time value. Throws `InvalidSpecError` with rule `invalid-time` or
 * `time-without-offset` (path is empty; the caller knows where the value came from).
 */
export function parseTimeValue(value: string): ParsedTime {
  const r = parseTime(value);
  if (!r.ok) throw new InvalidSpecError([{ rule: r.rule, path: '', message: r.message }]);
  return { epochMs: r.epochMs, kind: r.kind };
}
