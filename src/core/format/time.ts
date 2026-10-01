import { DravenVizError, InvalidSpecError } from '../errors';

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

export type TimeTickUnit = 'hour' | 'day' | 'week' | 'month' | 'quarter' | 'year';

const dtfCache = new Map<string, Intl.DateTimeFormat>();

function dateTimeFormat(
  locale: string,
  timeZone: string,
  options: Intl.DateTimeFormatOptions,
): Intl.DateTimeFormat {
  const key = `${locale}|${timeZone}|${JSON.stringify(options)}`;
  let dtf = dtfCache.get(key);
  if (!dtf) {
    try {
      dtf = new Intl.DateTimeFormat(locale, { ...options, timeZone });
    } catch (e) {
      throw new DravenVizError(
        'INVALID_OPTIONS',
        'The locale or IANA timezone name is not supported.',
        { cause: e },
      );
    }
    dtfCache.set(key, dtf);
  }
  return dtf;
}

/**
 * Validates the render `locale` and `timezone` options once, up front (design section 9, step 1).
 * Throws `INVALID_OPTIONS` with path `/locale` or `/timezone`. A raw UTC offset such as "+05:00"
 * is rejected (R15). Applies to every chart, including those without a time axis.
 */
export function assertLocaleAndTimezone(locale: unknown, timezone: unknown): void {
  const bad = (message: string, path: string, cause?: unknown): DravenVizError =>
    new DravenVizError('INVALID_OPTIONS', message, {
      path,
      ...(cause === undefined ? {} : { cause }),
    });
  if (typeof locale !== 'string' || locale === '') {
    throw bad('locale must be a non-empty BCP 47 language tag.', '/locale');
  }
  try {
    Intl.getCanonicalLocales(locale);
  } catch (e) {
    throw bad('locale is not a valid BCP 47 language tag.', '/locale', e);
  }
  if (typeof timezone !== 'string' || timezone === '') {
    throw bad('timezone must be a non-empty IANA time zone name.', '/timezone');
  }
  if (/^[+-]\d/.test(timezone)) {
    throw bad('The timezone must be an IANA name, not an offset.', '/timezone');
  }
  try {
    new Intl.DateTimeFormat(locale, { timeZone: timezone });
  } catch (e) {
    throw bad('timezone is not a supported IANA time zone name.', '/timezone', e);
  }
}

const UNIT_OPTIONS: Record<Exclude<TimeTickUnit, 'quarter'>, Intl.DateTimeFormatOptions> = {
  hour: { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' },
  day: { month: 'short', day: 'numeric' },
  week: { month: 'short', day: 'numeric' },
  month: { month: 'short', year: 'numeric' },
  year: { year: 'numeric' },
};

/**
 * Format a point label for a tooltip, announcement or data-table row header: always a full date
 * (year, month, day), plus hour and minute for an instant, so two different positions never read
 * alike. `withZone` appends the render timezone to an instant (not needed where the column header
 * already names it). A calendar day always formats in UTC. The machine timezone is never used.
 */
export function formatTimeLabel(
  epochMs: number,
  kind: TimeKind,
  locale: string,
  timezone: string,
  withZone = false,
): string {
  if (!Number.isFinite(epochMs)) {
    throw new DravenVizError('INVALID_OPTIONS', 'A time format needs a finite epoch value.');
  }
  assertLocaleAndTimezone(locale, timezone);
  if (kind === 'date') {
    return dateTimeFormat(locale, 'UTC', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(epochMs);
  }
  return dateTimeFormat(locale, timezone, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    ...(withZone ? { timeZoneName: 'short' as const } : {}),
  }).format(epochMs);
}

/**
 * Format a tick or label time. The zone is always explicit: `UTC` for a calendar day
 * (`kind: "date"`), otherwise the given IANA `timezone`. The machine timezone is never used.
 * Quarter labels ("Q3 2026") are computed from the zoned month; the year uses the locale's
 * digits and the "Q" prefix is deliberately not localised.
 * Throws `DravenVizError` `INVALID_OPTIONS` for an unknown timezone or locale.
 */
export function formatTime(
  epochMs: number,
  kind: TimeKind,
  unit: TimeTickUnit,
  locale: string,
  timezone: string,
): string {
  if (!Number.isFinite(epochMs)) {
    throw new DravenVizError('INVALID_OPTIONS', 'A time format needs a finite epoch value.');
  }
  // Raw offsets ("+05:00") are accepted by some Intl engines but are not IANA names (R15).
  if (/^[+-]\d/.test(timezone)) {
    throw new DravenVizError(
      'INVALID_OPTIONS',
      'The timezone must be an IANA name, not an offset.',
    );
  }
  // Validate the zone name even when a date-only value will format in UTC.
  dateTimeFormat(locale, timezone, {});
  const timeZone = kind === 'date' ? 'UTC' : timezone;
  if (unit === 'quarter') {
    const parts = dateTimeFormat('en-US', timeZone, {
      year: 'numeric',
      month: 'numeric',
    }).formatToParts(epochMs);
    const month = Number(parts.find((p) => p.type === 'month')?.value);
    const year = dateTimeFormat(locale, timeZone, { year: 'numeric' }).format(epochMs);
    return `Q${Math.floor((month - 1) / 3) + 1} ${year}`;
  }
  return dateTimeFormat(locale, timeZone, UNIT_OPTIONS[unit]).format(epochMs);
}
