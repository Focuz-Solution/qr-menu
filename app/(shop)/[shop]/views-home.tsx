import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { getMenuList } from "@/lib/menu";
import { shopSettings } from "@/lib/shop-settings";
import { shopBySlug } from "@/lib/shops";
import { Catalogue } from "./Catalogue";
import { Footer } from "./Footer";
import { Header } from "./Header";

// Shared by app.com/<shop>/… and the main address (see views.tsx).

// ---------- home: the catalogue ----------

export async function ShopHome({ slug }: { slug: string }) {
  const shopId = await shopBySlug(slug);
  if (!shopId) notFound();
  const { language, layout, notice, name, logo, links, contact } = await shopSettings(shopId);
  setRequestLocale(language);
  const { categories, products } = await getMenuList(shopId);

  return (
    <>
      <Header notice={notice} name={name} logo={logo} />
      <Catalogue categories={categories} products={products} layout={layout} />
      <Footer name={name} logo={logo} links={links} contact={contact} />
    </>
  );
}
