import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { prisma } from "@/lib/db";
import type { Role } from "@/lib/generated/prisma/client";

const COOKIE = "admin_session";
const SESSION_DAYS = 7;
export const MAX_FAILED_LOGINS = 5;
export const LOCK_MINUTES = 15;

const sha256 = (token: string) => createHash("sha256").update(token).digest("hex");

export async function createSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  const h = await headers();
  await prisma.session.create({
    data: {
      id: sha256(token),
      userId,
      expiresAt,
      ip: h.get("x-forwarded-for")?.split(",")[0]?.trim() || null,
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

export type AdminUser = { id: string; name: string; email: string; role: Role };


export const getCurrentUser = cache(async (): Promise<AdminUser | null> => {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const session = await prisma.session.findUnique({
    where: { id: sha256(token) },
    include: { user: { select: { id: true, name: true, email: true, role: true, isActive: true } } },
  });
  if (!session || session.expiresAt < new Date() || !session.user.isActive) return null;
  const { id, name, email, role } = session.user;
  return { id, name, email, role };
});


export async function requireUser(roles?: Role[]) {
  const user = await getCurrentUser();
  if (!user) redirect("/admin/login/");
  if (roles && !roles.includes(user.role)) redirect("/admin/");
  return user;
}
