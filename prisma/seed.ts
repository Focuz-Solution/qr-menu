import { existsSync } from "node:fs";
import { hashPassword } from "../lib/password";

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
    const email = OWNER.email.toLowerCase();
    if (await prisma.user.findUnique({ where: { email } })) {
      console.log(`Owner ${email} already exists — nothing changed.`);
      return;
    }
    await prisma.user.create({
      data: {
        email,
        name: OWNER.name,
        isOwner: true,
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
