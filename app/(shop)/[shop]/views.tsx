import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations, setRequestLocale } from "next-intl/server";
import { MenuProvider } from "@/components/MenuProvider";
import { ShakeOnSubmit } from "@/components/ShakeOnSubmit";
import { appUrl } from "@/lib/app-url";
import { brandStyles } from "@/lib/brand-colors";
import { prisma } from "@/lib/db";
import { getMenu } from "@/lib/menu";
import type { Zone } from "@/lib/orders";
import { pick } from "@/lib/shop";
import { ShopPathProvider } from "@/lib/shop-path";
import { shopSettings } from "@/lib/shop-settings";
import { shopBySlug } from "@/lib/shops";
import { fontVariables } from "../../fonts";
import { Catalogue } from "./Catalogue";
import { Checkout } from "./checkout/Checkout";
import { Footer } from "./Footer";
import { Header } from "./Header";
import { ProductView } from "./products/[slug]/ProductView";
import "../../globals.css";

// A shop's pages, shared by its own address (app.com/<shop>/…, base "/<shop>") and — for the default shop — the
// app's main address (app.com/…, base ""). The route files only work out which shop and which base.

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
  const { products } = await getMenu(shopId);
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

// ---------- home: the catalogue ----------

export async function ShopHome({ slug }: { slug: string }) {
  const shopId = await shopBySlug(slug);
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

// ---------- product page ----------

/** the shop's id + this product of it (null / undefined when either doesn't exist) */
async function findProduct(shop: string, slug: string) {
  const shopId = await shopBySlug(shop);
  return { shopId, product: (await getMenu(shopId)).products.find((p) => p.slug === slug) };
}

/** products that exist at build time are pre-built; new ones (added in Admin later) render on first visit */
export async function productSlugs(shop: string) {
  return (await getMenu(await shopBySlug(shop))).products.map((p) => ({ slug: p.slug }));
}

/** link preview for this product in the page's language: name, first line of the description, product photo */
export async function productMetadata(shop: string, base: string, slug: string): Promise<Metadata> {
  const { shopId, product: p } = await findProduct(shop, slug);
  const { language: locale } = await shopSettings(shopId);
  if (!p) return {};
  const title = pick(p.name, locale);
  const description = pick(p.description, locale).split("\n")[0];
  return {
    title,
    description,
    alternates: { canonical: `${base}/products/${slug}` },
    openGraph: { type: "website", title, description, images: p.image ? [p.image] : [] },
  };
}

export async function ShopProduct({ shop, slug }: { shop: string; slug: string }) {
  const { shopId, product } = await findProduct(shop, slug);
  if (!product) notFound();
  setRequestLocale((await shopSettings(shopId)).language);
  return <ProductView product={product} />;
}

// ---------- checkout ----------

export async function checkoutMetadata(shop: string): Promise<Metadata> {
  const t = await getTranslations({ locale: (await shopSettings(await shopBySlug(shop))).language, namespace: "checkout" });
  return { title: t("title"), robots: { index: false } };
}

/** delivery zones + ordering rules for the page (the server checks them again when the order is sent) */
async function rules(shopId: string): Promise<{ zones: Zone[]; minOrderCents: number; orderingEnabled: boolean }> {
  try {
    const [zones, s] = await Promise.all([
      prisma.deliveryZone.findMany({
        where: { shopId, isActive: true },
        orderBy: { sortOrder: "asc" },
        select: { id: true, name: true, provinceCodes: true, feeCents: true, freeOverCents: true, eta: true },
      }),
      prisma.shopSettings.findUnique({ where: { shopId }, select: { minOrderCents: true, orderingEnabled: true } }),
    ]);
    return { zones, minOrderCents: s?.minOrderCents ?? 0, orderingEnabled: s?.orderingEnabled ?? true };
  } catch (cause) {
    // no database at build → server decides on send; with one, throw so Next keeps the last good page (not "no delivery")
    if (process.env.DATABASE_URL) throw cause;
    return { zones: [], minOrderCents: 0, orderingEnabled: true };
  }
}

export async function ShopCheckout({ shop }: { shop: string }) {
  const shopId = await shopBySlug(shop);
  if (!shopId) notFound();
  setRequestLocale((await shopSettings(shopId)).language);
  return <Checkout {...await rules(shopId)} />;
}
