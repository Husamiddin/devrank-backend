import "dotenv/config";
import { app } from "./app.js";
import { prisma } from "./lib/prisma.js";
import { initializeDatabase } from "./lib/initDb.js";

const port = Number(process.env.PORT || 5000);

await initializeDatabase();
await prisma.$connect();
await prisma.user.updateMany({ data: { online: false } });

const server = app.listen(port, () => console.log(`DevRank UZ API running on http://localhost:${port}`));
const shutdown = async () => {
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
};
process.on("SIGTERM", shutdown);

