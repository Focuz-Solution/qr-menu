import { notFound } from "next/navigation";
import { defaultShopSlug } from "@/lib/shops";
import { productMetadata, productSlugs, ShopProduct } from "../../../(shop)/[shop]/views-product";

// app.com/products/<item>: a product of the default shop (no default shop → not found)
export async function generateStaticParams() {
  const shop = await defaultShopSlug();
  return shop ? productSlugs(shop) : [];
}

export async function generateMetadata({ params }: PageProps<"/products/[slug]">) {
  const shop = await defaultShopSlug();
  return shop ? productMetadata(shop, "", (await params).slug) : {};
}

export default async function ProductPage({ params }: PageProps<"/products/[slug]">) {
  const shop = await defaultShopSlug();
  if (!shop) notFound();
  return <ShopProduct shop={shop} slug={(await params).slug} />;
}
