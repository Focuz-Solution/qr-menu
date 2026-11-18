import { ListPageSkeleton } from "@/components/Skeletons";


export default function SizesLoading() {
  return <ListPageSkeleton rows={5} columns={[{ width: "w-28" }, { width: "w-16", end: true }, { width: "w-16", end: true }]} />;
}
