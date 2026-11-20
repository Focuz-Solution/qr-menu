"use client";

import { Check, FolderPlus, GripVertical, Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useOptimistic, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DeleteConfirmDialog } from "@/components/DeleteConfirmDialog";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import type { ErrorCode, Result } from "@/lib/result";
import { useFlip } from "@/lib/use-flip";
import { cn, dragLifted, dragRow } from "@/lib/utils";
import { createCategory, deleteCategory, deleteItem, reorderCategories, reorderItems, setItemFlags, updateCategory } from "./actions";
import { ItemForm } from "./ItemForm";
import { ProductTable } from "./ProductTable";
import type { AdminCategory, AdminItem, AdminSize } from "./types";
import { Req } from "@/components/FieldMark";

type CatChange = { order: string[] } | { id: string; patch: Partial<AdminCategory> };

export function MenuEditor({ categories, items, sizes }: { categories: AdminCategory[]; items: AdminItem[]; sizes: AdminSize[] }) {
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
  // the other categories slide to their new place while one is dragged
  const catList = useFlip<HTMLUListElement>("data-cat", shownCats.map((c) => c.id).join(), dragId);
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

          <ul ref={catList} aria-label={t("categories")} className="divide-y">
            {shownCats.map((c, i) => {
              const selected = c.id === cat?.id;
              return (
                <li
                  key={c.id}
                  data-cat={c.id}
                  className={cn(
                    "flex items-stretch",
                    dragRow,
                    selected && dragId !== c.id && "bg-foreground/5 shadow-[inset_3px_0_0_var(--color-foreground)]",
                    dragId === c.id && dragLifted,
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
              sizes={sizes}
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
