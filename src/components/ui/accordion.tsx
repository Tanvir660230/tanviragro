"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { ChevronDown } from "lucide-react"

interface AccordionContextType {
  openItems: Set<string>
  toggle: (id: string) => void
  type: "single" | "multiple"
}

const AccordionContext = React.createContext<AccordionContextType>({
  openItems: new Set(),
  toggle: () => {},
  type: "single",
})

function Accordion({
  type = "single",
  children,
  className,
  ...props
}: React.ComponentProps<"div"> & { type?: "single" | "multiple" }) {
  const [openItems, setOpenItems] = React.useState<Set<string>>(new Set())

  const toggle = React.useCallback((id: string) => {
    setOpenItems((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        if (type === "single") next.clear()
        next.add(id)
      }
      return next
    })
  }, [type])

  return (
    <AccordionContext.Provider value={{ openItems, toggle, type }}>
      <div data-slot="accordion" className={cn("space-y-1", className)} {...props}>
        {children}
      </div>
    </AccordionContext.Provider>
  )
}

function AccordionItem({
  id,
  children,
  className,
  ...props
}: React.ComponentProps<"div"> & { id: string }) {
  const { openItems } = React.useContext(AccordionContext)
  const isOpen = openItems.has(id)

  return (
    <div
      data-slot="accordion-item"
      data-state={isOpen ? "open" : "closed"}
      className={cn(
        "rounded-xl border border-border/70 bg-card overflow-hidden transition-all duration-200",
        isOpen && "shadow-card",
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}

function AccordionTrigger({
  id,
  children,
  className,
  icon: Icon,
  ...props
}: React.ComponentProps<"button"> & {
  id: string
  icon?: React.ComponentType<{ className?: string }>
}) {
  const { openItems, toggle } = React.useContext(AccordionContext)
  const isOpen = openItems.has(id)

  return (
    <button
      type="button"
      data-slot="accordion-trigger"
      data-state={isOpen ? "open" : "closed"}
      onClick={() => toggle(id)}
      className={cn(
        "flex w-full items-center justify-between gap-3 p-4 text-sm font-semibold text-foreground",
        "text-left cursor-pointer transition-colors hover:bg-muted/40",
        "outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
        className
      )}
      aria-expanded={isOpen}
      {...props}
    >
      <div className="flex items-center gap-2.5 min-w-0 flex-1">
        {Icon && (
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary border border-primary/20">
            <Icon className="h-3.5 w-3.5" />
          </div>
        )}
        {children}
      </div>
      <ChevronDown
        className={cn(
          "h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200",
          isOpen && "rotate-180"
        )}
      />
    </button>
  )
}

function AccordionContent({
  children,
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="accordion-content"
      className={cn(
        "overflow-hidden data-[state=closed]:animate-out data-[state=closed]:fade-out-0",
        "data-[state=open]:animate-in data-[state=open]:fade-in-0",
        className
      )}
      {...props}
    >
      <div className="px-4 pb-4 pt-0 text-sm text-muted-foreground">
        {children}
      </div>
    </div>
  )
}

export { Accordion, AccordionItem, AccordionTrigger, AccordionContent }
