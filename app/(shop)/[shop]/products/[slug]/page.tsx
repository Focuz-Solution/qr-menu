import { productMetadata, productSlugs, ShopProduct } from "../../views";

export async function generateStaticParams({ params }: { params: { shop: string } }) {
  return productSlugs(params.shop);
}

export async function generateMetadata({ params }: PageProps<"/[shop]/products/[slug]">) {
  const { shop, slug } = await params;
  return productMetadata(shop, `/${shop}`, slug);
}

export default async function ProductPage({ params }: PageProps<"/[shop]/products/[slug]">) {
  const { shop, slug } = await params;
  return <ShopProduct shop={shop} slug={slug} />;
}
