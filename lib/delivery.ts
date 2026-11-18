import "server-only";
import { prisma } from "@/lib/db";
import { cleanSteps, type DeliveryOption, type Zone } from "@/lib/orders";

// Delivery zones with their carriers, read the same way by checkout, createOrder and Admin → Delivery.

const zoneSelect = {
  id: true,
  name: true,
  provinceCodes: true,
  isActive: true,
  feeCents: true,
  freeOverCents: true,
  isCourier: true,
  courierLogo: true,
  eta: true,
  carriers: {
    orderBy: { sortOrder: "asc" },
    select: { id: true, name: true, isCourier: true, logo: true, eta: true, feeCents: true, feeSteps: true, payDriver: true },
  },
} as const;

type ZoneRow = {
  id: string;
  name: string;
  provinceCodes: string[];
  isActive: boolean;
  feeCents: number;
  freeOverCents: number | null;
  isCourier: boolean;
  courierLogo: string | null;
  eta: string;
  carriers: { id: string; name: string; isCourier: boolean; logo: string | null; eta: string; feeCents: number; feeSteps: unknown; payDriver: boolean }[];
};

export type FullZone = Zone & { name: string; isActive: boolean };

/** a zone row → its carriers; a zone made before carriers (no rows) is one carrier from its own fee fields (same id as the zone) */
function toZone(z: ZoneRow): FullZone {
  const carriers: DeliveryOption[] = z.carriers.length
    ? z.carriers.map((c) => ({ ...c, steps: cleanSteps(c.feeSteps) }))
    : [
        {
          id: z.id,
          name: z.name,
          isCourier: z.isCourier,
          logo: z.courierLogo,
          eta: z.eta,
          feeCents: z.feeCents,
          steps: z.freeOverCents != null && z.feeCents ? [{ fromCents: z.freeOverCents, feeCents: 0 }] : [],
          payDriver: false,
        },
      ];
  return { id: z.id, name: z.name, provinceCodes: z.provinceCodes, isActive: z.isActive, carriers };
}

/** this shop's zones in the admin's order; `activeOnly` for checkout */
export async function deliveryZones(shopId: string, { activeOnly = false } = {}): Promise<FullZone[]> {
  const rows = await prisma.deliveryZone.findMany({ where: { shopId, ...(activeOnly && { isActive: true }) }, orderBy: { sortOrder: "asc" }, select: zoneSelect });
  return rows.map(toZone);
}

/** one zone of this shop, or null (ids are uuids; anything else is not found) */
export async function deliveryZone(shopId: string, id: string): Promise<FullZone | null> {
  if (!/^[0-9a-f-]{36}$/.test(id)) return null;
  const row = await prisma.deliveryZone.findFirst({ where: { id, shopId }, select: zoneSelect });
  return row && toZone(row);
}
