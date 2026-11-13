"use server";

import { revalidatePath } from "next/cache";
import { requireOwner, requireUser, type ShopUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Prisma } from "@/lib/generated/prisma/client";
import { hashPassword, MIN_PASSWORD } from "@/lib/password";
import { within } from "@/lib/permissions";
import type { ErrorCode, Result } from "@/lib/result";
import { membershipPermissions } from "@/lib/staff-roles";

// People of the current shop — anyone whose role has "users.manage" (and the owner).
// Nobody gives a role stronger than their own, or manages someone whose role is stronger, or (unless they're
// the owner) someone who also works in another shop. Only the owner makes owners and sets someone's shops.

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
/** what the role picker sends for "Owner" (every shop, every permission) — not a role row */
const OWNER = "owner";
const done = () => revalidatePath("/admin/users");

/** the role `roleId` if `me` may give it (exists, and not stronger than me), else null */
async function givableRole(me: ShopUser, roleId: string) {
  if (!UUID.test(roleId)) return null;
  const role = await prisma.staffRole.findUnique({ where: { id: roleId }, select: { id: true, key: true, permissions: true } });
  return role && (me.isOwner || within(role.permissions, me.permissions)) ? role : null;
}

/**
 * Someone `me` may manage: not yourself; an owner only by an owner. The owner may manage anyone (also people
 * not in this shop: `here` = false). Anyone else only people who work in this shop alone, with a role no
 * stronger than theirs. null = not allowed / not found.
 */
async function manageable(me: ShopUser, userId: string) {
  if (userId === me.id || !UUID.test(userId)) return null;
  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      isOwner: true,
      _count: { select: { memberships: true } },
      memberships: { where: { shopId: me.shop.id }, select: { role: true, staffRole: { select: { permissions: true } } } },
    },
  });
  if (!target) return null;
  if (target.isOwner) return me.isOwner ? { isOwner: true, here: false } : null;
  const member = target.memberships[0];
  if (me.isOwner) return { isOwner: false, here: !!member };
  if (!member) return null;
  if (target._count.memberships > 1 || !within(membershipPermissions(member), me.permissions)) return null;
  return { isOwner: false, here: true };
}

export async function createStaff(input: { name: string; email: string; roleId: string; password: string }): Promise<Result> {
  const me = await requireUser("users.manage");
  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  const makeOwner = input.roleId === OWNER;
  const fields: Record<string, ErrorCode> = {};
  if (!name || name.length > 80) fields.name = "required";
  if (!EMAIL.test(email)) fields.email = "badEmail";
  const role = makeOwner ? null : await givableRole(me, input.roleId);
  if (makeOwner ? !me.isOwner : !role) fields.role = "required";
  if (input.password.length < MIN_PASSWORD) fields.password = "weakPassword";
  if (Object.keys(fields).length) return { ok: false, error: "invalid", fields };

  // an account that already exists: the owner can add it to this shop, or make it an owner (its password stays as it is)
  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true, isOwner: true } });
  if (existing) {
    if (!me.isOwner || existing.isOwner) return { ok: false, error: "invalid", fields: { email: "emailTaken" } };
    if (makeOwner) {
      await prisma.user.update({ where: { id: existing.id }, data: { isOwner: true } });
      done();
      return { ok: true };
    }
    try {
      await prisma.membership.create({ data: { userId: existing.id, shopId: me.shop.id, roleId: role!.id } });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return { ok: false, error: "invalid", fields: { email: "emailTaken" } };
      throw e;
    }
    done();
    return { ok: true };
  }

  try {
    await prisma.user.create({
      // owner = every shop (no membership); anyone else belongs to this shop with the chosen role
      data: {
        name,
        email,
        passwordHash: await hashPassword(input.password),
        ...(makeOwner ? { isOwner: true } : { memberships: { create: { shopId: me.shop.id, roleId: role!.id } } }),
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
export async function updateStaff(id: string, patch: { roleId?: string; isActive?: boolean }): Promise<Result> {
  const me = await requireUser("users.manage");
  const target = await manageable(me, id);
  if (!target) return { ok: false, error: id === me.id ? "notAllowed" : "notFound" };

  if (patch.roleId !== undefined) {
    // an owner's access isn't a role in a shop: it can't be changed here (only enabled / disabled / new password)
    if (target.isOwner) return { ok: false, error: "notAllowed" };
    const role = await givableRole(me, patch.roleId);
    if (!role) return { ok: false, error: "invalid" };
    // not in this shop yet (only the owner gets here): picking a role adds them to it
    await prisma.membership.upsert({
      where: { userId_shopId: { userId: id, shopId: me.shop.id } },
      create: { userId: id, shopId: me.shop.id, roleId: role.id },
      update: { roleId: role.id },
    });
  }
  if (patch.isActive !== undefined) {
    await prisma.user.update({ where: { id }, data: { isActive: patch.isActive === true } });
    // disabled → signed out everywhere right away
    if (!patch.isActive) await prisma.session.deleteMany({ where: { userId: id } });
  }
  done();
  return { ok: true };
}

/** new password + unlock; signs that person out on every device (except yourself resetting your own) */
export async function resetPassword(id: string, password: string): Promise<Result> {
  const me = await requireUser("users.manage");
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
  const me = await requireUser("users.manage");
  const target = await manageable(me, id);
  if (!target) return { ok: false, error: id === me.id ? "notAllowed" : "notFound" };

  if (target.isOwner) {
    await prisma.user.delete({ where: { id } }); // sessions + memberships go with it
  } else if (!target.here) {
    return { ok: false, error: "notFound" }; // not in this shop: the owner changes their shops with the Shops dialog
  } else {
    await prisma.membership.delete({ where: { userId_shopId: { userId: id, shopId: me.shop.id } } });
    const elsewhere = await prisma.membership.count({ where: { userId: id } });
    if (!elsewhere) await prisma.user.delete({ where: { id } });
  }
  done();
  return { ok: true };
}

/**
 * Owner only: the shops someone works in and their role in each (replaces the old list). At least one shop;
 * owners have every shop already, so they aren't set here. Their open sessions in a removed shop lose it
 * (they pick another shop on their next page).
 */
export async function setUserShops(userId: string, shops: { shopId: string; roleId: string }[]): Promise<Result> {
  const me = await requireOwner();
  if (userId === me.id || !UUID.test(userId)) return { ok: false, error: "notAllowed" };
  const list = Array.isArray(shops) ? shops.filter((s) => UUID.test(s?.shopId) && UUID.test(s?.roleId)) : [];
  if (!list.length || list.length !== shops.length || new Set(list.map((s) => s.shopId)).size !== list.length) {
    return { ok: false, error: "invalid", fields: { shops: "required" } };
  }

  const [user, shopCount, roleCount] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { isOwner: true } }),
    prisma.shop.count({ where: { id: { in: list.map((s) => s.shopId) } } }),
    prisma.staffRole.count({ where: { id: { in: [...new Set(list.map((s) => s.roleId))] } } }),
  ]);
  if (!user || user.isOwner) return { ok: false, error: "notFound" };
  if (shopCount !== list.length || roleCount !== new Set(list.map((s) => s.roleId)).size) return { ok: false, error: "invalid" };

  const shopIds = list.map((s) => s.shopId);
  await prisma.$transaction([
    prisma.membership.deleteMany({ where: { userId, shopId: { notIn: shopIds } } }),
    ...list.map(({ shopId, roleId }) =>
      prisma.membership.upsert({
        where: { userId_shopId: { userId, shopId } },
        create: { userId, shopId, roleId },
        update: { roleId },
      }),
    ),
    // signed in to a shop they no longer work in → no shop picked (the shop list asks again)
    prisma.session.updateMany({ where: { userId, shopId: { notIn: shopIds } }, data: { shopId: null } }),
  ]);
  revalidatePath("/admin", "layout");
  return { ok: true };
}
