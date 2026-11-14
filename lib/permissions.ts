// What a person may do inside a shop. A role (Admin → Roles, shared by every shop) is a named list of these;
// the owner (super-admin, User.isOwner) may do everything. Everyone in a shop can see its orders and settings.
// Used by the server (lib/auth.ts: requireUser(permission)) and the UI (hide what someone can't use).

export const PERMISSIONS = [
  "orders.status", // move an order to the next step (confirm, pack, ship, deliver, cancel) — also the Telegram Confirm button
  "orders.delete", // delete an order for good
  "menu.edit", // categories, products, photos
  "delivery.manage", // delivery zones and fees
  "telegram.manage", // the shop's Telegram bot, group and buttons
  "users.manage", // people of this shop: add, role, password, disable, remove
  "settings.edit", // shop details, appearance, links, logo
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export const isPermission = (p: unknown): p is Permission => (PERMISSIONS as readonly unknown[]).includes(p);

/** the three built-in roles (made from the old fixed ones; the owner can rename and change them) */
export const BUILT_IN_ROLES = {
  admin: [...PERMISSIONS],
  staff: ["orders.status", "menu.edit"],
  packer: ["orders.status"],
} as const satisfies Record<string, readonly Permission[]>;

export type BuiltInRole = keyof typeof BUILT_IN_ROLES;

/** someone who may (owner, or their role in this shop has the permission) */
export function can(user: { isOwner: boolean; permissions: readonly Permission[] }, permission: Permission) {
  return user.isOwner || user.permissions.includes(permission);
}

/** every permission in `subset` is also in `of` (a person may only give / manage roles that aren't stronger than their own) */
export const within = (subset: readonly string[], of: readonly string[]) => subset.every((p) => of.includes(p));
