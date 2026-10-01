import { Component } from 'react';
import type { ReactNode } from 'react';

interface Props {
  /** Called once with the first error thrown while rendering the children. */
  onError: (error: unknown) => void;
  children?: ReactNode;
}

/**
 * Catches render errors so the lifecycle can turn them into `RENDER_FAILED`. React reports an
 * uncaught render error asynchronously (and differently in 18 and 19); an error boundary behaves
 * the same in every supported version and keeps the failure out of the host page.
 */
export class RenderGuard extends Component<Props, { failed: boolean }> {
  override state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  override componentDidCatch(error: unknown): void {
    this.props.onError(error);
  }

  override render(): ReactNode {
    return this.state.failed ? null : this.props.children;
  }
}
