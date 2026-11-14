import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { ORDER_STATUSES } from "@/lib/order-status";
import { orderListSelect, toAdminOrderRow } from "../order-data";
import { Orders } from "../Orders";
import type { AdminOrderRow, OrderStats, PeriodStats } from "../order-types";

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

  // per date filter: orders by status since the period's start → the summary cards (one query each)
  const periodStats = async (start: number): Promise<PeriodStats> => {
    const g = await prisma.order.groupBy({
      by: ["status"],
      where: { shopId: user.shop.id, createdAt: { gte: new Date(start) } },
      _count: { _all: true },
      _sum: { totalCents: true },
    });
    const n = (s: string) => g.find((b) => b.status === s)?._count._all ?? 0;
    return {
      orders: g.reduce((sum, b) => sum + b._count._all, 0),
      revenueCents: g.reduce((sum, b) => sum + (b.status === "cancelled" ? 0 : (b._sum.totalCents ?? 0)), 0),
      toPack: n("confirmed") + n("packing"),
      shipping: n("shipped"),
    };
  };

  const [rows, byStatus, todayCount, todayRevenue, week, month, yearStats] = await Promise.all([
    prisma.order.findMany({
      where: { shopId: user.shop.id },
      orderBy: { createdAt: "desc" },
      take: LIMIT,
      // only what the list shows (the full order loads on its own page)
      select: orderListSelect,
    }),
    prisma.order.groupBy({ by: ["status"], where: { shopId: user.shop.id }, _count: { _all: true } }),
    prisma.order.count({ where: { shopId: user.shop.id, createdAt: { gte: today } } }),
    prisma.order.aggregate({ where: { shopId: user.shop.id, createdAt: { gte: today }, status: { not: "cancelled" } }, _sum: { totalCents: true } }),
    periodStats(periodStarts.week),
    periodStats(periodStarts.month),
    periodStats(periodStarts.year),
  ]);

  const orders: AdminOrderRow[] = rows.map(toAdminOrderRow);

  const stats: OrderStats = {
    today: todayCount,
    revenueTodayCents: todayRevenue._sum.totalCents ?? 0,
    counts: Object.fromEntries(
      ORDER_STATUSES.map((s) => [s, byStatus.find((b) => b.status === s)?._count._all ?? 0]),
    ) as OrderStats["counts"],
    periods: { week, month, year: yearStats },
  };

  return <Orders orders={orders} stats={stats} periodStarts={periodStarts} canDelete={can(user, "orders.delete")} />;
}
