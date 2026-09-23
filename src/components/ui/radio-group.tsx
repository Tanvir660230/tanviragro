import * as React from "react"
import { cn } from "@/lib/utils"

/* ── RadioGroup Context ─────────────────────────────────────────────── */

interface RadioGroupContextType {
  value?: string
  onValueChange?: (value: string) => void
  name?: string
  disabled?: boolean
}

const RadioGroupContext = React.createContext<RadioGroupContextType>({})

/* ── RadioGroup ─────────────────────────────────────────────────────── */

interface RadioGroupProps extends React.ComponentProps<"div"> {
  value?: string
  defaultValue?: string
  onValueChange?: (value: string) => void
  name?: string
  disabled?: boolean
  orientation?: "horizontal" | "vertical"
}

function RadioGroup({
  className,
  orientation = "vertical",
  ...props
}: RadioGroupProps) {
  return (
    <RadioGroupContext.Provider
      value={{
        value: props.value,
        onValueChange: props.onValueChange,
        name: props.name,
        disabled: props.disabled,
      }}
    >
      <div
        role="radiogroup"
        data-slot="radio-group"
        className={cn(
          "grid gap-2",
          orientation === "horizontal" && "grid-flow-col",
          className
        )}
        {...props}
      />
    </RadioGroupContext.Provider>
  )
}

/* ── RadioGroupItem (individual radio button) ──────────────────────── */

interface RadioGroupItemProps extends Omit<React.ComponentProps<"button">, "value"> {
  value: string
  id?: string
}

function RadioGroupItem({
  value: itemValue,
  id,
  className,
  disabled: itemDisabled,
  ...props
}: RadioGroupItemProps) {
  const ctx = React.useContext(RadioGroupContext)
  const isChecked = ctx.value === itemValue
  const isDisabled = itemDisabled || ctx.disabled
  const generatedId = React.useId()
  const itemId = id || `radio-${generatedId}`

  return (
    <button
      id={itemId}
      type="button"
      role="radio"
      aria-checked={isChecked}
      aria-disabled={isDisabled || undefined}
      disabled={isDisabled}
      data-slot="radio-group-item"
      data-state={isChecked ? "checked" : "unchecked"}
      onClick={() => !isDisabled && ctx.onValueChange?.(itemValue)}
      className={cn(
        "group flex items-center gap-2.5 rounded-lg border border-border/70 bg-card px-3 py-2.5 text-sm font-medium text-foreground",
        "transition-all duration-150 cursor-pointer",
        "outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-offset-1 focus-visible:ring-offset-background",
        isChecked && "border-primary/40 bg-primary/5 shadow-xs",
        isDisabled && "opacity-50 cursor-not-allowed",
        className
      )}
      {...props}
    >
      {/* Radio indicator circle */}
      <span
        aria-hidden="true"
        className={cn(
          "relative flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-all",
          isChecked
            ? "border-primary bg-primary"
            : "border-muted-foreground/40 group-hover:border-muted-foreground/70"
        )}
      >
        {isChecked && (
          <span className="h-1.5 w-1.5 rounded-full bg-primary-foreground" />
        )}
      </span>
      {props.children}
    </button>
  )
}

export { RadioGroup, RadioGroupItem }
