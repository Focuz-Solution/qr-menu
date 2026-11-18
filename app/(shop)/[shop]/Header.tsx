"use client";

import { useShopPath } from "@/lib/shop-path";
import { Search } from "lucide-react";
import { ShopLogo } from "@/components/ShopLogo";
import { useTranslations } from "next-intl";
import { CartLink } from "@/components/CartLink";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { useEffect, useState } from "react";

// ponytail: the icon just fires a window event the catalogue listens for — a context provider for one boolean
// would mean a new file and a wrapper in page.tsx; switch to context if a third component ever needs this
export const TOGGLE_SEARCH = "toggle-search";

/** `notice` = running text from Settings → Appearance; empty → no running text */
export function Header({ notice, name, logo }: { notice: string; name: string; logo: string }) {
  const home = useShopPath();
  const t = useTranslations("home");
  const hidden = useHideOnScrollDown();

  return (
    // scrolling down slides it away (the category row then pins at the top); scrolling up brings it back
    <header
      className={cn(
        "sticky top-0 z-20 -mx-4 flex items-center justify-between gap-2 bg-background/95 px-4 py-2 backdrop-blur motion-safe:transition-transform motion-safe:duration-300",
        hidden && "-translate-y-full",
      )}
    >
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

/** true while the page is being scrolled down (past the header); scrolling up or the top of the page → false.
 *  Also sets <html data-header-hidden> so the category row (Catalogue) moves up with it via --shop-header. */
function useHideOnScrollDown() {
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    let last = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      // small moves (and iOS bounce at the ends) don't toggle it
      if (Math.abs(y - last) < 8) return;
      setHidden(y > last && y > 72);
      last = y;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  useEffect(() => {
    document.documentElement.toggleAttribute("data-header-hidden", hidden);
  }, [hidden]);
  // leaving the shop home (product page, checkout): no header to follow
  useEffect(() => () => document.documentElement.removeAttribute("data-header-hidden"), []);
  return hidden;
}
