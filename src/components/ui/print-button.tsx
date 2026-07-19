"use client";

import { Printer } from "lucide-react";

export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-md shadow flex items-center gap-2 text-sm font-medium transition-colors"
    >
      <Printer className="h-4 w-4" />
      Print Report
    </button>
  );
}
