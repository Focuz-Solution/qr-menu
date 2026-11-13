"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { NotFoundView } from "@/components/NotFoundView";
import { Button } from "@/components/ui/button";
import { useShopPath } from "@/lib/shop-path";

// inside a shop (a removed product, a mistyped address): same 404 look + back to this shop
export default function NotFound() {
  const t = useTranslations("notFound");
  const home = useShopPath();
  return (
    <NotFoundView title={t("title")} text={t("shopText")}>
      <Button asChild className="h-11">
        <Link href={home()}>{t("goHome")}</Link>
      </Button>
    </NotFoundView>
  );
}
