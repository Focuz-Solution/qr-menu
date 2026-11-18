"use client";

import { GripVertical, ImageOff, Pencil, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Img } from "@/components/Img";
import { Pager, paginate } from "@/components/Pager";
import { type Sort, SortHead } from "@/components/SortHead";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatPrice, thumbUrl } from "@/lib/shop";
import { cn } from "@/lib/utils";
import type { AdminItem } from "./types";

const money = (cents: number) => formatPrice(cents / 100);

function Thumb({ item, className }: { item: AdminItem; className: string }) {
  const fallback = <ImageOff className="absolute inset-0 m-auto size-6 text-muted-foreground/40" aria-hidden />;
  return item.image ? (
    <Img src={thumbUrl(item.image)} alt={item.name} sizes="(min-width: 1024px) 200px, 45vw" className={className} fallback={fallback} />
  ) : (
    <div className={cn("relative bg-foreground/5", className)}>{fallback}</div>
  );
}

const PAGE_SIZE = 10;
type SortKey = "order" | "name" | "price" | "stock" | "shown";
const compare: Record<SortKey, (a: AdminItem, b: AdminItem) => number> = {
  order: () => 0, // items come in shop order; a stable sort keeps it
  name: (a, b) => a.name.localeCompare(b.name),
  price: (a, b) => a.priceCents - b.priceCents,
  stock: (a, b) => Number(a.isAvailable) - Number(b.isAvailable),
  shown: (a, b) => Number(a.isVisible) - Number(b.isVisible),
};

/** products of the selected category as a table (AGENTS.md → Admin UI patterns): sort, pages, quick switches */
export function ProductTable({ items, pending, onEdit, onFlag, onDelete, onReorder }: {
  items: AdminItem[];
  pending: boolean;
  onReorder: (ids: string[]) => void;
  onEdit: (item: AdminItem) => void;
  onFlag: (id: string, patch: { isAvailable?: boolean; isVisible?: boolean }) => void;
  onDelete: (item: AdminItem) => void;
}) {
  const t = useTranslations("admin.menu");
  // default = shop order, where rows can be dragged; sorting by a column hides the handles until its 3rd click
  const [sort, setSort] = useState<Sort<SortKey>>({ key: "order", desc: false });
  const [page, setPage] = useState(0);
  const shopOrder = sort.key === "order";
  const [dragOrder, setDragOrder] = useState<string[] | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const ordered = dragOrder ? dragOrder.map((id) => items.find((i) => i.id === id)!).filter(Boolean) : items;
  const sorted = ordered.toSorted((a, b) => (sort.desc ? -1 : 1) * compare[sort.key](a, b));
  const ids = items.map((i) => i.id);
  const move = (order: string[], id: string, to: number) => {
    const from = order.indexOf(id);
    if (from < 0 || to < 0 || to >= order.length || from === to) return order;
    const next = [...order];
    next.splice(to, 0, ...next.splice(from, 1));
    return next;
  };
  const endDrag = (save: boolean) => {
    if (save && dragOrder && dragOrder.join() !== ids.join()) onReorder(dragOrder);
    setDragId(null);
    setDragOrder(null);
  };
  const { pages, current, rows } = paginate(sorted, page, PAGE_SIZE);
  const onSort = (key: SortKey) => {
    setSort((s) => (s.key !== key ? { key, desc: true } : s.desc ? { key, desc: false } : { key: "order", desc: false }));
    setPage(0);
  };

  return (
    <>
      <Table>
        <TableHeader className="bg-muted/50 [&_th]:h-11 [&_th]:text-xs [&_th]:font-medium [&_th]:text-muted-foreground">
          <TableRow className="hover:bg-transparent">
            <TableHead className="w-10 pr-0 pl-2" />
            <SortHead k="name" sort={sort} onSort={onSort} className="w-[34%] pl-1">{t("colProduct")}</SortHead>
            <SortHead k="price" sort={sort} onSort={onSort} className="w-[18%]">{t("colPrice")}</SortHead>
            <SortHead k="stock" sort={sort} onSort={onSort} className="hidden w-[16%] pl-8 sm:table-cell">{t("inStock")}</SortHead>
            <SortHead k="shown" sort={sort} onSort={onSort} className="w-[14%] pl-4">{t("colShown")}</SortHead>
            <TableHead className="pr-4 text-right">{t("actions")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((item) => (
            <TableRow
              key={item.id}
              data-item={item.id}
              className={cn(
                "h-16 hover:bg-transparent",
                (!item.isAvailable || !item.isVisible) && "opacity-60",
                dragId === item.id && "relative z-10 bg-background opacity-100 shadow-md",
              )}
            >
              {/* drag handle (shop order only): mouse + touch via pointer events (saved on release), keyboard via ↑/↓ */}
              <TableCell className="w-10 pr-0 pl-2">
                {shopOrder && items.length > 1 && (
                  <button
                    type="button"
                    aria-label={t("reorder", { name: item.name })}
                    disabled={pending}
                    className="flex size-10 cursor-grab touch-none items-center justify-center rounded-md text-muted-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50 active:cursor-grabbing"
                    onPointerDown={(e) => {
                      e.currentTarget.setPointerCapture(e.pointerId);
                      setDragId(item.id);
                      setDragOrder(ids);
                    }}
                    onPointerMove={(e) => {
                      if (dragId !== item.id || !dragOrder) return;
                      const over = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>("[data-item]")?.dataset.item;
                      if (over && over !== item.id) setDragOrder(move(dragOrder, item.id, dragOrder.indexOf(over)));
                    }}
                    onPointerUp={() => endDrag(true)}
                    onPointerCancel={() => endDrag(false)}
                    onKeyDown={(e) => {
                      const d = e.key === "ArrowUp" ? -1 : e.key === "ArrowDown" ? 1 : 0;
                      if (!d) return;
                      e.preventDefault();
                      const order = move(ids, item.id, ids.indexOf(item.id) + d);
                      if (order !== ids) onReorder(order);
                    }}
                  >
                    <GripVertical className="size-4" aria-hidden />
                  </button>
                )}
              </TableCell>
              <TableCell className="max-w-0 pl-1">
                <div className="flex items-center gap-3">
                  <Thumb item={item} className="size-10 shrink-0 rounded-md" />
                  <div className="min-w-0">
                    <p className="truncate font-medium">{item.name}</p>
                    {item.brand && <p className="truncate text-xs text-muted-foreground">{item.brand}</p>}
                  </div>
                </div>
              </TableCell>
              <TableCell className="tabular-nums">
                {item.compareAtCents && <span className="mr-1.5 text-xs text-destructive line-through">{money(item.compareAtCents)}</span>}
                <span className="font-medium">{money(item.priceCents)}</span>
              </TableCell>
              {/* switches change the product without opening the editor */}
              <TableCell className="hidden pl-8 sm:table-cell">
                <Switch
                  checked={item.isAvailable}
                  disabled={pending}
                  aria-label={`${t("inStock")}: ${item.name}`}
                  onCheckedChange={(isAvailable) => onFlag(item.id, { isAvailable })}
                />
              </TableCell>
              <TableCell className="pl-4">
                <Switch
                  checked={item.isVisible}
                  disabled={pending}
                  aria-label={`${t("visible")}: ${item.name}`}
                  onCheckedChange={(isVisible) => onFlag(item.id, { isVisible })}
                />
              </TableCell>
              <TableCell className="pr-4">
                <div className="flex items-center justify-end gap-0.5">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="rounded-md text-muted-foreground hover:text-foreground"
                    onClick={() => onEdit(item)}
                    aria-label={`${t("edit")}: ${item.name}`}
                    title={t("edit")}
                  >
                    <Pencil aria-hidden />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="rounded-md text-destructive/80 hover:bg-destructive/10 hover:text-destructive"
                    disabled={pending}
                    onClick={() => onDelete(item)}
                    aria-label={`${t("delete")}: ${item.name}`}
                    title={t("delete")}
                  >
                    <Trash2 aria-hidden />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <div className="border-t px-4 pb-3">
        <Pager page={current} pages={pages} size={PAGE_SIZE} shown={rows.length} total={sorted.length} onPage={setPage} />
      </div>
    </>
  );
}
