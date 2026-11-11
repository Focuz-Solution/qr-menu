"use server";

import { redirect } from "next/navigation";
import { createSession, LOCK_MINUTES, MAX_FAILED_LOGINS } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { DUMMY_HASH, verifyPassword } from "@/lib/password";

export type LoginState = { error: "badLogin" } | { error: "locked"; minutes: number } | undefined;

// business rules 28–29: email + password, 5 wrong tries → locked 15 minutes, same answer for unknown email or wrong password
export async function login(_: LoginState, form: FormData): Promise<LoginState> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  const user = email ? await prisma.user.findUnique({ where: { email } }) : null;

  if (user?.lockedUntil && user.lockedUntil > new Date()) {
    return { error: "locked", minutes: Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60_000) };
  }

  // always run the slow hash check, so an unknown email takes as long as a wrong password
  const passwordOk = await verifyPassword(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !user.isActive || !passwordOk) {
    if (user) {
      const fails = user.failedLogins + 1;
      await prisma.user.update({
        where: { id: user.id },
        data:
          fails >= MAX_FAILED_LOGINS
            ? { failedLogins: 0, lockedUntil: new Date(Date.now() + LOCK_MINUTES * 60_000) }
            : { failedLogins: fails },
      });
    }
    return { error: "badLogin" };
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { failedLogins: 0, lockedUntil: null, lastLoginAt: new Date() },
  });
  await createSession(user.id);
  redirect("/admin/");
}
