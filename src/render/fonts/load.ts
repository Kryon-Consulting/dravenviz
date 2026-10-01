import { DravenVizError } from '../../core/index';
import {
  assertSameOriginOrRelative,
  entries,
  forgetFont,
  recordResolved,
  type FontAsset,
  type FontFormat,
  type RegistryEntry,
  type ResolvedFace,
  type ResolvedFontSet,
} from './registry';

export const DEFAULT_FONT_FAMILY = 'Noto Sans';
const CHECK_SIZE_PX = 13;

/** The bundled Noto Sans 400/600 files, resolved against `assetBaseUrl` (relative or same-origin). */
export function defaultFontAssets(assetBaseUrl?: string): FontAsset[] {
  let base = '';
  if (assetBaseUrl !== undefined) {
    assertSameOriginOrRelative(assetBaseUrl);
    base = assetBaseUrl.endsWith('/') ? assetBaseUrl : `${assetBaseUrl}/`;
  }
  return [
    { family: DEFAULT_FONT_FAMILY, weight: 400, url: `${base}fonts/NotoSans-Regular.woff2` },
    { family: DEFAULT_FONT_FAMILY, weight: 600, url: `${base}fonts/NotoSans-SemiBold.woff2` },
  ];
}

function fileNameOf(absolute: string): string {
  const path = new URL(absolute).pathname;
  const name = path.slice(path.lastIndexOf('/') + 1);
  try {
    return decodeURIComponent(name);
  } catch {
    return name;
  }
}

function inferFormat(absolute: string): FontFormat {
  const ext = /\.([a-z0-9]+)$/i.exec(fileNameOf(absolute))?.[1]?.toLowerCase();
  if (ext === 'woff2') return 'woff2';
  if (ext === 'woff') return 'woff';
  if (ext === 'ttf' || ext === 'otf') return 'truetype';
  throw new DravenVizError(
    'INVALID_OPTIONS',
    `Cannot infer the font format from "${fileNameOf(absolute)}"; set "format".`,
  );
}

interface Validated {
  family: string;
  items: { asset: FontAsset; url: string; format: FontFormat }[];
}

function validate(assets: FontAsset[]): Validated {
  if (!Array.isArray(assets) || assets.length === 0) {
    throw new DravenVizError('INVALID_OPTIONS', 'fonts must be a non-empty array of font assets.');
  }
  const items: Validated['items'] = [];
  const seen = new Set<number>();
  let family: string | undefined;
  for (const asset of assets) {
    if (typeof asset !== 'object' || asset === null) {
      throw new DravenVizError('INVALID_OPTIONS', 'Each font asset must be an object.');
    }
    if (
      typeof asset.family !== 'string' ||
      asset.family.trim() === '' ||
      // eslint-disable-next-line no-control-regex
      /["'\\\u0000-\u001f]/.test(asset.family)
    ) {
      throw new DravenVizError(
        'INVALID_OPTIONS',
        'A font family must be a plain non-empty name without quotes, backslashes or control characters.',
      );
    }
    if (asset.weight !== 400 && asset.weight !== 600) {
      throw new DravenVizError('INVALID_OPTIONS', 'A font weight must be 400 or 600.');
    }
    if (family !== undefined && family !== asset.family) {
      throw new DravenVizError(
        'INVALID_OPTIONS',
        'All font assets must share one family name; the exported SVG uses a single font-family.',
      );
    }
    family = asset.family;
    if (seen.has(asset.weight)) {
      throw new DravenVizError('INVALID_OPTIONS', `Font weight ${asset.weight} is listed twice.`);
    }
    seen.add(asset.weight);
    const url = assertSameOriginOrRelative(asset.url);
    if (items.some((x) => x.url === url)) {
      throw new DravenVizError(
        'INVALID_OPTIONS',
        `Font URL ${url} is used for more than one weight; each weight needs its own file.`,
      );
    }
    if (
      asset.format !== undefined &&
      asset.format !== 'woff2' &&
      asset.format !== 'woff' &&
      asset.format !== 'truetype'
    ) {
      throw new DravenVizError('INVALID_OPTIONS', 'A font format must be woff2, woff or truetype.');
    }
    items.push({ asset, url, format: asset.format ?? inferFormat(url) });
  }
  if (!seen.has(400) || !seen.has(600)) {
    throw new DravenVizError('INVALID_OPTIONS', 'Both font weights, 400 and 600, are required.');
  }
  return { family: family as string, items };
}

const disposed = (): DravenVizError =>
  new DravenVizError('DISPOSED', 'Font loading was aborted before it finished.');

function hex(buf: ArrayBuffer): string {
  let out = '';
  for (const b of new Uint8Array(buf)) out += b.toString(16).padStart(2, '0');
  return out;
}

async function loadOne(
  family: string,
  weight: 400 | 600,
  url: string,
  format: FontFormat,
  signal: AbortSignal,
  onFace: (face: FontFace) => void,
): Promise<ResolvedFace> {
  const fileName = fileNameOf(url);
  const fail = (reason: string, cause?: unknown): DravenVizError =>
    new DravenVizError('FONT_LOAD_FAILED', `Could not load font ${url}: ${reason}.`, {
      path: url,
      ...(cause === undefined ? {} : { cause }),
    });
  let face: FontFace | undefined;
  try {
    let response: Response;
    try {
      // Redirects are refused: a same-origin URL must not bounce to another origin (design section 12).
      response = await fetch(url, { signal, redirect: 'error' });
    } catch (e) {
      if (signal.aborted) throw disposed();
      throw fail('network error or redirect', e);
    }
    if (!response.ok) throw fail(`HTTP ${response.status}`);
    let buffer: ArrayBuffer;
    try {
      buffer = await response.arrayBuffer();
    } catch (e) {
      if (signal.aborted) throw disposed();
      throw fail('the response body could not be read', e);
    }
    if (signal.aborted) throw disposed();
    const sha256 = hex(await crypto.subtle.digest('SHA-256', buffer));
    if (signal.aborted) throw disposed();
    try {
      face = new FontFace(family, buffer, { weight: String(weight) });
      document.fonts.add(face);
      onFace(face);
      await face.load();
    } catch (e) {
      throw fail('the font data could not be decoded', e);
    }
    if (signal.aborted) throw disposed();
    return { weight, url, fileName, format, sha256, bytes: buffer.byteLength, buffer };
  } catch (e) {
    if (face !== undefined) document.fonts.delete(face);
    throw e;
  }
}

function acquire(
  family: string,
  weight: 400 | 600,
  url: string,
  format: FontFormat,
): RegistryEntry {
  const existing = entries.get(url);
  if (existing !== undefined && !existing.controller.signal.aborted) {
    if (existing.family !== family || existing.weight !== weight) {
      throw new DravenVizError(
        'INVALID_OPTIONS',
        `Font ${url} is already registered under a different family or weight.`,
      );
    }
    return existing;
  }
  const controller = new AbortController();
  const entry: RegistryEntry = {
    url,
    family,
    weight,
    controller,
    waiters: 0,
    promise: loadOne(family, weight, url, format, controller.signal, (f) => {
      entry.face = f;
    }).then(
      (face) => {
        entry.settled = true;
        recordResolved(face);
        return face;
      },
      (e: unknown) => {
        if (entries.get(url) === entry) forgetFont(url);
        throw e;
      },
    ),
  };
  entry.promise.catch(() => undefined);
  entries.set(url, entry);
  return entry;
}

function wait(entry: RegistryEntry, signal: AbortSignal): Promise<ResolvedFace> {
  entry.waiters += 1;
  return new Promise<ResolvedFace>((resolve, reject) => {
    const onAbort = (): void => {
      // A settled entry is cached for everyone; an abort only rejects this caller.
      if (entry.settled) {
        signal.removeEventListener('abort', onAbort);
        reject(disposed());
        return;
      }
      entry.waiters -= 1;
      // Only cancel the shared network load when nobody else is waiting for it. The entry is
      // dropped first (synchronously) so a caller that never aborted can start a fresh load
      // instead of inheriting this aborted one (React StrictMode mount, dispose, mount).
      if (entry.waiters <= 0) {
        if (entries.get(entry.url) === entry) forgetFont(entry.url);
        entry.controller.abort();
      }
      reject(disposed());
    };
    signal.addEventListener('abort', onAbort, { once: true });
    entry.promise.then(
      (face) => {
        entry.waiters -= 1;
        signal.removeEventListener('abort', onAbort);
        resolve(face);
      },
      (e: unknown) => {
        entry.waiters -= 1;
        signal.removeEventListener('abort', onAbort);
        reject(e instanceof Error ? e : new Error(String(e)));
      },
    );
  });
}

/**
 * `document.fonts.check()` passes vacuously in Chromium when no matching face exists, so the
 * face itself is verified: it must be loaded and present in `document.fonts` under the expected
 * family and weight. `check()` stays as an extra guard.
 */
function isRegistered(entry: RegistryEntry, family: string, weight: 400 | 600): boolean {
  const face = entry.face;
  if (face === undefined || face.status !== 'loaded') return false;
  let present = false;
  document.fonts.forEach((f) => {
    if (f === face) present = true;
  });
  if (
    !present ||
    face.family.replace(/^["']|["']$/g, '') !== family ||
    face.weight !== String(weight)
  ) {
    return false;
  }
  return document.fonts.check(`${weight} ${CHECK_SIZE_PX}px "${family}"`);
}

/**
 * Loads, hashes and registers the fonts (design section 9, step 2). Rejects with
 * `INVALID_OPTIONS` before any fetch, `FONT_LOAD_FAILED` for network, status, decode or
 * font-registration verification failures, and `DISPOSED` when `signal` aborts. A URL already loaded
 * is served from the page registry with no second request.
 */
export async function loadFonts(
  assets: FontAsset[],
  signal: AbortSignal,
): Promise<ResolvedFontSet> {
  const { family, items } = validate(assets);
  if (signal.aborted) throw disposed();
  const acquired = items.map((i) => ({
    i,
    entry: acquire(family, i.asset.weight, i.url, i.format),
  }));
  // If one weight fails, the sibling weights that did load stay registered: they are valid,
  // cached by URL and reused by the retry, so there is nothing to clean up for them.
  const faces = await Promise.all(acquired.map(({ entry }) => wait(entry, signal)));
  // Evict every unverified face (not just the first) so a retry starts clean.
  let failed: string | undefined;
  let failedUrl: string | undefined;
  for (const { i, entry } of acquired) {
    if (isRegistered(entry, family, i.asset.weight)) continue;
    if (entry.face !== undefined) document.fonts.delete(entry.face);
    if (entries.get(i.url) === entry) forgetFont(i.url);
    failed ??= `Font ${i.url} loaded but "${family}" ${i.asset.weight} is not registered with the page.`;
    failedUrl ??= i.url;
  }
  if (failed !== undefined) {
    throw new DravenVizError('FONT_LOAD_FAILED', failed, { path: failedUrl as string });
  }
  return { family, faces: faces.sort((a, b) => a.weight - b.weight) };
}
