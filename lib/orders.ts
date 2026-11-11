// Order rules shared by the checkout page (preview) and createOrder (the real numbers). Pure functions.

/** a delivery zone as the checkout needs it */
export type Zone = { id: string; name: string; provinceCodes: string[]; feeCents: number; freeOverCents: number | null; eta: string };

/** Explicit coverage takes precedence over the fallback services. */
export function zonesFor(zones: Zone[], provinceCode: string) {
  if (!provinceCode) return [];
  const matches = zones.filter((zone) => zone.provinceCodes.includes(provinceCode));
  return matches.length ? matches : zones.filter((zone) => !zone.provinceCodes.length);
}

/** delivery fee in cents: free from `freeOverCents` */
export const feeFor = (zone: Zone, subtotalCents: number) =>
  zone.freeOverCents != null && subtotalCents >= zone.freeOverCents ? 0 : zone.feeCents;

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
