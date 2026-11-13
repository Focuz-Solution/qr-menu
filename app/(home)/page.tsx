import { notFound, redirect } from "next/navigation";
import { firstShopSlug } from "@/lib/shops";

export default async function Home() {
  const slug = await firstShopSlug();
  if (!slug) notFound();
  redirect(`/${encodeURIComponent(slug)}`);
}
