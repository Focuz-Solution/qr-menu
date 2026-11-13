import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { getMenu } from "@/lib/menu";
import { shopSettings } from "@/lib/shop-settings";
import { shopBySlug } from "@/lib/shops";
import { Footer } from "./Footer";
import { Header } from "./Header";
import { Catalogue } from "./Catalogue";

// app.com/<shop>: that shop's catalogue (no shop with this address → not found)
export default async function Home({ params }: PageProps<"/[shop]">) {
  const shopId = await shopBySlug((await params).shop);
  if (!shopId) notFound();
  const { language, layout, notice, name, logo, links, contact } = await shopSettings(shopId);
  setRequestLocale(language);
  const { categories, products } = await getMenu(shopId);

  return (
    <>
      <Header notice={notice} name={name} logo={logo} />
      <Catalogue categories={categories} products={products} layout={layout} />
      <Footer name={name} logo={logo} links={links} contact={contact} />
    </>
  );
}
