import { getTranslations } from "next-intl/server";
import { NotFoundView } from "@/components/NotFoundView";
import { defaultShopSlug } from "@/lib/shops";
import ShopNotFound from "../(shop)/[shop]/not-found";

// 404 at the main address: inside the default shop → the shop's 404 (back to its home);
// no default shop → no logo, no links, just the message
export default async function NotFound() {
  if (await defaultShopSlug()) return <ShopNotFound />;
  const t = await getTranslations("notFound");
  return (
    <main className="grid min-h-dvh place-items-center">
      <NotFoundView title={t("title")} text={t("text")} />
    </main>
  );
}
