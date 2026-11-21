"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Page bar under an admin table: "Showing 1–20 of 57 · Page 1 of 3 ‹ ›" (AGENTS.md → Admin UI patterns). `page` is 0-based.
 * `dropTarget`: a row is being dragged — ‹ › are highlighted as places to hold it over (`data-pager` = "prev" / "next");
 * `armed`: the one it is held over right now (filled, bigger); `popPage`: the page number pops in when the page turns
 */
export function Pager({ page, pages, size, shown, total, onPage, dropTarget, armed, popPage }: {
  page: number;
  pages: number;
  size: number;
  shown: number;
  total: number;
  onPage: (page: number) => void;
  dropTarget?: boolean;
  armed?: "prev" | "next" | null;
  popPage?: boolean;
}) {
  // while dragging: each usable arrow = a target (white, outlined); the one held over = filled with the shop colour.
  // "!" so the button's own hover colour (the pointer is right on it) can't cover it
  const drop = (side: "prev" | "next") =>
    dropTarget &&
    cn(
      "transition-[scale,background-color,color,box-shadow] duration-150",
      armed === side
        ? "enabled:scale-125 enabled:border-primary! enabled:bg-primary! enabled:text-primary-foreground! enabled:shadow-lg enabled:ring-4 enabled:ring-primary/25"
        : "enabled:scale-110 enabled:border-primary/50 enabled:bg-background enabled:text-primary",
    );
  // the arrow's chevron nudges toward its side while dragging (only on arrows that can turn the page)
  const nudge = (side: "prev" | "next", usable: boolean) =>
    dropTarget && usable && cn("animate-nudge", side === "prev" ? "[--nudge:-3px]" : "[--nudge:3px]", armed === side && "[animation-duration:0.5s]");
  const t = useTranslations("admin.table");
  return (
    <nav aria-label={t("pages")} className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-sm text-muted-foreground">
      <p className="tabular-nums">{t("range", { from: shown ? page * size + 1 : 0, to: page * size + shown, total })}</p>
      {/* the arrows' box: while dragging, a dashed drop zone (border + padding cancelled by the negative margin: same size as before, nothing shifts) */}
      <div
        className={cn(
          "relative -mx-2.5 -my-1.5 flex items-center gap-2 rounded-xl border-2 border-dashed border-transparent px-2 py-1 transition-colors duration-200",
          dropTarget && "border-primary/40 bg-primary/5",
          dropTarget && armed && "border-primary bg-primary/10",
        )}
      >
        {/* held over an arrow: a small label above says where the product goes */}
        {dropTarget && armed && (
          <span
            role="status"
            className="pointer-events-none absolute right-0 bottom-full mb-2 rounded-full bg-foreground px-2.5 py-1 text-xs font-medium whitespace-nowrap text-background shadow-md duration-150 animate-in fade-in slide-in-from-bottom-1"
          >
            {t("dropTo", { page: armed === "prev" ? page : page + 2 })}
          </span>
        )}
        {/* keyed by the page: while dragging, the number pops in each time the page turns */}
        <span key={page} className={cn("mr-1 tabular-nums", popPage && "font-medium text-foreground duration-300 animate-in fade-in zoom-in-50")}>
          {t("pageOf", { page: page + 1, pages })}
        </span>
        <Button variant="outline" size="icon" data-pager="prev" className={cn("size-8 rounded-md", drop("prev"))} disabled={page === 0} onClick={() => onPage(page - 1)} aria-label={t("prev")}>
          <ChevronLeft aria-hidden className={cn(nudge("prev", page > 0))} />
        </Button>
        <Button variant="outline" size="icon" data-pager="next" className={cn("size-8 rounded-md", drop("next"))} disabled={page >= pages - 1} onClick={() => onPage(page + 1)} aria-label={t("next")}>
          <ChevronRight aria-hidden className={cn(nudge("next", page < pages - 1))} />
        </Button>
      </div>
    </nav>
  );
}

/** clamp the page to the list (filters can shrink it) and cut out that page's rows */
export function paginate<T>(list: T[], page: number, size: number) {
  const pages = Math.max(1, Math.ceil(list.length / size));
  const current = Math.min(page, pages - 1);
  return { pages, current, rows: list.slice(current * size, (current + 1) * size) };
}
