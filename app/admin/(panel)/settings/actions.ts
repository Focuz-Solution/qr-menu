"use server";

import { revalidatePath } from "next/cache";
import { requireOwner, requireUser } from "@/lib/auth";
import { revalidateShop } from "@/lib/revalidate-shop";
import { prisma } from "@/lib/db";
import { Prisma } from "@/lib/generated/prisma/client";
import type { ErrorCode, Result } from "@/lib/result";
import { isHex, textOn } from "@/lib/brand-colors";
import { deleteImageIfUnused, imageKey } from "@/lib/r2";
import { isShopSlug } from "@/lib/shops";
import type { ShopInput } from "./types";

// Shop settings — owner or the shop's admin (spec §4.2 shops, §8.5 /admin/shop). One row per shop.
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

/** "" → null; a Google Maps https link (maps.app.goo.gl/…, google.com/maps/…, maps.google.com/…) → itself; else undefined */
function mapLink(value: string) {
  const v = value.trim();
  if (!v) return null;
  try {
    const { protocol, hostname: h, pathname: p } = new URL(v);
    // google.com, google.com.kh, google.co.uk, google.kh … — not google.com.evil.com
    const maps =
      h === "maps.app.goo.gl" ||
      /^maps\.google\.(com|[a-z]{2})(\.[a-z]{2})?$/.test(h) ||
      (/^(www\.)?google\.(com|[a-z]{2})(\.[a-z]{2})?$/.test(h) && p.startsWith("/maps")) ||
      (h === "goo.gl" && p.startsWith("/maps"));
    return protocol === "https:" && maps ? v : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Saves one settings card (Appearance, Shop details or Social links): only the fields that were sent
 * are checked and written, so the other cards' saved values stay as they are.
 */
export async function saveShopSettings(input: Partial<ShopInput>): Promise<Result> {
  const { shop: current } = await requireUser("settings.edit");
  const fields: Record<string, ErrorCode> = {};
  const data: Prisma.ShopSettingsUpdateInput = {};
  /** the field's text when it was sent, else undefined (not part of this card) */
  const get = (k: keyof ShopInput) => (typeof input[k] === "string" ? input[k] : undefined);
  const text = (v: string) => v.trim().slice(0, 200);

  // link address: lives on the shop, not its settings row; locked once the shop has an order
  const slug = get("slug")?.trim().toLowerCase();
  if (slug !== undefined && slug !== current.slug) {
    if (!isShopSlug(slug)) fields.slug = "badSlug";
    else if (await prisma.order.count({ where: { shopId: current.id }, take: 1 })) fields.slug = "slugLocked";
    else if (await prisma.shop.count({ where: { slug, id: { not: current.id } } })) fields.slug = "slugTaken";
  }

  const name = get("name")?.trim();
  if (name !== undefined) {
    if (!name || name.length > 80) fields.name = "required";
    data.name = name;
  }
  const phone = get("contactPhone")?.trim();
  if (phone !== undefined) {
    if (phone && !/^[+\d][\d\s-]{5,20}$/.test(phone)) fields.contactPhone = "invalid";
    data.contactPhone = phone || null;
  }
  const map = get("mapUrl");
  if (map !== undefined) {
    const url = mapLink(map);
    if (url === undefined) fields.mapUrl = "badMapUrl";
    data.mapUrl = url ?? null;
  }
  for (const key of ["telegramUrl", "facebookUrl", "tiktokUrl"] as const) {
    const value = get(key);
    if (value === undefined) continue;
    const url = link(value);
    if (url === undefined) fields[key] = "badUrl";
    data[key] = url ?? null;
  }
  const address = get("address");
  if (address !== undefined) data.address = text(address);
  const orderPrefix = get("orderPrefix")?.trim().toUpperCase();
  if (orderPrefix !== undefined) {
    if (!/^[A-Z0-9-]{1,10}$/.test(orderPrefix)) fields.orderPrefix = "invalid";
    data.orderPrefix = orderPrefix;
  }
  const brandColor = get("brandColor")?.trim().toLowerCase();
  if (brandColor !== undefined) {
    if (brandColor && !isHex(brandColor)) fields.brandColor = "invalid";
    // "" = default theme (black buttons)
    data.brandColor = brandColor || null;
    data.brandText = brandColor ? textOn(brandColor) : null;
  }
  const language = get("language");
  if (language !== undefined) {
    if (language !== "km" && language !== "en") fields.language = "required";
    data.language = language;
  }
  const layout = get("layout");
  if (layout !== undefined) {
    if (layout !== "scroll" && layout !== "filter") fields.layout = "required";
    data.layout = layout;
  }
  const logoUrl = get("logoUrl")?.trim();
  if (logoUrl !== undefined) {
    if (logoUrl && !imageKey(logoUrl)) fields.logoUrl = "badImage";
    data.logoUrl = logoUrl || null;
  }
  const notice = get("notice");
  if (notice !== undefined) data.notice = text(notice);
  if (Object.keys(fields).length) return { ok: false, error: "invalid", fields };

  if (slug !== undefined && slug !== current.slug) {
    try {
      await prisma.shop.update({ where: { id: current.id }, data: { slug } });
    } catch (e) {
      // taken a moment ago by another shop
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return { ok: false, error: "invalid", fields: { slug: "slugTaken" } };
      throw e;
    }
  }
  const before = await prisma.shopSettings.findUnique({ where: { shopId: current.id }, select: { logoUrl: true } });
  // the row is made with the shop ("New shop"); the create is only a safety net, named after the shop
  await prisma.shopSettings.upsert({
    where: { shopId: current.id },
    create: { ...(data as Prisma.ShopSettingsUncheckedCreateInput), shopId: current.id, name: (data.name as string | undefined) ?? current.name },
    update: data,
  });
  // replaced/removed logo
  if (logoUrl !== undefined && before?.logoUrl && before.logoUrl !== (logoUrl || null)) await deleteImageIfUnused(before.logoUrl);
  // the shop reads language, header message, logo… from here → rebuild this shop's pages (not every shop's)
  await revalidateShop(current.id);
  // renamed address: the old one's cached pages go too (it is a 404 now)
  if (slug !== undefined && slug !== current.slug) revalidatePath(`/${current.slug}`, "layout");
  return { ok: true };
}

/**
 * Show this shop at the app's main address (app.com/, /products/…, /checkout) — super-admin only, since it is
 * app-wide. At most one default shop: turning it on here turns it off for every other shop.
 */
export async function setDefaultShop(isDefault: boolean): Promise<Result> {
  const me = await requireOwner();
  await prisma.$transaction([
    prisma.shop.updateMany({ where: { isDefault: true, id: { not: me.shop.id } }, data: { isDefault: false } }),
    prisma.shop.update({ where: { id: me.shop.id }, data: { isDefault: isDefault === true } }),
  ]);
  revalidatePath("/", "layout"); // every shop page: the main address now shows another shop (or none)
  return { ok: true };
}
