import { DravenVizError } from '../../core/index';

/** A font file to load (design section 9). Task 12 re-exports this from the print entry. */
export interface FontAsset {
  /** CSS family name used in SVG `font-family`. */
  family: string;
  /** Both weights are required. */
  weight: 400 | 600;
  /** Relative (to the document) or same-origin http(s). */
  url: string;
  /** Default: inferred from the file extension. */
  format?: 'woff2' | 'woff' | 'truetype';
}

export type FontFormat = NonNullable<FontAsset['format']>;

export interface ResolvedFace {
  weight: 400 | 600;
  /** Absolute resolved URL (the registry key). */
  url: string;
  fileName: string;
  format: FontFormat;
  /** Lower-case hex SHA-256 of `buffer`. Recorded, not verified against an expectation. */
  sha256: string;
  bytes: number;
  /** The exact bytes registered with `FontFace`; export embeds these. */
  buffer: ArrayBuffer;
}

export interface ResolvedFontSet {
  /** Family name used in SVG `font-family`. */
  family: string;
  faces: ResolvedFace[];
}

/** Internal registry entry. `waiters` counts callers still interested in the load. */
export interface RegistryEntry {
  url: string;
  family: string;
  weight: 400 | 600;
  /** The `FontFace` added to `document.fonts`, set once created. */
  face?: FontFace;
  /** True once the load resolved; a settled entry is never cancelled or evicted by an abort. */
  settled?: boolean;
  promise: Promise<ResolvedFace>;
  controller: AbortController;
  waiters: number;
}

/**
 * Per-page font registry, keyed by absolute resolved URL. It lives for the lifetime of the
 * page: `document.fonts` cannot be reliably unloaded and export must embed the same bytes that
 * were used for measurement. A failed or aborted load is removed so it can be retried.
 */
export const entries = new Map<string, RegistryEntry>();
const resolved = new Map<string, ResolvedFace>();

export const fontRegistry = {
  /** The resolved face for a URL (relative URLs resolve against `document.baseURI`). */
  get(url: string): ResolvedFace | undefined {
    try {
      return resolved.get(new URL(url, document.baseURI).href);
    } catch {
      return undefined;
    }
  },
};

export function recordResolved(face: ResolvedFace): void {
  resolved.set(face.url, face);
}

export function forgetFont(url: string): void {
  entries.delete(url);
  resolved.delete(url);
}

/** Test-only: forget every font. Not exported from any public entry. */
export function __resetFontRegistry(): void {
  entries.clear();
  resolved.clear();
}

/**
 * Only relative or same-origin http(s) URLs are allowed (design section 12). Resolved against
 * `document.baseURI`. Throws `INVALID_OPTIONS` before any network request. Returns the absolute URL.
 */
export function assertSameOriginOrRelative(url: string): string {
  if (typeof url !== 'string' || url.trim() === '') {
    throw new DravenVizError('INVALID_OPTIONS', 'A font or asset URL must be a non-empty string.');
  }
  let parsed: URL;
  try {
    parsed = new URL(url, document.baseURI);
  } catch {
    throw new DravenVizError('INVALID_OPTIONS', 'A font or asset URL could not be parsed.');
  }
  if (parsed.username !== '' || parsed.password !== '') {
    throw new DravenVizError('INVALID_OPTIONS', 'Font or asset URLs must not contain credentials.');
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new DravenVizError(
      'INVALID_OPTIONS',
      `Font or asset URL scheme "${parsed.protocol}" is not allowed; use a relative or same-origin http(s) URL.`,
    );
  }
  if (parsed.origin !== window.location.origin) {
    throw new DravenVizError(
      'INVALID_OPTIONS',
      `Font or asset URL origin "${parsed.origin}" is not the page origin; cross-origin URLs are not allowed.`,
    );
  }
  return parsed.href;
}
