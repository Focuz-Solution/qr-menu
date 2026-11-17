import { requireUser } from "@/lib/auth";
import { DeliveryZones } from "./DeliveryZones";
import { shopZones } from "./zone-data";

export default async function DeliveryPage() {
  const { shop } = await requireUser("delivery.manage");
  return <DeliveryZones zones={await shopZones(shop.id)} />;
}
