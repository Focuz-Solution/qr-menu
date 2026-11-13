"use server";

import { createHash } from "node:crypto";
import { redirect } from "next/navigation";
import { clientIp, createSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getTranslations } from "next-intl/server";
import { DUMMY_HASH, verifyPassword } from "@/lib/password";
import { createFirstShop } from "@/lib/shops";
import { ensureBuiltInRoles } from "@/lib/staff-roles";

export type LoginState = { error: "badLogin" } | { error: "locked"; minutes: number } | undefined;

// 5 wrong passwords from one computer (IP) → that computer waits 15 minutes. Counted per IP, not per email,
// so a stranger guessing the owner's email can't lock the owner out. The count lives in the database
// (login_throttles), so every server instance on Vercel shares it.
const MAX_FAILS = 5;
const WAIT_MS = 15 * 60_000;

// same answer for unknown email or wrong password
export async function login(_: LoginState, form: FormData): Promise<LoginState> {
  const key = createHash("sha256").update(`login:${await clientIp()}`).digest("hex");
  const now = new Date();
  // Count this try BEFORE checking the password (one atomic increment), so tries sent at the same moment can't
  // all slip past the limit. A count older than 15 minutes starts again from 0. Signing in clears it below.
  await prisma.loginThrottle.updateMany({ where: { key, until: { lte: now } }, data: { fails: 0 } });
  const { fails, until } = await prisma.loginThrottle.upsert({
    where: { key },
    create: { key, fails: 1, until: new Date(+now + WAIT_MS) },
    update: { fails: { increment: 1 }, until: new Date(+now + WAIT_MS) }, // every try restarts the 15 minutes
    select: { fails: true, until: true },
  });
  const locked = { error: "locked", minutes: Math.ceil((+until - +now) / 60_000) } as const;
  if (fails > MAX_FAILS) return locked; // already used up: the password isn't even checked

  // length caps: nobody's email/password is longer, and huge inputs would only waste server time
  const email = String(form.get("email") ?? "").trim().toLowerCase().slice(0, 254);
  const password = String(form.get("password") ?? "").slice(0, 256);
  const user = email ? await prisma.user.findUnique({ where: { email } }) : null;

  // always run the slow hash check, so an unknown email takes as long as a wrong password
  const passwordOk = await verifyPassword(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !user.isActive || !passwordOk) return fails >= MAX_FAILS ? locked : { error: "badLogin" };

  // one shop → straight into its dashboard; several → pick one on "Your shops";
  // the owner with no shop yet gets a first one made and lands on its Settings (name, logo)
  const [, , , , shops] = await Promise.all([
    prisma.user.update({ where: { id: user.id }, data: { failedLogins: 0, lockedUntil: null, lastLoginAt: new Date() } }),
    // housekeeping: expired sessions are never used again, so each login clears them out
    prisma.session.deleteMany({ where: { expiresAt: { lt: new Date() } } }),
    // this computer's count is cleared; other computers' old counts (past their 15 minutes) go too
    // first sign-in after the roles update: built-in roles made + people moved onto them (one count once done)
    ensureBuiltInRoles(),
    prisma.loginThrottle.deleteMany({ where: { OR: [{ key }, { until: { lt: now } }] } }),
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
