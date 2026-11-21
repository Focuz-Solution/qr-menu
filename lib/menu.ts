import "server-only";
import { cache } from "react";
import type { Product, ShopCategory, Variant } from "@/lib/shop";
import { cleanTiers, type Tiers } from "@/lib/wholesale";
import { prisma } from "@/lib/db";

const BADGE = { new: "new", best_seller: "best", sale: "sale" } as const;

/**
 * What the shop `shopId` shows: visible categories (admin order) and their visible, not-deleted products,
 * mapped to the shop's `Product` shape. Read when a page is built/regenerated; Menu saves refresh the shop.
 */
export const getMenu = cache(async (shopId: string | null): Promise<{ categories: ShopCategory[]; products: Product[] }> => {
  try {
    if (!shopId) return { categories: [], products: [] };
    const rows = await prisma.category.findMany({
      where: { shopId, isVisible: true },
      orderBy: { sortOrder: "asc" },
      select: {
        slug: true,
        name: true,
        items: {
          where: { isVisible: true, deletedAt: null },
          orderBy: { sortOrder: "asc" },
          include: {
            images: { orderBy: { sortOrder: "asc" }, select: { url: true } },
            sizes: { orderBy: { size: { sortOrder: "asc" } }, select: { priceCents: true, size: { select: { id: true, name: true } } } },
            wholesale: { select: { isActive: true, tiers: true } },
          },
        },
      },
    });
    const products = rows.flatMap((c) =>
      c.items.map((i): Product => {
        // one name/description for both languages (admin types Khmer or English): kept once, as km —
        // pick() falls back to it, so the text isn't sent to the browser twice
        const one = (s: string) => ({ km: s, en: "" });
        const [image = "", ...images] = i.images.map((x) => x.url);
        // wholesale steps only when turned on; rows without steps are left out
        const tiers = i.wholesale?.isActive
          ? Object.entries((i.wholesale.tiers ?? {}) as Record<string, unknown>).flatMap(([k, v]) => {
              const steps = cleanTiers(v);
              return steps.length ? [[k, steps] as const] : [];
            })
          : [];
        const variants = (Array.isArray(i.variants) ? i.variants : []) as { label: string; hex?: string; image?: string; priceCents?: number }[];
        return {
          slug: i.slug,
          name: one(i.name),
          brand: i.brand ?? undefined,
          category: c.slug,
          price: i.priceCents / 100,
          oldPrice: i.compareAtCents != null ? i.compareAtCents / 100 : undefined,
          image,
          images,
          variants: variants.map((v): Variant => ({ label: v.label, hex: v.hex, image: v.image, price: v.priceCents != null ? v.priceCents / 100 : undefined })),
          sizes: i.sizes.map((s) => ({ id: s.size.id, name: s.size.name, price: s.priceCents != null ? s.priceCents / 100 : undefined })),
          youtube: i.youtubeId ?? undefined,
          description: one(i.description),
          badges: i.badge ? [BADGE[i.badge]] : [],
          inStock: i.isAvailable,
          wholesale: tiers.length ? (Object.fromEntries(tiers) as Tiers) : undefined,
        };
      }),
    );
    return { categories: rows.map((c) => ({ slug: c.slug, name: c.name })), products };
  } catch (cause) {
    // no database configured (build without DATABASE_URL) → empty shop instead of a failed build.
    // With a database, a failed read throws: Next keeps serving the last good page instead of caching an empty shop.
    if (process.env.DATABASE_URL) throw cause;
    return { categories: [], products: [] };
  }
});

const NO_TEXT = { km: "", en: "" };

/**
 * The menu for pages that list products (home grid, cart, checkout): the same products WITHOUT their descriptions,
 * which only the product page shows. Every shop page carries this list, so long descriptions would otherwise be
 * downloaded on every page. One array per request: the layout and the page share it (sent once).
 */
export const getMenuList = cache(async (shopId: string | null) => {
  const { categories, products } = await getMenu(shopId);
  return { categories, products: products.map((p) => ({ ...p, description: NO_TEXT })) };
});
