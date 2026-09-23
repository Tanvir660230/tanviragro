"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import type { LucideIcon } from "lucide-react"
import { ChevronRightIcon } from "lucide-react"

export interface TreeNode {
  id: string
  label: string
  icon?: LucideIcon
  children?: TreeNode[]
  disabled?: boolean
  badge?: React.ReactNode
  data?: unknown
}

export interface TreeViewProps {
  data: TreeNode[]
  selectedId?: string
  onSelect?: (id: string) => void
  defaultExpandedIds?: string[]
  expandedIds?: string[]
  onExpandedChange?: (ids: string[]) => void
  className?: string
}

function TreeView({
  data, selectedId, onSelect, defaultExpandedIds = [], expandedIds: controlled,
  onExpandedChange, className,
}: TreeViewProps) {
  const [internalExpanded, setInternalExpanded] = React.useState<Set<string>>(new Set(defaultExpandedIds))
  const expanded = controlled ? new Set(controlled) : internalExpanded

  const toggle = (id: string) => {
    if (controlled) {
      const next = new Set(controlled)
      if (next.has(id)) next.delete(id); else next.add(id)
      onExpandedChange?.(Array.from(next))
      return
    }
    setInternalExpanded(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const renderNode = (node: TreeNode, depth: number) => {
    const Icon = node.icon
    const hasChildren = !!node.children?.length
    const isExpanded = expanded.has(node.id)
    const isSelected = selectedId === node.id

    return (
      <div key={node.id} role="treeitem" aria-expanded={hasChildren ? isExpanded : undefined} aria-selected={isSelected} style={{ paddingLeft: depth * 16 }}>
        <div
          data-selected={isSelected || undefined}
          className={cn(
            "group flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm outline-none cursor-pointer transition-colors",
            "hover:bg-muted/60 focus-visible:ring-3 focus-visible:ring-ring/30",
            isSelected && "bg-primary/8 text-primary hover:bg-primary/10"
          )}
          onClick={() => {
            onSelect?.(node.id)
            if (hasChildren) toggle(node.id)
          }}
        >
          <span className={cn(
            "flex h-4 w-4 shrink-0 items-center justify-center rounded transition-transform",
            hasChildren ? "text-muted-foreground" : "pointer-events-none"
          )}>
            {hasChildren && <ChevronRightIcon className={cn("h-3.5 w-3.5 transition-transform duration-150", isExpanded && "rotate-90")} />}
          </span>
          {Icon && <Icon className="h-4 w-4 shrink-0 text-muted-foreground group-data-[selected]:text-primary" />}
          <span className={cn("truncate", node.disabled && "opacity-50")}>{node.label}</span>
          {node.badge && <span className="ml-auto shrink-0">{node.badge}</span>}
        </div>
        {hasChildren && isExpanded && (
          <div role="group" className="mt-0.5 space-y-0.5">
            {node.children!.map(child => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div data-slot="tree-view" role="tree" className={cn("space-y-0.5 text-sm", className)}>
      {data.map(node => renderNode(node, 0))}
    </div>
  )
}

export { TreeView }