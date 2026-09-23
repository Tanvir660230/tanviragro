"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { XIcon, PlusIcon, SearchIcon } from "lucide-react"

export interface TagPickerOption {
  value: string
  label: string
}

export interface TagPickerProps {
  options: TagPickerOption[]
  value: string[]
  onValueChange: (values: string[]) => void
  placeholder?: string
  maxTags?: number
  disabled?: boolean
  className?: string
  allowCustom?: boolean
}

function TagPicker({
  options, value = [], onValueChange, placeholder = "Add tag...",
  maxTags, disabled = false, className, allowCustom = false,
}: TagPickerProps) {
  const [search, setSearch] = React.useState("")
  const [open, setOpen] = React.useState(false)
  const containerRef = React.useRef<HTMLDivElement>(null)
  const inputRef = React.useRef<HTMLInputElement>(null)

  const filtered = React.useMemo(() => {
    const lower = search.toLowerCase()
    return options.filter(o => o.label.toLowerCase().includes(lower) && !value.includes(o.value))
  }, [options, value, search])

  const addTag = (val: string) => {
    if (maxTags && value.length >= maxTags) return
    if (!value.includes(val)) onValueChange([...value, val])
    setSearch("")
    inputRef.current?.focus()
  }

  const removeTag = (val: string) => onValueChange(value.filter(v => v !== val))

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && search && allowCustom) {
      e.preventDefault()
      addTag(search)
    } else if (e.key === "Backspace" && !search && value.length > 0) {
      removeTag(value[value.length - 1])
    }
  }

  React.useEffect(() => {
    if (!open) return
    const h = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", h)
    return () => document.removeEventListener("mousedown", h)
  }, [open])

  const selectedLabels = React.useMemo(() => {
    const map = new Map(options.map(o => [o.value, o.label]))
    return value.map(v => ({ value: v, label: map.get(v) ?? v }))
  }, [value, options])

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <div
        className={cn(
          "flex flex-wrap items-center gap-1 min-h-[36px] rounded-lg border border-input bg-card/60 px-2.5 py-1.5 cursor-text transition-colors",
          "focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/30",
          disabled && "opacity-50 cursor-not-allowed",
          "dark:bg-card/40 dark:border-border"
        )}
        onClick={() => !disabled && inputRef.current?.focus()}
      >
        {selectedLabels.map(tag => (
          <span key={tag.value} className="inline-flex items-center gap-1 rounded-md bg-secondary text-secondary-foreground border border-border/60 px-2 py-0.5 text-xs font-medium animate-in fade-in-0 zoom-in-95">
            <span className="truncate max-w-[100px]">{tag.label}</span>
            {!disabled && (
              <button type="button" onClick={(e) => { e.stopPropagation(); removeTag(tag.value) }}
                className="rounded-full hover:bg-foreground/10 p-0.5 cursor-pointer" aria-label={`Remove ${tag.label}`}>
                <XIcon className="h-2.5 w-2.5" />
              </button>
            )}
          </span>
        ))}
        <div className="relative flex-1 min-w-[100px]">
          <input ref={inputRef} type="text" value={search} disabled={disabled}
            onChange={e => { setSearch(e.target.value); setOpen(true) }}
            onFocus={() => setOpen(true)}
            onKeyDown={handleKeyDown}
            placeholder={selectedLabels.length === 0 ? placeholder : ""}
            className="w-full bg-transparent text-xs outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed"
          />
        </div>
      </div>
      {open && !disabled && (
        <div className="absolute z-50 mt-1 w-full rounded-lg bg-popover border border-border shadow-dropdown overflow-hidden animate-in fade-in-0 zoom-in-95">
          <div className="max-h-48 overflow-y-auto p-1">
            {allowCustom && search && !filtered.some(o => o.label.toLowerCase() === search.toLowerCase()) && (
              <button type="button" onClick={() => { addTag(search); setOpen(false) }}
                className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-xs font-medium text-primary hover:bg-accent cursor-pointer">
                <PlusIcon className="h-3 w-3" /> Create &quot;{search}&quot;
              </button>
            )}
            {filtered.length === 0 && !search && <div className="px-3 py-4 text-center text-xs text-muted-foreground">No tags available</div>}
            {filtered.length === 0 && search && !allowCustom && <div className="px-3 py-4 text-center text-xs text-muted-foreground">No matching tags</div>}
            {filtered.map(opt => (
              <button key={opt.value} type="button" onClick={() => { addTag(opt.value); setOpen(false) }}
                className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-xs font-medium hover:bg-accent cursor-pointer">
                <PlusIcon className="h-3 w-3 text-muted-foreground" />
                <span className="truncate">{opt.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export { TagPicker }