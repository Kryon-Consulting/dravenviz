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

export const liveObserverCount = (): number => live.size;
