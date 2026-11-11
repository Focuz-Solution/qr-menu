import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { ORDER_STATUSES } from "@/lib/order-status";
import { orderInclude, toAdminOrder } from "./order-data";
import { Orders } from "./Orders";
import type { AdminOrder, OrderStats } from "./order-types";

// Cambodia is UTC+7 all year (no daylight saving) → start of "today" there
const KH_OFFSET = 7 * 60 * 60 * 1000;
const DAY = 24 * 60 * 60 * 1000;
const cambodiaDayStart = (now: number) => new Date(Math.floor((now + KH_OFFSET) / DAY) * DAY - KH_OFFSET);

// ponytail: newest 200 orders, filtered in the browser; switch to server search + paging when orders grow past that
const LIMIT = 200;

export default async function AdminOrdersPage() {
  const user = await requireUser();
  // eslint-disable-next-line react-hooks/purity -- server component, runs once per request
  const today = cambodiaDayStart(Date.now());

  const localToday = new Date(+today + KH_OFFSET);
  const year = localToday.getUTCFullYear();
  const periodStarts = {
    all: 0,
    week: +today - ((localToday.getUTCDay() + 6) % 7) * DAY,
    month: Date.UTC(year, localToday.getUTCMonth(), 1) - KH_OFFSET,
    year: Date.UTC(year, 0, 1) - KH_OFFSET,
  };

  const [rows, byStatus, todayCount, todayRevenue] = await Promise.all([
    prisma.order.findMany({
      orderBy: { createdAt: "desc" },
      take: LIMIT,
      include: orderInclude,
    }),
    prisma.order.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.order.count({ where: { createdAt: { gte: today } } }),
    prisma.order.aggregate({ where: { createdAt: { gte: today }, status: { not: "cancelled" } }, _sum: { totalCents: true } }),
  ]);

  const orders: AdminOrder[] = rows.map(toAdminOrder);

  const stats: OrderStats = {
    today: todayCount,
    revenueTodayCents: todayRevenue._sum.totalCents ?? 0,
    counts: Object.fromEntries(
      ORDER_STATUSES.map((s) => [s, byStatus.find((b) => b.status === s)?._count._all ?? 0]),
    ) as OrderStats["counts"],
  };

  return <Orders orders={orders} stats={stats} periodStarts={periodStarts} canDelete={user.role === "owner"} />;
}
