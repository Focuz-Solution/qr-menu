import { HeaderSkeleton, Loading, PagerSkeleton, StatsSkeleton, TableSkeleton, TabsSkeleton } from "@/components/Skeletons";

// Orders: header (report + search) → number cards → status tabs + period → table → pager
export default function OrdersLoading() {
  return (
    <Loading>
      <HeaderSkeleton search button />
      <StatsSkeleton />
      <TabsSkeleton tabs={7} select />
      <TableSkeleton
        columns={[
          { width: "w-28" },
          { width: "w-20", hide: "md" },
          { width: "w-28" },
          { width: "w-24", hide: "lg" },
          { width: "w-12", hide: "lg" },
          { width: "w-16", end: true },
          { width: "w-20" },
        ]}
      />
      <PagerSkeleton />
    </Loading>
  );
}
