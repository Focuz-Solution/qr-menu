import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { pick } from "@/lib/shop";
import { getMenu } from "@/lib/menu";
import { shopSettings } from "@/lib/shop-settings";
import { ProductView } from "./ProductView";

// products that exist at build time are pre-built; new ones (added in Admin later) render on first visit
export async function generateStaticParams() {
  return (await getMenu()).products.map((p) => ({ slug: p.slug }));
}

const getProduct = async (slug: string) => (await getMenu()).products.find((p) => p.slug === slug);

// Link preview for this product in the page's language: name, first line of the description, product photo
export async function generateMetadata({ params }: PageProps<"/products/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const { language: locale } = await shopSettings();
  const p = await getProduct(slug);
  if (!p) return {};
  const title = pick(p.name, locale);
  const description = pick(p.description, locale).split("\n")[0];
  return {
    title,
    description,
    alternates: { canonical: `/products/${slug}/` },
    openGraph: { type: "website", title, description, images: p.image ? [p.image] : [] },
  };
}

export default async function ProductPage({ params }: PageProps<"/products/[slug]">) {
  const { slug } = await params;
  setRequestLocale((await shopSettings()).language);
  const product = await getProduct(slug);
  if (!product) notFound();
  return <ProductView product={product} />;
}
