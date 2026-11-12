"use client";

import { Download, Eye, Search, Trash2 } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import Link from "next/link";
import { useState, useTransition } from "react";
import { DeleteConfirmDialog } from "@/components/DeleteConfirmDialog";
import type { ErrorCode } from "@/lib/result";
import { deleteOrder } from "./order-actions";
import { Pager, paginate } from "@/components/Pager";
import { SortHead } from "@/components/SortHead";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { OrderStatus } from "@/lib/generated/prisma/enums";
import { ORDER_STATUSES } from "@/lib/order-status";
import { localPhone, money, StatusPill } from "./order-ui";
import type { AdminOrderRow, OrderStats } from "./order-types";

// ponytail: sort + paging in the browser (the page loads the newest 200 orders)
const PAGE_SIZE = 20;
const periods = ["all", "week", "month", "year"] as const;
type Period = (typeof periods)[number];
type SortKey = "orderNo" | "createdAt" | "customerName" | "totalCents" | "status";
const compare: Record<SortKey, (a: AdminOrderRow, b: AdminOrderRow) => number> = {
  orderNo: (a, b) => a.orderNo.localeCompare(b.orderNo),
  createdAt: (a, b) => +a.createdAt - +b.createdAt,
  customerName: (a, b) => a.customerName.localeCompare(b.customerName),
  totalCents: (a, b) => a.totalCents - b.totalCents,
  status: (a, b) => ORDER_STATUSES.indexOf(a.status) - ORDER_STATUSES.indexOf(b.status),
};


export function Orders({ orders, stats, periodStarts, canDelete }: { orders: AdminOrderRow[]; stats: OrderStats; periodStarts: Record<Period, number>; canDelete: boolean }) {
  const t = useTranslations("admin");
  const format = useFormatter();
  const te = useTranslations("errors");
  const [deleting, setDeleting] = useState<AdminOrderRow | null>(null);
  const [deleteError, setDeleteError] = useState<ErrorCode>();
  const [pending, start] = useTransition();
  const [tab, setTab] = useState<OrderStatus | "all">("all");
  const [period, setPeriod] = useState<Period>("all");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({ key: "createdAt", desc: true });
  const [page, setPage] = useState(0);

  const query = q.trim().toLowerCase();
  const digits = query.replace(/\D/g, "");
  const periodOrders = orders.filter((order) => +order.createdAt >= periodStarts[period]);
  const shown = periodOrders.filter(
    (o) =>
      (tab === "all" || o.status === tab) &&
      (!query ||
        o.orderNo.toLowerCase().includes(query) ||
        o.customerName.toLowerCase().includes(query) ||
        (digits.length >= 3 && (o.customerPhone.includes(digits) || localPhone(o.customerPhone).replace(/\D/g, "").includes(digits)))),
  );
  const sorted = shown.toSorted((a, b) => (sort.desc ? -1 : 1) * compare[sort.key](a, b));
  const { pages, current, rows } = paginate(sorted, page, PAGE_SIZE);
  function downloadReport() {
    const columns = ["order", "time", "customer", "phone", "province", "items", "total", "status", "payment"] as const;
    const report = [
      columns.map((column) => t(`orders.${column}`)),
      ...sorted.map((order) => [
        order.orderNo,
        format.dateTime(order.createdAt, { dateStyle: "short", timeStyle: "short" }),
        order.customerName,
        localPhone(order.customerPhone),
        order.provinceName,
        order.itemCount,
        (order.totalCents / 100).toFixed(2),
        t(`status.${order.status}`),
        t(`orders.paymentMethods.${order.paymentMethod}`),
      ]),
    ];
    const csv = report.map((row) => row.map((value) => {
      const text = String(value);
      const safe = /^[\s\uFEFF]*[=+\-@\t\r\n＝＋－＠]/u.test(text) ? "'" + text : text;
      return `"${safe.replaceAll('"', '""')}"`;
    }).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "orders-report.csv";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  const onSort = (key: SortKey) => {
    setSort((s) => ({ key, desc: s.key === key ? !s.desc : true }));
    setPage(0);
  };
  const total = ORDER_STATUSES.reduce((n, s) => n + stats.counts[s], 0);

  const cards = [
    [t("orders.today"), stats.today],
    [t("orders.revenue"), money(stats.revenueTodayCents)],
    [t("orders.toPack"), stats.counts.confirmed + stats.counts.packing],
    [t("orders.shipping"), stats.counts.shipped],
  ] as const;

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="min-w-0">
          <h1 className="font-heading text-2xl font-medium md:text-3xl">{t("orders.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("orders.intro")}</p>
        </div>
        <Button type="button" variant="outline" size="sm" className="ml-auto shrink-0" disabled={!sorted.length} onClick={downloadReport}>
          <Download aria-hidden />
          {t("orders.downloadReport")}
        </Button>
        <div className="relative w-full max-w-md sm:min-w-48 sm:flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            type="search"
            value={q}
            onChange={(e) => { setQ(e.target.value); setPage(0); }}
            placeholder={t("orders.searchPlaceholder")}
            aria-label={t("orders.search")}
            className="h-11 pl-9"
          />
        </div>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        {cards.map(([label, value]) => (
          <Card key={label} className="gap-0.5 px-4 py-3">
            <p className="text-xl font-semibold tabular-nums">{value}</p>
            <p className="text-xs text-muted-foreground">{label}</p>
          </Card>
        ))}
      </div>

      {/* underline tabs: one swipeable row (scrollbar hidden); the inset shadow is the grey bottom line */}
      <div className="mb-3 flex items-center gap-2 shadow-[inset_0_-1px_0_var(--border)]">
        <div className="min-w-0 flex-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <ToggleGroup
            type="single"
            value={tab}
            // "" = the active tab was tapped again: keep it
            onValueChange={(v) => { if (v) { setTab(v as OrderStatus | "all"); setPage(0); } }}
            aria-label={t("orders.status")}
            className="w-max"
          >
            {(["all", ...ORDER_STATUSES] as const).map((s) => (
              <ToggleGroupItem
                key={s}
                value={s}
                className="h-12 gap-2 rounded-none border-b-2 border-transparent px-4 text-sm font-medium text-muted-foreground hover:bg-transparent hover:text-foreground aria-pressed:bg-transparent data-[state=on]:border-foreground data-[state=on]:bg-transparent data-[state=on]:text-foreground"
              >
                {t(`status.${s}`)}
                <span className="rounded-full bg-muted px-1.5 text-xs font-medium text-muted-foreground tabular-nums">
                  {period === "all"
                    ? (s === "all" ? total : stats.counts[s])
                    : (s === "all" ? periodOrders.length : periodOrders.filter((order) => order.status === s).length)}
                </span>
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
        <Select value={period} onValueChange={(value) => { setPeriod(value as Period); setPage(0); }}>
          <SelectTrigger aria-label={t("orders.reportPeriod")} className="shrink-0">
            <SelectValue />
          </SelectTrigger>
          <SelectContent align="end">
            {periods.map((value) => (
              <SelectItem key={value} value={value}>{t(`orders.period.${value}`)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card className="gap-0 overflow-hidden py-0">
        <Table>
          <TableHeader className="bg-muted/50 [&_th]:h-11 [&_th]:text-xs [&_th]:font-medium [&_th]:text-muted-foreground">
            <TableRow className="hover:bg-transparent">
              <SortHead k="orderNo" sort={sort} onSort={onSort} className="pl-4">{t("orders.order")}</SortHead>
              <SortHead k="createdAt" sort={sort} onSort={onSort} className="hidden md:table-cell">{t("orders.time")}</SortHead>
              <SortHead k="customerName" sort={sort} onSort={onSort}>{t("orders.customer")}</SortHead>
              <TableHead className="hidden lg:table-cell">{t("orders.phone")}</TableHead>
              <TableHead className="hidden md:table-cell">{t("orders.province")}</TableHead>
              <TableHead className="hidden text-right lg:table-cell">{t("orders.items")}</TableHead>
              <SortHead k="totalCents" sort={sort} onSort={onSort} className="text-right">{t("orders.total")}</SortHead>
              <SortHead k="status" sort={sort} onSort={onSort} className="w-px">{t("orders.status")}</SortHead>
              <TableHead className="w-px pr-4 text-right">{t("orders.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((o) => (
              <TableRow key={o.id} className="h-14">
                <TableCell className="pl-4 font-medium">{o.orderNo}</TableCell>
                <TableCell className="hidden text-muted-foreground tabular-nums md:table-cell">
                  {format.dateTime(o.createdAt, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                </TableCell>
                <TableCell className="max-w-40 truncate">{o.customerName}</TableCell>
                <TableCell className="hidden text-muted-foreground tabular-nums lg:table-cell">{localPhone(o.customerPhone)}</TableCell>
                <TableCell className="hidden text-muted-foreground md:table-cell">{o.provinceName}</TableCell>
                <TableCell className="hidden text-right text-muted-foreground tabular-nums lg:table-cell">
                  {t("orders.itemsCount", { count: o.itemCount })}
                </TableCell>
                <TableCell className="text-right font-medium tabular-nums">{money(o.totalCents)}</TableCell>
                <TableCell><StatusPill status={o.status} /></TableCell>
                <TableCell className="pr-4 text-right">
                  <div className="flex justify-end">
                    <Button asChild variant="ghost" size="icon-sm" className="size-11 rounded-md">
                      <Link
                        href={`/admin/orders/${o.id}/`}
                        aria-label={t("orders.viewDetails", { order: o.orderNo })}
                      >
                        <Eye aria-hidden />
                      </Link>
                    </Button>
                    {canDelete && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        className="size-11 rounded-md text-destructive"
                        aria-label={t("orders.deleteOrder", { order: o.orderNo })}
                        onClick={() => { setDeleteError(undefined); setDeleting(o); }}
                      >
                        <Trash2 aria-hidden />
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {!rows.length && (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={9} className="py-10 text-center text-muted-foreground">
                  {orders.length ? t("orders.empty") : t("orders.noOrdersYet")}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

      </Card>

      <DeleteConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title={t("orders.delete")}
        description={deleting && t("orders.confirmDelete", { order: deleting.orderNo })}
        cancelLabel={t("orders.cancel")}
        deleteLabel={t("orders.delete")}
        pending={pending}
        error={deleteError ? te(deleteError) : undefined}
        onConfirm={() => {
          if (!deleting) return;
          setDeleteError(undefined);
          start(async () => {
            const result = await deleteOrder(deleting.id);
            if (result.ok) setDeleting(null);
            else setDeleteError(result.error);
          });
        }}
      />
      <Pager page={current} pages={pages} size={PAGE_SIZE} shown={rows.length} total={sorted.length} onPage={setPage} />

    </>
  );
}
