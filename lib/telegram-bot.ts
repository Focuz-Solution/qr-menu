import "server-only";
import { getTranslations } from "next-intl/server";
import { changeOrderStatus } from "@/lib/change-order-status";
import { prisma } from "@/lib/db";
import { membershipPermissions } from "@/lib/staff-roles";
import { botInfo, escapeHtml, telegram, telegramOrderUrl, type TelegramChat } from "@/lib/telegram";

// Everything the bot receives (webhook POST /api/telegram, or getUpdates polling in local mode) goes through handleUpdate.
// Only these updates do anything:
//   • "/start <code>" in a group      → link that group to the shop that made the code (Connect button in Admin → Telegram)
//   • group upgraded to a supergroup  → keep the link (new chat id)
//   • bot removed from a group        → unlink that group
//   • tap on ✓ Confirm under an order → confirm the order (staff with "orders.status" in that shop)

type User = { id: number; is_bot?: boolean };
type Message = {
  message_id: number;
  message_thread_id?: number;
  is_topic_message?: boolean;
  from?: User;
  chat: TelegramChat;
  text?: string;
  migrate_to_chat_id?: number;
};
export type Update = {
  update_id: number;
  message?: Message;
  my_chat_member?: { chat: TelegramChat; new_chat_member: { status: string; user: User } };
  callback_query?: { id: string; from: User; data?: string; message?: Message };
};

export async function handleUpdate(update: Update) {
  if (update.callback_query) return onCallback(update.callback_query);
  if (update.my_chat_member) return onMemberChange(update.my_chat_member);
  const message = update.message;
  if (!message || !Number.isSafeInteger(message.chat?.id)) return;
  if (message.migrate_to_chat_id) {
    await prisma.telegramSettings.updateMany({ where: { chatId: BigInt(message.chat.id) }, data: { chatId: BigInt(message.migrate_to_chat_id) } });
    return;
  }
  const start = /^\/start(?:@\w+)?\s+([A-Za-z0-9_-]{16,64})\s*$/.exec(message.text ?? "");
  if (start && message.chat.type !== "private" && message.chat.type !== "channel") await linkGroup(start[1], message);
}

async function linkGroup(code: string, message: Message) {
  const row = await prisma.telegramSettings.findUnique({ where: { connectCode: code } });
  if (!row || !row.connectExpires || row.connectExpires < new Date()) return;
  const t = await getTranslations({ locale: "km", namespace: "admin.telegram" });
  const threadId = message.is_topic_message ? message.message_thread_id : undefined;

  await prisma.telegramSettings.update({
    where: { shopId: row.shopId },
    data: {
      chatId: BigInt(message.chat.id),
      chatTitle: message.chat.title?.slice(0, 200) ?? null,
      messageThreadId: threadId ?? null,
      isEnabled: true,
      connectCode: null,
      connectExpires: null,
      connectUserId: null,
      lastError: null,
    },
  });
  // the person who added the bot is the admin who pressed Connect → their Telegram account can tap ✓ Confirm
  if (row.connectUserId && message.from && !message.from.is_bot && Number.isSafeInteger(message.from.id)) {
    await prisma.user
      .updateMany({ where: { id: row.connectUserId, telegramUserId: null }, data: { telegramUserId: BigInt(message.from.id) } })
      .catch(() => {}); // that Telegram account is already linked to someone else — leave it
  }
  try {
    await telegram("sendMessage", { chat_id: message.chat.id, text: t("testMessage"), ...(threadId && { message_thread_id: threadId }) });
    await prisma.telegramSettings.update({ where: { shopId: row.shopId }, data: { lastTestAt: new Date() } });
  } catch {
    // linked anyway; the admin page can send a test message
  }
}

async function onMemberChange(change: NonNullable<Update["my_chat_member"]>) {
  if (!["left", "kicked"].includes(change.new_chat_member?.status) || !Number.isSafeInteger(change.chat?.id)) return;
  const bot = await botInfo().catch(() => null);
  if (bot && change.new_chat_member.user?.id !== bot.id) return;
  await prisma.telegramSettings.updateMany({
    where: { chatId: BigInt(change.chat.id) },
    data: { isEnabled: false, lastError: "The bot was removed from the group. Connect a group again." },
  });
}

async function onCallback(callback: NonNullable<Update["callback_query"]>) {
  const message = callback.message;
  const match = typeof callback.data === "string" && /^c:([0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}):(-?[0-9]{1,16})$/i.exec(callback.data);
  if (!match || typeof callback.id !== "string" || !Number.isSafeInteger(callback.from?.id)
    || !Number.isSafeInteger(message?.chat?.id) || !Number.isSafeInteger(message?.message_id) || !message) {
    return;
  }

  // the order says which shop; that shop's group must match, and the tapper must work in that shop
  const order = await prisma.order.findUnique({ where: { id: match[1] }, select: { shopId: true, telegramMessageId: true, status: true } });
  if (!order) return;
  const [settings, user] = await Promise.all([
    prisma.telegramSettings.findUnique({ where: { shopId: order.shopId } }),
    prisma.user.findUnique({
      where: { telegramUserId: BigInt(callback.from.id) },
      select: { id: true, name: true, isActive: true, isOwner: true, memberships: { where: { shopId: order.shopId }, select: { role: true, staffRole: { select: { permissions: true } } } } },
    }),
  ]);
  if (settings?.chatId == null || settings.chatId !== BigInt(message.chat.id) || settings.chatId !== BigInt(match[2])) return;
  const t = await getTranslations({ locale: "km", namespace: "admin.telegram" });
  const answer = (text: string) => telegram("answerCallbackQuery", { callback_query_id: callback.id, text }).catch(() => {});
  // the tapper must work in that shop with a role that may change order status (or be the owner)
  const member = user?.memberships[0];
  const inShop = !!user && (user.isOwner || (!!member && membershipPermissions(member).includes("orders.status")));
  if (!settings.isEnabled || !user?.isActive || !inShop || order.telegramMessageId !== BigInt(message.message_id)) {
    await answer(t("callbackDenied"));
    return;
  }

  const result = order.status === "new" && await changeOrderStatus(user.id, order.shopId, match[1], "confirmed");
  if (!result || !result.ok) {
    await answer(t("callbackStale"));
    return;
  }

  const dashboard = telegramOrderUrl(match[1]);
  await Promise.all([
    answer(t("callbackConfirmed")),
    telegram("editMessageText", {
      chat_id: message.chat.id,
      message_id: message.message_id,
      text: `✅ <b>${escapeHtml(t("confirmedBy", { name: user.name }))}</b>\n\n${escapeHtml(typeof message.text === "string" ? message.text : "")}`,
      parse_mode: "HTML",
      reply_markup: { inline_keyboard: dashboard ? [[{ text: t("previewDashboard"), url: dashboard }]] : [] },
    }).catch(() => { console.error("[telegram] Could not update confirmed order message"); }),
  ]);
}
