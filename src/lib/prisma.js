import { PrismaClient } from "@prisma/client";

let dbUrl = process.env.DATABASE_URL;
if (dbUrl && dbUrl.includes("neon.tech") && !dbUrl.includes("connect_timeout")) {
  dbUrl += (dbUrl.includes("?") ? "&" : "?") + "connect_timeout=30";
  process.env.DATABASE_URL = dbUrl;
}

export const prisma = new PrismaClient(
  dbUrl ? { datasources: { db: { url: dbUrl } } } : undefined
);