import "server-only";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/db";
import { formatPrice } from "@/lib/shop";
import { shopSettings } from "@/lib/shop-settings";
import { escapeHtml, hasBotToken, telegram, telegramOrderUrl, webhookUrl } from "@/lib/telegram";

// The order's message in the shop's Telegram group. Built from the database, so the same message can be
// sent for a new order (postOrderToGroup) and rebuilt after every status change (syncOrderInGroup) — from the
// dashboard or from ✓ in Telegram — with the status on top (not who changed it) and only the buttons that still make sense.


async function load(orderId: string) {
  return prisma.order.findUnique({
    where: { id: orderId },
    include: { items: { select: { name: true, variant: true, quantity: true, lineTotalCents: true } } },
  });
}

async function build(o: NonNullable<Awaited<ReturnType<typeof load>>>, chatId: bigint) {
  const { language } = await shopSettings(o.shopId);
  const t = await getTranslations({ locale: language, namespace: "checkout" });
  const ta = await getTranslations({ locale: language, namespace: "admin" });
  const buttons = await getTranslations({ locale: "km", namespace: "admin.telegram" });
  const money = (c: number) => formatPrice(c / 100);
  const e = escapeHtml;
  // order time in Cambodia, e.g. 08/11/2026 14:32
  const time = new Intl.DateTimeFormat("en-GB", { 
    timeZone: "Asia/Phnom_Penh", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false,
  }).format(o.createdAt).replace(",", "");
  const DIVIDER = "------------------------";
  // the order number links to the order in Admin (only when the site has a public https address)
  const dashboard = telegramOrderUrl(o.id);
  const orderNo = dashboard ? `<a href="${dashboard}">#${e(o.orderNo)}</a>` : `#${e(o.orderNo)}`;
  const NO = "\u0000"; // placeholder: the title is escaped first, then the (already safe) link goes in
  // on top, only two states: "❌ Cancelled" + reason, or "✅ Confirmed" (packing, shipped, delivered come after confirming)
  const status =
    o.status === "new"
      ? []
      : o.status === "cancelled"
        ? [`❌ <b>${e(ta("status.cancelled"))}</b>`, o.cancelReason ? e(t("tgReason", { reason: o.cancelReason })) : null, ""]
        : [`✅ <b>${e(ta("status.confirmed"))}</b>`, ""];
  // Telegram allows 4096 characters per message: a very long order shows its first items + "… +N"
  // "2 × Lipstick (Red) · $24.00" — the variant name in brackets when there is one
  const items = o.items.map((l) => `${l.quantity} × ${e(l.name)}${l.variant ? ` (${e(l.variant)})` : ""} · ${money(l.lineTotalCents)}`);
  const text = (shown: number) =>
    [
      ...status,
      `🛍 <b>${e(t("tgNew", { no: NO })).replace(NO, orderNo)}</b>`,
      `🕒 ${time}`,
      DIVIDER,
      `👤 ${e(o.customerName)}`,
      `📞 ${e(o.customerPhoneRaw)}`,
      `📍 ${e(o.provinceName)} — ${e(o.addressLine)}`,
      o.landmark ? `🏠 ${e(o.landmark)}` : null,
      o.mapUrl ? `🗺 ${e(o.mapUrl)}` : null,
      o.note ? `📝 ${e(o.note)}` : null,
      DIVIDER,
      ...items.slice(0, shown),
      shown < items.length ? `… +${items.length - shown}` : null,
      DIVIDER,
      `${e(t("subtotal"))} · ${money(o.subtotalCents)}`,
      `${e(t("delivery"))} · ${o.deliveryFeeCents ? money(o.deliveryFeeCents) : e(t("free"))}`,
      `<b>${e(t("total"))} · ${money(o.totalCents)}</b>`,
      `${e(t(o.paymentMethod === "cod" ? "payCod" : "payBank"))} · ${e(ta(`orders.paymentStatuses.${o.paymentStatus}`))}`,
      "__________________________",
    ]
      .filter((line) => line !== null) // optional details left out
      .join("\n");
  let shown = items.length;
  let message = text(shown);
  while (message.length > 4096 && shown > 1) message = text(--shown);

  return {
    text: message.slice(0, 4096),
    parse_mode: "HTML",
    disable_web_page_preview: true,
    reply_markup: {
      inline_keyboard: [
        // ✓ Confirm / Cancel only while the order is new, and only when Telegram can reach this site (https + webhook secret)
        ...(o.status === "new" && dashboard && webhookUrl()
          ? [[{ text: buttons("previewConfirm"), callback_data: `c:${o.id}:${chatId}` }, { text: buttons("previewCancel"), url: dashboard }]]
          : []),
        ...(dashboard ? [[{ text: buttons("previewDashboard"), url: dashboard }]] : []),
        // chat with the customer: by @username when they connected Telegram (always works), else by phone
        [{ text: `💬 ${buttons("chatCustomer")}`, url: `https://t.me/${o.customerTelegram?.slice(1) ?? o.customerPhone}` }],
      ],
    },
  };
}

/** new order → the shop's Telegram group (if set up and on). Never fails the order: the result is logged as an order event. */
export async function postOrderToGroup(orderId: string) {
  const o = await load(orderId);
  if (!o || !hasBotToken()) return;
  const tg = await prisma.telegramSettings.findUnique({ where: { shopId: o.shopId } });
  if (!tg?.isEnabled || tg.chatId === null) return;
  try {
    const sent = await telegram<{ message_id: number }>("sendMessage", {
      chat_id: tg.chatId.toString(),
      ...(await build(o, tg.chatId)),
      ...(tg.messageThreadId && { message_thread_id: tg.messageThreadId }),
    });
    await prisma.order.update({ where: { id: orderId }, data: { telegramMessageId: BigInt(sent.message_id), events: { create: { type: "telegram_sent" } } } });
  } catch (cause) {
    console.error("[orders] telegram failed:", cause);
    await prisma.orderEvent.create({ data: { orderId, type: "telegram_failed" } }).catch(() => {});
  }
}

/** after a status change: rewrite the order's group message (status on top, buttons for the new status). Never fails the change. */
export async function syncOrderInGroup(orderId: string) {
  const o = await load(orderId);
  if (!o?.telegramMessageId || !hasBotToken()) return;
  const tg = await prisma.telegramSettings.findUnique({ where: { shopId: o.shopId } });
  if (tg?.chatId == null) return;
  try {
    await telegram("editMessageText", { chat_id: tg.chatId.toString(), message_id: Number(o.telegramMessageId), ...(await build(o, tg.chatId)) });
  } catch (cause) {
    // "message is not modified" (nothing changed) is fine; anything else is logged
    if (!String((cause as Error)?.message).includes("not modified")) console.error("[orders] telegram message update failed:", cause);
  }
}
