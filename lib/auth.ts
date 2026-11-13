import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { prisma } from "@/lib/db";
import type { Role } from "@/lib/generated/prisma/client";
import { hasRole } from "@/lib/roles";

const COOKIE = "admin_session";
const SESSION_DAYS = 7;

/** visitor IP set by the host's edge (Railway and Vercel both send X-Real-IP); never X-Forwarded-For, which the visitor can fake */
export async function clientIp() {
  return (await headers()).get("x-real-ip")?.trim() || "unknown";
}

const sha256 = (token: string) => createHash("sha256").update(token).digest("hex");

/** `shopId` = open this shop right away (someone who belongs to just one) */
export async function createSession(userId: string, shopId: string | null = null) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  const h = await headers();
  await prisma.session.create({
    data: {
      id: sha256(token),
      userId,
      shopId,
      expiresAt,
      ip: await clientIp(),
      userAgent: h.get("user-agent")?.slice(0, 300) || null,
    },
  });

  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/admin",
    expires: expiresAt,
  });
}

export async function deleteSession() {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (token) await prisma.session.deleteMany({ where: { id: sha256(token) } });
  store.delete({ name: COOKIE, path: "/admin" });
}

/** the signed-in person; `shopId` = the shop this login is working in (null until one is picked on /admin/shops/) */
export type AdminUser = { id: string; name: string; email: string; isOwner: boolean; shopId: string | null; sessionId: string };

export const getCurrentUser = cache(async (): Promise<AdminUser | null> => {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const session = await prisma.session.findUnique({
    where: { id: sha256(token) },
    include: { user: { select: { id: true, name: true, email: true, isOwner: true, isActive: true } } },
  });
  if (!session || session.expiresAt < new Date() || !session.user.isActive) return null;
  const { id, name, email, isOwner } = session.user;
  return { id, name, email, isOwner, shopId: session.shopId, sessionId: session.id };
});

/** the signed-in person inside their current shop: role there ("owner" = super-admin) + the shop */
export type ShopUser = AdminUser & { role: Role; shop: { id: string; slug: string; name: string } };

/** current shop + role, or null (not signed in, no shop picked, or no longer a member of it) */
export const getShopUser = cache(async (): Promise<ShopUser | null> => {
  const user = await getCurrentUser();
  if (!user?.shopId) return null;
  const shop = await prisma.shop.findUnique({
    where: { id: user.shopId },
    select: { id: true, slug: true, settings: { select: { name: true } }, memberships: { where: { userId: user.id }, select: { role: true } } },
  });
  const role = user.isOwner ? "owner" : shop?.memberships[0]?.role;
  if (!shop || !role) return null;
  return { ...user, role, shop: { id: shop.id, slug: shop.slug, name: shop.settings?.name ?? shop.slug } };
});

/** whole-app pages (shop list): signed in is enough */
export async function requireLogin() {
  const user = await getCurrentUser();
  if (!user) redirect("/admin/login");
  return user;
}

/** every page and action inside a shop: signed in + a shop picked + allowed role. Filter every query by `shop.id`. */
export async function requireUser(roles?: Role[]) {
  if (!(await getCurrentUser())) redirect("/admin/login");
  const user = await getShopUser();
  if (!user) redirect("/admin/shops");
  if (!hasRole(user.role, roles)) redirect("/admin/orders"); // every role may see orders
  return user;
}

/** sets the shop this login works in (after checking access); false = not allowed */
export async function enterShop(shopId: string) {
  const user = await requireLogin();
  const allowed = user.isOwner
    ? await prisma.shop.count({ where: { id: shopId } })
    : await prisma.membership.count({ where: { userId: user.id, shopId } });
  if (!allowed) return false;
  await prisma.session.update({ where: { id: user.sessionId }, data: { shopId } });
  return true;
}
