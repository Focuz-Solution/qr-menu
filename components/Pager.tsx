"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

/** Page bar under an admin table: "Showing 1–20 of 57 · Page 1 of 3 ‹ ›" (AGENTS.md → Admin UI patterns). `page` is 0-based. */
export function Pager({ page, pages, size, shown, total, onPage }: {
  page: number;
  pages: number;
  size: number;
  shown: number;
  total: number;
  onPage: (page: number) => void;
}) {
  const t = useTranslations("admin.table");
  return (
    <nav aria-label={t("pages")} className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-sm text-muted-foreground">
      <p className="tabular-nums">{t("range", { from: shown ? page * size + 1 : 0, to: page * size + shown, total })}</p>
      <div className="flex items-center gap-2">
        <span className="mr-1 tabular-nums">{t("pageOf", { page: page + 1, pages })}</span>
        <Button variant="outline" size="icon" className="size-8 rounded-md" disabled={page === 0} onClick={() => onPage(page - 1)} aria-label={t("prev")}>
          <ChevronLeft aria-hidden />
        </Button>
        <Button variant="outline" size="icon" className="size-8 rounded-md" disabled={page >= pages - 1} onClick={() => onPage(page + 1)} aria-label={t("next")}>
          <ChevronRight aria-hidden />
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
