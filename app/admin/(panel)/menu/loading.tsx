import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { HeaderSkeleton, Loading, PagerSkeleton, TableSkeleton } from "@/components/Skeletons";

// Menu: categories list on the left, the picked category's products table on the right
export default function MenuLoading() {
  return (
    <Loading>
      <HeaderSkeleton button />
      <div className="flex flex-col gap-6 md:grid md:grid-cols-[minmax(260px,340px)_1fr] md:items-start">
        <Card className="gap-0 overflow-hidden py-0">
          <div className="flex h-14 items-center justify-between border-b px-4">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-8 w-16 rounded-full" />
          </div>
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="flex h-14 items-center gap-3 border-b px-4 last:border-b-0">
              <Skeleton className="size-4 rounded-sm" />
              <Skeleton className="h-4 flex-1" style={{ maxWidth: `${80 - i * 7}%` }} />
              <Skeleton className="h-4 w-6" />
            </div>
          ))}
        </Card>
        <div className="min-w-0">
          <Card className="gap-0 overflow-hidden py-0">
            <div className="flex h-14 items-center justify-between border-b px-4">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-8 w-24 rounded-full" />
            </div>
            <TableSkeleton card={false} rows={6} columns={[{ width: "w-40", avatar: true }, { width: "w-14", end: true }, { width: "w-10", hide: "md" }, { width: "w-16", end: true }]} />
          </Card>
          <PagerSkeleton />
        </div>
      </div>
    </Loading>
  );
}
