import { ListPageSkeleton } from "@/components/Skeletons";

// Delivery: header + Add zone → zones table → pager
export default function DeliveryLoading() {
  return (
    <ListPageSkeleton
      rows={5}
      columns={[{ width: "w-36" }, { width: "w-40", hide: "md" }, { width: "w-14", end: true }, { width: "w-14", end: true, hide: "lg" }, { width: "w-10" }, { width: "w-16", end: true }]}
    />
  );
}
