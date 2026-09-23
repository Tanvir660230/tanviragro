/**
 * Tanvir Agro ERP — Shared Hooks Barrel
 * Centralised re-exports so pages import from "@/hooks".
 */

export { useMediaQuery, useIsMobile, useIsTablet, useIsDesktop, useIsLargeScreen, usePrefersReducedMotion, useIsDarkMode } from "./use-media-query"
export { useFocusTrap } from "./use-focus-trap"
export { useDebounce } from "./use-debounce"
export { useOffline } from "./useOffline"
export { PageVisitTracker } from "./use-page-tracking"
export { ScrollRestoration } from "./use-scroll-restoration"
export { usePersistentState, usePersistentStateWithActions, type PersistentStateActions } from "./use-persistent-state"
export { useUndoStack, type UndoEntry } from "./use-undo-stack"
export { useVirtualList, type VirtualListOptions, type VirtualListResult } from "./use-virtual-list"
export { useKeyboardNavGrid, type KeyboardNavGridOptions, type KeyboardNavResult } from "./use-keyboard-nav"
export { useSearchHistory, type SearchHistoryEntry, type SearchHistoryActions } from "./use-search-history"
