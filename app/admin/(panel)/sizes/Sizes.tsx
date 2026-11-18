"use client";

import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
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
import { cn } from "@/lib/utils";
import { createSize, deleteSize, renameSize } from "./actions";

type AdminSize = { id: string; name: string; products: number };
const PAGE_SIZE = 20;

// ponytail: list in the order sizes were added (= order on the product page); add reordering if shops ask for it
export function Sizes({ sizes }: { sizes: AdminSize[] }) {
  const t = useTranslations("admin.sizes");
  const te = useTranslations("errors");
  const [pending, start] = useTransition();
  const [page, setPage] = useState(0);
  const { pages, current, rows } = paginate(sizes, page, PAGE_SIZE);
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
              <TableHead className="pl-4">{t("name")}</TableHead>
              <TableHead className="text-right">{t("products")}</TableHead>
              <TableHead className="w-28 pr-4 text-right">{t("actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((s) => (
              <TableRow key={s.id} className="h-14">
                <TableCell className="max-w-40 truncate pl-4 font-medium">{s.name}</TableCell>
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
                <TableCell colSpan={3} className="py-12 text-center text-sm whitespace-normal text-muted-foreground">
                  {t("empty")}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
      <Pager page={current} pages={pages} size={PAGE_SIZE} shown={rows.length} total={sizes.length} onPage={setPage} />

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
