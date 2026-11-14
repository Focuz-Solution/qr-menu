import "server-only";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";

/**
 * After a Menu / Settings / Delivery save: rebuild only THIS shop's pages (app.com/<shop>/…, and the main address
 * app.com/, /products/…, /checkout when it is the default shop) — not every shop's. Other shops keep their cached
 * pages, so their customers never wait for a rebuild because someone else saved.
 *
 * Real addresses, not `revalidatePath("/<shop>", "layout")`: Next tags a page with its route (`/(shop)/[shop]/layout`)
 * and its address (`/my-shop`), so "/my-shop/layout" matches nothing and the shop would keep its old page.
 */
export async function revalidateShop(shopId: string, oldSlug?: string) {
  const shop = await prisma.shop.findUnique({
    where: { id: shopId },
    // products just deleted too (their old page must turn into "not found"); ones deleted long ago were already
    // cleared when they were deleted, so they aren't re-cleared on every save forever
    select: {
      slug: true,
      isDefault: true,
      items: { where: { OR: [{ deletedAt: null }, { deletedAt: { gte: new Date(Date.now() - 60 * 60_000) } }] }, select: { slug: true } },
    },
  });
  revalidatePath("/admin", "layout"); // the admin lists themselves
  if (!shop) return;
  const paths = ["", "/checkout", ...shop.items.map((i) => `/products/${encodeURIComponent(i.slug)}`)];
  // renamed address (Settings): the old address's cached pages go too — they are "not found" now
  const slugs = [shop.slug, ...(oldSlug && oldSlug !== shop.slug ? [oldSlug] : [])];
  for (const p of paths) {
    for (const slug of slugs) revalidatePath(`/${encodeURIComponent(slug)}${p}`);
    if (shop.isDefault) revalidatePath(p || "/"); // main address: app.com/, /checkout, /products/…
  }
}
