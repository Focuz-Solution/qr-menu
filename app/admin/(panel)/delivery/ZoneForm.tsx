"use client";

import { ArrowLeft, CircleHelp, ImagePlus, Loader2, Plus, Store, Truck, Upload, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useRef, useState, useTransition } from "react";
import { Opt, Req } from "@/components/FieldMark";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { PROVINCES } from "@/lib/provinces";
import type { ErrorCode } from "@/lib/result";
import { formatPrice, pick } from "@/lib/shop";
import { cn } from "@/lib/utils";
import { saveZone } from "./actions";
import { uploadImage } from "@/lib/upload-image";
import { COURIER_PRESETS, type Courier, isPreset } from "./couriers";
import type { AdminZone } from "./types";

/** courier logo from public/couriers; a truck when there is none (or the file is missing) */
function CourierLogo({ src }: { src: string | null }) {
  const [broken, setBroken] = useState(false);
  return (
    <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted">
      {src && !broken ? (
        <Image src={src} alt="" width={32} height={32} className="size-8 object-contain" onError={() => setBroken(true)} />
      ) : (
        <Truck className="size-5 text-muted-foreground" aria-hidden />
      )}
    </span>
  );
}

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
        {aside && <div className="shrink-0 text-xs font-medium text-muted-foreground">{aside}</div>}
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

/** "$" + amount input */
function MoneyInput({ id, value, onChange, placeholder, invalid, required }: { id: string; value: string; onChange: (v: string) => void; placeholder: string; invalid: boolean; required?: boolean }) {
  return (
    <InputGroup className="h-11">
      <InputGroupAddon>
        <InputGroupText>$</InputGroupText>
      </InputGroupAddon>
      <InputGroupInput id={id} inputMode="decimal" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-invalid={invalid || undefined} aria-required={required || undefined} />
    </InputGroup>
  );
}

/** "12" / "12.5" → "$12.00"; anything else → null */
const typedPrice = (v: string) => (/^\d+(\.\d{1,2})?$/.test(v.trim()) ? formatPrice(Number(v)) : null);

/** Add / edit a delivery zone on its own page (/admin/delivery/new, /admin/delivery/<id>) */
export function ZoneForm({ zone, couriers }: { zone?: AdminZone; couriers: Courier[] }) {
  const t = useTranslations("admin.delivery");
  const te = useTranslations("errors");
  const lang = useLocale();
  const router = useRouter();
  // zones saved before `isCourier` existed are couriers when their name is a preset
  const wasCourier = !!zone && (zone.isCourier || isPreset(zone.name));
  // couriers the admin added (saved before + new ones from the dialog), each with its uploaded logo
  const [custom, setCustom] = useState<Courier[]>(() =>
    wasCourier && !isPreset(zone!.name) && !couriers.some((c) => c.name === zone!.name) ? [...couriers, { name: zone!.name, logo: zone!.courierLogo }] : couriers,
  );
  const choices = [...COURIER_PRESETS, ...custom];
  const [useCourier, setUseCourier] = useState(wasCourier);
  const [service, setService] = useState(wasCourier ? zone!.name : "");
  const [shopName, setShopName] = useState(wasCourier ? "" : zone?.name ?? "");
  const [eta, setEta] = useState(zone?.eta ?? "");
  const [adding, setAdding] = useState(false);
  const dollars = (cents: number | null | undefined) => (cents == null ? "" : String(cents / 100));
  const [fee, setFee] = useState(zone?.feeCents ? dollars(zone.feeCents) : "");
  const [freeOver, setFreeOver] = useState(dollars(zone?.freeOverCents));
  const [freeDelivery, setFreeDelivery] = useState(zone?.feeCents === 0);
  const [isActive, setIsActive] = useState(zone?.isActive ?? true);
  const [fallback, setFallback] = useState(zone?.provinceCodes.length === 0);
  const [codes, setCodes] = useState<string[]>(zone?.provinceCodes ?? []);
  const [fields, setFields] = useState<Record<string, ErrorCode>>({});
  const [formError, setFormError] = useState<ErrorCode>();
  const [pending, start] = useTransition();
  const err = (key: string) => fields[key] && <p className="text-xs text-destructive">{te(fields[key])}</p>;
  const drop = (key: string) =>
    setFields((all) => {
      const rest = { ...all };
      delete rest[key];
      return rest;
    });
  const pickCourier = (name: string) => {
    setService(name);
    drop("name");
  };

  // what the customer will see at checkout (right panel)
  const name = useCourier ? service : shopName.trim() || t("shopDelivery");
  const logo = useCourier ? choices.find((c) => c.name === service)?.logo ?? null : null;
  const feeText = freeDelivery ? t("free") : typedPrice(fee);
  const freeOverText = !freeDelivery && typedPrice(freeOver);
  const coverage = fallback
    ? t("everywhereElse")
    : codes.length
      ? PROVINCES.filter((p) => codes.includes(p.code)).map((p) => pick(p, lang)).join(", ")
      : t("previewNoProvinces");

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!fallback && !codes.length) return setFields({ provinces: "required" });
    if (useCourier && !service) return setFields({ name: "required" });
    start(async () => {
      const r = await saveZone(zone?.id ?? null, {
        name,
        provinceCodes: fallback ? [] : codes,
        fee: freeDelivery ? "0" : fee,
        freeOver: freeDelivery ? "" : freeOver,
        isCourier: useCourier,
        courierLogo: (useCourier && custom.find((c) => c.name === service)?.logo) || "",
        eta,
        isActive,
      });
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

      {/* desktop: the 3 steps on the left, preview + save sticking on the right; phones: one column, save at the end */}
      <form onSubmit={submit} noValidate className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
        <div className="flex min-w-0 flex-col gap-4">
          {/* 1. where */}
          <Section n={1} title={t("coverageTitle")} hint={t("coverageHint")} aside={!fallback && t("provinceSelection", { count: codes.length })}>
            <fieldset className="grid min-w-0 gap-2 sm:grid-cols-2">
              <legend className="sr-only">{t("coverageTitle")}</legend>
              <Choice name="coverage" checked={!fallback} onPick={() => (setFallback(false), setFields({}))} title={t("specificProvinces")} hint={t("specificProvincesHint")} />
              <Choice name="coverage" checked={fallback} onPick={() => (setFallback(true), setFields({}))} title={t("everywhereElse")} hint={t("provincesHint")} />
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

          {/* 2. who delivers */}
          <Section n={2} title={t("deliveryType")} hint={t("deliveryTypeHint")}>
            <fieldset className="grid min-w-0 gap-2 sm:grid-cols-2">
              <legend className="sr-only">{t("deliveryType")}</legend>
              <Choice name="delivery-type" checked={!useCourier} onPick={() => (setUseCourier(false), drop("name"))} title={t("shopDelivery")} hint={t("shopDeliveryHint")} />
              <Choice name="delivery-type" checked={useCourier} onPick={() => (setUseCourier(true), drop("name"))} title={t("courierDelivery")} hint={t("courierDeliveryHint")} />
            </fieldset>
            {useCourier ? (
              <fieldset className="min-w-0">
                <legend className="mb-2 text-sm font-medium">
                  {t("chooseCourier")} <Req />
                </legend>
                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                  {choices.map((c) => (
                    <label key={c.name} className="flex min-h-14 min-w-0 cursor-pointer items-center gap-2 rounded-lg border p-3 text-sm font-medium has-checked:border-primary has-checked:bg-accent has-focus-visible:ring-2 has-focus-visible:ring-ring">
                      <input type="radio" name="delivery-service" value={c.name} checked={service === c.name} onChange={() => pickCourier(c.name)} className="size-4 shrink-0 accent-primary" />
                      <CourierLogo src={c.logo} />
                      <span className="min-w-0 truncate">{c.name}</span>
                    </label>
                  ))}
                  {/* a courier that isn't in the list: added in a small dialog, then picked */}
                  <button
                    type="button"
                    onClick={() => setAdding(true)}
                    className="flex min-h-14 items-center gap-2 rounded-lg border border-dashed p-3 text-sm font-medium text-muted-foreground hover:border-primary hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                  >
                    <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted">
                      <Plus className="size-5" aria-hidden />
                    </span>
                    {t("addCourier")}
                  </button>
                </div>
              </fieldset>
            ) : (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="shop-delivery-name">
                  {t("shopDeliveryName")} <Opt />
                </Label>
                <Input id="shop-delivery-name" value={shopName} onChange={(e) => setShopName(e.target.value)} maxLength={80} placeholder={t("shopDelivery")} aria-invalid={!!fields.name || undefined} className="h-11" />
              </div>
            )}
            {err("name")}
            <div className="flex flex-col gap-1.5 sm:max-w-sm">
              <Label htmlFor="eta">
                {t("eta")} <Opt />
              </Label>
              <Input id="eta" value={eta} onChange={(e) => setEta(e.target.value)} maxLength={60} placeholder={t("etaPlaceholder")} aria-invalid={!!fields.eta || undefined} className="h-11" />
              {err("eta")}
            </div>
          </Section>

          {/* 3. price + the free-delivery condition */}
          <Section n={3} title={t("pricingTitle")} hint={t("pricingHint")}>
            <fieldset className="grid min-w-0 gap-2 sm:grid-cols-2">
              <legend className="sr-only">{t("pricingTitle")}</legend>
              <Choice name="pricing" checked={!freeDelivery} onPick={() => setFreeDelivery(false)} title={t("chargeFee")} hint={t("chargeFeeHint")} />
              <Choice name="pricing" checked={freeDelivery} onPick={() => setFreeDelivery(true)} title={t("alwaysFree")} hint={t("alwaysFreeHint")} />
            </fieldset>
            {!freeDelivery && (
              <div className="grid gap-4 sm:grid-cols-2 sm:items-start">
                <div className="flex flex-col gap-1.5">
                  {/* same row height as "Free delivery from" + its ? button, so both inputs line up */}
                  <div className="flex h-5 items-center">
                    <Label htmlFor="fee">
                      {t("fee")} <Req />
                    </Label>
                  </div>
                  <MoneyInput id="fee" value={fee} onChange={(v) => (setFee(v), drop("fee"))} placeholder="1.50" invalid={!!fields.fee} required />
                  {err("fee")}
                </div>
                <div className="flex flex-col gap-1.5">
                  <div className="flex h-5 items-center gap-1.5">
                    <Label htmlFor="freeOver">
                      {t("freeOver")} <Opt />
                    </Label>
                    {/* "?" opens a small popup with the explanation (Radix Popover: Esc / outside click close it) */}
                    <Popover>
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          aria-label={t("whatIsThis")}
                          title={t("whatIsThis")}
                          className="relative grid size-5 place-items-center rounded-full text-muted-foreground after:absolute after:-inset-3 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none data-[state=open]:text-primary"
                        >
                          <CircleHelp className="size-4" aria-hidden />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent align="start" className="w-72 gap-0.5 text-sm">
                        <p className="font-medium">{t("freeOver")}</p>
                        <p className="text-muted-foreground">{t("freeOverHint")}</p>
                      </PopoverContent>
                    </Popover>
                  </div>
                  <MoneyInput id="freeOver" value={freeOver} onChange={(v) => (setFreeOver(v), drop("freeOver"))} placeholder="30" invalid={!!fields.freeOver} />
                  {err("freeOver")}
                </div>
              </div>
            )}
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
              {/* the same row the customer picks at checkout */}
              <div className={cn("flex min-h-14 items-center gap-3 rounded-lg border px-3 py-2 text-sm", !isActive && "opacity-60")}>
                {useCourier ? <CourierLogo src={logo} /> : (
                  <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted">
                    <Store className="size-5 text-muted-foreground" aria-hidden />
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className={cn("block truncate font-medium", !name && "text-muted-foreground")}>{name || t("previewNoService")}</span>
                  {eta && <span className="block truncate text-xs text-muted-foreground">{eta}</span>}
                  {freeOverText && <span className="block text-xs text-primary">{t("previewFreeFrom", { amount: freeOverText })}</span>}
                </span>
                <span className="shrink-0 font-medium tabular-nums">{feeText ?? "—"}</span>
              </div>
              <dl className="flex flex-col gap-2 text-sm">
                <div className="flex gap-3">
                  <dt className="w-24 shrink-0 text-muted-foreground">{t("provinces")}</dt>
                  <dd className="line-clamp-3 min-w-0">{coverage}</dd>
                </div>
              </dl>
              <Label className="flex min-h-11 items-center gap-3 border-t pt-3">
                <Switch checked={isActive} onCheckedChange={setIsActive} />
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

      <AddCourierDialog
        open={adding}
        onClose={() => setAdding(false)}
        onAdd={(added) => {
          const existing = choices.find((c) => c.name.toLowerCase() === added.name.toLowerCase());
          // new → added; one added before → its logo replaced (when a new one was uploaded); ready-made → just picked
          if (!existing) setCustom((all) => [...all, added]);
          else if (added.logo && !isPreset(existing.name)) setCustom((all) => all.map((c) => (c.name === existing.name ? { ...c, logo: added.logo } : c)));
          pickCourier(existing?.name ?? added.name);
          setAdding(false);
        }}
      />
    </div>
  );
}

/** "Add courier": logo (optional, uploaded to R2 right away) + name; saved with the zone and offered again next time */
function AddCourierDialog({ open, onClose, onAdd }: { open: boolean; onClose: () => void; onAdd: (courier: Courier) => void }) {
  const t = useTranslations("admin.delivery");
  const te = useTranslations("errors");
  const [name, setName] = useState("");
  const [logo, setLogo] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<{ name?: boolean; logo?: ErrorCode }>({});
  const fileInput = useRef<HTMLInputElement>(null);
  const close = () => {
    setName("");
    setLogo(null);
    setError({});
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      {/* header and footer with a line under / over them, like the other admin dialogs */}
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-md">
        {/* its own form: Enter adds the courier, not the zone */}
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (!name.trim()) return setError({ name: true });
            onAdd({ name: name.trim(), logo });
            setName("");
            setLogo(null);
          }}
          className="flex flex-col"
        >
          <DialogHeader className="border-b px-6 pt-6 pb-4">
            <DialogTitle>{t("addCourier")}</DialogTitle>
            <DialogDescription className="sr-only">{t("addCourierHint")}</DialogDescription>
          </DialogHeader>
          {/* logo on top, then the name */}
          <div className="flex flex-col gap-5 px-6 py-5">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="courier-logo">
                {t("courierLogo")} <Opt />
              </Label>
              <input
                ref={fileInput}
                id="courier-logo"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (!file) return;
                  setUploading(true);
                  setError({});
                  uploadImage(file).then((r) => {
                    setUploading(false);
                    if ("url" in r) setLogo(r.url);
                    else setError({ logo: r.error });
                  });
                }}
              />
              {/* preview tile (just shows the logo) + Upload/Change · Remove + format hint; only the button uploads */}
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    "grid size-16 shrink-0 place-items-center overflow-hidden rounded-lg border bg-muted text-muted-foreground",
                    !logo && "border-dashed",
                    error.logo && "border-destructive",
                  )}
                >
                  {uploading ? (
                    <Loader2 className="size-5 animate-spin" aria-hidden />
                  ) : logo ? (
                    <Image src={logo} alt="" width={64} height={64} className="size-full bg-background object-contain p-1.5" />
                  ) : (
                    <ImagePlus className="size-6" aria-hidden />
                  )}
                </div>
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="outline" size="xs" className="relative after:absolute after:-inset-2.5" onClick={() => fileInput.current?.click()} disabled={uploading}>
                      {uploading ? <Loader2 className="animate-spin" aria-hidden /> : <Upload aria-hidden />}
                      {t(logo ? "changeLogo" : "uploadLogo")}
                    </Button>
                    {logo && !uploading && (
                      <Button type="button" variant="ghost" size="xs" className="relative after:absolute after:-inset-2.5" onClick={() => setLogo(null)}>
                        <X aria-hidden />
                        {t("removeLogo")}
                      </Button>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">{t("logoHint")}</p>
                </div>
              </div>
              {error.logo && <p className="text-xs text-destructive">{te(error.logo)}</p>}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="courier-name">
                {t("otherCourierName")} <Req />
              </Label>
              <Input
                id="courier-name"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setError((x) => ({ ...x, name: false }));
                }}
                aria-required
                maxLength={80}
                placeholder={t("otherCourierPlaceholder")}
                aria-invalid={error.name || undefined}
                className="h-11"
                autoFocus
              />
              {error.name && <p className="text-xs text-destructive">{te("required")}</p>}
            </div>
          </div>

          <DialogFooter className="flex-row border-t px-6 py-4">
            <Button type="button" variant="outline" className="h-11 flex-1" onClick={close}>
              {t("cancel")}
            </Button>
            <Button type="submit" className="h-11 flex-1" disabled={uploading}>
              {t("addCourier")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
