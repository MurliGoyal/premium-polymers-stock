"use client";

import { SlidersHorizontal } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

type ResponsiveFiltersSheetProps = {
  activeCount?: number;
  children: React.ReactNode;
  description?: string;
  title?: string;
};

export function ResponsiveFiltersSheet({
  activeCount = 0,
  children,
  description = "Narrow down results using the options below.",
  title = "Filters",
}: ResponsiveFiltersSheetProps) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button type="button" variant="outline" className="w-full justify-between rounded-2xl sm:w-auto xl:hidden">
          <SlidersHorizontal className="h-4 w-4" />
          Filters
          {activeCount > 0 ? <Badge variant="secondary">{activeCount}</Badge> : null}
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="safe-bottom max-h-[88vh] overflow-y-auto">
        <SheetHeader className="mb-5 text-left">
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>{description}</SheetDescription>
        </SheetHeader>
        <div className="space-y-4">{children}</div>
      </SheetContent>
    </Sheet>
  );
}
