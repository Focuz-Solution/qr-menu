"use client";

import { useShopPath } from "@/lib/shop-path";
import { Search } from "lucide-react";
import { ShopLogo } from "@/components/ShopLogo";
import { useTranslations } from "next-intl";
import { CartLink } from "@/components/CartLink";
import Link from "next/link";

// ponytail: the icon just fires a window event the catalogue listens for — a context provider for one boolean
// would mean a new file and a wrapper in page.tsx; switch to context if a third component ever needs this
export const TOGGLE_SEARCH = "toggle-search";

/** `notice` = running text from Settings → Appearance; empty → no running text */
export function Header({ notice, name, logo }: { notice: string; name: string; logo: string }) {
  const home = useShopPath();
  const t = useTranslations("home");

  return (
    <header className="sticky top-0 z-20 -mx-4 flex items-center justify-between gap-2 bg-background/95 px-4 py-2 backdrop-blur">
      <Link href={home()} className="flex min-h-11 items-center rounded-full">
        <ShopLogo src={logo} alt={name} size={56} priority className="size-14" />
      </Link>
      {/* running text only when the owner set one; otherwise an empty spacer keeps the icons on the right */}
      <p className="min-w-2 flex-1 overflow-hidden px-2 text-center text-sm text-primary">
        {notice && (
          // two copies: the second one follows the first so the strip never runs empty
          <span className="flex w-max animate-marquee">
            <span className="px-6 whitespace-nowrap">{notice}</span>
            <span className="px-6 whitespace-nowrap" aria-hidden>{notice}</span>
          </span>
        )}
      </p>
      <button
        type="button"
        onClick={() => window.dispatchEvent(new Event(TOGGLE_SEARCH))}
        aria-label={t("search")}
        className="grid size-11 shrink-0 place-items-center rounded-full text-foreground hover:bg-secondary"
      >
        <Search className="size-6" strokeWidth={1.75} aria-hidden />
      </button>
      <CartLink className="-ml-2" />
    </header>
  );
}
