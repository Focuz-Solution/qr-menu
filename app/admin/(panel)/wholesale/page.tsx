import { requireUser } from "@/lib/auth";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/db";
import { tiersById, variantIdAt } from "@/lib/variants";
import { Wholesale } from "./Wholesale";
import type { Tiers, WholesaleItem } from "./types";

export default async function WholesalePage() {
  const { shop } = await requireUser("menu.edit");
  const t = await getTranslations("admin.wholesale");
  const items = await prisma.item.findMany({
    where: { shopId: shop.id, deletedAt: null },
    orderBy: [{ category: { sortOrder: "asc" } }, { sortOrder: "asc" }],
    select: {
      id: true, name: true, priceCents: true, variants: true,
      images: { orderBy: { sortOrder: "asc" }, take: 1, select: { url: true } },
      wholesale: { select: { isActive: true, tiers: true } },
    },
  });
  const data: WholesaleItem[] = items.map((item) => {
    const image = item.images[0]?.url ?? null;
    const variants = (Array.isArray(item.variants) ? item.variants : []) as { id?: string; label: string; image: string; code?: string; priceCents?: number }[];
    // steps per variant id (older ones saved under the variant's photo are read too)
    const tiers = tiersById(item.wholesale?.tiers, variants) as Tiers;
    const rows = variants.length
      ? variants.map((v, i) => {
          const key = variantIdAt(v, i);
          return { key, label: v.label?.trim() || t("variantN", { n: i + 1 }), code: v.code ?? "", image: v.image, priceCents: v.priceCents ?? item.priceCents, steps: tiers[key] ?? [] };
        })
      : [{ key: "", label: item.name, code: "", image, priceCents: item.priceCents, steps: tiers[""] ?? [] }];
    return { id: item.id, name: item.name, image, priceCents: item.priceCents, variantCount: variants.length, isActive: item.wholesale?.isActive ?? true, rows };
  });
  return <Wholesale items={data} />;
}
