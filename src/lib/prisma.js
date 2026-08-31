import "dotenv/config";
import pkg from "@prisma/client";
const { PrismaClient } = pkg;
import { PrismaPg } from "@prisma/adapter-pg";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
export const prisma = new PrismaClient({ adapter });