// One-off: copy the demo catalogue from the old static site (github.com/meas-ravy/qr-menu) into one shop.
//   npx tsx prisma/seed-products.ts <shop-slug> <path-to-old-repo>
// Reads <old>/data/products.ts + <old>/public/products/*, uploads photos to R2 like POST /admin/images,
// creates categories (Khmer names) and products. Products whose slug already exists in the shop are skipped, so re-running is safe.
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import sharp from "sharp";

type T = { km: string; en: string };
type OldProduct = {
  slug: string; name: T; brand?: string; category: string; price: number; oldPrice?: number;
  image: string; images?: string[]; variants?: { label: string; price?: number; image?: string }[];
  description: T; badges?: ("new" | "sale" | "best")[]; inStock: boolean;
};

const [shopSlug, oldRepo] = process.argv.slice(2);
if (!shopSlug || !oldRepo) throw new Error("Usage: npx tsx prisma/seed-products.ts <shop-slug> <path-to-old-repo>");
const root = resolve(oldRepo);

for (const file of [".env.local", ".env"]) if (existsSync(file)) process.loadEnvFile(file);
const { R2_ACCOUNT_ID, R2_BUCKET_NAME, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY } = process.env;
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is missing.");
if (!R2_ACCOUNT_ID || !R2_BUCKET_NAME || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) throw new Error("R2_* env is missing.");
const folder = (process.env.R2_FOLDER ?? "").trim().replace(/^\/+|\/+$/g, "") || "images";
const s3 = new S3Client({
  region: "auto",
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
});

// same output as app/admin/images/route.ts: full ≤ 1600 px + thumb ≤ 480 px WebP; one upload per file even if used twice
const uploaded = new Map<string, string>();
async function upload(path: string) {
  if (uploaded.has(path)) return uploaded.get(path)!;
  const fit = { fit: "inside", withoutEnlargement: true } as const;
  const full = await sharp(readFileSync(join(root, "public", path))).rotate().resize(1600, 1600, fit).webp({ quality: 82 }).toBuffer();
  const thumb = await sharp(full).resize(480, 480, fit).webp({ quality: 75 }).toBuffer();
  const id = randomUUID();
  const put = (key: string, Body: Buffer) => s3.send(new PutObjectCommand({ Bucket: R2_BUCKET_NAME, Key: key, Body, ContentType: "image/webp" }));
  await Promise.all([put(`${folder}/${id}.webp`, full), put(`${folder}/${id}-thumb.webp`, thumb)]);
  const url = `/api/images/${id}.webp`;
  uploaded.set(path, url);
  return url;
}

const cents = (n: number | undefined) => (n == null ? undefined : Math.round(n * 100));
const BADGE = { new: "new", best: "best_seller" } as const; // "sale" isn't a badge any more: the discount shows it

async function main() {
  const { products, categories } = (await import(pathToFileURL(join(root, "data/products.ts")).href)) as { products: OldProduct[]; categories: readonly string[] };
  const names = JSON.parse(readFileSync(join(root, "messages/km.json"), "utf8")).categories as Record<string, string>;
  const { prisma } = await import("../lib/db");
  try {
    const shop = await prisma.shop.findUnique({ where: { slug: shopSlug }, select: { id: true } });
    if (!shop) throw new Error(`No shop with slug "${shopSlug}". Create it in Admin first.`);

    const catId = new Map<string, string>();
    for (const [sortOrder, slug] of categories.entries()) {
      const c = await prisma.category.upsert({
        where: { shopId_slug: { shopId: shop.id, slug } },
        create: { shopId: shop.id, slug, name: names[slug] ?? slug, sortOrder },
        update: {},
      });
      catId.set(slug, c.id);
    }

    let added = 0;
    for (const [sortOrder, p] of products.entries()) {
      if (await prisma.item.findUnique({ where: { shopId_slug: { shopId: shop.id, slug: p.slug } } })) {
        console.log(`skip ${p.slug} (exists)`);
        continue;
      }
      const main = await upload(p.image);
      const gallery = [];
      for (const img of p.images ?? []) gallery.push(await upload(img));
      const variants = [];
      for (const v of p.variants ?? []) variants.push({ label: v.label, image: v.image ? await upload(v.image) : main, priceCents: cents(v.price) });
      const images = [...new Set([main, ...gallery, ...variants.map((v) => v.image)])];
      const badge = p.badges?.map((b) => (b === "sale" ? undefined : BADGE[b])).find(Boolean);
      await prisma.item.create({
        data: {
          shopId: shop.id,
          slug: p.slug,
          categoryId: catId.get(p.category)!,
          name: p.name.km,
          brand: p.brand ?? null,
          description: p.description.km,
          priceCents: cents(p.price)!,
          compareAtCents: cents(p.oldPrice) ?? null,
          badge: badge ?? null,
          isAvailable: p.inStock,
          sortOrder,
          variants,
          images: { create: images.map((url, i) => ({ url, sortOrder: i })) },
        },
      });
      added++;
      console.log(`added ${p.slug} (${images.length} photos)`);
    }
    console.log(`Done: ${added} products added to "${shopSlug}".`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
