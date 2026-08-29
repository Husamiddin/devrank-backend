import { prisma } from './src/lib/prisma.js';
async function run() { const allUsers = await prisma.user.findMany(); console.log(allUsers.map(u => u.name)); } run().catch(console.error).finally(() => prisma.$disconnect());
