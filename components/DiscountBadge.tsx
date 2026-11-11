import { cn } from "@/lib/utils";

// Red rotated circle "20%" — product card and detail page
export function DiscountBadge({ off, className }: { off: number; className?: string }) {
  if (off <= 0) return null;
  return (
    <span
      className={cn(
        "grid size-12 shrink-0 -rotate-20 place-items-center rounded-full bg-destructive text-sm font-semibold text-primary-foreground",
        className,
      )}
    >
      {off}%
    </span>
  );
}
