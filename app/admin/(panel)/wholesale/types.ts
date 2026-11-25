import { toCents } from "@/lib/money";
import type { ErrorCode } from "@/lib/result";
import { MAX_QTY } from "@/lib/orders";
import { tierUnitCents } from "@/lib/wholesale";
import { variantIdAt } from "@/lib/variants";

// Wholesale page data (prices in cents). A "row" is one variant, or the product itself when it has no variants.

/** one quantity step: buying `minQty` or more → `percent` off, or a fixed unit price `priceCents` */
export type Step = { minQty: number; percent?: number; priceCents?: number };
/** a step as typed in the dialog: value is a percent ("10") or a new unit price in dollars ("40.50") */
export type StepInput = { minQty: string; mode: "percent" | "amount"; value: string };

export type WholesaleRow = { key: string; label: string; code: string; image: string | null; priceCents: number; steps: Step[] };
export type WholesaleItem = { id: string; name: string; image: string | null; priceCents: number; variantCount: number; isActive: boolean; rows: WholesaleRow[] };

/** saved steps per row key (variant id from lib/variants.ts, "" = the product) */
export type Tiers = Record<string, Step[]>;

/** keys a product's rows use: one per variant (its id), else "" for the product itself */
export const rowKeys = (variants: { id?: string }[]) => (variants.length ? variants.map(variantIdAt) : [""]);

/** unit price of a row with this step — the same rule the shop and checkout use (never above the normal price) */
export const stepPrice = (cents: number, step: Pick<Step, "percent" | "priceCents">) => tierUnitCents(cents, { minQty: 0, ...step });

/** a step's quantity goes up to what one cart line can hold (lib/orders, checked again at checkout) */
export { MAX_QTY };

/** one typed step as a rule (quantity not checked), or null while the value isn't valid */
export function parseValue(s: StepInput): Pick<Step, "percent" | "priceCents"> | null {
  const v = s.value.trim();
  if (s.mode === "amount") {
    const c = toCents(v);
    return c && !Number.isNaN(c) ? { priceCents: c } : null;
  }
  return /^\d+(\.\d{1,2})?$/.test(v) && Number(v) > 0 && Number(v) < 100 ? { percent: Number(v) } : null;
}

/**
 * Checks the typed steps against the ticked variants' normal prices (cents). Shared by the dialog (live, per row)
 * and saveSteps (the real check), so both always agree. `errors[i]` = row i's problem; `steps` = sorted, only when
 * every row is fine. Rules: quantity 2–1,000,000 and not used twice; % 0–100 or a $ below every normal price; and each
 * step cheaper than the one before it, for every ticked variant.
 */
export function checkSteps(input: StepInput[], prices: number[]) {
  const lowest = Math.min(...prices);
  const qty = input.map((s) => Number(String(s.minQty).trim()));
  const errors: (ErrorCode | null)[] = input.map((s, i) => {
    const q = qty[i];
    if (!String(s.minQty).trim() || !Number.isInteger(q) || q < 2 || q > MAX_QTY) return "badQty";
    if (qty.filter((x) => x === q).length > 1) return "duplicateStep";
    const rule = parseValue(s);
    if (!rule) return s.mode === "amount" ? "badPrice" : "badPercent";
    if (rule.priceCents != null && rule.priceCents >= lowest) return "stepPriceHigh";
    return null;
  });
  // going up in quantity, the unit price must go down — for every ticked variant's price
  const ok = input.map((s, i) => ({ i, q: qty[i], rule: parseValue(s) })).filter((r) => !errors[r.i]).sort((a, b) => a.q - b.q);
  for (let k = 1; k < ok.length; k++) {
    if (prices.some((p) => stepPrice(p, ok[k].rule!) >= stepPrice(p, ok[k - 1].rule!))) errors[ok[k].i] = "stepNotCheaper";
  }
  const steps: Step[] = errors.some(Boolean) ? [] : ok.map((r) => ({ minQty: r.q, ...r.rule! }));
  return { errors, steps };
}
