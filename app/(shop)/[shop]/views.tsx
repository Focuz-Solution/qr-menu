import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations, setRequestLocale } from "next-intl/server";
import { MenuProvider } from "@/components/MenuProvider";
import { getMenuList } from "@/lib/menu";
import { ShakeOnSubmit } from "@/components/ShakeOnSubmit";
import { appUrl } from "@/lib/app-url";
import { brandStyles } from "@/lib/brand-colors";
import { ShopPathProvider } from "@/lib/shop-path";
import { shopSettings } from "@/lib/shop-settings";
import { shopBySlug } from "@/lib/shops";
import { fontVariables } from "../../fonts";
import "../../globals.css";

// A shop's pages, shared by its own address (app.com/<shop>/…, base "/<shop>") and — for the default shop — the
// app's main address (app.com/…, base ""). The route files only work out which shop and which base.
// One file per page (views-home / views-product / views-checkout): each page then only downloads its own
// browser code — the home page doesn't load the checkout form, the checkout doesn't load the product gallery.

// ---------- layout ----------

/** title/description + link preview in the shop language */
export async function shopMetadata(slug: string, base: string): Promise<Metadata> {
  const { language: locale, name, logo } = await shopSettings(await shopBySlug(slug));
  const t = await getTranslations({ locale, namespace: "meta" });
  return {
    ...(appUrl() && { metadataBase: new URL(appUrl()!) }),
    title: { default: name, template: `%s | ${name}` },
    description: t("description"),
    alternates: { canonical: base || "/" },
    // tab icon = the shop's logo (uploaded in Settings → Appearance, else public/logo.png)
    icons: { icon: logo, apple: logo },
    openGraph: {
      type: "website",
      siteName: name,
      locale: locale === "en" ? "en_US" : "km_KH",
      images: logo ? [logo] : [],
    },
  };
}

/** the root layout of a shop. An address that isn't a shop still gets it (default look); its pages call notFound(). */
export async function ShopShell({ slug, base, children }: { slug: string; base: string; children: React.ReactNode }) {
  const shopId = await shopBySlug(slug);
  // the shop shows the language the owner picked in Settings → Appearance (not the address)
  const { language: locale, brandColor, brandText } = await shopSettings(shopId);
  setRequestLocale(locale);
  // the light list (no descriptions): the cart, checkout and every page read it
  const { products } = await getMenuList(shopId);
  // customers' browsers get the shop texts only, not the admin panel's (a third of the file)
  const messages = Object.fromEntries(Object.entries(await getMessages()).filter(([namespace]) => namespace !== "admin"));
  // brand colour from Settings → Appearance replaces the theme's main colour (buttons, chips, prices, focus ring)
  // and tints the soft surfaces; no colour saved → the default black theme from globals.css
  const brand = brandStyles(brandColor, brandText);

  return (
    // data-shop: the cart's storage key (one cart per shop, whichever address it was opened on)
    <html lang={locale} data-shop={slug} className={`${fontVariables} h-full antialiased`} style={brand}>
      <body className="min-h-full">
        <NextIntlClientProvider messages={messages}>
          <ShopPathProvider slug={slug} base={base}>
            <MenuProvider products={products}>
              <div className="mx-auto flex min-h-dvh w-full max-w-4xl flex-col px-4">
                <main className="flex-1">{children}</main>
              </div>
            </MenuProvider>
          </ShopPathProvider>
        </NextIntlClientProvider>
        <ShakeOnSubmit />
      </body>
    </html>
  );
}
