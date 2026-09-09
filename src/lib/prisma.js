import { PrismaClient } from "@prisma/client";

export const FALLBACK_NEON_URL = "postgresql://neondb_owner:npg_VUCDR1IwAE8P@ep-muddy-resonance-ayyowtgq-pooler.c-5.us-east-2.aws.neon.tech/neondb?sslmode=require";

function getCleanUrl() {
  let url = process.env.DATABASE_URL;
  if (!url || url.includes("ep-bitter-rain")) {
    url = FALLBACK_NEON_URL;
    process.env.DATABASE_URL = url;
  }
  
  if (url.includes("neon.tech")) {
    if (!url.includes("sslmode=")) {
      url += (url.includes("?") ? "&" : "?") + "sslmode=require";
    }
    if (!url.includes("connect_timeout=")) {
      url += (url.includes("?") ? "&" : "?") + "connect_timeout=30";
    }
  }
  return url;
}

export let primaryDbUrl = getCleanUrl();
export let prisma = new PrismaClient(primaryDbUrl ? { datasources: { db: { url: primaryDbUrl } } } : undefined);

export async function connectPrismaWithFallback() {
  let lastError = null;

  // 1. Try with primary URL
  try {
    await prisma.$connect();
    return prisma;
  } catch (err) {
    lastError = err;
    console.warn("First Prisma connection attempt failed:", err.message);
  }

  // 2. If Neon pooler, try direct connection without -pooler
  if (primaryDbUrl && primaryDbUrl.includes("-pooler.neon.tech")) {
    const directUrl = primaryDbUrl.replace("-pooler.neon.tech", ".neon.tech");
    console.log("Attempting Prisma connection with direct Neon host...");
    try {
      await prisma.$disconnect().catch(() => {});
      const client = new PrismaClient({ datasources: { db: { url: directUrl } } });
      await client.$connect();
      prisma = client;
      console.log("✅ Connected via direct Neon host successfully!");
      return prisma;
    } catch (directErr) {
      lastError = directErr;
      console.warn("Direct Neon connection attempt failed:", directErr.message);
    }
  }

  // 3. Try with ?pgbouncer=true
  if (primaryDbUrl && primaryDbUrl.includes("neon.tech") && !primaryDbUrl.includes("pgbouncer=true")) {
    const pgbUrl = primaryDbUrl + (primaryDbUrl.includes("?") ? "&" : "?") + "pgbouncer=true";
    console.log("Attempting Prisma connection with ?pgbouncer=true...");
    try {
      await prisma.$disconnect().catch(() => {});
      const client = new PrismaClient({ datasources: { db: { url: pgbUrl } } });
      await client.$connect();
      prisma = client;
      console.log("✅ Connected via pgbouncer=true successfully!");
      return prisma;
    } catch (pgbErr) {
      lastError = pgbErr;
      console.warn("PgBouncer mode connection attempt failed:", pgbErr.message);
    }
  }

  throw lastError;
}