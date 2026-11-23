"use server";

import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { revalidateShop } from "@/lib/revalidate-shop";
import type { Result } from "@/lib/result";

// Sizes admin: the shop's list of sizes ("30 ml", "M"); products tick theirs in Admin → Menu. Current shop only.

const clean = (name: unknown) => (typeof name === "string" ? name.trim().slice(0, 40) : "");
const taken = (shopId: string, name: string, notId?: string) =>
  prisma.size.findFirst({ where: { shopId, name: { equals: name, mode: "insensitive" }, ...(notId && { id: { not: notId } }) }, select: { id: true } });

/** new size at the end of the list (= last on the product page) */
export async function createSize(input: string): Promise<Result<{ id: string; name: string }>> {
  const { shop } = await requireUser("menu.edit");
  const name = clean(input);
  if (!name) return { ok: false, error: "invalid", fields: { name: "required" } };
  if (await taken(shop.id, name)) return { ok: false, error: "invalid", fields: { name: "sizeTaken" } };
  const last = await prisma.size.aggregate({ where: { shopId: shop.id }, _max: { sortOrder: true } });
  const { id } = await prisma.size.create({ data: { shopId: shop.id, name, sortOrder: (last._max.sortOrder ?? -1) + 1 } });
  await revalidateShop(shop.id);
  return { ok: true, data: { id, name } };
}

/** rename: every product with this size shows the new name */
export async function renameSize(id: string, input: string): Promise<Result> {
  const { shop } = await requireUser("menu.edit");
  const name = clean(input);
  if (!name) return { ok: false, error: "invalid", fields: { name: "required" } };
  if (await taken(shop.id, name, id)) return { ok: false, error: "invalid", fields: { name: "sizeTaken" } };
  const { count } = await prisma.size.updateMany({ where: { id, shopId: shop.id }, data: { name } });
  if (!count) return { ok: false, error: "notFound" };
  await revalidateShop(shop.id);
  return { ok: true };
}

/** full new order of the shop's sizes (= the order on the product page) */
export async function reorderSizes(ids: string[]): Promise<Result> {
  const { shop } = await requireUser("menu.edit");
  // every id must be one of this shop's sizes (so the updates below can't touch another shop)
  const all = await prisma.size.findMany({ where: { shopId: shop.id }, select: { id: true } });
  if (!Array.isArray(ids) || ids.length !== all.length || new Set(ids).size !== ids.length || !all.every((s) => ids.includes(s.id))) {
    return { ok: false, error: "listChanged" }; // someone added / deleted a size meanwhile (or a forged list)
  }
  try {
    await prisma.$transaction(ids.map((id, i) => prisma.size.update({ where: { id }, data: { sortOrder: i } })));
  } catch {
    return { ok: false, error: "listChanged" }; // a size was deleted while saving: nothing is changed (one transaction)
  }
  await revalidateShop(shop.id);
  return { ok: true };
}

/** delete: products lose this size (their other sizes stay); old orders keep their own copy of the name */
export async function deleteSize(id: string): Promise<Result> {
  const { shop } = await requireUser("menu.edit");
  const { count } = await prisma.size.deleteMany({ where: { id, shopId: shop.id } });
  if (!count) return { ok: false, error: "notFound" };
  await revalidateShop(shop.id);
  return { ok: true };
}
