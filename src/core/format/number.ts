import { DravenVizError } from '../errors';
import type { NumberFormat } from '../spec/types.gen';

const cache = new Map<string, Intl.NumberFormat>();

function fail(message: string, cause?: unknown): never {
  throw new DravenVizError('INVALID_OPTIONS', message, cause === undefined ? {} : { cause });
}

/**
 * Format one number with `Intl.NumberFormat` and an explicit locale. No locale data is bundled.
 *
 * - `percent` treats the value as percentage points (45.2 is "45.2%"; D16), unscaled.
 * - `maximumFractionDigits` defaults to 0 for an integer value and 1 otherwise (design 5.1).
 *   This function sees a single value. Deciding "integers-only data" for a whole axis belongs to
 *   the model, which passes an explicit `maximumFractionDigits` so every tick shares one format.
 * - A value that would display as zero never carries a minus sign.
 *
 * Throws `DravenVizError` `INVALID_OPTIONS` for a missing currency code or options Intl rejects.
 */
export function formatNumber(
  value: number,
  format: NumberFormat | undefined,
  locale: string,
): string {
  if (!Number.isFinite(value)) fail('A number format needs a finite value.');
  const style = format?.style ?? 'decimal';
  if (style === 'currency' && !format?.currency) {
    fail('A currency number format needs an ISO 4217 currency code.');
  }
  const minFd = format?.minimumFractionDigits;
  let maxFd = format?.maximumFractionDigits;
  if (maxFd === undefined) {
    // Compact notation would lose information at 0 digits (1500 -> "2K"), so it defaults to 1.
    maxFd = style !== 'compact' && Number.isInteger(value) ? 0 : 1;
    if (minFd !== undefined && minFd > maxFd) maxFd = minFd;
  }

  // Percent is Intl's `unit: percent`, which prints the value as given (percentage points, D16)
  // with no divide-by-100 / multiply-by-100 round trip that would change rounding.
  const options: Intl.NumberFormatOptions = {
    style: style === 'compact' ? 'decimal' : style === 'percent' ? 'unit' : style,
    maximumFractionDigits: maxFd,
  };
  if (style === 'percent') options.unit = 'percent';
  if (style === 'compact') options.notation = 'compact';
  if (style === 'currency') options.currency = format?.currency as string;
  if (minFd !== undefined) options.minimumFractionDigits = minFd;
  if (format?.signDisplay !== undefined) options.signDisplay = format.signDisplay;

  const key = `${locale}|${JSON.stringify(options)}`;
  let nf = cache.get(key);
  if (!nf) {
    try {
      nf = new Intl.NumberFormat(locale, options);
    } catch (e) {
      return fail('The number format or locale is not supported.', e);
    }
    cache.set(key, nf);
  }

  // Normalise -0 and tiny negatives that round to zero at the display precision.
  let shown = value;
  if (shown === 0 || (shown < 0 && Number(shown.toFixed(Math.min(maxFd, 100))) === 0)) shown = 0;
  return nf.format(shown);
}
