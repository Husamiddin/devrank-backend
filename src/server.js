import "dotenv/config";
import { app } from "./app.js";
import { prisma, connectPrismaWithFallback } from "./lib/prisma.js";
import { initializeDatabase } from "./lib/initDb.js";
import { dbState } from "./lib/dbState.js";

const port = Number(process.env.PORT || 5000);

export function getDbStatus() {
  return dbState;
}

async function connectDbWithRetry(attempt = 1) {
  try {
    if (!process.env.DATABASE_URL || process.env.DATABASE_URL.includes("ep-bitter-rain")) {
      process.env.DATABASE_URL = "postgresql://neondb_owner:npg_VUCDR1IwAE8P@ep-muddy-resonance-ayyowtgq-pooler.c-5.us-east-2.aws.neon.tech/neondb?sslmode=require";
    }
    const rawUrl = process.env.DATABASE_URL || "";
    try {
      const u = new URL(rawUrl.startsWith("postgresql://") || rawUrl.startsWith("postgres://") ? rawUrl : "http://localhost");
      dbState.parsedDb = {
        protocol: u.protocol,
        host: u.host,
        pathname: u.pathname,
        search: u.search,
        user: u.username,
        hasPassword: Boolean(u.password)
      };
    } catch {}

    await initializeDatabase();
    await connectPrismaWithFallback();
    await prisma.user.updateMany({ data: { online: false } });
    dbState.connected = true;
    dbState.error = null;
    dbState.lastChecked = new Date().toISOString();
    console.log("✅ Database connected and initialized successfully.");
  } catch (err) {
    dbState.connected = false;
    dbState.error = err.message;
    dbState.lastChecked = new Date().toISOString();
    console.error(`⚠️ Database connection attempt #${attempt} failed: ${err.message}`);
    console.warn("Server will continue running. Retrying database connection in 10 seconds...");
    setTimeout(() => connectDbWithRetry(attempt + 1), 10000);
  }
}

// Start HTTP server immediately so Railway / hosting healthchecks never fail or crash
const server = app.listen(port, () => {
  console.log(`AslKod UZ API running on http://localhost:${port}`);
  connectDbWithRetry();
});

const shutdown = async () => {
  server.close(async () => {
    if (dbState.connected) {
      try {
        await prisma.$disconnect();
      } catch {}
    }
    process.exit(0);
  });
};
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

process.on("uncaughtException", (err) => {
  console.error("💥 Uncaught Exception:", err);
});

process.on("unhandledRejection", (reason) => {
  console.error("💥 Unhandled Rejection:", reason);
});
