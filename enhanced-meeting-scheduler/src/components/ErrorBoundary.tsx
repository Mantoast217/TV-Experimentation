import { Component, type ErrorInfo, type ReactNode } from "react";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

/**
 * Catches uncaught errors anywhere in the render tree below it and shows a fallback
 * instead of an unrecoverable blank page. Must be a class component — React has no hook
 * equivalent for componentDidCatch/getDerivedStateFromError.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // No error-tracking service (e.g. Sentry) is configured yet — this is the one place
    // to wire one up once there is.
    console.error("MeetingScheduler crashed:", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <main className="flex min-h-screen items-center justify-center px-6 py-12">
          <div className="flex max-w-md flex-col items-start gap-3" role="alert">
            <h1 className="m-0 text-xl font-medium text-foreground">Something went wrong</h1>
            <p className="m-0 text-sm text-[var(--secondary-text)]">
              This page hit an unexpected error and can't continue. Reloading usually fixes it.
            </p>
            {/* bg-[#0D3F9C] stays fixed — it's paired with fixed white text, and that pairing's
                contrast (9.51:1) doesn't depend on the surrounding page theme. The focus ring
                does need to react to theme, since it sits directly against the page background,
                which does change (the fixed dark blue measures only ~2.1:1 against the dark-mode
                background, verified live — var(--brand-blue) is the same token MeetingScheduler
                uses for this exact reason). */}
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex h-9 items-center justify-center rounded-md bg-[#0D3F9C] px-4 text-sm font-medium text-white focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-blue)]"
            >
              Reload page
            </button>
          </div>
        </main>
      );
    }
    return this.props.children;
  }
}
