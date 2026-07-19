"use client";

import { ErrorView } from "@/components/shared/ErrorView";

export default function FinanceError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ErrorView message={error.message} reset={reset} digest={error.digest} />;
}
