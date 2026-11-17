import { Skeleton } from "@/components/ui/skeleton";
import { FormCardSkeleton, Loading } from "@/components/Skeletons";

// Add / edit zone: back link, title, form cards (full width like the Delivery list)
export default function ZoneFormLoading() {
  return (
    <Loading>
      <Skeleton className="mb-4 h-5 w-24" />
      <Skeleton className="h-8 w-40 md:h-9" />
      <Skeleton className="mt-2 mb-6 h-4 w-72 max-w-full" />
      <FormCardSkeleton fields={4} />
    </Loading>
  );
}
