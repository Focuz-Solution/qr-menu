"use server";

import { redirect } from "next/navigation";
import { clientIp, createSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getTranslations } from "next-intl/server";
import { DUMMY_HASH, verifyPassword } from "@/lib/password";
import { createFirstShop } from "@/lib/shops";

export type LoginState = { error: "badLogin" } | { error: "locked"; minutes: number } | undefined;

// 5 wrong passwords from one computer (IP) → that computer waits 15 minutes. Counted per IP, not per email,
// so a stranger guessing the owner's email can't lock the owner out.
const MAX_FAILS = 5;
const WAIT_MS = 15 * 60_000;
const fails = new Map<string, { count: number; until: number }>();

// same answer for unknown email or wrong password
export async function login(_: LoginState, form: FormData): Promise<LoginState> {
  const ip = await clientIp();
  const now = Date.now();
  const entry = fails.get(ip);
  if (entry && entry.until <= now) fails.delete(ip);
  else if (entry && entry.count >= MAX_FAILS) return { error: "locked", minutes: Math.ceil((entry.until - now) / 60_000) };

  // length caps: nobody's email/password is longer, and huge inputs would only waste server time
  const email = String(form.get("email") ?? "").trim().toLowerCase().slice(0, 254);
  const password = String(form.get("password") ?? "").slice(0, 256);
  const user = email ? await prisma.user.findUnique({ where: { email } }) : null;

  // always run the slow hash check, so an unknown email takes as long as a wrong password
  const passwordOk = await verifyPassword(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !user.isActive || !passwordOk) {
    const count = (fails.get(ip)?.count ?? 0) + 1;
    fails.set(ip, { count, until: now + WAIT_MS });
    if (fails.size > 10_000) for (const [k, v] of fails) if (v.until <= now) fails.delete(k);
    return count >= MAX_FAILS ? { error: "locked", minutes: WAIT_MS / 60_000 } : { error: "badLogin" };
  }

  fails.delete(ip);
  // one shop → straight into its dashboard; several → pick one on "Your shops";
  // the owner with no shop yet gets a first one made and lands on its Settings (name, logo)
  const [, , shops] = await Promise.all([
    prisma.user.update({ where: { id: user.id }, data: { failedLogins: 0, lockedUntil: null, lastLoginAt: new Date() } }),
    // housekeeping: expired sessions are never used again, so each login clears them out
    prisma.session.deleteMany({ where: { expiresAt: { lt: new Date() } } }),
    prisma.shop.findMany({
      where: user.isOwner ? {} : { memberships: { some: { userId: user.id } } },
      select: { id: true },
      take: 2,
    }),
  ]);
  const first = !shops.length && user.isOwner ? await createFirstShop((await getTranslations("admin.shops"))("defaultName")) : null;
  const only = first?.id ?? (shops.length === 1 ? shops[0].id : null);
  await createSession(user.id, only);
  redirect(first ? "/admin/settings" : only ? "/admin/orders" : "/admin/shops");
}
