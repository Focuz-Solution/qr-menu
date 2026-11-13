import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { orderInclude, toAdminOrder } from "../../order-data";
import { OrderView } from "./OrderView";

export default async function OrderPage({ params }: PageProps<"/admin/orders/[id]">) {
  const me = await requireUser();
  const { shop } = me;
  const { id } = await params;
  // order ids are uuids; anything else is simply not found
  const row = /^[0-9a-f-]{36}$/.test(id) ? await prisma.order.findFirst({ where: { id, shopId: shop.id }, include: orderInclude }) : null;
  if (!row) notFound();
  return <OrderView order={toAdminOrder(row)} canChangeStatus={can(me, "orders.status")} />;
}
