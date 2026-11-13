import { getTranslations } from "next-intl/server";
import { Card } from "@/components/ui/card";
import { requireUser } from "@/lib/auth";
import { hasEncryptionKey } from "@/lib/crypto";
import { prisma } from "@/lib/db";
import { TelegramSetup } from "../settings/TelegramSetup";

export default async function TelegramPage() {
  const me = await requireUser(["owner"]);
  const t = await getTranslations("admin.telegram");
  const preview = await getTranslations({ locale: "km", namespace: "admin.telegram" });
  const tg = await prisma.telegramSettings.findUnique({ where: { shopId: me.shop.id } });
  // people of this shop (and yourself) who can tap the order buttons
  const accounts = await prisma.user.findMany({
    where: { OR: [{ id: me.id }, { memberships: { some: { shopId: me.shop.id } } }] },
    orderBy: { name: "asc" },
    select: { id: true, name: true, telegramUserId: true },
  });
  const staff = accounts.map((account) => ({
    id: account.id,
    name: account.name,
    telegramId: account.telegramUserId?.toString() ?? "",
  }));

  return (
    <>
      <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-medium md:text-3xl">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{t("intro")}</p>
        </div>
        {tg?.botTokenEnc && tg.chatId != null && (
          <p className="flex items-center gap-2 text-sm font-medium">
            <span className="size-2 shrink-0 rounded-full bg-ok-foreground" aria-hidden />
            {t("connectedGroup", { group: tg.chatTitle || tg.chatId.toString() })}
          </p>
        )}
      </header>
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <section className="min-w-0">
          <TelegramSetup staff={staff}
            keyReady={hasEncryptionKey()}
            settings={{
              connected: !!tg?.botTokenEnc,
              botUsername: tg?.botUsername ?? null,
              chatId: tg?.chatId?.toString() ?? null,
              chatTitle: tg?.chatTitle ?? null,
              threadId: tg?.messageThreadId ?? null,
              isEnabled: tg?.isEnabled ?? false,
              lastTestAt: tg?.lastTestAt ?? null,
              lastError: tg?.lastError ?? null,
            }}
          />
        </section>
        <Card className="gap-3 p-4 md:p-5">
          <h2 className="text-sm font-semibold">{t("previewTitle")}</h2>
          <p className="text-xs text-muted-foreground">{t("previewHint")}</p>
          <div lang="km" className="mx-auto w-full max-w-sm space-y-2 rounded-xl bg-(--telegram-preview-surface) p-3 text-(--telegram-preview-text)">
            <div className="space-y-2 rounded-lg bg-(--telegram-preview-bubble) p-3 text-sm">
              <p className="font-semibold text-(--telegram-preview-accent)">{tg?.botUsername ? `@${tg.botUsername}` : preview("previewBot")}</p>
              <p className="whitespace-pre-line">{preview("previewMessage")}</p>
            </div>
            <div className="grid grid-cols-2 gap-2 text-center text-xs font-medium">
              <span className="rounded-md bg-(--telegram-preview-action) p-2 text-(--telegram-preview-action-text)">{preview("previewConfirm")}</span>
              <span className="rounded-md bg-(--telegram-preview-action) p-2 text-(--telegram-preview-action-text)">{preview("previewCancel")}</span>
              <span className="col-span-2 rounded-md bg-(--telegram-preview-action) p-2 text-(--telegram-preview-action-text)">{preview("previewDashboard")}</span>
            </div>
          </div>
        </Card>
      </div>
    </>
  );
}
