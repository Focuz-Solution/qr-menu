"use client";

import { useTranslations } from "next-intl";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

// Grey placeholders shaped like each page while its data loads (used by the loading.tsx files).
// They copy the real layouts (AGENTS.md → Admin UI patterns), so nothing jumps when the page arrives.

/** wrapper: screen readers hear "Loading…" once; the grey shapes themselves are hidden from them */
export function Loading({ className, children }: { className?: string; children: React.ReactNode }) {
  const t = useTranslations("common");
  return (
    <div role="status" aria-live="polite" aria-busy className={className}>
      <span className="sr-only">{t("loading")}</span>
      <div aria-hidden className="contents">{children}</div>
    </div>
  );
}

// ---------- admin ----------

/** title + subtitle on the left; search box and/or main button on the right */
export function HeaderSkeleton({ search, button }: { search?: boolean; button?: boolean }) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-3">
      <div className="flex min-w-0 flex-col gap-2">
        <Skeleton className="h-8 w-40 md:h-9" />
        <Skeleton className="h-4 w-56 max-w-full" />
      </div>
      {button && <Skeleton className="ml-auto h-8 w-28 rounded-full" />}
      {search && <Skeleton className={cn("h-11 w-full max-w-md rounded-full sm:min-w-48 sm:flex-1", !button && "ml-auto")} />}
    </div>
  );
}

/** the row of number cards (Orders) */
export function StatsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
      {Array.from({ length: count }, (_, i) => (
        <Card key={i} className="gap-2 px-4 py-3">
          <Skeleton className="h-6 w-16" />
          <Skeleton className="h-3 w-24" />
        </Card>
      ))}
    </div>
  );
}

/** underline filter tabs (+ an optional select at the end) */
export function TabsSkeleton({ tabs = 5, select }: { tabs?: number; select?: boolean }) {
  return (
    <div className="mb-3 flex items-center gap-2 shadow-[inset_0_-1px_0_var(--border)]">
      <div className="flex min-w-0 flex-1 gap-2 overflow-hidden">
        {Array.from({ length: tabs }, (_, i) => (
          <div key={i} className="flex h-12 shrink-0 items-center px-4">
            <Skeleton className="h-4 w-16" />
          </div>
        ))}
      </div>
      {select && <Skeleton className="h-9 w-28 shrink-0 rounded-full" />}
    </div>
  );
}

/** a column of the table: `hide` = hidden on phones (md) or until large screens (lg); `end` = numbers on the right */
export type SkeletonColumn = { width?: string; hide?: "md" | "lg"; end?: boolean; avatar?: boolean };
const hidden = (c: SkeletonColumn) => (c.hide === "md" ? "hidden md:table-cell" : c.hide === "lg" ? "hidden lg:table-cell" : "");

/** data table inside its card: grey header row + `rows` rows of bars */
export function TableSkeleton({ columns, rows = 8, card = true }: { columns: SkeletonColumn[]; rows?: number; card?: boolean }) {
  const table = (
    <Table>
      <TableHeader className="bg-muted/50">
        <TableRow className="hover:bg-transparent">
          {columns.map((c, i) => (
            <TableHead key={i} className={cn("h-11", i === 0 && "pl-4", i === columns.length - 1 && "pr-4", hidden(c))}>
              <Skeleton className={cn("h-3 w-14 bg-foreground/10", c.end && "ml-auto")} />
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {Array.from({ length: rows }, (_, r) => (
          <TableRow key={r} className="h-14 hover:bg-transparent">
            {columns.map((c, i) => (
              <TableCell key={i} className={cn(i === 0 && "pl-4", i === columns.length - 1 && "pr-4", hidden(c))}>
                <div className={cn("flex items-center gap-3", c.end && "justify-end")}>
                  {c.avatar && <Skeleton className="size-9 shrink-0 rounded-lg" />}
                  {/* rows get slightly different lengths so it reads as text, not a grid */}
                  <Skeleton className={cn("h-4", c.width ?? "w-20")} style={{ maxWidth: `${100 - ((r * 7 + i * 13) % 30)}%` }} />
                </div>
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
  return card ? <Card className="gap-0 overflow-hidden py-0">{table}</Card> : table;
}

/** "Showing 1–20 of …" on the left, page + ‹ › on the right */
export function PagerSkeleton() {
  return (
    <div className="mt-3 flex items-center justify-between gap-3">
      <Skeleton className="h-4 w-36" />
      <div className="flex items-center gap-2">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="size-8 rounded-md" />
        <Skeleton className="size-8 rounded-md" />
      </div>
    </div>
  );
}

/** header + table + pager: the usual list page (Delivery, Users…) */
export function ListPageSkeleton({ columns, search, button = true, rows }: { columns: SkeletonColumn[]; search?: boolean; button?: boolean; rows?: number }) {
  return (
    <Loading>
      <HeaderSkeleton search={search} button={button} />
      <TableSkeleton columns={columns} rows={rows} />
      <PagerSkeleton />
    </Loading>
  );
}

/** a form card: optional title, then label + input pairs (two per row from sm) */
export function FormCardSkeleton({ fields = 4, title = true, className }: { fields?: number; title?: boolean; className?: string }) {
  return (
    <Card className={cn("gap-5 p-4 md:p-5", className)}>
      {title && (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-5 w-36" />
          <Skeleton className="h-3 w-56 max-w-full" />
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        {Array.from({ length: fields }, (_, i) => (
          <div key={i} className="flex flex-col gap-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-11 w-full rounded-full" />
          </div>
        ))}
      </div>
    </Card>
  );
}

/** a few lines of text (card bodies) */
export function LinesSkeleton({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-2.5", className)}>
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} className="h-4" style={{ width: `${90 - ((i * 17) % 40)}%` }} />
      ))}
    </div>
  );
}

// ---------- shop ----------

/** sticky header: logo, running text, search + bag */
export function ShopHeaderSkeleton() {
  return (
    <div className="-mx-4 flex items-center justify-between gap-2 px-4 py-2">
      <Skeleton className="size-14 rounded-full" />
      <Skeleton className="mx-4 h-4 max-w-60 flex-1" />
      <div className="flex gap-1">
        <Skeleton className="size-11 rounded-full" />
        <Skeleton className="size-11 rounded-full" />
      </div>
    </div>
  );
}

/** product cards: photo + two lines of name + price */
export function ProductGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-x-3 gap-y-5 md:grid-cols-3 lg:grid-cols-4">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="flex flex-col gap-2">
          <Skeleton className="aspect-[1/1.05] w-full rounded-3xl" />
          <div className="flex flex-col gap-1.5 px-1">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="mt-1 h-5 w-16" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** shop home: header, search, category circles, product grid */
export function CatalogueSkeleton() {
  return (
    <Loading>
      <ShopHeaderSkeleton />
      <Skeleton className="mt-2 h-11 w-full rounded-xl" />
      <div className="grid grid-cols-4 gap-x-2 gap-y-4 pt-4 md:grid-cols-6 lg:grid-cols-8">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className={cn("flex flex-col items-center gap-1.5", i >= 4 && "hidden md:flex", i >= 6 && "md:hidden lg:flex")}>
            <Skeleton className="aspect-square w-full rounded-full" />
            <Skeleton className="h-3 w-3/4" />
          </div>
        ))}
      </div>
      <Skeleton className="mt-8 mb-4 h-6 w-40" />
      <ProductGridSkeleton />
    </Loading>
  );
}

/** product page (copies ProductView + Gallery): back button, photo with the thumbnail column on desktop,
 *  then brand, name, price, option pills, add button and the description */
export function ProductSkeleton() {
  return (
    <Loading className="relative pb-6">
      {/* back button: over the photo on phones, its own row on desktop */}
      <div className="absolute inset-x-0 top-0 z-10 pt-3 md:static md:pb-4">
        <Skeleton className="size-9 rounded-full bg-background/80 md:bg-muted" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] md:items-start md:gap-8">
        <div className="-mx-4 md:mx-0 md:flex md:gap-4">
          <div className="hidden w-20 shrink-0 flex-col items-center gap-3 md:flex">
            <Skeleton className="size-11 rounded-full" />
            {Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="aspect-square w-full rounded-lg" />)}
            <Skeleton className="size-11 rounded-full" />
          </div>
          <Skeleton className="aspect-square rounded-none md:flex-1 md:rounded-lg" />
        </div>
        {/* phones: white sheet with round top over the photo, like the real page */}
        <div className="relative -mx-4 -mt-6 flex flex-col gap-3 rounded-t-3xl bg-background px-4 pt-6 md:mx-0 md:mt-0 md:rounded-none md:px-0 md:pt-0">
          <Skeleton className="h-6 w-28" />
          <div className="flex flex-col gap-2">
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-6 w-2/3" />
          </div>
          <Skeleton className="h-8 w-28" />
          <div className="flex flex-col gap-2 pt-1">
            <Skeleton className="h-4 w-16" />
            <div className="flex flex-wrap gap-2">
              {["w-20", "w-24", "w-16"].map((w) => <Skeleton key={w} className={cn("h-9 rounded-full", w)} />)}
            </div>
          </div>
          <Skeleton className="mt-2 h-12 w-full rounded-full" />
          <div className="flex flex-col gap-3 pt-4">
            <Skeleton className="h-5 w-32" />
            <LinesSkeleton lines={4} />
          </div>
        </div>
      </div>
    </Loading>
  );
}

/** checkout: order lines + the form on the left, the summary on the right */
export function CheckoutSkeleton() {
  const box = "flex flex-col gap-4 rounded-2xl border p-4";
  return (
    <Loading>
      {/* back button + title (the real page has no shop header) */}
      <div className="flex items-center gap-2 py-3">
        <Skeleton className="size-9 rounded-full" />
        <Skeleton className="h-7 w-40" />
      </div>
      <div className="mt-1 grid gap-6 md:grid-cols-[1fr_320px] md:items-start">
        <div className="flex flex-col gap-6">
          <div className={box}>
            {Array.from({ length: 2 }, (_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="size-16 rounded-xl" />
                <div className="flex flex-1 flex-col gap-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-16" />
                </div>
                <Skeleton className="h-9 w-24 rounded-full" />
              </div>
            ))}
          </div>
          <div className={box}>
            <Skeleton className="h-5 w-32" />
            <div className="grid gap-4 sm:grid-cols-2">
              {Array.from({ length: 6 }, (_, i) => (
                <div key={i} className="flex flex-col gap-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-11 w-full rounded-full" />
                </div>
              ))}
            </div>
          </div>
        </div>
        {/* summary: first on phones, beside the form on desktop (like the real page) */}
        <div className={cn(box, "order-first md:order-none")}>
          <Skeleton className="h-5 w-28" />
          <LinesSkeleton lines={3} />
          <Skeleton className="hidden h-12 w-full rounded-full md:block" />
        </div>
        <Skeleton className="h-12 w-full rounded-full md:hidden" />
      </div>
    </Loading>
  );
}
