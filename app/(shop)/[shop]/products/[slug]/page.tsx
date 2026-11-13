import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { pick } from "@/lib/shop";
import { getMenu } from "@/lib/menu";
import { shopSettings } from "@/lib/shop-settings";
import { shopBySlug } from "@/lib/shops";
import { ProductView } from "./ProductView";

// products that exist at build time are pre-built; new ones (added in Admin later) render on first visit
export async function generateStaticParams({ params }: { params: { shop: string } }) {
  return (await getMenu(await shopBySlug(params.shop))).products.map((p) => ({ slug: p.slug }));
}

/** the shop's id + this product of it (null / undefined when either doesn't exist) */
async function find(shop: string, slug: string) {
  const shopId = await shopBySlug(shop);
  return { shopId, product: (await getMenu(shopId)).products.find((p) => p.slug === slug) };
}

// Link preview for this product in the page's language: name, first line of the description, product photo
export async function generateMetadata({ params }: PageProps<"/[shop]/products/[slug]">): Promise<Metadata> {
  const { shop, slug } = await params;
  const { shopId, product: p } = await find(shop, slug);
  const { language: locale } = await shopSettings(shopId);
  if (!p) return {};
  const title = pick(p.name, locale);
  const description = pick(p.description, locale).split("\n")[0];
  return {
    title,
    description,
    alternates: { canonical: `/${shop}/products/${slug}` },
    openGraph: { type: "website", title, description, images: p.image ? [p.image] : [] },
  };
}

export default async function ProductPage({ params }: PageProps<"/[shop]/products/[slug]">) {
  const { shop, slug } = await params;
  const { shopId, product } = await find(shop, slug);
  if (!product) notFound();
  setRequestLocale((await shopSettings(shopId)).language);
  return <ProductView product={product} />;
}
