import { prisma } from './src/lib/prisma.js';
console.log('Testing connection to DB...');
try {
  const users = await prisma.user.count();
  console.log('Successfully connected! User count:', users);
} catch (e) {
  console.error('Connection error:', e.message);
} finally {
  await prisma.$disconnect();
}
