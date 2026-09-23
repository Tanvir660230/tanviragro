import Link from "next/link";
import { AlertCircle, RotateCcw, Home } from "lucide-react";

interface Props {
  message?: string;
  reset?: () => void;
  digest?: string;
}

export function ErrorView({ message, reset, digest }: Props) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center p-4 animate-fade-in">
      <div className="w-full max-w-md rounded-3xl border border-border/70 bg-card p-6 sm:p-8 shadow-card text-center space-y-5">
        {/* Glowing Icon Badge */}
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive/10 ring-8 ring-destructive/5 text-destructive">
          <AlertCircle className="h-7 w-7" />
        </div>

        {/* Message */}
        <div className="space-y-1.5">
          <h2 className="text-lg font-bold tracking-tight text-foreground font-heading">
            Something went wrong
          </h2>
          <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
            {message ?? "An unexpected error occurred while loading this view. Please try again."}
          </p>
          {digest && (
            <p className="mt-2 font-mono text-[11px] text-muted-foreground/50 bg-muted/30 px-2 py-1 rounded-md inline-block">
              Error ID: {digest}
            </p>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-2.5 pt-2">
          {reset && (
            <button
              onClick={reset}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs sm:text-sm font-semibold text-primary-foreground shadow-xs hover:bg-primary/90 tap-press cursor-pointer"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Try again
            </button>
          )}
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-border/70 bg-card px-4 py-2.5 text-xs sm:text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 tap-press cursor-pointer"
          >
            <Home className="h-3.5 w-3.5" />
            Go to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}

