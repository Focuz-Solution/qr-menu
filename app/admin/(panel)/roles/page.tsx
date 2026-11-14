import { requireOwner } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { allRoles, ensureBuiltInRoles } from "@/lib/staff-roles";
import { RolesManager } from "./RolesManager";

// Admin → Roles (owner only): the roles people can get in any shop, and what each may do
export default async function RolesPage() {
  await requireOwner();
  await ensureBuiltInRoles(); // the built-in Shop admin / Staff / Packer exist before anything else
  const [roles, counts] = await Promise.all([
    allRoles(),
    prisma.membership.groupBy({ by: ["roleId"], _count: { _all: true } }),
  ]);
  return (
    <RolesManager
      roles={roles.map((r) => ({ id: r.id, name: r.name, permissions: r.permissions, people: counts.find((c) => c.roleId === r.id)?._count._all ?? 0 }))}
    />
  );
}
