import { setRequestLocale } from "next-intl/server";
import { getMenu } from "@/lib/menu";
import { shopSettings } from "@/lib/shop-settings";
import { Footer } from "./Footer";
import { Header } from "./Header";
import { Catalogue } from "./Catalogue";

export default async function Home() {
  const { language, notice, name, logo } = await shopSettings();
  setRequestLocale(language);
  const { categories, products } = await getMenu();

  return (
    <>
      <Header notice={notice} name={name} logo={logo} />
      <Catalogue categories={categories} products={products} />
      <Footer name={name} />
    </>
  );
}
