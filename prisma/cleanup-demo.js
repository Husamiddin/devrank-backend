import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
const prisma=new PrismaClient({adapter:new PrismaPg({connectionString:process.env.DATABASE_URL})});
const emails=["toxir@devrank.uz","sardor@devrank.uz","muhammad@devrank.uz","aziza@devrank.uz","bekzod@devrank.uz"];
const users=await prisma.user.findMany({where:{email:{in:emails}},select:{id:true,email:true}});
for(const user of users){await prisma.user.delete({where:{id:user.id}});console.log(`Removed demo user: ${user.email}`)}
console.log(`Cleanup complete. Removed ${users.length} demo users.`);
await prisma.$disconnect();
