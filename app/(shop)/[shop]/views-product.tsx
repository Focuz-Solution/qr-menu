import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { getMenu } from "@/lib/menu";
import { richToText } from "@/lib/rich-text";
import { pick } from "@/lib/shop";
import { shopSettings } from "@/lib/shop-settings";
import { shopBySlug } from "@/lib/shops";
import { ProductView } from "./products/[slug]/ProductView";

// Shared by app.com/<shop>/… and the main address (see views.tsx).

// ---------- product page ----------

/** the shop's id + this product of it (null / undefined when either doesn't exist) */
async function findProduct(shop: string, slug: string) {
  const shopId = await shopBySlug(shop);
  return { shopId, product: (await getMenu(shopId)).products.find((p) => p.slug === slug) };
}

/** products that exist at build time are pre-built; new ones (added in Admin later) render on first visit */
export async function productSlugs(shop: string) {
  return (await getMenu(await shopBySlug(shop))).products.map((p) => ({ slug: p.slug }));
}

/** link preview for this product in the page's language: name, first line of the description, product photo */
export async function productMetadata(shop: string, base: string, slug: string): Promise<Metadata> {
  const { shopId, product: p } = await findProduct(shop, slug);
  const { language: locale } = await shopSettings(shopId);
  if (!p) return {};
  const title = pick(p.name, locale);
  const description = richToText(pick(p.description, locale)).split("\n").find(Boolean) ?? "";
  return {
    title,
    description,
    alternates: { canonical: `${base}/products/${slug}` },
    openGraph: { type: "website", title, description, images: p.image ? [p.image] : [] },
  };
}

export async function ShopProduct({ shop, slug }: { shop: string; slug: string }) {
  const { shopId, product } = await findProduct(shop, slug);
  if (!product) notFound();
  setRequestLocale((await shopSettings(shopId)).language);
  return <ProductView product={product} />;
}
