import "server-only";
import type { Locale } from "next-intl";
import { cache } from "react";
import { shop } from "@/lib/shop";
import { prisma } from "@/lib/db";

/**
 * Shop language, header message, name, logo and brand colour from Admin → Settings (defaults: `shop` in lib/shop.ts).
 * `shopId` = that shop (customer pages: the shop in the address; admin: the current shop); null → the defaults.
 * Read when a page is built/regenerated; saving the settings refreshes the shop (revalidatePath).
 */
export type ShopLayout = "scroll" | "filter";
type ShopLook = { language: Locale; layout: ShopLayout; notice: string; name: string; logo: string; brandColor: string | null; brandText: string | null;
  /** Social links from Settings (null = not set) — footer contact icons */
  links: { telegram: string | null; facebook: string | null; tiktok: string | null };
  /** Shop details from Settings ("" / null = not set → hidden in the footer) */
  contact: { phone: string | null; address: string; mapUrl: string | null } };

export const shopSettings = cache(async (shopId: string | null): Promise<ShopLook> => {
  try {
    const row = !shopId ? null : await prisma.shopSettings.findUnique({
      where: { shopId },
      select: { language: true, layout: true, notice: true, name: true, logoUrl: true, brandColor: true, brandText: true, telegramUrl: true, facebookUrl: true, tiktokUrl: true, contactPhone: true, address: true, mapUrl: true },
    });
    return {
      language: row?.language === "en" ? "en" : "km",
      layout: row?.layout === "filter" ? "filter" : "scroll",
      notice: row?.notice ?? "",
      name: row?.name ?? shop.name,
      logo: row?.logoUrl ?? shop.logo,
      brandColor: row?.brandColor ?? null,
      brandText: row?.brandText ?? null,
      links: { telegram: row?.telegramUrl ?? null, facebook: row?.facebookUrl ?? null, tiktok: row?.tiktokUrl ?? null },
      contact: { phone: row?.contactPhone ?? null, address: row?.address ?? "", mapUrl: row?.mapUrl ?? null },
    };
  } catch (cause) {
    // no database configured (build without DATABASE_URL) → default Khmer shop; with one, a failed read throws
    // so Next keeps the last good page instead of caching the defaults
    if (process.env.DATABASE_URL) throw cause;
    return { language: "km", layout: "scroll", notice: "", name: shop.name, logo: shop.logo, brandColor: null, brandText: null, links: { telegram: null, facebook: null, tiktok: null }, contact: { phone: null, address: "", mapUrl: null } };
  }
});
