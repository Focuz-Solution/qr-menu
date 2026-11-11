import { existsSync } from "node:fs";
import { hashPassword } from "../lib/password";
import sampleCatalogue from "./sample-catalogue.json";

const OWNER = {
  email: "hello@focuzsolution.com",
  name: "Focuz Solution",
  password: "iam4cuz",
};

async function main() {
  for (const file of [".env.local", ".env"]) if (existsSync(file)) process.loadEnvFile(file);
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is missing. Add it to .env or .env.local first.");

  const { prisma } = await import("../lib/db");
  try {
    if (process.env.SEED_SAMPLE_DATA === "1") {
      await prisma.$transaction(async (db) => {
        for (const { products, ...category } of sampleCatalogue) {
          const { id } = await db.category.upsert({
            where: { slug: category.slug },
            create: category,
            update: {},
          });
          for (const product of products) {
            await db.item.upsert({
              where: { slug: product.slug },
              create: { ...product, categoryId: id },
              update: {},
            });
          }
        }
      }, { timeout: 30_000 });
      console.log("Sample catalogue seeded.");
      return;
    }

    const email = OWNER.email.toLowerCase();
    if (await prisma.user.findUnique({ where: { email } })) {
      console.log(`Owner ${email} already exists — nothing changed.`);
      return;
    }
    await prisma.user.create({
      data: {
        email,
        name: OWNER.name,
        role: "owner",
        passwordHash: await hashPassword(OWNER.password),
      },
    });
    console.log(`Owner account created: ${email}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
