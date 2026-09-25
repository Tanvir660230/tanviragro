"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useL } from "@/i18n/text";

export interface PrintButtonProps {
  label?: string;
  className?: string;
  variant?: "default" | "outline" | "secondary" | "ghost";
  size?: "default" | "sm" | "lg" | "icon";
}

export function PrintButton({
  label,
  className,
  variant = "outline",
  size = "sm",
}: PrintButtonProps) {
  const L = useL();
  return (
    <Button
      variant={variant}
      size={size}
      onClick={() => window.print()}
      className={cn(
        "gap-2 font-medium text-xs rounded-xl shadow-xs transition-colors print:hidden cursor-pointer",
        className
      )}
    >
      <Printer className="h-3.5 w-3.5" />
      {label ?? L("প্রিন্ট করুন", "Print")}
    </Button>
  );
}
