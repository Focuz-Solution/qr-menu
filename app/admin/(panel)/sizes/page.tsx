import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Sizes } from "./Sizes";

export default async function SizesPage() {
  const { shop } = await requireUser("menu.edit");
  const sizes = await prisma.size.findMany({
    where: { shopId: shop.id },
    orderBy: { sortOrder: "asc" },
    select: { id: true, name: true, _count: { select: { items: { where: { item: { deletedAt: null } } } } } },
  });
  return <Sizes sizes={sizes.map((s) => ({ id: s.id, name: s.name, products: s._count.items }))} />;
}
