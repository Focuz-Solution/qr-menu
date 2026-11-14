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
export async function revalidateShop(shopId: string) {
  const shop = await prisma.shop.findUnique({
    where: { id: shopId },
    // deleted products too: their old page must turn into "not found"
    select: { slug: true, isDefault: true, items: { select: { slug: true } } },
  });
  revalidatePath("/admin", "layout"); // the admin lists themselves
  if (!shop) return;
  const paths = ["", "/checkout", ...shop.items.map((i) => `/products/${encodeURIComponent(i.slug)}`)];
  for (const p of paths) {
    revalidatePath(`/${encodeURIComponent(shop.slug)}${p}`);
    if (shop.isDefault) revalidatePath(p || "/"); // main address: app.com/, /checkout, /products/…
  }
}
