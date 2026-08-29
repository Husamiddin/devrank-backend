import { prisma } from './src/lib/prisma.js';

async function run() {
  await prisma.challenge.updateMany({
    where: { title: 'Two Sum' },
    data: { starterCode: 'function twoSum(nums, target) {\n  // Yechimingizni shu yerga yozing\n  \n}' }
  });
  await prisma.challenge.updateMany({
    where: { title: 'TypeScript Safe Validator' },
    data: { starterCode: 'type User = { id: string; name: string };\n\nfunction isUser(value: unknown): value is User {\n  // Yechimingizni shu yerga yozing\n  \n}' }
  });
  await prisma.challenge.updateMany({
    where: { title: 'Python Matn Tozalash' },
    data: { starterCode: 'def clean_text(text: str) -> str:\n    # Yechimingizni shu yerga yozing\n    pass' }
  });
  await prisma.challenge.updateMany({
    where: { title: 'Cosine Similarity' },
    data: { starterCode: 'import math\n\ndef cosine_similarity(vec_a: list[float], vec_b: list[float]) -> float:\n    # Yechimingizni shu yerga yozing\n    pass' }
  });
  await prisma.challenge.updateMany({
    where: { title: 'Secure Password Strength Check' },
    data: { starterCode: 'function isStrongPassword(password) {\n  // Yechimingizni shu yerga yozing\n  \n}' }
  });
  console.log('Starter codes updated in DB');
}
run().catch(console.error).finally(() => prisma.$disconnect());
