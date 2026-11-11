import { getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ShopSettingsForm } from "./ShopSettingsForm";

export default async function ShopSettingsPage() {
  const me = await requireUser();
  const t = await getTranslations("admin.settings");
  const owner = me.role === "owner";
  const row = await prisma.shopSettings.findUnique({ where: { id: 1 } });

  const values = {
    name: row?.name ?? "",
    contactPhone: row?.contactPhone ?? "",
    telegramUrl: row?.telegramUrl ?? "",
    facebookUrl: row?.facebookUrl ?? "",
    tiktokUrl: row?.tiktokUrl ?? "",
    address: row?.address ?? "",
    orderPrefix: row?.orderPrefix ?? "",
    brandColor: row?.brandColor ?? "",
    logoUrl: row?.logoUrl ?? "",
    language: row?.language ?? "",
    notice: row?.notice ?? "",
  };

  return (
    <>
      <div className="mb-4">
        <h2 className="text-lg font-semibold">{t("shopTitle")}</h2>
        <p className="text-sm text-muted-foreground">{t("shopIntro")}</p>
      </div>
      <ShopSettingsForm values={values} readOnly={!owner} />

    </>
  );
}
