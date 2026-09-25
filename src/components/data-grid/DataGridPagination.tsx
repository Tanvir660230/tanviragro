"use client";

import { DataPagination } from "@/components/ui/data-pagination";

export interface DataGridPaginationProps {
  page: number; // 0-indexed
  pageSize: number;
  totalCount: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  pageSizeOptions?: number[];
  className?: string;
}

export function DataGridPagination({
  page,
  pageSize,
  totalCount,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 20, 50, 100],
  className,
}: DataGridPaginationProps) {
  if (totalCount === 0) return null;

  return (
    <div className={className}>
      <DataPagination
        page={page}
        pageSize={pageSize}
        total={totalCount}
        onPageChange={onPageChange}
        onPageSizeChange={onPageSizeChange || (() => {})}
        pageSizeOptions={pageSizeOptions}
      />
    </div>
  );
}
