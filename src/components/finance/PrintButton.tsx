"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

import { useL } from "@/i18n/text";
export function PrintButton() {
  const L = useL();
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => window.print()}
      className="rounded-xl border-border/80 gap-1.5 text-xs font-medium cursor-pointer hover:bg-muted"
    >
      <Printer className="h-3.5 w-3.5 text-muted-foreground" />
      {L("প্রিন্ট করুন", "Print Statement")}
    </Button>
  );
}
