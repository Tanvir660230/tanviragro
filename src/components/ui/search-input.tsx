"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { SearchIcon, XIcon, Loader2Icon } from "lucide-react"

export interface SearchInputProps extends Omit<React.ComponentProps<"input">, "onChange" | "size"> {
  value?: string
  onValueChange?: (value: string) => void
  placeholder?: string
  loading?: boolean
  inputSize?: "sm" | "default" | "lg"
  clearable?: boolean
  containerClassName?: string
}

function SearchInput({
  value,
  onValueChange,
  placeholder = "Search...",
  loading = false,
  inputSize = "default",
  clearable = true,
  disabled,
  className,
  containerClassName,
  ...props
}: SearchInputProps) {
  const sizeClasses = {
    sm: "h-8 text-xs",
    default: "h-9 text-sm",
    lg: "h-11 text-base",
  }
  const [internalValue, setInternalValue] = React.useState("")
  const isControlled = value !== undefined
  const currentValue = isControlled ? value : internalValue

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    if (!isControlled) setInternalValue(val)
    onValueChange?.(val)
  }

  const clear = () => {
    if (!isControlled) setInternalValue("")
    onValueChange?.("")
  }

  return (
    <div className={cn("relative w-full", containerClassName)}>
      <SearchIcon className={cn(
        "absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none shrink-0",
        inputSize === "sm" ? "h-3.5 w-3.5" : "h-4 w-4"
      )} />
      <input
        data-slot="search-input"
        type="search"
        value={currentValue}
        onChange={handleChange}
        disabled={disabled}
        placeholder={placeholder}
        {...props}
        className={cn(
          "w-full rounded-lg border border-input bg-card/60 pl-8 pr-9 outline-none transition-colors",
          "placeholder:text-muted-foreground",
          "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30",
          "disabled:cursor-not-allowed disabled:opacity-50",
          "dark:bg-card/40 dark:border-border",
          "[&::-webkit-search-cancel-button]:hidden",
          sizeClasses[inputSize],
          className
        )}
      />
      <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
        {loading && <Loader2Icon className="h-3.5 w-3.5 text-muted-foreground animate-spin" />}
        {clearable && currentValue && !loading && (
          <button
            type="button"
            onClick={clear}
            aria-label="Clear search"
            disabled={disabled}
            className="rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer"
          >
            <XIcon className={inputSize === "sm" ? "h-3 w-3" : "h-3.5 w-3.5"} />
          </button>
        )}
      </div>
    </div>
  )
}

export { SearchInput }