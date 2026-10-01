// Imported first by harness.ts: wraps the ResizeObserver constructor before any DravenViz or
// Recharts code can create one, so the tests can count live observers (design section 9).
const Native = window.ResizeObserver;
const live = new Set<object>();

class CountingResizeObserver extends Native {
  constructor(callback: ResizeObserverCallback) {
    super(callback);
    live.add(this);
  }
  override disconnect(): void {
    live.delete(this);
    super.disconnect();
  }
}

window.ResizeObserver = CountingResizeObserver;

// A MutationObserver is live from its first observe() until disconnect(). Observers on the document
// itself belong to the test tool (Playwright's injected script watches it), not to DravenViz.
const NativeMutation = window.MutationObserver;
const liveMutation = new Set<object>();

class CountingMutationObserver extends NativeMutation {
  override observe(target: Node, options?: MutationObserverInit): void {
    if (target.nodeType !== Node.DOCUMENT_NODE && target !== document.documentElement) {
      liveMutation.add(this);
    }
    super.observe(target, options);
  }
  override disconnect(): void {
    liveMutation.delete(this);
    super.disconnect();
  }
}

window.MutationObserver = CountingMutationObserver;

/** Live ResizeObservers only. */
export const liveResizeObserverCount = (): number => live.size;

/** Live ResizeObservers plus live MutationObservers. */
export const liveObserverCount = (): number => live.size + liveMutation.size;
