"use client";

import { GripVertical, ImagePlus, Loader2, Plus, Trash2, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Img } from "@/components/Img";
import { Button } from "@/components/ui/button";
import { DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { type DiscountType, salePrice, toCents } from "@/lib/money";
import { formatPrice, thumbUrl } from "@/lib/shop";
import type { ErrorCode } from "@/lib/result";
import { formatBytes } from "@/lib/compress-image";
import { uploadImage } from "@/lib/upload-image";
import { moveTo, useDragSort } from "@/lib/use-drag-sort";
import { useFlip } from "@/lib/use-flip";
import { cn, dragLifted, dragRow, latinDigits } from "@/lib/utils";
import { saveItem } from "./actions";
import { DescriptionEditor } from "./DescriptionEditor";
import { SizePicker } from "./SizePicker";
import type { AdminCategory, AdminItem, AdminSize } from "./types";
import { Opt, Req } from "@/components/FieldMark";

const money = (cents: number) => formatPrice(cents / 100);

/** one block of the product form (optional title; blocks are split by space, no lines) */
function Section({ title, children }: { title?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      {title && <h3 className="text-sm font-semibold">{title}</h3>}
      {children}
    </section>
  );
}

/** photo box: shows the photo (or an upload icon / `empty`); tap to pick a new one */
function PhotoPick({ id, url, busy, label, onFile, empty, className }: { id?: string; url: string; busy: boolean; label: string; onFile: (file: File | undefined) => void; empty?: React.ReactNode; className?: string }) {
  return (
    // relative: keeps the hidden (sr-only, absolute) file input inside this box. Without it the input sits relative to the
    // dialog, and with many variants picking a photo scrolled the whole dialog frame to it → the dialog went blank white.
    <label
      title={label}
      className={cn(
        "relative flex size-full cursor-pointer items-center justify-center overflow-hidden rounded-lg border bg-muted/60 text-muted-foreground/60 hover:bg-muted hover:text-muted-foreground has-focus-visible:ring-3 has-focus-visible:ring-ring/50",
        className,
      )}
    >
      <input
        id={id}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        aria-label={label}
        onChange={(e) => {
          onFile(e.target.files?.[0]);
          e.target.value = ""; // picking the same file again still fires onChange
        }}
      />
      {busy ? (
        <Loader2 className="size-5 animate-spin" aria-hidden />
      ) : url ? (
        <Img src={thumbUrl(url)} alt="" sizes="80px" className="size-full" />
      ) : (
        (empty ?? <ImagePlus className="size-7" strokeWidth={1.5} aria-hidden />)
      )}
    </label>
  );
}

function RemoveButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Button type="button" variant="secondary" size="icon-xs" className="absolute -top-1.5 -right-1.5 rounded-full shadow-sm" onClick={onClick} aria-label={label}>
      <X aria-hidden />
    </Button>
  );
}

export function ItemForm({
  item,
  categories,
  sizes,
  defaultCategory,
  onSaved,
  onClose,
  onFlag,
}: {
  item?: AdminItem;
  categories: AdminCategory[];
  sizes: AdminSize[];
  defaultCategory: string;
  onSaved: (categoryId: string) => void;
  onClose: () => void;
  onFlag: (id: string, patch: { isAvailable?: boolean; isVisible?: boolean }) => void;
}) {
  const t = useTranslations("admin.menu");
  const tp = useTranslations("product");
  const te = useTranslations("errors");
  const [fields, setFields] = useState<Record<string, ErrorCode>>({});
  const [formError, setFormError] = useState<ErrorCode>();
  const dollars = (cents: number | null | undefined) => (cents == null ? "" : String(cents / 100));
  // main photo + more photos + variants (each its own photo, name, code, price); photos upload as soon as picked and are saved with the product
  const isVariantPhoto = (u: string) => !!item?.variants.some((v) => v.image === u);
  const [photo, setPhoto] = useState(() => item?.images.find((u) => !isVariantPhoto(u)) ?? "");
  // the other photos that belong to no variant (older products kept them as unnamed variants; they come back here)
  const [gallery, setGallery] = useState(() => (item?.images ?? []).filter((u) => u !== photo && !isVariantPhoto(u)));
  const [variants, setVariants] = useState(() =>
    // key = the row's own id (two variants may share a photo, so not the photo): drag, upload messages and React rows use it
    (item?.variants ?? []).map((v, i) => ({ key: `saved-${i}`, id: v.id, image: v.image, label: v.label, code: v.code ?? "", price: dollars(v.priceCents) })),
  );
  const [sizePrices, setSizePrices] = useState<Record<string, string>>(() =>
    Object.fromEntries((item?.sizes ?? []).map((x) => [x.sizeId, dollars(x.priceCents)])),
  );
  // the shop's sizes + ones just added from the picker (until the page reloads its list)
  const [added, setAdded] = useState<AdminSize[]>([]);
  const allSizes = [...sizes, ...added.filter((a) => !sizes.some((z) => z.id === a.id))];
  const picked = allSizes.filter((z) => z.id in sizePrices);
  const toggleSize = (id: string, on: boolean) =>
    setSizePrices((all) => (on ? { ...all, [id]: "" } : Object.fromEntries(Object.entries(all).filter(([k]) => k !== id))));
  const [busy, setBusy] = useState<string[]>([]); // keys uploading: "main" or a variant key
  const uploading = busy.length > 0;
  const setVariant = (key: string, patch: { image?: string; label?: string; code?: string; price?: string }) =>
    setVariants((all) => all.map((v) => (v.key === key ? { ...v, ...patch } : v)));
  // drag ⠿ to reorder the variants (same handle as categories / products); the new order is saved with the product,
  // and the shop shows the variants in this order
  const putInOrder = (order: string[]) => setVariants((all) => order.map((k) => all.find((v) => v.key === k)!).filter(Boolean));
  const { dragId: dragKey, dragOrder, start: startDrag } = useDragSort({ attr: "data-variant", onDrop: putInOrder });
  // while dragging: the rows in the dragged order (the form keeps its order until release)
  const shownVariants = dragOrder ? dragOrder.map((k) => variants.find((v) => v.key === k)!).filter(Boolean) : variants;
  // the other variants slide to their new place while one is dragged
  const variantList = useFlip<HTMLUListElement>("data-variant", shownVariants.map((v) => v.key).join(), dragKey);
  // last upload's message under its own box ("main" or a variant): an error, or "4.2 MB → 210 KB" after shrinking
  const [upMsg, setUpMsg] = useState<{ key: string; error?: ErrorCode; size?: string }>();
  const upload = (key: string, file: File | undefined, done: (url: string) => void) => {
    if (!file) return;
    setUpMsg(undefined);
    setBusy((b) => [...b, key]);
    uploadImage(file).then((r) => {
      setBusy((b) => b.filter((k) => k !== key));
      if (!("url" in r)) return setUpMsg({ key, error: r.error });
      done(r.url);
      setUpMsg({ key, size: t("photoSize", { before: formatBytes(r.before), after: formatBytes(r.after) }) });
    });
  };
  const [pending, start] = useTransition();
  // editing a product on sale: its discount as a whole % when it is one (10 %), else as $ off
  const off = item?.compareAtCents ? item.compareAtCents - item.priceCents : 0;
  const wholePct = off > 0 && (off * 100) % item!.compareAtCents! === 0;
  const [price, setPrice] = useState(dollars(item?.compareAtCents ?? item?.priceCents));
  const [discount, setDiscount] = useState(!off ? "" : wholePct ? String((off * 100) / item!.compareAtCents!) : dollars(off));
  const [discountType, setDiscountType] = useState<DiscountType>(!off || wholePct ? "percent" : "amount");
  // live "Customer pays $9.00" under the discount (the save action works it out again)
  const priceCents = toCents(price);
  const preview = priceCents && !Number.isNaN(priceCents) ? salePrice(priceCents, discountType, discount) : null;
  const upMessage = (key: string) =>
    upMsg?.key === key &&
    (upMsg.error ? <p role="alert" className="text-xs text-destructive">{te(upMsg.error)}</p> : <p className="text-xs text-muted-foreground tabular-nums">{upMsg.size}</p>);
  const err = (key: string) => fields[key] && <p className="text-xs text-destructive">{te(fields[key])}</p>;

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const str = (k: string) => String(f.get(k) ?? "");
    const input = {
      name: str("name"),
      brand: str("brand"),
      categoryId: str("categoryId"),
      price: str("price"),
      discount: str("discount"),
      discountType,
      badge: str("badge"),
      isAvailable: f.get("isAvailable") === "on",
      isVisible: f.get("isVisible") === "on",
      description: str("description"),
      youtube: str("youtube"),
      image: photo,
      gallery,
      variants: variants.map(({ id, label, image, price, code }) => ({ id, label, image, price, code })),
      sizes: picked.map((x) => ({ sizeId: x.id, price: sizePrices[x.id] })),
    };
    start(async () => {
      const r = await saveItem(item?.id ?? null, input);
      if (r.ok) return onSaved(input.categoryId);
      setFields(r.fields ?? {});
      setFormError(r.fields ? undefined : r.error);
    });
  }

  return (
    <form onSubmit={submit} noValidate className="flex min-h-0 flex-1 flex-col">
      <DialogHeader className="border-b px-6 pt-6 pb-4">
        <DialogTitle className="text-lg">{item ? t("edit") : t("add")}</DialogTitle>
        <DialogDescription className="sr-only">{item ? t("edit") : t("add")}</DialogDescription>
      </DialogHeader>

      {/* three sections: basic info → price → variants */}
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-6 py-5">
        <Section title={t("sectionBasic")}>
          {/* photo left of the name on wider screens, on top on phones */}
          <div className="flex flex-col gap-4 sm:flex-row">
            <div className="flex shrink-0 flex-col gap-1.5">
              <Label htmlFor="photo">{t("photos")} <Opt /></Label>
              <div className="relative size-28">
                <PhotoPick id="photo" url={photo} busy={busy.includes("main")} label={t("uploadPhoto")} onFile={(f) => upload("main", f, setPhoto)} />
                {photo && <RemoveButton label={t("removePhoto")} onClick={() => setPhoto("")} />}
              </div>
              {upMessage("main")}
            </div>
            <div className="grid min-w-0 flex-1 grid-cols-2 content-start gap-x-3 gap-y-4 sm:grid-cols-4">
              <div className="col-span-full flex flex-col gap-1.5">
                <Label htmlFor="name">{t("name")} <Req /></Label>
                <Input id="name" name="name" aria-required maxLength={200} placeholder={t("namePlaceholder")} defaultValue={item?.name} aria-invalid={!!fields.name || undefined} className="h-11" />
                {err("name")}
              </div>
              {/* sizes (Admin → Sizes): search, tick several or add a new one; their prices are set further down */}
              <div className="flex min-w-0 flex-col gap-1.5">
                <Label htmlFor="sizes">{t("sizes")} <Opt /></Label>
                <SizePicker
                  id="sizes"
                  sizes={allSizes}
                  value={picked.map((z) => z.id)}
                  onToggle={toggleSize}
                  onCreated={(z) => setAdded((all) => [...all, z])}
                  invalid={!!fields.sizes}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="categoryId">{t("category")} <Req /></Label>
                <Select name="categoryId" defaultValue={item?.categoryId ?? defaultCategory}>
                  <SelectTrigger id="categoryId" aria-required className="h-11! w-full" aria-invalid={!!fields.categoryId || undefined}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {err("categoryId")}
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="brand">{t("brand")} <Opt /></Label>
                <Input id="brand" name="brand" placeholder={t("brandPlaceholder")} defaultValue={item?.brand ?? ""} className="h-11" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="badge">{t("badge")} <Opt /></Label>
                {/* no "Sale" choice: a discount shows its own "Sale" pill; an old "sale" badge opens as None and is cleared on save */}
                <Select name="badge" defaultValue={!item?.badge || item.badge === "sale" ? "none" : item.badge}>
                  <SelectTrigger id="badge" className="h-11! w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t("none")}</SelectItem>
                    <SelectItem value="new">{tp("new")}</SelectItem>
                    <SelectItem value="best_seller">{tp("best")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          {/* more photos: always shown, with or without variants; the shop shows them after the variant photos */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="gallery-add">
                {t("morePhotos")} <Opt />
              </Label>
              <div className="flex flex-wrap gap-2">
                {gallery.map((url) => (
                  <div key={url} className="relative size-16">
                    <PhotoPick url={url} busy={busy.includes(url)} label={t("uploadPhoto")} onFile={(f) => upload(url, f, (next) => setGallery((all) => all.map((u) => (u === url ? next : u))))} />
                    <RemoveButton label={t("removePhoto")} onClick={() => setGallery((all) => all.filter((u) => u !== url))} />
                  </div>
                ))}
                {gallery.length < 10 && (
                  <div className="size-16">
                    <PhotoPick
                      id="gallery-add"
                      url=""
                      busy={busy.includes("gallery")}
                      label={t("addPhoto")}
                      // "+" in a dashed box = add one more
                      empty={<Plus className="size-6" aria-hidden />}
                      className="border-dashed border-muted-foreground/40 bg-transparent text-muted-foreground hover:border-primary hover:bg-muted/40 hover:text-foreground" onFile={(f) => upload("gallery", f, (url) => setGallery((all) => (all.includes(url) ? all : [...all, url])))} />
                  </div>
              )}
            </div>
            {upMessage("gallery")}
            {upMsg && gallery.includes(upMsg.key) && upMessage(upMsg.key)}
            {err("images")}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="description">{t("description")} <Opt /></Label>
            <DescriptionEditor id="description" name="description" label={t("description")} placeholder={t("descriptionPlaceholder")} defaultValue={item?.description ?? ""} />
            {err("description")}
          </div>
          {/* YouTube video under the description on the product page: any YouTube link (watch, youtu.be, Shorts) */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="youtube">{t("youtube")} <Opt /></Label>
            <Input
              id="youtube"
              name="youtube"
              type="url"
              inputMode="url"
              maxLength={300}
              placeholder={t("youtubePlaceholder")}
              defaultValue={item?.youtubeId ? `https://youtu.be/${item.youtubeId}` : ""}
              aria-invalid={!!fields.youtube || undefined}
              className="h-11"
            />
            {err("youtube")}
          </div>
          {/* whether customers can order / see it: a titled group like the other fields (switches get no required/optional mark) */}
          <div role="group" aria-labelledby="status-title" className="flex flex-col gap-1.5">
            <p id="status-title" className="text-sm leading-none font-medium">{t("status")}</p>
            <div className="flex flex-wrap gap-x-5">
              <Label className="flex min-h-11 items-center gap-2 font-normal">
                <Switch name="isAvailable" defaultChecked={item?.isAvailable ?? true} />
                {t("inStock")}
              </Label>
              <Label className="flex min-h-11 items-center gap-2 font-normal">
                <Switch name="isVisible" defaultChecked={item?.isVisible ?? true} />
                {t("visible")}
              </Label>
            </div>
          </div>
        </Section>

        {/* a line instead of a title; then price + discount, then variants: one block */}
        <Separator />
        <Section>
          <div className="grid grid-cols-1 gap-x-3 gap-y-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="price">{t("price")} <Req /></Label>
              {/* on sale: the saved price is the discount and compareAt keeps the original */}
              <Input id="price" name="price" aria-required inputMode="decimal" placeholder={t("pricePlaceholder")} value={price} onChange={(e) => setPrice(latinDigits(e.target.value))} aria-invalid={!!fields.price || undefined} className="h-11" />
              {err("price")}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="discount">{t("discountLabel")} <Opt /></Label>
              {/* the amount + its type: a small % / $ switch inside the right end of the box */}
              <div className="relative">
                <Input
                  id="discount"
                  name="discount"
                  inputMode="decimal"
                  placeholder={discountType === "percent" ? "10" : "1.50"}
                  value={discount}
                  onChange={(e) => setDiscount(latinDigits(e.target.value))}
                  aria-invalid={!!fields.discount || undefined}
                  className="h-11 pr-24"
                />
                <ToggleGroup
                  type="single"
                  spacing={0}
                  value={discountType}
                  onValueChange={(v) => v && setDiscountType(v as DiscountType)}
                  aria-label={t("discountType")}
                  className="absolute inset-y-1.5 right-1.5 rounded-full bg-muted p-0.5"
                >
                  {(["percent", "amount"] as const).map((v) => (
                    <ToggleGroupItem
                      key={v}
                      value={v}
                      aria-label={t(v === "percent" ? "percentOff" : "amountOff")}
                      // after:-inset-y-1.5 grows the tap area to the full 44px box height
                      className="relative h-full w-10 rounded-full! text-sm font-semibold text-muted-foreground after:absolute after:-inset-y-1.5 after:inset-x-0 data-[state=on]:bg-background data-[state=on]:text-foreground data-[state=on]:shadow-sm"
                    >
                      {v === "percent" ? "%" : "$"}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
              </div>
              {typeof preview === "number" && !fields.discount && (
                <p className="text-xs text-muted-foreground tabular-nums">{t("customerPays", { price: money(preview) })}</p>
              )}
              {err("discount")}
            </div>
          </div>

          {/* variants (same block as the price, no line between): photo + name + own price per row; the customer picks one by its photo */}
          <h3 className="pt-1 text-sm font-semibold">{t("variants")} <Opt /></h3>
          {/* one bordered box: column headers, a row per variant (lines between), "+ Add variant" as the last row */}
          <div className="overflow-hidden rounded-xl border">
            {variants.length > 0 && (
              <>
                <div className="flex items-center gap-2 border-b bg-muted/50 px-3 py-2 text-xs font-medium text-muted-foreground" aria-hidden>
                  {variants.length > 1 && <span className="-mr-1 w-7 shrink-0" />}
                  <span className="w-11 shrink-0">{t("photoShort")} <Req /></span>
                  <span className="grid min-w-0 flex-1 gap-2 sm:grid-cols-2">
                    <span>{t("variantName")} <Opt /></span>
                    <span className="hidden sm:inline">{t("variantCode")} <Opt /></span>
                  </span>
                  <span className="w-28 shrink-0">{t("price")} <Opt /></span>
                  <span className="w-11 shrink-0" />
                </div>
                <ul ref={variantList} className="divide-y">
                  {shownVariants.map((v, i) => (
                    <li
                      key={v.key}
                      data-variant={v.key}
                      className={cn("flex flex-col gap-1 px-3 py-2", dragRow, dragKey === v.key && dragLifted)}
                    >
                      <div className="flex items-center gap-2">
                        {/* drag handle: mouse + touch via pointer events, keyboard via ↑/↓ */}
                        {variants.length > 1 && (
                          <button
                            type="button"
                            aria-label={t("reorder", { name: v.label.trim() || `${t("variants")} ${i + 1}` })}
                            className="-mr-1 flex h-11 w-7 shrink-0 cursor-grab touch-none items-center justify-center rounded-md text-muted-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50 active:cursor-grabbing"
                            onPointerDown={(e) => startDrag(e, v.key, variants.map((x) => x.key))}
                            onKeyDown={(e) => {
                              const d = e.key === "ArrowUp" ? -1 : e.key === "ArrowDown" ? 1 : 0;
                              if (!d) return;
                              e.preventDefault();
                              putInOrder(moveTo(variants.map((x) => x.key), v.key, i + d));
                            }}
                          >
                            <GripVertical className="size-4" aria-hidden />
                          </button>
                        )}
                        <div className="size-11 shrink-0">
                          <PhotoPick url={v.image} busy={busy.includes(v.key)} label={t("uploadPhoto")} onFile={(f) => upload(v.key, f, (image) => setVariant(v.key, { image }))} />
                        </div>
                        <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-2">
                          <Input
                            value={v.label}
                            onChange={(e) => setVariant(v.key, { label: e.target.value })}
                            maxLength={80}
                            placeholder={t("variantPlaceholder")}
                            aria-label={t("variantName")}
                            className="h-11 min-w-0"
                          />
                          <Input
                            value={v.code}
                            onChange={(e) => setVariant(v.key, { code: e.target.value })}
                            maxLength={40}
                            placeholder={t("variantCodePlaceholder")}
                            aria-label={t("variantCode")}
                            className="h-11 min-w-0"
                          />
                        </div>
                        {/* own price; empty = the product price (shown faded) */}
                        <div className="relative w-28 shrink-0">
                          <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-sm text-muted-foreground" aria-hidden>$</span>
                          <Input
                            value={v.price}
                            onChange={(e) => setVariant(v.key, { price: latinDigits(e.target.value) })}
                            inputMode="decimal"
                            placeholder={price || "0.00"}
                            aria-label={t("variantPrice")}
                            className="h-11 pl-7 tabular-nums"
                          />
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-11 shrink-0 rounded-md text-muted-foreground hover:text-destructive"
                          onClick={() => setVariants((all) => all.filter((x) => x.key !== v.key))}
                          aria-label={t("removePhoto")}
                        >
                          <Trash2 aria-hidden />
                        </Button>
                      </div>
                      {upMessage(v.key)}
                    </li>
                  ))}
                </ul>
              </>
            )}
            <button
              type="button"
              className={cn(
                "flex h-12 w-full items-center justify-center gap-2 text-sm font-medium text-muted-foreground outline-none hover:bg-muted/50 hover:text-foreground focus-visible:bg-muted/50",
                variants.length > 0 && "border-t",
              )}
              onClick={() => setVariants((all) => [...all, { key: crypto.randomUUID(), id: "", image: "", label: "", code: "", price: "" }])}
            >
              <Plus className="size-4" aria-hidden /> {t("addVariant")}
            </button>
          </div>
          {err("variants")}

          {/* prices of the sizes ticked above: one row each, empty = the product price */}
          {picked.length > 0 && (
            <>
              <h3 className="pt-1 text-sm font-semibold">{t("sizePrices")} <Opt /></h3>
              {/* one bordered box like Variants: column headers, then a row per size */}
              <div className="overflow-hidden rounded-xl border">
              <div className="flex items-center gap-3 border-b bg-muted/50 px-3 py-2 text-xs font-medium text-muted-foreground" aria-hidden>
                <span className="min-w-0 flex-1">{t("sizeName")}</span>
                <span className="w-28 shrink-0">{t("price")} <Opt /></span>
                <span className="w-11 shrink-0" />
              </div>
              <ul className="divide-y">
                {picked.map((z) => (
                  <li key={z.id} className="flex min-h-14 items-center gap-3 px-3 py-1.5">
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">{z.name}</span>
                    <div className="relative w-28 shrink-0">
                      <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-sm text-muted-foreground" aria-hidden>$</span>
                      <Input
                        value={sizePrices[z.id]}
                        onChange={(e) => setSizePrices((all) => ({ ...all, [z.id]: latinDigits(e.target.value) }))}
                        inputMode="decimal"
                        placeholder={price || "0.00"}
                        aria-label={t("sizePrice", { size: z.name })}
                        className="h-11 pl-7 tabular-nums"
                      />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-11 shrink-0 rounded-md text-muted-foreground hover:text-destructive"
                      onClick={() => toggleSize(z.id, false)}
                      aria-label={`${t("removePhoto")}: ${z.name}`}
                    >
                      <Trash2 aria-hidden />
                    </Button>
                  </li>
                ))}
              </ul>
              </div>
            </>
          )}
          {err("sizes")}
        </Section>

        {formError && <p role="alert" className="text-sm text-destructive">{te(formError)}</p>}
      </div>

      <DialogFooter className="flex-row flex-wrap border-t px-6 py-4">
        {item && !item.isAvailable && (
          <Button type="button" variant="outline" className="h-11" disabled={pending} onClick={() => { onFlag(item.id, { isAvailable: true }); onClose(); }}>
            {t("backInStock")}
          </Button>
        )}
        <Button type="button" variant="outline" className="h-11 flex-1" onClick={onClose}>{t("cancel")}</Button>
        <Button type="submit" className="h-11 flex-1" disabled={pending || uploading}>
          {/* saving (add or update): spinner in the button until the server answers */}
          {pending && <Loader2 className="animate-spin" aria-hidden />}
          {t("save")}
        </Button>
      </DialogFooter>
    </form>
  );
}
