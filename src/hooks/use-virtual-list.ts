"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface VirtualListOptions {
  /**
   * Total number of rows in the dataset.
   */
  itemCount: number;
  /**
   * Height of one row in px.
   */
  itemHeight: number;
  /**
   * Estimated viewport height in px (default 500).
   */
  viewportHeight?: number;
  /**
   * Rows rendered above/below the visible window ("overscan").
   */
  overscan?: number;
}

export interface VirtualListResult {
  /** Index of the first rendered row. */
  startIndex: number;
  /** Index one past the last rendered row. */
  endIndex: number;
  /** List of row indices that should be rendered. */
  visibleIndices: number[];
  /** Absolute top offset (px) for the spacer element. */
  totalHeight: number;
  /** Pixel offset to apply to the inner window. */
  offsetY: number;
  /** Scroll container callback to attach via `ref`. */
  containerRef: React.RefObject<HTMLDivElement | null>;
  /** Call programmatically to jump to a row index. */
  scrollToIndex: (index: number) => void;
  /** Re-measure when container size changes. */
  measure: () => void;
}

/**
 * `useVirtualList` — lightweight windowing hook for large datasets.
 *
 * Renders only the rows visible inside a fixed-height scroll container plus a
 * configurable overscan, keeping DOM size constant regardless of data size.
 */
export function useVirtualList({
  itemCount,
  itemHeight,
  viewportHeight = 500,
  overscan = 8,
}: VirtualListOptions): VirtualListResult {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [measuredHeight, setMeasuredHeight] = useState(viewportHeight);

  const onScroll = useCallback(() => {
    const el = containerRef.current;
    if (el) setScrollTop(el.scrollTop);
  }, []);

  const measure = useCallback(() => {
    const el = containerRef.current;
    if (el) setMeasuredHeight(el.clientHeight || viewportHeight);
  }, [viewportHeight]);

  useEffect(() => {
    measure();
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener("scroll", onScroll, { passive: true });
    const ro = new ResizeObserver(() => measure());
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", onScroll);
      ro.disconnect();
    };
  }, [measure, onScroll]);

  useEffect(() => {
    const el = containerRef.current;
    if (el) setMeasuredHeight(el.clientHeight || viewportHeight);
  }, [viewportHeight]);

  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
  const endIndex = Math.min(itemCount, Math.ceil((scrollTop + measuredHeight) / itemHeight) + overscan);

  const visibleIndices = useRef<number[]>([]);
  visibleIndices.current = [];
  for (let i = startIndex; i < endIndex; i++) visibleIndices.current.push(i);

  const scrollToIndex = useCallback(
    (index: number) => {
      const el = containerRef.current;
      if (!el) return;
      el.scrollTop = Math.max(0, index * itemHeight);
      setScrollTop(el.scrollTop);
    },
    [itemHeight]
  );

  return {
    startIndex,
    endIndex,
    visibleIndices: visibleIndices.current,
    totalHeight: itemCount * itemHeight,
    offsetY: startIndex * itemHeight,
    containerRef,
    scrollToIndex,
    measure,
  };
}