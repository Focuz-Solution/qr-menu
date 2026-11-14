import { Skeleton } from "@/components/ui/skeleton";
import { FormCardSkeleton, Loading } from "@/components/Skeletons";

// Create a shop: back link, title, one small form (centred like the page)
export default function NewShopLoading() {
  return (
    <Loading className="mx-auto max-w-xl">
      <Skeleton className="mb-6 h-5 w-28" />
      <Skeleton className="h-8 w-48 md:h-9" />
      <Skeleton className="mt-2 mb-6 h-4 w-72 max-w-full" />
      <FormCardSkeleton fields={2} title={false} className="sm:[&>div]:grid-cols-1" />
    </Loading>
  );
}
