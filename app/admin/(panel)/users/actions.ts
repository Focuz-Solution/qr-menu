"use server";

import { revalidatePath } from "next/cache";
import { requireUser, type ShopUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Prisma, type Role } from "@/lib/generated/prisma/client";
import { hashPassword, MIN_PASSWORD } from "@/lib/password";
import type { ErrorCode, Result } from "@/lib/result";
import { SHOP_ROLES } from "@/lib/roles";

// People of the current shop — owner or the shop's admin (plan/multi-tenant.md → Roles).
// Only the owner gives or changes the "admin" role, and touches someone who also works in another shop.

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/** roles `me` may give: staff / packer; an owner also gives "admin" (this shop) and "owner" (every shop) */
const canGive = (me: ShopUser, role: string): role is Role =>
  role === "owner" ? me.role === "owner" : (SHOP_ROLES as readonly string[]).includes(role) && (role !== "admin" || me.role === "owner");
const done = () => revalidatePath("/admin/users");

/**
 * Someone `me` may manage: not yourself; another owner only by an owner; in this shop: an admin only by an owner,
 * and (unless you're an owner) only people who work in this shop alone. null = not allowed / not found.
 */
async function manageable(me: ShopUser, userId: string) {
  if (userId === me.id) return null;
  const owner = await prisma.user.findFirst({ where: { id: userId, isOwner: true }, select: { id: true } });
  if (owner) return me.role === "owner" ? { role: "owner" as Role } : null;
  const member = await prisma.membership.findUnique({
    where: { userId_shopId: { userId, shopId: me.shop.id } },
    select: { role: true, user: { select: { _count: { select: { memberships: true } } } } },
  });
  if (!member) return null;
  if (me.role !== "owner" && (member.role === "admin" || member.user._count.memberships > 1)) return null;
  return member;
}

export async function createStaff(input: { name: string; email: string; role: string; password: string }): Promise<Result> {
  const me = await requireUser(["owner"]);
  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  const fields: Record<string, ErrorCode> = {};
  if (!name || name.length > 80) fields.name = "required";
  if (!EMAIL.test(email)) fields.email = "badEmail";
  if (!canGive(me, input.role)) fields.role = "required";
  if (input.password.length < MIN_PASSWORD) fields.password = "weakPassword";
  if (Object.keys(fields).length) return { ok: false, error: "invalid", fields };
  const role = input.role as Role;

  // an account that already exists: the owner can add it to this shop, or make it an owner (its password stays as it is)
  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true, isOwner: true } });
  if (existing) {
    if (me.role !== "owner" || existing.isOwner) return { ok: false, error: "invalid", fields: { email: "emailTaken" } };
    if (role === "owner") {
      await prisma.user.update({ where: { id: existing.id }, data: { isOwner: true } });
      done();
      return { ok: true };
    }
    try {
      await prisma.membership.create({ data: { userId: existing.id, shopId: me.shop.id, role } });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return { ok: false, error: "invalid", fields: { email: "emailTaken" } };
      throw e;
    }
    done();
    return { ok: true };
  }

  try {
    await prisma.user.create({
      // owner = every shop (no membership); anyone else belongs to this shop
      data: {
        name,
        email,
        passwordHash: await hashPassword(input.password),
        ...(role === "owner" ? { isOwner: true } : { memberships: { create: { shopId: me.shop.id, role } } }),
      },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { ok: false, error: "invalid", fields: { email: "emailTaken" } };
    }
    throw e;
  }
  done();
  return { ok: true };
}

/** change role (in this shop) or enable/disable the account. You can't change yourself. */
export async function updateStaff(id: string, patch: { role?: string; isActive?: boolean }): Promise<Result> {
  const me = await requireUser(["owner"]);
  if (patch.role !== undefined && (!canGive(me, patch.role) || patch.role === "owner")) return { ok: false, error: "invalid" };
  const target = await manageable(me, id);
  if (!target) return { ok: false, error: id === me.id ? "notAllowed" : "notFound" };
  // an owner's role isn't per shop: it can't be changed here (only enabled / disabled / new password)
  if (patch.role && target.role === "owner") return { ok: false, error: "notAllowed" };

  if (patch.role) await prisma.membership.update({ where: { userId_shopId: { userId: id, shopId: me.shop.id } }, data: { role: patch.role as Role } });
  if (patch.isActive !== undefined) {
    await prisma.user.update({ where: { id }, data: { isActive: patch.isActive } });
    // disabled → signed out everywhere right away
    if (!patch.isActive) await prisma.session.deleteMany({ where: { userId: id } });
  }
  done();
  return { ok: true };
}

/** new password + unlock; signs that person out on every device (except yourself resetting your own) */
export async function resetPassword(id: string, password: string): Promise<Result> {
  const me = await requireUser(["owner"]);
  if (password.length < MIN_PASSWORD) return { ok: false, error: "invalid", fields: { password: "weakPassword" } };
  if (id !== me.id && !(await manageable(me, id))) return { ok: false, error: "notFound" };

  await prisma.user.update({
    where: { id },
    data: { passwordHash: await hashPassword(password), failedLogins: 0, lockedUntil: null },
  });
  if (id !== me.id) await prisma.session.deleteMany({ where: { userId: id } });
  done();
  return { ok: true };
}

/**
 * Delete: an owner's account goes away (only an owner may, never yourself); anyone else leaves this shop,
 * and their account goes too once they're in no shop at all. Old orders keep their history (actor → empty).
 */
export async function deleteStaff(id: string): Promise<Result> {
  const me = await requireUser(["owner"]);
  const target = await manageable(me, id);
  if (!target) return { ok: false, error: id === me.id ? "notAllowed" : "notFound" };

  if (target.role === "owner") {
    await prisma.user.delete({ where: { id } }); // sessions + memberships go with it
  } else {
    await prisma.membership.delete({ where: { userId_shopId: { userId: id, shopId: me.shop.id } } });
    const elsewhere = await prisma.membership.count({ where: { userId: id } });
    if (!elsewhere) await prisma.user.delete({ where: { id } });
  }
  done();
  return { ok: true };
}
