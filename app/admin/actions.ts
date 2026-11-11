"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_LANG_COOKIE } from "@/i18n/request";
import { deleteSession, requireUser } from "@/lib/auth";

export async function logout() {
  await deleteSession();
  redirect("/admin/login/");
}

// Admin UI language (Khmer default). Setting the cookie re-renders the page in the new language.
export async function setAdminLang(lang: "km" | "en") {
  await requireUser();
  (await cookies()).set(ADMIN_LANG_COOKIE, lang === "en" ? "en" : "km", {
    path: "/admin",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
  });
}
