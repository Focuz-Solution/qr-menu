import type { Metadata } from "next";
import { Kaushan_Script } from "next/font/google";
import { setRequestLocale } from "next-intl/server";
import { shopSettings } from "@/lib/shop-settings";
import { QrStudio } from "./QrStudio";

// brush-script like the Pipi Beauty logo; only used for the shop name on the QR card
const script = Kaushan_Script({ weight: "400", subsets: ["latin"] });

// For the shop owner only (not linked from the customer UI): make QR PNGs for print/posts.
export const metadata: Metadata = { robots: { index: false } };

export default async function QrPage() {
  const { language, name } = await shopSettings();
  setRequestLocale(language);
  return <QrStudio scriptFont={script.style.fontFamily} shopName={name} />;
}
