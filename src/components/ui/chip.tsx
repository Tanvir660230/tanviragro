import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"

const chipVariants = cva(
  "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap transition-colors select-none",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary/10 text-primary",
        secondary: "border-transparent bg-secondary text-secondary-foreground",
        outline: "border-border text-foreground",
        ghost: "border-transparent bg-transparent text-muted-foreground hover:bg-muted",
        success: "border-emerald-500/20 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
        warning: "border-amber-500/20 bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300",
        destructive: "border-red-500/20 bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300",
        info: "border-blue-500/20 bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300",
      },
      size: {
        default: "h-5.5 px-2.5 text-xs",
        sm: "h-4.5 px-2 text-[11px]",
        lg: "h-6 px-3 text-xs",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  }
)

export interface ChipProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof chipVariants> {
  removable?: boolean
  onRemove?: () => void
}

function Chip({
  className,
  variant = "default",
  size = "default",
  removable = false,
  onRemove,
  children,
  ...props
}: ChipProps) {
  return (
    <span
      data-slot="chip"
      className={cn(chipVariants({ variant, size }), className)}
      {...props}
    >
      {children}
      {removable && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onRemove?.() }}
          className="ml-0.5 -mr-1 rounded-full p-0.5 hover:bg-foreground/10 cursor-pointer"
          aria-label="Remove"
        >
          <X className="h-2.5 w-2.5" />
        </button>
      )}
    </span>
  )
}

export { Chip, chipVariants }
