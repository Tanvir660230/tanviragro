"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { CalendarIcon } from "lucide-react"

/* ── DateInput ───────────────────────────────────────────────────── */

export interface DateInputProps extends Omit<React.ComponentProps<"input">, "value" | "defaultValue" | "onChange"> {
  value?: string
  onValueChange?: (value: string) => void
  inputSize?: "sm" | "default" | "lg"
  /** ISO date preset like "today", "yesterday", "7d", "30d" */
  preset?: string
}

function DateInput({ value, onValueChange, inputSize = "default", preset, className, ...props }: DateInputProps) {
  const [status, setStatus] = React.useState<"default" | "warning" | "error">("default")

  const validate = (val: string) => {
    if (!val) { setStatus("default"); return }
    const m = val.match(/^(\d{4})-(\d{2})-(\d{2})$/)
    if (!m) { setStatus("error"); return }
    const [, y, mo, d] = m
    const dt = new Date(Number(y), Number(mo) - 1, Number(d))
    const ok = dt.getFullYear() === Number(y) && dt.getMonth() === Number(mo) - 1 && dt.getDate() === Number(d)
    setStatus(ok ? "default" : "error")
  }

  React.useEffect(() => {
    if (preset) {
      let result: string | null = null
      const now = new Date()
      switch (preset) {
        case "today": result = now.toISOString().slice(0, 10); break
        case "yesterday": {
          const d = new Date(now); d.setDate(d.getDate() - 1); result = d.toISOString().slice(0, 10); break
        }
        default: {
          const match = preset.match(/^(\d+)d$/)
          if (match) {
            const d = new Date(now); d.setDate(d.getDate() - Number(match[1])); result = d.toISOString().slice(0, 10)
          }
        }
      }
      if (result) onValueChange?.(result)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preset])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    validate(val)
    onValueChange?.(val)
  }

  return (
    <div className={cn("relative", className)} data-invalid={status === "error" || undefined}>
      <Input
        type="date"
        value={value}
        onChange={handleChange}
        inputSize={inputSize}
        className={cn(
          "[&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-60 [&::-webkit-calendar-picker-indicator]:hover:opacity-100",
          status === "error" && "border-destructive ring-3 ring-destructive/20 dark:border-destructive/50",
          status === "warning" && "border-amber-500/60 ring-3 ring-amber-500/15"
        )}
        {...props}
      />
    </div>
  )
}

/* ── TimeInput ───────────────────────────────────────────────────── */

export interface TimeInputProps extends Omit<React.ComponentProps<"input">, "value" | "defaultValue" | "onChange"> {
  value?: string
  onValueChange?: (value: string) => void
  inputSize?: "sm" | "default" | "lg"
}

function TimeInput({ value, onValueChange, inputSize = "default", className, ...props }: TimeInputProps) {
  return (
    <div className={cn("relative", className)}>
      <Input
        type="time"
        value={value}
        onChange={(e) => { onValueChange?.(e.target.value) }}
        inputSize={inputSize}
        className="[&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-60 [&::-webkit-calendar-picker-indicator]:hover:opacity-100 tabular-nums"
        {...props}
      />
      <CalendarIcon className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground hidden" />
    </div>
  )
}

export { DateInput, TimeInput }