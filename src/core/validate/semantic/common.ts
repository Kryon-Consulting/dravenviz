import type { NumberFormat, SpecBase } from '../../spec/index';
import { type IssueSink, ptr } from '../issues';

/** ISO 4217 alphabetic codes (active codes, funds and the special XAU/XXX family). */
const ISO_4217 = new Set(
  (
    'AED AFN ALL AMD ANG AOA ARS AUD AWG AZN BAM BBD BDT BGN BHD BIF BMD BND BOB BOV BRL BSD BTN BWP BYN BZD ' +
    'CAD CDF CHE CHF CHW CLF CLP CNY COP COU CRC CUP CVE CZK DJF DKK DOP DZD EGP ERN ETB EUR FJD FKP GBP GEL ' +
    'GHS GIP GMD GNF GTQ GYD HKD HNL HTG HUF IDR ILS INR IQD IRR ISK JMD JOD JPY KES KGS KHR KMF KPW KRW KWD ' +
    'KYD KZT LAK LBP LKR LRD LSL LYD MAD MDL MGA MKD MMK MNT MOP MRU MUR MVR MWK MXN MXV MYR MZN NAD NGN NIO ' +
    'NOK NPR NZD OMR PAB PEN PGK PHP PKR PLN PYG QAR RON RSD RUB RWF SAR SBD SCR SDG SEK SGD SHP SLE SOS SRD ' +
    'SSP STN SVC SYP SZL THB TJS TMT TND TOP TRY TTD TWD TZS UAH UGX USD USN UYI UYU UZS VED VES VND VUV WST ' +
    'XAF XAG XAU XBA XBB XBC XBD XCD XDR XOF XPD XPF XPT XSU XTS XUA XXX YER ZAR ZMW ZWG'
  ).split(' '),
);

/** Report `duplicate-id` for every id repeated within `items` (path: the repeated id). */
export function checkUniqueIds(
  sink: IssueSink,
  items: readonly { id: string }[] | undefined,
  base: string,
  noun: string,
): void {
  if (!items) return;
  const seen = new Set<string>();
  items.forEach((item, i) => {
    if (seen.has(item.id)) {
      sink.add(
        'duplicate-id',
        base + ptr(i, 'id'),
        `Duplicate ${noun} id '${item.id}'; every ${noun} id must be unique within its list. Rename this one.`,
      );
    }
    seen.add(item.id);
  });
}

/** `unknown-role` when `role` is set but not declared in the spec's `roles`. */
export function checkRole(
  sink: IssueSink,
  spec: SpecBase,
  role: string | undefined,
  path: string,
): void {
  if (role === undefined) return;
  if (!spec.roles || !Object.prototype.hasOwnProperty.call(spec.roles, role)) {
    sink.add(
      'unknown-role',
      path,
      `Role '${role}' is not defined. Add it under 'roles' or use a defined role.`,
    );
  }
}

/** Cross-field rules of a NumberFormat: currency-required, invalid-currency, invalid-format. */
export function checkFormat(sink: IssueSink, fmt: NumberFormat | undefined, base: string): void {
  if (!fmt) return;
  if (fmt.style === 'currency' && fmt.currency === undefined) {
    sink.add(
      'currency-required',
      base + ptr('currency'),
      "Add 'currency' (an ISO 4217 code such as USD) because style is 'currency'.",
    );
  }
  if (fmt.currency !== undefined && !ISO_4217.has(fmt.currency)) {
    sink.add(
      'invalid-currency',
      base + ptr('currency'),
      'Use a valid ISO 4217 currency code such as USD, EUR or GBP.',
    );
  }
  if (
    fmt.minimumFractionDigits !== undefined &&
    fmt.maximumFractionDigits !== undefined &&
    fmt.minimumFractionDigits > fmt.maximumFractionDigits
  ) {
    sink.add(
      'invalid-format',
      base + ptr('maximumFractionDigits'),
      'maximumFractionDigits must be greater than or equal to minimumFractionDigits.',
    );
  }
}
