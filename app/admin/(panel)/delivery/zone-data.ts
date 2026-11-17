import "server-only";
import { prisma } from "@/lib/db";
import { savedCouriers } from "./couriers";
import type { AdminZone } from "./types";

const select = { id: true, name: true, provinceCodes: true, feeCents: true, freeOverCents: true, isCourier: true, courierLogo: true, eta: true, isActive: true } as const;

/** this shop's zones (the list page) */
export const shopZones = (shopId: string): Promise<AdminZone[]> =>
  prisma.deliveryZone.findMany({ where: { shopId }, orderBy: { sortOrder: "asc" }, select });

/** couriers this shop added before, for the zone form */
export async function shopCouriers(shopId: string) {
  return savedCouriers(await prisma.deliveryZone.findMany({ where: { shopId, isCourier: true }, select: { name: true, isCourier: true, courierLogo: true } }));
}

/** one zone of this shop, or null (ids are uuids; anything else is not found) */
export const shopZone = (shopId: string, id: string): Promise<AdminZone | null> =>
  /^[0-9a-f-]{36}$/.test(id) ? prisma.deliveryZone.findFirst({ where: { id, shopId }, select }) : Promise.resolve(null);
