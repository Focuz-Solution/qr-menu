"use client";

import { ArrowLeft, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Req } from "@/components/FieldMark";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { feeFor, type DeliveryOption } from "@/lib/orders";
import { PROVINCES } from "@/lib/provinces";
import type { ErrorCode } from "@/lib/result";
import { formatPrice, pick } from "@/lib/shop";
import { cn } from "@/lib/utils";
import { saveZone } from "./actions";
import { CarrierDialog, CourierLogo } from "./CarrierDialog";
import { type Courier, isPreset, presetLogo } from "./couriers";
import type { AdminCarrier, AdminZone, CarrierInput } from "./types";

const money = (cents: number) => formatPrice(cents / 100);
const dollars = (cents: number) => String(cents / 100);
const cents = (v: string) => Math.round(Number(v) * 100);

/** a saved carrier → what its dialog edits (money in dollars; ready-made couriers keep no logo of their own) */
const toInput = (c: AdminCarrier): CarrierInput => ({
  name: c.name,
  isCourier: c.isCourier,
  logo: c.isCourier && !isPreset(c.name) ? (c.logo ?? "") : "",
  eta: c.eta,
  fee: dollars(c.feeCents),
  steps: c.steps.map((s) => ({ from: dollars(s.fromCents), fee: dollars(s.feeCents) })),
  payDriver: c.payDriver,
});

/** a typed carrier → the checkout's shape, for the preview and the fee summary */
const toOption = (c: CarrierInput, i: number): DeliveryOption => ({
  id: String(i),
  name: c.name,
  isCourier: c.isCourier,
  logo: c.isCourier ? (isPreset(c.name) ? presetLogo(c.name) : c.logo || null) : null,
  eta: c.eta,
  feeCents: cents(c.fee),
  steps: c.steps.map((s) => ({ fromCents: cents(s.from), feeCents: cents(s.fee) })),
  payDriver: c.payDriver,
});

/** numbered step card: number + title + one-line help on the left, a short summary on the right */
function Section({ n, title, hint, aside, children }: { n: number; title: string; hint: string; aside?: React.ReactNode; children: React.ReactNode }) {
  return (
    <Card className="gap-0 py-0">
      <div className="flex items-start gap-3 border-b px-4 py-3 md:px-5">
        <span className="grid size-7 shrink-0 place-items-center rounded-full bg-primary text-xs font-semibold text-primary-foreground" aria-hidden>
          {n}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold">{title}</h2>
          <p className="text-xs text-muted-foreground">{hint}</p>
        </div>
        {aside && <div className="shrink-0">{aside}</div>}
      </div>
      <div className="flex flex-col gap-4 p-4 md:p-5">{children}</div>
    </Card>
  );
}

/** a big radio choice: title + hint, highlighted when picked */
function Choice({ name, checked, onPick, title, hint }: { name: string; checked: boolean; onPick: () => void; title: string; hint: string }) {
  return (
    <label className="flex min-h-11 cursor-pointer items-start gap-2.5 rounded-lg border p-3 text-sm has-checked:border-primary has-checked:bg-accent has-focus-visible:ring-2 has-focus-visible:ring-ring">
      <input type="radio" name={name} checked={checked} onChange={onPick} className="mt-0.5 size-4 shrink-0 accent-primary" />
      <span>
        <span className="block font-medium">{title}</span>
        <span className="block text-xs text-muted-foreground">{hint}</span>
      </span>
    </label>
  );
}

/** Add / edit a delivery zone on its own page (/admin/delivery/new, /admin/delivery/<id>): area + its delivery options */
export function ZoneForm({ zone, couriers }: { zone?: AdminZone; couriers: Courier[] }) {
  const t = useTranslations("admin.delivery");
  const te = useTranslations("errors");
  const lang = useLocale();
  const router = useRouter();
  const [name, setName] = useState(zone?.name ?? "");
  const [isActive, setIsActive] = useState(zone?.isActive ?? true);
  const [fallback, setFallback] = useState(zone?.provinceCodes.length === 0);
  const [codes, setCodes] = useState<string[]>(zone?.provinceCodes ?? []);
  const [carriers, setCarriers] = useState<CarrierInput[]>(() => zone?.carriers.map(toInput) ?? []);
  // couriers the admin added (saved before + new ones from the dialog), each with its uploaded logo
  const [custom, setCustom] = useState<Courier[]>(couriers);
  // the carrier dialog: which one is edited (-1 = a new one); `n` remounts it fresh each time it opens
  const [editing, setEditing] = useState<{ i: number; n: number } | null>(null);
  const [fields, setFields] = useState<Record<string, ErrorCode>>({});
  const [formError, setFormError] = useState<ErrorCode>();
  const [pending, start] = useTransition();
  const err = (key: string) => fields[key] && <p className="text-xs text-destructive">{te(fields[key])}</p>;
  const drop = (...keys: string[]) =>
    setFields((all) => {
      const rest = { ...all };
      for (const key of keys) delete rest[key];
      return rest;
    });
  // carrier errors are per position: any change to the list drops them all
  const dropCarrierErrors = () => setFields((all) => Object.fromEntries(Object.entries(all).filter(([k]) => !k.startsWith("carrier"))));

  const options = carriers.map(toOption);
  const coverage = fallback
    ? t("everywhereElse")
    : codes.length
      ? PROVINCES.filter((p) => codes.includes(p.code)).map((p) => pick(p, lang)).join(", ")
      : t("previewNoProvinces");

  /** "$1.50 · from $50: $1.00 · from $100: Free" */
  const feeSummary = (o: DeliveryOption) =>
    [o.feeCents ? money(o.feeCents) : t("free"), ...o.steps.map((s) => t("stepSummary", { amount: money(s.fromCents), fee: s.feeCents ? money(s.feeCents) : t("free") }))].join(" · ");

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const found: Record<string, ErrorCode> = {};
    if (!name.trim()) found.name = "required";
    if (!fallback && !codes.length) found.provinces = "required";
    if (!carriers.length) found.carriers = "carrierNeeded";
    if (Object.keys(found).length) return setFields(found);
    start(async () => {
      const r = await saveZone(zone?.id ?? null, { name: name.trim(), provinceCodes: fallback ? [] : codes, isActive, carriers });
      if (r.ok) return router.push("/admin/delivery");
      setFields(r.fields ?? {});
      setFormError(r.fields ? undefined : r.error);
    });
  }

  return (
    <div>
      <Link href="/admin/delivery" className="-ml-1 mb-2 inline-flex min-h-11 items-center gap-2 rounded-md px-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden />
        {t("title")}
      </Link>
      <h1 className="font-heading text-2xl font-medium md:text-3xl">{zone ? t("edit") : t("add")}</h1>
      <p className="mb-4 text-sm text-muted-foreground">{t("formIntro")}</p>

      {/* desktop: the steps on the left, preview + save sticking on the right; phones: one column, save at the end */}
      <form onSubmit={submit} noValidate className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
        <div className="flex min-w-0 flex-col gap-4">
          {/* 1. the area: name + provinces */}
          <Section
            n={1}
            title={t("coverageTitle")}
            hint={t("coverageHint")}
            aside={!fallback && <span className="text-xs font-medium text-muted-foreground">{t("provinceSelection", { count: codes.length })}</span>}
          >
            <div className="flex flex-col gap-1.5 sm:max-w-sm">
              <Label htmlFor="zone-name">
                {t("zoneName")} <Req />
              </Label>
              <Input id="zone-name" value={name} onChange={(e) => (setName(e.target.value), drop("name"))} maxLength={80} placeholder={t("zoneNamePlaceholder")} aria-required aria-invalid={!!fields.name || undefined} className="h-11" />
              {err("name")}
            </div>
            <fieldset className="grid min-w-0 gap-2 sm:grid-cols-2">
              <legend className="sr-only">{t("coverageTitle")}</legend>
              <Choice name="coverage" checked={!fallback} onPick={() => (setFallback(false), drop("provinces"))} title={t("specificProvinces")} hint={t("specificProvincesHint")} />
              <Choice name="coverage" checked={fallback} onPick={() => (setFallback(true), drop("provinces"))} title={t("everywhereElse")} hint={t("provincesHint")} />
            </fieldset>
            {!fallback && (
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <p className="mr-auto text-sm font-medium">
                    {t("provinces")} <Req />
                  </p>
                  <Button type="button" variant="outline" size="sm" onClick={() => (setCodes(PROVINCES.map((p) => p.code)), drop("provinces"))}>
                    {t("selectAll")}
                  </Button>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setCodes([])} disabled={!codes.length}>
                    {t("clearAll")}
                  </Button>
                </div>
                <div className={cn("grid grid-cols-2 gap-x-3 rounded-lg border px-3 sm:grid-cols-3 xl:grid-cols-4", fields.provinces && "border-destructive")}>
                  {PROVINCES.map((p) => (
                    <Label key={p.code} className="flex min-h-11 items-center gap-2 font-normal">
                      <Checkbox
                        checked={codes.includes(p.code)}
                        onCheckedChange={(checked) => {
                          setCodes((all) => (checked ? [...all, p.code] : all.filter((code) => code !== p.code)));
                          drop("provinces");
                        }}
                      />
                      {pick(p, lang)}
                    </Label>
                  ))}
                </div>
              </div>
            )}
            {err("provinces")}
          </Section>

          {/* 2. the delivery options in this area */}
          <Section
            n={2}
            title={t("carriersTitle")}
            hint={t("carriersHint")}
            aside={
              carriers.length < 10 && (
                <Button type="button" variant="outline" size="sm" onClick={() => setEditing({ i: -1, n: Date.now() })}>
                  <Plus aria-hidden />
                  {t("addCarrier")}
                </Button>
              )
            }
          >
            {carriers.length ? (
              <ul className="flex flex-col gap-2">
                {options.map((o, i) => (
                  <li key={i} className="flex flex-col gap-1">
                    <div className={cn("flex min-h-14 items-center gap-3 rounded-lg border px-3 py-2 text-sm", fields[`carrier-${i}`] && "border-destructive")}>
                      <CourierLogo src={o.logo} shop={!o.isCourier} />
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                          <span className="truncate font-medium">{o.name}</span>
                          {o.payDriver && <Badge variant="secondary">{t("payDriverBadge")}</Badge>}
                        </span>
                        <span className="block text-xs text-muted-foreground tabular-nums">{feeSummary(o)}</span>
                        {o.eta && <span className="block truncate text-xs text-muted-foreground">{o.eta}</span>}
                      </span>
                      <Button type="button" variant="ghost" size="icon-sm" className="rounded-md text-muted-foreground hover:text-foreground" aria-label={`${t("editCarrier")}: ${o.name}`} title={t("editCarrier")} onClick={() => setEditing({ i, n: Date.now() })}>
                        <Pencil aria-hidden />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        className="rounded-md text-destructive/80 hover:bg-destructive/10 hover:text-destructive"
                        aria-label={`${t("removeCarrier")}: ${o.name}`}
                        title={t("removeCarrier")}
                        onClick={() => (setCarriers((all) => all.filter((_, j) => j !== i)), dropCarrierErrors())}
                      >
                        <Trash2 aria-hidden />
                      </Button>
                    </div>
                    {err(`carrier-${i}`)}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="rounded-lg border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">{t("noCarriers")}</p>
            )}
            {err("carriers")}
          </Section>
        </div>

        {/* right: how it looks at checkout, on/off, save */}
        <aside className="flex flex-col gap-4 lg:sticky lg:top-4">
          <Card className="gap-0 py-0">
            <div className="border-b px-4 py-3 md:px-5">
              <h2 className="text-sm font-semibold">{t("previewTitle")}</h2>
              <p className="text-xs text-muted-foreground">{t("previewHint")}</p>
            </div>
            <div className="flex flex-col gap-4 p-4 md:p-5">
              {/* the rows the customer picks from at checkout (fee for a small order) */}
              <div className={cn("flex flex-col gap-2", !isActive && "opacity-60")}>
                {options.length ? (
                  options.map((o, i) => (
                    <div key={i} className="flex min-h-14 items-center gap-3 rounded-lg border px-3 py-2 text-sm">
                      <CourierLogo src={o.logo} shop={!o.isCourier} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{o.name}</span>
                        {o.eta && <span className="block truncate text-xs text-muted-foreground">{o.eta}</span>}
                        {o.steps[0] && (
                          <span className="block text-xs text-primary">{t("stepSummary", { amount: money(o.steps[0].fromCents), fee: o.steps[0].feeCents ? money(o.steps[0].feeCents) : t("free") })}</span>
                        )}
                      </span>
                      <span className="shrink-0 font-medium tabular-nums">{feeFor(o, 0) ? money(feeFor(o, 0)) : t("free")}</span>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">{t("noCarriers")}</p>
                )}
              </div>
              <dl className="flex flex-col gap-2 text-sm">
                <div className="flex gap-3">
                  <dt className="w-24 shrink-0 text-muted-foreground">{t("provinces")}</dt>
                  <dd className="line-clamp-3 min-w-0">{coverage}</dd>
                </div>
              </dl>
              <Label className="flex min-h-11 items-center gap-3 border-t pt-3">
                <Switch checked={isActive} onCheckedChange={(on) => (setIsActive(on), dropCarrierErrors())} />
                <span>
                  <span className="block font-medium">{t("active")}</span>
                  <span className="block text-xs font-normal text-muted-foreground">{t("activeHint")}</span>
                </span>
              </Label>
            </div>
          </Card>

          {formError && (
            <p role="alert" className="text-sm text-destructive">
              {te(formError)}
            </p>
          )}
          <div className="flex gap-3">
            <Button asChild variant="outline" className="h-11 flex-1">
              <Link href="/admin/delivery">{t("cancel")}</Link>
            </Button>
            <Button type="submit" className="h-11 flex-1" disabled={pending}>
              {pending && <Loader2 className="animate-spin" aria-hidden />}
              {t("save")}
            </Button>
          </div>
        </aside>
      </form>

      {editing && (
        <CarrierDialog
          key={editing.n}
          open
          initial={editing.i >= 0 ? carriers[editing.i] : null}
          couriers={custom}
          taken={carriers.filter((_, j) => j !== editing.i).map((c) => c.name)}
          onClose={() => setEditing(null)}
          onNewCourier={(added) => setCustom((all) => [...all.filter((c) => c.name !== added.name), added])}
          onSave={(carrier) => {
            setCarriers((all) => (editing.i >= 0 ? all.map((c, j) => (j === editing.i ? carrier : c)) : [...all, carrier]));
            dropCarrierErrors();
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}
