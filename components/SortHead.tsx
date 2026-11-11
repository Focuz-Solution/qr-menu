"use client";

import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { TableHead } from "@/components/ui/table";
import { cn } from "@/lib/utils";

export type Sort<K extends string> = { key: K; desc: boolean };

/** Admin table column header that sorts on click: 1st click descending, 2nd ascending (AGENTS.md → Admin UI patterns). */
export function SortHead<K extends string>({ k, sort, onSort, className, children }: {
  k: K;
  sort: Sort<K>;
  onSort: (k: K) => void;
  className?: string;
  children: React.ReactNode;
}) {
  const on = sort.key === k;
  const Icon = !on ? ArrowUpDown : sort.desc ? ArrowDown : ArrowUp;
  return (
    <TableHead aria-sort={on ? (sort.desc ? "descending" : "ascending") : undefined} className={className}>
      <button
        type="button"
        onClick={() => onSort(k)}
        className={cn(
          "inline-flex min-h-11 items-center gap-1 rounded outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50",
          on && "text-foreground",
        )}
      >
        {children}
        <Icon className={cn("size-3.5", !on && "opacity-40")} aria-hidden />
      </button>
    </TableHead>
  );
}
