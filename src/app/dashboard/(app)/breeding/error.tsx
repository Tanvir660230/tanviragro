"use client";

import { ErrorView } from "@/components/shared/ErrorView";

export default function BreedingError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <ErrorView
      message={error.message || "Something went wrong loading the breeding data."}
      reset={reset}
      digest={error.digest}
    />
  );
}
