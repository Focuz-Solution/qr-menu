"use server";

import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { after } from "next/server";
import { getTranslations } from "next-intl/server";
import { clientIp } from "@/lib/auth";
import { decrypt } from "@/lib/crypto";
import { prisma } from "@/lib/db";
import { Prisma } from "@/lib/generated/prisma/client";
import { shopBySlug } from "@/lib/shops";
import { cambodiaDay, feeFor, normalizePhone, orderNumber, zonesFor } from "@/lib/orders";
import { isProvinceCode, PROVINCES } from "@/lib/provinces";
import type { ErrorCode, Result } from "@/lib/result";
import { formatPrice } from "@/lib/shop";
import { shopSettings } from "@/lib/shop-settings";
import { escapeHtml, telegram, telegramOrderUrl } from "@/lib/telegram";
import type { CheckoutInput } from "./types";

// Public checkout (no login): everything the browser sends is checked again here; prices come from the database.
const MAX_LINES = 50;
const RATE = { orders: 5, minutes: 10 }; // ponytail: per-device limit from the orders table; add Turnstile if spam shows up

const text = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

export async function createOrder(input: CheckoutInput): Promise<Result<{ orderNo: string; totalCents: number; deliveryFeeCents: number; deliveryZoneName: string }>> {
  // ---- the form ----
  const fields: Record<string, ErrorCode> = {};
  const name = text(input.name, 80);
  const phoneRaw = text(input.phone, 30);
  const phone = normalizePhone(phoneRaw);
  const provinceCode = text(input.provinceCode, 2);
  const address = text(input.address, 300);
  const landmark = text(input.landmark, 200);
  const mapUrl = text(input.mapUrl, 500);
  const note = text(input.note, 500);
  const payment = input.payment === "bank_transfer" ? "bank_transfer" : "cod";
  const key = text(input.key, 64);

  if (!name) fields.name = "required";
  if (!phone) fields.phone = "badPhone";
  if (!isProvinceCode(provinceCode)) fields.province = "badProvince";
  if (!address) fields.address = "required";
  if (mapUrl && !/^https:\/\/\S+$/.test(mapUrl)) fields.mapUrl = "badUrl";
  if (Object.keys(fields).length) return { ok: false, error: "invalid", fields };

  const lines = (Array.isArray(input.lines) ? input.lines : []).slice(0, MAX_LINES + 1);
  if (!lines.length) return { ok: false, error: "emptyCart" };
  if (lines.length > MAX_LINES || lines.some((l) => !Number.isInteger(l?.qty) || l.qty < 1 || l.qty > 99)) return { ok: false, error: "invalid" };

  // ---- which shop: every lookup and the new order below stay inside it ----
  // the shop is the one in the page's address (sent with the order); unknown → closed
  const shopId = typeof input.shop === "string" ? await shopBySlug(input.shop) : null;
  if (!shopId) return { ok: false, error: "orderingClosed" };

  // ---- double tap: the same key → the order already made ----
  if (key) {
    const same = await prisma.order.findFirst({ where: { idempotencyKey: key, shopId }, select: { orderNo: true, totalCents: true, deliveryFeeCents: true, deliveryZoneName: true } });
    if (same) return { ok: true, data: same };
  }

  // ---- shop rules: settings, this device's recent orders, the products and the delivery zones in one round trip (all of this shop) ----
  const h = await headers();
  const ip = await clientIp();
  const ipHash = createHash("sha256").update(`order:${ip}`).digest("hex");
  const slugs = [...new Set(lines.map((l) => String(l.slug).slice(0, 100)))];
  const [settings, recent, items, zones] = await Promise.all([
    prisma.shopSettings.findUnique({ where: { shopId }, select: { orderingEnabled: true, minOrderCents: true, orderPrefix: true } }),
    prisma.order.count({ where: { shopId, ipHash, createdAt: { gte: new Date(Date.now() - RATE.minutes * 60_000) } } }),
    // products: shown, not deleted, in a shown category, in stock — at today's price
    prisma.item.findMany({
      where: { shopId, slug: { in: slugs }, deletedAt: null, isVisible: true, category: { isVisible: true } },
      select: { id: true, slug: true, name: true, priceCents: true, isAvailable: true, images: { orderBy: { sortOrder: "asc" }, select: { url: true } } },
    }),
    prisma.deliveryZone.findMany({ where: { shopId, isActive: true }, orderBy: { sortOrder: "asc" } }),
  ]);
  if (settings && !settings.orderingEnabled) return { ok: false, error: "orderingClosed" };
  if (recent >= RATE.orders) return { ok: false, error: "tooManyOrders" };

  const bySlug = new Map(items.map((i) => [i.slug, i]));
  if (lines.some((l) => !bySlug.get(String(l.slug))?.isAvailable)) return { ok: false, error: "unavailable" };

  const orderLines = lines.map((l) => {
    const item = bySlug.get(String(l.slug))!;
    // the photo the customer picked (a style) if it is one of this product's photos, else the main photo
    const photos = item.images.map((i) => i.url);
    const image = typeof l.image === "string" && photos.includes(l.image) ? l.image : (photos[0] ?? null);
    return { itemId: item.id, name: item.name, imageUrl: image, unitPriceCents: item.priceCents, quantity: l.qty, lineTotalCents: item.priceCents * l.qty };
  });
  const subtotalCents = orderLines.reduce((n, l) => n + l.lineTotalCents, 0);
  if (settings?.minOrderCents && subtotalCents < settings.minOrderCents) return { ok: false, error: "minOrder" };

  const options = zonesFor(zones, provinceCode);
  if (!options.length) return { ok: false, error: "invalid", fields: { province: "badProvince" } };
  const zone = options.find((option) => option.id === input.deliveryZoneId);
  if (!zone) return { ok: false, error: "invalid", fields: { deliveryZoneId: "invalid" } };
  const deliveryFeeCents = feeFor(zone, subtotalCents);
  const totalCents = subtotalCents + deliveryFeeCents;
  const province = PROVINCES.find((p) => p.code === provinceCode)!;

  // ---- save: order number from the day's counter, in one transaction ----
  const now = new Date();
  const day = cambodiaDay(now);
  let order: { id: string; orderNo: string };
  try {
    order = await prisma.$transaction(async (tx) => {
      const { value } = await tx.orderCounter.upsert({ where: { shopId_day: { shopId, day } }, create: { shopId, day, value: 1 }, update: { value: { increment: 1 } } });
      return tx.order.create({
        data: {
          shopId,
          orderNo: orderNumber(settings?.orderPrefix ?? "PB-", day, value),
          customerName: name,
          customerPhone: phone!,
          customerPhoneRaw: phoneRaw,
          provinceCode,
          provinceName: province.km,
          addressLine: address,
          landmark: landmark || null,
          mapUrl: mapUrl || null,
          note: note || null,
          deliveryZoneName: zone.name,
          subtotalCents,
          deliveryFeeCents,
          totalCents,
          paymentMethod: payment,
          idempotencyKey: key || null,
          ipHash,
          userAgent: h.get("user-agent")?.slice(0, 300) ?? null,
          items: { create: orderLines },
          events: { create: { type: "created" } },
        },
        select: { id: true, orderNo: true },
      });
    });
  } catch (cause) {
    // two taps at the same moment with the same key: the other one saved it → return that order
    if (key && cause instanceof Prisma.PrismaClientKnownRequestError && cause.code === "P2002") {
      const same = await prisma.order.findFirst({ where: { idempotencyKey: key, shopId }, select: { orderNo: true, totalCents: true, deliveryFeeCents: true, deliveryZoneName: true } });
      if (same) return { ok: true, data: same };
    }
    throw cause;
  }

  // Telegram after the answer is sent: the customer sees the receipt without waiting for Telegram
  const saved = order;
  after(() => notifyTelegram(shopId, saved.id, { ...saved, name, phoneRaw, province: province.km, address, landmark, mapUrl, note, payment, lines: orderLines, deliveryZoneName: zone.name, subtotalCents, deliveryFeeCents, totalCents }));
  return { ok: true, data: { orderNo: order.orderNo, totalCents, deliveryFeeCents, deliveryZoneName: zone.name } };
}

/** new order → the shop's Telegram group (if set up and on). Never fails the order: the result is logged as an order event. */
async function notifyTelegram(
  shopId: string,
  orderId: string,
  o: {
    orderNo: string; name: string; phoneRaw: string; province: string; address: string; landmark: string; mapUrl: string; note: string;
    payment: "cod" | "bank_transfer"; lines: { name: string; quantity: number; lineTotalCents: number }[];
    deliveryZoneName: string; subtotalCents: number; deliveryFeeCents: number; totalCents: number;
  },
) {
  const tg = await prisma.telegramSettings.findUnique({ where: { shopId } });
  if (!tg?.isEnabled || !tg.botTokenEnc || tg.chatId === null) return;
  const t = await getTranslations({ locale: (await shopSettings(shopId)).language, namespace: "checkout" });
  const money = (c: number) => formatPrice(c / 100);
  const e = escapeHtml;
  const message = [
    `🛍️ <b>${e(t("tgNew", { no: o.orderNo }))}</b>`,
    e(t("tgOrderHint")),
    "",
    `👤 ${e(o.name)}`,
    `📞 ${e(o.phoneRaw)}`,
    `📍 ${e(o.province)} — ${e(o.address)}`,
    o.landmark ? `🏠 ${e(o.landmark)}` : null,
    o.mapUrl ? `🗺 ${e(o.mapUrl)}` : null,
    o.note ? `📝 ${e(o.note)}` : null,
    "",
    ...o.lines.map((l) => `• ${e(l.name)} × ${l.quantity} = ${money(l.lineTotalCents)}`),
    "",
    `${e(t("subtotal"))}: ${money(o.subtotalCents)}`,
    `${e(t("delivery"))} (${e(o.deliveryZoneName)}): ${o.deliveryFeeCents ? money(o.deliveryFeeCents) : e(t("free"))}`,
    `<b>${e(t("total"))}: ${money(o.totalCents)}</b>`,
    `💳 ${e(t(o.payment === "cod" ? "payCod" : "payBank"))}`,
  ]
    .filter((line) => line !== null) // optional details left out; "" lines are intended gaps
    .join("\n");
  const dashboard = telegramOrderUrl(orderId);
  const buttons = await getTranslations({ locale: "km", namespace: "admin.telegram" });
  try {
    const sent = await telegram<{ message_id: number }>(decrypt(tg.botTokenEnc), "sendMessage", {
      chat_id: tg.chatId.toString(),
      text: message,
      parse_mode: "HTML",
      disable_web_page_preview: true,
      ...(dashboard && process.env.TELEGRAM_WEBHOOK_SECRET && {
        reply_markup: {
          inline_keyboard: [
            [{ text: buttons("previewConfirm"), callback_data: `c:${orderId}:${tg.chatId}` }, { text: buttons("previewCancel"), url: dashboard }],
            [{ text: buttons("previewDashboard"), url: dashboard }],
          ],
        },
      }),
      ...(tg.messageThreadId && { message_thread_id: tg.messageThreadId }),
    });
    await prisma.order.update({
      where: { id: orderId },
      data: { telegramMessageId: BigInt(sent.message_id), events: { create: { type: "telegram_sent" } } },
    });
  } catch (cause) {
    console.error("[orders] telegram failed:", cause);
    await prisma.orderEvent.create({ data: { orderId, type: "telegram_failed" } }).catch(() => {});
  }
}
