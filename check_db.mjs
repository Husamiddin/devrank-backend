import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany();
  console.log('Users count:', users.length);
  console.log('Users list:', users.map(u => ({ id: u.id, name: u.name, email: u.email, score: u.score, role: u.role, phone: u.phone, province: u.province })));
  
  const categoryScores = await prisma.userCategoryScore.findMany();
  console.log('Category Scores:', categoryScores);
  
  const challenges = await prisma.challenge.findMany();
  console.log('Challenges:', challenges.length);
  
  const attempts = await prisma.challengeAttempt.findMany();
  console.log('Attempts:', attempts.length);
}

main().catch(console.error).finally(() => prisma.$disconnect());
