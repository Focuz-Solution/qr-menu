"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import type { Result } from "@/lib/result";
import { requireUser } from "@/lib/auth";
import { changeOrderStatus } from "@/lib/change-order-status";
import { PaymentStatus } from "@/lib/generated/prisma/enums";

const UUID = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

/** unpaid / paid / refunded (e.g. a bank transfer arrived); saved in the order's history */
export async function setPaymentStatus(id: string, to: string): Promise<Result> {
  const me = await requireUser("orders.status");
  if (!UUID.test(id)) return { ok: false, error: "notFound" };
  if (!Object.hasOwn(PaymentStatus, to)) return { ok: false, error: "invalid" };
  const order = await prisma.order.findFirst({ where: { id, shopId: me.shop.id }, select: { paymentStatus: true } });
  if (!order) return { ok: false, error: "notFound" };
  if (order.paymentStatus === to) return { ok: true };
  await prisma.$transaction([
    prisma.order.update({ where: { id }, data: { paymentStatus: to as PaymentStatus } }),
    prisma.orderEvent.create({ data: { orderId: id, type: "payment", actorUserId: me.id, payload: { to } } }),
  ]);
  revalidatePath("/admin", "layout");
  return { ok: true };
}

export async function setOrderStatus(id: string, to: string, reason?: string) {
  const me = await requireUser("orders.status");
  return changeOrderStatus(me.id, me.shop.id, id, to, reason);
}

export async function deleteOrder(id: string): Promise<Result> {
  const { shop } = await requireUser("orders.delete");
  if (!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id)) {
    return { ok: false, error: "notFound" };
  }
  try {
    await prisma.order.deleteMany({ where: { id, shopId: shop.id } });
  } catch {
    return { ok: false, error: "server" };
  }
  revalidatePath("/admin", "layout");
  return { ok: true };
}
