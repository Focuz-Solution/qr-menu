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

const DATE = /^\d{4}-\d{2}-\d{2}$/;
/** "2026-11-19" → start of that day in Cambodia (ms), NaN when not a date */
const dayStart = (v: unknown) => (typeof v === "string" && DATE.test(v) ? Date.parse(`${v}T00:00:00Z`) - KH_OFFSET : NaN);

export default async function AdminOrdersPage({ searchParams }: PageProps<"/admin/orders">) {
  const user = await requireUser();
  // custom date range: both days included; a bad / reversed range is ignored
  const { from, to } = await searchParams;
  const rangeFrom = dayStart(from);
  const rangeTo = dayStart(to) + DAY;
  const range = rangeFrom < rangeTo ? { from: from as string, to: to as string } : null;
  // eslint-disable-next-line react-hooks/purity -- server component, runs once per request
  const today = cambodiaDayStart(Date.now());

  const localToday = new Date(+today + KH_OFFSET);
  const year = localToday.getUTCFullYear();
  const periodStarts = {
    all: 0,
    today: +today,
    // yesterday also ends where today starts (the list and the cards stop there)
    yesterday: +today - DAY,
    week: +today - ((localToday.getUTCDay() + 6) % 7) * DAY,
    month: Date.UTC(year, localToday.getUTCMonth(), 1) - KH_OFFSET,
    year: Date.UTC(year, 0, 1) - KH_OFFSET,
  };

  // per date filter: orders by status since the period's start → the summary cards (one query each)
  const periodStats = async (start: number, end?: number): Promise<PeriodStats> => {
    const g = await prisma.order.groupBy({
      by: ["status"],
      where: { shopId: user.shop.id, createdAt: { gte: new Date(start), ...(end && { lt: new Date(end) }) } },
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

  const [rows, byStatus, todayStats, yesterday, week, month, yearStats, custom] = await Promise.all([
    prisma.order.findMany({
      // a custom range loads that range's orders (so older ones are found too), else the newest
      where: { shopId: user.shop.id, ...(range && { createdAt: { gte: new Date(rangeFrom), lt: new Date(rangeTo) } }) },
      orderBy: { createdAt: "desc" },
      take: LIMIT,
      // only what the list shows (the full order loads on its own page)
      select: orderListSelect,
    }),
    prisma.order.groupBy({ by: ["status"], where: { shopId: user.shop.id }, _count: { _all: true } }),
    periodStats(periodStarts.today),
    periodStats(periodStarts.yesterday, periodStarts.today),
    periodStats(periodStarts.week),
    periodStats(periodStarts.month),
    periodStats(periodStarts.year),
    range ? periodStats(rangeFrom, rangeTo) : undefined,
  ]);

  const orders: AdminOrderRow[] = rows.map(toAdminOrderRow);

  const stats: OrderStats = {
    today: todayStats.orders,
    revenueTodayCents: todayStats.revenueCents,
    counts: Object.fromEntries(
      ORDER_STATUSES.map((s) => [s, byStatus.find((b) => b.status === s)?._count._all ?? 0]),
    ) as OrderStats["counts"],
    periods: { today: todayStats, yesterday, week, month, year: yearStats, custom },
  };

  // keyed by the range: a new range starts the list fresh (page 1, its own tab counts)
  return <Orders key={range ? `${range.from}_${range.to}` : "all"} orders={orders} stats={stats} periodStarts={periodStarts} range={range} canDelete={can(user, "orders.delete")} />;
}
