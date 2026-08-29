import { prisma } from './src/lib/prisma.js';
async function run() {
  await prisma.challenge.updateMany({ where: { title: 'Two Sum' }, data: { starterCode: 'function twoSum(nums, target) {
  // Kod shu yerga yoziladi
}' } });
  await prisma.challenge.updateMany({ where: { title: 'TypeScript Safe Validator' }, data: { starterCode: 'function isValidUser(value) {
  // Kod shu yerga yoziladi
}' } });
  await prisma.challenge.updateMany({ where: { title: 'Python Matn Tozalash' }, data: { starterCode: 'def clean_text(text: str) -> str:
    # Kod shu yerga yoziladi
    pass' } });
  await prisma.challenge.updateMany({ where: { title: 'Cosine Similarity' }, data: { starterCode: 'import math

def cosine_similarity(vec_a: list[float], vec_b: list[float]) -> float:
    # Kod shu yerga yoziladi
    pass' } });
  await prisma.challenge.updateMany({ where: { title: 'Secure Password Strength Check' }, data: { starterCode: 'function isStrongPassword(password) {
  // Kod shu yerga yoziladi
}' } });
  console.log('Starter codes fixed!');
}
run().catch(console.error).finally(() => prisma.$disconnect());
