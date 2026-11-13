import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { prisma } from "@/lib/db";
import type { Zone } from "@/lib/orders";
import { shopSettings } from "@/lib/shop-settings";
import { notFound } from "next/navigation";
import { shopBySlug } from "@/lib/shops";
import { Checkout } from "./Checkout";

export async function generateMetadata({ params }: PageProps<"/[shop]/checkout">): Promise<Metadata> {
  const t = await getTranslations({ locale: (await shopSettings(await shopBySlug((await params).shop))).language, namespace: "checkout" });
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

export default async function CheckoutPage({ params }: PageProps<"/[shop]/checkout">) {
  const shopId = await shopBySlug((await params).shop);
  if (!shopId) notFound();
  setRequestLocale((await shopSettings(shopId)).language);
  return <Checkout {...await rules(shopId)} />;
}
