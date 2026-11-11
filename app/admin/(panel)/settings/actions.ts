"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { ErrorCode, Result } from "@/lib/result";
import { isHex, textOn } from "@/lib/brand-colors";
import { deleteImage, imageKey } from "@/lib/r2";
import type { ShopInput } from "./types";

// Shop settings — owner only (spec §4.2 shops, §8.5 /admin/shop). One row, id = 1.
/** "" → null; https link → itself; anything else → undefined (invalid) */
function link(value: string) {
  const v = value.trim();
  if (!v) return null;
  try {
    return new URL(v).protocol === "https:" ? v : undefined;
  } catch {
    return undefined;
  }
}

export async function saveShopSettings(input: ShopInput): Promise<Result> {
  await requireUser(["owner"]);
  const fields: Record<string, ErrorCode> = {};
  const name = input.name.trim();
  const phone = input.contactPhone.trim();
  const urls = { telegramUrl: link(input.telegramUrl), facebookUrl: link(input.facebookUrl), tiktokUrl: link(input.tiktokUrl) };
  const orderPrefix = input.orderPrefix.trim().toUpperCase();
  const text = (v: string) => v.trim().slice(0, 200);
  const brandColor = input.brandColor.trim().toLowerCase();
  const language = input.language;
  const logoUrl = input.logoUrl.trim() || null;

  if (language !== "km" && language !== "en") fields.language = "required";
  if (!name || name.length > 80) fields.name = "required";
  if (phone && !/^[+\d][\d\s-]{5,20}$/.test(phone)) fields.contactPhone = "invalid";
  for (const [key, value] of Object.entries(urls)) if (value === undefined) fields[key] = "badUrl";
  if (!/^[A-Z0-9-]{1,10}$/.test(orderPrefix)) fields.orderPrefix = "invalid";
  if (brandColor && !isHex(brandColor)) fields.brandColor = "invalid";
  if (logoUrl && !imageKey(logoUrl)) fields.logoUrl = "badImage";
  if (Object.keys(fields).length) return { ok: false, error: "invalid", fields };

  const data = {
    name,
    contactPhone: phone || null,
    telegramUrl: urls.telegramUrl ?? null,
    facebookUrl: urls.facebookUrl ?? null,
    tiktokUrl: urls.tiktokUrl ?? null,
    address: text(input.address),
    orderPrefix,
    // "" = default theme (black buttons); the shop starts using these in P8
    brandColor: brandColor || null,
    brandText: brandColor ? textOn(brandColor) : null,
    language,
    logoUrl,
    notice: text(input.notice),
  };
  const before = await prisma.shopSettings.findUnique({ where: { id: 1 }, select: { logoUrl: true } });
  await prisma.shopSettings.upsert({ where: { id: 1 }, create: { id: 1, ...data }, update: data });
  if (before?.logoUrl && before.logoUrl !== logoUrl) await deleteImage(before.logoUrl); // replaced/removed logo
  // the shop reads language + header message from here → rebuild every page (both root layouts)
  revalidatePath("/", "layout");
  return { ok: true };
}
