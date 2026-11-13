"use client";

import { Tag } from "lucide-react";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function DiscountBadge({ off, className }: { off: number; className?: string }) {
  const t = useTranslations("product");
  if (off <= 0) return null;
  return (
    <Badge
      className={cn("h-6 shrink-0 gap-1 border-0 px-2.5 text-[11px] font-semibold tabular-nums shadow-sm [&>svg]:size-3!", className)}
    >
      <Tag aria-hidden />
      {t("saleOff", { off })}
    </Badge>
  );
}
