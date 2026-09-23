"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { ChevronDownIcon, CheckIcon, XIcon, SearchIcon } from "lucide-react"

export interface MultiSelectOption {
  value: string
  label: string
  disabled?: boolean
}

export interface MultiSelectProps {
  options: MultiSelectOption[]
  value: string[]
  onValueChange: (values: string[]) => void
  placeholder?: string
  searchPlaceholder?: string
  disabled?: boolean
  className?: string
  maxItems?: number
  size?: "sm" | "default" | "lg"
}

function MultiSelect({
  options, value = [], onValueChange, placeholder = "Select...",
  searchPlaceholder = "Search...", disabled = false, className,
  maxItems, size = "default",
}: MultiSelectProps) {
  const [open, setOpen] = React.useState(false)
  const [search, setSearch] = React.useState("")
  const containerRef = React.useRef<HTMLDivElement>(null)
  const searchRef = React.useRef<HTMLInputElement>(null)

  const sizeClasses = { sm: "h-8 text-xs", default: "h-9 text-sm", lg: "h-11 text-base" }

  const filtered = React.useMemo(() => {
    if (!search) return options
    const lower = search.toLowerCase()
    return options.filter(o => o.label.toLowerCase().includes(lower))
  }, [options, search])

  const selectedLabels = React.useMemo(() => options.filter(o => value.includes(o.value)), [options, value])

  const toggle = React.useCallback((val: string) => {
    const next = value.includes(val) ? value.filter(v => v !== val) : [...value, val]
    if (maxItems && next.length > maxItems) return
    onValueChange(next)
  }, [value, onValueChange, maxItems])

  const remove = React.useCallback((val: string) => onValueChange(value.filter(v => v !== val)), [value, onValueChange])

  React.useEffect(() => {
    if (!open) return
    const h = (e: MouseEvent) => { if (containerRef.current && !containerRef.current.contains(e.target as Node)) { setOpen(false); setSearch("") } }
    document.addEventListener("mousedown", h)
    return () => document.removeEventListener("mousedown", h)
  }, [open])

  React.useEffect(() => { if (open) searchRef.current?.focus() }, [open])

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <button type="button" disabled={disabled} onClick={() => setOpen(!open)}
        className={cn("flex w-full items-center justify-between gap-1.5 rounded-lg border border-input bg-card/60 px-2.5 text-left outline-none transition-colors cursor-pointer",
          sizeClasses[size], "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30",
          "disabled:cursor-not-allowed disabled:opacity-50 dark:bg-card/40 dark:border-border", open && "border-ring ring-3 ring-ring/30")}>
        <div className="flex flex-1 flex-wrap items-center gap-1 min-w-0">
          {selectedLabels.length === 0 && <span className="text-muted-foreground truncate">{placeholder}</span>}
          {selectedLabels.map(o => (
            <span key={o.value} className="inline-flex items-center gap-1 rounded-md bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 text-xs font-medium">
              <span className="truncate max-w-[120px]">{o.label}</span>
              <button type="button" onClick={(e) => { e.stopPropagation(); remove(o.value) }}
                className="rounded-full hover:bg-primary/20 p-0.5 cursor-pointer" aria-label={`Remove ${o.label}`}>
                <XIcon className="h-2.5 w-2.5" />
              </button>
            </span>
          ))}
        </div>
        <ChevronDownIcon className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-full min-w-[200px] rounded-lg bg-popover border border-border shadow-dropdown overflow-hidden animate-in fade-in-0 zoom-in-95">
          <div className="p-1.5 border-b border-border/60">
            <div className="relative">
              <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input ref={searchRef} type="text" value={search} onChange={e => setSearch(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full h-8 rounded-md bg-muted/40 border-0 pl-8 pr-2 text-xs outline-none placeholder:text-muted-foreground" />
            </div>
          </div>
          <div className="max-h-60 overflow-y-auto p-1">
            {filtered.length === 0 && <div className="px-3 py-4 text-center text-xs text-muted-foreground">No options found</div>}
            {filtered.map(opt => {
              const sel = value.includes(opt.value)
              return (
                <button key={opt.value} type="button" disabled={opt.disabled} onClick={() => toggle(opt.value)}
                  className={cn("flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-xs font-medium outline-none cursor-pointer transition-colors hover:bg-accent",
                    sel && "bg-primary/8 text-primary", opt.disabled && "opacity-50 cursor-not-allowed")}>
                  <span className={cn("flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border transition-all",
                    sel ? "bg-primary border-primary text-primary-foreground" : "border-muted-foreground/40")}>
                    {sel && <CheckIcon className="h-3 w-3" />}
                  </span>
                  <span className="truncate">{opt.label}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

export { MultiSelect }