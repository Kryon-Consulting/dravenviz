import { DravenVizError, validateSpec, type VizSpec } from '../core/index';
import { loadFonts } from '../render/fonts/load';
import { finalizeSvg, type SvgExport } from '../render/svg/finalize';
import { normalizeSvg } from '../render/svg/normalize';
import { validateSvg } from '../render/svg/validate';
import { __testHooks } from './lifecycle';
import { mountBatch } from './mount';
import { resolveOptions, type MountOptions, type RenderOptions } from './options';

export type { SvgExport } from '../render/svg/finalize';

export interface ExportOptions extends RenderOptions {
  /** Default `"external"`. */
  fontMode?: 'external' | 'embedded';
  /** External mode: prefix for `@font-face` URLs in the SVG. Default `"fonts/"`; relative or same-origin only. */
  fontHrefPrefix?: string;
}

const DEFAULT_PREFIX = 'fonts/';
let exportSequence = 0;

const invalid = (message: string, path: string): DravenVizError =>
  new DravenVizError('INVALID_OPTIONS', message, { path });

function checkPrefix(prefix: unknown): string {
  if (prefix === undefined) return DEFAULT_PREFIX;
  // eslint-disable-next-line no-control-regex
  if (typeof prefix !== 'string' || /["'\\()<>\s\u0000-\u001f]/.test(prefix)) {
    throw invalid(
      'fontHrefPrefix must be a string without quotes, parentheses, backslashes, spaces or control characters.',
      '/fontHrefPrefix',
    );
  }
  if (prefix.startsWith('//'))
    throw invalid('fontHrefPrefix must not be protocol-relative.', '/fontHrefPrefix');
  if (/^[a-z][a-z0-9+.-]*:/i.test(prefix)) {
    let url: URL | undefined;
    try {
      url = new URL(prefix);
    } catch {
      url = undefined;
    }
    if (
      url === undefined ||
      (url.protocol !== 'http:' && url.protocol !== 'https:') ||
      url.origin !== window.location.origin
    ) {
      throw invalid('fontHrefPrefix must be relative or same-origin http(s).', '/fontHrefPrefix');
    }
  }
  return prefix;
}

function summary(spec: VizSpec): string {
  let missing = 0;
  let partial = 0;
  if (spec.kind === 'cartesian') {
    for (const series of spec.series) {
      for (const point of series.points) {
        if (point.value === null) missing += 1;
        if (point.quality === 'partial') partial += 1;
      }
    }
  }
  const parts: string[] = [];
  if (missing > 0) parts.push(`Missing values: ${missing}.`);
  if (partial > 0) parts.push(`Partial values: ${partial}.`);
  return parts.join(' ');
}

const describe = (spec: VizSpec): string =>
  [spec.description ?? '', summary(spec)].filter((s) => s !== '').join(' ');

/**
 * Mounts the chart offscreen, waits for readiness, then runs normalize, strict validation and
 * finalize on the live SVG (design section 10). Fonts come from the page font registry, never from
 * a second fetch. The temporary host and root are removed in `finally`.
 *
 * Embedding identity: the live export mount uses a reserved internal namespace (`__export-<n>`,
 * which can never match the public namespace pattern, and is unique per call), so exporting a chart
 * that is already mounted on the page, or exporting the same chart twice at once, is never rejected
 * as a duplicate. The exported ids use the caller's `namespace` (default `dv`) and the chart id.
 */
export async function renderToSvgWithAssets(
  spec: unknown,
  options: ExportOptions,
): Promise<SvgExport> {
  const resolved = resolveOptions(options as MountOptions, 1);
  const namespace = resolved.namespaces[0] as string;
  const fontMode = options.fontMode ?? 'external';
  if (fontMode !== 'external' && fontMode !== 'embedded') {
    throw invalid('fontMode must be "external" or "embedded".', '/fontMode');
  }
  const fontHrefPrefix = checkPrefix(options.fontHrefPrefix);
  const validated = validateSpec(
    spec,
    resolved.limits === undefined ? undefined : { limits: resolved.limits },
  );

  const host = document.createElement('div');
  host.setAttribute('aria-hidden', 'true');
  host.setAttribute('data-dv-export-host', '');
  host.style.cssText =
    `position:fixed;left:-100000px;top:0;width:${resolved.width}px;height:${resolved.height}px;` +
    'overflow:hidden;pointer-events:none';
  document.body.appendChild(host);
  const handle = mountBatch(host, [spec], { ...options, staticLabels: true }, [
    `__export-${++exportSequence}`,
  ]);
  try {
    await handle.ready;
    const live = host.querySelector('svg[data-dv-render-id]');
    if (!(live instanceof SVGSVGElement)) {
      throw new DravenVizError('EXPORT_FAILED', 'The mounted chart produced no SVG to export.', {
        chartId: validated.id,
      });
    }
    __testHooks.beforeExport?.(live);
    const fonts = await loadFonts(resolved.fonts, new AbortController().signal);
    try {
      const clone = normalizeSvg(live);
      validateSvg(clone);
      return finalizeSvg(clone, {
        namespace,
        chartId: validated.id,
        title: validated.title,
        desc: describe(validated),
        fonts,
        fontMode,
        fontHrefPrefix,
      });
    } catch (e) {
      if (e instanceof DravenVizError && e.chartId === undefined) {
        throw new DravenVizError(e.code, e.message, {
          chartId: validated.id,
          ...(e.path === undefined ? {} : { path: e.path }),
          ...(e.issues === undefined ? {} : { issues: e.issues }),
        });
      }
      throw e;
    }
  } finally {
    handle.dispose();
    host.remove();
  }
}

/** The standalone SVG string. Defaults: `theme: "print"`, `fontMode: "external"`, `fontHrefPrefix: "fonts/"`. */
export async function renderToSvg(spec: unknown, options: ExportOptions): Promise<string> {
  return (await renderToSvgWithAssets(spec, options)).svg;
}
