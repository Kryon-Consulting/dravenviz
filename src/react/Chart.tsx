import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
  type ReactElement,
} from 'react';
import { DUPLICATE_CHART_EMBEDDING } from '../core/validate/index';
import {
  DravenVizError,
  resolveTheme,
  validateSpec,
  type Theme,
  type ThemeName,
  type ThemeOverrides,
  type VizSpec,
} from '../core/index';
import { ChartView } from '../render/ChartView';
import { RenderGuard } from '../render/RenderGuard';
import { defaultFontAssets, loadFonts } from '../render/fonts/load';
import { fontStack, type FontAsset } from '../render/fonts/registry';
import { createCanvasMeasurer } from '../render/layout/canvas-measure';
import type { LaidOutChart, TextMeasurer } from '../render/layout/types';
import { buildLaid, nextFrame, verifyAndReport, type ReadyInfo } from '../render/pipeline';
import { nextRenderId } from '../render/render-id';
import {
  announcement,
  findDatum,
  isNavKey,
  moveFocus,
  navigableDatums,
  nearestDatum,
  valueText,
  type Datum,
  type FocusKey,
} from './interaction';

export type { ReadyInfo };

export interface DatumEvent {
  chartId: string;
  seriesId?: string;
  datumId: string;
  datumLabel?: string;
  value: number | null;
  source: 'pointer' | 'keyboard';
}

export interface ChartProps {
  /** Validated internally whenever the reference changes. */
  spec: VizSpec | unknown;
  theme?: ThemeName | Theme;
  themeOverrides?: ThemeOverrides;
  /**
   * A number of logical px, or `"100%"` (default) to follow the container's width. `"100%"` recovers
   * by itself from a hidden or zero-width container (the observer sees the change). A numeric width
   * creates no observer: after a ZERO_SIZE error because the host was hidden, re-render once it is shown.
   */
  width?: number | '100%';
  height: number;
  /** Default: the sanitized React `useId()`, unique per instance and stable across SSR. */
  namespace?: string;
  locale?: string;
  timezone?: string;
  assetBaseUrl?: string;
  fonts?: FontAsset[];
  /** Default false: labels stay interactive and nothing is pre-placed for print. */
  staticLabels?: boolean;
  onDatumActivate?: (e: DatumEvent) => void;
  onReady?: (info: ReadyInfo) => void;
  onError?: (error: DravenVizError) => void;
  className?: string;
}

/**
 * The default namespace: `dv-` plus a short FNV-1a hash of the case-preserved `useId()` value.
 * React's client (`_r_..._`) and server/hydration (`_R_..._`) ids differ only by case, so the id is
 * hashed rather than lowercased. Deterministic across SSR and hydration, and always matches
 * `^[a-z][a-z0-9-]{0,31}$`.
 */
export function defaultNamespace(id: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return `dv-${h.toString(36).padStart(7, '0')}`;
}

/**
 * Embeddings that are mounting or mounted, keyed by namespace and chart id, so two charts that
 * start at the same moment (before either has a DOM) cannot both claim the same ids.
 */
const claimed = new Map<string, symbol>();
const claimKey = (ns: string, chartId: string): string => `${ns}\u0000${chartId}`;

// `useLayoutEffect` warns when rendered on the server in React 18; the effect only matters in a browser.
const useIsoLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

const NAMESPACE = /^[a-z][a-z0-9-]{0,31}$/;
const HOVER_RADIUS = 20;
const CLICK_RADIUS = 16;

type View =
  | { kind: 'idle' }
  | {
      kind: 'chart';
      laid: LaidOutChart;
      renderId: number;
      theme: Theme;
      fontFamily: string;
      measure: TextMeasurer;
    }
  | { kind: 'error'; error: DravenVizError };

const positive = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0;

function asDravenVizError(e: unknown, chartId?: string): DravenVizError {
  if (e instanceof DravenVizError) return e;
  return new DravenVizError('RENDER_FAILED', 'The chart could not be rendered.', {
    ...(chartId === undefined ? {} : { chartId }),
    cause: e,
  });
}

/** A stable key for an option that may be an object literal rebuilt on every parent render. */
function keyOf(v: unknown): string {
  return v === undefined ? '' : JSON.stringify(v);
}

const hidden: CSSProperties = {
  position: 'absolute',
  width: 1,
  height: 1,
  margin: -1,
  padding: 0,
  overflow: 'hidden',
  clip: 'rect(0 0 0 0)',
  whiteSpace: 'nowrap',
  border: 0,
};

/**
 * The React chart (design section 9). The first render is an empty placeholder root, so the
 * server and the first client render agree; everything else happens in effects. Every change to
 * the spec (by reference), a style option or the size starts a new render with a fresh
 * `renderId` and aborts the previous one: fonts, layout and the commit check run in order, and
 * `onReady` fires only for a render that is still the latest.
 */
export function Chart(props: ChartProps): ReactElement {
  const { spec, height, className } = props;
  const widthProp = props.width ?? '100%';
  const reactId = useId();
  const namespace = props.namespace ?? defaultNamespace(reactId);
  const rootRef = useRef<HTMLDivElement>(null);
  const owner = useRef(Symbol('dravenviz-chart'));
  /** Resolvers waiting for the commit of a given renderId. */
  const commits = useRef(new Map<number, () => void>());
  const [view, setView] = useState<View>({ kind: 'idle' });
  const [measured, setMeasured] = useState<number | undefined>(undefined);
  const [focusKey, setFocusKey] = useState<FocusKey | null>(null);
  const [hoverKey, setHoverKey] = useState<FocusKey | null>(null);

  // Callbacks are read at call time, so a new function identity never restarts a render.
  const callbacks = useRef(props);
  useIsoLayoutEffect(() => {
    callbacks.current = props;
  });

  const fluid = widthProp === '100%';
  useEffect(() => {
    if (!fluid) return undefined;
    const el = rootRef.current;
    if (el === null) return undefined;
    let frame = 0;
    const measure = (): void => {
      frame = 0;
      setMeasured(el.clientWidth);
    };
    measure();
    // One observer, debounced to animation frames; it is disconnected on unmount.
    const observer = new ResizeObserver(() => {
      if (frame === 0) frame = requestAnimationFrame(measure);
    });
    observer.observe(el);
    return () => {
      observer.disconnect();
      if (frame !== 0) cancelAnimationFrame(frame);
    };
  }, [fluid]);

  // Tells the render waiting on a renderId that React has committed it.
  useIsoLayoutEffect(() => {
    if (view.kind !== 'chart') return;
    commits.current.get(view.renderId)?.();
  }, [view]);

  const width = fluid ? measured : widthProp;
  const themeKey = typeof props.theme === 'string' ? props.theme : keyOf(props.theme);
  const overridesKey = keyOf(props.themeOverrides);
  const fontsKey = keyOf(props.fonts);
  const { locale = 'en-US', timezone = 'UTC', assetBaseUrl, staticLabels = false } = props;

  useEffect(() => {
    if (width === undefined) return undefined; // "100%" and not measured yet
    const renderId = nextRenderId();
    const ac = new AbortController();
    const stale = (): boolean => ac.signal.aborted;
    let reportedId = 0;
    let chartId: string | undefined;
    let claimedKey: string | undefined;

    const fail = (e: unknown): void => {
      if (stale() || reportedId === renderId) return;
      reportedId = renderId;
      if (claimedKey !== undefined && claimed.get(claimedKey) === owner.current) {
        claimed.delete(claimedKey);
      }
      const error = asDravenVizError(e, chartId);
      setView({ kind: 'error', error });
      callbacks.current.onError?.(error);
    };

    const run = async (): Promise<void> => {
      if (!positive(height) || (typeof width === 'number' && !fluid && !positive(width))) {
        throw new DravenVizError(
          'INVALID_OPTIONS',
          'width and height must be positive finite numbers.',
          { path: positive(height) ? '/width' : '/height' },
        );
      }
      if (!NAMESPACE.test(namespace)) {
        throw new DravenVizError(
          'INVALID_OPTIONS',
          'namespace must match ^[a-z][a-z0-9-]{0,31}$.',
          {
            path: '/namespace',
          },
        );
      }
      const theme = resolveTheme(
        callbacks.current.theme ?? 'light',
        callbacks.current.themeOverrides,
      );
      const validated = validateSpec(spec);
      chartId = validated.id;
      const root = rootRef.current;
      // A measured "100%" width below 1, or a host that is not rendered (display: none, detached).
      if (width < 1 || root === null || !root.isConnected || root.getClientRects().length === 0) {
        throw new DravenVizError(
          'ZERO_SIZE',
          'The chart container has no size (hidden, collapsed or not rendered).',
          { chartId: validated.id },
        );
      }
      // Never render with ids another embedding already uses (silent clip-path cross-references).
      const key = claimKey(namespace, validated.id);
      const holder = claimed.get(key);
      const inDocument = Array.from(
        root.ownerDocument.querySelectorAll(
          `[data-dravenviz-ns="${namespace}"][data-dravenviz-chart="${validated.id.replace(/["\\]/g, '\\$&')}"]`,
        ),
      ).some((el) => el !== root && !root.contains(el));
      if ((holder !== undefined && holder !== owner.current) || inDocument) {
        const message = `Chart "${validated.id}" is already embedded with namespace "${namespace}" in this document. Give each instance a distinct "namespace" prop, or set a distinct React identifierPrefix per root.`;
        throw new DravenVizError('INVALID_OPTIONS', message, {
          chartId: validated.id,
          path: '/namespace',
          issues: [{ rule: DUPLICATE_CHART_EMBEDDING, path: '/namespace', message }],
        });
      }
      claimed.set(key, owner.current);
      claimedKey = key;
      const assets = callbacks.current.fonts ?? defaultFontAssets(assetBaseUrl);
      const fonts = await loadFonts(assets, ac.signal);
      if (stale()) return;
      const fontFamily = fontStack(fonts);
      const measure = createCanvasMeasurer(fontFamily);
      const laid = buildLaid(validated, {
        theme,
        locale,
        timezone,
        width,
        height,
        staticLabels,
        printWidthMm: theme.name === 'print' ? 178 : undefined,
        measure,
      });
      if (stale()) return;
      // Wait for React to commit this renderId (it may be later than two frames when several
      // roots render at once), then for two frames: Recharts settles its hook state after commit.
      const committed = new Promise<void>((resolve) => {
        commits.current.set(renderId, resolve);
        ac.signal.addEventListener('abort', () => resolve(), { once: true });
      });
      setView({ kind: 'chart', laid, renderId, theme, fontFamily, measure });
      await committed;
      commits.current.delete(renderId);
      await nextFrame(ac.signal);
      await nextFrame(ac.signal);
      if (stale() || reportedId === renderId) return;
      const info = verifyAndReport(root, laid, renderId, width, height);
      if (stale()) return;
      callbacks.current.onReady?.(info);
    };

    run().catch(fail);
    return () => {
      ac.abort();
      commits.current.delete(renderId);
      if (claimedKey !== undefined && claimed.get(claimedKey) === owner.current) {
        claimed.delete(claimedKey);
      }
    };
    // `props.theme`, `themeOverrides` and `fonts` enter through their stable keys.
  }, [
    spec,
    width,
    height,
    namespace,
    locale,
    timezone,
    assetBaseUrl,
    staticLabels,
    themeKey,
    overridesKey,
    fontsKey,
  ]);

  const laid = view.kind === 'chart' ? view.laid : undefined;
  const all = useMemo(() => (laid === undefined ? [] : navigableDatums(laid)), [laid]);
  const focused = findDatum(all, focusKey);
  const hovered = findDatum(all, hoverKey);

  const activate = useCallback(
    (d: Datum, source: DatumEvent['source']): void => {
      if (laid === undefined) return;
      callbacks.current.onDatumActivate?.({
        chartId: laid.model.chartId,
        seriesId: d.seriesId,
        datumId: d.pointId,
        datumLabel: d.label,
        value: d.value,
        source,
      });
    },
    [laid],
  );

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>): void => {
    if (laid === undefined || e.target !== e.currentTarget) return;
    if (isNavKey(e.key)) {
      const next = moveFocus(all, focused, e.key);
      e.preventDefault();
      if (next !== undefined) setFocusKey({ seriesId: next.seriesId, pointId: next.pointId });
    } else if (e.key === 'Enter' || e.key === ' ') {
      if (focused !== undefined) {
        e.preventDefault();
        activate(focused, 'keyboard');
      }
    } else if (e.key === 'Escape') {
      setFocusKey(null);
      setHoverKey(null);
    }
  };

  /** The pointer position in the chart's logical units, or undefined when no chart is drawn. */
  const logical = (e: {
    clientX: number;
    clientY: number;
  }): { x: number; y: number } | undefined => {
    if (laid === undefined) return undefined;
    const svg = rootRef.current?.querySelector('svg[data-dv-render-id]');
    if (svg === null || svg === undefined) return undefined;
    const rect = svg.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return undefined;
    return {
      x: ((e.clientX - rect.left) * laid.width) / rect.width,
      y: ((e.clientY - rect.top) * laid.height) / rect.height,
    };
  };

  const onPointerMove = (e: PointerEvent<HTMLDivElement>): void => {
    const p = logical(e);
    const hit = p === undefined ? undefined : nearestDatum(all, p.x, p.y, HOVER_RADIUS);
    const next = hit === undefined ? null : { seriesId: hit.seriesId, pointId: hit.pointId };
    setHoverKey((cur) =>
      cur?.seriesId === next?.seriesId && cur?.pointId === next?.pointId ? cur : next,
    );
  };

  const onClick = (e: MouseEvent<HTMLDivElement>): void => {
    const p = logical(e);
    const hit = p === undefined ? undefined : nearestDatum(all, p.x, p.y, CLICK_RADIUS);
    if (hit !== undefined) activate(hit, 'pointer');
  };

  const interactive = view.kind === 'chart';
  const theme = view.kind === 'chart' ? view.theme : undefined;
  const style: CSSProperties = {
    position: 'relative',
    ...(fluid
      ? { width: '100%', minWidth: 0 }
      : { width: typeof width === 'number' ? width : undefined }),
  };
  const rootProps = {
    ref: rootRef,
    className: className === undefined ? 'dravenviz-root' : `dravenviz-root ${className}`,
    'data-dravenviz-ns': namespace,
    style,
  };

  if (view.kind === 'error') {
    return (
      <div {...rootProps}>
        <div role="alert" className="dravenviz-error">
          <span className="dravenviz-error-code">{view.error.code}</span>: {view.error.message}
        </div>
      </div>
    );
  }
  if (view.kind === 'idle') return <div {...rootProps} />;

  const reportRenderError = (error: unknown): void => {
    const wrapped = asDravenVizError(error, view.laid.model.chartId);
    setView({ kind: 'error', error: wrapped });
    callbacks.current.onError?.(wrapped);
  };

  return (
    <div
      {...rootProps}
      data-dravenviz-chart={view.laid.model.chartId}
      tabIndex={interactive ? 0 : undefined}
      role="group"
      aria-roledescription="chart"
      aria-label={view.laid.model.title}
      onKeyDown={onKeyDown}
      onPointerMove={onPointerMove}
      onPointerLeave={() => setHoverKey(null)}
      onClick={onClick}
    >
      <RenderGuard key={view.renderId} onError={reportRenderError}>
        <ChartView
          laid={view.laid}
          renderId={view.renderId}
          namespace={namespace}
          fontFamily={view.fontFamily}
          theme={view.theme}
          measure={view.measure}
          interactive={{ focus: focused === undefined ? null : { x: focused.x, y: focused.y } }}
        />
      </RenderGuard>
      {hovered !== undefined && theme !== undefined ? (
        <Tooltip datum={hovered} theme={theme} fontFamily={view.fontFamily} />
      ) : null}
      <div aria-live="polite" role="status" data-dv-live="" style={hidden}>
        {focused === undefined ? '' : announcement(focused)}
      </div>
    </div>
  );
}

/** HTML tooltip, positioned from the scale. It lives outside the `<svg>`. */
function Tooltip(props: { datum: Datum; theme: Theme; fontFamily: string }): ReactElement {
  const { datum: d, theme } = props;
  const flip = d.y < 56;
  return (
    <div
      role="tooltip"
      data-dv-tooltip=""
      style={{
        position: 'absolute',
        left: d.x,
        top: d.y,
        transform: flip ? 'translate(-50%, 12px)' : 'translate(-50%, calc(-100% - 12px))',
        pointerEvents: 'none',
        zIndex: 1,
        padding: '4px 8px',
        border: `1px solid ${theme.color.axis}`,
        borderRadius: 4,
        background: theme.color.background,
        color: theme.color.text,
        fontFamily: props.fontFamily,
        fontSize: theme.text.label,
        lineHeight: theme.text.lineHeight,
        whiteSpace: 'nowrap',
      }}
    >
      <div style={{ fontWeight: 600 }}>{d.seriesLabel}</div>
      <div>
        {d.label}: {valueText(d)}
      </div>
      {d.quality === 'measured' ? null : <div>{d.quality}</div>}
    </div>
  );
}
