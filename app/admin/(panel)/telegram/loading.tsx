import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { HeaderSkeleton, LinesSkeleton, Loading } from "@/components/Skeletons";

// Telegram: setup steps on the left, the group preview on the right
export default function TelegramLoading() {
  return (
    <Loading>
      <HeaderSkeleton />
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <Card className="gap-0 divide-y overflow-hidden py-0">
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="flex flex-col gap-3 p-4">
              <Skeleton className="h-4 w-40" />
              <LinesSkeleton lines={2} />
              <Skeleton className="h-9 w-36 rounded-full" />
            </div>
          ))}
        </Card>
        <Card className="gap-3 p-4 md:p-5">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-3 w-48" />
          <Skeleton className="mx-auto h-72 w-full max-w-sm rounded-xl" />
        </Card>
      </div>
    </Loading>
  );
}
