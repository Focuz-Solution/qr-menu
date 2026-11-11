"use client";

import { useTranslations } from "next-intl";
import type { OrderStatus } from "@/lib/generated/prisma/enums";
import { formatPrice } from "@/lib/shop";
import { cn } from "@/lib/utils";
import type { AdminOrder } from "./order-types";

// Small pieces shared by the Orders list and the order page.
export const money = (cents: number) => formatPrice(cents / 100);

const pill: Record<OrderStatus, string> = {
  new: "bg-info text-info-foreground",
  confirmed: "bg-violet text-violet-foreground",
  packing: "bg-warn text-warn-foreground",
  shipped: "bg-best text-best-foreground",
  delivered: "bg-ok text-ok-foreground",
  cancelled: "bg-destructive/10 text-destructive",
};

export function StatusPill({ status }: { status: OrderStatus }) {
  const t = useTranslations("admin.status");
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-semibold whitespace-nowrap", pill[status])}>
      <span className="size-1.5 rounded-full bg-current" aria-hidden />
      {t(status)}
    </span>
  );
}

/** "+85512345678" → "012 345 678" (how Cambodians read numbers) */
export function localPhone(e164: string) {
  const n = e164.replace(/^\+855/, "0");
  return `${n.slice(0, 3)} ${n.slice(3, 6)} ${n.slice(6)}`;
}

export const fullAddress = (o: AdminOrder) => [o.addressLine, o.communeName, o.districtName, o.provinceName].filter(Boolean).join(", ");
