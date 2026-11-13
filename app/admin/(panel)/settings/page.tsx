import { requireUser } from "@/lib/auth";
import { Kaushan_Script } from "next/font/google";
import { headers } from "next/headers";
import { prisma } from "@/lib/db";
import { appUrl } from "@/lib/app-url";
import { publicHost } from "@/lib/shops";
import { DefaultShop } from "./DefaultShop";
import { QrSection } from "./QrSection";
import { ShopSettingsForm } from "./ShopSettingsForm";

// brush script for the shop name on the QR card
const script = Kaushan_Script({ weight: "400", subsets: ["latin"] });

export default async function ShopSettingsPage() {
  const me = await requireUser();
  const owner = me.role === "owner" || me.role === "admin"; // may edit the shop's settings
  const [row, orders, defaultShop] = await Promise.all([
    prisma.shopSettings.findUnique({ where: { shopId: me.shop.id } }),
    // the link address locks once customers have ordered (their links / printed QR codes use it)
    prisma.order.count({ where: { shopId: me.shop.id }, take: 1 }),
    // super-admin: which shop the main address shows now (this one, another one, or none)
    me.role === "owner"
      ? prisma.shop.findFirst({ where: { isDefault: true }, select: { id: true, slug: true, settings: { select: { name: true } } } })
      : null,
  ]);

  const values = {
    name: row?.name ?? "",
    slug: me.shop.slug,
    contactPhone: row?.contactPhone ?? "",
    telegramUrl: row?.telegramUrl ?? "",
    facebookUrl: row?.facebookUrl ?? "",
    tiktokUrl: row?.tiktokUrl ?? "",
    address: row?.address ?? "",
    mapUrl: row?.mapUrl ?? "",
    orderPrefix: row?.orderPrefix ?? "",
    brandColor: row?.brandColor ?? "",
    logoUrl: row?.logoUrl ?? "",
    language: row?.language ?? "",
    layout: row?.layout ?? "scroll",
    notice: row?.notice ?? "",
  };

  // QR code: the shop's public address — the site from the env (APP_BASE_URL / Vercel), else the address the admin is open on
  const h = await headers();
  const base = appUrl() ?? `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;

  return (
    <ShopSettingsForm
      values={values}
      readOnly={!owner}
      slugLocked={orders > 0}
      host={publicHost()}
      defaultShop={
        me.role === "owner" && (
          <DefaultShop
            isDefault={defaultShop?.id === me.shop.id}
            host={publicHost()}
            other={defaultShop && defaultShop.id !== me.shop.id ? (defaultShop.settings?.name ?? defaultShop.slug) : null}
          />
        )
      }
      qr={owner && <QrSection scriptFont={script.style.fontFamily} shopName={values.name || me.shop.name} shopUrl={`${base}/${me.shop.slug}`} />}
    />
  );
}
