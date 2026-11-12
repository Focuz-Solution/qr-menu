import "server-only";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import type { Prisma } from "@/lib/generated/prisma/client";
import { OrderStatus } from "@/lib/generated/prisma/enums";
import { NEXT_STATUS, STATUS_TIME } from "@/lib/order-status";
import type { Result } from "@/lib/result";

export async function changeOrderStatus(actorId: string, id: string, to: string, reason?: string): Promise<Result> {
  if (!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id)) return { ok: false, error: "notFound" };
  if (!Object.hasOwn(OrderStatus, to)) return { ok: false, error: "invalid" };
  const next = to as OrderStatus;
  const cancelReason = reason?.trim().slice(0, 300);
  if (next === "cancelled" && !cancelReason) return { ok: false, error: "invalid", fields: { reason: "required" } };

  const order = await prisma.order.findUnique({ where: { id }, select: { status: true } });
  if (!order) return { ok: false, error: "notFound" };
  if (!NEXT_STATUS[order.status].includes(next)) return { ok: false, error: "badTransition" };

  const now = new Date();
  const timeField = STATUS_TIME[next as keyof typeof STATUS_TIME];
  const moved = await prisma.$transaction(async (tx) => {
    // only if it is still in the status we checked: two staff pressing at once → the second one gets badTransition
    const { count } = await tx.order.updateMany({
      where: { id, status: order.status },
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
  return { ok: true };
}
