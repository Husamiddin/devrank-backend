import { prisma } from './src/lib/prisma.js';
async function run() { await prisma.user.deleteMany({ where: { name: { in: ['Toxir Hamroyev', 'Sardor Aliyev', 'Muhammad Yusuf', 'Aziza Karimova', 'Bekzod Rahimov', 'Odil', 'Malika', 'Ibrohim', 'Laylo', 'Alisher', 'Nozima', 'Rustam', 'Dilnoza', 'Jasur', 'Doston', 'Umid', 'Akmal Karimov'] } } }); console.log('Fake users deleted'); }
run().catch(console.error).finally(() => prisma.$disconnect());
