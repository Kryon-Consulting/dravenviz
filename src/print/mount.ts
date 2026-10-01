import { DravenVizError, InvalidSpecError, validateSpec, type VizSpec } from '../core/index';
import { DUPLICATE_CHART_EMBEDDING } from '../core/validate/index';
import { loadFonts } from '../render/fonts/load';
import { fontStack } from '../render/fonts/registry';
import { createCanvasMeasurer } from '../render/layout/canvas-measure';
import type { LaidOutChart } from '../render/layout/types';
import { buildLaid, nextFrame, verifyAndReport, type ReadyInfo } from '../render/pipeline';
import { nextRenderId } from '../render/render-id';
import { Batch, renderChart } from './lifecycle';
import { resolveOptions, type MountOptions, type ResolvedOptions } from './options';

export type { MountOptions } from './options';

export type { ReadyInfo };

export interface MountHandle {
  /** One entry per spec, in order. */
  readonly ready: Promise<ReadyInfo[]>;
  /** Idempotent. Before readiness it rejects `ready` with `DISPOSED`. */
  dispose(): void;
}

const frame = nextFrame;

function throwIfAborted(signal: AbortSignal, reason: () => DravenVizError): void {
  if (signal.aborted) throw reason();
}

function duplicate(chartId: string, index: number, where: string): DravenVizError {
  const message = `Chart "${chartId}" is already embedded with this namespace ${where}; give each instance a distinct namespace.`;
  return new DravenVizError('INVALID_OPTIONS', message, {
    chartId,
    path: `/specs/${index}`,
    issues: [{ rule: DUPLICATE_CHART_EMBEDDING, path: `/specs/${index}`, message }],
  });
}

/** Step 1: validate every spec and the embedding identities before the DOM is touched. */
/** Identities reserved by batches that are still in flight (the document check cannot see them yet). */
const pending = new Set<string>();

function validateBatch(
  specs: unknown[],
  options: ResolvedOptions,
  doc: Document,
  reserved: string[],
): VizSpec[] {
  const validated = specs.map((raw) =>
    validateSpec(raw, options.limits === undefined ? undefined : { limits: options.limits }),
  );
  const seen = new Set<string>();
  const existing = new Set<string>();
  for (const el of doc.querySelectorAll('[data-dravenviz-ns][data-dravenviz-chart]')) {
    existing.add(
      `${el.getAttribute('data-dravenviz-ns')}\u0000${el.getAttribute('data-dravenviz-chart')}`,
    );
  }
  validated.forEach((spec, i) => {
    const key = `${options.namespaces[i]}\u0000${spec.id}`;
    if (seen.has(key)) throw duplicate(spec.id, i, 'in this batch');
    if (existing.has(key)) throw duplicate(spec.id, i, 'in the document');
    if (pending.has(key)) throw duplicate(spec.id, i, 'in another batch that is still mounting');
    seen.add(key);
  });
  // Reserve synchronously with the check, so two back-to-back calls cannot both pass.
  for (const key of seen) pending.add(key);
  reserved.push(...seen);
  return validated;
}

/**
 * Batch-mounts charts for print (design section 9). Readiness sequence: validate options and all
 * specs, load and verify fonts, check the hosts are rendered, build model and layout, render, wait
 * two animation frames and verify every committed SVG, then resolve. The whole sequence is bounded
 * by `timeoutMs`; any failure disposes every mount the batch created before `ready` rejects.
 */
export function mountCharts(
  target: Element | Element[],
  specs: unknown[],
  options: MountOptions,
): MountHandle {
  return mountBatch(target, specs, options);
}

/**
 * The one mount path, shared by `mountCharts` and `renderToSvg` so readiness, verification,
 * timeout and disposal behave identically. `namespaces`, when given, replaces the validated
 * per-spec namespaces; the export uses it with reserved names that cannot match the public
 * namespace pattern, so a temporary export mount never collides with a live chart.
 */
export function mountBatch(
  target: Element | Element[],
  specs: unknown[],
  options: MountOptions,
  namespaces?: string[],
): MountHandle {
  if (!Array.isArray(specs)) {
    throw new DravenVizError('INVALID_OPTIONS', 'specs must be an array.');
  }
  const targets: Element[] = Array.isArray(target) ? target : specs.map(() => target);
  if (Array.isArray(target) && target.length !== specs.length) {
    throw new DravenVizError('INVALID_OPTIONS', 'target and specs must have the same length.');
  }
  const batch = new Batch();
  const reserved: string[] = [];
  const release = (): void => {
    for (const key of reserved.splice(0)) pending.delete(key);
  };
  const abort = new AbortController();
  let settled = false;
  let rejectDeadline!: (e: DravenVizError) => void;
  const deadline = new Promise<never>((_, reject) => {
    rejectDeadline = reject;
  });
  deadline.catch(() => undefined);

  const disposed = (): DravenVizError =>
    new DravenVizError('DISPOSED', 'The chart batch was disposed before it was ready.');
  const timedOut = (): DravenVizError =>
    new DravenVizError('TIMEOUT', 'The chart batch was not ready before timeoutMs elapsed.');
  let abortReason: () => DravenVizError = disposed;

  const run = async (): Promise<ReadyInfo[]> => {
    const resolved = resolveOptions(options, specs.length);
    if (namespaces !== undefined) resolved.namespaces = namespaces;
    for (const t of targets) {
      if (!(t instanceof Element)) {
        throw new DravenVizError(
          'INVALID_OPTIONS',
          'target must be an Element or an array of Elements.',
        );
      }
    }
    const doc = (targets[0] ?? document.body).ownerDocument;
    const validated = validateBatch(specs, resolved, doc, reserved);
    const timer = setTimeout(() => {
      abortReason = timedOut;
      rejectDeadline(timedOut());
      abort.abort();
    }, resolved.timeoutMs);
    try {
      const fonts = await loadFonts(resolved.fonts, abort.signal);
      throwIfAborted(abort.signal, abortReason);
      validated.forEach((spec, i) => {
        const host = targets[i] as Element;
        if (!host.isConnected || host.getClientRects().length === 0) {
          throw new DravenVizError(
            'ZERO_SIZE',
            'The host element is not connected or not rendered (hidden or display: none).',
            { chartId: spec.id },
          );
        }
        // fit "width" scales the chart to the host, so a rendered host with no width would
        // produce a 0 x 0 chart.
        if (resolved.fit === 'width' && host.getBoundingClientRect().width < 1) {
          throw new DravenVizError(
            'ZERO_SIZE',
            'The host element has no width, so a chart that fits its width would have no size.',
            { chartId: spec.id },
          );
        }
      });
      const measure = createCanvasMeasurer(fontStack(fonts));
      const laids: LaidOutChart[] = validated.map((spec) =>
        buildLaid(spec, {
          theme: resolved.theme,
          locale: resolved.locale,
          timezone: resolved.timezone,
          width: resolved.width,
          height: resolved.height,
          staticLabels: resolved.staticLabels,
          printWidthMm: resolved.printWidthMm,
          measure,
        }),
      );
      throwIfAborted(abort.signal, abortReason);
      laids.forEach((laid, i) => {
        batch.add(
          renderChart({
            target: targets[i] as Element,
            laid,
            theme: resolved.theme,
            namespace: resolved.namespaces[i] as string,
            renderId: nextRenderId(),
            fontFamily: fontStack(fonts),
            measure,
            fit: resolved.fit,
          }),
        );
      });
      // Two animation frames: Recharts settles its hook state after the first commit.
      await frame(abort.signal);
      await frame(abort.signal);
      throwIfAborted(abort.signal, abortReason);
      return batch.charts.map((chart) =>
        verifyAndReport(chart.element, chart.laid, chart.renderId, resolved.width, resolved.height),
      );
    } finally {
      clearTimeout(timer);
    }
  };

  const work = run().catch((e: unknown) => {
    // A failure that is not already a DravenVizError (a bug) still must not leak mounts.
    if (e instanceof DravenVizError) throw e;
    throw new DravenVizError('RENDER_FAILED', 'The chart batch failed.', { cause: e });
  });
  work.catch(() => undefined);

  const ready = Promise.race([work, deadline]).then(
    (infos) => {
      settled = true;
      release();
      return infos;
    },
    (e: unknown) => {
      settled = true;
      abort.abort();
      batch.disposeAll();
      release();
      throw e;
    },
  );
  // A caller that disposes without awaiting `ready` must not see an unhandled rejection.
  ready.catch(() => undefined);

  return {
    ready,
    dispose(): void {
      if (!settled) {
        abortReason = disposed;
        rejectDeadline(disposed());
        abort.abort();
      }
      batch.disposeAll();
      release();
    },
  };
}

export { InvalidSpecError };
