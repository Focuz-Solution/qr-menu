"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { requireOwner } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isPermission } from "@/lib/permissions";
import type { Result } from "@/lib/result";

// Roles (Admin → Roles): the owner names roles and picks what each may do; shared by every shop.
const UUID = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
// people's menus, pages and buttons follow their role's permissions → every admin page is refreshed
const changed = () => revalidatePath("/admin", "layout");

/** a new role named "New role" (admin's language) with no permissions yet, at the end of the list */
export async function createRole(): Promise<Result<{ id: string }>> {
  await requireOwner();
  const name = (await getTranslations("admin.rolesPage"))("newRoleName");
  const last = await prisma.staffRole.aggregate({ _max: { sortOrder: true } });
  const { id } = await prisma.staffRole.create({ data: { name, permissions: [], sortOrder: (last._max.sortOrder ?? -1) + 1 } });
  changed();
  return { ok: true, data: { id } };
}

/** rename + the permissions it gives (unknown permission names are dropped) */
export async function saveRole(id: string, input: { name: string; permissions: string[] }): Promise<Result> {
  await requireOwner();
  if (!UUID.test(id)) return { ok: false, error: "notFound" };
  const name = typeof input.name === "string" ? input.name.trim() : "";
  if (!name || name.length > 40) return { ok: false, error: "invalid", fields: { name: "required" } };
  const permissions = [...new Set(Array.isArray(input.permissions) ? input.permissions.filter(isPermission) : [])];
  const { count } = await prisma.staffRole.updateMany({ where: { id }, data: { name, permissions } });
  if (!count) return { ok: false, error: "notFound" };
  changed();
  return { ok: true };
}

/** only a role nobody has (in any shop): move those people to another role first */
export async function deleteRole(id: string): Promise<Result> {
  await requireOwner();
  if (!UUID.test(id)) return { ok: false, error: "notFound" };
  if (await prisma.membership.count({ where: { roleId: id } })) return { ok: false, error: "roleInUse" };
  const { count } = await prisma.staffRole.deleteMany({ where: { id } });
  if (!count) return { ok: false, error: "notFound" };
  changed();
  return { ok: true };
}
