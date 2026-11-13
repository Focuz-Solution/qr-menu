import "server-only";
import { cache } from "react";
import { appUrl } from "@/lib/app-url";
import { prisma } from "@/lib/db";

/**
 * Words a shop's URL name can't be (plan/multi-tenant.md): every top-level route / file of the app,
 * so `app.com/<slug>/` never clashes with them. Adding a new top-level page = add its name here.
 */
export const RESERVED_SLUGS = new Set([
  "admin", "api", "products", "checkout", "cart", "qr", "_next", "shop", "shops", "www", "app", "login", "help",
  "icon.png", "apple-icon.png", "favicon.ico", "robots.txt", "sitemap.xml", "messages", "images",
]);

/** a-z 0-9 and "-", 3–40 characters, no "-" at the ends, not reserved */
export function isShopSlug(slug: string) {
  return /^[a-z0-9](?:[a-z0-9-]{1,38})[a-z0-9]$/.test(slug) && !RESERVED_SLUGS.has(slug);
}

/** the public site's domain for showing shop links (appUrl: APP_BASE_URL / Vercel); locally / not set → example.com */
export function publicHost() {
  const host = appUrl() ? new URL(appUrl()!).host : "";
  return host && !host.startsWith("localhost") && !host.startsWith("127.") ? host : "example.com";
}

/** the shop at app.com/<slug> (customer pages): its id, or null when no shop has that address */
export const shopBySlug = cache(async (slug: string): Promise<string | null> => {
  try {
    return (await prisma.shop.findUnique({ where: { slug: decodeURIComponent(slug) }, select: { id: true } }))?.id ?? null;
  } catch (cause) {
    // no database configured (build without DATABASE_URL) → no shop; with one, a failed read throws so Next keeps
    // the last good page instead of caching "not found" for a real shop
    if (process.env.DATABASE_URL) throw cause;
    return null;
  }
});

/** the shop shown at app.com/ itself (Settings → Main address, super-admin only), or null when none is picked */
export const defaultShopSlug = cache(async (): Promise<string | null> => {
  try {
    return (await prisma.shop.findFirst({ where: { isDefault: true }, orderBy: { createdAt: "asc" }, select: { slug: true } }))?.slug ?? null;
  } catch (cause) {
    if (process.env.DATABASE_URL) throw cause; // same rule as shopBySlug
    return null;
  }
});

export async function firstShopSlug() {
  try {
    return (await prisma.shop.findFirst({ orderBy: { createdAt: "asc" }, select: { slug: true } }))?.slug ?? null;
  } catch (cause) {
    if (process.env.DATABASE_URL) throw cause; // same rule as shopBySlug
    return null;
  }
}

/** every shop's address — pre-builds their pages; a shop made later renders on its first visit */
export async function allShopSlugs() {
  try {
    return (await prisma.shop.findMany({ select: { slug: true } })).map((s) => s.slug);
  } catch (cause) {
    if (process.env.DATABASE_URL) throw cause; // same rule as shopBySlug
    return [];
  }
}

/**
 * Owner with no shop yet: makes one ("My shop", address my-shop / my-shop-2 …) so they go straight into
 * the dashboard instead of an empty shop list; the name and logo are set in Settings.
 */
export async function createFirstShop(name: string) {
  for (let n = 1; ; n++) {
    const slug = n === 1 ? "my-shop" : `my-shop-${n}`;
    if (await prisma.shop.findUnique({ where: { slug }, select: { id: true } })) continue;
    return prisma.shop.create({ data: { slug, settings: { create: { name } } }, select: { id: true } });
  }
}
