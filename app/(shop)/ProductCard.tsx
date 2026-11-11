"use client";

import { ImageOff } from "lucide-react";
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
  const lang = useLocale();
  const t = useTranslations("product");
  const off = discountPercent(p);
  const soldOut = !p.inStock;
  const tag = p.badges?.[0];

  return (
    <Link href={`/products/${p.slug}/`} onClick={markFromList} className="group rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
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
          <DiscountBadge off={off} className="absolute top-2.5 left-2.5 size-10 text-xs md:size-11" />
          {soldOut && (
            <Badge variant="secondary" className="absolute top-2.5 right-2.5 h-5 px-2 text-[10px] font-semibold">
              {t("outOfStock")}
            </Badge>
          )}
        </div>

        <div className="px-1">
          {p.brand && (
            <p className="truncate text-sm font-bold tracking-wide text-primary uppercase">{p.brand}</p>
          )}
          <h3 className="line-clamp-2 text-[15px] leading-snug group-hover:underline">
            {tag && !soldOut && (
              <Badge
                className={cn(
                  "mr-1 h-4 align-middle px-1.5 text-[9px] leading-none font-semibold",
                  tag === "best" && "bg-best text-best-foreground",
                )}
              >
                {t(tag)}
              </Badge>
            )}
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
