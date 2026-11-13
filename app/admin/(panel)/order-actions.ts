"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import type { Result } from "@/lib/result";
import { requireUser } from "@/lib/auth";
import { changeOrderStatus } from "@/lib/change-order-status";

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
