import { FormCardSkeleton, HeaderSkeleton, Loading } from "@/components/Skeletons";

// Settings: shop details, appearance, links — form cards
export default function SettingsLoading() {
  return (
    <Loading>
      <HeaderSkeleton button />
      <div className="flex flex-col gap-4">
        <FormCardSkeleton fields={6} />
        <FormCardSkeleton fields={4} />
        <FormCardSkeleton fields={3} />
      </div>
    </Loading>
  );
}
