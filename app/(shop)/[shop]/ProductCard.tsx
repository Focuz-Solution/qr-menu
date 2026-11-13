"use client";

import { useShopPath } from "@/lib/shop-path";
import { Ban, Flame, ImageOff, Star } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { DiscountBadge } from "@/components/DiscountBadge";
import { Img } from "@/components/Img";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { discountPercent, formatPrice, type Product, pick, thumbUrl } from "@/lib/shop";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { markFromList } from "./products/[slug]/BackButton";

export function ProductCard({ product: p, priority }: { product: Product; /** first row of the page: load eagerly, it is the LCP image */ priority?: boolean }) {
  const path = useShopPath();
  const lang = useLocale();
  const t = useTranslations("product");
  const off = discountPercent(p);
  const soldOut = !p.inStock;
  // "sale" tags are ignored: a discounted product shows the Sale pill (DiscountBadge) instead
  const tag = p.badges?.find((b) => b !== "sale");

  // ponytail: h-6 not h-5 — Khmer letters are taller than Latin ones
  const PILL = "absolute top-2.5 left-2.5 h-6 gap-1 border-0 px-2.5 text-[11px] font-semibold shadow-sm [&>svg]:size-3!";

  return (
    <Link href={path(`/products/${p.slug}`)} onClick={markFromList} className="group rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
      <Card className={cn("gap-2 bg-transparent py-0 ring-0", soldOut && "opacity-60")}>
        <div className="relative">
          <Img
            src={thumbUrl(p.image)}
            alt={pick(p.name, lang)}
            sizes="(min-width: 1024px) 220px, (min-width: 768px) 30vw, 50vw"
            priority={priority}
            className="aspect-[1/1.05] rounded-3xl"
            fallback={
              <ImageOff className="absolute inset-0 m-auto size-8 text-muted-foreground/40" aria-hidden />
            }
          />
          <DiscountBadge off={off} className="absolute top-2.5 right-2.5" />
          {/* photo's top-left: "Out of stock" (dark glass, reads on any photo), or else the product's tag with its icon */}
          {soldOut ? (
            <Badge className={cn(PILL, "bg-foreground/70 text-background backdrop-blur-sm")}>
              <Ban aria-hidden />
              {t("outOfStock")}
            </Badge>
          ) : (
            tag && (
              <Badge className={cn(PILL, tag === "best" && "bg-best text-best-foreground")}>
                {tag === "best" ? <Flame aria-hidden /> : <Star className="fill-current" aria-hidden />}
                {t(tag)}
              </Badge>
            )
          )}
        </div>

        <div className="px-1">
          <h3 className="line-clamp-2 text-[15px] leading-snug group-hover:underline">
            {pick(p.name, lang)}
          </h3>
          {/* old + new price on one row */}
          <p className="mt-1 flex flex-wrap items-baseline gap-x-1.5">
            {p.oldPrice && (
              <span className="text-xs text-destructive line-through">
                {formatPrice(p.oldPrice)}
              </span>
            )}
            <span className="text-base font-bold">{formatPrice(p.price)}</span>
          </p>
        </div>
      </Card>
    </Link>
  );
}
