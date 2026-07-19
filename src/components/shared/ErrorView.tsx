import Link from "next/link";
import { AlertCircle, Home } from "lucide-react";

interface Props {
  message?: string;
  reset?: () => void;
  digest?: string;
}

export function ErrorView({ message, reset, digest }: Props) {
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
        <AlertCircle className="h-7 w-7 text-destructive" />
      </div>
      <div>
        <p className="text-base font-semibold">Something went wrong</p>
        <p className="mt-1 text-sm text-muted-foreground max-w-xs">
          {message ?? "An unexpected error occurred. Please try again."}
        </p>
        {digest && (
          <p className="mt-2 font-mono text-xs text-muted-foreground/50">
            Error ID: {digest}
          </p>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2 justify-center">
        {reset && (
          <button
            onClick={reset}
            className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium hover:bg-muted transition-colors"
          >
            Try again
          </button>
        )}
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 rounded-lg bg-muted px-4 py-2 text-sm font-medium hover:bg-muted/70 transition-colors"
        >
          <Home className="h-3.5 w-3.5" />
          Go to Dashboard
        </Link>
      </div>
    </div>
  );
}
