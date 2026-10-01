/// <reference types="vite/client" />
import { liveObserverCount, liveResizeObserverCount } from './observers';
import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
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
  counts(): { roots: number; observers: number; svgs: number } {
    return {
      roots: root === null ? 0 : 1,
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
