import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { prisma } from "@/lib/db";
import type { Zone } from "@/lib/orders";
import { shopSettings } from "@/lib/shop-settings";
import { Checkout } from "./Checkout";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations({ locale: (await shopSettings()).language, namespace: "checkout" });
  return { title: t("title"), robots: { index: false } };
}

/** delivery zones + ordering rules for the page (the server checks them again when the order is sent) */
async function rules(): Promise<{ zones: Zone[]; minOrderCents: number; orderingEnabled: boolean }> {
  try {
    const [zones, s] = await Promise.all([
      prisma.deliveryZone.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: "asc" },
        select: { id: true, name: true, provinceCodes: true, feeCents: true, freeOverCents: true, eta: true },
      }),
      prisma.shopSettings.findUnique({ where: { id: 1 }, select: { minOrderCents: true, orderingEnabled: true } }),
    ]);
    return { zones, minOrderCents: s?.minOrderCents ?? 0, orderingEnabled: s?.orderingEnabled ?? true };
  } catch {
    return { zones: [], minOrderCents: 0, orderingEnabled: true }; // ponytail: no database at build → server decides on send
  }
}

export default async function CheckoutPage() {
  setRequestLocale((await shopSettings()).language);
  return <Checkout {...await rules()} />;
}
