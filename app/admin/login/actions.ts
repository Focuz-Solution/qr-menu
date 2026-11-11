"use server";

import { redirect } from "next/navigation";
import { clientIp, createSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { DUMMY_HASH, verifyPassword } from "@/lib/password";

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

  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
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
  await prisma.user.update({
    where: { id: user.id },
    data: { failedLogins: 0, lockedUntil: null, lastLoginAt: new Date() },
  });
  await createSession(user.id);
  redirect("/admin/");
}
