import {
  DravenVizError,
  resolveTheme,
  type Limits,
  type Theme,
  type ThemeName,
  type ThemeOverrides,
} from '../core/index';
import { assertLocaleAndTimezone } from '../core/format/index';
import { defaultFontAssets } from '../render/fonts/load';
import type { FontAsset } from '../render/fonts/registry';

export type { FontAsset };

/** Options shared by every print API (design section 9). */
export interface RenderOptions {
  /** Positive logical units (print and export). */
  width: number;
  height: number;
  /** Default `"print"` for print APIs. */
  theme?: ThemeName | Theme;
  themeOverrides?: ThemeOverrides;
  /** `^[a-z][a-z0-9-]{0,31}$`, default `"dv"`. */
  namespace?: string;
  /** Default `"en-US"`. */
  locale?: string;
  /** IANA name, default `"UTC"`. */
  timezone?: string;
  /** Relative or same-origin http(s); resolves `fonts/`. */
  assetBaseUrl?: string;
  /** Replaces the default font set entirely. */
  fonts?: FontAsset[];
  /** Default 178 for the print theme. */
  printWidthMm?: number;
  /** Default 10000. */
  timeoutMs?: number;
  limits?: Partial<Limits>;
}

export interface MountOptions extends RenderOptions {
  /** Default true. */
  staticLabels?: boolean;
  /** Per-spec embedding namespaces, same length as `specs`; default: every chart uses `namespace`. */
  namespaces?: string[];
  /**
   * `"fixed"` (default): the chart is `width` x `height` CSS pixels. `"width"`: it scales to its
   * container's width with the aspect ratio kept. Needs `dravenviz.css`; layout is unchanged.
   */
  fit?: 'fixed' | 'width';
}

export const DEFAULT_TIMEOUT_MS = 10_000;
export const DEFAULT_NAMESPACE = 'dv';
const NAMESPACE = /^[a-z][a-z0-9-]{0,31}$/;

export interface ResolvedOptions {
  width: number;
  height: number;
  theme: Theme;
  namespaces: string[];
  locale: string;
  timezone: string;
  fonts: FontAsset[];
  printWidthMm: number | undefined;
  timeoutMs: number;
  limits: Partial<Limits> | undefined;
  staticLabels: boolean;
  fit: 'fixed' | 'width';
}

const invalid = (message: string, path?: string): DravenVizError =>
  new DravenVizError('INVALID_OPTIONS', message, path === undefined ? {} : { path });

const positive = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0;

/**
 * Validates options before anything touches the DOM and resolves defaults. Every failure is
 * `INVALID_OPTIONS`. `count` is the number of specs, for the `namespaces` length check.
 */
export function resolveOptions(options: MountOptions, count: number): ResolvedOptions {
  if (options === null || typeof options !== 'object') {
    throw invalid('Options must be an object.');
  }
  if (!positive(options.width) || !positive(options.height)) {
    throw invalid('width and height must be positive finite numbers.', '/width');
  }
  const namespace = options.namespace ?? DEFAULT_NAMESPACE;
  if (typeof namespace !== 'string' || !NAMESPACE.test(namespace)) {
    throw invalid('namespace must match ^[a-z][a-z0-9-]{0,31}$.', '/namespace');
  }
  let namespaces = Array.from({ length: count }, () => namespace);
  if (options.namespaces !== undefined) {
    if (!Array.isArray(options.namespaces) || options.namespaces.length !== count) {
      throw invalid('namespaces must have the same length as specs.', '/namespaces');
    }
    options.namespaces.forEach((ns, i) => {
      if (typeof ns !== 'string' || !NAMESPACE.test(ns)) {
        throw invalid('Each namespace must match ^[a-z][a-z0-9-]{0,31}$.', `/namespaces/${i}`);
      }
    });
    namespaces = [...options.namespaces];
  }
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  if (!positive(timeoutMs)) throw invalid('timeoutMs must be a positive number.', '/timeoutMs');
  const theme = resolveTheme(options.theme ?? 'print', options.themeOverrides);
  const printWidthMm = options.printWidthMm ?? (theme.name === 'print' ? 178 : undefined);
  if (printWidthMm !== undefined && !positive(printWidthMm)) {
    throw invalid('printWidthMm must be a positive number.', '/printWidthMm');
  }
  const locale = options.locale ?? 'en-US';
  const timezone = options.timezone ?? 'UTC';
  assertLocaleAndTimezone(locale, timezone);
  const fit = options.fit ?? 'fixed';
  if (fit !== 'fixed' && fit !== 'width') {
    throw invalid('fit must be "fixed" or "width".', '/fit');
  }
  // Same-origin and relative-URL checks happen here, before any request (design section 12).
  const fonts = options.fonts ?? defaultFontAssets(options.assetBaseUrl);
  return {
    width: options.width,
    height: options.height,
    theme,
    namespaces,
    locale,
    timezone,
    fonts,
    printWidthMm,
    timeoutMs,
    limits: options.limits,
    staticLabels: options.staticLabels ?? true,
    fit,
  };
}
