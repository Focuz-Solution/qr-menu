import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { defaultShopSlug } from "@/lib/shops";
import { ShopShell, shopMetadata } from "../(shop)/[shop]/views";
import { fontVariables } from "../fonts";
import "../globals.css";

// The app's main address (app.com/, /products/…, /checkout). With a default shop picked (Settings → Main address)
// it shows that shop exactly like app.com/<shop>; without one, app.com/ redirects to the first shop (or 404).
export async function generateMetadata(): Promise<Metadata> {
  const slug = await defaultShopSlug();
  if (slug) return shopMetadata(slug, "");
  const t = await getTranslations("notFound");
  return { title: `404 · ${t("title")}`, robots: { index: false } };
}

export default async function HomeLayout({ children }: { children: React.ReactNode }) {
  const slug = await defaultShopSlug();
  if (slug) {
    return (
      <ShopShell slug={slug} base="">
        {children}
      </ShopShell>
    );
  }
  // no default shop: only the redirect / 404 renders here — own root layout, default theme
  return (
    <html lang={await getLocale()} className={`${fontVariables} h-full antialiased`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
