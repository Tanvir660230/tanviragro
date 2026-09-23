"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { cva, type VariantProps } from "class-variance-authority"
import { AlertCircleIcon, CheckCircle2Icon, InfoIcon, TriangleAlertIcon, XIcon, LightbulbIcon } from "lucide-react"

const alertVariants = cva(
  "relative flex w-full items-start gap-2.5 rounded-xl border px-3.5 py-3 text-sm leading-relaxed",
  {
    variants: {
      variant: {
        info: "border-blue-500/20 bg-blue-50/70 text-blue-900 dark:border-blue-500/30 dark:bg-blue-950/30 dark:text-blue-100",
        success: "border-emerald-500/20 bg-emerald-50/70 text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-950/30 dark:text-emerald-100",
        warning: "border-amber-500/20 bg-amber-50/70 text-amber-900 dark:border-amber-500/30 dark:bg-amber-950/30 dark:text-amber-100",
        destructive: "border-red-500/20 bg-red-50/70 text-red-900 dark:border-red-500/30 dark:bg-red-950/30 dark:text-red-100",
        neutral: "border-border/70 bg-muted/40 text-foreground dark:bg-muted/20",
      },
    },
    defaultVariants: { variant: "info" },
  }
)

const alertIconMap = {
  info: InfoIcon,
  success: CheckCircle2Icon,
  warning: TriangleAlertIcon,
  destructive: AlertCircleIcon,
  neutral: LightbulbIcon,
}

export interface AlertProps extends React.ComponentProps<"div">, VariantProps<typeof alertVariants> {
  title?: string
  onDismiss?: () => void
  action?: React.ReactNode
}

function Alert({ className, variant = "info", title, onDismiss, action, children, ...props }: AlertProps) {
  const Icon = alertIconMap[variant ?? "info"]
  return (
    <div data-slot="alert" role="alert" className={cn(alertVariants({ variant }), className)} {...props}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0 opacity-80" />
      <div className="min-w-0 flex-1 space-y-1">
        {title && <p className="text-sm font-semibold leading-snug">{title}</p>}
        <div className="text-[13px] opacity-90">{children}</div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss alert"
          className="shrink-0 rounded-md p-1 opacity-60 transition-opacity hover:opacity-100 hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer"
        >
          <XIcon className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  )
}

/* ── Banner (dismissible, full-width) ────────────────────────────── */

export interface BannerProps extends AlertProps {
  compact?: boolean
}

function Banner({ className, compact = false, variant = "info", ...props }: BannerProps) {
  return (
    <Alert
      data-slot="banner"
      variant={variant}
      className={cn("w-full rounded-lg", compact && "py-2", className)}
      {...props}
    />
  )
}

export { Alert, Banner }