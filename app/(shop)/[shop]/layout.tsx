import { allShopSlugs } from "@/lib/shops";
import { ShopShell, shopMetadata } from "./views";

// every shop's pages are pre-built; a shop made later renders on its first visit
export async function generateStaticParams() {
  return (await allShopSlugs()).map((shop) => ({ shop }));
}

export async function generateMetadata({ params }: LayoutProps<"/[shop]">) {
  const { shop } = await params;
  return shopMetadata(shop, `/${shop}`);
}

// Root layout of each shop at its own address (app.com/<shop>/…)
export default async function ShopLayout({ children, params }: LayoutProps<"/[shop]">) {
  const { shop } = await params;
  return (
    <ShopShell slug={shop} base={`/${shop}`}>
      {children}
    </ShopShell>
  );
}
