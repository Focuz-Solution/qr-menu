import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { HeaderSkeleton, Loading } from "@/components/Skeletons";

// Your shops: a list of shops (logo, name, link, status)
export default function ShopsLoading() {
  return (
    <Loading>
      <HeaderSkeleton button />
      <Card className="gap-0 overflow-hidden py-0">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="flex h-18 items-center gap-3 border-b px-4 last:border-b-0">
            <Skeleton className="size-10 rounded-lg" />
            <div className="flex flex-1 flex-col gap-1.5">
              <Skeleton className="h-4 w-40 max-w-full" />
              <Skeleton className="h-3 w-28" />
            </div>
            <Skeleton className="h-6 w-16 rounded-full" />
          </div>
        ))}
      </Card>
    </Loading>
  );
}
