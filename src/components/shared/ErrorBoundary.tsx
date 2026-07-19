"use client";

import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertCircle } from "lucide-react";

interface Props {
  children: ReactNode;
  fallbackMessage?: string;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center p-6 text-center bg-destructive/10 rounded-xl border border-destructive/20 text-destructive gap-2 h-full min-h-[150px]">
          <AlertCircle className="h-8 w-8 opacity-80" />
          <h3 className="font-semibold text-sm">
            {this.props.fallbackMessage || "Failed to load component"}
          </h3>
          <p className="text-xs opacity-80">
            {this.state.error?.message || "An unexpected error occurred."}
          </p>
          <button
            className="mt-2 text-xs font-medium underline underline-offset-2 hover:opacity-80"
            onClick={() => this.setState({ hasError: false, error: undefined })}
          >
            Try again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
