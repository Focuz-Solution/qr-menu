export { cn } from "cn"

/** Khmer digits ០–៩ → 0–9 (admins often type with a Khmer keyboard) */
export const latinDigits = (s: string) => s.replace(/[០-៩]/g, (d) => String(d.charCodeAt(0) - 0x17e0))
