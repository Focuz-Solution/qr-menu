"use client";

import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { Img } from "@/components/Img";
import { formatPrice, type Product, pick, thumbUrl, variantAt } from "@/lib/shop";
import { cn } from "@/lib/utils";
import { Gallery } from "./Gallery";

// Photo on top, then a white sheet with the price. `header` and `details` are static parts rendered on the server.
// Variant buttons (name only) jump the gallery to that variant's photo; the photo showing is what add-to-cart (`footer`) puts in the cart.
export function Variants({
  product: p,
  header,
  details,
  footer,
}: {
  product: Product;
  header: React.ReactNode;
  details: React.ReactNode;
  /** gets the photo currently showing (add-to-cart uses it) */
  footer?: (image: string) => React.ReactNode;
}) {
  const lang = useLocale();
  const t = useTranslations("product");
  // main photo, extra photos, then variant photos — each once
  const images = [...new Set([p.image, ...(p.images ?? []), ...(p.variants ?? []).flatMap((x) => (x.image ? [x.image] : []))])];
  const [photo, setPhoto] = useState(0);
  const [jump, setJump] = useState<{ i: number }>();
  // the variant showing (if the photo is one); its own price replaces the product price (no sale price on it)
  const current = variantAt(p, images[photo]);
  const own = current?.price;
  const variants = (p.variants ?? []).filter((v) => v.image && images.includes(v.image));
  // a variant without a name shows as "Option 2" (its place in the list)
  const nameOf = (v: { label: string; image?: string }) => v.label || t("optionN", { n: variants.findIndex((x) => x.image === v.image) + 1 });
  const stripRef = useRef<HTMLDivElement>(null);

  // keep the current thumbnail in view inside the strip (scrolls the strip only, not the page)
  useEffect(() => {
    const strip = stripRef.current;
    const el = strip?.children[photo] as HTMLElement | undefined;
    if (strip && el) strip.scrollTo({ left: el.offsetLeft - (strip.clientWidth - el.clientWidth) / 2, behavior: "smooth" });
  }, [photo]);

  return (
    // minmax(0,…): columns never grow past the screen to fit long text / the carousel (that looked like auto zoom-in)
    <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] md:items-start md:gap-8">
      {/* phones: full-width photo under the floating top bar; desktop: left column */}
      <div className="-mx-4 md:sticky md:top-4 md:mx-0">
        <Gallery images={images} alt={pick(p.name, lang)} onIndexChange={setPhoto} jump={jump} />
      </div>

      {/* phones: white sheet with rounded top overlapping the photo; desktop: right column */}
      <div className="relative -mx-4 -mt-6 space-y-3 rounded-t-3xl bg-background px-4 pt-6 md:mx-0 md:mt-0 md:rounded-none md:px-0 md:pt-0">
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
          {images.length > 1 && (
            <div
              ref={stripRef}
              className="relative mt-1 flex max-w-[45%] shrink-0 gap-1.5 overflow-x-auto [scrollbar-width:none] md:hidden [&::-webkit-scrollbar]:hidden"
            >
              {images.map((src, i) => (
                <button
                  key={src}
                  type="button"
                  aria-label={`${i + 1} / ${images.length}`}
                  aria-current={i === photo}
                  onClick={() => setJump({ i })}
                  className={cn(
                    "size-11 shrink-0 overflow-hidden rounded-lg border-2 transition-colors",
                    i === photo ? "border-primary" : "border-transparent opacity-70",
                  )}
                >
                  <Img src={thumbUrl(src)} alt="" sizes="44px" className="size-full" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* variants: "Option" title + one name button per variant; tapping shows its photo and price */}
        {variants.length > 0 && (
          <div className="space-y-2 pt-1">
            {/* title only: the chosen variant is the highlighted button */}
            <p className="text-sm text-muted-foreground">{t("option")}</p>
            <div role="radiogroup" aria-label={t("option")} className="flex flex-wrap gap-2">
              {variants.map((v) => {
                const i = images.indexOf(v.image!);
                const on = i === photo;
                return (
                  <button
                    key={v.image}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => setJump({ i })}
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
          </div>
        )}

        {details}
        {footer?.(images[photo])}
      </div>
    </div>
  );
}
