import * as React from "react"
import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"
import { Loader2 } from "lucide-react"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-lg border font-medium whitespace-nowrap transition-all duration-150 outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/35 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 cursor-pointer",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground shadow-xs hover:bg-primary/90 hover:shadow-card active:bg-primary/95 font-semibold",
        outline:
          "border-border/80 bg-card/60 text-foreground hover:bg-muted/80 hover:text-foreground hover:border-border active:bg-muted dark:border-border dark:bg-card/40 dark:hover:bg-muted/40",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80 active:bg-secondary/90",
        ghost:
          "border-transparent bg-transparent text-foreground hover:bg-muted/70 hover:text-foreground active:bg-muted/90 dark:hover:bg-muted/40",
        soft:
          "border-transparent bg-primary/10 text-primary hover:bg-primary/15 active:bg-primary/20 font-medium",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground shadow-xs hover:bg-destructive/90 active:bg-destructive/95 font-semibold",
        destructiveOutline:
          "border-destructive/30 bg-destructive/5 text-destructive hover:bg-destructive/15 hover:border-destructive/50 active:bg-destructive/20 font-medium",
        success:
          "border-transparent bg-success text-success-foreground shadow-xs hover:bg-success/90 active:bg-success/95 font-semibold",
        link:
          "border-transparent bg-transparent text-primary underline-offset-4 hover:underline p-0 h-auto font-normal",
      },
      size: {
        default:
          "h-9 gap-2 px-3.5 sm:px-4 text-sm min-h-[36px]",
        xs:
          "h-6 gap-1 rounded-md px-2 text-xs min-h-[24px] [&_svg:not([class*='size-'])]:size-3",
        sm:
          "h-8 gap-1.5 rounded-lg px-3 text-xs min-h-[32px] font-medium [&_svg:not([class*='size-'])]:size-3.5",
        lg:
          "h-10 gap-2 rounded-xl px-4.5 sm:px-5 text-sm font-semibold min-h-[40px] [&_svg:not([class*='size-'])]:size-4.5",
        xl:
          "h-11 gap-2.5 rounded-xl px-5.5 sm:px-6 text-base font-semibold min-h-[44px] [&_svg:not([class*='size-'])]:size-5",
        icon:
          "size-9 rounded-lg p-0",
        "icon-xs":
          "size-6 rounded-md p-0 [&_svg:not([class*='size-'])]:size-3",
        "icon-sm":
          "size-8 rounded-lg p-0 [&_svg:not([class*='size-'])]:size-3.5",
        "icon-lg":
          "size-10 rounded-xl p-0 [&_svg:not([class*='size-'])]:size-5",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends ButtonPrimitive.Props,
    VariantProps<typeof buttonVariants> {
  loading?: boolean
}

function Button({
  className,
  variant = "default",
  size = "default",
  loading = false,
  disabled,
  children,
  ...props
}: ButtonProps) {
  return (
    <ButtonPrimitive
      data-slot="button"
      disabled={disabled || loading}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    >
      {loading ? (
        <>
          <Loader2 className="animate-spin text-current" />
          <span className="opacity-75">{children}</span>
        </>
      ) : (
        children
      )}
    </ButtonPrimitive>
  )
}

export { Button, buttonVariants }
