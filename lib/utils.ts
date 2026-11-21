export { cn } from "cn"

/** Khmer digits ០–៩ → 0–9 (admins often type with a Khmer keyboard) */
export const latinDigits = (s: string) => s.replace(/[០-៩]/g, (d) => String(d.charCodeAt(0) - 0x17e0))

/** a row that can be dragged to reorder: animates into / out of the lifted look */
export const dragRow = "transition-[scale,box-shadow] duration-150 ease-out"
/** a table row being dragged: deep shadow + thin outline above the others (not bigger: a wider row made the table scroll sideways) */
export const dragLiftedRow = "relative z-10 bg-background shadow-xl ring-1 ring-border"
/** a list row being dragged: like a table row, and a little bigger */
export const dragLifted = `${dragLiftedRow} scale-[1.02] rounded-lg`
