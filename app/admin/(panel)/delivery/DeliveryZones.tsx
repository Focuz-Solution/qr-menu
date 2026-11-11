"use client";

import { Pencil, Plus, Trash2 } from "lucide-react";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { useOptimistic, useState, useTransition } from "react";
import { Opt, Req } from "@/components/FieldMark";
import { Pager, paginate } from "@/components/Pager";
import { type Sort, SortHead } from "@/components/SortHead";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DeleteConfirmDialog } from "@/components/DeleteConfirmDialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatPrice, pick } from "@/lib/shop";
import { PROVINCES } from "@/lib/provinces";
import type { ErrorCode } from "@/lib/result";
import { cn } from "@/lib/utils";
import { deleteZone, saveZone, setZoneActive } from "./actions";
import type { AdminZone } from "./types";

const money = (cents: number) => formatPrice(cents / 100);

const PAGE_SIZE = 20;
type SortKey = "name" | "provinces" | "fee" | "freeOver" | "active";
const compare: Record<SortKey, (a: AdminZone, b: AdminZone) => number> = {
  name: (a, b) => a.name.localeCompare(b.name),
  // "all other provinces" (no codes) sorts last
  provinces: (a, b) => (a.provinceCodes.length || 99) - (b.provinceCodes.length || 99),
  fee: (a, b) => a.feeCents - b.feeCents,
  freeOver: (a, b) => (a.freeOverCents ?? Infinity) - (b.freeOverCents ?? Infinity),
  active: (a, b) => Number(a.isActive) - Number(b.isActive),
};

export function DeliveryZones({ zones }: { zones: AdminZone[] }) {
  const t = useTranslations("admin.delivery");
  const te = useTranslations("errors");
  const lang = useLocale();
  const [deleting, setDeleting] = useState<AdminZone | null>(null);
  const [deleteError, setDeleteError] = useState<ErrorCode>();
  const [editing, setEditing] = useState<AdminZone | "new" | null>(null);
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
        <Button size="sm" onClick={() => setEditing("new")}>
          <Plus aria-hidden />
          {t("add")}
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
              <SortHead k="name" sort={sort} onSort={onSort} className="w-[26%] pl-4">{t("name")}</SortHead>
              <SortHead k="provinces" sort={sort} onSort={onSort} className="hidden w-[32%] md:table-cell">{t("provinces")}</SortHead>
              <SortHead k="fee" sort={sort} onSort={onSort} className="w-[12%] text-right">{t("colFee")}</SortHead>
              <SortHead k="freeOver" sort={sort} onSort={onSort} className="hidden w-[14%] text-right sm:table-cell">{t("colFreeOver")}</SortHead>
              <SortHead k="active" sort={sort} onSort={onSort} className="w-[10%]">{t("active")}</SortHead>
              <TableHead className="pr-4 text-right">{t("actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((z) => (
              <TableRow key={z.id} className={cn("h-14", !z.isActive && "opacity-60")}>
                <TableCell className="max-w-0 pl-4">
                  <p className="truncate font-medium">{z.name}</p>
                  {z.eta && <p className="truncate text-xs text-muted-foreground">{z.eta}</p>}
                </TableCell>
                <TableCell className="hidden max-w-0 md:table-cell">
                  <p className="truncate text-muted-foreground">{provinceNames(z.provinceCodes)}</p>
                </TableCell>
                <TableCell className="text-right font-medium tabular-nums">{z.feeCents ? money(z.feeCents) : t("free")}</TableCell>
                <TableCell className="hidden text-right text-muted-foreground tabular-nums sm:table-cell">
                  {z.freeOverCents != null ? money(z.freeOverCents) : "—"}
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
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="rounded-md text-muted-foreground hover:text-foreground"
                      onClick={() => setEditing(z)}
                      aria-label={`${t("edit")}: ${z.name}`}
                      title={t("edit")}
                    >
                      <Pencil aria-hidden />
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
                <TableCell colSpan={6} className="py-12">
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

      {/* add/edit zone: centred dialog; header + footer stay put, the fields scroll */}
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

      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="flex max-h-[90dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
          {editing && (
            <ZoneForm
              key={editing === "new" ? "new" : editing.id}
              zone={editing === "new" ? undefined : editing}
              onClose={() => setEditing(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

const courierPresets = [
  { name: "J&T Express", logo: "/couriers/jt-express.png" },
  { name: "Vireak Buntham Express", logo: "/couriers/vet-express.png" },
];

function ZoneForm({ zone, onClose }: { zone?: AdminZone; onClose: () => void }) {
  const t = useTranslations("admin.delivery");
  const te = useTranslations("errors");
  const lang = useLocale();
  const existingCourier = courierPresets.find((preset) => preset.name === zone?.name);
  const [useCourier, setUseCourier] = useState(!!existingCourier);
  const [service, setService] = useState(existingCourier?.name ?? "");
  const [shopName, setShopName] = useState(existingCourier ? "" : zone?.name ?? "");
  const [freeDelivery, setFreeDelivery] = useState(zone?.feeCents === 0);
  const [fallback, setFallback] = useState(zone?.provinceCodes.length === 0);
  const [codes, setCodes] = useState<string[]>(zone?.provinceCodes ?? []);
  const [fields, setFields] = useState<Record<string, ErrorCode>>({});
  const [formError, setFormError] = useState<ErrorCode>();
  const [pending, start] = useTransition();
  const dollars = (cents: number | null | undefined) => (cents == null ? "" : String(cents / 100));
  const [fee, setFee] = useState(zone?.feeCents ? dollars(zone.feeCents) : "");
  const err = (key: string) => fields[key] && <p className="text-xs text-destructive">{te(fields[key])}</p>;

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!fallback && !codes.length) {
      setFields({ provinces: "required" });
      return;
    }
    const f = new FormData(e.currentTarget);
    start(async () => {
      const r = await saveZone(zone?.id ?? null, {
        name: useCourier ? service : shopName.trim() || t("shopDelivery"),
        provinceCodes: fallback ? [] : codes,
        fee: freeDelivery ? "0" : fee,
        freeOver: freeDelivery ? "" : dollars(zone?.freeOverCents),
        eta: zone?.eta ?? "",
        isActive: f.get("isActive") === "on",
      });
      if (r.ok) return onClose();
      setFields(r.fields ?? {});
      setFormError(r.fields ? undefined : r.error);
    });
  }

  return (
    <form onSubmit={submit} noValidate className="flex min-h-0 flex-1 flex-col">
      <DialogHeader className="border-b px-6 pt-6 pb-4">
        <DialogTitle className="text-lg">{zone ? t("edit") : t("add")}</DialogTitle>
        <DialogDescription className="sr-only">{zone ? t("edit") : t("add")}</DialogDescription>
      </DialogHeader>

      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-6 py-5">
        <fieldset className="min-w-0 space-y-2">
          <legend className="mb-2 text-sm font-semibold">{t("coverageTitle")}</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {[false, true].map((allOther) => (
              <label key={String(allOther)} className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm has-checked:border-primary has-checked:bg-accent">
                <input type="radio" name="coverage" checked={fallback === allOther} onChange={() => {
                  setFallback(allOther);
                  setFields({});
                }} className="size-4 shrink-0 accent-primary" />
                {t(allOther ? "everywhereElse" : "specificProvinces")}
              </label>
            ))}
          </div>
          {fallback ? (
            <p className="text-xs text-muted-foreground">{t("provincesHint")}</p>
          ) : (
            <>
              <p className="text-xs text-muted-foreground">{t("provinceSelection", { count: codes.length })}</p>
              <div className="grid max-h-44 grid-cols-2 gap-x-3 overflow-y-auto rounded-lg border px-3 sm:grid-cols-3">
                {PROVINCES.map((p) => (
                  <Label key={p.code} className="flex min-h-11 items-center gap-2 font-normal">
                    <Checkbox
                      checked={codes.includes(p.code)}
                      onCheckedChange={(checked) => {
                        setCodes((all) => checked ? [...all, p.code] : all.filter((code) => code !== p.code));
                        setFields({});
                      }}
                    />
                    {pick(p, lang)}
                  </Label>
                ))}
              </div>
            </>
          )}
          {err("provinces")}
        </fieldset>

        <div className="grid gap-y-4 border-t pt-4 sm:grid-cols-2">
          <fieldset className="min-w-0 space-y-2 sm:col-span-2">
            <legend className="mb-2 text-sm font-medium">{t("deliveryType")}</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {[false, true].map((courier) => (
                <label key={String(courier)} className="flex min-h-11 cursor-pointer items-start gap-2 rounded-lg border p-3 text-sm has-checked:border-primary has-checked:bg-accent">
                  <input type="radio" name="delivery-type" checked={useCourier === courier} onChange={() => {
                    setUseCourier(courier);
                    setFields({});
                  }} className="mt-0.5 size-4 shrink-0 accent-primary" />
                  <span>
                    <span className="block font-medium">{t(courier ? "courierDelivery" : "shopDelivery")}</span>
                    <span className="block text-xs text-muted-foreground">{t(courier ? "courierDeliveryHint" : "shopDeliveryHint")}</span>
                  </span>
                </label>
              ))}
            </div>
            {useCourier ? (
              <fieldset className="min-w-0">
                <legend className="mb-2 text-sm font-medium">{t("chooseCourier")} <Req /></legend>
                <div className="grid gap-2 sm:grid-cols-2">
                  {courierPresets.map(({ name, logo }) => (
                    <label key={name} className="flex min-w-0 cursor-pointer items-center gap-2 rounded-lg border p-3 text-sm font-medium has-checked:border-primary has-checked:bg-accent has-focus-visible:ring-2 has-focus-visible:ring-ring">
                      <input
                        type="radio"
                        name="delivery-service"
                        value={name}
                        checked={service === name}
                        onChange={() => {
                          setService(name);
                          setFields((current) => {
                            const next = { ...current };
                            delete next.name;
                            return next;
                          });
                        }}
                        required
                        className="size-4 shrink-0 accent-primary"
                      />
                      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted">
                        <Image src={logo} alt="" width={32} height={32} className="size-8 object-contain" />
                      </span>
                      <span>{name}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            ) : (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="shop-delivery-name">{t("shopDeliveryName")} <Opt /></Label>
                <Input id="shop-delivery-name" value={shopName} onChange={(e) => setShopName(e.target.value)} maxLength={80} placeholder={t("shopDelivery")} aria-invalid={!!fields.name || undefined} className="h-11" />
              </div>
            )}
            {err("name")}
          </fieldset>
          <fieldset className="min-w-0 space-y-2 border-t pt-4 sm:col-span-2">
            <legend className="sr-only">{t("pricingTitle")}</legend>
            <p className="text-sm font-semibold" aria-hidden>{t("pricingTitle")}</p>
            <div className="flex flex-wrap items-center gap-x-5">
              <Label className="flex min-h-11 items-center gap-2.5">
                <Switch checked={freeDelivery} onCheckedChange={setFreeDelivery} />
                {t("freeDeliveryToggle")}
              </Label>
              <Label className="flex min-h-11 items-center gap-2.5">
                <Switch name="isActive" defaultChecked={zone?.isActive ?? true} />
                {t("active")}
              </Label>
            </div>
            {!freeDelivery && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="fee">{t("fee")} <Req /></Label>
                <Input id="fee" name="fee" aria-required inputMode="decimal" placeholder={t("feePlaceholder")} value={fee}
                  onChange={(e) => setFee(e.target.value)} aria-invalid={!!fields.fee || undefined} className="h-11" />
                {err("fee")}
              </div>
            )}
          </fieldset>
        </div>

        {formError && <p role="alert" className="text-sm text-destructive">{te(formError)}</p>}
      </div>

      <DialogFooter className="flex-row border-t px-6 py-4">
        <Button type="button" variant="outline" className="h-11 flex-1" onClick={onClose}>{t("cancel")}</Button>
        <Button type="submit" className="h-11 flex-1" disabled={pending}>{t("save")}</Button>
      </DialogFooter>
    </form>
  );
}
