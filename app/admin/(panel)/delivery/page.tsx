import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { DeliveryZones } from "./DeliveryZones";

export default async function DeliveryPage() {
  await requireUser(["owner"]);
  const zones = await prisma.deliveryZone.findMany({
    orderBy: { sortOrder: "asc" },
    select: {
      id: true, name: true, provinceCodes: true, feeCents: true,
      freeOverCents: true, eta: true, isActive: true,
    },
  });
  return <DeliveryZones zones={zones} />;
}
