"use client";

import { Check, FolderPlus, GripVertical, ImageOff, ImagePlus, Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useOptimistic, useRef, useState, useTransition } from "react";
import { Img } from "@/components/Img";
import { Pager, paginate } from "@/components/Pager";
import { type Sort, SortHead } from "@/components/SortHead";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DeleteConfirmDialog } from "@/components/DeleteConfirmDialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { type DiscountType, salePrice, toCents } from "@/lib/money";
import { formatPrice, thumbUrl } from "@/lib/shop";
import type { ErrorCode, Result } from "@/lib/result";
import { formatBytes } from "@/lib/compress-image";
import { uploadImage } from "@/lib/upload-image";
import { cn, latinDigits } from "@/lib/utils";
import {
  createCategory,
  deleteCategory,
  deleteItem,
  reorderCategories,
  saveItem,
  reorderItems,
  setItemFlags,
  updateCategory,
} from "./actions";
import { DescriptionEditor } from "./DescriptionEditor";
import type { AdminCategory, AdminItem } from "./types";
import { Opt, Req } from "@/components/FieldMark";

const money = (cents: number) => formatPrice(cents / 100);

function Thumb({ item, className }: { item: AdminItem; className: string }) {
  const fallback = <ImageOff className="absolute inset-0 m-auto size-6 text-muted-foreground/40" aria-hidden />;
  return item.image ? (
    <Img src={thumbUrl(item.image)} alt={item.name} sizes="(min-width: 1024px) 200px, 45vw" className={className} fallback={fallback} />
  ) : (
    <div className={cn("relative bg-foreground/5", className)}>{fallback}</div>
  );
}

type CatChange = { order: string[] } | { id: string; patch: Partial<AdminCategory> };

const PAGE_SIZE = 20;
type SortKey = "order" | "name" | "price" | "stock" | "shown";
const compare: Record<SortKey, (a: AdminItem, b: AdminItem) => number> = {
  order: () => 0, // items come in shop order; a stable sort keeps it
  name: (a, b) => a.name.localeCompare(b.name),
  price: (a, b) => a.priceCents - b.priceCents,
  stock: (a, b) => Number(a.isAvailable) - Number(b.isAvailable),
  shown: (a, b) => Number(a.isVisible) - Number(b.isVisible),
};

/** products of the selected category as a table (AGENTS.md → Admin UI patterns): sort, pages, quick switches */
function ProductTable({ items, pending, onEdit, onFlag, onDelete, onReorder }: {
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
  // 1st click: descending, 2nd: ascending, 3rd: back to shop order (drag handles show again)
  const onSort = (key: SortKey) => {
    setSort((s) => (s.key !== key ? { key, desc: true } : s.desc ? { key, desc: false } : { key: "order", desc: false }));
    setPage(0);
  };

  return (
    <>
      <Table>
        <TableHeader className="bg-muted/50 [&_th]:h-11 [&_th]:text-xs [&_th]:font-medium [&_th]:text-muted-foreground">
          <TableRow className="hover:bg-transparent">
            {/* drag-handle column (no header) */}
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

/** one block of the product form (optional title; blocks are split by space, no lines) */
function Section({ title, children }: { title?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      {title && <h3 className="text-sm font-semibold">{title}</h3>}
      {children}
    </section>
  );
}

/** photo box: shows the photo (or an upload icon); tap to pick a new one */
function PhotoPick({ id, url, busy, label, onFile }: { id?: string; url: string; busy: boolean; label: string; onFile: (file: File | undefined) => void }) {
  return (
    <label
      title={label}
      className="flex size-full cursor-pointer items-center justify-center overflow-hidden rounded-lg border bg-muted/60 text-muted-foreground/60 hover:bg-muted hover:text-muted-foreground has-focus-visible:ring-3 has-focus-visible:ring-ring/50"
    >
      <input
        id={id}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        aria-label={label}
        onChange={(e) => {
          onFile(e.target.files?.[0]);
          e.target.value = ""; // picking the same file again still fires onChange
        }}
      />
      {busy ? (
        <Loader2 className="size-5 animate-spin" aria-hidden />
      ) : url ? (
        <Img src={thumbUrl(url)} alt="" sizes="80px" className="size-full" />
      ) : (
        <ImagePlus className="size-7" strokeWidth={1.5} aria-hidden />
      )}
    </label>
  );
}

function RemoveButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Button type="button" variant="secondary" size="icon-xs" className="absolute -top-1.5 -right-1.5 rounded-full shadow-sm" onClick={onClick} aria-label={label}>
      <X aria-hidden />
    </Button>
  );
}

export function MenuEditor({ categories, items }: { categories: AdminCategory[]; items: AdminItem[] }) {
  const t = useTranslations("admin.menu");
  const te = useTranslations("errors");
  const [pending, start] = useTransition();
  const [error, setError] = useState<ErrorCode | null>(null);

  // instant feedback; replaced by the server's data when the action finishes (or rolled back on error)
  const [cats, applyCat] = useOptimistic(categories, (state, change: CatChange) =>
    "order" in change
      ? change.order.map((id) => state.find((c) => c.id === id)!).filter(Boolean)
      : state.map((c) => (c.id === change.id ? { ...c, ...change.patch } : c)),
  );
  const [list, applyItem] = useOptimistic(items, (state, change: { id: string; patch: Partial<AdminItem> } | { order: string[] }) =>
    "order" in change
      ? // that category's products in the new order (after the rest; only the order within a category matters)
        [...state.filter((i) => !change.order.includes(i.id)), ...change.order.map((id) => state.find((i) => i.id === id)!).filter(Boolean)]
      : state.map((i) => (i.id === change.id ? { ...i, ...change.patch } : i)),
  );

  const [catId, setCatId] = useState(categories[0]?.id ?? "");
  const [editing, setEditing] = useState<AdminItem | "new" | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [deletingProduct, setDeletingProduct] = useState<AdminItem | null>(null);
  const [productDeleteError, setProductDeleteError] = useState<ErrorCode>();
  const [deleting, setDeleting] = useState<AdminCategory | null>(null);
  const [dragOrder, setDragOrder] = useState<string[] | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const panel = useRef<HTMLDivElement>(null);

  const shownCats = dragOrder ? dragOrder.map((id) => cats.find((c) => c.id === id)!) : cats;
  const cat = cats.find((c) => c.id === catId) ?? cats[0];
  const catItems = cat ? list.filter((i) => i.categoryId === cat.id) : [];
  const countOf = (id: string) => list.filter((i) => i.categoryId === id).length;

  /** run a server action; show its error (optimistic changes roll back by themselves) */
  function run(action: () => Promise<Result<unknown>>, optimistic?: () => void) {
    setError(null);
    start(async () => {
      optimistic?.();
      const r = await action();
      if (!r.ok) setError(r.error);
    });
  }

  function select(id: string) {
    setCatId(id);
    setRenamingId(null); // picking another category closes an open rename
    // phone: the list is above the products, so jump down to them
    if (window.matchMedia("(max-width: 767px)").matches) panel.current?.scrollIntoView({ behavior: "smooth" });
  }

  function moved(order: string[], id: string, to: number) {
    const from = order.indexOf(id);
    if (from < 0 || to < 0 || to >= order.length || from === to) return order;
    const next = [...order];
    next.splice(to, 0, ...next.splice(from, 1));
    return next;
  }

  /** creates "New category" right away, selects it and opens its name field (optional) */
  function addCategory() {
    setError(null);
    start(async () => {
      const r = await createCategory();
      if (!r.ok) return setError(r.error);
      if (!r.data) return;
      select(r.data.id);
      setRenamingId(r.data.id); // naming it is optional: Esc / ✕ keeps "New category"
    });
  }

  function saveOrder(order: string[]) {
    run(() => reorderCategories(order), () => applyCat({ order }));
  }

  return (
    <>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="mr-auto min-w-0">
          <h1 className="font-heading text-2xl font-medium md:text-3xl">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{t("intro")}</p>
        </div>
      </div>

      {error && (
        <p role="alert" className="mb-4 rounded-lg border border-destructive/30 px-3 py-2 text-sm text-destructive">
          {te(error)}
        </p>
      )}

      <div className="flex flex-col gap-6 md:grid md:grid-cols-[minmax(260px,340px)_1fr] md:items-start">
        <Card className="gap-0 overflow-hidden py-0">
          <div className="flex min-h-12 items-center justify-between gap-2 border-b py-2 pr-3 pl-4">
            <p className="text-sm font-semibold">{t("categoriesCount", { count: cats.length })}</p>
            {/* empty menu: the big "Add category" on the right is the one way in */}
            <Button variant="outline" size="sm" disabled={!cats.length || pending} onClick={addCategory}>
              <Plus aria-hidden />
              {t("addCategory")}
            </Button>
          </div>

          <ul aria-label={t("categories")} className="divide-y">
            {shownCats.map((c, i) => {
              const selected = c.id === cat?.id;
              return (
                <li
                  key={c.id}
                  data-cat={c.id}
                  className={cn(
                    "flex items-stretch",
                    selected && "bg-foreground/5 shadow-[inset_3px_0_0_var(--color-foreground)]",
                    dragId === c.id && "relative z-10 bg-background shadow-md",
                  )}
                >
                  {renamingId === c.id ? (
                    <RenameRow
                      category={c}
                      onCancel={() => setRenamingId(null)}
                      onSave={(n) => {
                        setRenamingId(null);
                        run(() => updateCategory(c.id, { name: n }), () => applyCat({ id: c.id, patch: { name: n } }));
                      }}
                    />
                  ) : (
                    <>
                    {/* drag handle: mouse + touch via pointer events (saved on release), keyboard via ↑/↓ */}
                    <button
                      type="button"
                      aria-label={t("reorder", { name: c.name })}
                      disabled={pending}
                      className="flex w-10 shrink-0 cursor-grab touch-none items-center justify-center text-muted-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50 active:cursor-grabbing"
                      onPointerDown={(e) => {
                        e.currentTarget.setPointerCapture(e.pointerId);
                        setDragId(c.id);
                        setDragOrder(cats.map((x) => x.id));
                      }}
                      onPointerMove={(e) => {
                        if (dragId !== c.id || !dragOrder) return;
                        const over = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>("[data-cat]")?.dataset.cat;
                        if (over && over !== c.id) setDragOrder(moved(dragOrder, c.id, dragOrder.indexOf(over)));
                      }}
                      onPointerUp={() => {
                        const order = dragOrder;
                        setDragId(null);
                        setDragOrder(null);
                        if (order && order.join() !== cats.map((x) => x.id).join()) saveOrder(order);
                      }}
                      onPointerCancel={() => {
                        setDragId(null);
                        setDragOrder(null);
                      }}
                      onKeyDown={(e) => {
                        const d = e.key === "ArrowUp" ? -1 : e.key === "ArrowDown" ? 1 : 0;
                        if (!d) return;
                        e.preventDefault();
                        const ids = cats.map((x) => x.id);
                        const order = moved(ids, c.id, i + d);
                        if (order !== ids) saveOrder(order);
                      }}
                    >
                      <GripVertical className="size-4" aria-hidden />
                    </button>
                    <button
                      type="button"
                      onClick={() => select(c.id)}
                      aria-current={selected ? "true" : undefined}
                      className="flex min-h-14 min-w-0 flex-1 items-center gap-2 py-2 pr-4 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                    >
                      <span className={cn("min-w-0 flex-1", !c.isVisible && "opacity-55")}>
                        <span className="block leading-snug">{c.name}</span>
                        <span className="block text-xs text-muted-foreground">
                          {!c.isVisible && t("hidden")}
                        </span>
                      </span>
                      <span className="text-sm text-muted-foreground tabular-nums">{countOf(c.id)}</span>
                    </button>
                    </>
                  )}
                </li>
              );
            })}
            {!cats.length && <li className="px-4 py-8 text-center text-sm text-muted-foreground">{t("noCategories")}</li>}
          </ul>

          {cats.length > 1 && <p className="border-t px-4 py-3 text-xs text-muted-foreground">{t("dragHint")}</p>}
        </Card>

        {!cat && (
          <section className="flex min-h-80 flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed bg-muted/30 p-8 text-center">
            {/* brand-coloured folder (still — no animation) */}
            <span className="grid size-14 place-items-center rounded-full bg-primary/10 text-primary" aria-hidden>
              <FolderPlus className="size-7" />
            </span>
            <div className="flex flex-col gap-1">
              <h2 className="text-xl font-semibold">{t("emptyTitle")}</h2>
              <p className="max-w-sm text-xs text-balance text-muted-foreground">{t("emptyText")}</p>
            </div>
            <Button size="sm" className="rounded-full px-4" disabled={pending} onClick={addCategory}>
              {pending ? <Loader2 className="animate-spin" aria-hidden /> : <Plus aria-hidden />}
              {t("addFirstCategory")}
            </Button>
          </section>
        )}

        {cat && (
          <Card ref={panel} role="region" aria-labelledby="cat-title" className="min-w-0 scroll-mt-20 gap-0 overflow-hidden py-0">
            {/* header row, same height/style as the Categories card */}
            <div className="flex min-h-12 flex-wrap items-center gap-x-3 gap-y-1 border-b py-2 pr-3 pl-4">
              <p className="mr-auto min-w-0 text-sm">
                <span id="cat-title" className="font-semibold">{cat.name}</span>
                <span className="text-muted-foreground"> · {t("itemsCount", { count: catItems.length })}</span>
              </p>
              {/* one small toolbar: rename, delete | show on shop */}
              <div className="flex items-center gap-0.5">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="size-7 rounded-md text-muted-foreground hover:text-foreground"
                  onClick={() => setRenamingId(cat.id)}
                  aria-label={t("rename")}
                >
                  <Pencil aria-hidden />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="size-7 rounded-md text-destructive/80 hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => setDeleting(cat)}
                  aria-label={t("deleteCategory")}
                >
                  <Trash2 aria-hidden />
                </Button>
                <Separator orientation="vertical" className="mx-2 h-5! self-center" />
                <Label className="flex items-center gap-2 text-sm font-normal">
                  <Switch
                    size="sm"
                    checked={cat.isVisible}
                    onCheckedChange={(isVisible) =>
                      run(() => updateCategory(cat.id, { isVisible }), () => applyCat({ id: cat.id, patch: { isVisible } }))
                    }
                  />
                  {t("showOnMenu")}
                </Label>
              </div>
              <Button variant="outline" size="sm" onClick={() => setEditing("new")}>
                <Plus aria-hidden />
                {t("add")}
              </Button>
            </div>

            {!catItems.length && (
              <div className="flex flex-col items-center gap-1 px-4 py-12 text-center">
                <p className="text-sm font-medium">{t("noProducts")}</p>
                <p className="text-xs text-muted-foreground">{t("noProductsHint")}</p>
              </div>
            )}
            {!!catItems.length && (
              <ProductTable
                key={cat.id}
                items={catItems}
                pending={pending}
                onEdit={setEditing}
                onFlag={(id, patch) => run(() => setItemFlags(id, patch), () => applyItem({ id, patch }))}
                onDelete={(item) => {
                  setProductDeleteError(undefined);
                  setDeletingProduct(item);
                }}
                onReorder={(order) => run(() => reorderItems(cat.id, order), () => applyItem({ order }))}
              />
            )}
          </Card>
        )}
      </div>

      {/* delete category: confirm, and say how many products go with it */}
      <DeleteConfirmDialog
        open={!!deletingProduct}
        onClose={() => setDeletingProduct(null)}
        title={t("delete")}
        description={deletingProduct && t("confirmDelete", { name: deletingProduct.name })}
        cancelLabel={t("cancel")}
        deleteLabel={t("delete")}
        pending={pending}
        error={productDeleteError ? te(productDeleteError) : undefined}
        onConfirm={() => {
          if (!deletingProduct) return;
          setProductDeleteError(undefined);
          start(async () => {
            const result = await deleteItem(deletingProduct.id);
            if (result.ok) setDeletingProduct(null);
            else setProductDeleteError(result.error);
          });
        }}
      />

      <DeleteConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title={deleting ? t("deleteCategoryTitle", { name: deleting.name }) : t("delete")}
        description={deleting && (countOf(deleting.id)
          ? t("deleteCategoryItems", { count: countOf(deleting.id) })
          : t("deleteCategoryEmpty"))}
        cancelLabel={t("cancel")}
        deleteLabel={t("delete")}
        onConfirm={() => {
          if (!deleting) return;
          const id = deleting.id;
          setDeleting(null);
          setRenamingId(null);
          setCatId(cats.find((x) => x.id !== id)?.id ?? "");
          run(() => deleteCategory(id));
        }}
      />

      {/* add/edit product: centred dialog; header + footer stay put, the fields scroll */}
      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="flex max-h-[90dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl">
          {editing && (
            <ItemForm
              key={editing === "new" ? "new" : editing.id}
              item={editing === "new" ? undefined : editing}
              categories={cats}
              defaultCategory={cat?.id ?? ""}
              onSaved={(categoryId) => {
                setEditing(null);
                setCatId(categoryId);
              }}
              onClose={() => setEditing(null)}
              onFlag={(id, patch) => run(() => setItemFlags(id, patch), () => applyItem({ id, patch }))}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Rename in place: one name (Khmer or English), shown as is in both languages. Enter saves, Esc cancels. */
function RenameRow({
  category,
  onSave,
  onCancel,
}: {
  category: AdminCategory;
  onSave: (name: string) => void;
  onCancel: () => void;
}) {
  const t = useTranslations("admin.menu");
  const [value, setValue] = useState(category.name);
  const empty = !value.trim();

  return (
    <form
      className="flex min-h-14 min-w-0 flex-1 items-center gap-1.5 py-2 pr-2 pl-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (!empty) onSave(value.trim());
      }}
    >
      <Label htmlFor={`rename-${category.id}`} className="sr-only">{t("categoryName")} <Req /></Label>
      <Input
        id={`rename-${category.id}`}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        required
        autoFocus
        maxLength={80}
        onFocus={(e) => e.currentTarget.select()}
        onKeyDown={(e) => e.key === "Escape" && onCancel()}
        aria-invalid={empty || undefined}
        className="h-8 min-w-0 flex-1 rounded-md border-input bg-background px-2.5 text-sm shadow-xs focus-visible:ring-2"
      />
      <Button type="submit" size="icon-sm" className="shrink-0 rounded-md" disabled={empty} aria-label={t("save")} title={t("save")}>
        <Check aria-hidden />
      </Button>
      <Button type="button" variant="outline" size="icon-sm" className="shrink-0 rounded-md" onClick={onCancel} aria-label={t("cancel")} title={t("cancel")}>
        <X aria-hidden />
      </Button>
    </form>
  );
}

function ItemForm({
  item,
  categories,
  defaultCategory,
  onSaved,
  onClose,
  onFlag,
}: {
  item?: AdminItem;
  categories: AdminCategory[];
  defaultCategory: string;
  onSaved: (categoryId: string) => void;
  onClose: () => void;
  onFlag: (id: string, patch: { isAvailable?: boolean; isVisible?: boolean }) => void;
}) {
  const t = useTranslations("admin.menu");
  const tp = useTranslations("product");
  const te = useTranslations("errors");
  const [fields, setFields] = useState<Record<string, ErrorCode>>({});
  const [formError, setFormError] = useState<ErrorCode>();
  const dollars = (cents: number | null | undefined) => (cents == null ? "" : String(cents / 100));
  // main photo + variants (each its own photo + name); photos upload as soon as picked and are saved with the product
  const [photo, setPhoto] = useState(() => item?.images.find((u) => !item.variants.some((v) => v.image === u)) ?? "");
  const [variants, setVariants] = useState(() =>
    // old products: extra photos without a variant show up as unnamed variants
    (item?.images ?? []).filter((u) => u !== photo).map((image) => {
      const v = item?.variants.find((x) => x.image === image);
      return { key: image, image, label: v?.label ?? "", price: dollars(v?.priceCents) };
    }),
  );
  const [busy, setBusy] = useState<string[]>([]); // keys uploading: "main" or a variant key
  const uploading = busy.length > 0;
  const setVariant = (key: string, patch: { image?: string; label?: string; price?: string }) =>
    setVariants((all) => all.map((v) => (v.key === key ? { ...v, ...patch } : v)));
  // last upload's message under its own box ("main" or a variant): an error, or "4.2 MB → 210 KB" after shrinking
  const [upMsg, setUpMsg] = useState<{ key: string; error?: ErrorCode; size?: string }>();
  const upload = (key: string, file: File | undefined, done: (url: string) => void) => {
    if (!file) return;
    setUpMsg(undefined);
    setBusy((b) => [...b, key]);
    uploadImage(file).then((r) => {
      setBusy((b) => b.filter((k) => k !== key));
      if (!("url" in r)) return setUpMsg({ key, error: r.error });
      done(r.url);
      setUpMsg({ key, size: t("photoSize", { before: formatBytes(r.before), after: formatBytes(r.after) }) });
    });
  };
  const [pending, start] = useTransition();
  // editing a product on sale: its discount as a whole % when it is one (10 %), else as $ off
  const off = item?.compareAtCents ? item.compareAtCents - item.priceCents : 0;
  const wholePct = off > 0 && (off * 100) % item!.compareAtCents! === 0;
  const [price, setPrice] = useState(dollars(item?.compareAtCents ?? item?.priceCents));
  const [discount, setDiscount] = useState(!off ? "" : wholePct ? String((off * 100) / item!.compareAtCents!) : dollars(off));
  const [discountType, setDiscountType] = useState<DiscountType>(!off || wholePct ? "percent" : "amount");
  // live "Customer pays $9.00" under the discount (the save action works it out again)
  const priceCents = toCents(price);
  const preview = priceCents && !Number.isNaN(priceCents) ? salePrice(priceCents, discountType, discount) : null;
  const upMessage = (key: string) =>
    upMsg?.key === key &&
    (upMsg.error ? <p role="alert" className="text-xs text-destructive">{te(upMsg.error)}</p> : <p className="text-xs text-muted-foreground tabular-nums">{upMsg.size}</p>);
  const err = (key: string) => fields[key] && <p className="text-xs text-destructive">{te(fields[key])}</p>;

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const str = (k: string) => String(f.get(k) ?? "");
    const input = {
      name: str("name"),
      brand: str("brand"),
      categoryId: str("categoryId"),
      price: str("price"),
      discount: str("discount"),
      discountType,
      badge: str("badge"),
      isAvailable: f.get("isAvailable") === "on",
      isVisible: f.get("isVisible") === "on",
      description: str("description"),
      image: photo,
      variants: variants.map(({ label, image, price }) => ({ label, image, price })),
    };
    start(async () => {
      const r = await saveItem(item?.id ?? null, input);
      if (r.ok) return onSaved(input.categoryId);
      setFields(r.fields ?? {});
      setFormError(r.fields ? undefined : r.error);
    });
  }

  return (
    <form onSubmit={submit} noValidate className="flex min-h-0 flex-1 flex-col">
      <DialogHeader className="border-b px-6 pt-6 pb-4">
        <DialogTitle className="text-lg">{item ? t("edit") : t("add")}</DialogTitle>
        <DialogDescription className="sr-only">{item ? t("edit") : t("add")}</DialogDescription>
      </DialogHeader>

      {/* three sections: basic info → price → variants */}
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-6 py-5">
        <Section title={t("sectionBasic")}>
          {/* photo left of the name on wider screens, on top on phones */}
          <div className="flex flex-col gap-4 sm:flex-row">
            <div className="flex shrink-0 flex-col gap-1.5">
              <Label htmlFor="photo">{t("photos")} <Opt /></Label>
              <div className="relative size-28">
                <PhotoPick id="photo" url={photo} busy={busy.includes("main")} label={t("uploadPhoto")} onFile={(f) => upload("main", f, setPhoto)} />
                {photo && <RemoveButton label={t("removePhoto")} onClick={() => setPhoto("")} />}
              </div>
              {upMessage("main")}
            </div>
            <div className="grid min-w-0 flex-1 grid-cols-2 content-start gap-x-3 gap-y-4 sm:grid-cols-3">
              <div className="col-span-full flex flex-col gap-1.5">
                <Label htmlFor="name">{t("name")} <Req /></Label>
                <Input id="name" name="name" aria-required maxLength={200} placeholder={t("namePlaceholder")} defaultValue={item?.name} aria-invalid={!!fields.name || undefined} className="h-11" />
                {err("name")}
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="brand">{t("brand")} <Opt /></Label>
                <Input id="brand" name="brand" placeholder={t("brandPlaceholder")} defaultValue={item?.brand ?? ""} className="h-11" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="categoryId">{t("category")} <Req /></Label>
                <Select name="categoryId" defaultValue={item?.categoryId ?? defaultCategory}>
                  <SelectTrigger id="categoryId" aria-required className="h-11! w-full" aria-invalid={!!fields.categoryId || undefined}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {err("categoryId")}
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="badge">{t("badge")} <Opt /></Label>
                {/* no "Sale" choice: a discount shows its own "Sale" pill; an old "sale" badge opens as None and is cleared on save */}
                <Select name="badge" defaultValue={!item?.badge || item.badge === "sale" ? "none" : item.badge}>
                  <SelectTrigger id="badge" className="h-11! w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t("none")}</SelectItem>
                    <SelectItem value="new">{tp("new")}</SelectItem>
                    <SelectItem value="best_seller">{tp("best")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="description">{t("description")} <Opt /></Label>
            <DescriptionEditor id="description" name="description" label={t("description")} placeholder={t("descriptionPlaceholder")} defaultValue={item?.description ?? ""} />
            {err("description")}
          </div>
          {/* whether customers can order / see it: a titled group like the other fields (switches get no required/optional mark) */}
          <div role="group" aria-labelledby="status-title" className="flex flex-col gap-1.5">
            <p id="status-title" className="text-sm leading-none font-medium">{t("status")}</p>
            <div className="flex flex-wrap gap-x-5">
              <Label className="flex min-h-11 items-center gap-2 font-normal">
                <Switch name="isAvailable" defaultChecked={item?.isAvailable ?? true} />
                {t("inStock")}
              </Label>
              <Label className="flex min-h-11 items-center gap-2 font-normal">
                <Switch name="isVisible" defaultChecked={item?.isVisible ?? true} />
                {t("visible")}
              </Label>
            </div>
          </div>
        </Section>

        {/* a line instead of a title; then price + discount, then variants: one block */}
        <Separator />
        <Section>
          <div className="grid grid-cols-1 gap-x-3 gap-y-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="price">{t("price")} <Req /></Label>
              {/* on sale: the saved price is the discount and compareAt keeps the original */}
              <Input id="price" name="price" aria-required inputMode="decimal" placeholder={t("pricePlaceholder")} value={price} onChange={(e) => setPrice(latinDigits(e.target.value))} aria-invalid={!!fields.price || undefined} className="h-11" />
              {err("price")}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="discount">{t("discountLabel")} <Opt /></Label>
              {/* the amount + its type: a small % / $ switch inside the right end of the box */}
              <div className="relative">
                <Input
                  id="discount"
                  name="discount"
                  inputMode="decimal"
                  placeholder={discountType === "percent" ? "10" : "1.50"}
                  value={discount}
                  onChange={(e) => setDiscount(latinDigits(e.target.value))}
                  aria-invalid={!!fields.discount || undefined}
                  className="h-11 pr-24"
                />
                <ToggleGroup
                  type="single"
                  spacing={0}
                  value={discountType}
                  onValueChange={(v) => v && setDiscountType(v as DiscountType)}
                  aria-label={t("discountType")}
                  className="absolute inset-y-1.5 right-1.5 rounded-full bg-muted p-0.5"
                >
                  {(["percent", "amount"] as const).map((v) => (
                    <ToggleGroupItem
                      key={v}
                      value={v}
                      aria-label={t(v === "percent" ? "percentOff" : "amountOff")}
                      // after:-inset-y-1.5 grows the tap area to the full 44px box height
                      className="relative h-full w-10 rounded-full! text-sm font-semibold text-muted-foreground after:absolute after:-inset-y-1.5 after:inset-x-0 data-[state=on]:bg-background data-[state=on]:text-foreground data-[state=on]:shadow-sm"
                    >
                      {v === "percent" ? "%" : "$"}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
              </div>
              {typeof preview === "number" && !fields.discount && (
                <p className="text-xs text-muted-foreground tabular-nums">{t("customerPays", { price: money(preview) })}</p>
              )}
              {err("discount")}
            </div>
          </div>

          {/* variants (same block as the price, no line between): photo + name + own price per row; the customer picks one by its photo */}
          <h3 className="pt-1 text-sm font-semibold">{t("variants")} <Opt /></h3>
          {/* one bordered box: column headers, a row per variant (lines between), "+ Add variant" as the last row */}
          <div className="overflow-hidden rounded-xl border">
            {variants.length > 0 && (
              <>
                <div className="flex items-center gap-2 border-b bg-muted/50 px-3 py-2 text-xs font-medium text-muted-foreground" aria-hidden>
                  <span className="w-11 shrink-0">{t("photoShort")} <Req /></span>
                  <span className="min-w-0 flex-1">{t("variantName")} <Opt /></span>
                  <span className="w-28 shrink-0">{t("price")} <Opt /></span>
                  <span className="w-11 shrink-0" />
                </div>
                <ul className="divide-y">
                  {variants.map((v) => (
                    <li key={v.key} className="flex flex-col gap-1 px-3 py-2">
                      <div className="flex items-center gap-2">
                        <div className="size-11 shrink-0">
                          <PhotoPick url={v.image} busy={busy.includes(v.key)} label={t("uploadPhoto")} onFile={(f) => upload(v.key, f, (image) => setVariant(v.key, { image }))} />
                        </div>
                        <Input
                          value={v.label}
                          onChange={(e) => setVariant(v.key, { label: e.target.value })}
                          maxLength={80}
                          placeholder={t("variantPlaceholder")}
                          aria-label={t("variantName")}
                          className="h-11 min-w-0 flex-1"
                        />
                        {/* own price; empty = the product price (shown faded) */}
                        <div className="relative w-28 shrink-0">
                          <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-sm text-muted-foreground" aria-hidden>$</span>
                          <Input
                            value={v.price}
                            onChange={(e) => setVariant(v.key, { price: latinDigits(e.target.value) })}
                            inputMode="decimal"
                            placeholder={price || "0.00"}
                            aria-label={t("variantPrice")}
                            className="h-11 pl-7 tabular-nums"
                          />
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-11 shrink-0 rounded-md text-muted-foreground hover:text-destructive"
                          onClick={() => setVariants((all) => all.filter((x) => x.key !== v.key))}
                          aria-label={t("removePhoto")}
                        >
                          <Trash2 aria-hidden />
                        </Button>
                      </div>
                      {upMessage(v.key)}
                    </li>
                  ))}
                </ul>
              </>
            )}
            <button
              type="button"
              className={cn(
                "flex h-12 w-full items-center justify-center gap-2 text-sm font-medium text-muted-foreground outline-none hover:bg-muted/50 hover:text-foreground focus-visible:bg-muted/50",
                variants.length > 0 && "border-t",
              )}
              onClick={() => setVariants((all) => [...all, { key: crypto.randomUUID(), image: "", label: "", price: "" }])}
            >
              <Plus className="size-4" aria-hidden /> {t("addVariant")}
            </button>
          </div>
          {err("variants")}
        </Section>

        {formError && <p role="alert" className="text-sm text-destructive">{te(formError)}</p>}
      </div>

      <DialogFooter className="flex-row flex-wrap border-t px-6 py-4">
        {item && !item.isAvailable && (
          <Button type="button" variant="outline" className="h-11" disabled={pending} onClick={() => { onFlag(item.id, { isAvailable: true }); onClose(); }}>
            {t("backInStock")}
          </Button>
        )}
        <Button type="button" variant="outline" className="h-11 flex-1" onClick={onClose}>{t("cancel")}</Button>
        <Button type="submit" className="h-11 flex-1" disabled={pending || uploading}>{t("save")}</Button>
      </DialogFooter>
    </form>
  );
}
