"use client";

import { ImagePlus, Loader2, Plus, Store, Trash2, Truck, Upload, X } from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { Opt, Req } from "@/components/FieldMark";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { ErrorCode } from "@/lib/result";
import { cn } from "@/lib/utils";
import { uploadImage } from "@/lib/upload-image";
import { COURIER_PRESETS, type Courier, isPreset } from "./couriers";
import type { CarrierInput } from "./types";

/** courier logo (ready-made file or upload); a truck when there is none, a shop icon for shop delivery */
export function CourierLogo({ src, shop }: { src: string | null; shop?: boolean }) {
  const [broken, setBroken] = useState(false);
  const Icon = shop ? Store : Truck;
  return (
    <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted">
      {src && !broken ? (
        <Image src={src} alt="" width={32} height={32} className="size-8 object-contain" onError={() => setBroken(true)} />
      ) : (
        <Icon className="size-5 text-muted-foreground" aria-hidden />
      )}
    </span>
  );
}

/** "$" + amount input */
function MoneyInput({ id, value, onChange, placeholder, invalid, required, label }: { id: string; value: string; onChange: (v: string) => void; placeholder: string; invalid: boolean; required?: boolean; label?: string }) {
  return (
    <InputGroup className="h-11">
      <InputGroupAddon>
        <InputGroupText>$</InputGroupText>
      </InputGroupAddon>
      <InputGroupInput id={id} inputMode="decimal" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={label} aria-invalid={invalid || undefined} aria-required={required || undefined} />
    </InputGroup>
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

const money = /^\d+(\.\d{1,2})?$/;
export const EMPTY_CARRIER: CarrierInput = { name: "", isCourier: false, logo: "", eta: "", fee: "", steps: [], payDriver: false };

/**
 * Add / edit one delivery option of a zone: who delivers (shop or a courier), delivery time, the fee,
 * price steps by order total, and whether the customer may pay the driver. Kept in the zone form until Save.
 */
export function CarrierDialog({
  open,
  initial,
  couriers,
  taken,
  onClose,
  onSave,
  onNewCourier,
}: {
  open: boolean;
  /** null = a new one */
  initial: CarrierInput | null;
  /** added couriers (ready-made ones come from COURIER_PRESETS) */
  couriers: Courier[];
  /** names already used by the zone's other options */
  taken: string[];
  onClose: () => void;
  onSave: (carrier: CarrierInput) => void;
  onNewCourier: (courier: Courier) => void;
}) {
  const t = useTranslations("admin.delivery");
  const te = useTranslations("errors");
  const start = initial ?? EMPTY_CARRIER;
  const [c, setC] = useState<CarrierInput>(start);
  const [shopName, setShopName] = useState(start.isCourier ? "" : start.name);
  const [errors, setErrors] = useState<Record<string, ErrorCode>>({});
  const [adding, setAdding] = useState(false);
  const choices = [...COURIER_PRESETS, ...couriers];
  const set = (patch: Partial<CarrierInput>) => setC((x) => ({ ...x, ...patch }));
  const err = (key: string) => errors[key] && <p className="text-xs text-destructive">{te(errors[key])}</p>;
  const drop = (key: string) =>
    setErrors((all) => {
      const rest = { ...all };
      delete rest[key];
      return rest;
    });

  function save(e: React.FormEvent) {
    e.preventDefault();
    e.stopPropagation(); // its own form inside the zone form
    const name = c.isCourier ? c.name : shopName.trim() || t("shopDelivery");
    const steps = c.steps.filter((s) => s.from.trim() || s.fee.trim());
    const found: Record<string, ErrorCode> = {};
    if (c.isCourier && !c.name) found.name = "required";
    else if (taken.some((n) => n.toLowerCase() === name.toLowerCase())) found.name = "duplicateCarrier";
    if (!money.test(c.fee.trim())) found.fee = "badPrice";
    steps.forEach((s, i) => {
      if (!money.test(s.from.trim()) || Number(s.from) <= 0 || !money.test(s.fee.trim())) found[`step-${i}`] = "badPrice";
    });
    if (new Set(steps.map((s) => Number(s.from))).size !== steps.length) found.steps = "duplicateStep";
    setErrors(found);
    if (Object.keys(found).length) return;
    // lowest amount first, like checkout reads them
    onSave({ ...c, name, logo: c.isCourier ? c.logo : "", payDriver: c.isCourier && c.payDriver, fee: c.fee.trim(), steps: steps.toSorted((a, b) => Number(a.from) - Number(b.from)) });
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-xl">
        <form noValidate onSubmit={save} className="flex max-h-[90dvh] flex-col">
          <DialogHeader className="border-b px-6 pt-6 pb-4">
            <DialogTitle>{t(initial ? "editCarrier" : "addCarrier")}</DialogTitle>
            <DialogDescription>{t("carrierDialogHint")}</DialogDescription>
          </DialogHeader>

          <div className="flex min-h-0 flex-col gap-5 overflow-y-auto px-6 py-5">
            {/* who delivers */}
            <fieldset className="grid min-w-0 gap-2 sm:grid-cols-2">
              <legend className="mb-2 text-sm font-medium">{t("deliveryType")}</legend>
              <Choice name="carrier-type" checked={!c.isCourier} onPick={() => (set({ isCourier: false, payDriver: false }), setErrors({}))} title={t("shopDelivery")} hint={t("shopDeliveryHint")} />
              <Choice name="carrier-type" checked={c.isCourier} onPick={() => (set({ isCourier: true }), setErrors({}))} title={t("courierDelivery")} hint={t("courierDeliveryHint")} />
            </fieldset>

            {c.isCourier ? (
              <fieldset className="min-w-0">
                <legend className="mb-2 text-sm font-medium">
                  {t("chooseCourier")} <Req />
                </legend>
                <div className="grid gap-2 sm:grid-cols-2">
                  {choices.map((x) => (
                    <label key={x.name} className="flex min-h-14 min-w-0 cursor-pointer items-center gap-2 rounded-lg border p-3 text-sm font-medium has-checked:border-primary has-checked:bg-accent has-focus-visible:ring-2 has-focus-visible:ring-ring">
                      <input
                        type="radio"
                        name="carrier-courier"
                        checked={c.name === x.name}
                        onChange={() => (set({ name: x.name, logo: isPreset(x.name) ? "" : (x.logo ?? "") }), drop("name"))}
                        className="size-4 shrink-0 accent-primary"
                      />
                      <CourierLogo src={x.logo} />
                      <span className="min-w-0 truncate">{x.name}</span>
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
                {err("name")}
              </fieldset>
            ) : (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="shop-delivery-name">
                  {t("shopDeliveryName")} <Opt />
                </Label>
                <Input id="shop-delivery-name" value={shopName} onChange={(e) => setShopName(e.target.value)} maxLength={80} placeholder={t("shopDelivery")} aria-invalid={!!errors.name || undefined} className="h-11" />
                {err("name")}
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="carrier-fee">
                  {t("fee")} <Req />
                </Label>
                <MoneyInput id="carrier-fee" value={c.fee} onChange={(fee) => (set({ fee }), drop("fee"))} placeholder="1.50" invalid={!!errors.fee} required />
                <p className="text-xs text-muted-foreground">{t("feeHint")}</p>
                {err("fee")}
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="carrier-eta">
                  {t("eta")} <Opt />
                </Label>
                <Input id="carrier-eta" value={c.eta} onChange={(e) => set({ eta: e.target.value })} maxLength={60} placeholder={t("etaPlaceholder")} className="h-11" />
              </div>
            </div>

            {/* price steps: from this order total, this fee */}
            <fieldset className="flex min-w-0 flex-col gap-2">
              <legend className="text-sm font-medium">
                {t("stepsTitle")} <Opt />
              </legend>
              <p className="-mt-1 text-xs text-muted-foreground">{t("stepsHint")}</p>
              {c.steps.map((s, i) => (
                <div key={i} className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span className="shrink-0 text-sm text-muted-foreground">{t("stepFrom")}</span>
                    <MoneyInput
                      id={`step-from-${i}`}
                      label={`${t("stepFrom")} (${i + 1})`}
                      value={s.from}
                      onChange={(from) => set({ steps: c.steps.map((x, j) => (j === i ? { ...x, from } : x)) })}
                      placeholder="100"
                      invalid={!!errors[`step-${i}`]}
                    />
                    <span className="shrink-0 text-sm text-muted-foreground">→</span>
                    <MoneyInput
                      id={`step-fee-${i}`}
                      label={`${t("stepFee")} (${i + 1})`}
                      value={s.fee}
                      onChange={(fee) => set({ steps: c.steps.map((x, j) => (j === i ? { ...x, fee } : x)) })}
                      placeholder="0"
                      invalid={!!errors[`step-${i}`]}
                    />
                    <Button type="button" variant="ghost" size="icon" className="size-11 shrink-0 rounded-md text-muted-foreground" aria-label={t("removeStep")} onClick={() => set({ steps: c.steps.filter((_, j) => j !== i) })}>
                      <Trash2 aria-hidden />
                    </Button>
                  </div>
                  {err(`step-${i}`)}
                </div>
              ))}
              {err("steps")}
              {c.steps.length < 10 && (
                <Button type="button" variant="outline" size="sm" className="self-start" onClick={() => set({ steps: [...c.steps, { from: "", fee: "" }] })}>
                  <Plus aria-hidden />
                  {t("addStep")}
                </Button>
              )}
            </fieldset>

            {/* couriers only: shop delivery is always charged in the order */}
            {c.isCourier && (
              <Label className="flex min-h-11 items-start gap-3 border-t pt-4 font-normal">
                <Switch className="mt-0.5" checked={c.payDriver} onCheckedChange={(payDriver) => set({ payDriver })} />
                <span>
                  <span className="block font-medium">{t("payDriver")}</span>
                  <span className="block text-xs text-muted-foreground">{t("payDriverHint")}</span>
                </span>
              </Label>
            )}
          </div>

          <DialogFooter className="flex-row border-t px-6 py-4">
            <Button type="button" variant="outline" className="h-11 flex-1" onClick={onClose}>
              {t("cancel")}
            </Button>
            <Button type="submit" className="h-11 flex-1">
              {t("done")}
            </Button>
          </DialogFooter>
        </form>

        <AddCourierDialog
          open={adding}
          onClose={() => setAdding(false)}
          onAdd={(added) => {
            const existing = choices.find((x) => x.name.toLowerCase() === added.name.toLowerCase());
            // new → added; one added before → its logo replaced (when a new one was uploaded); ready-made → just picked
            if (!existing || (added.logo && !isPreset(existing.name))) onNewCourier({ name: existing?.name ?? added.name, logo: added.logo ?? existing?.logo ?? null });
            const name = existing?.name ?? added.name;
            set({ name, logo: isPreset(name) ? "" : (added.logo ?? existing?.logo ?? "") });
            setErrors({});
            setAdding(false);
          }}
        />
      </DialogContent>
    </Dialog>
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
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-md">
        {/* its own form: Enter adds the courier, not the carrier */}
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
              <div className="flex items-center gap-3">
                <div className={cn("grid size-16 shrink-0 place-items-center overflow-hidden rounded-lg border bg-muted text-muted-foreground", !logo && "border-dashed", error.logo && "border-destructive")}>
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
