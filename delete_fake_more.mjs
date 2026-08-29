import { prisma } from './src/lib/prisma.js';
async function run() { await prisma.user.deleteMany({ where: { name: { in: ['Javohir Saidov', 'Diyorbek Rustamov', 'Madina Ismoilova', 'Kamron Akbarov', 'Shahzod Abduqodirov', 'Akmal Karimov (Senior)', 'Akmal Code Tester'] } } }); console.log('Remaining fake users deleted'); }
run().catch(console.error).finally(() => prisma.$disconnect());
