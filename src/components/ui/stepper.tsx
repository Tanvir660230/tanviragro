"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { CheckIcon } from "lucide-react"

export interface StepperProps {
  steps: { label: string; description?: string }[]
  activeStep: number
  orientation?: "horizontal" | "vertical"
  onStepClick?: (index: number) => void
  size?: "sm" | "default" | "lg"
  className?: string
  completedColorByStep?: boolean
}

function Stepper({
  steps, activeStep, orientation = "horizontal", onStepClick,
  size = "default", className,
}: StepperProps) {
  const isHorizontal = orientation === "horizontal"
  const circleSize = { sm: "h-5 w-5 text-[10px]", default: "h-7 w-7 text-xs", lg: "h-9 w-9 text-sm" }[size]
  const lineSize = { sm: "h-0.5", default: "h-0.5", lg: "h-1" }[size]

  return (
    <ol
      data-slot="stepper"
      aria-label="Stepper"
      className={cn(
        "flex",
        isHorizontal ? "w-full items-center" : "flex-col gap-2",
        className
      )}
    >
      {steps.map((step, idx) => {
        const isComplete = idx < activeStep
        const isActive = idx === activeStep
        const isClickable = !!onStepClick

        return (
          <React.Fragment key={step.label}>
            <li
              className={cn(
                "flex items-center gap-2.5",
                isHorizontal && "flex-1 min-w-0 flex-col text-center"
              )}
            >
              <button
                type="button"
                disabled={!isClickable || isComplete}
                onClick={() => isClickable && onStepClick(idx)}
                className={cn(
                  "flex flex-col items-center gap-1.5 outline-none select-none",
                  isHorizontal && "w-full",
                  isClickable && !isActive && "cursor-pointer"
                )}
                aria-current={isActive ? "step" : undefined}
              >
                <span
                  className={cn(
                    "flex items-center justify-center rounded-full border font-semibold transition-all duration-200 shrink-0",
                    circleSize,
                    isComplete && "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
                    isActive && "border-primary bg-primary text-primary-foreground shadow-sm",
                    !isComplete && !isActive && "border-border bg-card text-muted-foreground"
                  )}
                >
                  {isComplete ? <CheckIcon className={cn(size === "sm" ? "h-3 w-3" : "h-4 w-4")} /> : idx + 1}
                </span>
                <span className={cn("flex flex-col", isHorizontal ? "items-center" : "items-start")}>
                  <span className={cn(
                    "font-heading font-semibold leading-tight",
                    size === "sm" ? "text-[11px]" : "text-xs",
                    isActive ? "text-foreground" : isComplete ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"
                  )}>
                    {step.label}
                  </span>
                  {step.description && (
                    <span className={cn("text-[11px] text-muted-foreground leading-tight", size === "sm" && "hidden")}>
                      {step.description}
                    </span>
                  )}
                </span>
              </button>
            </li>
            {idx < steps.length - 1 && (
              <li
                aria-hidden="true"
                className={cn(
                  isHorizontal ? "flex-1 min-w-[24px]" : "ml-3.5 -my-0.5 shrink-0",
                  lineSize
                )}
              >
                <span className={cn(
                  "block h-full w-full rounded-full transition-colors duration-300",
                  isHorizontal ? lineSize : "w-0.5 min-h-[16px]",
                  isHorizontal ? (idx < activeStep ? "bg-emerald-500/60" : "bg-border") : ""
                )} />
              </li>
            )}
          </React.Fragment>
        )
      })}
    </ol>
  )
}

export { Stepper }