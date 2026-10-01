/**
 * Value scales: domains, nice ticks and the axis-level number format (design 5.1, 5.2, 8).
 *
 * Nice ticks use Heckbert-style nice numbers: the step is 1, 2, 2.5 or 5 times a power of ten.
 * Every candidate step in a few decades around the range is scored; a candidate with 4-6 ticks
 * always beats one outside that band, then the count closest to the target (5) wins, then the
 * tighter domain, then the larger step. Candidates whose formatted labels are not all distinct
 * are rejected while any distinct candidate exists. Pure arithmetic, no DOM.
 */
import { formatNumber } from '../../core/format/index';
import type { Domain, NumberFormat } from '../../core/index';
import type { TickModel } from './types';

const MANTISSAS = [1, 2, 2.5, 5] as const;
const TARGET = 5;
const EPS = 1e-9;

/** Remove binary floating-point noise (0.30000000000000004 -> 0.3) and negative zero. */
export function clean(x: number): number {
  const v = Number(x.toPrecision(12));
  return v === 0 ? 0 : v;
}

/** Decimal places (0-6) needed to show `v` exactly. */
export function decimalsOf(v: number): number {
  for (let d = 0; d <= 6; d++) {
    if (Math.abs(Number(v.toFixed(d)) - v) <= 1e-9 * Math.max(1, Math.abs(v))) return d;
  }
  return 6;
}

function labelsOf(values: number[], format: NumberFormat | undefined, locale: string): string[] {
  return values.map((v) => formatNumber(v, format, locale));
}

function distinct(labels: string[]): boolean {
  return new Set(labels).size === labels.length;
}

/**
 * Axis-level number format (design 5.1). A format with its own `maximumFractionDigits` is kept.
 * Otherwise the digits are 0 when every tick and all data are integers, else the fewest that show
 * every tick exactly and at least 1 for fractional data, raised until tick labels are distinct
 * (cap 6). Compact style keeps its own default digits and is only raised for distinctness.
 */
export function deriveFormat(
  format: NumberFormat | undefined,
  tickValues: number[],
  dataValues: number[],
  locale: string,
): NumberFormat {
  if (format?.maximumFractionDigits !== undefined) return format;
  const compact = format?.style === 'compact';
  let d = 0;
  for (const t of tickValues) d = Math.max(d, decimalsOf(t));
  if (dataValues.some((v) => !Number.isInteger(v))) d = Math.max(d, 1);
  if (compact) d = Math.max(d, 1);
  const minFd = format?.minimumFractionDigits ?? 0;
  for (;;) {
    const candidate: NumberFormat = { ...format, maximumFractionDigits: Math.max(d, minFd) };
    if (d >= 6 || distinct(labelsOf(tickValues, candidate, locale))) return candidate;
    d++;
  }
}

export interface ValueScale {
  domain: [number, number];
  tickValues: number[];
  format: NumberFormat;
}

export interface ValueScaleInput {
  /** Measured values (or x values) the axis must show. */
  data: number[];
  domain: Domain | undefined;
  defaultPolicy: 'fit' | 'include-zero';
  format: NumberFormat | undefined;
  ticks: { count?: number; values?: number[] } | undefined;
  locale: string;
}

interface Candidate {
  domain: [number, number];
  ticks: number[];
  step: number;
  extension: number;
  missingEnds: number;
}

function stepsFor(range: number): number[] {
  const e0 = Math.floor(Math.log10(range));
  const steps: number[] = [];
  for (let e = e0 - 2; e <= e0 + 1; e++) {
    for (const m of MANTISSAS) steps.push(clean(m * 10 ** e));
  }
  return steps;
}

function candidates(lo: number, hi: number, fixed: boolean): Candidate[] {
  const out: Candidate[] = [];
  for (const step of stepsFor(hi - lo)) {
    if (fixed) {
      const k0 = Math.ceil(lo / step - EPS);
      const k1 = Math.floor(hi / step + EPS);
      const n = k1 - k0 + 1;
      if (n < 2 || n > 12) continue;
      const ticks: number[] = [];
      for (let k = k0; k <= k1; k++) ticks.push(clean(k * step));
      const missingEnds =
        (Math.abs((ticks[0] as number) - lo) > EPS * Math.max(1, Math.abs(lo)) ? 1 : 0) +
        (Math.abs((ticks[n - 1] as number) - hi) > EPS * Math.max(1, Math.abs(hi)) ? 1 : 0);
      out.push({ domain: [lo, hi], ticks, step, extension: 0, missingEnds });
    } else {
      const k0 = Math.floor(lo / step + EPS);
      const k1 = Math.ceil(hi / step - EPS);
      const n = k1 - k0 + 1;
      if (n < 2 || n > 12) continue;
      const ticks: number[] = [];
      for (let k = k0; k <= k1; k++) ticks.push(clean(k * step));
      const dom: [number, number] = [ticks[0] as number, ticks[n - 1] as number];
      out.push({ domain: dom, ticks, step, extension: dom[1] - dom[0], missingEnds: 0 });
    }
  }
  return out;
}

/** Best candidate for [lo, hi]; `want` is an explicit tick count (`ticks.count`) when given. */
function pickNice(
  lo: number,
  hi: number,
  fixed: boolean,
  want: number | undefined,
  data: number[],
  format: NumberFormat | undefined,
  locale: string,
): Candidate {
  const target = want ?? TARGET;
  const all = candidates(lo, hi, fixed);
  const score = (c: Candidate): number[] => {
    const n = c.ticks.length;
    const outside = want === undefined ? (n >= 4 && n <= 6 ? 0 : 1) : n === want ? 0 : 1;
    return [outside, Math.abs(n - target), c.missingEnds, c.extension, -c.step];
  };
  const better = (a: Candidate, b: Candidate): boolean => {
    const sa = score(a);
    const sb = score(b);
    for (let i = 0; i < sa.length; i++) {
      const x = sa[i] as number;
      const y = sb[i] as number;
      if (Math.abs(x - y) > 1e-12) return x < y;
    }
    return false;
  };
  const best = (list: Candidate[]): Candidate | undefined => {
    let b: Candidate | undefined;
    for (const c of list) if (!b || better(c, b)) b = c;
    return b;
  };
  const labelOk = (c: Candidate): boolean =>
    distinct(labelsOf(c.ticks, deriveFormat(format, c.ticks, data, locale), locale));
  const found = best(all.filter(labelOk)) ?? best(all);
  if (found) return found;
  // No nice step fits (an extremely narrow fixed domain): show the two ends.
  return { domain: [lo, hi], ticks: [lo, hi], step: hi - lo, extension: 0, missingEnds: 0 };
}

/** Domain and tick values for a numeric axis (y axes and linear x axes). */
export function buildValueScale(input: ValueScaleInput): ValueScale {
  const { data, domain, ticks: tickSpec, locale } = input;
  const policy = domain?.policy ?? input.defaultPolicy;
  const wantCount = tickSpec?.count;
  let dom: [number, number];
  let tickValues: number[];

  if (policy === 'fixed') {
    const fx = domain as Extract<Domain, { policy: 'fixed' }>;
    dom = [fx.min, fx.max];
    tickValues = tickSpec?.values
      ? [...new Set(tickSpec.values)]
          .filter((v) => v >= fx.min && v <= fx.max)
          .sort((a, b) => a - b)
      : pickNice(fx.min, fx.max, true, wantCount, data, input.format, locale).ticks;
  } else {
    let lo: number;
    let hi: number;
    if (data.length === 0) {
      lo = 0;
      hi = 1;
    } else {
      const dmin = Math.min(...data);
      const dmax = Math.max(...data);
      if (policy === 'include-zero') {
        lo = Math.min(0, dmin);
        hi = Math.max(0, dmax);
        if (lo === hi) hi = 1;
      } else if (dmin === dmax) {
        const pad = Math.max(1, 0.1 * Math.abs(dmin));
        lo = dmin - pad;
        hi = dmax + pad;
      } else {
        lo = dmin;
        hi = dmax;
      }
    }
    if (tickSpec?.values && tickSpec.values.length > 0) {
      tickValues = [...new Set(tickSpec.values)].sort((a, b) => a - b);
      dom = [
        Math.min(clean(lo), tickValues[0] as number),
        Math.max(clean(hi), tickValues[tickValues.length - 1] as number),
      ];
    } else {
      const c = pickNice(lo, hi, false, wantCount, data, input.format, locale);
      dom = c.domain;
      tickValues = c.ticks;
    }
  }
  return {
    domain: dom,
    tickValues,
    format: deriveFormat(input.format, tickValues, data, locale),
  };
}

export function toTicks(values: number[], format: NumberFormat, locale: string): TickModel[] {
  const labels = labelsOf(values, format, locale);
  return values.map((value, i) => ({
    value,
    label: labels[i] as string,
    essential: i === 0 || i === values.length - 1,
  }));
}
