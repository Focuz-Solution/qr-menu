import "server-only";
import { cache } from "react";
import type { Product, ShopCategory, Variant } from "@/lib/shop";
import { prisma } from "@/lib/db";

const BADGE = { new: "new", best_seller: "best", sale: "sale" } as const;

/**
 * What the shop shows: visible categories (admin order) and their visible, not-deleted products,
 * mapped to the shop's `Product` shape. Read when a page is built/regenerated; Menu saves refresh the shop.
 */
export const getMenu = cache(async (): Promise<{ categories: ShopCategory[]; products: Product[] }> => {
  try {
    const rows = await prisma.category.findMany({
      where: { isVisible: true },
      orderBy: { sortOrder: "asc" },
      select: {
        slug: true,
        name: true,
        items: {
          where: { isVisible: true, deletedAt: null },
          orderBy: { sortOrder: "asc" },
          include: { images: { orderBy: { sortOrder: "asc" }, select: { url: true } } },
        },
      },
    });
    const products = rows.flatMap((c) =>
      c.items.map((i): Product => {
        // one name/description for both languages (admin types Khmer or English)
        const one = (s: string) => ({ km: s, en: s });
        const [image = "", ...images] = i.images.map((x) => x.url);
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
          description: one(i.description),
          badges: i.badge ? [BADGE[i.badge]] : [],
          inStock: i.isAvailable,
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
