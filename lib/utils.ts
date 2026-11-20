export { cn } from "cn"

/** Khmer digits ០–៩ → 0–9 (admins often type with a Khmer keyboard) */
export const latinDigits = (s: string) => s.replace(/[០-៩]/g, (d) => String(d.charCodeAt(0) - 0x17e0))

/** a row that can be dragged to reorder: animates into / out of the lifted look */
export const dragRow = "transition-[scale,box-shadow] duration-150 ease-out"
/** the row being dragged: pops out a little (bigger, deep shadow, thin outline) above the others */
export const dragLifted = "relative z-10 scale-[1.02] rounded-lg bg-background shadow-xl ring-1 ring-border"
