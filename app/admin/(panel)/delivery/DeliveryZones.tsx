"use client";

import { Loader2, type LucideIcon, Pencil, Plus, Trash2 } from "lucide-react";
import Link, { useLinkStatus } from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useOptimistic, useState, useTransition } from "react";
import { Pager, paginate } from "@/components/Pager";
import { type Sort, SortHead } from "@/components/SortHead";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DeleteConfirmDialog } from "@/components/DeleteConfirmDialog";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatPrice, pick } from "@/lib/shop";
import { PROVINCES } from "@/lib/provinces";
import type { ErrorCode } from "@/lib/result";
import { cn } from "@/lib/utils";
import { deleteZone, setZoneActive } from "./actions";
import type { AdminZone } from "./types";

const money = (cents: number) => formatPrice(cents / 100);

const PAGE_SIZE = 20;
type SortKey = "name" | "provinces" | "carriers" | "active";
const compare: Record<SortKey, (a: AdminZone, b: AdminZone) => number> = {
  name: (a, b) => a.name.localeCompare(b.name),
  // "all other provinces" (no codes) sorts last
  provinces: (a, b) => (a.provinceCodes.length || 99) - (b.provinceCodes.length || 99),
  carriers: (a, b) => a.carriers.length - b.carriers.length,
  active: (a, b) => Number(a.isActive) - Number(b.isActive),
};

/** a link's icon that turns into a spinner while its page is loading (must sit inside the <Link>) */
function LinkIcon({ icon: Icon }: { icon: LucideIcon }) {
  const { pending } = useLinkStatus();
  return pending ? <Loader2 className="animate-spin" aria-hidden /> : <Icon aria-hidden />;
}

export function DeliveryZones({ zones }: { zones: AdminZone[] }) {
  const t = useTranslations("admin.delivery");
  const te = useTranslations("errors");
  const lang = useLocale();
  const [deleting, setDeleting] = useState<AdminZone | null>(null);
  const [deleteError, setDeleteError] = useState<ErrorCode>();
  const [error, setError] = useState<ErrorCode | null>(null);
  const [pending, start] = useTransition();
  const [list, applyActive] = useOptimistic(zones, (state, change: { id: string; isActive: boolean }) =>
    state.map((z) => (z.id === change.id ? { ...z, isActive: change.isActive } : z)),
  );

  const [sort, setSort] = useState<Sort<SortKey>>({ key: "name", desc: false });
  const [page, setPage] = useState(0);
  const sorted = list.toSorted((a, b) => (sort.desc ? -1 : 1) * compare[sort.key](a, b));
  const { pages, current, rows } = paginate(sorted, page, PAGE_SIZE);
  const onSort = (key: SortKey) => {
    setSort((s) => ({ key, desc: s.key === key ? !s.desc : true }));
    setPage(0);
  };

  const provinceNames = (codes: string[]) =>
    codes.length
      ? codes.map((c) => pick(PROVINCES.find((p) => p.code === c) ?? { km: c, en: c }, lang)).join(", ")
      : t("everywhereElse");

  return (
    <>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="mr-auto">
          <h1 className="font-heading text-2xl font-medium md:text-3xl">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{t("intro")}</p>
        </div>
        <Button size="sm" asChild>
          <Link href="/admin/delivery/new">
            <LinkIcon icon={Plus} />
            {t("add")}
          </Link>
        </Button>
      </div>

      {error && (
        <p role="alert" className="mb-4 rounded-lg border border-destructive/30 px-3 py-2 text-sm text-destructive">
          {te(error)}
        </p>
      )}

      <Card className="gap-0 overflow-hidden py-0">
        <Table>
          <TableHeader className="bg-muted/50 [&_th]:h-11 [&_th]:text-xs [&_th]:font-medium [&_th]:text-muted-foreground">
            <TableRow className="hover:bg-transparent">
              <SortHead k="name" sort={sort} onSort={onSort} className="w-[22%] pl-4">{t("name")}</SortHead>
              <SortHead k="provinces" sort={sort} onSort={onSort} className="hidden w-[28%] md:table-cell">{t("provinces")}</SortHead>
              <SortHead k="carriers" sort={sort} onSort={onSort} className="w-[30%]">{t("colCarriers")}</SortHead>
              <SortHead k="active" sort={sort} onSort={onSort} className="w-[10%]">{t("active")}</SortHead>
              <TableHead className="pr-4 text-right">{t("actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((z) => (
              <TableRow key={z.id} className={cn("h-14", !z.isActive && "opacity-60")}>
                <TableCell className="max-w-0 pl-4">
                  <p className="truncate font-medium">{z.name}</p>
                  {/* phones: the provinces under the name (their column is hidden) */}
                  <p className="truncate text-xs text-muted-foreground md:hidden">{provinceNames(z.provinceCodes)}</p>
                </TableCell>
                <TableCell className="hidden max-w-0 md:table-cell">
                  <p className="truncate text-muted-foreground">{provinceNames(z.provinceCodes)}</p>
                </TableCell>
                {/* each option with its base fee: "Shop delivery $1.50 · Grab $2.50" */}
                <TableCell className="max-w-0">
                  <p className="truncate text-muted-foreground">
                    {z.carriers.map((c) => `${c.name} ${c.feeCents ? money(c.feeCents) : t("free")}`).join(" · ")}
                  </p>
                </TableCell>
                <TableCell>
                  <Switch
                    checked={z.isActive}
                    disabled={pending}
                    aria-label={`${t("active")}: ${z.name}`}
                    onCheckedChange={(isActive) => {
                      setError(null);
                      start(async () => {
                        applyActive({ id: z.id, isActive });
                        const r = await setZoneActive(z.id, isActive);
                        if (!r.ok) setError(r.error);
                      });
                    }}
                  />
                </TableCell>
                <TableCell className="pr-4">
                  <div className="flex items-center justify-end gap-0.5">
                    <Button asChild variant="ghost" size="icon-sm" className="rounded-md text-muted-foreground hover:text-foreground">
                      <Link href={`/admin/delivery/${z.id}`} aria-label={`${t("edit")}: ${z.name}`} title={t("edit")}>
                        <LinkIcon icon={Pencil} />
                      </Link>
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="rounded-md text-destructive/80 hover:bg-destructive/10 hover:text-destructive"
                      disabled={pending}
                      onClick={() => {
                        setDeleteError(undefined);
                        setDeleting(z);
                      }}
                      aria-label={`${t("delete")}: ${z.name}`}
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
                <TableCell colSpan={5} className="py-12">
                  <div className="flex flex-col items-center gap-2 text-center text-muted-foreground">
                    <p className="text-sm whitespace-normal">{t("empty")}</p>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
      <Pager page={current} pages={pages} size={PAGE_SIZE} shown={rows.length} total={sorted.length} onPage={setPage} />

      <DeleteConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title={t("delete")}
        description={deleting && t("confirmDelete", { name: deleting.name })}
        cancelLabel={t("cancel")}
        deleteLabel={t("delete")}
        pending={pending}
        error={deleteError ? te(deleteError) : undefined}
        onConfirm={() => {
          if (!deleting) return;
          setDeleteError(undefined);
          start(async () => {
            const result = await deleteZone(deleting.id);
            if (result.ok) setDeleting(null);
            else setDeleteError(result.error);
          });
        }}
      />

    </>
  );
}
