"use server";

import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { after } from "next/server";
import { getTranslations } from "next-intl/server";
import { clientIp } from "@/lib/auth";
import { cleanTiers, tierAt, tierUnitCents } from "@/lib/wholesale";
import { prisma } from "@/lib/db";
import { Prisma } from "@/lib/generated/prisma/client";
import { shopBySlug } from "@/lib/shops";
import { deliveryZones } from "@/lib/delivery";
import { cambodiaDay, feeFor, MAX_ORDER_CENTS, MAX_QTY, normalizePhone, optionsFor, orderNumber } from "@/lib/orders";
import { isProvinceCode, PROVINCES } from "@/lib/provinces";
import type { ErrorCode, Result } from "@/lib/result";
import { formatPrice } from "@/lib/shop";
import { shopSettings } from "@/lib/shop-settings";
import { postOrderToGroup } from "@/lib/order-telegram";
import { escapeHtml, signTelegramPass, telegram, verifyTelegramIdToken, verifyTelegramLogin, type TelegramPass } from "@/lib/telegram";
import type { CheckoutInput } from "./types";

// Public checkout (no login): everything the browser sends is checked again here; prices come from the database.
const MAX_LINES = 50;
const RATE = { orders: 5, minutes: 10 }; // ponytail: per-device limit from the orders table; add Turnstile if spam shows up

const text = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

type Placed = { orderNo: string; totalCents: number; deliveryFeeCents: number; deliveryPayDriver: boolean; deliveryZoneName: string };

export async function createOrder(input: CheckoutInput): Promise<Result<Placed>> {
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
  // "Connect Telegram" (optional): only Telegram's signed data counts; anything else → the order just isn't linked
  const tg = verifyTelegramLogin(input.telegram);

  if (!name) fields.name = "required";
  if (!phone) fields.phone = "badPhone";
  if (!isProvinceCode(provinceCode)) fields.province = "badProvince";
  if (!address) fields.address = "required";
  // only the pin from the checkout map (MapPicker: https://www.google.com/maps?q=<lat>,<lng>)
  if (mapUrl && !/^https:\/\/www\.google\.com\/maps\?q=-?\d{1,2}\.\d{1,6},-?\d{1,3}\.\d{1,6}$/.test(mapUrl)) fields.mapUrl = "badLocation";
  if (Object.keys(fields).length) return { ok: false, error: "invalid", fields };

  const lines = (Array.isArray(input.lines) ? input.lines : []).slice(0, MAX_LINES + 1);
  if (!lines.length) return { ok: false, error: "emptyCart" };
  if (lines.length > MAX_LINES || lines.some((l) => !Number.isInteger(l?.qty) || l.qty < 1 || l.qty > MAX_QTY)) return { ok: false, error: "invalid" };

  // ---- which shop: every lookup and the new order below stay inside it ----
  // the shop is the one in the page's address (sent with the order); unknown → closed
  const shopId = typeof input.shop === "string" ? await shopBySlug(input.shop) : null;
  if (!shopId) return { ok: false, error: "orderingClosed" };

  // ---- double tap: the same key → the order already made ----
  if (key) {
    const same = await prisma.order.findFirst({ where: { idempotencyKey: key, shopId }, select: { orderNo: true, totalCents: true, deliveryFeeCents: true, deliveryPayDriver: true, deliveryZoneName: true } });
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
      select: { id: true, slug: true, name: true, priceCents: true, isAvailable: true, variants: true,
        images: { orderBy: { sortOrder: "asc" }, select: { url: true } },
        // its sizes in the shop's order (the first is used when none / an unknown one was sent, like the cart does)
        sizes: { orderBy: { size: { sortOrder: "asc" } }, select: { sizeId: true, priceCents: true, size: { select: { name: true } } } },
        wholesale: { select: { isActive: true, tiers: true } },
      },
    }),
    deliveryZones(shopId, { activeOnly: true }),
  ]);
  if (settings && !settings.orderingEnabled) return { ok: false, error: "orderingClosed" };
  if (recent >= RATE.orders) return { ok: false, error: "tooManyOrders" };

  const bySlug = new Map(items.map((i) => [i.slug, i]));
  if (lines.some((l) => !bySlug.get(String(l.slug))?.isAvailable)) return { ok: false, error: "unavailable" };

  // unnamed variants are saved as "Option 2" in the shop's language (Admin → Orders and Telegram show it)
  const tp = await getTranslations({ locale: (await shopSettings(shopId)).language, namespace: "product" });
  const orderLines = lines.map((l) => {
    const item = bySlug.get(String(l.slug))!;
    // the photo the customer picked (a style) if it is one of this product's photos, else the main photo
    const photos = item.images.map((i) => i.url);
    const image = typeof l.image === "string" && photos.includes(l.image) ? l.image : (photos[0] ?? null);
    // that photo's variant name (shade, size…), if it is a variant
    const withPhoto = (Array.isArray(item.variants) ? (item.variants as { label?: string; image?: string; priceCents?: number }[]) : []).filter((x) => x.image);
    const n = withPhoto.findIndex((x) => x.image === image);
    const v = n < 0 ? undefined : withPhoto[n];
    const size = item.sizes.find((s) => s.sizeId === l.size) ?? item.sizes[0];
    // the size's own price, else the variant's (rule 8), else the product price — all from the database
    const normal = size?.priceCents ?? (typeof v?.priceCents === "number" && v.priceCents >= 0 ? v.priceCents : item.priceCents);
    // wholesale (Admin → Wholesale, when turned on): the step this line's quantity reaches lowers the unit price
    const tiers = item.wholesale?.isActive ? (item.wholesale.tiers ?? {}) as Record<string, unknown> : {};
    const unit = tierUnitCents(normal, tierAt(cleanTiers(tiers[withPhoto.length ? (v?.image ?? "\0") : ""]), l.qty));
    // saved as one text "Rose · 100 ml" (Admin → Orders, Telegram and receipts show it as is)
    const style = [v && (v.label || tp("optionN", { n: n + 1 })), size?.size.name].filter(Boolean).join(" · ") || null;
    return { itemId: item.id, name: item.name, variant: style, imageUrl: image, unitPriceCents: unit, quantity: l.qty, lineTotalCents: unit * l.qty };
  });
  const subtotalCents = orderLines.reduce((n, l) => n + l.lineTotalCents, 0);
  if (settings?.minOrderCents && subtotalCents < settings.minOrderCents) return { ok: false, error: "minOrder" };

  const options = optionsFor(zones, provinceCode);
  if (!options.length) return { ok: false, error: "invalid", fields: { province: "badProvince" } };
  // the carrier picked (Shop delivery, Grab…) among the ones covering this province
  const zone = options.find((option) => option.id === input.deliveryZoneId);
  if (!zone) return { ok: false, error: "invalid", fields: { deliveryZoneId: "invalid" } };
  // "I'll pay the driver myself": only when the shop allows it for this carrier; then the order has no delivery fee
  const fullFeeCents = feeFor(zone, subtotalCents);
  // couriers only: shop delivery is always charged in the order
  const deliveryPayDriver = zone.isCourier && zone.payDriver && fullFeeCents > 0 && input.payDriver === true;
  const deliveryFeeCents = deliveryPayDriver ? 0 : fullFeeCents;
  const totalCents = subtotalCents + deliveryFeeCents;
  // too big for the database's money columns (only huge wholesale quantities get here): ask the customer to split it
  if (totalCents > MAX_ORDER_CENTS || orderLines.some((l) => l.lineTotalCents > MAX_ORDER_CENTS)) return { ok: false, error: "orderTooLarge" };
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
          deliveryPayDriver,
          totalCents,
          paymentMethod: payment,
          idempotencyKey: key || null,
          // their Telegram → status messages (lib/change-order-status.ts), name/photo + Chat in Admin
          ...(tg && { customerChatId: tg.chatId, customerTelegramName: tg.name, customerTelegram: tg.username }),
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
      const same = await prisma.order.findFirst({ where: { idempotencyKey: key, shopId }, select: { orderNo: true, totalCents: true, deliveryFeeCents: true, deliveryPayDriver: true, deliveryZoneName: true } });
      if (same) return { ok: true, data: same };
    }
    throw cause;
  }

  // Telegram after the answer is sent: the customer sees the receipt without waiting for Telegram
  const saved = order;
  after(() => postOrderToGroup(saved.id));
  // one thank-you receipt per order (its own order number), to the customer's Telegram when they connected it
  if (tg) after(() => receiptToCustomer(shopId, tg.chatId, { orderNo: saved.orderNo, payment, lines: orderLines, subtotalCents, deliveryFeeCents, deliveryPayDriver, totalCents }));
  return { ok: true, data: { orderNo: order.orderNo, totalCents, deliveryFeeCents, deliveryPayDriver, deliveryZoneName: zone.name } };
}

/**
 * "Connect Telegram": checks the id_token from Telegram's login window (signed by Telegram, for our bot, made in the
 * last 10 minutes), says "✅ connected" to that same person, and returns a pass signed by us that checkout keeps
 * 30 days and sends with each order. Public (no login), messages nobody else, writes nothing to the database.
 */
export async function connectTelegram(shop: string, idToken: string): Promise<Result<TelegramPass>> {
  const [user, shopId] = await Promise.all([verifyTelegramIdToken(idToken), typeof shop === "string" ? shopBySlug(shop) : null]);
  if (!user || !shopId) return { ok: false, error: "invalid" };
  const { language, name } = await shopSettings(shopId);
  const t = await getTranslations({ locale: language, namespace: "checkout" });
  try {
    await telegram("sendMessage", { chat_id: user.id, text: t("tgConnectedMsg", { shop: name }) });
  } catch (cause) {
    console.error("[checkout] telegram connected message failed:", cause);
  }
  return { ok: true, data: signTelegramPass(user) };
}

/** "🙏 Thank you for your order!" + order number, items, totals, payment → the customer's Telegram. Never fails the order. */
async function receiptToCustomer(
  shopId: string,
  chatId: bigint,
  o: { orderNo: string; payment: "cod" | "bank_transfer"; lines: { name: string; variant: string | null; quantity: number; lineTotalCents: number }[]; subtotalCents: number; deliveryFeeCents: number; deliveryPayDriver: boolean; totalCents: number },
) {
  const { language, name } = await shopSettings(shopId);
  const t = await getTranslations({ locale: language, namespace: "checkout" });
  const money = (c: number) => formatPrice(c / 100);
  const e = escapeHtml;
  const DIVIDER = "------------------------";
  // ponytail: first 30 items + "… +N" keeps it under Telegram's 4096 characters; the full list is in the shop's Admin
  const items = o.lines.map((l) => `${l.quantity} × ${e(l.name)}${l.variant ? ` (${e(l.variant)})` : ""} · ${money(l.lineTotalCents)}`);
  const text = [
    `🙏 <b>${e(t("tgThanks"))}</b>`,
    `🧾 ${e(t("orderNo"))}: <b>${e(o.orderNo)}</b>`,
    `🏪 ${e(name)}`,
    DIVIDER,
    ...items.slice(0, 30),
    items.length > 30 ? `… +${items.length - 30}` : null,
    DIVIDER,
    `${e(t("subtotal"))} · ${money(o.subtotalCents)}`,
    `${e(t("delivery"))} · ${o.deliveryPayDriver ? e(t("payDriverShort")) : o.deliveryFeeCents ? money(o.deliveryFeeCents) : e(t("free"))}`,
    `<b>${e(t("total"))} · ${money(o.totalCents)}</b>`,
    `💳 ${e(t(o.payment === "cod" ? "payCod" : "payBank"))}`,
    DIVIDER,
    e(t("tgReceiptFooter")),
  ]
    .filter((line) => line !== null)
    .join("\n")
    .slice(0, 4096);
  try {
    await telegram("sendMessage", { chat_id: chatId.toString(), text, parse_mode: "HTML" });
  } catch (cause) {
    // logged (Railway → Logs) so a missing receipt can be explained; the order is already saved
    console.error("[orders] customer receipt failed:", cause);
  }
}
