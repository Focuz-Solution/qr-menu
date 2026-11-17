import { requireUser } from "@/lib/auth";
import { ZoneForm } from "../ZoneForm";
import { shopCouriers } from "../zone-data";

// Delivery → Add zone (own page; adding a courier opens a small dialog inside it)
export default async function NewZonePage() {
  const { shop } = await requireUser("delivery.manage");
  return <ZoneForm couriers={await shopCouriers(shop.id)} />;
}
