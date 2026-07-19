"use client";

import { Download } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";

export function ExportCattleCSV() {
  return (
    <a
      href="/dashboard/cattle/export"
      download
      className={buttonVariants({ variant: "outline", size: "sm" })}
    >
      <Download className="mr-1.5 h-4 w-4" />
      Export CSV
    </a>
  );
}
