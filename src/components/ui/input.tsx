import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"

import { cn } from "@/lib/utils"

export interface InputProps extends React.ComponentProps<"input"> {
  startAdornment?: React.ReactNode
  endAdornment?: React.ReactNode
  inputSize?: "sm" | "default" | "lg"
}

const sizeClasses = {
  sm: "h-8 px-2.5 text-xs rounded-md",
  default: "h-9 px-3 text-sm rounded-lg min-h-[36px]",
  lg: "h-11 px-3.5 text-base rounded-xl min-h-[44px]",
}

function Input({
  className,
  type,
  startAdornment,
  endAdornment,
  inputSize = "default",
  ...props
}: InputProps) {
  if (startAdornment || endAdornment) {
    return (
      <div
        className={cn(
          "relative flex items-center w-full transition-colors rounded-lg border border-input bg-card/60 focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/30 dark:bg-card/40 dark:border-border",
          props.disabled && "opacity-50 cursor-not-allowed bg-muted/40",
          className
        )}
      >
        {startAdornment && (
          <div className="flex items-center justify-center pl-3 pr-1 text-muted-foreground shrink-0 select-none">
            {startAdornment}
          </div>
        )}
        <InputPrimitive
          type={type}
          data-slot="input"
          className={cn(
            "w-full min-w-0 bg-transparent py-1 text-foreground placeholder:text-muted-foreground outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:cursor-not-allowed",
            sizeClasses[inputSize],
            startAdornment && "pl-1.5",
            endAdornment && "pr-1.5"
          )}
          {...props}
        />
        {endAdornment && (
          <div className="flex items-center justify-center pr-3 pl-1 text-muted-foreground shrink-0 select-none">
            {endAdornment}
          </div>
        )}
      </div>
    )
  }

  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        "w-full min-w-0 border border-input bg-card/60 text-foreground transition-all duration-150 outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-muted/40 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:bg-card/40 dark:border-border dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
        sizeClasses[inputSize],
        className
      )}
      {...props}
    />
  )
}

export { Input }
