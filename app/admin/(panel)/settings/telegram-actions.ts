"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/auth";
import { decrypt, encrypt, hasEncryptionKey } from "@/lib/crypto";
import { prisma } from "@/lib/db";
import type { Result } from "@/lib/result";
import { telegram, TelegramError, type TelegramChat } from "@/lib/telegram";

// Telegram setup — owner only (spec §7.1). Order messages + status buttons come with checkout (plan P5/P6).
const ID = 1;
const done = () => revalidatePath("/admin/telegram");

async function botToken() {
  const row = await prisma.telegramSettings.findUnique({ where: { id: ID }, select: { botTokenEnc: true } });
  return row?.botTokenEnc ? decrypt(row.botTokenEnc) : null;
}

/** 1. paste the token from @BotFather → checked with Telegram (getMe) → saved encrypted */
export async function saveBotToken(token: string): Promise<Result> {
  await requireUser(["owner"]);
  if (!hasEncryptionKey()) return { ok: false, error: "missingKey" };
  const value = token.trim();
  if (!/^\d{5,}:[A-Za-z0-9_-]{30,}$/.test(value)) return { ok: false, error: "invalid", fields: { token: "badToken" } };

  let username: string | undefined;
  try {
    username = (await telegram<{ username?: string }>(value, "getMe")).username;
  } catch (e) {
    const unauthorized = e instanceof TelegramError && e.code === 401;
    return unauthorized ? { ok: false, error: "invalid", fields: { token: "badToken" } } : { ok: false, error: "telegramFailed" };
  }

  const data = { botTokenEnc: encrypt(value), botUsername: username ?? null, isEnabled: false, lastError: null };
  await prisma.telegramSettings.upsert({ where: { id: ID }, create: { id: ID, ...data }, update: data });
  done();
  return { ok: true };
}

/** 2a. groups the bot has seen recently (owner adds the bot to the group and sends any message there first) */
export async function detectChats(): Promise<Result<{ id: string; title: string; isForum: boolean }[]>> {
  await requireUser(["owner"]);
  const token = await botToken();
  if (!token) return { ok: false, error: "notFound" };

  type Update = { message?: { chat: TelegramChat }; my_chat_member?: { chat: TelegramChat }; channel_post?: { chat: TelegramChat } };
  let updates: Update[];
  try {
    updates = await telegram<Update[]>(token, "getUpdates", { allowed_updates: ["message", "my_chat_member", "channel_post"] });
  } catch {
    return { ok: false, error: "telegramFailed" };
  }
  const chats = new Map<string, { id: string; title: string; isForum: boolean }>();
  for (const u of updates) {
    const chat = u.message?.chat ?? u.my_chat_member?.chat ?? u.channel_post?.chat;
    if (chat && chat.type !== "private") chats.set(String(chat.id), { id: String(chat.id), title: chat.title ?? String(chat.id), isForum: !!chat.is_forum });
  }
  return { ok: true, data: [...chats.values()] };
}

/** 2b. use this group (picked from the list, or typed by hand); topic id only for groups with Topics */
export async function saveChat(input: { chatId: string; chatTitle: string; threadId: string }): Promise<Result> {
  await requireUser(["owner"]);
  const chatId = input.chatId.trim();
  const threadId = input.threadId.trim();
  if (!/^-?\d{5,20}$/.test(chatId)) return { ok: false, error: "invalid", fields: { chatId: "invalid" } };
  if (threadId && !/^\d{1,10}$/.test(threadId)) return { ok: false, error: "invalid", fields: { threadId: "invalid" } };

  const { count } = await prisma.telegramSettings.updateMany({
    where: { id: ID, botTokenEnc: { not: null } },
    data: {
      chatId: BigInt(chatId),
      chatTitle: input.chatTitle.trim() || null,
      messageThreadId: threadId ? Number(threadId) : null,
      lastError: null,
    },
  });
  if (!count) return { ok: false, error: "notFound" };
  done();
  return { ok: true };
}

/** 3. send a test message to the group; the result is shown on the page (last test / last error) */
export async function sendTest(): Promise<Result> {
  await requireUser(["owner"]);
  const row = await prisma.telegramSettings.findUnique({ where: { id: ID } });
  if (!row?.botTokenEnc || row.chatId === null) return { ok: false, error: "noChat" };
  const t = await getTranslations({ locale: "km", namespace: "admin.telegram" });

  try {
    await telegram(decrypt(row.botTokenEnc), "sendMessage", {
      chat_id: row.chatId.toString(),
      text: `${t("testMessage")}\n\n${t("previewMessage")}`,
      ...(row.messageThreadId && { message_thread_id: row.messageThreadId }),
    });
  } catch (e) {
    await prisma.telegramSettings.update({
      where: { id: ID },
      data: { lastError: (e instanceof TelegramError ? e.description : "Unknown error").slice(0, 300) },
    });
    done();
    return { ok: false, error: "telegramFailed" };
  }
  await prisma.telegramSettings.update({ where: { id: ID }, data: { lastTestAt: new Date(), lastError: null } });
  done();
  return { ok: true };
}

/** send new orders to the group: on / off (needs bot + group) */
export async function setTelegramEnabled(isEnabled: boolean): Promise<Result> {
  await requireUser(["owner"]);
  const { count } = await prisma.telegramSettings.updateMany({
    where: { id: ID, ...(isEnabled && { botTokenEnc: { not: null }, chatId: { not: null } }) },
    data: { isEnabled },
  });
  if (!count) return { ok: false, error: "noChat" };
  done();
  return { ok: true };
}

/** forget the bot and the group */
export async function disconnectTelegram(): Promise<Result> {
  await requireUser(["owner"]);
  await prisma.telegramSettings.deleteMany({ where: { id: ID } });
  done();
  return { ok: true };
}

export async function linkTelegramUser(userId: string, telegramId: string): Promise<Result> {
  await requireUser(["owner"]);
  if (!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(userId)) return { ok: false, error: "invalid" };
  const id = telegramId.trim();
  if (id && !/^[1-9][0-9]{0,15}$/.test(id)) return { ok: false, error: "invalid" };
  try {
    const result = await prisma.user.updateMany({ where: { id: userId }, data: { telegramUserId: id ? BigInt(id) : null } });
    if (!result.count) return { ok: false, error: "notFound" };
  } catch {
    return { ok: false, error: "invalid" };
  }
  done();
  return { ok: true };
}

export async function enableTelegramButtons(): Promise<Result> {
  await requireUser(["owner"]);
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  const base = process.env.APP_BASE_URL;
  if (!base || !secret || !/^[A-Za-z0-9_-]{32,256}$/.test(secret)) return { ok: false, error: "invalid" };
  try {
    const url = new URL("/api/telegram/", base);
    if (url.protocol !== "https:") return { ok: false, error: "invalid" };
    const token = await botToken();
    if (!token) return { ok: false, error: "noChat" };
    await telegram(token, "setWebhook", { url: url.href, secret_token: secret, allowed_updates: ["callback_query"] });
    return { ok: true };
  } catch {
    return { ok: false, error: "telegramFailed" };
  }
}
