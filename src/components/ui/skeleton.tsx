import * as React from "react"
import { cn } from "@/lib/utils"

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="skeleton"
      className={cn(
        "animate-shimmer rounded-lg bg-muted/60 dark:bg-muted/40",
        className
      )}
      {...props}
    />
  )
}

export { Skeleton }