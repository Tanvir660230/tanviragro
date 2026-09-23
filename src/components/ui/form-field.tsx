"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { AlertCircle, type LucideIcon } from "lucide-react"

/* ── FormField Context ───────────────────────────────────────────── */

interface FormFieldContextType {
  id: string
  disabled?: boolean
  error?: string
  required?: boolean
}

const FormFieldContext = React.createContext<FormFieldContextType>({
  id: "",
  disabled: false,
  error: undefined,
  required: false,
})

/* ── FormField (Root Wrapper) ────────────────────────────────────── */

export interface FormFieldProps extends React.ComponentProps<"div"> {
  id?: string
  disabled?: boolean
  error?: string
  required?: boolean
}

function FormField({
  id: externalId,
  disabled = false,
  error,
  required = false,
  className,
  children,
  ...props
}: FormFieldProps) {
  const generatedId = React.useId()
  const id = externalId || `field-${generatedId}`

  return (
    <FormFieldContext.Provider value={{ id, disabled, error, required }}>
      <div
        data-slot="form-field"
        data-disabled={disabled || undefined}
        data-invalid={!!error || undefined}
        className={cn("space-y-1.5", disabled && "opacity-50 pointer-events-none", className)}
        {...props}
      >
        {children}
      </div>
    </FormFieldContext.Provider>
  )
}

/* ── FormLabel ───────────────────────────────────────────────────── */

export interface FormLabelProps extends React.ComponentProps<"label"> {
  optional?: boolean
}

function FormLabel({ className, optional = false, children, ...props }: FormLabelProps) {
  const ctx = React.useContext(FormFieldContext)

  return (
    <label
      data-slot="form-label"
      htmlFor={ctx.id}
      className={cn(
        "flex items-center gap-1.5 text-sm font-medium leading-none text-foreground select-none",
        "peer-disabled:cursor-not-allowed peer-disabled:opacity-50",
        className
      )}
      {...props}
    >
      {children}
      {ctx.required && !optional && (
        <span className="text-destructive" aria-hidden="true">*</span>
      )}
      {optional && (
        <span className="text-xs text-muted-foreground font-normal">(optional)</span>
      )}
    </label>
  )
}

/* ── FormHint ────────────────────────────────────────────────────── */

function FormHint({ className, children, ...props }: React.ComponentProps<"p">) {
  if (!children) return null
  return (
    <p data-slot="form-hint" className={cn("text-xs text-muted-foreground leading-relaxed", className)} {...props}>
      {children}
    </p>
  )
}

/* ── FormError ───────────────────────────────────────────────────── */

function FormError({ className, children, ...props }: React.ComponentProps<"p">) {
  if (!children) return null
  return (
    <p
      data-slot="form-error"
      role="alert"
      className={cn("flex items-center gap-1.5 text-xs font-medium text-destructive leading-relaxed animate-fade-in", className)}
      {...props}
    >
      <AlertCircle className="h-3 w-3 shrink-0" />
      {children}
    </p>
  )
}

/* ── FormHelperText ──────────────────────────────────────────────── */

function FormHelperText({ className, icon: Icon, children, ...props }: React.ComponentProps<"p"> & { icon?: LucideIcon }) {
  if (!children) return null
  return (
    <p data-slot="form-helper-text" className={cn("flex items-start gap-1.5 text-xs text-muted-foreground leading-relaxed", className)} {...props}>
      {Icon && <Icon className="h-3.5 w-3.5 shrink-0 mt-0.5" />}
      {children}
    </p>
  )
}

/* ── CharacterCounter ────────────────────────────────────────────── */

export interface CharacterCounterProps {
  current: number
  max: number
  className?: string
  showWarning?: number
}

function CharacterCounter({ current, max, className, showWarning = 0.9 }: CharacterCounterProps) {
  const ratio = current / max
  const isWarning = ratio >= showWarning
  const isOver = current > max

  return (
    <span
      data-slot="character-counter"
      aria-live="polite"
      className={cn(
        "text-xs tabular-nums font-medium transition-colors",
        isOver ? "text-destructive" : isWarning ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground",
        className
      )}
    >
      {current}/{max}
    </span>
  )
}

/* ── RequiredIndicator ───────────────────────────────────────────── */

function RequiredIndicator({ className }: { className?: string }) {
  return (
    <span data-slot="required-indicator" aria-hidden="true" className={cn("text-destructive font-bold", className)}>
      *
    </span>
  )
}

/* ── FormSection ─────────────────────────────────────────────────── */

export interface FormSectionProps extends React.ComponentProps<"fieldset"> {
  title?: string
  description?: string
  icon?: LucideIcon
  actions?: React.ReactNode
  variant?: "default" | "card" | "flush"
}

function FormSection({ title, description, icon: Icon, actions, variant = "card", className, children, ...props }: FormSectionProps) {
  const variantStyles = {
    default: "p-0 border-0",
    card: "rounded-2xl bg-card border border-border/70 p-4 sm:p-6 shadow-xs",
    flush: "border-0 border-b border-border/60 p-0 pb-6",
  }

  return (
    <fieldset data-slot="form-section" className={cn(variantStyles[variant], className)} {...props}>
      {(title || description || actions) && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div className="space-y-0.5">
            {(title || Icon) && (
              <div className="flex items-center gap-2">
                {Icon && (
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary border border-primary/20 shrink-0">
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                )}
                {title && <legend className="text-sm font-semibold text-foreground font-heading">{title}</legend>}
              </div>
            )}
            {description && <p className="text-xs text-muted-foreground leading-relaxed pl-0 sm:pl-9">{description}</p>}
          </div>
          {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
        </div>
      )}
      <div className="space-y-4">{children}</div>
    </fieldset>
  )
}

/* ── FormGroup ───────────────────────────────────────────────────── */

export interface FormGroupProps extends React.ComponentProps<"div"> {
  columns?: 1 | 2 | 3
}

function FormGroup({ columns = 1, className, children, ...props }: FormGroupProps) {
  const colClasses = {
    1: "space-y-4",
    2: "grid grid-cols-1 sm:grid-cols-2 gap-4",
    3: "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4",
  }
  return (
    <div data-slot="form-group" className={cn(colClasses[columns], className)} {...props}>
      {children}
    </div>
  )
}

export { FormField, FormLabel, FormHint, FormError, FormHelperText, CharacterCounter, RequiredIndicator, FormSection, FormGroup }