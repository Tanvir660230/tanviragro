"use client";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background text-foreground font-sans text-center p-6">
        <p className="text-4xl">🌿</p>
        <div>
          <p className="text-lg font-semibold">Chowdhury Agro — Critical Error</p>
          <p className="mt-1 text-sm text-muted-foreground">
            The app crashed unexpectedly.
          </p>
        </div>
        <button
          onClick={reset}
          className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted transition-colors"
        >
          Reload app
        </button>
      </body>
    </html>
  );
}
