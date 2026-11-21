"use client";

import { ArrowRight, ChevronDown, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { DeleteConfirmDialog } from "@/components/DeleteConfirmDialog";
import { Pager, paginate } from "@/components/Pager";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { ErrorCode } from "@/lib/result";
import { formatPrice } from "@/lib/shop";
import { cn } from "@/lib/utils";
import { saveSteps, setWholesaleActive } from "./actions";
import { StepsDialog, Thumb } from "./StepsDialog";
import { type Step, stepPrice, type WholesaleItem, type WholesaleRow } from "./types";

type Filter = "all" | "set" | "unset";
const money = (cents: number) => formatPrice(cents / 100);
const PAGE_SIZE = 10; // variant table
const MORE = 10; // product list: shown at first and added by "Load more"
const setCount = (item: WholesaleItem) => item.rows.filter((r) => r.steps.length).length;

/** "10+ → -10% ($40.50)" or "10+ → $40.00" */
function StepChip({ step, cents }: { step: Step; cents: number }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-info px-2 py-0.5 text-xs font-semibold whitespace-nowrap text-info-foreground tabular-nums">
      {step.minQty}+ <ArrowRight className="size-3" aria-hidden /> {step.priceCents != null ? money(step.priceCents) : `-${step.percent}% (${money(stepPrice(cents, step))})`}
    </span>
  );
}

export function Wholesale({ items }: { items: WholesaleItem[] }) {
  const t = useTranslations("admin.wholesale");
  const te = useTranslations("errors");
  const [pending, start] = useTransition();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [selectedId, setSelectedId] = useState(items[0]?.id);
  const item = items.find((i) => i.id === selectedId);

  const counts = { all: items.length, set: items.filter((i) => setCount(i) > 0).length, unset: items.filter((i) => !setCount(i)).length };
  const needle = q.trim().toLowerCase();
  const shown = items.filter(
    (i) => (filter === "all" || (filter === "set") === setCount(i) > 0) && (!needle || i.name.toLowerCase().includes(needle)),
  );
  const [limit, setLimit] = useState(MORE);
  const listed = shown.slice(0, limit);
  // variant table pages; back to page 1 when another product is picked
  const [page, setPage] = useState(0);
  const { pages, current, rows: variantRows } = paginate(item?.rows ?? [], page, PAGE_SIZE);

  // steps dialog: the variants ticked when it opens; `all` = opened from "Set for all variants"
  const [editing, setEditing] = useState<{ keys: string[]; all: boolean } | null>(null);
  const [clearing, setClearing] = useState<WholesaleRow | null>(null);
  const [clearError, setClearError] = useState<ErrorCode>();
  const [toggleError, setToggleError] = useState<ErrorCode>();

  const filters: [Filter, string][] = [["all", t("filterAll")], ["set", t("filterSet")], ["unset", t("filterUnset")]];

  return (
    <>
      <div className="mb-5 min-w-0">
        <h1 className="font-heading text-2xl font-medium md:text-3xl">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("intro")}</p>
      </div>

      <div className="flex flex-col gap-6 md:grid md:grid-cols-[minmax(260px,340px)_1fr] md:items-start">
        {/* left: products, 10 at a time + "Load more" */}
        <Card className="gap-0 overflow-hidden py-0">
          <div className="flex flex-col gap-2.5 border-b p-3">
            <p className="px-1 text-sm font-semibold">
              {t("products")} <span className="font-normal text-muted-foreground">· {items.length}</span>
            </p>
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
              {/* compact (36px) search so the product list gets the room */}
              <Input type="search" value={q} onChange={(e) => { setQ(e.target.value); setLimit(MORE); }} placeholder={t("search")} aria-label={t("search")} className="h-9 pl-8 text-sm" />
            </div>
            <div className="flex flex-wrap gap-1.5" role="group" aria-label={t("products")}>
              {filters.map(([f, label]) => (
                <button
                  key={f}
                  type="button"
                  aria-pressed={filter === f}
                  onClick={() => { setFilter(f); setLimit(MORE); }}
                  className={cn(
                    // 28px chip; the invisible after: edge keeps a 44px tap height
                    "relative flex h-7 items-center gap-1 rounded-full border px-2.5 text-xs font-medium transition-colors outline-none after:absolute after:-inset-y-2 after:inset-x-0 focus-visible:ring-3 focus-visible:ring-ring/50",
                    filter === f ? "border-foreground bg-foreground text-background" : "text-muted-foreground hover:bg-muted",
                  )}
                >
                  {label} <span className="tabular-nums opacity-70">{counts[f]}</span>
                </button>
              ))}
            </div>
          </div>
          <ul className="divide-y">
            {listed.map((i) => {
              const done = setCount(i);
              const on = i.id === item?.id;
              return (
                <li key={i.id}>
                  <button
                    type="button"
                    aria-current={on || undefined}
                    onClick={() => { setSelectedId(i.id); setPage(0); }}
                    className={cn(
                      "flex min-h-16 w-full items-center gap-3 px-4 py-2.5 text-left transition-colors outline-none hover:bg-foreground/5 focus-visible:bg-foreground/5",
                      on && "bg-foreground/5 shadow-[inset_3px_0_0_var(--color-foreground)]",
                    )}
                  >
                    <Thumb src={i.image} alt="" className="size-10 shrink-0 rounded-md" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{i.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {money(i.priceCents)} · {t("variantCount", { count: i.variantCount })}
                      </span>
                    </span>
                    <span
                      className={cn(
                        "shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums",
                        done ? "bg-info text-info-foreground" : "text-muted-foreground",
                      )}
                    >
                      {done}/{i.rows.length}
                    </span>
                  </button>
                </li>
              );
            })}
            {!shown.length && <li className="px-4 py-12 text-center text-sm text-muted-foreground">{items.length ? t("noMatch") : t("empty")}</li>}
          </ul>
          {shown.length > limit && (
            <button
              type="button"
              onClick={() => setLimit((n) => n + MORE)}
              className="flex h-11 w-full items-center justify-center gap-1.5 border-t text-sm font-medium outline-none hover:bg-muted/50 focus-visible:bg-muted/50"
            >
              <ChevronDown className="size-4" aria-hidden />
              {t("loadMore", { count: shown.length - limit })}
            </button>
          )}
        </Card>

        {/* right: the chosen product's variants and their quantity steps (pager under the card) */}
        <div className="min-w-0">
        <Card className="gap-0 overflow-hidden py-0">
          {!item ? (
            <p className="px-4 py-16 text-center text-sm text-muted-foreground">{items.length ? t("pick") : t("empty")}</p>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b px-4 py-2">
                {/* left: product name; right: Active switch, then "Set for all variants" */}
                <h2 className="mr-auto min-w-0 truncate font-semibold">{item.name}</h2>
                <label className="flex min-h-9 items-center gap-2 text-sm">
                  <Switch
                    checked={item.isActive}
                    disabled={pending}
                    onCheckedChange={(v) =>
                      start(async () => {
                        const r = await setWholesaleActive(item.id, v);
                        setToggleError(r.ok ? undefined : r.error);
                      })
                    }
                  />
                  {t("active")}
                </label>
                <Button variant="outline" size="sm" disabled={pending} onClick={() => setEditing({ keys: item.rows.map((r) => r.key), all: true })}>
                  <Plus aria-hidden />
                  {t("setAll")}
                </Button>
              </div>
              {toggleError && <p role="alert" className="border-b px-4 py-2 text-sm text-destructive">{te(toggleError)}</p>}
              {!item.isActive && <p className="border-b bg-muted/50 px-4 py-2.5 text-sm text-muted-foreground">{t("off")}</p>}

              <Table>
                <TableHeader className="bg-muted/50 [&_th]:h-11 [&_th]:text-xs [&_th]:font-medium [&_th]:text-muted-foreground">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-[40%] min-w-44 pl-4 md:w-[30%]">{t("variant")}</TableHead>
                    <TableHead className="text-right">{t("basePrice")}</TableHead>
                    <TableHead className="hidden md:table-cell">{t("tiers")}</TableHead>
                    <TableHead className="w-24 pr-4 text-right">{t("actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {variantRows.map((r) => (
                    <TableRow key={r.key} className={cn("h-16", !item.isActive && "opacity-60")}>
                      <TableCell className="max-w-0 pl-4">
                        <div className="flex items-center gap-3">
                          <Thumb src={r.image} alt={r.label} className="size-10 shrink-0 rounded-md" />
                          <div className="min-w-0">
                            <p className="truncate font-medium">{r.label}</p>
                            {r.code && <p className="truncate text-xs text-muted-foreground">{r.code}</p>}
                            {/* phones: steps under the name (the steps column is hidden) */}
                            <div className="mt-1 flex flex-wrap gap-1 md:hidden">
                              {r.steps.map((s) => <StepChip key={s.minQty} step={s} cents={r.priceCents} />)}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-medium tabular-nums">{money(r.priceCents)}</TableCell>
                      <TableCell className="hidden whitespace-normal md:table-cell">
                        <div className="flex flex-wrap gap-1.5">
                          {r.steps.length ? r.steps.map((s) => <StepChip key={s.minQty} step={s} cents={r.priceCents} />) : <span className="text-sm text-muted-foreground">{t("noTiers")}</span>}
                        </div>
                      </TableCell>
                      <TableCell className="pr-4">
                        <div className="flex items-center justify-end gap-0.5">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            className="rounded-md text-muted-foreground hover:text-foreground"
                            disabled={pending}
                            onClick={() => setEditing({ keys: [r.key], all: false })}
                            aria-label={t("edit", { name: r.label })}
                            title={t("edit", { name: r.label })}
                          >
                            <Pencil aria-hidden />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            className="rounded-md text-destructive/80 hover:bg-destructive/10 hover:text-destructive"
                            disabled={pending || !r.steps.length}
                            onClick={() => { setClearError(undefined); setClearing(r); }}
                            aria-label={t("clear", { name: r.label })}
                            title={t("clear", { name: r.label })}
                          >
                            <Trash2 aria-hidden />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </>
          )}
        </Card>
        {item && <Pager page={current} pages={pages} size={PAGE_SIZE} shown={variantRows.length} total={item.rows.length} onPage={setPage} />}
        </div>
      </div>

      {editing && item && <StepsDialog key={item.id + editing.keys.join()} item={item} keys={editing.keys} all={editing.all} onClose={() => setEditing(null)} />}

      <DeleteConfirmDialog
        open={!!clearing}
        onClose={() => setClearing(null)}
        title={t("remove")}
        description={clearing && t("confirmClear", { name: clearing.label })}
        cancelLabel={t("cancel")}
        deleteLabel={t("remove")}
        pending={pending}
        error={clearError ? te(clearError) : undefined}
        onConfirm={() => {
          if (!item || !clearing) return;
          start(async () => {
            const r = await saveSteps(item.id, [clearing.key], []);
            if (r.ok) setClearing(null);
            else setClearError(r.error);
          });
        }}
      />
    </>
  );
}
