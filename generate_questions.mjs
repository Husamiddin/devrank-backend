import { prisma } from './src/lib/prisma.js';
import { geminiPool } from './src/lib/geminiPool.js';
import "dotenv/config";

// 4 Canonical yo'nalish: Web, AI, UX/UI, Cyber Security
const CATEGORIES = ["web", "ai", "ux", "cyber"]; 

// AI ga har bir yo'nalish mazmuni bo'yicha batafsil ko'rsatmalar
const CATEGORY_NAMES = {
  web: "Web Development (JavaScript, React, Node.js, Express, Python FastAPI, REST API, DOM, asinxron dasturlash va ma'lumotlar tuzilmasi)",
  ai: "Artificial Intelligence & Machine Learning (Python, ML modellari, Prompt Engineering, LLM, Vektorlar, Ma'lumotlarni tahlil qilish)",
  ux: "UI/UX Design & Frontend Layout (Figma tamoyillari, WCAG, CSS Flexbox/Grid, Responsive dizayn, Dizayn tizimlari, Foydalanuvchi tajribasi)",
  cyber: "Cyber Security & AppSec (OWASP Top 10, XSS/SQLi oldini olish, JWT & Auth xavfsizligi, Shifrlash, Xavfsiz tizim arxitekturasi)"
};

// JSON'ni xavfsiz o'qib olish
function safeJSONParse(text) {
  try {
    let clean = text.replace(/^```json\s*|\s*```$/gi, "").trim();
    const firstBracket = clean.indexOf('[');
    const lastBracket = clean.lastIndexOf(']');
    if (firstBracket !== -1 && lastBracket !== -1) {
      clean = clean.substring(firstBracket, lastBracket + 1);
    }
    return JSON.parse(clean);
  } catch (e) {
    const sanitized = text.replace(/[\u0000-\u001F]+/g, " ");
    const fB = sanitized.indexOf('[');
    const lB = sanitized.lastIndexOf(']');
    return JSON.parse(sanitized.substring(fB, lB + 1));
  }
}

// Qiyinchilik darajasiga qarab ballar oralig'ini belgilash
function getPointRange(difficulty) {
  switch(difficulty.toLowerCase()) {
    case 'easy': return '15 dan 25 gacha';
    case 'medium': return '35 dan 55 gacha';
    case 'hard': return '65 dan 95 gacha';
    case 'extreme': return '100 dan 150 gacha';
    default: return '20';
  }
}

export async function generateTasksForCategory(category, difficulty, count = 5) {
  const pointsRange = getPointRange(difficulty);
  console.log(`\n⏳ [${category.toUpperCase()}] uchun ${count} ta [${difficulty.toUpperCase()}] vazifa so'ralmoqda (${pointsRange} pts)...`);

  const langHint = category === 'ai' ? 'python' : (category === 'web' ? 'javascript yoki python' : 'javascript');

  const prompt = `
Siz professional Senior IT-Ekspert va dasturlash bo'yicha imtihon tuzuvchisisiz.
Barcha matnlar, sarlavha, tavsiflar, savollar va variantlar FAQAT va FAQAT ravon O'zbek tilida (lotin yozuvida) bo'lishi shart!

Menga "${CATEGORY_NAMES[category] || category}" yo'nalishi bo'yicha aniq ${count} ta yuqori sifatli topshiriq tuzib bering.
Qiyinlik darajasi: "${difficulty.toUpperCase()}".
Har bir savol uchun ballni (points) quyidagi oraliqda tasodifiy qilib belgilang: ${pointsRange}.

Talablar:
- Savollarning yarmi "QUIZ" (4 ta variantli nazariy/ssenariy test), yarmi esa "CODE" (amaliy funksiya yozish masalasi) bo'lsin.
- CODE masalalari uchun:
  * "starterCode": funksiya nomi aniq "solve" bo'lsin, masalan:
    JavaScript uchun: "function solve(input) {\\n  // kodingizni yozing\\n}"
    Python uchun: "def solve(input):\\n    # kodingizni yozing\\n    pass"
  * "testCases": har bir test case uchun "input" va "expected" (aniq kutilgan natija) bo'lsin. Kamida 2-3 ta test case bering.
  * "inputExample" va "outputExample" qisqa misollar bo'lsin.
  * Dasturlash tili (${langHint}) bo'lsin.
- QUIZ savollari uchun:
  * "description": savol sharti
  * "options": 4 ta aniq variant
  * "correctIndex": to'g'ri variant indeksi (0, 1, 2 yoki 3)

Javobni FAQAT valid JSON massiv formatida qaytaring, hech qanday qo'shimcha matn yozmang:
[
  {
    "title": "Savolning qisqa nomi",
    "description": "Test savolining batafsil sharti o'zbek tilida...",
    "category": "${category}",
    "difficulty": "${difficulty.toUpperCase()}",
    "type": "QUIZ",
    "points": 20,
    "options": ["Variant A", "Variant B", "Variant C", "Variant D"],
    "correctIndex": 0
  },
  {
    "title": "Masala nomi",
    "description": "Amaliy kod yozish sharti o'zbek tilida...",
    "category": "${category}",
    "difficulty": "${difficulty.toUpperCase()}",
    "type": "CODE",
    "points": 45,
    "language": "${category === 'ai' ? 'python' : 'javascript'}",
    "starterCode": "${category === 'ai' ? 'def solve(input):\\n    pass' : 'function solve(input) {\\n\\n}'}",
    "inputExample": "Misol kirish",
    "outputExample": "Misol chiqish",
    "testCases": [
      { "input": [1, 2], "expected": 3 },
      { "input": [5, 10], "expected": 15 }
    ]
  }
]
`;

  try {
    const textResponse = await geminiPool.generateWithRetry(prompt);
    const data = safeJSONParse(textResponse);
    let added = 0;

    for (const q of data) {
      const baseSlug = (category + '-' + (q.title || "task")).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      const uniqueSlug = `${baseSlug}-${Math.random().toString(36).substring(2, 7)}`;
      const isQuiz = q.type === "QUIZ";
      const qLang = isQuiz ? "quiz" : (q.language || (category === 'ai' ? 'python' : 'javascript'));

      // Test cases tuzilishi
      const unitTests = (q.testCases || []).map(tc => ({
        input: tc.input,
        expected: tc.expected !== undefined ? tc.expected : tc.expectedOutput,
        expectedOutput: tc.expected !== undefined ? tc.expected : tc.expectedOutput
      }));

      await prisma.challenge.upsert({
        where: { slug: uniqueSlug },
        update: {}, 
        create: {
          title: q.title || "Topshiriq",
          slug: uniqueSlug,
          category: category,
          type: isQuiz ? "QUIZ" : "CODE",
          language: qLang,
          difficulty: difficulty.toUpperCase(),
          description: q.description || "Tavsif yo'q",
          starterCode: isQuiz ? "" : (q.starterCode || (qLang === 'python' ? 'def solve(input):\n    pass' : 'function solve(input) {\n\n}')),
          inputExample: q.inputExample ? String(q.inputExample) : null,
          outputExample: q.outputExample ? String(q.outputExample) : null,
          points: Number(q.points) || (difficulty.toLowerCase() === 'easy' ? 20 : 50),
          published: true,
          tests: isQuiz ? { checks: [] } : { unitTests },
          quiz: isQuiz ? {
            question: q.description,
            options: q.options || [],
            correctIndex: Number(q.correctIndex) || 0
          } : null
        }
      });
      added++;
    }
    console.log(`✅ ${added} ta vazifa [${category.toUpperCase()} - ${difficulty.toUpperCase()}] bazaga qo'shildi.`);
    return added;
  } catch (err) {
    console.error(`❌ Xatolik (${category} - ${difficulty.toUpperCase()}):`, err.message);
    return 0;
  }
}

async function run() {
  const args = process.argv.slice(2);
  const targetCategory = args[0] ? args[0].toLowerCase() : "all";
  const targetDiff = args[1] ? args[1].toLowerCase() : "all";
  const targetCount = parseInt(args[2], 10) || 5;

  console.log("🚀 AslKod AI Savollar Generatsiyasi tizimi ishga tushdi...");
  console.log(`Parametrlar: Kategoriya=${targetCategory}, Qiyinlik=${targetDiff}, Soni=${targetCount}`);

  const DIFFICULTIES = ["easy", "medium", "hard", "extreme"];
  const catsToRun = targetCategory === "all" ? CATEGORIES : [targetCategory];
  const diffsToRun = targetDiff === "all" ? DIFFICULTIES : [targetDiff];

  let totalAdded = 0;

  for (const cat of catsToRun) {
    if (!CATEGORIES.includes(cat)) {
      console.warn(`Ogohlantirish: "${cat}" noma'lum kategoriya. Ruxsat etilganlar: ${CATEGORIES.join(", ")}`);
      continue;
    }
    console.log(`\n========================================`);
    console.log(`📂 Kategoriya: ${cat.toUpperCase()} (${CATEGORY_NAMES[cat].split('(')[0].trim()})`);
    console.log(`========================================`);

    for (const diff of diffsToRun) {
      const added = await generateTasksForCategory(cat, diff, targetCount);
      totalAdded += added;
      // Rate limit kutish (5 soniya)
      await new Promise(r => setTimeout(r, 5000));
    }
  }

  console.log(`\n🎉 Jami ${totalAdded} ta yangi topshiriq muvaffaqiyatli generatsiya qilindi!`);
}

// Agar to'g'ridan-to'g'ri ishga tushirilsa
if (process.argv[1]?.includes('generate_questions.mjs')) {
  run().catch(console.error).finally(() => prisma.$disconnect());
}