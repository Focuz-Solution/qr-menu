"use client";

import { ChevronLeft, PackageOpen, Search, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { Img } from "@/components/Img";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { Product, ShopCategory } from "@/lib/shop";
import type { ShopLayout } from "@/lib/shop-settings";
import { cn } from "@/lib/utils";
import { ProductCard } from "./ProductCard";
import { TOGGLE_SEARCH } from "./Header";

// pill chip (categories / brands)
const CHIP =
  "h-11 shrink-0 rounded-full bg-background px-4 text-sm font-normal text-primary whitespace-nowrap hover:text-primary data-[state=on]:border-primary data-[state=on]:bg-primary data-[state=on]:font-semibold data-[state=on]:text-primary-foreground data-[state=on]:hover:bg-primary data-[state=on]:hover:text-primary-foreground";
// tab (template "filter": Show all / By category / By brand / Discount): plain text, the open one a filled pill
const TAB =
  "h-11 shrink-0 rounded-full px-6 text-sm font-medium whitespace-nowrap text-muted-foreground hover:bg-transparent hover:text-foreground data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=on]:hover:bg-primary data-[state=on]:hover:text-primary-foreground";

type Tab = "all" | "category" | "brand" | "sale";
const onSale = (p: Product) => !!p.oldPrice && p.oldPrice > p.price;

// Every product, grouped by category, with a swipeable chip row.
// Template "scroll": a chip scrolls to its section.
// Template "filter": tabs Show all / By category / By brand / Discount; By category and By brand first show
// round photo tiles (with a product count), and a tapped tile shows only its products.
// The search bar is hidden until the header's search icon is tapped.
export function Catalogue({ categories, products, layout }: { categories: ShopCategory[]; products: Product[]; layout: ShopLayout }) {
  const t = useTranslations();
  const filter = layout === "filter";
  // chips = categories that have products, in the admin's order (empty ones are not shown)
  const chips = categories.filter((c) => products.some((p) => p.category === c.slug)).map((c) => c.slug);
  const nameOf = (slug: string) => categories.find((c) => c.slug === slug)?.name ?? slug;
  const brands = [...new Set(products.flatMap((p) => (p.brand ? [p.brand] : [])))].sort((a, b) => a.localeCompare(b));
  // tabs with nothing to show are hidden
  const tabs: Tab[] = ["all", "category", "brand", "sale"];
  // no product has a brand / a discount → that tab shows greyed out and can't be tapped
  const empty: Partial<Record<Tab, boolean>> = { brand: brands.length === 0, sale: !products.some(onSale) };
  const [tab, setTab] = useState<Tab>("all");
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
  // template "scroll": category chip row; a chip with no matching products is disabled
  const enabled = new Set(shown.map((p) => p.category));
  // template "filter", By category / By brand: the tapped tile (null = show the tiles)
  const brandTab = filter && tab === "brand";
  const pick = filter && (tab === "category" || brandTab) ? active : null;
  const tiles =
    filter && !pick && (tab === "category" || brandTab)
      ? (brandTab ? brands : chips)
          .map((v) => ({ v, items: shown.filter((p) => (brandTab ? p.brand : p.category) === v) }))
          .filter((x) => x.items.length > 0)
      : null;
  // which products the current tab lets through
  const keep = (p: Product) =>
    !filter || tab === "all" || (tab === "sale" ? onSale(p) : brandTab ? p.brand === pick : p.category === pick);
  // one section per category, in chip order; only sections with products
  const sections = chips
    .map((cat) => ({ cat, items: shown.filter((p) => p.category === cat && keep(p)) }))
    .filter((s) => s.items.length > 0);
  // which sections exist right now — the scroll-spy re-reads the page whenever this changes
  const sectionKey = sections.map((s) => s.cat).join();

  // template "scroll": before any scroll, the first category with products shows as active
  const current = filter ? null : (active ?? sections[0]?.cat ?? null);

  // scroll-spy: the active chip follows the section you're looking at
  // ponytail: a scroll listener beats IntersectionObserver here — it also fires at the very bottom of the page
  useEffect(() => {
    if (filter) return; // template "filter": the chip is picked by tapping only
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
  }, [sectionKey, filter]);

  // keep the active chip in view inside the swipeable row (scrolls the row only, not the page)
  useEffect(() => {
    const row = chipsRef.current;
    const el = current ? row?.querySelector<HTMLElement>(`[data-chip="${CSS.escape(current)}"]`) : null;
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
        {/* template "filter": Show all / By category / By brand / Discount tabs (swipe on narrow phones) */}
        {filter && chips.length > 0 && (
          <div className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <ToggleGroup
              type="single"
              value={tab}
              onValueChange={(v) => {
                // the open tab tapped again: back to its tiles; another tab: open it
                if (v) setTab(v as Tab);
                setActive(null);
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
              className="flex w-max gap-1 py-2"
              spacing={1}
            >
              {tabs.map((v) => (
                <ToggleGroupItem key={v} value={v} disabled={empty[v]} className={cn(TAB, "disabled:opacity-40")}>
                  {t(`home.tab_${v}`)}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>
        )}
        {/* template "scroll": category chip row (native swipe scroll, scrollbar hidden) */}
        {!filter && chips.length > 0 && (
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
              {chips.map((v) => (
                <ToggleGroupItem
                  key={v}
                  data-chip={v}
                  value={v}
                  variant="outline"
                  disabled={!enabled.has(v)}
                  className={CHIP}
                >
                  {nameOf(v)}
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
      {products.length > 0 && (tiles ? tiles.length === 0 : sections.length === 0) && (
        <div className="flex flex-col items-center gap-4 py-16 text-center">
          <p className="text-muted-foreground">{t("home.noProducts")}</p>
          <Button variant="outline" className="h-11" onClick={() => setQ("")}>
            {t("home.clearFilters")}
          </Button>
        </div>
      )}

      {/* By category / By brand: round photo tiles (first product's photo), name, product count */}
      {tiles && (
        <div className="grid grid-cols-4 gap-x-2 gap-y-4 pt-2 md:grid-cols-6 lg:grid-cols-8">
          {tiles.map(({ v, items }) => (
            <button
              key={v}
              type="button"
              onClick={() => {
                setActive(v);
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
              className="flex min-w-0 flex-col items-center gap-1.5 rounded-xl text-center outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <Img
                src={items[0].image}
                alt=""
                sizes="(min-width: 1024px) 100px, 25vw"
                className="aspect-square w-full rounded-full border"
              />
              <span className="line-clamp-1 w-full text-xs font-medium">{brandTab ? v : nameOf(v)}</span>
              <span className="-mt-1 text-[11px] text-primary">{t("home.productCount", { count: items.length })}</span>
            </button>
          ))}
        </div>
      )}

      {/* a tapped tile: back to the tiles + its name */}
      {pick && (
        <button
          type="button"
          onClick={() => setActive(null)}
          className="-ml-2 flex h-11 items-center gap-1 rounded-full pr-3 pl-1 text-lg font-semibold outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <ChevronLeft className="size-6" aria-hidden />
          {brandTab ? pick : nameOf(pick)}
        </button>
      )}

      <div className="space-y-10 pt-2">
        {sections.map(({ cat, items }, i) => (
          <section
            key={cat}
            id={`cat-${cat}`}
            // ponytail: scroll-mt = header 72 + chips 68 (+ 64 with the search bar open); update if those change
            // (no forced height on the last section: a short last category just scrolls as far as the page goes)
            className={searching ? "scroll-mt-[208px]" : "scroll-mt-[144px]"}
          >
            {/* heading doubles as the divider: accent bar, title, then a hairline out to the edge */}
            {/* (not under a picked category: the back row above already names it) */}
            <h2 className={cn("flex items-center gap-3 pb-4", filter && pick && !brandTab && "sr-only")}>
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
