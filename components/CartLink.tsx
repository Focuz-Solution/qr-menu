"use client";

import { ShoppingBag } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useCart } from "@/lib/cart";
import { cn } from "@/lib/utils";

// Bag icon → /checkout/ (cart + order on one page), with the item count in a badge (home header + product detail top bar)
export function CartLink({ className }: { className?: string }) {
  const t = useTranslations("home");
  const { count } = useCart();
  return (
    <Link
      href="/checkout/"
      aria-label={t("cart")}
      className={cn("relative grid size-11 shrink-0 place-items-center rounded-full text-foreground hover:bg-secondary", className)}
    >
      <ShoppingBag className="size-6" strokeWidth={1.75} aria-hidden />
      {count > 0 && (
        <span className="absolute top-0.5 right-0.5 grid min-w-5 place-items-center rounded-full bg-primary px-1 text-xs text-primary-foreground">
          {count}
        </span>
      )}
    </Link>
  );
}
