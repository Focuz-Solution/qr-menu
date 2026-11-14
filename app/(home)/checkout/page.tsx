import { notFound } from "next/navigation";
import { defaultShopSlug } from "@/lib/shops";
import { checkoutMetadata, ShopCheckout } from "../../(shop)/[shop]/views-checkout";

// app.com/checkout: the default shop's checkout (no default shop → not found)
export async function generateMetadata() {
  const shop = await defaultShopSlug();
  return shop ? checkoutMetadata(shop) : {};
}

export default async function CheckoutPage() {
  const shop = await defaultShopSlug();
  if (!shop) notFound();
  return <ShopCheckout shop={shop} />;
}
