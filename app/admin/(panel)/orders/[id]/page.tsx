import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { orderInclude, toAdminOrder } from "../../order-data";
import { OrderView } from "./OrderView";

export default async function OrderPage({ params }: PageProps<"/admin/orders/[id]">) {
  const { shop } = await requireUser();
  const { id } = await params;
  // order ids are uuids; anything else is simply not found
  const row = /^[0-9a-f-]{36}$/.test(id) ? await prisma.order.findFirst({ where: { id, shopId: shop.id }, include: orderInclude }) : null;
  if (!row) notFound();
  return <OrderView order={toAdminOrder(row)} />;
}
