import { existsSync } from "node:fs";
import { defineConfig } from "prisma/config";

// Prisma 7 doesn't read env files itself: .env.local first (wins), then .env. On Vercel the env is already set.
for (const file of [".env.local", ".env"]) if (existsSync(file)) process.loadEnvFile(file);

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL,
  },
});
