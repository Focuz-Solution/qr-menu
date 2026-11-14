import "server-only";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";

/**
 * After a Menu / Settings / Delivery save: rebuild only THIS shop's pages (app.com/<shop>/…, and the main address
 * app.com/, /products/…, /checkout when it is the default shop) — not every shop's. Other shops keep their cached
 * pages, so their customers never wait for a rebuild because someone else saved.
 */
export async function revalidateShop(shopId: string) {
  const shop = await prisma.shop.findUnique({ where: { id: shopId }, select: { slug: true, isDefault: true } });
  revalidatePath("/admin", "layout"); // the admin lists themselves
  if (!shop) return;
  revalidatePath(`/${shop.slug}`, "layout"); // its home, products and checkout
  if (shop.isDefault) {
    revalidatePath("/"); // main address: home
    revalidatePath("/products", "layout"); // main address: every product page
    revalidatePath("/checkout"); // main address: checkout (delivery fees)
  }
}
