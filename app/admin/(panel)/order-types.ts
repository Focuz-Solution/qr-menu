import type { OrderStatus, PaymentMethod, PaymentStatus } from "@/lib/generated/prisma/enums";

// What the Orders page sends to the browser (money in cents).
export type AdminOrder = {
  id: string;
  orderNo: string;
  status: OrderStatus;
  createdAt: Date;
  customerName: string;
  customerPhone: string;
  customerTelegram: string | null;
  provinceName: string;
  districtName: string | null;
  communeName: string | null;
  addressLine: string;
  landmark: string | null;
  mapUrl: string | null;
  note: string | null;
  deliveryZoneName: string;
  subtotalCents: number;
  deliveryFeeCents: number;
  discountCents: number;
  totalCents: number;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  cancelReason: string | null;
  items: {
    id: string;
    name: string;
    variant: string | null;
    imageUrl: string | null;
    unitPriceCents: number;
    quantity: number;
    lineTotalCents: number;
  }[];
  events: { id: string; type: string; toStatus: OrderStatus | null; createdAt: Date; actor: string | null }[];
};

/** one row of the Orders list: only what the table, search, sort and CSV report use (the order page loads the rest) */
export type AdminOrderRow = Pick<
  AdminOrder,
  "id" | "orderNo" | "status" | "createdAt" | "customerName" | "customerPhone" | "provinceName" | "totalCents" | "paymentMethod"
> & { itemCount: number };

export type OrderStats = {
  /** orders placed today (Cambodia time) */
  today: number;
  /** today's total, cancelled orders left out */
  revenueTodayCents: number;
  /** all-time count per status (tabs) */
  counts: Record<OrderStatus, number>;
  /** the summary cards when the date filter is This week / month / year (counted in the database, not just the loaded rows) */
  periods: Record<"week" | "month" | "year", PeriodStats>;
};

export type PeriodStats = { orders: number; revenueCents: number; toPack: number; shipping: number };
