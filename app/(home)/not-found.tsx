import { getTranslations } from "next-intl/server";
import { NotFoundView } from "@/components/NotFoundView";

// 404 for app.com/ (every shop lives at app.com/<shop>): no logo, no links — just how to get to a shop
export default async function NotFound() {
  const t = await getTranslations("notFound");
  return (
    <main className="grid min-h-dvh place-items-center">
      <NotFoundView title={t("title")} text={t("text")} />
    </main>
  );
}
