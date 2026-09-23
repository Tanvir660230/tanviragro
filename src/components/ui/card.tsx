import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const cardVariants = cva(
  "group/card flex flex-col overflow-hidden text-sm text-card-foreground transition-all duration-200",
  {
    variants: {
      variant: {
        default:
          "rounded-xl bg-card border border-border/70 shadow-xs",
        interactive:
          "rounded-xl bg-card border border-border/70 shadow-xs hover:shadow-card-md hover:-translate-y-0.5 hover:border-border cursor-pointer active:translate-y-0",
        glass:
          "rounded-xl bg-card/80 backdrop-blur-xl border border-border/60 shadow-xs",
        subtle:
          "rounded-xl bg-muted/30 border border-border/50",
      },
      size: {
        default: "p-5 sm:p-6 gap-4 sm:gap-5",
        sm: "p-4 gap-3",
        lg: "p-6 sm:p-8 gap-5 sm:gap-6",
        none: "p-0 gap-0",
      }
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    }
  }
)

export interface CardProps
  extends React.ComponentProps<"div">,
    VariantProps<typeof cardVariants> {}

function Card({ className, variant, size, ...props }: CardProps) {
  return (
    <div
      data-slot="card"
      className={cn(cardVariants({ variant, size }), className)}
      {...props}
    />
  )
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-header"
      className={cn(
        "flex flex-col gap-1.5",
        className
      )}
      {...props}
    />
  )
}

function CardTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-title"
      className={cn(
        "font-heading text-base sm:text-lg font-semibold leading-snug tracking-tight text-foreground",
        className
      )}
      {...props}
    />
  )
}

function CardDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-description"
      className={cn("text-xs sm:text-sm text-muted-foreground leading-relaxed", className)}
      {...props}
    />
  )
}

function CardAction({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-action"
      className={cn(
        "ml-auto shrink-0",
        className
      )}
      {...props}
    />
  )
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-content"
      className={cn("flex-1", className)}
      {...props}
    />
  )
}

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-footer"
      className={cn(
        "flex items-center pt-4 border-t border-border/60 mt-auto",
        className
      )}
      {...props}
    />
  )
}

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardAction,
  CardDescription,
  CardContent,
  cardVariants,
}
