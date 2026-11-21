"use server";

import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { revalidateShop } from "@/lib/revalidate-shop";
import type { Result } from "@/lib/result";
import { checkSteps, rowKeys, type StepInput, type Tiers } from "./types";

// Wholesale admin: quantity price steps per product variant. The shop shows them (product page, checkout) and
// createOrder applies them, so every save rebuilds this shop's pages. Current shop only.

const MAX_STEPS = 5;

/** the product (this shop, not deleted) + its row keys + saved tiers, or null */
async function load(shopId: string, itemId: string) {
  const item = await prisma.item.findFirst({
    where: { id: String(itemId), shopId, deletedAt: null },
    select: { priceCents: true, variants: true, wholesale: { select: { tiers: true } } },
  });
  if (!item) return null;
  const variants = (Array.isArray(item.variants) ? item.variants : []) as { image: string; priceCents?: number }[];
  const prices: Record<string, number> = variants.length
    ? Object.fromEntries(variants.map((v) => [v.image, v.priceCents ?? item.priceCents]))
    : { "": item.priceCents };
  return { keys: rowKeys(variants), prices, tiers: (item.wholesale?.tiers ?? {}) as Tiers };
}

/** set the steps of some rows of a product ([] = remove them); other rows keep theirs */
export async function saveSteps(itemId: string, keys: string[], input: StepInput[]): Promise<Result> {
  const { shop } = await requireUser("menu.edit");
  const item = await load(shop.id, itemId);
  if (!item) return { ok: false, error: "notFound" };
  if (!Array.isArray(keys) || !keys.length || keys.some((k) => !item.keys.includes(k))) return { ok: false, error: "invalid" };
  if (!Array.isArray(input) || input.length > MAX_STEPS) return { ok: false, error: "invalid" };

  // same checks as the dialog shows live (types.ts → checkSteps), against these variants' prices from the database
  const { errors, steps } = checkSteps(input.map((x) => ({ minQty: String(x?.minQty ?? ""), mode: x?.mode === "amount" ? "amount" : "percent", value: String(x?.value ?? "") })), keys.map((k) => item.prices[k]));
  const bad = errors.find(Boolean);
  if (bad) return { ok: false, error: bad };

  // keep only rows the product still has (a removed variant's steps go with it)
  const tiers: Tiers = Object.fromEntries(Object.entries(item.tiers).filter(([k]) => item.keys.includes(k)));
  for (const k of keys) {
    if (steps.length) tiers[k] = steps;
    else delete tiers[k];
  }
  await prisma.wholesalePrice.upsert({
    where: { itemId },
    create: { itemId, shopId: shop.id, tiers },
    update: { tiers },
  });
  await revalidateShop(shop.id);
  return { ok: true };
}

/** turn a product's wholesale prices on / off (its steps are kept) */
export async function setWholesaleActive(itemId: string, isActive: boolean): Promise<Result> {
  const { shop } = await requireUser("menu.edit");
  if (!(await load(shop.id, itemId))) return { ok: false, error: "notFound" };
  await prisma.wholesalePrice.upsert({
    where: { itemId },
    create: { itemId, shopId: shop.id, isActive: !!isActive },
    update: { isActive: !!isActive },
  });
  await revalidateShop(shop.id);
  return { ok: true };
}
