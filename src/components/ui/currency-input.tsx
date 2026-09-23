"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"

/* ── CurrencyInput ───────────────────────────────────────────────── */

export interface CurrencyInputProps extends Omit<React.ComponentProps<"input">, "onChange" | "value" | "onValueChange"> {
  value?: number | string
  onValueChange?: (value: number | null) => void
  currency?: string
  locale?: string
  allowNegative?: boolean
  maxDecimals?: number
  inputSize?: "sm" | "default" | "lg"
}

function CurrencyInput({
  value,
  onValueChange,
  currency = "$",
  locale = "en-IN",
  allowNegative = false,
  maxDecimals = 2,
  inputSize = "default",
  disabled,
  className,
  placeholder,
  ...props
}: CurrencyInputProps) {
  const [focused, setFocused] = React.useState(false)
  const [text, setText] = React.useState<string>("")

  React.useEffect(() => {
    if (focused) return
    const num = typeof value === "string" ? parseFloat(value) : value
    if (num != null && !isNaN(num)) {
      try {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setText(new Intl.NumberFormat(locale, { maximumFractionDigits: maxDecimals }).format(num))
      } catch {
        setText(String(num))
      }
    } else {
      setText("")
    }
  }, [value, focused, locale, maxDecimals])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let raw = e.target.value
    // Strip currency symbols and group separators, keep digits, minus, dot
    raw = raw.replace(/[^\d.\-]/g, "")

    if (!allowNegative) raw = raw.replace("-", "")

    // Allow only one dot
    const firstDot = raw.indexOf(".")
    const [intPart, ...rest] = raw.split(".")
    const afterDot = rest.join("").slice(0, maxDecimals)
    raw = rest.length > 0 ? `${intPart}.${afterDot}` : intPart

    setText(raw)
    const num = raw === "" || raw === "-" ? null : parseFloat(raw)
    onValueChange?.(num)
  }

  const handleBlur = () => {
    setFocused(false)
    const num = typeof value === "string" ? parseFloat(value) : value
    if (num != null && !isNaN(num)) {
      try {
        setText(new Intl.NumberFormat(locale, { maximumFractionDigits: maxDecimals }).format(num))
      } catch {
        setText(String(num))
      }
    }
  }

  return (
    <Input
      inputMode="decimal"
      value={text}
      onChange={handleChange}
      onBlur={handleBlur}
      onFocus={() => setFocused(true)}
      disabled={disabled}
      placeholder={placeholder}
      inputSize={inputSize}
      startAdornment={<span className="text-xs font-semibold text-muted-foreground">{currency}</span>}
      className={cn("tabular-nums", className)}
      {...props}
    />
  )
}

export { CurrencyInput }