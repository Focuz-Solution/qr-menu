"use client";

import { Tag } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { Img } from "@/components/Img";
import { formatPrice, priceFor, type Product, pick, sizeOf, thumbUrl, unitPrice, variantAt, wholesaleSteps } from "@/lib/shop";
import { cn } from "@/lib/utils";
import { Gallery, VideoThumb } from "./Gallery";

// Photo on top, then a white sheet with the price. `header` and `details` are static parts rendered on the server.
// Variant buttons (name only) pick a variant and jump the gallery to its photo (swiping to a variant's photo picks it too).
// The page opens on the main photo with no variant picked; with variants, add-to-cart (`footer`) needs one picked and
// puts that one in the cart; without variants it puts the photo showing (off while the video slide shows).
export function Variants({
  product: p,
  header,
  details,
  footer,
  video,
}: {
  product: Product;
  header: React.ReactNode;
  details: React.ReactNode;
  /** gets the picked variant's photo (else the photo showing) and the size picked; undefined = a variant must be
   *  picked first, then add-to-cart calls `askPick` (shows "choose an option" at the buttons) instead of adding;
   *  null = no photo showing (the video slide, product without variants) → add-to-cart is off */
  footer?: (image: string | undefined | null, sizeId: string | undefined, askPick: () => void) => React.ReactNode;
  /** the product's YouTube video id: the last slide of the photo gallery */
  video?: string;
}) {
  const lang = useLocale();
  const t = useTranslations("product");
  // main photo, variant photos, then the extra photos last — each once
  const images = [...new Set([p.image, ...(p.variants ?? []).flatMap((x) => (x.image ? [x.image] : [])), ...(p.images ?? [])])];
  // photo = the last photo shown (what add-to-cart uses, also while the video slide shows); slide = what the gallery shows
  const [photo, setPhoto] = useState(0);
  const [slide, setSlide] = useState(0);
  // variants with a photo (a variant is its photo); none picked until the customer taps one (or swipes to its photo)
  const variants = (p.variants ?? []).filter((v) => v.image && images.includes(v.image));
  const [picked, setPicked] = useState<string>();
  // "Add to bag" tapped before picking: the option row shows a red hint until one is picked
  const [needPick, setNeedPick] = useState(false);
  const askPick = () => {
    setNeedPick(true);
    document.getElementById("product-options")?.scrollIntoView({ behavior: "smooth", block: "center" });
  };
  const onSlide = (i: number) => {
    setSlide(i);
    if (i < images.length) setPhoto(i);
    // swiping to a variant's photo picks that variant; other photos (cover, extras) keep the one picked
    if (variants.some((v) => v.image === images[i])) {
      setPicked(images[i]);
      setNeedPick(false);
    }
  };
  const [jump, setJump] = useState<{ i: number }>();
  // the size picked (the first until the customer taps another) and the variant showing (if the photo is one);
  // the size's own price, else the variant's, replaces the product price (no sale price on it)
  const [sizeId, setSizeId] = useState(p.sizes?.[0]?.id);
  const size = sizeOf(p, sizeId);
  const current = variants.length ? variantAt(p, picked ?? "") : undefined;
  const own = size?.price ?? current?.price;
  // wholesale steps of the variant picked (with variants: none until one is picked), else of the product
  const steps = variants.length && !picked ? [] : wholesaleSteps(p, picked ?? p.image);
  // each step's unit price and saving vs the normal price of this variant + size
  const normal = priceFor(p, picked ?? p.image, size?.id);
  const stepRows = steps.map((s) => {
    const each = unitPrice(p, picked ?? p.image, size?.id, s.minQty);
    return { qty: s.minQty, each, percent: Math.round((1 - each / normal) * 100) };
  });
  // a variant without a name shows as "Option 2" (its place in the list)
  const nameOf = (v: { label: string; image?: string }) => v.label || t("optionN", { n: variants.findIndex((x) => x.image === v.image) + 1 });
  const stripRef = useRef<HTMLDivElement>(null);

  // keep the current thumbnail in view inside the strip (scrolls the strip only, not the page)
  useEffect(() => {
    const strip = stripRef.current;
    const el = strip?.children[slide] as HTMLElement | undefined;
    if (strip && el) strip.scrollTo({ left: el.offsetLeft - (strip.clientWidth - el.clientWidth) / 2, behavior: "smooth" });
  }, [slide]);

  return (
    // minmax(0,…): columns never grow past the screen to fit long text / the carousel (that looked like auto zoom-in)
    <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] md:items-start md:gap-8">
      {/* phones: full-width photo under the floating top bar; desktop: left column */}
      <div className="-mx-4 md:sticky md:top-4 md:mx-0">
        <Gallery images={images} alt={pick(p.name, lang)} onIndexChange={onSlide} jump={jump} video={video} />
      </div>

      {/* phones: white sheet with rounded top overlapping the photo; desktop: right column */}
      <div className="relative -mx-4 -mt-6 flex flex-col gap-3 rounded-t-3xl bg-background px-4 pt-6 md:mx-0 md:mt-0 md:rounded-none md:px-0 md:pt-0">
        {/* title row: name (+ discount badge) and price left; phones: scrollable thumbnail strip right (desktop has the column) */}
        <div className="flex items-start justify-between gap-3">
          {/* price sits right under the name, so the taller thumbnail strip doesn't push it down */}
          <div className="min-w-0 flex-1">
            {header}
            <p className="mt-1 flex items-baseline gap-3">
              {own == null && p.oldPrice && <span className="text-lg text-destructive line-through">{formatPrice(p.oldPrice)}</span>}
              <span className="text-2xl font-bold">{formatPrice(own ?? p.price)}</span>
            </p>
          </div>
          {images.length + (video ? 1 : 0) > 1 && (
            <div
              ref={stripRef}
              className="relative mt-1 flex max-w-[45%] shrink-0 gap-1.5 overflow-x-auto scrollbar-none md:hidden [&::-webkit-scrollbar]:hidden"
            >
              {images.map((src, i) => (
                <button
                  key={src}
                  type="button"
                  aria-label={`${i + 1} / ${images.length}`}
                  aria-current={i === slide}
                  onClick={() => setJump({ i })}
                  className={cn(
                    "size-11 shrink-0 overflow-hidden rounded-lg border-2 transition-colors",
                    i === slide ? "border-primary" : "border-transparent opacity-70",
                  )}
                >
                  <Img src={thumbUrl(src)} alt="" sizes="44px" className="size-full" />
                </button>
              ))}
              {video && (
                <button
                  type="button"
                  aria-label={t("video")}
                  aria-current={slide === images.length}
                  onClick={() => setJump({ i: images.length })}
                  className={cn(
                    "size-11 shrink-0 overflow-hidden rounded-lg border-2 transition-colors",
                    slide === images.length ? "border-primary" : "border-transparent opacity-70",
                  )}
                >
                  <VideoThumb id={video} sizes="44px" />
                </button>
              )}
            </div>
          )}
        </div>

        {/* wholesale (Admin → Wholesale): one line per step, each with its own tag icon — quantity, saving, unit price */}
        {stepRows.length > 0 && (
          <ul className="flex flex-col gap-1.5 text-sm">
            {stepRows.map((r) => (
              <li key={r.qty} className="flex items-center gap-2">
                <Tag className="size-4 shrink-0 text-primary" aria-hidden />
                <span>
                  {t.rich(r.percent > 0 ? "wholesaleSave" : "wholesaleNote", {
                    qty: r.qty,
                    percent: r.percent,
                    b: (chunks) => <b className="font-semibold">{chunks}</b>,
                  })}
                  <span className="text-muted-foreground tabular-nums"> · {formatPrice(r.each)}</span>
                </span>
              </li>
            ))}
          </ul>
        )}

        {/* variants: "Option" title + one name button per variant; tapping shows its photo and price */}
        {variants.length > 0 && (
          <div id="product-options" className="space-y-2 pt-1">
            {/* title only: the chosen variant is the highlighted button; red hint when add-to-cart needs one */}
            <p className="text-sm text-muted-foreground">{t("option")}</p>
            <div role="radiogroup" aria-label={t("option")} className="flex flex-wrap gap-2">
              {variants.map((v) => {
                const i = images.indexOf(v.image!);
                const on = v.image === picked;
                return (
                  <button
                    key={v.image}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => {
                      setPicked(v.image);
                      setNeedPick(false);
                      setJump({ i });
                    }}
                    className={cn(
                      // 36px pill; the invisible after: edge keeps a 44px tap area
                      "relative flex h-9 items-center rounded-full border bg-background px-3.5 text-sm transition-colors outline-none after:absolute after:-inset-y-1 after:inset-x-0 focus-visible:ring-3 focus-visible:ring-ring/50",
                      on ? "border-primary font-medium ring-1 ring-primary" : "hover:border-foreground/30",
                    )}
                  >
                    {nameOf(v)}
                  </button>
                );
              })}
            </div>
            {needPick && (
              <p role="alert" className="text-sm text-destructive">
                {t("chooseOption")}
              </p>
            )}
          </div>
        )}

        {/* sizes (Admin → Sizes): "Size" title + one button per size; tapping changes the price */}
        {!!p.sizes?.length && (
          <div className="space-y-2 pt-1">
            <p className="text-sm text-muted-foreground">{t("size")}</p>
            <div role="radiogroup" aria-label={t("size")} className="flex flex-wrap gap-2">
              {p.sizes.map((s) => {
                const on = s.id === size?.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => setSizeId(s.id)}
                    className={cn(
                      "relative flex h-9 items-center rounded-full border bg-background px-3.5 text-sm transition-colors outline-none after:absolute after:-inset-y-1 after:inset-x-0 focus-visible:ring-3 focus-visible:ring-ring/50",
                      on ? "border-primary font-medium ring-1 ring-primary" : "hover:border-foreground/30",
                    )}
                  >
                    {s.name}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {details}
        {footer?.(variants.length ? picked : slide < images.length ? images[photo] : null, size?.id, askPick)}
      </div>
    </div>
  );
}
