// Wholesale price steps (Admin → Menu → Wholesale): buying `minQty` or more of one cart line gives a lower unit price.
// Shared by the shop (product page, cart, checkout preview) and createOrder (the real numbers). Pure functions.

/** one step: `percent` off the line's normal price, or a fixed unit price `priceCents` */
export type Tier = { minQty: number; percent?: number; priceCents?: number };
/** a product's steps per row: the variant's photo url, or "" for a product without variants */
export type Tiers = Record<string, Tier[]>;

/** steps from the database (JSON): valid ones only, lowest quantity first, one per quantity */
export function cleanTiers(raw: unknown): Tier[] {
  if (!Array.isArray(raw)) return [];
  const byQty = new Map<number, Tier>();
  for (const s of raw) {
    const { minQty, percent, priceCents } = (s ?? {}) as Record<string, unknown>;
    if (!Number.isInteger(minQty) || (minQty as number) < 2) continue;
    if (Number.isInteger(priceCents) && (priceCents as number) > 0) byQty.set(minQty as number, { minQty: minQty as number, priceCents: priceCents as number });
    else if (typeof percent === "number" && percent > 0 && percent < 100) byQty.set(minQty as number, { minQty: minQty as number, percent });
  }
  return [...byQty.values()].sort((a, b) => a.minQty - b.minQty);
}

/** the steps of one line: its variant's photo; a product without variants uses "" */
export const tiersOf = (all: Tiers | undefined, hasVariants: boolean, variantImage: string | undefined) =>
  all?.[hasVariants ? (variantImage ?? "\0") : ""] ?? [];

/** the step `qty` reaches (the highest one at or below it), or undefined */
export const tierAt = (tiers: Tier[], qty: number) => tiers.filter((t) => qty >= t.minQty).at(-1);

/** unit price in cents with this step — never above the normal price */
export function tierUnitCents(baseCents: number, tier: Tier | undefined) {
  if (!tier) return baseCents;
  const cents = tier.priceCents ?? Math.round((baseCents * (100 - (tier.percent ?? 0))) / 100);
  return Math.min(cents, baseCents);
}
