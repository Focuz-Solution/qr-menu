import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { LinesSkeleton, Loading, TableSkeleton } from "@/components/Skeletons";

// one order: back + order number → items and history on the left, customer / status cards on the right
export default function OrderLoading() {
  return (
    <Loading>
      <div className="mb-4 flex flex-col gap-3">
        <Skeleton className="h-8 w-20 rounded-full" />
        <div className="flex flex-wrap items-center gap-3">
          <Skeleton className="h-8 w-52 md:h-9" />
          <Skeleton className="h-6 w-20 rounded-full" />
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-[1fr_340px] lg:items-start">
        <div className="flex min-w-0 flex-col gap-4">
          <TableSkeleton rows={3} columns={[{ width: "w-40", avatar: true }, { width: "w-10", end: true }, { width: "w-16", end: true }]} />
          <Card className="gap-4 p-4">
            <Skeleton className="h-5 w-24" />
            <LinesSkeleton lines={4} />
          </Card>
        </div>
        <div className="flex flex-col gap-4">
          {[5, 3, 4].map((lines, i) => (
            <Card key={i} className="gap-4 p-4">
              <Skeleton className="h-5 w-28" />
              <LinesSkeleton lines={lines} />
            </Card>
          ))}
        </div>
      </div>
    </Loading>
  );
}
