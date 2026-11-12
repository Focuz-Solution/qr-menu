import "server-only";
import type { Prisma } from "@/lib/generated/prisma/client";
import type { AdminOrder, AdminOrderRow } from "./order-types";

// What the Orders list and the order page load for each order, and how it's sent to the browser.
export const orderInclude = {
  items: true,
  events: { orderBy: { createdAt: "asc" }, include: { actorUser: { select: { name: true } } } },
} satisfies Prisma.OrderInclude;

type OrderRow = Prisma.OrderGetPayload<{ include: typeof orderInclude }>;

/** the Orders list loads only these columns (no events, no address, just item quantities) */
export const orderListSelect = {
  id: true,
  orderNo: true,
  status: true,
  createdAt: true,
  customerName: true,
  customerPhone: true,
  provinceName: true,
  totalCents: true,
  paymentMethod: true,
  items: { select: { quantity: true } },
} satisfies Prisma.OrderSelect;

export const toAdminOrderRow = ({ items, ...o }: Prisma.OrderGetPayload<{ select: typeof orderListSelect }>): AdminOrderRow => ({
  ...o,
  itemCount: items.reduce((n, i) => n + i.quantity, 0),
});

export const toAdminOrder = (o: OrderRow): AdminOrder => ({
    id: o.id,
    orderNo: o.orderNo,
    status: o.status,
    createdAt: o.createdAt,
    customerName: o.customerName,
    customerPhone: o.customerPhone,
    customerTelegram: o.customerTelegram,
    provinceName: o.provinceName,
    districtName: o.districtName,
    communeName: o.communeName,
    addressLine: o.addressLine,
    landmark: o.landmark,
    mapUrl: o.mapUrl,
    note: o.note,
    deliveryZoneName: o.deliveryZoneName,
    subtotalCents: o.subtotalCents,
    deliveryFeeCents: o.deliveryFeeCents,
    discountCents: o.discountCents,
    totalCents: o.totalCents,
    paymentMethod: o.paymentMethod,
    paymentStatus: o.paymentStatus,
    cancelReason: o.cancelReason,
    items: o.items.map((i) => ({
      id: i.id,
      name: i.name,
      variant: i.variant,
      imageUrl: i.imageUrl,
      unitPriceCents: i.unitPriceCents,
      quantity: i.quantity,
      lineTotalCents: i.lineTotalCents,
    })),
    events: o.events.map((e) => ({
      id: e.id,
      type: e.type,
      toStatus: e.toStatus,
      createdAt: e.createdAt,
      actor: e.actorUser?.name ?? (e.actorTelegram as { username?: string } | null)?.username ?? null,
    })),
});
