import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { MenuEditor } from "./MenuEditor";

export default async function AdminMenuPage() {
  const { shop } = await requireUser("menu.edit");
  const [categories, items] = await Promise.all([
    prisma.category.findMany({
      where: { shopId: shop.id },
      orderBy: { sortOrder: "asc" },
      select: { id: true, slug: true, name: true, isVisible: true },
    }),
    prisma.item.findMany({
      where: { shopId: shop.id, deletedAt: null },
      orderBy: { sortOrder: "asc" },
      select: {
        id: true, slug: true, categoryId: true, name: true, brand: true, description: true, priceCents: true, compareAtCents: true, badge: true, isAvailable: true, isVisible: true,
        images: { orderBy: { sortOrder: "asc" }, select: { url: true } },
      },
    }),
  ]);

  return (
    <MenuEditor
      categories={categories}
      items={items.map(({ images, ...item }) => ({ ...item, image: images[0]?.url ?? null, images: images.map((i) => i.url) }))}
    />
  );
}
