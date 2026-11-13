"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_LANG_COOKIE } from "@/i18n/request";
import { deleteSession, requireLogin } from "@/lib/auth";

export async function logout() {
  await deleteSession();
  redirect("/admin/login");
}

// Admin UI language (Khmer default). Setting the cookie re-renders the page in the new language.
export async function setAdminLang(lang: "km" | "en") {
  await requireLogin(); // also on "Your shops", before a shop is picked
  // path "/" (not "/admin"): it replaces an older copy with that path, and is read last, so it always wins
  // (shop pages ignore it — they use the shop's own language)
  (await cookies()).set(ADMIN_LANG_COOKIE, lang === "en" ? "en" : "km", {
    path: "/",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
  });
}
