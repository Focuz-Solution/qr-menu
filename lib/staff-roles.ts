import "server-only";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/db";
import { BUILT_IN_ROLES, type BuiltInRole, isPermission, type Permission } from "@/lib/permissions";

/** a role as the admin pages use it */
export type StaffRoleRow = { id: string; name: string; permissions: Permission[]; key: string | null };

const clean = (permissions: string[]) => permissions.filter(isPermission);

/**
 * Makes sure the three built-in roles exist (Shop admin, Staff, Packer, named in the admin's language the first
 * time) and gives every person still on an old fixed role the matching built-in role. Runs when the owner or
 * someone who manages people opens Users or Roles; cheap once done (one count).
 */
export async function ensureBuiltInRoles() {
  const keys = Object.keys(BUILT_IN_ROLES) as BuiltInRole[];
  if ((await prisma.staffRole.count({ where: { key: { in: keys } } })) < keys.length) {
    const t = await getTranslations("admin.roles");
    await prisma.staffRole.createMany({
      data: keys.map((key, i) => ({ key, name: t(key), permissions: [...BUILT_IN_ROLES[key]], sortOrder: i })),
      skipDuplicates: true,
    });
  }
  if (await prisma.membership.count({ where: { roleId: null } })) {
    const roles = await prisma.staffRole.findMany({ where: { key: { in: keys } }, select: { id: true, key: true } });
    await prisma.$transaction(
      roles.map((r) => prisma.membership.updateMany({ where: { roleId: null, role: r.key as BuiltInRole }, data: { roleId: r.id } })),
    );
  }
}

/** every role, in the owner's order */
export async function allRoles(): Promise<StaffRoleRow[]> {
  const rows = await prisma.staffRole.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: { id: true, name: true, permissions: true, key: true },
  });
  return rows.map((r) => ({ ...r, permissions: clean(r.permissions) }));
}

/** a membership's permissions: its role's, or (old fixed role, not moved to a role yet) the built-in defaults */
export function membershipPermissions(m: { role: string; staffRole: { permissions: string[] } | null }): Permission[] {
  if (m.staffRole) return clean(m.staffRole.permissions);
  return m.role in BUILT_IN_ROLES ? [...BUILT_IN_ROLES[m.role as BuiltInRole]] : [];
}
