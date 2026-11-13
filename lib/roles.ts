import type { Role } from "@/lib/generated/prisma/enums";

/**
 * Who may use a page/action. "owner" (super-admin) always may; "owner" in the list also lets a shop's
 * admin in (admin = owner powers inside that one shop). Used by the server (lib/auth.ts) and the sidebar.
 */
export function hasRole(role: Role, roles?: readonly Role[]) {
  return !roles || role === "owner" || roles.includes(role) || (role === "admin" && roles.includes("owner"));
}

/** roles a shop's people can have (owner is app-wide, set on the user, never per shop) */
export const SHOP_ROLES = ["admin", "staff", "packer"] as const satisfies readonly Role[];
