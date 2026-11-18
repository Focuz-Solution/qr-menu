import "server-only";
import { deliveryZone, deliveryZones } from "@/lib/delivery";
import { savedCouriers } from "./couriers";
import type { AdminZone } from "./types";

/** this shop's zones with their carriers (the list page) */
export const shopZones = (shopId: string): Promise<AdminZone[]> => deliveryZones(shopId);

/** one zone of this shop, or null */
export const shopZone = (shopId: string, id: string): Promise<AdminZone | null> => deliveryZone(shopId, id);

/** couriers this shop added before (with their uploaded logo), for the carrier picker */
export async function shopCouriers(shopId: string) {
  return savedCouriers((await deliveryZones(shopId)).flatMap((z) => z.carriers));
}
