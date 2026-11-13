"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { enterShop, requireLogin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Prisma } from "@/lib/generated/prisma/client";
import type { Result } from "@/lib/result";
import { isShopSlug } from "@/lib/shops";

// "Your shops" (plan/multi-tenant.md → Admin UI): open a shop, or (owner only) create one.

/** work in this shop (owner: any shop; others: their shops) → its dashboard */
export async function openShop(shopId: string) {
  if (!(await enterShop(shopId))) redirect("/admin/shops");
  // every admin page now shows another shop: drop the browser's cached pages, or the old shop stays until a reload
  revalidatePath("/admin", "layout");
  redirect("/admin/orders");
}

/** owner only: new shop + its settings row → opened right away; the page then goes to its Settings */
export async function createShop(input: { name: string; slug: string }): Promise<Result> {
  const user = await requireLogin();
  if (!user.isOwner) return { ok: false, error: "notAllowed" };
  const name = input.name.trim();
  const slug = input.slug.trim().toLowerCase();
  const fields: Record<string, "required" | "badSlug"> = {};
  if (!name || name.length > 80) fields.name = "required";
  if (!isShopSlug(slug)) fields.slug = "badSlug";
  if (Object.keys(fields).length) return { ok: false, error: "invalid", fields };

  try {
    const { id } = await prisma.shop.create({ data: { slug, settings: { create: { name } } }, select: { id: true } });
    await enterShop(id);
    revalidatePath("/admin", "layout"); // now working in the new shop (see openShop)
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return { ok: false, error: "invalid", fields: { slug: "slugTaken" } };
    throw e;
  }
  return { ok: true };
}
