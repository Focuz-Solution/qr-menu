"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { Result } from "@/lib/result";
import { ALLOWED_UPDATES, botInfo, hasBotToken, telegram, TelegramError, webhookUrl } from "@/lib/telegram";
import { handleUpdate, type Update } from "@/lib/telegram-bot";

// Telegram setup — owner / shop admin (spec §7.1). One bot for the whole app (TELEGRAM_BOT_TOKEN), one group per shop.
const done = () => revalidatePath("/admin/telegram");
const CONNECT_MINUTES = 15;

/**
 * 1. Connect: a one-time code + the link t.me/<bot>?startgroup=<code>. Telegram asks which group to add the bot to,
 * then posts "/start <code>" there; the bot (lib/telegram-bot.ts) links that group to this shop.
 */
export async function startTelegramConnect(): Promise<Result<{ url: string }>> {
  const me = await requireUser("telegram.manage");
  if (!hasBotToken()) return { ok: false, error: "botMissing" };

  let username: string;
  try {
    username = (await botInfo()).username;
    // production: Telegram sends updates to /api/telegram (set every time — cheap, and keeps allowed_updates current)
    const hook = webhookUrl();
    if (hook) await telegram("setWebhook", { url: hook.url, secret_token: hook.secret, allowed_updates: ALLOWED_UPDATES });
  } catch {
    return { ok: false, error: "telegramFailed" };
  }

  const code = randomBytes(18).toString("base64url");
  const data = { connectCode: code, connectExpires: new Date(Date.now() + CONNECT_MINUTES * 60_000), connectUserId: me.id };
  await prisma.telegramSettings.upsert({ where: { shopId: me.shop.id }, create: { shopId: me.shop.id, ...data }, update: data });
  return { ok: true, data: { url: `https://t.me/${username}?startgroup=${code}` } };
}

let pollOffset = 0;

/** 2. asked every few seconds while the admin waits: has a group been linked? (local mode: also fetches the bot's updates) */
export async function checkTelegramConnect(): Promise<Result<{ linked: boolean }>> {
  const me = await requireUser("telegram.manage");
  if (!webhookUrl() && hasBotToken()) {
    // no public https address (local) → no webhook; read the updates here instead
    try {
      const updates = await telegram<Update[]>("getUpdates", { offset: pollOffset, timeout: 0, allowed_updates: ALLOWED_UPDATES });
      for (const update of updates) {
        pollOffset = update.update_id + 1;
        await handleUpdate(update).catch((e) => console.error("[telegram] update failed:", e));
      }
    } catch (e) {
      // 409 = a webhook is set (e.g. by the live site with the same bot): updates go there, not here
      if (!(e instanceof TelegramError && e.code === 409)) return { ok: false, error: "telegramFailed" };
    }
  }
  const row = await prisma.telegramSettings.findUnique({ where: { shopId: me.shop.id }, select: { connectCode: true, chatId: true } });
  const linked = !!row && row.chatId !== null && !row.connectCode;
  if (linked) done();
  return { ok: true, data: { linked } };
}

/** 3. send a test message to the group; the result is shown on the page (last test / last error) */
export async function sendTest(): Promise<Result> {
  const { shop } = await requireUser("telegram.manage");
  const row = await prisma.telegramSettings.findUnique({ where: { shopId: shop.id } });
  if (!hasBotToken()) return { ok: false, error: "botMissing" };
  if (row?.chatId == null) return { ok: false, error: "noChat" };
  const t = await getTranslations({ locale: "km", namespace: "admin.telegram" });

  try {
    await telegram("sendMessage", {
      chat_id: row.chatId.toString(),
      text: `${t("testMessage")}\n\n${t("previewMessage")}`,
      ...(row.messageThreadId && { message_thread_id: row.messageThreadId }),
    });
  } catch (e) {
    await prisma.telegramSettings.update({
      where: { shopId: shop.id },
      data: { lastError: (e instanceof TelegramError ? e.description : "Unknown error").slice(0, 300) },
    });
    done();
    return { ok: false, error: "telegramFailed" };
  }
  await prisma.telegramSettings.update({ where: { shopId: shop.id }, data: { lastTestAt: new Date(), lastError: null } });
  done();
  return { ok: true };
}

/** send new orders to the group: on / off (needs a group) */
export async function setTelegramEnabled(isEnabled: boolean): Promise<Result> {
  const { shop } = await requireUser("telegram.manage");
  const { count } = await prisma.telegramSettings.updateMany({
    where: { shopId: shop.id, ...(isEnabled && { chatId: { not: null } }) },
    data: { isEnabled },
  });
  if (!count) return { ok: false, error: "noChat" };
  done();
  return { ok: true };
}

/** forget the group (the bot stays in it; remove it in Telegram if you like) */
export async function disconnectTelegram(): Promise<Result> {
  const { shop } = await requireUser("telegram.manage");
  await prisma.telegramSettings.deleteMany({ where: { shopId: shop.id } });
  done();
  return { ok: true };
}

export async function linkTelegramUser(userId: string, telegramId: string): Promise<Result> {
  const me = await requireUser("telegram.manage");
  if (!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(userId)) return { ok: false, error: "invalid" };
  const id = telegramId.trim();
  if (id && !/^[1-9][0-9]{0,15}$/.test(id)) return { ok: false, error: "invalid" };
  try {
    const result = await prisma.user.updateMany({
      // only people of this shop (or yourself) — not another shop's staff
      where: { id: userId, OR: [{ id: me.id }, { memberships: { some: { shopId: me.shop.id } } }] },
      data: { telegramUserId: id ? BigInt(id) : null } });
    if (!result.count) return { ok: false, error: "notFound" };
  } catch {
    return { ok: false, error: "invalid" };
  }
  done();
  return { ok: true };
}
