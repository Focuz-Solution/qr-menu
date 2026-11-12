"use client";

import { Check, ExternalLink, ImagePlus, Loader2, Lock, Upload, X } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState, useTransition } from "react";
import { Opt, Req } from "@/components/FieldMark";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Img } from "@/components/Img";
import { isHex, textOn } from "@/lib/brand-colors";
import type { ErrorCode } from "@/lib/result";
import { uploadImage } from "@/lib/upload-image";
import { cn } from "@/lib/utils";
import { saveShopSettings } from "./actions";
import type { ShopInput } from "./types";

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <Card className="gap-0 overflow-hidden py-0">
      <div className="border-b px-4 py-3 md:px-5">
        <h2 className="text-sm font-semibold">{title}</h2>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
      <div className="grid gap-4 p-4 sm:grid-cols-2 md:p-5">{children}</div>
    </Card>
  );
}

export function ShopSettingsForm({ values, readOnly }: { values: ShopInput; readOnly: boolean }) {
  const t = useTranslations("admin.settings");
  const te = useTranslations("errors");
  const [fields, setFields] = useState<Record<string, ErrorCode>>({});
  const [formError, setFormError] = useState<ErrorCode>();
  const [done, setDone] = useState(false);
  // "✓ Saved" goes back to "Save" after 2 s
  useEffect(() => {
    if (!done) return;
    const id = setTimeout(() => setDone(false), 2000);
    return () => clearTimeout(id);
  }, [done]);
  const [pending, start] = useTransition();

  /** one text field: label (required * / optional), input, error */
  const field = (name: keyof ShopInput, required = false, props: React.ComponentProps<typeof Input> = {}) => (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={name}>
        {t(name)} {required ? <Req /> : <Opt />}
      </Label>
      <Input
        id={name}
        name={name}
        defaultValue={String(values[name])}
        aria-required={required || undefined}
        aria-invalid={!!fields[name] || undefined}
        className="h-11"
        {...props}
      />
      {fields[name] && <p className="text-xs text-destructive">{te(fields[name])}</p>}
    </div>
  );

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const str = (k: keyof ShopInput) => String(f.get(k) ?? "");
    setDone(false);
    start(async () => {
      const r = await saveShopSettings({
        name: str("name"),
        contactPhone: str("contactPhone"),
        telegramUrl: str("telegramUrl"),
        facebookUrl: str("facebookUrl"),
        tiktokUrl: str("tiktokUrl"),
        address: str("address"),
        orderPrefix: str("orderPrefix"),
        brandColor: str("brandColor"),
        logoUrl: str("logoUrl"),
        language: str("language"),
        notice: str("notice"),
      });
      setFields(r.ok ? {} : (r.fields ?? {}));
      setFormError(r.ok || r.fields ? undefined : r.error);
      setDone(r.ok);
    });
  }

  return (
    <form onSubmit={submit} noValidate>
      {readOnly && <OwnerOnly />}
      {/* not the owner → every field and button is disabled (the save action also checks "owner") */}
      <fieldset disabled={readOnly} className="flex min-w-0 flex-col gap-4 disabled:opacity-70">

      <Section title={t("sectionAppearance")} hint={t("appearanceHint")}>
        <Appearance logo={values.logoUrl} color={values.brandColor} error={fields.brandColor && te(fields.brandColor)}>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="language">{t("language")} <Req /></Label>
            <Select name="language" defaultValue={values.language} required>
              <SelectTrigger aria-invalid={!!fields.language || undefined} id="language" className="h-11! w-full">
                <SelectValue placeholder={t("language")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="km">{t("languageKm")}</SelectItem>
                <SelectItem value="en">{t("languageEn")}</SelectItem>
              </SelectContent>
            </Select>
            {fields.language && <p className="text-xs text-destructive">{te(fields.language)}</p>}
          </div>
          {field("notice", false, { maxLength: 200, placeholder: t("noticePlaceholder") })}
        </Appearance>
      </Section>

      <Section title={t("sectionShop")}>
        {field("name", true, { maxLength: 80, placeholder: t("namePlaceholder") })}
        {field("orderPrefix", true, { maxLength: 10, className: "h-11 uppercase" })}
        {field("contactPhone", false, { type: "tel", inputMode: "tel", placeholder: "012 345 678" })}
        {field("address", false, { maxLength: 200, placeholder: t("addressPlaceholder") })}
        {/* typed as is, separator included (PB- → PB-251110-0001) */}
      </Section>

      <Section title={t("sectionLinks")} hint={t("linksHint")}>
        {/* the three links in one row (stacked on phones) */}
        <div className="grid gap-4 sm:col-span-2 md:grid-cols-3">
          {field("telegramUrl", false, { type: "url", placeholder: t("telegramPlaceholder") })}
          {field("facebookUrl", false, { type: "url", placeholder: t("facebookPlaceholder") })}
          {field("tiktokUrl", false, { type: "url", placeholder: t("tiktokPlaceholder") })}
        </div>
      </Section>


      {formError && <p role="alert" className="text-sm text-destructive">{te(formError)}</p>}
      {/* one black button: spinner while saving, "✓ Saved" for 2 s after, then "Save" again */}
      <div className="flex justify-end">
        <Button type="submit" aria-live="polite" className="h-11 min-w-36 px-6" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" aria-hidden /> : done && <Check aria-hidden />}
          {done && !pending ? t("saved") : t("save")}
        </Button>
      </div>
      </fieldset>
    </form>
  );
}

// quick picks; any other colour: picker or paste "#rrggbb"
const SWATCHES = ["#111111", "#e11d48", "#db2777", "#f4ad9e", "#f97316", "#ca8a04", "#16a34a", "#0d9488", "#2563eb", "#7c3aed", "#8b5e3c"];

/** logo (uploaded to R2 as soon as it's picked, saved with the form) + brand colour with a live preview */
function Appearance({ logo, color, error, children }: { logo: string; color: string; error?: string; children?: React.ReactNode }) {
  const t = useTranslations("admin.settings");
  const te = useTranslations("errors");
  const [photo, setPhoto] = useState(logo);
  const [uploading, setUploading] = useState(false);
  const [photoError, setPhotoError] = useState<ErrorCode>();
  const [hex, setHex] = useState(color);
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

      {/* preview = a button in the chosen colour that opens the shop */}
      <div className="flex flex-col gap-1.5 sm:col-span-2">
        <p className="text-sm font-medium">{t("preview")}</p>
        <Link
          href="/"
          target="_blank"
          className="inline-flex h-8 w-fit items-center gap-1.5 rounded-full px-3 text-sm font-medium outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          style={{ background: brand, color: textOn(brand) }}
        >
          {t("previewButton")}
          <ExternalLink className="size-3.5" aria-hidden />
        </Link>
      </div>
    </>
  );
}

/** shown to staff/packer on Shop & staff */
export function OwnerOnly() {
  const t = useTranslations("admin.settings");
  return (
    <p className="mb-4 flex items-center gap-2 rounded-lg border px-3 py-2 text-sm text-muted-foreground">
      <Lock className="size-4 shrink-0" aria-hidden />
      {t("ownerOnly")}
    </p>
  );
}
