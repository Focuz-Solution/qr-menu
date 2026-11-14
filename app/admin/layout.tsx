import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale } from "next-intl/server";
import { brandStyles } from "@/lib/brand-colors";
import { getCurrentUser } from "@/lib/auth";
import { shop } from "@/lib/shop";
import { shopSettings } from "@/lib/shop-settings";
import { ShakeOnSubmit } from "@/components/ShakeOnSubmit";
import { fontVariables } from "../fonts";
import "../globals.css";

// Owner/staff only: not linked from the customer UI, hidden from search engines.
export const metadata: Metadata = { title: "Admin", robots: { index: false }, icons: { icon: shop.logo, apple: shop.logo } };

// Own root layout (the shop's is app/(shop)/layout.tsx). Language comes from the admin_lang cookie (Khmer default).
export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  // brand colour of the shop this login works in; login + "Your shops" (no shop yet) use the default theme
  const [locale, user] = await Promise.all([getLocale(), getCurrentUser()]);
  const { brandColor, brandText } = user?.shopId ? await shopSettings(user.shopId) : { brandColor: null, brandText: null };
  return (
    <html lang={locale} className={`${fontVariables} h-full antialiased`} style={brandStyles(brandColor, brandText)}>
      <body className="min-h-full">
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
        <ShakeOnSubmit />
      </body>
    </html>
  );
}
