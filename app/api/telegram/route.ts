import { getTranslations } from "next-intl/server";
import { timingSafeEqual } from "node:crypto";
import { changeOrderStatus } from "@/lib/change-order-status";
import { decrypt } from "@/lib/crypto";
import { prisma } from "@/lib/db";
import { membershipPermissions } from "@/lib/staff-roles";
import { escapeHtml, telegram, telegramOrderUrl } from "@/lib/telegram";

export async function POST(request: Request) {
  const expected = Buffer.from(process.env.TELEGRAM_WEBHOOK_SECRET ?? "");
  const supplied = Buffer.from(request.headers.get("x-telegram-bot-api-secret-token") ?? "");
  if (!expected.length || expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) {
    return new Response(null, { status: 403 });
  }

  const update = await request.json().catch(() => null);
  const callback = update?.callback_query;
  const message = callback?.message;
  const match = typeof callback?.data === "string" && /^c:([0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}):(-?[0-9]{1,16})$/i.exec(callback.data);
  if (!match || typeof callback.id !== "string" || !Number.isSafeInteger(callback.from?.id)
    || !Number.isSafeInteger(message?.chat?.id) || !Number.isSafeInteger(message?.message_id)) {
    return new Response(null, { status: 200 });
  }

  // the order says which shop; that shop's bot + group must match, and the tapper must work in that shop
  const order = await prisma.order.findUnique({ where: { id: match[1] }, select: { shopId: true, telegramMessageId: true, status: true } });
  if (!order) return new Response(null, { status: 200 });
  // that shop's bot + the tapper (with their role in that shop), looked up together
  const [settings, user] = await Promise.all([
    prisma.telegramSettings.findUnique({ where: { shopId: order.shopId } }),
    prisma.user.findUnique({
      where: { telegramUserId: BigInt(callback.from.id) },
      select: { id: true, name: true, isActive: true, isOwner: true, memberships: { where: { shopId: order.shopId }, select: { role: true, staffRole: { select: { permissions: true } } } } },
    }),
  ]);
  if (!settings?.botTokenEnc || settings.chatId !== BigInt(message.chat.id) || settings.chatId !== BigInt(match[2])) return new Response(null, { status: 200 });
  const t = await getTranslations({ locale: "km", namespace: "admin.telegram" });
  const token = decrypt(settings.botTokenEnc);
  const answer = (text: string) => telegram(token, "answerCallbackQuery", { callback_query_id: callback.id, text }).catch(() => {});
  // the tapper must work in that shop with a role that may change order status (or be the owner)
  const member = user?.memberships[0];
  const inShop = !!user && (user.isOwner || (!!member && membershipPermissions(member).includes("orders.status")));
  if (!settings.isEnabled || !user?.isActive || !inShop || order.telegramMessageId !== BigInt(message.message_id)) {
    await answer(t("callbackDenied"));
    return new Response(null, { status: 200 });
  }

  const result = order.status === "new" && await changeOrderStatus(user.id, order.shopId, match[1], "confirmed");
  if (!result || !result.ok) {
    await answer(t("callbackStale"));
    return new Response(null, { status: 200 });
  }

  const dashboard = telegramOrderUrl(match[1]);
  await Promise.all([
    answer(t("callbackConfirmed")),
    telegram(token, "editMessageText", {
      chat_id: message.chat.id,
      message_id: message.message_id,
      text: `✅ <b>${escapeHtml(t("confirmedBy", { name: user.name }))}</b>\n\n${escapeHtml(typeof message.text === "string" ? message.text : "")}`,
      parse_mode: "HTML",
      reply_markup: { inline_keyboard: dashboard ? [[{ text: t("previewDashboard"), url: dashboard }]] : [] },
    }).catch(() => { console.error("[telegram] Could not update confirmed order message"); }),
  ]);
  return new Response(null, { status: 200 });
}
