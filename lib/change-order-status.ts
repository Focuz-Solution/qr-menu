import "server-only";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/db";
import type { Prisma } from "@/lib/generated/prisma/client";
import { OrderStatus } from "@/lib/generated/prisma/enums";
import { NEXT_STATUS, STATUS_TIME } from "@/lib/order-status";
import type { Result } from "@/lib/result";
import { shopSettings } from "@/lib/shop-settings";
import { hasBotToken, telegram, TelegramError } from "@/lib/telegram";

/** moves one order of `shopId` to the next status (an order of another shop → notFound) */
export async function changeOrderStatus(actorId: string, shopId: string, id: string, to: string, reason?: string): Promise<Result> {
  if (!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id)) return { ok: false, error: "notFound" };
  if (!Object.hasOwn(OrderStatus, to)) return { ok: false, error: "invalid" };
  const next = to as OrderStatus;
  const cancelReason = reason?.trim().slice(0, 300);
  if (next === "cancelled" && !cancelReason) return { ok: false, error: "invalid", fields: { reason: "required" } };

  const order = await prisma.order.findFirst({ where: { id, shopId }, select: { status: true } });
  if (!order) return { ok: false, error: "notFound" };
  if (!NEXT_STATUS[order.status].includes(next)) return { ok: false, error: "badTransition" };

  const now = new Date();
  const timeField = STATUS_TIME[next as keyof typeof STATUS_TIME];
  const moved = await prisma.$transaction(async (tx) => {
    // only if it is still in the status we checked: two staff pressing at once → the second one gets badTransition
    const { count } = await tx.order.updateMany({
      where: { id, shopId, status: order.status },
      data: { status: next, [timeField]: now, ...(next === "cancelled" && { cancelReason }) } as Prisma.OrderUpdateManyMutationInput,
    });
    if (!count) return false;
    await tx.orderEvent.create({
      data: {
        orderId: id,
        type: "status_changed",
        fromStatus: order.status,
        toStatus: next,
        actorUserId: actorId,
        payload: cancelReason ? { reason: cancelReason } : undefined,
      },
    });
    return true;
  });
  if (!moved) return { ok: false, error: "badTransition" };

  // ponytail: Telegram message update (outbox job) joins here in P6
  revalidatePath("/admin", "layout");
  // the customer's Telegram (if they tapped "Get order updates"), after the answer: staff don't wait for Telegram
  after(() => notifyCustomer(id, next, cancelReason));
  return { ok: true };
}

/** "✅ Your order #… is confirmed" → the customer's private chat with the bot. Never fails the status change. */
async function notifyCustomer(orderId: string, status: OrderStatus, reason?: string) {
  if (status === "new" || !hasBotToken()) return;
  const order = await prisma.order.findUnique({ where: { id: orderId }, select: { orderNo: true, shopId: true, customerChatId: true } });
  if (!order?.customerChatId) return;
  const { language, name } = await shopSettings(order.shopId);
  const t = await getTranslations({ locale: language, namespace: "checkout" });
  const text = [t(`tgStatus.${status}`, { no: order.orderNo, shop: name }), status === "cancelled" && reason ? t("tgReason", { reason }) : null]
    .filter(Boolean)
    .join("\n");
  try {
    await telegram("sendMessage", { chat_id: order.customerChatId.toString(), text });
  } catch (cause) {
    // the customer blocked the bot (403): stop trying for this order
    if (cause instanceof TelegramError && cause.code === 403) await prisma.order.update({ where: { id: orderId }, data: { customerChatId: null } }).catch(() => {});
    else console.error("[orders] customer telegram failed:", cause);
  }
}
