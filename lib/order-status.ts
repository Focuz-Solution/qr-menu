import type { OrderStatus } from "@/lib/generated/prisma/enums";

// Order status flow (spec §6, plan/business-rules.md 21). Shared by the Orders screen and the server action.
//   new → confirmed → packing → shipped → delivered
//   new / confirmed / packing → cancelled (with a reason)
export const ORDER_STATUSES = ["new", "confirmed", "packing", "shipped", "delivered", "cancelled"] as const satisfies OrderStatus[];

export const NEXT_STATUS: Record<OrderStatus, OrderStatus[]> = {
  new: ["confirmed", "cancelled"],
  confirmed: ["packing", "cancelled"],
  packing: ["shipped", "cancelled"],
  shipped: ["delivered"],
  delivered: [],
  cancelled: [],
};

/** the order column that records when it reached this status */
export const STATUS_TIME = {
  confirmed: "confirmedAt",
  packing: "packedAt",
  shipped: "shippedAt",
  delivered: "deliveredAt",
  cancelled: "cancelledAt",
} as const satisfies Partial<Record<OrderStatus, string>>;
