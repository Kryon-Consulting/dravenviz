/// <reference types="vite/client" />
import { liveObserverCount, liveResizeObserverCount } from './observers';
import { defaultFontAssets, loadFonts } from '../../src/render/fonts/load';
import {
  __resetFontRegistry,
  assertSameOriginOrRelative,
  fontRegistry,
  fontStack,
} from '../../src/render/fonts/registry';
import { __testHooks, liveRootCount } from '../../src/print/lifecycle';
import { renderToSvgWithAssets, type ExportOptions } from '../../src/print/export';
import { mountCharts, type MountHandle, type ReadyInfo } from '../../src/print/mount';
import type { MountOptions } from '../../src/print/options';
import { renderDataTable } from '../../src/print/table-dom';
import { resolveTheme, validateSpec } from '../../src/core/index';
import { createCanvasMeasurer } from '../../src/render/layout/canvas-measure';
import { layoutChart } from '../../src/render/layout/index';
import { buildModel } from '../../src/render/model/index';
import { verifyCommitted } from '../../src/render/verify';

const valid = import.meta.glob('../../fixtures/valid/*.json', {
  eager: true,
  import: 'default',
}) as Record<string, unknown>;
const invalid = import.meta.glob('../../fixtures/invalid/*.json', {
  eager: true,
  import: 'default',
}) as Record<string, unknown>;

const byName = (all: Record<string, unknown>, id: string): unknown => {
  const hit = Object.entries(all).find(([path]) => path.endsWith(`/${id}.json`));
  return hit?.[1];
};

/** A fixture by catalog id (valid or invalid). Returns a copy, so a test may edit it. */
function fixture(id: string): unknown {
  const found = byName(valid, id) ?? byName(invalid, id);
  if (found === undefined) throw new Error(`unknown fixture ${id}`);
  return structuredClone(found);
}

type Item = string | object;
interface HarnessOptions extends Omit<MountOptions, 'width' | 'height'> {
  width?: number;
  height?: number;
  /** `hidden` mounts into a `display: none` host. */
  host?: 'visible' | 'hidden';
}

interface SerializedError {
  code: string | undefined;
  message: string;
  chartId?: string | undefined;
  path?: string | undefined;
  rule?: string | undefined;
}
type Outcome = { ok: true; info: ReadyInfo[] } | { ok: false; error: SerializedError };

const serialize = (e: unknown): SerializedError => {
  const err = e as {
    code?: string;
    message?: string;
    chartId?: string;
    path?: string;
    rule?: string;
    issues?: { rule: string }[];
  };
  return {
    code: err.code,
    message: String(err.message ?? e),
    chartId: err.chartId,
    path: err.path,
    rule: err.rule ?? err.issues?.[0]?.rule,
  };
};

const handles = new Map<number, { handle: MountHandle; host: HTMLElement }>();
let sequence = 0;

function newHost(kind: HarnessOptions['host']): HTMLElement {
  const host = document.createElement('div');
  host.setAttribute('data-test-host', String(++sequence));
  host.style.width = '720px';
  if (kind === 'hidden') host.style.display = 'none';
  document.body.appendChild(host);
  return host;
}

/** Starts a batch and returns a handle id; `outcome(id)` resolves with its result. */
function start(items: Item[], opts: HarnessOptions = {}): number {
  const { host: hostKind, ...rest } = opts;
  const specs = items.map((i) => (typeof i === 'string' ? fixture(i) : i));
  const host = newHost(hostKind);
  const handle = mountCharts(host, specs, { width: 680, height: 320, ...rest });
  const id = ++sequence;
  handles.set(id, { handle, host });
  return id;
}

async function outcome(id: number): Promise<Outcome> {
  const entry = handles.get(id);
  if (entry === undefined) throw new Error('unknown handle');
  try {
    return { ok: true, info: await entry.handle.ready };
  } catch (e) {
    return { ok: false, error: serialize(e) };
  }
}

export const harness = {
  loadFonts,
  defaultFontAssets,
  assertSameOriginOrRelative,
  fontRegistry,
  __resetFontRegistry,
  fixture,
  start,
  outcome,
  dispose(id: number): void {
    handles.get(id)?.handle.dispose();
  },
  async mount(items: Item[], opts: HarnessOptions = {}): Promise<Outcome> {
    return outcome(start(items, opts));
  },
  /** Make the render step of this chart throw (test-only seam in `src/print/lifecycle.ts`). */
  forceRenderError(chartId: string): void {
    __testHooks.failRender.add(chartId);
  },
  renderTable(spec: unknown, visuallyHidden = false): { dispose: number } {
    const host = newHost('visible');
    const remove = renderDataTable(host, validateSpec(spec), { visuallyHidden });
    const id = ++sequence;
    handles.set(id, { handle: { ready: Promise.resolve([]), dispose: remove }, host });
    return { dispose: id };
  },
  /**
   * The layout the print mount computes for a chart (print theme, 178 mm, static labels), for the
   * geometry oracle. Loads the default fonts first, like a mount does.
   */
  async layoutOf(item: Item, width = 680, height = 320): Promise<unknown> {
    const fonts = await loadFonts(defaultFontAssets(), new AbortController().signal);
    const theme = resolveTheme('print');
    const spec = validateSpec(typeof item === 'string' ? fixture(item) : item);
    const model = buildModel(spec, { theme, locale: 'en-US', timezone: 'UTC' });
    if (model.kind !== 'cartesian') throw new Error('not a cartesian model');
    return layoutChart(
      model,
      { width, height, theme, mode: 'static', printWidthMm: 178 },
      createCanvasMeasurer(fontStack(fonts)),
    );
  },
  verifyCommitted,
  /**
   * Exports a fixture (or spec) through the real `renderToSvgWithAssets`. `inject` is SVG markup
   * appended to the live chart just before export, to exercise the normalizer on markup the chart
   * itself never draws.
   */
  async exportSvg(
    item: Item,
    opts: Partial<ExportOptions> = {},
    inject?: string,
  ): Promise<{ ok: true; svg: string; fonts: unknown[] } | { ok: false; error: SerializedError }> {
    const spec = typeof item === 'string' ? fixture(item) : item;
    if (inject !== undefined) {
      __testHooks.beforeExport = (svg) => {
        const doc = new DOMParser().parseFromString(
          `<svg xmlns="http://www.w3.org/2000/svg">${inject}</svg>`,
          'image/svg+xml',
        );
        for (const child of Array.from(doc.documentElement.children)) {
          svg.appendChild(document.importNode(child, true));
        }
      };
    }
    try {
      const out = await renderToSvgWithAssets(spec, { width: 680, height: 320, ...opts });
      return { ok: true, svg: out.svg, fonts: out.fonts };
    } catch (e) {
      return { ok: false, error: serialize(e) };
    } finally {
      __testHooks.beforeExport = undefined;
    }
  },
  /** Live ResizeObservers only (`counts().observers` also counts MutationObservers). */
  resizeObservers: liveResizeObserverCount,
  counts(): { roots: number; observers: number; svgs: number } {
    return {
      roots: liveRootCount(),
      observers: liveObserverCount(),
      svgs: document.querySelectorAll('svg[data-dravenviz-chart]').length,
    };
  },
};

declare global {
  interface Window {
    __h: typeof harness;
  }
}

window.__h = harness;
