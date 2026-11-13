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
import { Textarea } from "@/components/ui/textarea";
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
  setItemFlags,
  updateCategory,
} from "./actions";
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
type SortKey = "name" | "price" | "stock" | "shown";
const compare: Record<SortKey, (a: AdminItem, b: AdminItem) => number> = {
  name: (a, b) => a.name.localeCompare(b.name),
  price: (a, b) => a.priceCents - b.priceCents,
  stock: (a, b) => Number(a.isAvailable) - Number(b.isAvailable),
  shown: (a, b) => Number(a.isVisible) - Number(b.isVisible),
};

/** products of the selected category as a table (AGENTS.md → Admin UI patterns): sort, pages, quick switches */
function ProductTable({ items, pending, onEdit, onFlag, onDelete }: {
  items: AdminItem[];
  pending: boolean;
  onEdit: (item: AdminItem) => void;
  onFlag: (id: string, patch: { isAvailable?: boolean; isVisible?: boolean }) => void;
  onDelete: (item: AdminItem) => void;
}) {
  const t = useTranslations("admin.menu");
  const [sort, setSort] = useState<Sort<SortKey>>({ key: "name", desc: false });
  const [page, setPage] = useState(0);
  const sorted = items.toSorted((a, b) => (sort.desc ? -1 : 1) * compare[sort.key](a, b));
  const { pages, current, rows } = paginate(sorted, page, PAGE_SIZE);
  const onSort = (key: SortKey) => {
    setSort((s) => ({ key, desc: s.key === key ? !s.desc : true }));
    setPage(0);
  };

  return (
    <>
      <Table>
        <TableHeader className="bg-muted/50 [&_th]:h-11 [&_th]:text-xs [&_th]:font-medium [&_th]:text-muted-foreground">
          <TableRow className="hover:bg-transparent">
            <SortHead k="name" sort={sort} onSort={onSort} className="w-[34%] pl-4">{t("colProduct")}</SortHead>
            <SortHead k="price" sort={sort} onSort={onSort} className="w-[18%]">{t("colPrice")}</SortHead>
            <SortHead k="stock" sort={sort} onSort={onSort} className="hidden w-[16%] pl-8 sm:table-cell">{t("inStock")}</SortHead>
            <SortHead k="shown" sort={sort} onSort={onSort} className="w-[14%] pl-4">{t("colShown")}</SortHead>
            <TableHead className="pr-4 text-right">{t("actions")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((item) => (
            <TableRow key={item.id} className={cn("h-16 hover:bg-transparent", (!item.isAvailable || !item.isVisible) && "opacity-60")}>
              <TableCell className="max-w-0 pl-4">
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
  const [list, applyItem] = useOptimistic(items, (state, change: { id: string; patch: Partial<AdminItem> }) =>
    state.map((i) => (i.id === change.id ? { ...i, ...change.patch } : i)),
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
  // album: uploaded addresses (/api/images/<id>.webp) in order, first = card photo; uploaded as soon as picked, saved with the product
  const [photos, setPhotos] = useState<string[]>(item?.images ?? []);
  const [uploadingCount, setUploadingCount] = useState(0);
  const uploading = uploadingCount > 0;
  // drag to reorder photos (mouse + touch via pointer events); first = main.
  // The tile follows the pointer; it swaps with the tile under the pointer; a move under 5 px is a tap, not a drag.
  const [drag, setDrag] = useState<{ url: string; dx: number; dy: number } | null>(null);
  const dragStart = useRef<{ url: string; x: number; y: number } | null>(null);
  const dragged = useRef(false); // a drag that moved must not also count as a tap
  const photoList = useRef<HTMLUListElement>(null);
  const movePhoto = (url: string, to: number) =>
    setPhotos((all) => {
      const from = all.indexOf(url);
      if (from < 0 || to < 0 || to >= all.length || from === to) return all;
      const next = [...all];
      next.splice(to, 0, ...next.splice(from, 1));
      return next;
    });
  // empty photo slots: one to start when there's no photo; ＋ adds another; picking photos fills them
  const [slots, setSlots] = useState(item?.images.length ? 0 : 1);
  const [photoError, setPhotoError] = useState<ErrorCode>();
  const [saving, setSaving] = useState<string>(); // "4.2 MB → 210 KB" after shrinking
  const fileInput = useRef<HTMLInputElement>(null);
  const [pending, start] = useTransition();
  const dollars = (cents: number | null | undefined) => (cents == null ? "" : String(cents / 100));
  // editing a product on sale: its discount as a whole % when it is one (10 %), else as $ off
  const off = item?.compareAtCents ? item.compareAtCents - item.priceCents : 0;
  const wholePct = off > 0 && (off * 100) % item!.compareAtCents! === 0;
  const [price, setPrice] = useState(dollars(item?.compareAtCents ?? item?.priceCents));
  const [discount, setDiscount] = useState(!off ? "" : wholePct ? String((off * 100) / item!.compareAtCents!) : dollars(off));
  const [discountType, setDiscountType] = useState<DiscountType>(!off || wholePct ? "percent" : "amount");
  // live "Customer pays $9.00" under the discount (the save action works it out again)
  const priceCents = toCents(price);
  const preview = priceCents && !Number.isNaN(priceCents) ? salePrice(priceCents, discountType, discount) : null;
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
      images: photos,
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

      {/* photo on top (box + buttons side by side), then the fields in a two-column grid */}
      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-6 py-5">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="photo">{t("photos")} <Opt /></Label>
          <input
            ref={fileInput}
            id="photo"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            className="sr-only"
            onChange={(e) => {
              const files = [...(e.target.files ?? [])];
              e.target.value = ""; // picking the same files again still fires onChange
              if (!files.length) return;
              setPhotoError(undefined);
              setSaving(undefined);
              setUploadingCount((n) => n + files.length);
              setSlots((n) => Math.max(0, n - files.length)); // the uploads take the empty slots' places
              let before = 0;
              let after = 0;
              Promise.all(
                files.map((file) =>
                  uploadImage(file).then((r) => {
                    setUploadingCount((n) => n - 1);
                    if (!("url" in r)) {
                      setSlots((n) => n + 1); // failed: give the empty slot back
                      return setPhotoError(r.error);
                    }
                    setPhotos((all) => [...all, r.url]);
                    before += r.before;
                    after += r.after;
                  }),
                ),
              ).then(() => {
                if (after) setSaving(t("photoSize", { before: formatBytes(before), after: formatBytes(after) }));
              });
            }}
          />
          {/* album: tiles in order; first = main (card photo); tap another to make it main; ✕ removes */}
          <ul ref={photoList} className="flex flex-wrap gap-2">
            {photos.map((url, i) => (
              <li
                key={url}
                data-photo={url}
                // no native image drag (it would cancel ours); no page scroll while dragging on phones
                className={cn(
                  "group relative size-20 touch-none select-none [&_img]:pointer-events-none",
                  photos.length > 1 && "cursor-grab",
                  drag?.url === url && "z-10 cursor-grabbing shadow-xl",
                )}
                style={drag?.url === url ? { transform: `translate(${drag.dx}px, ${drag.dy}px) scale(1.08)` } : undefined}
                onPointerDown={(e) => {
                  if (photos.length < 2 || (e.target as HTMLElement).closest("[data-remove]")) return;
                  e.currentTarget.setPointerCapture(e.pointerId);
                  dragged.current = false;
                  dragStart.current = { url, x: e.clientX, y: e.clientY };
                }}
                onPointerMove={(e) => {
                  const start = dragStart.current;
                  if (!start || start.url !== url) return;
                  const dx = e.clientX - start.x;
                  const dy = e.clientY - start.y;
                  if (!dragged.current && Math.hypot(dx, dy) < 5) return; // still a tap
                  dragged.current = true;
                  // the other tile under the pointer (by position: the dragged tile itself is under the pointer too)
                  const over = [...(photoList.current?.querySelectorAll<HTMLElement>("[data-photo]") ?? [])].find((el) => {
                    if (el.dataset.photo === url) return false;
                    const r = el.getBoundingClientRect();
                    return e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
                  })?.dataset.photo;
                  if (over) {
                    movePhoto(url, photos.indexOf(over));
                    // the tile jumped to its new spot under the pointer: measure from here again
                    dragStart.current = { url, x: e.clientX, y: e.clientY };
                    setDrag({ url, dx: 0, dy: 0 });
                  } else {
                    setDrag({ url, dx, dy });
                  }
                }}
                onPointerUp={() => {
                  dragStart.current = null;
                  setDrag(null);
                }}
                onPointerCancel={() => {
                  dragStart.current = null;
                  setDrag(null);
                }}
              >
                <button
                  type="button"
                  // tap = make it the main photo; ← / → move it
                  onClick={() => {
                    if (dragged.current) return void (dragged.current = false);
                    if (i > 0) movePhoto(url, 0);
                  }}
                  onKeyDown={(e) => {
                    const d = e.key === "ArrowLeft" ? -1 : e.key === "ArrowRight" ? 1 : 0;
                    if (!d) return;
                    e.preventDefault();
                    movePhoto(url, i + d);
                  }}
                  aria-label={`${i === 0 ? t("mainPhoto") : t("makeMain")} (${i + 1}/${photos.length})`}
                  title={i === 0 ? t("mainPhoto") : t("makeMain")}
                  className={cn(
                    "block size-full rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                    i === 0 && "ring-2 ring-foreground ring-offset-2 ring-offset-background",
                  )}
                >
                  <Img src={thumbUrl(url)} alt="" sizes="80px" className="size-full rounded-lg border" />
                </button>
                {/* main: "Main" badge; others: "Set as main" shows on hover / keyboard focus */}
                <span
                  className={cn(
                    "pointer-events-none absolute bottom-1 left-1 rounded-full px-1.5 py-0.5 text-[10px] leading-none font-medium",
                    i === 0
                      ? "bg-foreground text-background"
                      : "bg-background/90 text-foreground opacity-0 shadow-sm group-hover:opacity-100 group-has-focus-visible:opacity-100",
                  )}
                  aria-hidden
                >
                  {i === 0 ? t("mainPhoto") : t("setMain")}
                </span>
                <Button
                  type="button"
                  variant="secondary"
                  size="icon-xs"
                  data-remove
                  className="absolute -top-1.5 -right-1.5 rounded-full shadow-sm"
                  onClick={() => {
                    setPhotos((all) => all.filter((u) => u !== url));
                    setSaving(undefined);
                  }}
                  aria-label={t("removePhoto")}
                >
                  <X aria-hidden />
                </Button>
              </li>
            ))}
            {Array.from({ length: uploadingCount }, (_, i) => (
              <li key={`uploading-${i}`} className="grid size-20 place-items-center rounded-lg border bg-muted/40" aria-hidden>
                <Loader2 className="size-5 animate-spin text-muted-foreground" />
              </li>
            ))}
            {/* empty slots: click one to pick photos; ✕ drops it */}
            {Array.from({ length: slots }, (_, i) => (
              <li key={`slot-${i}`} className="relative size-20">
                <button
                  type="button"
                  onClick={() => fileInput.current?.click()}
                  aria-label={t("uploadPhoto")}
                  title={t("uploadPhoto")}
                  className="flex size-full items-center justify-center rounded-lg border bg-muted/60 text-muted-foreground/60 outline-none hover:bg-muted hover:text-muted-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <ImagePlus className="size-7" strokeWidth={1.5} aria-hidden />
                </button>
                {(slots > 1 || photos.length > 0) && (
                  <Button
                    type="button"
                    variant="secondary"
                    size="icon-xs"
                    className="absolute -top-1.5 -right-1.5 rounded-full shadow-sm"
                    onClick={() => setSlots((n) => n - 1)}
                    aria-label={t("removePhoto")}
                  >
                    <X aria-hidden />
                  </Button>
                )}
              </li>
            ))}
            {/* ＋ adds another empty slot (no limit) */}
            <li>
              <button
                type="button"
                onClick={() => setSlots((n) => n + 1)}
                aria-label={t("addSlot")}
                title={t("addSlot")}
                className="flex size-20 items-center justify-center rounded-lg border-2 border-dashed bg-muted/40 text-muted-foreground outline-none hover:border-foreground/30 hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <Plus className="size-7" strokeWidth={1.75} aria-hidden />
              </button>
            </li>
          </ul>
          {/* also shown with 2+ photos: how to pick the main one */}
          {photos.length > 1 && <p className="text-xs text-muted-foreground">{t("photosOrderHint")}</p>}
          {photoError && <p role="alert" className="text-xs text-destructive">{te(photoError)}</p>}
          {saving && !photoError && <p className="text-xs text-muted-foreground tabular-nums">{saving}</p>}
        </div>

        <div className="grid grid-cols-2 content-start gap-x-3 gap-y-4">
          <div className="col-span-2 flex flex-col gap-1.5">
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
            <Label htmlFor="price">{t("price")} <Req /></Label>
            {/* on sale: the saved price is the discount and compareAt keeps the original */}
            <Input id="price" name="price" aria-required inputMode="decimal" placeholder={t("pricePlaceholder")} value={price} onChange={(e) => setPrice(latinDigits(e.target.value))} aria-invalid={!!fields.price || undefined} className="h-11" />
            {err("price")}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="discount">{t("discountLabel")} <Opt /></Label>
            {/* the amount + its type: % off or $ off */}
            <div className="flex gap-2">
              <Input
                id="discount"
                name="discount"
                inputMode="decimal"
                placeholder={discountType === "percent" ? "10" : "1.50"}
                value={discount}
                onChange={(e) => setDiscount(latinDigits(e.target.value))}
                aria-invalid={!!fields.discount || undefined}
                className="h-11 min-w-0 flex-1"
              />
              <ToggleGroup
                type="single"
                variant="outline"
                value={discountType}
                onValueChange={(v) => v && setDiscountType(v as DiscountType)}
                aria-label={t("discountType")}
                className="shrink-0"
              >
                <ToggleGroupItem value="percent" aria-label={t("percentOff")} className="h-11 w-12 data-[state=on]:bg-foreground data-[state=on]:text-background">%</ToggleGroupItem>
                <ToggleGroupItem value="amount" aria-label={t("amountOff")} className="h-11 w-12 data-[state=on]:bg-foreground data-[state=on]:text-background">$</ToggleGroupItem>
              </ToggleGroup>
            </div>
            {typeof preview === "number" && !fields.discount && (
              <p className="text-xs text-muted-foreground tabular-nums">{t("customerPays", { price: money(preview) })}</p>
            )}
            {err("discount")}
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
          {/* switches share the Badge row, lined up with the select box */}
          <div className="flex flex-wrap items-end gap-x-5 self-end">
            <Label className="flex min-h-11 items-center gap-2">
              <Switch name="isAvailable" defaultChecked={item?.isAvailable ?? true} />
              {t("inStock")}
            </Label>
            <Label className="flex min-h-11 items-center gap-2">
              <Switch name="isVisible" defaultChecked={item?.isVisible ?? true} />
              {t("visible")}
            </Label>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="description">{t("description")} <Opt /></Label>
          <Textarea id="description" name="description" placeholder={t("descriptionPlaceholder")} defaultValue={item?.description} rows={4} />
        </div>
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
