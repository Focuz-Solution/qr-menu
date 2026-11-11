"use client";

import { PackageOpen, Search, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { Product, ShopCategory } from "@/lib/shop";
import { cn } from "@/lib/utils";
import { ProductCard } from "./ProductCard";
import { TOGGLE_SEARCH } from "./Header";

// Every product, grouped by category, with a swipeable chip row that scrolls to a section.
// The search bar is hidden until the header's search icon is tapped.
export function Catalogue({ categories, products }: { categories: ShopCategory[]; products: Product[] }) {
  const t = useTranslations();
  // chips = categories that have products, in the admin's order (empty ones are not shown)
  const chips = categories.filter((c) => products.some((p) => p.category === c.slug)).map((c) => c.slug);
  const nameOf = (slug: string) => categories.find((c) => c.slug === slug)?.name ?? slug;
  const [active, setActive] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [q, setQ] = useState("");
  const chipsRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // a tapped chip stays active until its smooth scroll lands, so passing sections don't steal the highlight
  const holdUntil = useRef(0);

  // the header icon opens (and closes) the search bar; closing drops the search text
  useEffect(() => {
    const onToggle = () => {
      setSearching((open) => {
        if (open) setQ("");
        else setTimeout(() => inputRef.current?.focus());
        return !open;
      });
    };
    window.addEventListener(TOGGLE_SEARCH, onToggle);
    return () => window.removeEventListener(TOGGLE_SEARCH, onToggle);
  }, []);

  const needle = q.trim().toLowerCase();
  const shown = products.filter(
    (p) => !needle || [p.name.km, p.name.en, p.brand ?? ""].some((s) => s.toLowerCase().includes(needle)),
  );
  // one section per category, in chip order; while searching, only sections with matches
  const sections = chips
    .map((cat) => ({ cat, items: shown.filter((p) => p.category === cat) }))
    .filter((s) => s.items.length > 0);
  // every category keeps its chip; one with no section to scroll to is disabled
  const hasSection = new Set(sections.map((s) => s.cat));
  // which sections exist right now — the scroll-spy re-reads the page whenever this changes
  const sectionKey = sections.map((s) => s.cat).join();

  // before any scroll, the first category with products (រោមភ្នែកត មិនប្រើកាវ) shows as active
  const current = active ?? sections[0]?.cat ?? null;

  // scroll-spy: the active chip follows the section you're looking at
  // ponytail: a scroll listener beats IntersectionObserver here — it also fires at the very bottom of the page
  useEffect(() => {
    const els = sectionKey.split(",").map((cat) => document.getElementById(`cat-${cat}`)).filter((el) => el !== null);
    const onScroll = () => {
      if (Date.now() < holdUntil.current) return; // mid-tap: the tapped chip owns the highlight
      // at the very bottom the last section can be too short to reach the chip row, so it wins outright
      const atBottom = window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2;
      // otherwise: last section whose heading has passed under the pinned chip row (~144px); before any, the first
      const at = atBottom ? els.at(-1) : (els.filter((el) => el.getBoundingClientRect().top <= 160).at(-1) ?? els[0]);
      if (at) setActive(at.id.replace("cat-", ""));
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
    // re-registered when a search changes which sections exist
  }, [sectionKey]);

  // keep the active chip in view inside the swipeable row (scrolls the row only, not the page)
  useEffect(() => {
    const row = chipsRef.current;
    const el = current ? row?.querySelector<HTMLElement>(`#chip-${current}`) : null;
    if (row && el) row.scrollTo({ left: el.offsetLeft - (row.clientWidth - el.clientWidth) / 2, behavior: "smooth" });
  }, [current]);

  return (
    <>
      {/* search (when open) + category row stay pinned under the sticky header (72px: py-2 + 56px logo) */}
      <div className="sticky top-[72px] z-10 -mx-4 bg-background/95 px-4 backdrop-blur">
        {searching && (
          <div className="py-2">
            <div className="flex h-12 items-center rounded-xl border bg-background focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/30">
              <Search className="ml-3.5 size-5 shrink-0 text-foreground" strokeWidth={1.75} aria-hidden />
              <Input
                ref={inputRef}
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={t("home.search")}
                aria-label={t("home.search")}
                // the wrapper draws the border + focus ring; text-base keeps phones from zooming in on focus
                className="h-full flex-1 border-0 bg-transparent px-3 text-base shadow-none focus-visible:ring-0 [&::-webkit-search-cancel-button]:hidden"
              />
              <span className="h-6 w-px bg-border" aria-hidden />
              <button
                type="button"
                // empty box: the ✕ closes the search bar; with text it clears first
                onClick={() => (q ? setQ("") : setSearching(false))}
                aria-label={q ? t("home.clearSearch") : t("product.close")}
                className="grid size-11 shrink-0 place-items-center rounded-r-xl text-muted-foreground hover:text-foreground"
              >
                <X className="size-5" aria-hidden />
              </button>
            </div>
          </div>
        )}
        {/* category filter row (native swipe scroll, scrollbar hidden); hidden when there are no categories */}
        {chips.length > 0 && (
          <div ref={chipsRef} className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <ToggleGroup
              type="single"
              value={current ?? ""}
              // "" = the active chip was tapped again: scroll back to its section
              onValueChange={(v) => {
                const cat = v || current;
                if (!cat) return;
                setActive(cat);
                holdUntil.current = Date.now() + 1000; // ponytail: 1s covers a smooth scroll across the whole page
                document.getElementById(`cat-${cat}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
              // one swipeable row on every screen size
              className="flex w-max gap-2 py-3"
              spacing={2}
            >
              {chips.map((cat) => (
                <ToggleGroupItem
                  key={cat}
                  id={`chip-${cat}`}
                  value={cat}
                  variant="outline"
                  disabled={!hasSection.has(cat)}
                  className="h-11 shrink-0 rounded-full bg-background px-4 text-sm font-normal text-primary whitespace-nowrap hover:text-primary data-[state=on]:border-primary data-[state=on]:bg-primary data-[state=on]:font-semibold data-[state=on]:text-primary-foreground data-[state=on]:hover:bg-primary data-[state=on]:hover:text-primary-foreground"
                >
                  {nameOf(cat)}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>
        )}
      </div>

      {/* shop has no products yet (nothing added / shown in Admin → Menu) */}
      {products.length === 0 && (
        <div className="flex flex-col items-center gap-3 px-6 py-24 text-center">
          <span className="grid size-16 place-items-center rounded-full bg-secondary text-primary">
            <PackageOpen className="size-7" strokeWidth={1.75} aria-hidden />
          </span>
          <h2 className="text-lg font-semibold">{t("home.emptyTitle")}</h2>
          <p className="max-w-xs text-sm text-muted-foreground">{t("home.emptyText")}</p>
        </div>
      )}

      {/* products exist, but the search found none */}
      {products.length > 0 && sections.length === 0 && (
        <div className="flex flex-col items-center gap-4 py-16 text-center">
          <p className="text-muted-foreground">{t("home.noProducts")}</p>
          <Button variant="outline" className="h-11" onClick={() => setQ("")}>
            {t("home.clearFilters")}
          </Button>
        </div>
      )}

      <div className="space-y-10 pt-2">
        {sections.map(({ cat, items }, i) => (
          <section
            key={cat}
            id={`cat-${cat}`}
            className={cn(
              // ponytail: scroll-mt = header 72 + chips 68 (+ 64 with the search bar open); update if those change
              searching ? "scroll-mt-[208px]" : "scroll-mt-[144px]",
              // the last section fills the screen, so even a one-product category can scroll up to the chip row
              i === sections.length - 1 && "min-h-[calc(100dvh-200px)]",
            )}
          >
            {/* heading doubles as the divider: accent bar, title, then a hairline out to the edge */}
            <h2 className="flex items-center gap-3 pb-4">
              <span className="h-5 w-1 shrink-0 rounded-full bg-primary" aria-hidden />
              <span className="text-lg font-semibold">{nameOf(cat)}</span>
              <span className="h-px flex-1 bg-border" aria-hidden />
            </h2>
            <div className="grid grid-cols-2 gap-x-3 gap-y-5 md:grid-cols-3 lg:grid-cols-4">
              {items.map((p, j) => (
                // top row of the first section is above the fold — one of these is the LCP image
                <ProductCard key={p.slug} product={p} priority={i === 0 && j < 4} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}
