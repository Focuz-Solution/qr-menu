import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { HeaderSkeleton, Loading } from "@/components/Skeletons";

// Roles: owner note, then one card per role with its permission checkboxes
export default function RolesLoading() {
  return (
    <Loading>
      <HeaderSkeleton button />
      <div className="flex flex-col gap-4">
        <Card className="flex-row items-center gap-3 px-4 py-3">
          <Skeleton className="size-9 rounded-lg" />
          <Skeleton className="h-4 w-72 max-w-full" />
        </Card>
        {Array.from({ length: 3 }, (_, i) => (
          <Card key={i} className="gap-4 p-4 md:p-5">
            <div className="flex items-center gap-3">
              <Skeleton className="h-11 w-56 max-w-full rounded-full" />
              <Skeleton className="ml-auto h-4 w-20" />
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }, (_, j) => (
                <div key={j} className="flex items-start gap-2.5">
                  <Skeleton className="mt-0.5 size-4 rounded-sm" />
                  <div className="flex flex-1 flex-col gap-1.5">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-full" />
                  </div>
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </Loading>
  );
}
