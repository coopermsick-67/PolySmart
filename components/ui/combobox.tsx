"use client";

import * as React from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { Check, ChevronDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ComboboxOption {
  value: string;
  label: string;
}

/**
 * Searchable single-select dropdown. Unlike the plain Select, this filters
 * options as you type and scrolls a bounded list instead of clipping it —
 * meant for fields whose option list can grow long (e.g. categories).
 */
export function Combobox({
  value,
  onValueChange,
  options,
  placeholder = "Search…",
  className,
  triggerClassName,
}: {
  value: string;
  onValueChange: (value: string) => void;
  options: ComboboxOption[];
  placeholder?: string;
  className?: string;
  triggerClassName?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, query]);

  const selectedLabel = options.find((o) => o.value === value)?.label ?? value;

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) setQuery("");
  }

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={handleOpenChange}>
      <PopoverPrimitive.Trigger asChild>
        <button
          type="button"
          className={cn(
            "flex h-8 items-center justify-between gap-2 rounded-md border border-neutral-700 bg-neutral-900 px-3 text-xs text-neutral-100 focus:outline-none focus:ring-2 focus:ring-emerald-500",
            triggerClassName,
          )}
        >
          <span className="truncate">{selectedLabel}</span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-60" />
        </button>
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align="start"
          sideOffset={4}
          className={cn(
            "z-50 flex w-48 flex-col overflow-hidden rounded-md border border-neutral-700 bg-neutral-900 text-neutral-100 shadow-lg",
            className,
          )}
        >
          <div className="flex items-center gap-1.5 border-b border-neutral-800 px-2">
            <Search className="h-3.5 w-3.5 shrink-0 text-neutral-500" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={placeholder}
              className="h-8 w-full bg-transparent text-xs text-neutral-100 placeholder:text-neutral-500 focus:outline-none"
            />
          </div>
          <div className="max-h-60 overflow-y-auto p-1">
            {filtered.length === 0 && (
              <div className="px-2 py-3 text-center text-xs text-neutral-500">No matches</div>
            )}
            {filtered.map((option) => {
              const isSelected = option.value === value;
              return (
                <button
                  type="button"
                  key={option.value}
                  onClick={() => {
                    onValueChange(option.value);
                    handleOpenChange(false);
                  }}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-xs outline-none hover:bg-neutral-800 focus:bg-neutral-800",
                    isSelected && "text-emerald-400",
                  )}
                >
                  <Check className={cn("h-3.5 w-3.5 shrink-0", !isSelected && "opacity-0")} />
                  <span className="truncate">{option.label}</span>
                </button>
              );
            })}
          </div>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
