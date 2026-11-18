"use server";

import { requireUser } from "@/lib/auth";
import { revalidateShop } from "@/lib/revalidate-shop";
import { prisma } from "@/lib/db";
import { deliveryZones } from "@/lib/delivery";
import { deleteImageIfUnused, imageKey } from "@/lib/r2";
import { isPreset, presetLogo } from "./couriers";
import { toCents } from "@/lib/money";
import { cleanSteps } from "@/lib/orders";
import { isProvinceCode } from "@/lib/provinces";
import type { ErrorCode, Result } from "@/lib/result";
import type { ZoneInput } from "./types";

// Delivery zones — owner or the shop's admin, per shop (spec §3, §4.2 delivery_zones, business rule 17).
// A zone = an area (provinces) + its carriers. Each carrier name has at most one active rate per province,
// and one in the "everywhere else" zones, so checkout never shows the same carrier twice.

const MAX_CARRIERS = 10;
const MAX_STEPS = 10;
// money limits: a typo like 99999999 must be a form error, not a database overflow (Int columns)
const MAX_FEE_CENTS = 1_000_000; // $10,000
const MAX_FROM_CENTS = 10_000_000; // $100,000 (same as cleanSteps)

/** both cover a province, or both are "everywhere else" */
const overlap = (a: string[], b: string[]) => (!a.length && !b.length) || a.some((c) => b.includes(c));

/** carrier index → why it can't be active in these provinces (another active zone already has it there) */
async function clashes(shopId: string, id: string | null, codes: string[], names: string[]) {
  const others = (await deliveryZones(shopId, { activeOnly: true })).filter((z) => z.id !== id && overlap(codes, z.provinceCodes));
  const fields: Record<string, ErrorCode> = {};
  names.forEach((name, i) => {
    if (others.some((z) => z.carriers.some((c) => c.name.toLowerCase() === name.toLowerCase())))
      fields[`carrier-${i}`] = codes.length ? "provinceTaken" : "fallbackExists";
  });
  return fields;
}

/** uploaded logos this zone used (its carriers, or its own before carriers), to clean up after a change */
async function zoneLogos(shopId: string, id: string) {
  const z = await prisma.deliveryZone.findFirst({ where: { id, shopId }, select: { courierLogo: true, carriers: { select: { logo: true } } } });
  return z ? [z.courierLogo, ...z.carriers.map((c) => c.logo)] : [];
}

export async function saveZone(id: string | null, input: ZoneInput): Promise<Result> {
  const { shop } = await requireUser("delivery.manage");
  const fields: Record<string, ErrorCode> = {};
  const name = String(input.name ?? "").trim();
  const provinceCodes = [...new Set(Array.isArray(input.provinceCodes) ? input.provinceCodes : [])].sort();
  const raw = Array.isArray(input.carriers) ? input.carriers.slice(0, MAX_CARRIERS + 1) : [];

  if (!name || name.length > 80) fields.name = "required";
  if (!provinceCodes.every(isProvinceCode)) fields.provinces = "invalid";
  if (!raw.length) fields.carriers = "carrierNeeded";
  if (raw.length > MAX_CARRIERS) fields.carriers = "invalid";

  const seen = new Set<string>();
  const carriers = raw.map((c, i) => {
    const key = `carrier-${i}`;
    const carrierName = String(c?.name ?? "").trim();
    const feeCents = toCents(String(c?.fee ?? ""));
    const eta = String(c?.eta ?? "").trim();
    const isCourier = c?.isCourier === true;
    // logo: a ready-made courier's own file, or our uploaded photo for an added courier; shop delivery has none
    const uploaded = isCourier && !isPreset(carrierName) && c?.logo ? String(c.logo) : null;
    // at most MAX_STEPS + 1 looked at: a huge list from a forged request is cut before any work
    const steps = (Array.isArray(c?.steps) ? c.steps.slice(0, MAX_STEPS + 1) : []).filter((s) => String(s?.from ?? "").trim() || String(s?.fee ?? "").trim());
    const stepCents = steps.map((s) => ({ fromCents: toCents(String(s?.from ?? "")), feeCents: toCents(String(s?.fee ?? "")) }));

    if (!carrierName || carrierName.length > 80) fields[key] = "required";
    else if (seen.has(carrierName.toLowerCase())) fields[key] = "duplicateCarrier";
    else if (feeCents === null || Number.isNaN(feeCents) || feeCents > MAX_FEE_CENTS) fields[key] = "badPrice";
    else if (eta.length > 60) fields[key] = "invalid";
    else if (uploaded && !imageKey(uploaded)) fields[key] = "badImage";
    else if (steps.length > MAX_STEPS) fields[key] = "invalid";
    // each step: an amount above $0 and a fee ($0 = free), no amount twice
    else if (stepCents.some((s) => !s.fromCents || s.fromCents > MAX_FROM_CENTS || s.feeCents === null || Number.isNaN(s.feeCents) || s.feeCents > MAX_FEE_CENTS)) fields[key] = "badPrice";
    else if (new Set(stepCents.map((s) => s.fromCents)).size !== stepCents.length) fields[key] = "duplicateStep";
    seen.add(carrierName.toLowerCase());

    return {
      name: carrierName,
      isCourier,
      logo: isCourier ? (isPreset(carrierName) ? presetLogo(carrierName) : uploaded) : null,
      eta,
      feeCents: feeCents ?? 0,
      feeSteps: cleanSteps(stepCents),
      // only a courier's driver can be paid on arrival; shop delivery is always charged in the order
      payDriver: isCourier && c?.payDriver === true,
      sortOrder: i,
    };
  });
  if (Object.keys(fields).length) return { ok: false, error: "invalid", fields };

  if (input.isActive) {
    const clash = await clashes(shop.id, id, provinceCodes, carriers.map((c) => c.name));
    if (Object.keys(clash).length) return { ok: false, error: "invalid", fields: clash };
  }

  const before = id ? await zoneLogos(shop.id, id) : [];
  // the zone + its carriers replaced in one go; the fields from before carriers are cleared
  const data = { name, provinceCodes, isActive: input.isActive === true, feeCents: 0, freeOverCents: null, isCourier: false, courierLogo: null, eta: "" };
  const saved = await prisma.$transaction(async (tx) => {
    let zoneId = id;
    if (zoneId) {
      const { count } = await tx.deliveryZone.updateMany({ where: { id: zoneId, shopId: shop.id }, data });
      if (!count) return false;
      await tx.deliveryCarrier.deleteMany({ where: { zoneId } });
    } else {
      const last = await tx.deliveryZone.aggregate({ where: { shopId: shop.id }, _max: { sortOrder: true } });
      zoneId = (await tx.deliveryZone.create({ data: { ...data, shopId: shop.id, sortOrder: (last._max.sortOrder ?? -1) + 1 }, select: { id: true } })).id;
    }
    await tx.deliveryCarrier.createMany({ data: carriers.map((c) => ({ ...c, zoneId: zoneId! })) });
    // one logo per added courier: its carriers in other zones show the new one too
    for (const c of carriers) {
      if (!c.isCourier || isPreset(c.name)) continue;
      await tx.deliveryCarrier.updateMany({ where: { zone: { shopId: shop.id }, isCourier: true, name: c.name }, data: { logo: c.logo } });
      await tx.deliveryZone.updateMany({ where: { shopId: shop.id, isCourier: true, name: c.name }, data: { courierLogo: c.logo } });
    }
    return true;
  });
  if (!saved) return { ok: false, error: "notFound" };

  // logos nothing uses any more (replaced or removed) leave the bucket
  for (const url of new Set(before)) await deleteImageIfUnused(url);
  await revalidateShop(shop.id); // admin list + this shop's checkout (delivery fees)
  return { ok: true };
}

export async function setZoneActive(id: string, isActive: boolean): Promise<Result> {
  const { shop } = await requireUser("delivery.manage");
  const zone = (await deliveryZones(shop.id)).find((z) => z.id === id);
  if (!zone) return { ok: false, error: "notFound" };
  if (isActive) {
    const clash = await clashes(shop.id, id, zone.provinceCodes, zone.carriers.map((c) => c.name));
    const first = Object.values(clash)[0];
    if (first) return { ok: false, error: first };
  }
  await prisma.deliveryZone.updateMany({ where: { id, shopId: shop.id }, data: { isActive } });
  await revalidateShop(shop.id); // admin list + this shop's checkout (delivery fees)
  return { ok: true };
}

/** old orders keep the carrier name and fee they were charged with, so deleting is safe */
export async function deleteZone(id: string): Promise<Result> {
  const { shop } = await requireUser("delivery.manage");
  const logos = await zoneLogos(shop.id, id);
  const { count } = await prisma.deliveryZone.deleteMany({ where: { id, shopId: shop.id } });
  if (!count) return { ok: false, error: "notFound" };
  for (const url of new Set(logos)) await deleteImageIfUnused(url);
  await revalidateShop(shop.id); // admin list + this shop's checkout (delivery fees)
  return { ok: true };
}
