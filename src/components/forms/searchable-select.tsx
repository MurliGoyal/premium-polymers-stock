"use client";

import { useDeferredValue, useMemo, useState } from "react";
import { Check, ChevronsUpDown, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export type SearchableOption = {
  value: string;
  label: string;
  description?: string;
};

type SearchableSelectProps = {
  ariaLabel?: string;
  ariaRequired?: boolean;
  disabled?: boolean;
  emptyState?: string;
  error?: boolean;
  onChange: (value: string) => void;
  options: SearchableOption[];
  placeholder: string;
  searchPlaceholder?: string;
  value?: string;
};

export function SearchableSelect({
  ariaLabel,
  ariaRequired,
  disabled,
  emptyState = "No options found",
  error,
  onChange,
  options,
  placeholder,
  searchPlaceholder = "Search...",
  value,
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);

  const selectedOption = options.find((option) => option.value === value);
  const filteredOptions = useMemo(() => {
    if (!deferredQuery.trim()) {
      return options;
    }

    const normalizedQuery = deferredQuery.toLowerCase();
    return options.filter((option) =>
      [option.label, option.description]
        .filter(Boolean)
        .some((candidate) => candidate?.toLowerCase().includes(normalizedQuery))
    );
  }, [deferredQuery, options]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-invalid={error}
          aria-label={ariaLabel}
          aria-required={ariaRequired}
          disabled={disabled}
          className={cn(
            "h-11 w-full justify-between rounded-2xl px-4 font-normal",
            error && "border-destructive"
          )}
        >
          <span className={cn("truncate", !selectedOption && "text-muted-foreground")}>
            {selectedOption?.label ?? placeholder}
          </span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] p-0">
        <div className="border-b border-white/8 p-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              autoFocus
              className="h-10 border-0 bg-transparent pl-9 shadow-none focus-visible:ring-0"
              onChange={(event) => setQuery(event.target.value)}
              placeholder={searchPlaceholder}
              value={query}
            />
          </div>
        </div>
        <div className="max-h-64 overflow-y-auto p-1">
          {filteredOptions.length === 0 ? (
            <div className="px-3 py-6 text-center text-sm text-muted-foreground">{emptyState}</div>
          ) : (
            filteredOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                  setQuery("");
                }}
                className={cn(
                  "flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-accent hover:text-accent-foreground",
                  option.value === value && "bg-accent text-accent-foreground"
                )}
              >
                <Check
                  className={cn(
                    "mt-0.5 h-4 w-4 shrink-0 text-primary opacity-0",
                    option.value === value && "opacity-100"
                  )}
                />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{option.label}</p>
                  {option.description ? (
                    <p className="mt-0.5 text-xs text-muted-foreground">{option.description}</p>
                  ) : null}
                </div>
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
