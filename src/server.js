import "dotenv/config";
import { app } from "./app.js";
import { prisma } from "./lib/prisma.js";
import { initializeDatabase } from "./lib/initDb.js";

const port = Number(process.env.PORT || 5000);

let dbConnected = false;
let dbError = null;

export function getDbStatus() {
  return { connected: dbConnected, error: dbError };
}

async function connectDbWithRetry(attempt = 1) {
  try {
    await initializeDatabase();
    await prisma.$connect();
    await prisma.user.updateMany({ data: { online: false } });
    dbConnected = true;
    dbError = null;
    console.log("✅ Database connected and initialized successfully.");
  } catch (err) {
    dbConnected = false;
    dbError = err.message;
    console.error(`⚠️ Database connection attempt #${attempt} failed: ${err.message}`);
    console.warn("Server will continue running. Retrying database connection in 10 seconds...");
    setTimeout(() => connectDbWithRetry(attempt + 1), 10000);
  }
}

// Start HTTP server immediately so Railway / hosting healthchecks never fail or crash
const server = app.listen(port, () => {
  console.log(`DevRank UZ API running on http://localhost:${port}`);
  connectDbWithRetry();
});

const shutdown = async () => {
  server.close(async () => {
    if (dbConnected) {
      try {
        await prisma.$disconnect();
      } catch {}
    }
    process.exit(0);
  });
};
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);


