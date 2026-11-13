import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { fontVariables } from "../fonts";
import "../globals.css";

// this part of the site only ever shows the 404 page → the browser tab says so
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("notFound");
  return { title: `404 · ${t("title")}`, robots: { index: false } };
}

// app.com/ itself (every shop lives at app.com/<shop>) — only a 404 page: own root layout, default theme
export default async function HomeLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang={await getLocale()} className={`${fontVariables} h-full antialiased`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
