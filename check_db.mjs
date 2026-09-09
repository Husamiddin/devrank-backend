import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany();
  console.log('Users:', users.length);
  
  const categoryScores = await prisma.userCategoryScore.findMany();
  console.log('Category Scores:', categoryScores);
  
  const challenges = await prisma.challenge.findMany();
  console.log('Challenges:', challenges.length);
  
  const attempts = await prisma.challengeAttempt.findMany();
  console.log('Attempts:', attempts.length);
}

main().catch(console.error).finally(() => prisma.$disconnect());
