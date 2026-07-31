"use client";

/**
 * ErrorBoundary — catches render errors in a subtree and shows a fallback.
 *
 * Use this to wrap feature views so a crash in one view doesn't take down
 * the whole app. The fallback includes a "Retry" button that resets the
 * error state.
 */

import { Component, type ReactNode, type ErrorInfo } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
  fallback?: (error: Error, reset: () => void) => ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  reset = () => this.setState({ error: null });

  render() {
    if (this.state.error) {
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.reset);
      }
      return (
        <div className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center">
          <div className="rounded-full bg-destructive/15 p-3 text-destructive">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <div>
            <p className="font-medium text-foreground">Une erreur est survenue</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {this.state.error.message || "Veuillez réessayer."}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={this.reset}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Réessayer
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}
