/// <reference types="vite/client" />
import { liveObserverCount, liveResizeObserverCount } from './observers';
import { createElement } from 'react';
import { createRoot, hydrateRoot, type Root } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { InvalidSpecError } from '../../src/core/index';
import { Chart, type ChartProps, type DatumEvent, type ReadyInfo } from '../../src/react/index';

const valid = import.meta.glob('../../fixtures/valid/*.json', {
  eager: true,
  import: 'default',
}) as Record<string, unknown>;

function fixture(id: string): unknown {
  const hit = Object.entries(valid).find(([path]) => path.endsWith(`/${id}.json`));
  if (hit === undefined) throw new Error(`unknown fixture ${id}`);
  return structuredClone(hit[1]);
}

/** Props the tests send: `fixture` names a catalog fixture and `spec` a literal spec. */
type HarnessProps = Omit<ChartProps, 'spec' | 'onReady' | 'onError' | 'onDatumActivate'> & {
  /** A catalog fixture. The same object is reused across renders until `freshSpec` is set. */
  fixture?: string;
  /** A literal spec, used by reference; stored under `specKey` so later renders can reuse it. */
  spec?: unknown;
  specKey?: string;
  freshSpec?: boolean;
};

interface ErrorLog {
  code: string | undefined;
  message: string;
  isSameInstanceAsLast?: boolean;
}

interface ExtraLog {
  ready: ReadyInfo[];
  errors: ErrorLog[];
  root: Root | null;
  host: HTMLElement;
}
const extras: ExtraLog[] = [];
const specs = new Map<string, unknown>();

function specFor(p: HarnessProps): unknown {
  const key = p.specKey ?? (p.fixture === undefined ? undefined : `fixture:${p.fixture}`);
  if (p.spec !== undefined) {
    if (key !== undefined) specs.set(key, p.spec);
    return p.spec;
  }
  if (key === undefined) throw new Error('render needs a fixture, a spec or a known specKey');
  if (p.freshSpec === true || !specs.has(key)) {
    if (p.fixture === undefined) throw new Error(`unknown specKey ${key}`);
    specs.set(key, fixture(p.fixture));
  }
  return specs.get(key);
}

const host = document.getElementById('host') as HTMLElement;
let root: Root | null = null;
const readyCalls: ReadyInfo[] = [];
const errorCalls: ErrorLog[] = [];
const activateCalls: DatumEvent[] = [];
let lastError: unknown;

const harness = {
  fixture,
  readyCalls,
  errorCalls,
  activateCalls,
  /** Renders (or re-renders) the chart. A `fixture` or `spec` is used by reference, as given. */
  render(props: HarnessProps): void {
    const { fixture: _f, spec: _s, specKey: _k, freshSpec: _x, ...rest } = props;
    void [_f, _s, _k, _x];
    const spec = specFor(props);
    root ??= createRoot(host);
    root.render(
      createElement(Chart, {
        ...rest,
        spec,
        onReady: (info) => readyCalls.push(info),
        onError: (e) => {
          lastError = e;
          errorCalls.push({ code: e.code, message: e.message });
        },
        onDatumActivate: (e) => activateCalls.push(e),
      } as ChartProps),
    );
  },
  setHostWidth(px: number): void {
    host.style.width = `${px}px`;
  },
  unmount(): void {
    root?.unmount();
    root = null;
  },
  /** True when the last onError argument is the very `InvalidSpecError` validation threw. */
  lastErrorIsInvalidSpec: (): boolean => lastError instanceof InvalidSpecError,
  /**
   * An additional, independent React root with its own <Chart>. `hydrate` first renders the chart
   * to a string on the "server" (react-dom/server) and hydrates that markup, like an SSR island.
   * Returns the root's index for `extra(i)`.
   */
  mountExtra(
    props: HarnessProps & { identifierPrefix?: string; hydrate?: boolean; hostWidth?: number },
  ): number {
    const { identifierPrefix, hydrate, hostWidth, ...chartProps } = props;
    const { fixture: _f, spec: _s, specKey: _k, freshSpec: _x, ...rest } = chartProps;
    void [_f, _s, _k, _x];
    const log: ExtraLog = {
      ready: [],
      errors: [],
      root: null,
      host: document.createElement('div'),
    };
    log.host.style.width = `${hostWidth ?? 600}px`;
    document.body.appendChild(log.host);
    const element = (): ReturnType<typeof createElement> =>
      createElement(Chart, {
        ...rest,
        spec: specFor(chartProps),
        onReady: (i) => log.ready.push(i),
        onError: (e) => log.errors.push({ code: e.code, message: e.message }),
      } as ChartProps);
    const options = identifierPrefix === undefined ? {} : { identifierPrefix };
    if (hydrate === true) {
      const markup = new DOMParser().parseFromString(
        renderToString(element(), options),
        'text/html',
      );
      log.host.replaceChildren(...Array.from(markup.body.childNodes));
      log.root = hydrateRoot(log.host, element(), options);
    } else {
      log.root = createRoot(log.host, options);
      log.root.render(element());
    }
    extras.push(log);
    return extras.length - 1;
  },
  extra(i: number): { ready: ReadyInfo[]; errors: ErrorLog[]; ns: string | null } {
    const e = extras[i] as ExtraLog;
    return {
      ready: e.ready,
      errors: e.errors,
      ns: e.host.querySelector('.dravenviz-root')?.getAttribute('data-dravenviz-ns') ?? null,
    };
  },
  unmountExtras(): void {
    for (const e of extras.splice(0)) {
      e.root?.unmount();
      e.host.remove();
    }
  },
  setHostDisplay(display: string): void {
    host.style.display = display;
  },
  counts(): { roots: number; observers: number; svgs: number } {
    return {
      // Mounted <Chart> roots: one `.dravenviz-root` per chart owned by an adapter instance.
      roots: document.querySelectorAll('.dravenviz-root').length,
      observers: liveObserverCount(),
      svgs: document.querySelectorAll('svg[data-dravenviz-chart]').length,
    };
  },
  resizeObservers: liveResizeObserverCount,
};

declare global {
  interface Window {
    __r: typeof harness;
  }
}

window.__r = harness;
