import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { ZoneForm } from "../ZoneForm";
import { shopCouriers, shopZone } from "../zone-data";

// Delivery → Edit zone
export default async function EditZonePage({ params }: PageProps<"/admin/delivery/[id]">) {
  const { shop } = await requireUser("delivery.manage");
  const { id } = await params;
  const [zone, couriers] = await Promise.all([shopZone(shop.id, id), shopCouriers(shop.id)]);
  if (!zone) notFound();
  return <ZoneForm zone={zone} couriers={couriers} />;
}
