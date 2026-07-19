"use client";

import React from "react";
import { AlertCircle, RefreshCw } from "lucide-react";

interface State {
  hasError: boolean;
  message: string;
}

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  label?: string;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, message: "" };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message };
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-5 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-destructive mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-destructive">
              {this.props.label ?? "Something went wrong"}
            </p>
            {this.state.message && (
              <p className="text-xs text-muted-foreground mt-1 truncate">{this.state.message}</p>
            )}
            <button
              onClick={() => this.setState({ hasError: false, message: "" })}
              className="mt-2 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <RefreshCw className="h-3 w-3" /> Retry
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
