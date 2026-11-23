"use client";

import { GripVertical, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useLayoutEffect, useRef, useState, useTransition } from "react";
import { DeleteConfirmDialog } from "@/components/DeleteConfirmDialog";
import { Req } from "@/components/FieldMark";
import { Pager, paginate } from "@/components/Pager";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { ErrorCode } from "@/lib/result";
import { moveTo, useDragSort } from "@/lib/use-drag-sort";
import { useFlip } from "@/lib/use-flip";
import { cn, dragLiftedRow, dragRow } from "@/lib/utils";
import { createSize, deleteSize, renameSize, reorderSizes } from "./actions";

type AdminSize = { id: string; name: string; products: number };
const PAGE_SIZE = 20;

/** the shop's sizes in their order (= order on the product page); drag ⠿ to reorder, like products in Admin → Menu */
export function Sizes({ sizes: saved }: { sizes: AdminSize[] }) {
  const t = useTranslations("admin.sizes");
  const te = useTranslations("errors");
  const [pending, start] = useTransition();
  const router = useRouter();
  const [page, setPage] = useState(0);
  // a new order shows at once, until the page comes back from the server with it (or the save fails)
  const [moved, setMoved] = useState<string[] | null>(null);
  const [base, setBase] = useState(saved);
  if (base !== saved) {
    setBase(saved);
    setMoved(null);
  }
  const [orderError, setOrderError] = useState<ErrorCode>();
  const sizes = moved ? moved.map((id) => saved.find((s) => s.id === id)!).filter(Boolean) : saved;
  const ids = sizes.map((s) => s.id);
  function reorder(order: string[]) {
    setOrderError(undefined);
    setMoved(order);
    start(async () => {
      const r = await reorderSizes(order);
      if (!r.ok) {
        setMoved(null);
        setOrderError(r.error);
        router.refresh(); // show the list as it is now
      }
    });
  }

  // drag ⠿ to reorder (saved on release); held over the pager's ‹ › it moves to the page before / after (flipPage)
  const { dragId, dragOrder, start: startDrag } = useDragSort({
    attr: "data-size",
    onDrop: reorder,
    onOther: (under, id, order) => {
      const side = pagerSide(under);
      return side ? flipPage(id, order, side) : null;
    },
    // the ‹ / › the dragged row is held over lights up (until the page has turned); the drag's end (null) resets it
    onMove: (under) => {
      if (!under) {
        turnedRef.current = false;
        setTurned(false);
      }
      setArmed(turnedRef.current ? null : pagerSide(under));
    },
  });
  const [armed, setArmed] = useState<"prev" | "next" | null>(null);
  const shown = dragOrder ? dragOrder.map((id) => sizes.find((s) => s.id === id)!).filter(Boolean) : sizes;
  const { pages, current, rows } = paginate(shown, page, PAGE_SIZE);
  // dragging across pages, same as products: one page turn per drag
  const pagerSide = (under: Element | null) => (under?.closest<HTMLElement>("[data-pager]:enabled")?.dataset.pager as "prev" | "next" | undefined) ?? null;
  const turnedRef = useRef(false);
  const [turned, setTurned] = useState(false);
  const flipDir = useRef<-1 | 0 | 1>(0);
  const flipPage = (id: string, order: string[], side: "prev" | "next") => {
    if (turnedRef.current) return null;
    const dir = side === "prev" ? -1 : 1;
    const to = dir < 0 ? current * PAGE_SIZE - 1 : (current + 1) * PAGE_SIZE;
    if (to < 0 || to >= order.length) return null;
    turnedRef.current = true;
    setTurned(true);
    setArmed(null);
    flipDir.current = dir;
    setPage(current + dir);
    return moveTo(order, id, to);
  };
  // the other rows slide to their new place while one is dragged
  const body = useFlip<HTMLTableSectionElement>("data-size", rows.map((s) => s.id).join(), dragId);
  // a page turned while dragging: the new page slides in from the side it came from
  useLayoutEffect(() => {
    const dir = flipDir.current;
    flipDir.current = 0;
    if (!dir || !body.current || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    body.current.animate([{ transform: `translateX(${dir * 40}px)`, opacity: 0.2 }, { transform: "translateX(0)", opacity: 1 }], {
      duration: 280,
      easing: "cubic-bezier(0.2, 0, 0, 1)",
    });
  }, [current, body]);
  // the add / rename dialog: "new" or the size being renamed
  const [editing, setEditing] = useState<AdminSize | "new" | null>(null);
  const [name, setName] = useState("");
  const [nameError, setNameError] = useState<ErrorCode>();
  // common sizes to tap instead of typing (Add only), without the ones the shop already has
  const have = new Set(sizes.map((s) => s.name.toLowerCase()));
  const picks = t("suggestions").split(",").map((x) => x.trim()).filter((x) => x && !have.has(x.toLowerCase()));
  const [deleting, setDeleting] = useState<AdminSize | null>(null);
  const [deleteError, setDeleteError] = useState<ErrorCode>();

  const open = (s: AdminSize | "new") => {
    setNameError(undefined);
    setName(s === "new" ? "" : s.name);
    setEditing(s);
  };
  function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    start(async () => {
      const r = editing === "new" ? await createSize(name) : await renameSize(editing!.id, name);
      if (r.ok) setEditing(null);
      else setNameError(r.fields?.name ?? r.error);
    });
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="mr-auto">
          <h1 className="font-heading text-2xl font-medium md:text-3xl">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{t("intro")}</p>
        </div>
        <Button size="sm" onClick={() => open("new")}>
          <Plus aria-hidden />
          {t("add")}
        </Button>
      </div>

      <Card className="gap-0 overflow-hidden py-0">
        <Table>
          <TableHeader className="bg-muted/50 [&_th]:h-11 [&_th]:text-xs [&_th]:font-medium [&_th]:text-muted-foreground">
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-10 pr-0 pl-2" />
              <TableHead className="pl-1">{t("name")}</TableHead>
              <TableHead className="text-right">{t("products")}</TableHead>
              <TableHead className="w-28 pr-4 text-right">{t("actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody ref={body}>
            {rows.map((s) => (
              <TableRow key={s.id} data-size={s.id} className={cn("h-14 hover:bg-transparent", dragRow, dragId === s.id && dragLiftedRow)}>
                {/* drag handle: mouse + touch via pointer events (saved on release), keyboard via ↑/↓ */}
                <TableCell className="w-10 pr-0 pl-2">
                  {sizes.length > 1 && (
                    <button
                      type="button"
                      aria-label={t("reorder", { name: s.name })}
                      disabled={pending}
                      className="flex size-10 cursor-grab touch-none items-center justify-center rounded-md text-muted-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50 active:cursor-grabbing"
                      onPointerDown={(e) => startDrag(e, s.id, ids)}
                      onKeyDown={(e) => {
                        const d = e.key === "ArrowUp" ? -1 : e.key === "ArrowDown" ? 1 : 0;
                        if (!d) return;
                        e.preventDefault();
                        const order = moveTo(ids, s.id, ids.indexOf(s.id) + d);
                        if (order === ids) return;
                        reorder(order);
                        // ↑ on a page's first row / ↓ on its last: the table follows the row to the next page
                        setPage(Math.floor(order.indexOf(s.id) / PAGE_SIZE));
                      }}
                    >
                      <GripVertical className="size-4" aria-hidden />
                    </button>
                  )}
                </TableCell>
                <TableCell className="max-w-40 truncate pl-1 font-medium">{s.name}</TableCell>
                <TableCell className="text-right text-muted-foreground tabular-nums">{s.products}</TableCell>
                <TableCell className="pr-4">
                  <div className="flex items-center justify-end gap-0.5">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="rounded-md text-muted-foreground hover:text-foreground"
                      onClick={() => open(s)}
                      aria-label={`${t("rename")}: ${s.name}`}
                      title={t("rename")}
                    >
                      <Pencil aria-hidden />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="rounded-md text-destructive/80 hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => {
                        setDeleteError(undefined);
                        setDeleting(s);
                      }}
                      aria-label={`${t("delete")}: ${s.name}`}
                      title={t("delete")}
                    >
                      <Trash2 aria-hidden />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {!rows.length && (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={4} className="py-12 text-center text-sm whitespace-normal text-muted-foreground">
                  {t("empty")}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        {sizes.length > 1 && <p className="border-t px-4 py-3 text-xs text-muted-foreground">{t("dragHint")}</p>}
      </Card>
      {orderError && <p role="alert" className="mt-2 text-xs text-destructive">{te(orderError)}</p>}
      <Pager page={current} pages={pages} size={PAGE_SIZE} shown={rows.length} total={sizes.length} onPage={setPage} dropTarget={!!dragId && pages > 1 && !turned} armed={dragId ? armed : null} popPage={!!dragId} />

      <Dialog open={!!editing} onOpenChange={(next) => !next && !pending && setEditing(null)}>
        <DialogContent className="sm:max-w-md" overlayClassName="bg-black/30 supports-backdrop-filter:backdrop-blur-none">
          <form onSubmit={save} noValidate className="flex flex-col gap-4">
            <DialogHeader>
              <DialogTitle>{editing === "new" ? t("add") : t("rename")}</DialogTitle>
              <DialogDescription>{t("hint")}</DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="size-name">
                {t("name")} <Req />
              </Label>
              <Input
                id="size-name"
                name="name"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setNameError(undefined);
                }}
                placeholder={t("placeholder")}
                maxLength={40}
                aria-required
                aria-invalid={!!nameError || undefined}
                autoFocus
                className="h-11"
              />
              {nameError && <p role="alert" className="text-xs text-destructive">{te(nameError)}</p>}
            </div>
            {editing === "new" && picks.length > 0 && (
              <div className="flex flex-col gap-2">
                <p className="text-xs text-muted-foreground">{t("quickPick")}</p>
                <div className="flex flex-wrap gap-1.5">
                  {picks.map((x) => (
                    <button
                      key={x}
                      type="button"
                      aria-pressed={name === x}
                      onClick={() => {
                        setName(x);
                        setNameError(undefined);
                      }}
                      className={cn(
                        // 32px chip; the invisible after: edge keeps a 44px tap area
                        "relative h-8 rounded-full border px-3 text-sm transition-colors outline-none after:absolute after:-inset-1.5 focus-visible:ring-3 focus-visible:ring-ring/50",
                        name === x ? "border-primary bg-primary/10 font-medium text-primary" : "hover:bg-muted",
                      )}
                    >
                      {x}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <DialogFooter className="flex-row justify-end">
              <Button type="button" variant="outline" size="sm" disabled={pending} onClick={() => setEditing(null)}>{t("cancel")}</Button>
              <Button type="submit" size="sm" disabled={pending || !name.trim()}>
                {pending && <Loader2 className="animate-spin" aria-hidden />}
                {t("save")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <DeleteConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title={t("delete")}
        description={deleting && t("confirmDelete", { name: deleting.name, count: deleting.products })}
        cancelLabel={t("cancel")}
        deleteLabel={t("delete")}
        pending={pending}
        error={deleteError ? te(deleteError) : undefined}
        onConfirm={() => {
          if (!deleting) return;
          start(async () => {
            const r = await deleteSize(deleting.id);
            if (r.ok) setDeleting(null);
            else setDeleteError(r.error);
          });
        }}
      />
    </>
  );
}
