import { getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/auth";
import { SettingsTabs } from "./SettingsTabs";

// "Shop & staff": every role can look; only the owner can change anything (forms disabled for others, actions check "owner").
export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  await requireUser();
  const t = await getTranslations("admin.settings");
  return (
    <>
      <div className="mb-4">
        <h1 className="font-heading text-2xl font-medium md:text-3xl">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("intro")}</p>
      </div>
      <SettingsTabs />
      {children}
    </>
  );
}
