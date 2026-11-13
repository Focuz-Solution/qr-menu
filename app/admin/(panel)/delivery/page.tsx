import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { DeliveryZones } from "./DeliveryZones";

export default async function DeliveryPage() {
  const { shop } = await requireUser("delivery.manage");
  const zones = await prisma.deliveryZone.findMany({
    where: { shopId: shop.id },
    orderBy: { sortOrder: "asc" },
    select: {
      id: true, name: true, provinceCodes: true, feeCents: true,
      freeOverCents: true, eta: true, isActive: true,
    },
  });
  return <DeliveryZones zones={zones} />;
}
