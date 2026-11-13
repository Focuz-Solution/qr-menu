import { notFound, redirect } from "next/navigation";
import { defaultShopSlug, firstShopSlug } from "@/lib/shops";
import { ShopHome } from "../(shop)/[shop]/views";

// app.com/: the default shop's catalogue; no default shop → the first shop's address (no shop at all → 404)
export default async function Home() {
  const slug = await defaultShopSlug();
  if (slug) return <ShopHome slug={slug} />;
  const first = await firstShopSlug();
  if (!first) notFound();
  redirect(`/${encodeURIComponent(first)}`);
}
