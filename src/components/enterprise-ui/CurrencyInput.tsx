"use client";

import React, { forwardRef } from "react";
import { cn } from "@/lib/utils";

export interface CurrencyInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value"> {
  value?: number | string;
  onChange?: (val: number | null) => void;
  currencySymbol?: string;
  error?: boolean;
}

export const CurrencyInput = forwardRef<HTMLInputElement, CurrencyInputProps>(
  ({ value, onChange, currencySymbol = "৳", error, className, placeholder = "0.00", ...props }, ref) => {
    const displayValue = value === undefined || value === null || value === "" ? "" : String(value);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value.replace(/[^0-9.]/g, "");
      if (raw === "") {
        onChange?.(null);
        return;
      }
      const num = parseFloat(raw);
      onChange?.(isNaN(num) ? null : num);
    };

    return (
      <div className="relative flex items-center w-full">
        <span className="absolute left-3 font-medium text-muted-foreground select-none pointer-events-none text-xs sm:text-sm">
          {currencySymbol}
        </span>
        <input
          ref={ref}
          type="text"
          inputMode="decimal"
          value={displayValue}
          onChange={handleChange}
          placeholder={placeholder}
          className={cn(
            "flex h-9 sm:h-10 w-full rounded-xl border bg-background pl-8 pr-3 py-1 text-xs sm:text-sm shadow-xs transition-colors",
            "file:border-0 file:bg-transparent file:text-sm file:font-medium",
            "placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 font-mono",
            error ? "border-destructive focus-visible:ring-destructive" : "border-input",
            className
          )}
          {...props}
        />
      </div>
    );
  }
);

CurrencyInput.displayName = "CurrencyInput";
