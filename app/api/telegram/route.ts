import { getTranslations } from "next-intl/server";
import { timingSafeEqual } from "node:crypto";
import { changeOrderStatus } from "@/lib/change-order-status";
import { decrypt } from "@/lib/crypto";
import { prisma } from "@/lib/db";
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

  const settings = await prisma.telegramSettings.findUnique({ where: { id: 1 } });
  if (!settings?.botTokenEnc || settings.chatId !== BigInt(message.chat.id) || settings.chatId !== BigInt(match[2])) return new Response(null, { status: 200 });
  const t = await getTranslations({ locale: "km", namespace: "admin.telegram" });
  const token = decrypt(settings.botTokenEnc);
  const answer = (text: string) => telegram(token, "answerCallbackQuery", { callback_query_id: callback.id, text }).catch(() => {});
  const [user, order] = await Promise.all([
    prisma.user.findUnique({ where: { telegramUserId: BigInt(callback.from.id) }, select: { id: true, name: true, isActive: true } }),
    prisma.order.findUnique({ where: { id: match[1] }, select: { telegramMessageId: true, status: true } }),
  ]);
  if (!settings.isEnabled || !user?.isActive || order?.telegramMessageId !== BigInt(message.message_id)) {
    await answer(t("callbackDenied"));
    return new Response(null, { status: 200 });
  }

  const result = order.status === "new" && await changeOrderStatus(user.id, match[1], "confirmed");
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
