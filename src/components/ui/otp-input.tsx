"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

export interface OtpInputProps {
  length?: number
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  autoFocus?: boolean
  className?: string
}

function OtpInput({ length = 6, value, onChange, disabled = false, autoFocus = true, className }: OtpInputProps) {
  const inputsRef = React.useRef<(HTMLInputElement | null)[]>([])
  const digits = value.split("")

  React.useEffect(() => {
    if (autoFocus && inputsRef.current[0]) {
      inputsRef.current[0].focus()
    }
  }, [autoFocus])

  const focusInput = (idx: number) => {
    const input = inputsRef.current[idx]
    if (input) { input.focus(); input.select() }
  }

  const handleChange = (idx: number, digit: string) => {
    if (disabled) return
    const cleaned = digit.replace(/\D/g, "").slice(0, 1)
    const next = digits.slice()
    next[idx] = cleaned
    const nextVal = next.join("")
    onChange(nextVal)
    if (cleaned && idx < length - 1) focusInput(idx + 1)
  }

  const handleKeyDown = (idx: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace") {
      if (!digits[idx] && idx > 0) {
        const next = digits.slice()
        next[idx - 1] = ""
        onChange(next.join(""))
        focusInput(idx - 1)
      } else {
        const next = digits.slice()
        next[idx] = ""
        onChange(next.join(""))
      }
      e.preventDefault()
    } else if (e.key === "ArrowLeft" && idx > 0) {
      focusInput(idx - 1)
      e.preventDefault()
    } else if (e.key === "ArrowRight" && idx < length - 1) {
      focusInput(idx + 1)
      e.preventDefault()
    } else if (e.key === "Enter") {
      // Allow form submission
    }
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault()
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, length)
    if (pasted) {
      onChange(pasted.padEnd(length, ""))
      const focusIdx = Math.min(pasted.length, length - 1)
      focusInput(focusIdx)
    }
  }

  return (
    <div data-slot="otp-input" role="group" aria-label={`One-time password, ${length} digits`} className={cn("flex items-center gap-2", className)}>
      {Array.from({ length }).map((_, idx) => (
        <React.Fragment key={idx}>
          <input
            ref={el => { inputsRef.current[idx] = el }}
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={1}
            disabled={disabled}
            value={digits[idx] ?? ""}
            onChange={e => handleChange(idx, e.target.value)}
            onKeyDown={e => handleKeyDown(idx, e)}
            onPaste={idx === 0 ? handlePaste : undefined}
            onFocus={e => e.target.select()}
            aria-label={`Digit ${idx + 1}`}
            className={cn(
              "w-10 h-12 text-center text-lg font-mono font-bold rounded-xl border border-input bg-card/60 outline-none transition-all duration-150",
              "focus:border-ring focus:ring-3 focus:ring-ring/30",
              "disabled:opacity-50 disabled:cursor-not-allowed",
              "dark:bg-card/40 dark:border-border",
              digits[idx] && "border-primary/50 bg-primary/5"
            )}
          />
          {idx === Math.floor(length / 2) - 1 && idx < length - 1 && (
            <span className="text-muted-foreground/40 select-none" aria-hidden="true">–</span>
          )}
        </React.Fragment>
      ))}
    </div>
  )
}

export { OtpInput }