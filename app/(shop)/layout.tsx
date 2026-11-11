import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { MenuProvider } from "@/components/MenuProvider";
import { brandStyles } from "@/lib/brand-colors";
import { shop } from "@/lib/shop";
import { getMenu } from "@/lib/menu";
import { shopSettings } from "@/lib/shop-settings";
import { fontVariables } from "../fonts";
import "../globals.css";

// title/description + link preview in the shop language
export async function generateMetadata(): Promise<Metadata> {
  const { language: locale, name, logo } = await shopSettings();
  const t = await getTranslations({ locale, namespace: "meta" });
  return {
    metadataBase: new URL(shop.url),
    title: { default: name, template: `%s | ${name}` },
    description: t("description"),
    alternates: { canonical: "/" },
    openGraph: {
      type: "website",
      siteName: name,
      locale: locale === "en" ? "en_US" : "km_KH",
      images: [logo],
    },
  };
}

export default async function ShopLayout({ children }: { children: React.ReactNode }) {
  // the shop shows the language the owner picked in Settings → Appearance (not the address)
  const { language: locale, brandColor, brandText } = await shopSettings();
  setRequestLocale(locale);
  const { products } = await getMenu();
  // brand colour from Settings → Appearance replaces the theme's main colour (buttons, chips, prices, focus ring)
  // and tints the soft surfaces; no colour saved → the default black theme from globals.css
  const brand = brandStyles(brandColor, brandText);

  return (
    <html lang={locale} className={`${fontVariables} h-full antialiased`} style={brand}>
      <body className="min-h-full">
        <NextIntlClientProvider>
          <MenuProvider products={products}>
            <div className="mx-auto flex min-h-dvh w-full max-w-4xl flex-col px-4">
              <main className="flex-1">{children}</main>
            </div>
          </MenuProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
