import { createElement } from 'react';
import { flushSync } from 'react-dom';
import { createRoot, type Root } from 'react-dom/client';
import { DravenVizError } from '../core/index';
import type { Theme } from '../core/index';
import { ChartView } from '../render/ChartView';
import { RenderGuard } from '../render/RenderGuard';
import type { LaidOutChart, TextMeasurer } from '../render/layout/types';

/**
 * Live React roots, for the browser tests (`harness.counts()`): after any batch finishes,
 * fails or is disposed this must be back to the roots that are meant to stay.
 */
const liveRoots = new Set<Root>();

export function liveRootCount(): number {
  return liveRoots.size;
}

/**
 * Test-only seam. It is exported from this module for the harness and is NOT re-exported from
 * `src/print/index.ts`, so no public entry can reach it. `failRender` makes the render step of
 * the named chart throw, to exercise batch cleanup on a render failure. `beforeExport` lets a
 * test add markup to the live SVG that the exporter then has to handle.
 */
export const __testHooks: {
  failRender: Set<string>;
  /** Runs on the live SVG after readiness and before export normalizes it (tests inject markup here). */
  beforeExport: ((svg: SVGSVGElement) => void) | undefined;
} = {
  failRender: new Set<string>(),
  beforeExport: undefined,
};

export interface MountedChart {
  chartId: string;
  namespace: string;
  /** The `.dravenviz-root` element appended to the target. */
  element: HTMLElement;
  root: Root;
  renderId: number;
  laid: LaidOutChart;
}

export interface RenderInput {
  target: Element;
  laid: LaidOutChart;
  theme: Theme;
  namespace: string;
  renderId: number;
  fontFamily: string;
  measure: TextMeasurer;
}

/**
 * Creates the `.dravenviz-root`, renders the chart into it and commits synchronously. A failure
 * leaves nothing behind. Throws `RENDER_FAILED`, which wraps any exception (design section 9,
 * step 4).
 */
export function renderChart(input: RenderInput): MountedChart {
  const { target, laid, namespace, renderId } = input;
  const chartId = laid.model.chartId;
  const doc = target.ownerDocument;
  const element = doc.createElement('div');
  element.className = 'dravenviz-root';
  element.style.opacity = '1';
  element.setAttribute('data-dravenviz-ns', namespace);
  element.setAttribute('data-dravenviz-chart', chartId);
  target.appendChild(element);
  // The identifier prefix namespaces every id React and Recharts generate for this chart.
  const root = createRoot(element, { identifierPrefix: `${namespace}-${chartId}-` });
  liveRoots.add(root);
  const mounted: MountedChart = { chartId, namespace, element, root, renderId, laid };
  let caught: unknown;
  try {
    if (__testHooks.failRender.has(chartId)) throw new Error('forced render failure');
    flushSync(() => {
      root.render(
        createElement(
          RenderGuard,
          {
            onError: (e) => {
              caught ??= e;
            },
          },
          createElement(ChartView, {
            laid,
            renderId,
            namespace,
            fontFamily: input.fontFamily,
            theme: input.theme,
            measure: input.measure,
          }),
        ),
      );
    });
  } catch (e) {
    caught ??= e;
  }
  if (caught !== undefined) {
    disposeChart(mounted);
    if (caught instanceof DravenVizError) throw caught;
    throw new DravenVizError('RENDER_FAILED', 'The chart could not be rendered.', {
      chartId,
      cause: caught,
    });
  }
  return mounted;
}

/** Unmounts and removes one chart. Idempotent. */
export function disposeChart(mounted: MountedChart): void {
  if (liveRoots.delete(mounted.root)) {
    try {
      mounted.root.unmount();
    } catch {
      // The root is being discarded; there is nothing useful to do with an unmount error.
    }
  }
  mounted.element.remove();
}

/** Everything one `mountCharts` call created. `disposeAll` is the only cleanup path. */
export class Batch {
  readonly charts: MountedChart[] = [];
  private closed = false;

  get isClosed(): boolean {
    return this.closed;
  }

  add(chart: MountedChart): void {
    if (this.closed) {
      disposeChart(chart);
      throw new DravenVizError('DISPOSED', 'The chart batch was disposed.');
    }
    this.charts.push(chart);
  }

  /** Disposes every mount. A closed batch refuses later `add` calls (DISPOSED). */
  disposeAll(): void {
    this.closed = true;
    for (const chart of this.charts.splice(0)) disposeChart(chart);
  }
}
