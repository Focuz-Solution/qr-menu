import { ShakeOnSubmit } from "@/components/ShakeOnSubmit";
import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations, setRequestLocale } from "next-intl/server";
import { MenuProvider } from "@/components/MenuProvider";
import { brandStyles } from "@/lib/brand-colors";
import { appUrl } from "@/lib/app-url";
import { getMenu } from "@/lib/menu";
import { shopSettings } from "@/lib/shop-settings";
import { allShopSlugs, shopBySlug } from "@/lib/shops";
import { fontVariables } from "../../fonts";
import "../../globals.css";

// every shop's pages are pre-built; a shop made later renders on its first visit
export async function generateStaticParams() {
  return (await allShopSlugs()).map((shop) => ({ shop }));
}

// title/description + link preview in the shop language
export async function generateMetadata({ params }: LayoutProps<"/[shop]">): Promise<Metadata> {
  const { shop: slug } = await params;
  const { language: locale, name, logo } = await shopSettings(await shopBySlug(slug));
  const t = await getTranslations({ locale, namespace: "meta" });
  return {
    ...(appUrl() && { metadataBase: new URL(appUrl()!) }),
    title: { default: name, template: `%s | ${name}` },
    description: t("description"),
    alternates: { canonical: `/${slug}` },
    openGraph: {
      type: "website",
      siteName: name,
      locale: locale === "en" ? "en_US" : "km_KH",
      images: logo ? [logo] : [],
    },
  };
}

// Root layout of each shop (app.com/<shop>/…). An address that isn't a shop still gets the layout (default look);
// its pages call notFound().
export default async function ShopLayout({ children, params }: LayoutProps<"/[shop]">) {
  const shopId = await shopBySlug((await params).shop);
  // the shop shows the language the owner picked in Settings → Appearance (not the address)
  const { language: locale, brandColor, brandText } = await shopSettings(shopId);
  setRequestLocale(locale);
  const { products } = await getMenu(shopId);
  // customers' browsers get the shop texts only, not the admin panel's (a third of the file)
  const messages = Object.fromEntries(Object.entries(await getMessages()).filter(([namespace]) => namespace !== "admin"));
  // brand colour from Settings → Appearance replaces the theme's main colour (buttons, chips, prices, focus ring)
  // and tints the soft surfaces; no colour saved → the default black theme from globals.css
  const brand = brandStyles(brandColor, brandText);

  return (
    <html lang={locale} className={`${fontVariables} h-full antialiased`} style={brand}>
      <body className="min-h-full">
        <NextIntlClientProvider messages={messages}>
          <MenuProvider products={products}>
            <div className="mx-auto flex min-h-dvh w-full max-w-4xl flex-col px-4">
              <main className="flex-1">{children}</main>
            </div>
          </MenuProvider>
        </NextIntlClientProvider>
        <ShakeOnSubmit />
      </body>
    </html>
  );
}
