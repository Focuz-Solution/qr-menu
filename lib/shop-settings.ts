import "server-only";
import type { Locale } from "next-intl";
import { cache } from "react";
import { shop } from "@/lib/shop";
import { prisma } from "@/lib/db";

/**
 * Shop language, header message, name, logo and brand colour from Admin → Settings, for the shop pages (defaults: `shop` in lib/shop.ts).
 * Read when a page is built/regenerated; saving the settings refreshes the shop (revalidatePath).
 */
type ShopLook = { language: Locale; notice: string; name: string; logo: string; brandColor: string | null; brandText: string | null };

export const shopSettings = cache(async (): Promise<ShopLook> => {
  try {
    const row = await prisma.shopSettings.findUnique({
      where: { id: 1 },
      select: { language: true, notice: true, name: true, logoUrl: true, brandColor: true, brandText: true },
    });
    return {
      language: row?.language === "en" ? "en" : "km",
      notice: row?.notice ?? "",
      name: row?.name ?? shop.name,
      logo: row?.logoUrl ?? shop.logo,
      brandColor: row?.brandColor ?? null,
      brandText: row?.brandText ?? null,
    };
  } catch (cause) {
    // no database configured (build without DATABASE_URL) → default Khmer shop; with one, a failed read throws
    // so Next keeps the last good page instead of caching the defaults
    if (process.env.DATABASE_URL) throw cause;
    return { language: "km", notice: "", name: shop.name, logo: shop.logo, brandColor: null, brandText: null };
  }
});
