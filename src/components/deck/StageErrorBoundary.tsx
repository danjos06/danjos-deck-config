import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  onError: (error: Error) => void;
}

/** Catches failures of the lazy 3D stage (chunk load, WebGL, GLB) so the app can fall back to 2D. */
export class StageErrorBoundary extends Component<Props, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.warn('Palco 3D indisponível, voltando ao 2D.', error, info.componentStack);
    this.props.onError(error);
  }

  render(): ReactNode {
    return this.state.failed ? null : this.props.children;
  }
}
