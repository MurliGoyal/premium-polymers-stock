"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

type PaginationControlsProps = {
  page: number;
  pageCount: number;
  itemCount: number;
  pageSize: number;
  onPageChange: (page: number) => void;
};

export function PaginationControls({
  page,
  pageCount,
  itemCount,
  pageSize,
  onPageChange,
}: PaginationControlsProps) {
  if (itemCount === 0) {
    return null;
  }

  const start = itemCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, itemCount);

  return (
    <div className="flex flex-col gap-3 border-t border-white/8 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-center text-xs text-muted-foreground sm:text-left">
        Showing {start}-{end} of {itemCount}
      </p>
      <div className="flex items-center justify-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="min-w-[44px]"
        >
          <ChevronLeft className="h-4 w-4" />
          <span className="hidden min-[420px]:inline">Previous</span>
        </Button>
        <div className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-medium text-muted-foreground">
          {page} / {pageCount}
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= pageCount}
          className="min-w-[44px]"
        >
          <span className="hidden min-[420px]:inline">Next</span>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
