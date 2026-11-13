"use client";

import { Check, ExternalLink, ImagePlus, Link2, Loader2, Lock, Palette, Save, Store, Upload, X, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState, useTransition } from "react";
import { Opt, Req } from "@/components/FieldMark";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup as RadioGroupPrimitive } from "radix-ui";
import { RadioGroup } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Img } from "@/components/Img";
import { isHex, textOn } from "@/lib/brand-colors";
import type { ErrorCode } from "@/lib/result";
import { slugLiveError } from "@/lib/slug";
import { uploadImage } from "@/lib/upload-image";
import { cn } from "@/lib/utils";
import { saveShopSettings } from "./actions";
import { QrBrandContext } from "./QrSection";
import type { ShopInput } from "./types";

/** one settings card = its own form: saves only its fields, with its own Save button ("✓ Saved" for 2 s after) */
function SectionForm({
  icon: Icon,
  title,
  hint,
  readOnly,
  footer,
  children,
}: {
  icon: LucideIcon;
  title: string;
  hint?: string;
  readOnly: boolean;
  /** shown at the start (left) of the Save row, e.g. Appearance's View shop */
  footer?: React.ReactNode;
  children: (errors: Record<string, ErrorCode>) => React.ReactNode;
}) {
  const t = useTranslations("admin.settings");
  const te = useTranslations("errors");
  const [errors, setErrors] = useState<Record<string, ErrorCode>>({});
  const [formError, setFormError] = useState<ErrorCode>();
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();
  useEffect(() => {
    if (!done) return;
    const id = setTimeout(() => setDone(false), 2000);
    return () => clearTimeout(id);
  }, [done]);

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    // only this card's named fields are sent; the server checks each one
    const input = Object.fromEntries(new FormData(e.currentTarget)) as Partial<ShopInput>;
    setDone(false);
    start(async () => {
      const r = await saveShopSettings(input);
      setErrors(r.ok ? {} : (r.fields ?? {}));
      setFormError(r.ok || r.fields ? undefined : r.error);
      setDone(r.ok);
    });
  }

  return (
    <form onSubmit={submit} noValidate>
      {/* not the owner → every field and button is disabled (the save action also checks "owner") */}
      <fieldset disabled={readOnly} className="min-w-0 disabled:opacity-70">
        {/* title (+ hint) above the card, fields and a small Save button inside it */}
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Icon className="size-5" aria-hidden />
          {title}
        </h2>
        {hint && <p className="mt-1 text-sm text-muted-foreground">{hint}</p>}
        <Card className="mt-3 gap-5 p-4 md:p-5">
          <div className="grid gap-4 sm:grid-cols-2">{children(errors)}</div>
          <div className="flex flex-wrap-reverse items-center justify-end gap-3">
            {footer && <div className="mr-auto">{footer}</div>}
            {formError && <p role="alert" className={cn("text-sm text-destructive", !footer && "mr-auto")}>{te(formError)}</p>}
            <Button type="submit" size="sm" aria-live="polite" disabled={pending}>
              {pending ? <Loader2 className="animate-spin" aria-hidden /> : done ? <Check aria-hidden /> : <Save aria-hidden />}
              {done && !pending ? t("saved") : t("save")}
            </Button>
          </div>
        </Card>
      </fieldset>
    </form>
  );
}

/** one text field: label (required * / optional), input, error */
function Field({
  name,
  value,
  error,
  required = false,
  className,
  ...props
}: { name: keyof ShopInput; value: string; error?: ErrorCode; required?: boolean } & React.ComponentProps<typeof Input>) {
  const t = useTranslations("admin.settings");
  const te = useTranslations("errors");
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={name}>
        {t(name)} {required ? <Req /> : <Opt />}
      </Label>
      <Input
        id={name}
        name={name}
        defaultValue={value}
        aria-required={required || undefined}
        aria-invalid={!!error || undefined}
        className={cn("h-11", className)}
        {...props}
      />
      {error && <p className="text-xs text-destructive">{te(error)}</p>}
    </div>
  );
}

/** page template: two cards, tap one to pick it */
function LayoutPicker({ value, error }: { value: string; error?: ErrorCode }) {
  const t = useTranslations("admin.settings");
  const te = useTranslations("errors");
  return (
    // label on top, then the two cards (medium width)
    // as wide as the two cards (each fits its one-line subtitle), so the "|" + QR code come right after it
    <div className="flex min-w-0 flex-1 flex-col gap-1.5 xl:max-w-2xl">
      <Label id="layout-label">{t("layout")} <Req /></Label>
      <div className="flex flex-col items-start gap-3">
      <RadioGroup name="layout" defaultValue={value} required aria-labelledby="layout-label" className="sm:w-fit sm:grid-cols-[auto_auto]">
        {(["scroll", "filter"] as const).map((v) => (
          <Label
            key={v}
            htmlFor={`layout-${v}`}
            className="cursor-pointer items-start gap-3 rounded-lg border p-3 font-normal has-data-checked:border-primary has-data-checked:bg-primary/5"
          >
            {/* still a radio (one choice), drawn as a checkbox: empty box, or filled with ✓ when picked */}
            <RadioGroupPrimitive.Item
              id={`layout-${v}`}
              value={v}
              aria-invalid={!!error || undefined}
              className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-[6px] border border-input outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive data-checked:border-primary data-checked:bg-primary data-checked:text-primary-foreground"
            >
              <RadioGroupPrimitive.Indicator>
                <Check className="size-3.5" strokeWidth={3} aria-hidden />
              </RadioGroupPrimitive.Indicator>
            </RadioGroupPrimitive.Item>
            <span className="flex flex-col gap-1">
              <span className="font-medium">{t(v === "scroll" ? "layoutScroll" : "layoutFilter")}</span>
              <span className="text-xs text-muted-foreground sm:whitespace-nowrap">{t(v === "scroll" ? "layoutScrollHint" : "layoutFilterHint")}</span>
            </span>
          </Label>
        ))}
      </RadioGroup>
      </div>
      {error && <p className="text-xs text-destructive">{te(error)}</p>}
    </div>
  );
}

/** a required drop-down (shop language) */
function Choice({ name, value, error, options }: { name: "language"; value: string; error?: ErrorCode; options: [string, string][] }) {
  const t = useTranslations("admin.settings");
  const te = useTranslations("errors");
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={name}>{t(name)} <Req /></Label>
      <Select name={name} defaultValue={value} required>
        <SelectTrigger aria-invalid={!!error || undefined} id={name} className="h-11! w-full">
          <SelectValue placeholder={t(name)} />
        </SelectTrigger>
        <SelectContent>
          {options.map(([v, label]) => (
            <SelectItem key={v} value={v}>{label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      {error && <p className="text-xs text-destructive">{te(error)}</p>}
    </div>
  );
}

/**
 * The shop's link address: editable until the shop's first order (`locked` after — then disabled, so it isn't sent).
 * Errors show while typing (a whole link, bad characters); the server checks again (taken, reserved, locked).
 */
function SlugField({ value, error, locked, host }: { value: string; error?: ErrorCode; locked: boolean; host: string }) {
  const t = useTranslations("admin.settings");
  const te = useTranslations("errors");
  const [slug, setSlug] = useState(value);
  const shown = slugLiveError(slug) ?? error;
  const link = `${host}/${slug || value}`;
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor="slug">{t("slug")} {!locked && <Req />}</Label>
      <div className="relative">
        <Input
          id="slug"
          name="slug"
          value={slug}
          onChange={(e) => setSlug(e.target.value.toLowerCase().trim())}
          disabled={locked}
          maxLength={40}
          aria-required={!locked || undefined}
          aria-invalid={!!shown || undefined}
          aria-describedby="slug-hint"
          className={cn("h-11 font-mono", locked && "pr-10")}
        />
        {locked && <Lock className="absolute top-1/2 right-4 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />}
      </div>
      <p id="slug-hint" className="text-xs text-muted-foreground">
        {shown ? <span className="text-destructive">{te(shown)}</span> : t(locked ? "slugLockedHint" : "slugHint", { link })}
      </p>
    </div>
  );
}

/** `qr` = the QR code block (owner / shop admin), shown in Appearance next to Page template */
export function ShopSettingsForm({
  values,
  readOnly,
  slugLocked,
  host,
  qr,
}: {
  values: ShopInput;
  readOnly: boolean;
  slugLocked: boolean;
  host: string;
  qr?: React.ReactNode;
}) {
  const t = useTranslations("admin.settings");
  const te = useTranslations("errors");
  // brand colour being picked in Appearance (View shop in its Save row shows it live; default theme = black)
  const [hex, setHex] = useState(values.brandColor);
  const brand = isHex(hex) ? hex : "#000000";

  return (
    <div className="flex min-w-0 flex-col gap-8">

      <SectionForm
        icon={Palette}
        title={t("sectionAppearance")}
        hint={t("appearanceHint")}
        readOnly={readOnly}
        footer={
          // View shop, in the colour being picked; left of Save
          <Link
            href={`/${values.slug}`}
            target="_blank"
            className="inline-flex h-8 w-fit shrink-0 items-center gap-1.5 rounded-full px-3 text-sm font-medium outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            style={{ background: brand, color: textOn(brand) }}
          >
            {t("previewButton")}
            <ExternalLink className="size-3.5" aria-hidden />
          </Link>
        }
      >
        {(errors) => (
          <Appearance logo={values.logoUrl} hex={hex} setHex={setHex} error={errors.brandColor && te(errors.brandColor)}>
              <>
                <Choice name="language" value={values.language} error={errors.language} options={[["km", t("languageKm")], ["en", t("languageEn")]]} />
                <Field name="notice" value={values.notice} error={errors.notice} maxLength={200} placeholder={t("noticePlaceholder")} />
                {/* Page template | QR code — one row on wide screens (thin line between), QR below otherwise */}
                <div className="flex flex-col gap-6 sm:col-span-2 xl:flex-row xl:items-start">
                  <LayoutPicker value={values.layout} error={errors.layout} />
                  {qr && (
                    <>
                      <span className="hidden w-px self-stretch bg-border xl:block" aria-hidden />
                      <div className="min-w-0 xl:flex-1">
                        {/* the brand QR designs follow the colour being picked above (before saving) */}
                        <QrBrandContext value={isHex(hex) ? hex : null}>{qr}</QrBrandContext>
                      </div>
                    </>
                  )}
                </div>
              </>
          </Appearance>
        )}
      </SectionForm>

      <SectionForm icon={Store} title={t("sectionShop")} readOnly={readOnly}>
        {(errors) => (
          <>
            <Field name="name" value={values.name} error={errors.name} required maxLength={80} placeholder={t("namePlaceholder")} />
            <SlugField value={values.slug} error={errors.slug} locked={slugLocked} host={host} />
            {/* typed as is, separator included (PB- → PB-251110-0001) */}
            <Field name="orderPrefix" value={values.orderPrefix} error={errors.orderPrefix} required maxLength={10} className="uppercase" />
            <Field name="contactPhone" value={values.contactPhone} error={errors.contactPhone} type="tel" inputMode="tel" placeholder="012 345 678" />
            <Field name="address" value={values.address} error={errors.address} maxLength={200} placeholder={t("addressPlaceholder")} />
            {/* the shop's location: a link copied from Google Maps (Share → Copy link) */}
            <Field name="mapUrl" value={values.mapUrl} error={errors.mapUrl} type="url" inputMode="url" maxLength={500} placeholder="https://maps.app.goo.gl/…" />
          </>
        )}
      </SectionForm>

      <SectionForm icon={Link2} title={t("sectionLinks")} hint={t("linksHint")} readOnly={readOnly}>
        {(errors) => (
          // the three links in one row (stacked on phones)
          <div className="grid gap-4 sm:col-span-2 md:grid-cols-3">
            <Field name="telegramUrl" value={values.telegramUrl} error={errors.telegramUrl} type="url" placeholder={t("telegramPlaceholder")} />
            <Field name="facebookUrl" value={values.facebookUrl} error={errors.facebookUrl} type="url" placeholder={t("facebookPlaceholder")} />
            <Field name="tiktokUrl" value={values.tiktokUrl} error={errors.tiktokUrl} type="url" placeholder={t("tiktokPlaceholder")} />
          </div>
        )}
      </SectionForm>
    </div>
  );
}

// quick picks; any other colour: picker or paste "#rrggbb"
const SWATCHES = ["#111111", "#e11d48", "#db2777", "#f4ad9e", "#f97316", "#ca8a04", "#16a34a", "#0d9488", "#2563eb", "#7c3aed", "#8b5e3c"];

/** logo (uploaded to R2 as soon as it's picked, saved with the form) + brand colour with a live preview */
function Appearance({
  logo,
  hex,
  setHex,
  error,
  children,
}: {
  logo: string;
  /** brand colour being picked (kept by the form: View shop in the Save row shows it live) */
  hex: string;
  setHex: (hex: string) => void;
  error?: string;
  children?: React.ReactNode;
}) {
  const t = useTranslations("admin.settings");
  const te = useTranslations("errors");
  const [photo, setPhoto] = useState(logo);
  const [uploading, setUploading] = useState(false);
  const [photoError, setPhotoError] = useState<ErrorCode>();
  const fileInput = useRef<HTMLInputElement>(null);
  const brand = isHex(hex) ? hex : "#000000"; // default theme = black buttons

  return (
    <>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="logo">{t("logo")} <Opt /></Label>
        <input
          ref={fileInput}
          id="logo"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (!file) return;
            setUploading(true);
            setPhotoError(undefined);
            uploadImage(file).then((r) => {
              setUploading(false);
              if ("url" in r) setPhoto(r.url);
              else setPhotoError(r.error);
            });
          }}
        />
        <input type="hidden" name="logoUrl" value={photo} />
        <div className="flex items-center gap-3">
          {photo ? (
            <div className="relative size-20 shrink-0">
              <button
                type="button"
                onClick={() => fileInput.current?.click()}
                aria-label={t("uploadLogo")}
                className="block size-full rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <Img src={photo} alt={t("logo")} sizes="80px" className="size-full rounded-lg border" />
              </button>
              <Button
                type="button"
                variant="secondary"
                size="icon-xs"
                className="absolute -top-1.5 -right-1.5 rounded-full shadow-sm"
                onClick={() => setPhoto("")}
                aria-label={t("removeLogo")}
              >
                <X aria-hidden />
              </Button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              aria-label={t("uploadLogo")}
              className="flex size-20 shrink-0 items-center justify-center rounded-lg border-2 border-dashed bg-muted/40 text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              {uploading ? <Loader2 className="size-5 animate-spin" aria-hidden /> : <ImagePlus className="size-5" aria-hidden />}
            </button>
          )}
          <Button type="button" variant="outline" size="xs" disabled={uploading} onClick={() => fileInput.current?.click()}>
            <Upload aria-hidden />
            {t("uploadLogo")}
          </Button>
        </div>
        {photoError && <p role="alert" className="text-xs text-destructive">{te(photoError)}</p>}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="brandColor">{t("brandColor")} <Opt /></Label>
        <div className="flex items-center gap-2">
          {/* native colour picker shown as a swatch */}
          <input
            type="color"
            value={brand}
            onChange={(e) => setHex(e.target.value)}
            aria-label={t("brandColor")}
            className="size-11 shrink-0 cursor-pointer rounded-lg border bg-transparent p-1"
          />
          <Input
            id="brandColor"
            name="brandColor"
            value={hex}
            onChange={(e) => setHex(e.target.value.trim())}
            placeholder="#000000"
            maxLength={7}
            aria-invalid={!!error || undefined}
            className="h-11 min-w-0 font-mono uppercase"
          />
          {hex && (
            <Button type="button" variant="ghost" size="sm" onClick={() => setHex("")}>
              {t("resetColor")}
            </Button>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5 pt-1">
          {SWATCHES.map((c) => {
            const on = hex.toLowerCase() === c;
            return (
              <button
                key={c}
                type="button"
                onClick={() => setHex(c)}
                aria-label={c}
                aria-pressed={on}
                title={c}
                className={cn(
                  "size-7 rounded-full border border-black/10 outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                  on && "ring-2 ring-foreground ring-offset-2 ring-offset-background",
                )}
                style={{ background: c }}
              />
            );
          })}
        </div>
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>

      {children}
    </>
  );
}
