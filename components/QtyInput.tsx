"use client";

import { useState } from "react";
import { MAX_QTY } from "@/lib/orders";
import { cn, latinDigits } from "@/lib/utils";

/**
 * The number between − and ＋ (product page, checkout): tap it and type a quantity (wholesale buyers order hundreds).
 * Saved when leaving the box or pressing Enter (Enter never sends the checkout form); 1 to MAX_QTY, Khmer digits too.
 * Empty / 0 puts the old number back (the bin removes a line). Grows with the number of digits.
 */
export function QtyInput({ value, onChange, label, className }: { value: number; onChange: (qty: number) => void; label: string; className?: string }) {
  const [typing, setTyping] = useState<string | null>(null);
  const shown = typing ?? String(value);
  const commit = () => {
    if (typing === null) return;
    const n = Number.parseInt(latinDigits(typing), 10);
    setTyping(null);
    if (Number.isInteger(n) && n >= 1 && n !== value) onChange(Math.min(n, MAX_QTY));
  };
  return (
    <input
      type="text"
      inputMode="numeric"
      autoComplete="off"
      value={shown}
      aria-label={label}
      onChange={(e) => setTyping(e.target.value.replace(/[^0-9០-៩]/g, "").slice(0, 7))}
      onFocus={(e) => e.currentTarget.select()}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key !== "Enter") return;
        e.preventDefault();
        e.currentTarget.blur();
      }}
      style={{ width: `${Math.max(2, shown.length) + 1}ch` }}
      className={cn("h-8 rounded-md bg-transparent text-center font-medium tabular-nums outline-none focus-visible:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50", className)}
    />
  );
}
