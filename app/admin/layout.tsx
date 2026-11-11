import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale } from "next-intl/server";
import { brandStyles } from "@/lib/brand-colors";
import { shopSettings } from "@/lib/shop-settings";
import { fontVariables } from "../fonts";
import "../globals.css";

// Owner/staff only: not linked from the customer UI, hidden from search engines.
export const metadata: Metadata = { title: "Admin", robots: { index: false } };

// Own root layout (the shop's is app/(shop)/layout.tsx). Language comes from the admin_lang cookie (Khmer default).
export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const [locale, { brandColor, brandText }] = await Promise.all([getLocale(), shopSettings()]);
  return (
    <html lang={locale} className={`${fontVariables} h-full antialiased`} style={brandStyles(brandColor, brandText)}>
      <body className="min-h-full">
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
