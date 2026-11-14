"use server";

import { requireUser } from "@/lib/auth";
import { revalidateShop } from "@/lib/revalidate-shop";
import { prisma } from "@/lib/db";
import { toCents } from "@/lib/money";
import { isProvinceCode } from "@/lib/provinces";
import type { ErrorCode, Result } from "@/lib/result";
import type { ZoneInput } from "./types";

// Delivery zones — owner or the shop's admin, per shop (spec §3, §4.2 delivery_zones, business rule 17).
// Each service name has at most one active rate per province and one fallback rate.

/** why these provinces can't be active in this zone, or null */
async function conflict(shopId: string, id: string | null, name: string, codes: string[]): Promise<ErrorCode | null> {
  const others = await prisma.deliveryZone.findMany({
    where: { shopId, isActive: true, name: { equals: name, mode: "insensitive" }, ...(id && { id: { not: id } }) },
    select: { provinceCodes: true },
  });
  if (!codes.length) return others.some((z) => !z.provinceCodes.length) ? "fallbackExists" : null;
  return others.some((z) => z.provinceCodes.some((c) => codes.includes(c))) ? "provinceTaken" : null;
}

export async function saveZone(id: string | null, input: ZoneInput): Promise<Result> {
  const { shop } = await requireUser("delivery.manage");
  const fields: Record<string, ErrorCode> = {};
  const name = input.name.trim();
  const feeCents = toCents(input.fee);
  const freeOverCents = toCents(input.freeOver);
  const provinceCodes = [...new Set(input.provinceCodes)].sort();

  if (!name || name.length > 80) fields.name = "required";
  if (feeCents === null || Number.isNaN(feeCents)) fields.fee = "badPrice";
  if (Number.isNaN(freeOverCents)) fields.freeOver = "badPrice";
  if (!provinceCodes.every(isProvinceCode)) fields.provinces = "invalid";
  if (Object.keys(fields).length) return { ok: false, error: "invalid", fields };

  if (input.isActive) {
    const clash = await conflict(shop.id, id, name, provinceCodes);
    if (clash) return { ok: false, error: "invalid", fields: { provinces: clash } };
  }

  const data = {
    name,
    provinceCodes,
    feeCents: feeCents!,
    freeOverCents,
    eta: input.eta.trim(),
    isActive: input.isActive,
  };
  if (id) {
    const { count } = await prisma.deliveryZone.updateMany({ where: { id, shopId: shop.id }, data });
    if (!count) return { ok: false, error: "notFound" };
  } else {
    const last = await prisma.deliveryZone.aggregate({ where: { shopId: shop.id }, _max: { sortOrder: true } });
    await prisma.deliveryZone.create({ data: { ...data, shopId: shop.id, sortOrder: (last._max.sortOrder ?? -1) + 1 } });
  }
  await revalidateShop(shop.id); // admin list + this shop's checkout (delivery fees)
  return { ok: true };
}

export async function setZoneActive(id: string, isActive: boolean): Promise<Result> {
  const { shop } = await requireUser("delivery.manage");
  const zone = await prisma.deliveryZone.findFirst({ where: { id, shopId: shop.id }, select: { name: true, provinceCodes: true } });
  if (!zone) return { ok: false, error: "notFound" };
  if (isActive) {
    const clash = await conflict(shop.id, id, zone.name, zone.provinceCodes);
    if (clash) return { ok: false, error: clash };
  }
  await prisma.deliveryZone.updateMany({ where: { id, shopId: shop.id }, data: { isActive } });
  await revalidateShop(shop.id); // admin list + this shop's checkout (delivery fees)
  return { ok: true };
}

/** old orders keep the zone name they were charged with, so deleting is safe */
export async function deleteZone(id: string): Promise<Result> {
  const { shop } = await requireUser("delivery.manage");
  const { count } = await prisma.deliveryZone.deleteMany({ where: { id, shopId: shop.id } });
  if (!count) return { ok: false, error: "notFound" };
  await revalidateShop(shop.id); // admin list + this shop's checkout (delivery fees)
  return { ok: true };
}
