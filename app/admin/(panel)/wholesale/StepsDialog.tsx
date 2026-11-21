"use client";

import { ImageOff, Loader2, Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Req } from "@/components/FieldMark";
import { Img } from "@/components/Img";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { ErrorCode } from "@/lib/result";
import { formatPrice, thumbUrl } from "@/lib/shop";
import { cn } from "@/lib/utils";
import { saveSteps } from "./actions";
import { checkSteps, MAX_QTY, parseValue, type StepInput, stepPrice, type WholesaleItem } from "./types";

const MAX_STEPS = 5;
// step table columns — phones: quantity · price · remove; sm+: quantity · range · price · result · remove
const COLS = "grid grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_2.25rem] items-center gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(5.5rem,auto)_minmax(0,1.3fr)_8.5rem_2.25rem]";
const money = (cents: number) => formatPrice(cents / 100);
const toInput = (s: { minQty: number; percent?: number; priceCents?: number }): StepInput =>
  s.priceCents != null
    ? { minQty: String(s.minQty), mode: "amount", value: String(s.priceCents / 100) }
    : { minQty: String(s.minQty), mode: "percent", value: String(s.percent ?? "") };

export function Thumb({ src, alt, className }: { src: string | null; alt: string; className: string }) {
  const fallback = <ImageOff className="absolute inset-0 m-auto size-5 text-muted-foreground/40" aria-hidden />;
  return src ? (
    <Img src={thumbUrl(src)} alt={alt} sizes="48px" className={className} fallback={fallback} />
  ) : (
    <div className={cn("relative bg-foreground/5", className)}>{fallback}</div>
  );
}

/**
 * Quantity price steps for some variants of one product. `keys` = the variants ticked when it opens
 * (all of them from "Set for all variants", one from its pencil). Saving replaces the ticked variants' steps.
 */
export function StepsDialog({ item, keys, all, onClose }: { item: WholesaleItem; keys: string[]; all: boolean; onClose: () => void }) {
  const t = useTranslations("admin.wholesale");
  const te = useTranslations("errors");
  const [pending, start] = useTransition();
  const [picked, setPicked] = useState(keys);
  // starts empty; only editing one variant (its pencil) loads that variant's own saved steps
  const own = all ? undefined : item.rows.find((r) => r.key === keys[0])?.steps;
  const [steps, setSteps] = useState<StepInput[]>(own?.length ? own.map(toInput) : [{ minQty: "", mode: "amount", value: "" }]);
  const [error, setError] = useState<ErrorCode>();
  // row problems show once the row is filled in, or for every row after Save was pressed
  const [tried, setTried] = useState(false);

  const rows = item.rows.filter((r) => picked.includes(r.key));
  const prices = [...new Set(rows.map((r) => r.priceCents))];
  const lowest = Math.min(...prices);
  const check = checkSteps(steps, prices.length ? prices : [0]);
  const rowError = (i: number) => (tried || (steps[i].minQty.trim() && steps[i].value.trim()) ? check.errors[i] : null);
  // range column: each step runs up to the next bigger quantity (valid quantities only)
  const qtys = steps.map((s) => Number(s.minQty)).filter((n) => Number.isInteger(n) && n >= 2 && n <= MAX_QTY).sort((a, b) => a - b);
  const until = (q: number) => qtys.find((n) => n > q);
  const range = (q: number) => (until(q) ? `${q} – ${until(q)! - 1}` : `${q}+`);

  const edit = (i: number, patch: Partial<StepInput>) => {
    setSteps((list) => list.map((s, j) => (j === i ? { ...s, ...patch } : s)));
    setError(undefined);
  };
  /** % ⇄ $: turn the typed value into the same price the other way (from the lowest ticked price) */
  const switchMode = (i: number, mode: StepInput["mode"]) => {
    const s = steps[i];
    if (s.mode === mode) return;
    const rule = parseValue(s);
    let value = "";
    if (rule && lowest > 0) {
      const cents = stepPrice(lowest, rule);
      value = mode === "amount" ? String(cents / 100) : String(Math.round((1 - cents / lowest) * 10000) / 100);
    }
    edit(i, { mode, value: value === "0" ? "" : value });
  };
  const toggle = (key: string) => {
    setPicked((list) => (list.includes(key) ? list.filter((k) => k !== key) : [...list, key]));
    setError(undefined);
  };
  function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setTried(true);
    if (check.errors.some(Boolean)) return;
    start(async () => {
      const r = await saveSteps(item.id, picked, steps);
      if (r.ok) onClose();
      else setError(r.error);
    });
  }

  /** result column: the new unit price — one price, or lowest – highest when the ticked variants' prices differ */
  const result = (rule: ReturnType<typeof parseValue>) => {
    if (!rule || !prices.length) return null;
    const units = [...new Set(prices.map((p) => stepPrice(p, rule)))].sort((a, b) => a - b);
    return units.length === 1 ? money(units[0]) : `${money(units[0])} – ${money(units.at(-1)!)}`;
  };

  return (
    <Dialog open onOpenChange={(next) => !next && !pending && onClose()}>
      <DialogContent className="max-h-[90dvh] gap-0 overflow-y-auto p-0 sm:max-w-2xl" overlayClassName="bg-black/30 supports-backdrop-filter:backdrop-blur-none">
        <form onSubmit={save} noValidate>
          <DialogHeader className="border-b px-6 py-4">
            <DialogTitle>{all ? t("dialogAll") : t("dialogOne", { name: item.rows.find((r) => r.key === keys[0])?.label ?? item.name })}</DialogTitle>
            <DialogDescription className="sr-only">{t("stepsHint")}</DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4 px-6 py-5">
            {/* title + hint, and on the right the normal price of the ticked variants (what each step is cheaper than);
                a range when their prices differ */}
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <h3 className="font-semibold">{t("steps")}</h3>
                <p className="text-sm text-muted-foreground">{t("stepsHint")}</p>
              </div>
              {prices.length > 0 && (
                <div className="shrink-0 rounded-xl border bg-muted/50 px-4 py-2 text-right">
                  <p className="text-xs text-muted-foreground">{t("basePrice")}</p>
                  <p className="text-lg font-semibold tabular-nums">
                    {prices.length === 1 ? money(prices[0]) : `${money(lowest)} – ${money(Math.max(...prices))}`}
                  </p>
                </div>
              )}
            </div>

            {/* bordered table: header · one row per step · "Add step" as the last row */}
            <div className="overflow-hidden rounded-xl border">
              <div className={cn(COLS, "border-b bg-muted/50 px-3 py-2.5 text-xs font-medium text-muted-foreground")}>
                <span>{t("minQty")} <Req /></span>
                <span className="hidden sm:block">{t("range")}</span>
                <span>{t("newPrice")} <Req /></span>
                <span className="hidden sm:block">{t("result")}</span>
                <span />
              </div>

              <div className="divide-y">
                {steps.map((s, i) => {
                  const q = Number(s.minQty);
                  const err = rowError(i);
                  const qtyBad = err === "badQty" || err === "duplicateStep";
                  const res = err ? null : result(parseValue(s));
                  return (
                    <div key={i} className={cn(COLS, "px-3 py-2")}>
                      <div className="relative">
                        <Input
                          type="number"
                          inputMode="numeric"
                          min={2}
                          max={MAX_QTY}
                          step={1}
                          value={s.minQty}
                          onChange={(e) => edit(i, { minQty: e.target.value })}
                          aria-label={`${t("minQty")} ${i + 1}`}
                          aria-required
                          aria-invalid={qtyBad || undefined}
                          className="h-9 [appearance:textfield] pr-14 text-sm [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                        />
                        <span className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-xs text-muted-foreground">{t("unit")}</span>
                      </div>
                      <span className="hidden sm:block">
                        <span className="rounded-full border px-2 py-0.5 text-xs font-semibold whitespace-nowrap tabular-nums">
                          {!qtyBad && Number.isInteger(q) && q >= 2 && q <= MAX_QTY ? range(q) : "–"}
                        </span>
                      </span>
                      <div className="relative">
                        <Input
                          inputMode="decimal"
                          value={s.value}
                          onChange={(e) => edit(i, { value: e.target.value })}
                          aria-label={`${t("newPrice")} ${i + 1}`}
                          aria-required
                          aria-invalid={(!!err && !qtyBad) || undefined}
                          className="h-9 pr-17 text-sm"
                        />
                        {/* % off / new $ price */}
                        <div className="absolute top-1/2 right-1 flex -translate-y-1/2 gap-0.5" role="group" aria-label={t("mode")}>
                          {(["percent", "amount"] as const).map((m) => (
                            <button
                              key={m}
                              type="button"
                              aria-pressed={s.mode === m}
                              aria-label={t(m === "percent" ? "modePercent" : "modeAmount")}
                              onClick={() => switchMode(i, m)}
                              className={cn(
                                "relative size-7 rounded-full text-xs font-semibold outline-none after:absolute after:-inset-1.5 focus-visible:ring-3 focus-visible:ring-ring/50",
                                s.mode === m ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
                              )}
                            >
                              {m === "percent" ? "%" : "$"}
                            </button>
                          ))}
                        </div>
                      </div>
                      <span className="hidden sm:block">
                        {res ? (
                          <span className="rounded-full bg-ok px-2 py-0.5 text-xs font-semibold whitespace-nowrap text-ok-foreground tabular-nums">{res}</span>
                        ) : (
                          <span className="text-sm text-muted-foreground">–</span>
                        )}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-9 rounded-md text-destructive/80 hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => setSteps((list) => list.filter((_, j) => j !== i))}
                        aria-label={t("removeStep")}
                      >
                        <Trash2 aria-hidden />
                      </Button>
                      {err && <p role="alert" className="col-span-full -mt-1 text-xs text-destructive">{te(err)}</p>}
                    </div>
                  );
                })}
              </div>

              {steps.length < MAX_STEPS && (
                <button
                  type="button"
                  onClick={() => setSteps((list) => [...list, { minQty: "", mode: "amount", value: "" }])}
                  className={cn(
                    "flex h-12 w-full items-center justify-center gap-1.5 text-sm font-medium text-primary outline-none hover:bg-primary/5 focus-visible:bg-primary/5",
                    steps.length > 0 && "border-t",
                  )}
                >
                  <Plus className="size-4" aria-hidden />
                  {t("addStep")}
                </button>
              )}
            </div>

            {/* which variants get these steps (products without variants have just the one row) */}
            {item.variantCount > 0 && (
              <div className="flex flex-col gap-3 border-t pt-4">
                <div>
                  <h3 className="font-semibold">{t("applyTo")} <Req /></h3>
                  <p className="text-sm text-muted-foreground">{t("applyHint")}</p>
                </div>

                {/* bordered list: "select all" header · one row per variant */}
                <div className="overflow-hidden rounded-xl border">
                  <label className="flex min-h-11 cursor-pointer items-center gap-3 border-b bg-muted/50 px-3 py-2 text-xs font-medium text-muted-foreground">
                    <Checkbox
                      checked={picked.length === item.rows.length ? true : picked.length ? "indeterminate" : false}
                      onCheckedChange={(v) => { setPicked(v === true ? item.rows.map((r) => r.key) : []); setError(undefined); }}
                      aria-label={t("pickAll")}
                    />
                    <span className="mr-auto">{t("pickAll")}</span>
                    <span className="tabular-nums">{t("picked", { count: picked.length, total: item.rows.length })}</span>
                  </label>
                  <ul className="max-h-64 divide-y overflow-y-auto">
                    {item.rows.map((r) => {
                      const on = picked.includes(r.key);
                      return (
                        <li key={r.key}>
                          <label className={cn("flex min-h-14 cursor-pointer items-center gap-3 px-3 py-2 transition-colors hover:bg-muted/50", on && "bg-primary/5")}>
                            <Checkbox checked={on} onCheckedChange={() => toggle(r.key)} />
                            <Thumb src={r.image} alt="" className="size-9 shrink-0 rounded-md" />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-medium">{r.label}</span>
                              {r.code && <span className="block truncate text-xs text-muted-foreground">{r.code}</span>}
                            </span>
                            {r.steps.length > 0 && (
                              <span className="hidden shrink-0 rounded-full bg-info px-2 py-0.5 text-xs font-semibold text-info-foreground sm:inline">{t("hasSteps")}</span>
                            )}
                            <span className="shrink-0 text-sm font-medium tabular-nums">{money(r.priceCents)}</span>
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                </div>
                {prices.length > 1 && steps.some((s) => s.mode === "amount") && (
                  <p className="text-xs text-muted-foreground">{t("mixedPrices", { price: money(lowest) })}</p>
                )}
              </div>
            )}

            {error && <p role="alert" className="text-sm text-destructive">{te(error)}</p>}
          </div>

          <DialogFooter className="flex-row gap-3 border-t px-6 py-4">
            <Button type="button" variant="outline" className="h-11 flex-1" disabled={pending} onClick={onClose}>{t("cancel")}</Button>
            <Button type="submit" className="h-11 flex-1" disabled={pending || !picked.length}>
              {pending && <Loader2 className="animate-spin" aria-hidden />}
              {t("save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
