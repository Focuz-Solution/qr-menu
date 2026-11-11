import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/lib/generated/prisma/client";

const url = process.env.DATABASE_URL;

// Neon (Vercel) → Neon's serverless driver; any other PostgreSQL (local pgAdmin) → the standard pg driver
const adapter = url?.includes(".neon.tech") ? new PrismaNeon({ connectionString: url }) : new PrismaPg({ connectionString: url });

// one client per server process: in dev, hot reload would otherwise open a new pool on every edit
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
