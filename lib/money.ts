/** "13" / "13.5" / "13.50" typed in a form → cents; "" → null; anything else → NaN (business rules: money in cents) */
export function toCents(value: string) {
  const v = value.trim();
  if (!v) return null;
  return /^\d+(\.\d{1,2})?$/.test(v) ? Math.round(Number(v) * 100) : NaN;
}
