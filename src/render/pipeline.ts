import { DravenVizError, type Theme, type VizSpec } from '../core/index';
import type { LaidOutChart, TextMeasurer } from './layout/types';
import { layoutChart } from './layout/index';
import { buildModel } from './model/index';
import { expectationsOf, verifyCommitted } from './verify';

/** What a chart reports when its committed SVG has been verified (design section 9). */
export interface ReadyInfo {
  chartId: string;
  renderId: number;
  width: number;
  height: number;
  effectivePt?: { title: number; label: number; caption: number };
}

/**
 * The pieces of the readiness sequence that `mountCharts` (print) and `<Chart>` (React) share, so
 * the two adapters cannot drift: model and layout (step 4) and verification of the committed SVG
 * (step 5). Font loading, the host checks and the commit itself stay with each adapter.
 */

export function notImplemented(spec: VizSpec, reason: string): DravenVizError {
  const message = `Cannot draw "${spec.id}" yet: ${reason}. Slice 1 draws Cartesian line charts only.`;
  return new DravenVizError('RENDER_FAILED', message, {
    chartId: spec.id,
    issues: [{ rule: 'not-implemented-in-slice', path: '', message }],
  });
}

export interface LayoutInput {
  theme: Theme;
  locale: string;
  timezone: string;
  width: number;
  height: number;
  staticLabels: boolean;
  printWidthMm: number | undefined;
  measure: TextMeasurer;
}

/** Model then layout of one validated spec. Throws `RENDER_FAILED` for a model slice 1 cannot draw. */
export function buildLaid(spec: VizSpec, input: LayoutInput): LaidOutChart {
  const model = buildModel(spec, {
    theme: input.theme,
    locale: input.locale,
    timezone: input.timezone,
  });
  if (model.kind === 'unsupported') throw notImplemented(spec, model.reason);
  return layoutChart(
    model,
    {
      width: input.width,
      height: input.height,
      theme: input.theme,
      mode: input.staticLabels ? 'static' : 'interactive',
      ...(input.printWidthMm === undefined ? {} : { printWidthMm: input.printWidthMm }),
    },
    input.measure,
  );
}

/** Finds the committed `<svg>` under `root`, verifies it against `laid`, and reports readiness. */
export function verifyAndReport(
  root: Element,
  laid: LaidOutChart,
  renderId: number,
  width: number,
  height: number,
): ReadyInfo {
  const chartId = laid.model.chartId;
  const svg = root.querySelector('svg[data-dv-render-id]');
  if (!(svg instanceof SVGSVGElement)) {
    throw new DravenVizError('RENDER_FAILED', 'The chart did not produce an SVG.', {
      chartId,
      issues: [{ rule: 'missing-svg', path: '', message: 'The chart did not produce an SVG.' }],
    });
  }
  verifyCommitted(svg, laid.model.manifest, renderId, width, height, expectationsOf(laid));
  const effectivePt = laid.metrics.effectivePt;
  return {
    chartId,
    renderId,
    width,
    height,
    ...(effectivePt === undefined ? {} : { effectivePt }),
  };
}

/** Resolves after the next animation frame, or at once when `signal` is aborted. */
export function nextFrame(signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted) return resolve();
    requestAnimationFrame(() => resolve());
  });
}
