import { ListPageSkeleton } from "@/components/Skeletons";

// Users: header + Add user → people table → pager
export default function UsersLoading() {
  return (
    <ListPageSkeleton
      rows={6}
      columns={[{ width: "w-32", avatar: true }, { width: "w-36", hide: "md" }, { width: "w-20" }, { width: "w-24", hide: "lg" }, { width: "w-16" }, { width: "w-16", end: true }]}
    />
  );
}
