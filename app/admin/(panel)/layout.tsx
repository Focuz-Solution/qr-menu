import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { AdminShell } from "./AdminShell";

// every page inside the panel needs a logged-in admin; pages with fewer roles check again themselves
export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const newOrders = await prisma.order.count({ where: { status: "new" } });
  return (
    <AdminShell user={user} newOrders={newOrders}>
      {children}
    </AdminShell>
  );
}
