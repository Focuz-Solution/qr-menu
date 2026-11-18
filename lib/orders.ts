// Order rules shared by the checkout page (preview) and createOrder (the real numbers). Pure functions.

/** a price step: orders of `fromCents` or more pay `feeCents` delivery (0 = free) */
export type FeeStep = { fromCents: number; feeCents: number };

/** one carrier the customer can pick at checkout (Shop delivery, Grab…) */
export type DeliveryOption = {
  id: string;
  name: string;
  isCourier: boolean;
  logo: string | null;
  eta: string;
  /** fee when no step applies */
  feeCents: number;
  /** lowest `fromCents` first */
  steps: FeeStep[];
  /** the customer may pay the driver themselves (then the order has no delivery fee) */
  payDriver: boolean;
};

/** a delivery area: its provinces (empty = everywhere else) and its carriers */
export type Zone = { id: string; provinceCodes: string[]; carriers: DeliveryOption[] };

/** carriers for a province: zones that list it first; none → the "everywhere else" zones */
export function optionsFor(zones: Zone[], provinceCode: string): DeliveryOption[] {
  if (!provinceCode) return [];
  const matches = zones.filter((zone) => zone.provinceCodes.includes(provinceCode));
  return (matches.length ? matches : zones.filter((zone) => !zone.provinceCodes.length)).flatMap((zone) => zone.carriers);
}

/** delivery fee in cents for this order subtotal: the highest step reached, else the base fee */
export function feeFor(option: DeliveryOption, subtotalCents: number) {
  let fee = option.feeCents;
  for (const step of option.steps) if (subtotalCents >= step.fromCents) fee = step.feeCents;
  return fee;
}

/** the next step that makes delivery cheaper ("add $12 more for free delivery"), or undefined */
export function nextStep(option: DeliveryOption, subtotalCents: number) {
  const now = feeFor(option, subtotalCents);
  return option.steps.find((step) => step.fromCents > subtotalCents && step.feeCents < now);
}

/** price steps from the database (JSON) or a form: valid ones only, lowest first, one per amount, at most 10 */
export function cleanSteps(raw: unknown): FeeStep[] {
  if (!Array.isArray(raw)) return [];
  const ok = (n: unknown): n is number => Number.isInteger(n) && (n as number) >= 0 && (n as number) <= 100_000_00;
  const byFrom = new Map<number, number>();
  for (const s of raw) {
    const { fromCents, feeCents } = (s ?? {}) as Record<string, unknown>;
    if (ok(fromCents) && fromCents > 0 && ok(feeCents)) byFrom.set(fromCents, feeCents);
  }
  return [...byFrom].sort(([a], [b]) => a - b).slice(0, 10).map(([fromCents, feeCents]) => ({ fromCents, feeCents }));
}

/** "11.556400,104.928200" from the checkout map link (…/maps?q=<lat>,<lng>); null for an older pasted link */
export const mapCoords = (url: string) => /[?&]q=(-?[\d.]+,-?[\d.]+)/.exec(url)?.[1] ?? null;

/**
 * Cambodian phone → "+855…" (E.164), else null.
 * Accepts "012 345 678", "0123456789", "+855 12 345 678", "85512345678": 8–9 digits after the leading 0 / 855.
 */
export function normalizePhone(raw: string) {
  const digits = raw.replace(/[^\d+]/g, "").replace(/^\+/, "");
  const local = digits.startsWith("855") ? digits.slice(3) : digits.startsWith("0") ? digits.slice(1) : null;
  return local && /^[1-9]\d{7,8}$/.test(local) ? `+855${local}` : null;
}

/** "yymmdd" of a moment in Cambodia (UTC+7, no daylight saving) */
export function cambodiaDay(at: Date) {
  return new Date(at.getTime() + 7 * 60 * 60 * 1000).toISOString().slice(2, 10).replace(/-/g, "");
}

/** "PB-" + "251110" + 1 → "PB-251110-0001" (the prefix is typed as is in Settings, separator included) */
export const orderNumber = (prefix: string, day: string, n: number) => `${prefix}${day}-${String(n).padStart(4, "0")}`;
