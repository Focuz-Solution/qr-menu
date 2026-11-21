import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { HeaderSkeleton, Loading, PagerSkeleton, TableSkeleton } from "@/components/Skeletons";

// Wholesale: products list (search + filters) on the left, the picked product's variants table on the right
export default function WholesaleLoading() {
  return (
    <Loading>
      <HeaderSkeleton />
      <div className="flex flex-col gap-6 md:grid md:grid-cols-[minmax(260px,340px)_1fr] md:items-start">
        <Card className="gap-0 overflow-hidden py-0">
          <div className="flex flex-col gap-2.5 border-b p-3">
            <Skeleton className="mx-1 h-4 w-24" />
            <Skeleton className="h-9 w-full rounded-full" />
            <div className="flex gap-1.5">
              <Skeleton className="h-7 w-16 rounded-full" />
              <Skeleton className="h-7 w-20 rounded-full" />
              <Skeleton className="h-7 w-20 rounded-full" />
            </div>
          </div>
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="flex min-h-16 items-center gap-3 border-b px-4 py-2.5 last:border-b-0">
              <Skeleton className="size-10 shrink-0 rounded-md" />
              <div className="flex flex-1 flex-col gap-1.5">
                <Skeleton className="h-4" style={{ maxWidth: `${80 - i * 7}%` }} />
                <Skeleton className="h-3 w-24" />
              </div>
              <Skeleton className="h-5 w-8 rounded-full" />
            </div>
          ))}
        </Card>
        <div className="min-w-0">
          <Card className="gap-0 overflow-hidden py-0">
            <div className="flex h-13 items-center gap-3 border-b px-4">
              <Skeleton className="mr-auto h-5 w-32" />
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton className="h-8 w-32 rounded-full" />
            </div>
            <TableSkeleton card={false} rows={4} columns={[{ width: "w-32", avatar: true }, { width: "w-14", end: true }, { width: "w-40", hide: "md" }, { width: "w-16", end: true }]} />
          </Card>
          <PagerSkeleton />
        </div>
      </div>
    </Loading>
  );
}
