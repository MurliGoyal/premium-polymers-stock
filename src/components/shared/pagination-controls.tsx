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
  const start = itemCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, itemCount);

  return (
    <div className="flex flex-col gap-3 border-t px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-xs text-muted-foreground">
        Showing {start}-{end} of {itemCount}
      </p>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
        >
          <ChevronLeft className="h-4 w-4" />
          Previous
        </Button>
        <div className="rounded-lg border px-3 py-1.5 text-xs font-medium text-muted-foreground">
          Page {page} of {pageCount}
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= pageCount}
        >
          Next
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
