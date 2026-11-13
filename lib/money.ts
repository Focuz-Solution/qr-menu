/** "13" / "13.5" / "13.50" typed in a form → cents; "" → null; anything else → NaN (business rules: money in cents) */
export function toCents(value: string) {
  const v = value.trim();
  if (!v) return null;
  return /^\d+(\.\d{1,2})?$/.test(v) ? Math.round(Number(v) * 100) : NaN;
}

/** how the admin types a discount: "10" = 10 % off, "1.50" = $1.50 off */
export type DiscountType = "percent" | "amount";

/**
 * Sale price in cents from the original price and the typed discount (shared by the form preview and the save action).
 * "" → null (no discount); not a number / 0 → "bad"; the whole price or more → "tooHigh".
 */
export function salePrice(originalCents: number, type: DiscountType, value: string): number | null | "bad" | "tooHigh" {
  const v = value.trim();
  if (!v) return null;
  if (!/^\d+(\.\d{1,2})?$/.test(v) || Number(v) <= 0) return "bad";
  const cents = type === "percent" ? Math.round((originalCents * (100 - Number(v))) / 100) : originalCents - Math.round(Number(v) * 100);
  return cents <= 0 ? "tooHigh" : cents;
}
