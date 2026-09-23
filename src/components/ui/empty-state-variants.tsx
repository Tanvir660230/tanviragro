"use client"

import * as React from "react"
import { EmptyState } from "@/components/shared/EmptyState"
import { SearchXIcon, ShieldXIcon, WifiOffIcon, PackageOpenIcon, RocketIcon, FileWarningIcon } from "lucide-react"

/* ── Preconfigured Empty-State variants ─────────────────────────── */

export interface EmptyStateVariantProps {
  title?: string
  description?: string
  action?: React.ReactNode
  secondaryAction?: React.ReactNode
  compact?: boolean
  className?: string
}

function EmptySearchState({
  title = "No results found",
  description = "Try adjusting your search or filters to find what you're looking for.",
  ...props
}: EmptyStateVariantProps) {
  return <EmptyState icon={SearchXIcon} title={title} description={description} {...props} />
}

function EmptyPermissionState({
  title = "No access",
  description = "You don't have permission to view this page. Contact your administrator.",
  ...props
}: EmptyStateVariantProps) {
  return <EmptyState icon={ShieldXIcon} title={title} description={description} {...props} />
}

function EmptyOfflineState({
  title = "You're offline",
  description = "Check your internet connection and try again. Changes will sync once you're back online.",
  ...props
}: EmptyStateVariantProps) {
  return <EmptyState icon={WifiOffIcon} title={title} description={description} {...props} />
}

function EmptyDataState({
  title = "No data yet",
  description = "Nothing has been recorded here yet. Add your first entry to get started.",
  ...props
}: EmptyStateVariantProps) {
  return <EmptyState icon={PackageOpenIcon} title={title} description={description} {...props} />
}

function EmptyFirstTimeState({
  title = "Welcome! Let's get started",
  description = "Set up your workspace in just a few steps. This shouldn't take long.",
  ...props
}: EmptyStateVariantProps) {
  return <EmptyState icon={RocketIcon} title={title} description={description} {...props} />
}

function EmptyErrorState({
  title = "Something went wrong",
  description = "We couldn't load this content. Please try again.",
  ...props
}: EmptyStateVariantProps) {
  return <EmptyState icon={FileWarningIcon} title={title} description={description} {...props} />
}

export {
  EmptySearchState,
  EmptyPermissionState,
  EmptyOfflineState,
  EmptyDataState,
  EmptyFirstTimeState,
  EmptyErrorState,
}