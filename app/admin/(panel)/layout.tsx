import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { shopSettings } from "@/lib/shop-settings";
import { AdminShell } from "./AdminShell";

// every page inside the panel needs a logged-in admin; pages with fewer roles check again themselves
export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const [newOrders, { name, logo }, shops] = await Promise.all([
    prisma.order.count({ where: { shopId: user.shop.id, status: "new" } }),
    shopSettings(user.shop.id),
    // the user menu's shop list: owner → every shop, others → their shops
    prisma.shop.findMany({
      where: user.isOwner ? {} : { memberships: { some: { userId: user.id } } },
      orderBy: { createdAt: "asc" },
      select: { id: true, slug: true, settings: { select: { name: true, logoUrl: true } } },
    }),
  ]);
  return (
    <AdminShell
      user={user}
      newOrders={newOrders}
      shopName={name}
      logo={logo}
      shops={shops.map((s) => ({ id: s.id, name: s.settings?.name ?? s.slug, logo: s.settings?.logoUrl ?? "" }))}
    >
      {children}
    </AdminShell>
  );
}
