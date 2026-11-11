"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Prisma, type Role } from "@/lib/generated/prisma/client";
import { hashPassword, MIN_PASSWORD } from "@/lib/password";
import type { ErrorCode, Result } from "@/lib/result";

// Staff accounts — owner only (plan/api.md).

const ROLES: Role[] = ["owner", "staff", "packer"];
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const isRole = (r: string): r is Role => (ROLES as string[]).includes(r);

export async function createStaff(input: { name: string; email: string; role: string; password: string }): Promise<Result> {
  await requireUser(["owner"]);
  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  const fields: Record<string, ErrorCode> = {};
  if (!name || name.length > 80) fields.name = "required";
  if (!EMAIL.test(email)) fields.email = "badEmail";
  if (!isRole(input.role)) fields.role = "required";
  if (input.password.length < MIN_PASSWORD) fields.password = "weakPassword";
  if (Object.keys(fields).length) return { ok: false, error: "invalid", fields };

  try {
    await prisma.user.create({
      data: { name, email, role: input.role as Role, passwordHash: await hashPassword(input.password) },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { ok: false, error: "invalid", fields: { email: "emailTaken" } };
    }
    throw e;
  }
  revalidatePath("/admin/settings/staff");
  return { ok: true };
}

/** change role or enable/disable. Owners can't change themselves, so there is always one active owner (the one acting). */
export async function updateStaff(id: string, patch: { role?: string; isActive?: boolean }): Promise<Result> {
  const me = await requireUser(["owner"]);
  if (id === me.id) return { ok: false, error: "notAllowed" };
  if (patch.role !== undefined && !isRole(patch.role)) return { ok: false, error: "invalid" };

  const updated = await prisma.user.updateMany({
    where: { id },
    data: { ...(patch.role && { role: patch.role as Role }), ...(patch.isActive !== undefined && { isActive: patch.isActive }) },
  });
  if (!updated.count) return { ok: false, error: "notFound" };
  // disabled → signed out everywhere right away
  if (patch.isActive === false) await prisma.session.deleteMany({ where: { userId: id } });
  revalidatePath("/admin/settings/staff");
  return { ok: true };
}

/** new password + unlock; signs that person out on every device (except an owner resetting their own) */
export async function resetPassword(id: string, password: string): Promise<Result> {
  const me = await requireUser(["owner"]);
  if (password.length < MIN_PASSWORD) return { ok: false, error: "invalid", fields: { password: "weakPassword" } };

  const updated = await prisma.user.updateMany({
    where: { id },
    data: { passwordHash: await hashPassword(password), failedLogins: 0, lockedUntil: null },
  });
  if (!updated.count) return { ok: false, error: "notFound" };
  if (id !== me.id) await prisma.session.deleteMany({ where: { userId: id } });
  revalidatePath("/admin/settings/staff");
  return { ok: true };
}
