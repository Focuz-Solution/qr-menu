"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { toCents, type DiscountType, salePrice } from "@/lib/money";
import { Badge } from "@/lib/generated/prisma/enums";
import type { ErrorCode, Result } from "@/lib/result";
import { deleteImageIfUnused, imageKey } from "@/lib/r2";
import type { ItemInput } from "./types";

// Menu admin (plan/api.md → Menu, plan/business-rules.md 1–11). Owner/admin + staff only; every query is limited to the current shop.

// refreshes the admin list and every shop page (they read the menu from the database)
const changed = () => revalidatePath("/", "layout");

/** "Lash lift kit (small)" → "lash-lift-kit-small"; Khmer-only names give "" → caller falls back */
function slugify(text: string) {
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/, "");
}

/** slug from the name, made unique with -2, -3 … (rule 5: never changes after creation) */
async function uniqueSlug(name: string, fallback: string, taken: (slug: string) => Promise<unknown>) {
  const root = slugify(name) || `${fallback}-${crypto.randomUUID().slice(0, 6)}`;
  for (let n = 1; ; n++) {
    const slug = n === 1 ? root : `${root}-${n}`;
    if (!(await taken(slug))) return slug;
  }
}

// ---------- categories ----------

/** New category named "ប្រភេទថ្មី" / "New category" (admin's language); the admin renames it afterwards. Hidden until shown (rule 2). */
export async function createCategory(): Promise<Result<{ id: string }>> {
  const { shop } = await requireUser("menu.edit");
  const name = (await getTranslations("admin.menu"))("newCategoryName");
  const slug = await uniqueSlug(name, "cat", (s) => prisma.category.findUnique({ where: { shopId_slug: { shopId: shop.id, slug: s } } }));
  const last = await prisma.category.aggregate({ where: { shopId: shop.id }, _max: { sortOrder: true } });
  const { id } = await prisma.category.create({
    data: { shopId: shop.id, slug, name, isVisible: false, sortOrder: (last._max.sortOrder ?? -1) + 1 },
  });
  changed();
  return { ok: true, data: { id } };
}

export async function updateCategory(id: string, patch: { name?: string; isVisible?: boolean }): Promise<Result> {
  const { shop } = await requireUser("menu.edit");
  const name = patch.name?.trim();
  if (name !== undefined && (!name || name.length > 80)) return { ok: false, error: "invalid", fields: { name: "required" } };

  const { count } = await prisma.category.updateMany({
    where: { id, shopId: shop.id },
    data: { name, isVisible: patch.isVisible },
  });
  if (!count) return { ok: false, error: "notFound" };
  changed();
  return { ok: true };
}

/** full new order of all categories (rule 1) */
export async function reorderCategories(ids: string[]): Promise<Result> {
  const { shop } = await requireUser("menu.edit");
  // every id must be one of this shop's categories (so the updates below can't touch another shop)
  const all = await prisma.category.findMany({ where: { shopId: shop.id }, select: { id: true } });
  if (ids.length !== all.length || new Set(ids).size !== ids.length || !all.every((c) => ids.includes(c.id))) {
    return { ok: false, error: "invalid" };
  }
  await prisma.$transaction(ids.map((id, i) => prisma.category.update({ where: { id }, data: { sortOrder: i } })));
  changed();
  return { ok: true };
}

/** only when it has no products (rule 3); deleted products still pointing at it are removed for good */
/** deletes the category and all its products (rule 3); old orders keep their own copy of names/prices */
export async function deleteCategory(id: string): Promise<Result> {
  const { shop } = await requireUser("menu.edit");
  const [, { count }] = await prisma.$transaction([
    prisma.item.deleteMany({ where: { categoryId: id, shopId: shop.id } }),
    prisma.category.deleteMany({ where: { id, shopId: shop.id } }),
  ]);
  if (!count) return { ok: false, error: "notFound" };
  changed();
  return { ok: true };
}

// ---------- products ----------

/** create (id = null) or edit a product (rules 5–8) */
export async function saveItem(id: string | null, input: ItemInput): Promise<Result<{ id: string }>> {
  const { shop } = await requireUser("menu.edit");
  const fields: Record<string, ErrorCode> = {};
  const name = input.name.trim();
  const originalCents = toCents(input.price);
  const discountType: DiscountType = input.discountType === "amount" ? "amount" : "percent";
  // "sale" is no longer a badge choice — the discount itself shows the Sale pill
  const badge = Object.hasOwn(Badge, input.badge) && input.badge !== "sale" ? (input.badge as Badge) : null;
  const images = [...new Set(input.images.map((u) => u.trim()).filter(Boolean))];

  if (!name || name.length > 200) fields.name = "required";
  // the product being edited and the chosen category (both of this shop), in one round trip
  const [current, category] = await Promise.all([
    id ? prisma.item.findFirst({
      where: { id, shopId: shop.id, deletedAt: null },
      select: { categoryId: true, images: { orderBy: { sortOrder: "asc" }, select: { url: true } } },
    }) : null,
    // not a uuid (e.g. no category picked) → "required", not a database error
    /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(input.categoryId)
      ? prisma.category.findFirst({ where: { id: input.categoryId, shopId: shop.id }, select: { id: true } })
      : null,
  ]);
  if (id && !current) return { ok: false, error: "notFound" };
  const oldImages = current?.images.map((i) => i.url) ?? [];
  if (images.some((u) => !oldImages.includes(u) && !imageKey(u))) fields.images = "badImage";
  if (originalCents === null || Number.isNaN(originalCents)) fields.price = "badPrice";
  // the discount is re-worked out here from the price — the browser's preview is never trusted
  const sale = originalCents === null || Number.isNaN(originalCents) ? null : salePrice(originalCents, discountType, input.discount);
  if (sale === "bad") fields.discount = discountType === "percent" ? "badPercent" : "badPrice";
  else if (sale === "tooHigh") fields.discount = "discountTooHigh";
  const discountCents = typeof sale === "number" ? sale : null;
  if (!category) fields.categoryId = "required";
  if (Object.keys(fields).length) return { ok: false, error: "invalid", fields };

  const data = {
    name,
    brand: input.brand.trim().slice(0, 80) || null,
    categoryId: input.categoryId,
    // on sale: the customer pays the discount, the original shows crossed out (rule 6)
    priceCents: discountCents ?? originalCents!,
    compareAtCents: discountCents !== null ? originalCents : null,
    badge,
    isAvailable: input.isAvailable,
    isVisible: input.isVisible,
    description: input.description.trim().slice(0, 5000),
  };
  const nextSort = async () =>
    ((await prisma.item.aggregate({ where: { shopId: shop.id, categoryId: input.categoryId }, _max: { sortOrder: true } }))._max.sortOrder ?? -1) + 1;

  if (!id) {
    const slug = await uniqueSlug(name, "item", (s) => prisma.item.findUnique({ where: { shopId_slug: { shopId: shop.id, slug: s } } }));
    const created = await prisma.item.create({
      data: { ...data, shopId: shop.id, slug, sortOrder: await nextSort(), images: { create: images.map((url, i) => ({ url, sortOrder: i })) } },
    });
    changed();
    return { ok: true, data: { id: created.id } };
  }

  // moved to another category → goes to the end of it (`current` above already checked it's this shop's product)
  await prisma.item.update({
    where: { id },
    data: {
      ...data,
      ...(current?.categoryId !== input.categoryId && { sortOrder: await nextSort() }),
      // photos changed (added, removed, reordered) → rewrite the rows in the new order
      ...(images.join() !== oldImages.join() && { images: { deleteMany: {}, create: images.map((url, i) => ({ url, sortOrder: i })) } }),
    },
  });
  // removed photos: delete the files, unless another product / logo (any shop) or an old order still shows one
  await Promise.all(oldImages.filter((u) => !images.includes(u)).map(deleteImageIfUnused));
  changed();
  return { ok: true, data: { id } };
}

/** quick switches on the card: in stock / visible on the shop */
export async function setItemFlags(id: string, patch: { isAvailable?: boolean; isVisible?: boolean }): Promise<Result> {
  const { shop } = await requireUser("menu.edit");
  const { count } = await prisma.item.updateMany({
    where: { id, shopId: shop.id, deletedAt: null },
    data: { isAvailable: patch.isAvailable, isVisible: patch.isVisible },
  });
  if (!count) return { ok: false, error: "notFound" };
  changed();
  return { ok: true };
}

/** soft delete: gone from the shop and admin, old orders keep their copy (rule 10) */
export async function deleteItem(id: string): Promise<Result> {
  const { shop } = await requireUser("menu.edit");
  const { count } = await prisma.item.updateMany({ where: { id, shopId: shop.id, deletedAt: null }, data: { deletedAt: new Date() } });
  if (!count) return { ok: false, error: "notFound" };
  changed();
  return { ok: true };
}
