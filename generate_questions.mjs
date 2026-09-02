import { prisma } from './src/lib/prisma.js';
import { geminiPool } from './src/lib/geminiPool.js';
import "dotenv/config";

const CATEGORIES = ["cyber", "ux"];
const CATEGORY_NAMES = {
  cyber: "Cyber Security (AppSec, OWASP Top 10, XSS/SQLi himoyasi, shifrlash va xavfsizlik skriptlari)",
  ux: "UI/UX Design & Frontend Layout (Figma dizayn tamoyillari, WCAG veb-aksesuar, CSS Flexbox/Grid, Tailwind va HTML semantikasi)"
};

function safeJSONParse(text) {
  try {
    let clean = text.replace(/^```json\s*|\s*```$/g, "").trim();
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

async function generateTasksForCategory(category, difficulty, count = 5) {
  const points = difficulty === 'easy' ? 50 : difficulty === 'medium' ? 100 : 150;
  
  console.log(`\n⏳ [${category.toUpperCase()}] uchun ${count} ta [${difficulty.toUpperCase()}] vazifa so'ralmoqda (${points} pts)...`);

  const prompt = `
Siz professional Senior Kiberxavfsizlik Mutaxassisi va UI/UX Arhitektorisiz. 
Barcha matnlar, tavsiflar, savollar va variantlar FAQAT va FAQAT ravon O'zbek tilida (lotin yozuvida) bo'lishi shart!

Menga ${CATEGORY_NAMES[category]} yo'nalishi bo'yicha aniq ${count} ta sifatli topshiriq tuzib bering.
Qiyinlik darajasi: "${difficulty}". Ball: ${points} pts.

Talablar:
- "cyber" yo'nalishi uchun: Xavfsizlik qoidalari bo'yicha QUIZ (test) hamda xavfsizlikni ta'minlash, kiruvchi ma'lumotlarni filtrlash yoki shifrlash bo'yicha CODE (amaliy dasturlash) masalalarini aralashtirib bering.
- "ux" yo'nalishi uchun: UI/UX qonuniyatlari, ranglar va foydalanish qulayligi bo'yicha QUIZ hamda CSS Grid/Flexbox yoki veb-aksesuar (accessibility) bo'yicha CODE topshiriqlarini aralashtirib bering.

Javobni FAQAT valid JSON massiv formatida qaytaring, boshqa hech qanday matn yozmang:
[
  {
    "type": "QUIZ",
    "title": "Mavzu nomi (o'zbekcha, max 3 so'z)",
    "description": "Test savolining sharti o'zbek tilida...",
    "difficulty": "${difficulty}",
    "points": ${points},
    "options": ["Variant A", "Variant B", "Variant C", "Variant D"],
    "correctIndex": 0
  },
  {
    "type": "CODE",
    "title": "Masala nomi (o'zbekcha, max 3 so'z)",
    "description": "Amaliy kod yoki funksiya yozish sharti o'zbek tilida...",
    "difficulty": "${difficulty}",
    "points": ${points},
    "language": "javascript", 
    "starterCode": "function validateInput(input) {\\n  // Xavfsiz tekshiruv kodini yozing\\n}",
    "inputExample": "Kiruvchi ma'lumot",
    "outputExample": "Kutilayotgan xavfsiz natija",
    "unitTests": [
      { "input": ["test"], "expected": "result" }
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

      await prisma.challenge.upsert({
        where: { slug: uniqueSlug },
        update: {},
        create: {
          title: q.title || "Topshiriq nomi",
          slug: uniqueSlug,
          category: category,
          type: isQuiz ? "QUIZ" : "CODE",
          language: isQuiz ? "quiz" : (q.language || "javascript"),
          difficulty: difficulty,
          description: q.description || "Tavsif yo'q",
          starterCode: isQuiz ? "" : (q.starterCode || "// kod shu yerga yoziladi"),
          inputExample: isQuiz ? null : (q.inputExample || ""),
          outputExample: isQuiz ? null : (q.outputExample || ""),
          points: points,
          published: true,
          tests: isQuiz ? { checks: [] } : { unitTests: q.unitTests || [] },
          quiz: isQuiz ? {
            question: q.description,
            options: q.options || [],
            correctIndex: Number(q.correctIndex) || 0
          } : null
        }
      });
      added++;
    }
    console.log(`✅ ${added} ta vazifa [${category} - ${difficulty}] bazaga qo'shildi.`);
  } catch (err) {
    console.error(`❌ Xatolik (${category} - ${difficulty}):`, err.message);
  }
}

async function run() {
  console.log("🚀 Cyber Security va UI/UX uchun Quiz va Code generatsiyasi boshlandi...");

  for (const cat of CATEGORIES) {
    console.log(`\n----------------------------`);
    console.log(`📂 Kategoriya: ${cat.toUpperCase()}`);
    console.log(`----------------------------`);

    // Easy (50 pts) - 5 ta
    await generateTasksForCategory(cat, "easy", 5);
    await new Promise(r => setTimeout(r, 6000));

    // Medium (100 pts) - 5 ta
    await generateTasksForCategory(cat, "medium", 5);
    await new Promise(r => setTimeout(r, 6000));

    // Hard (150 pts) - 5 ta
    await generateTasksForCategory(cat, "hard", 5);
    await new Promise(r => setTimeout(r, 8000));
  }

  console.log("\n🎉 Cyber Security va UI/UX vazifalari muvaffaqiyatli yaratildi!");
}

run().catch(console.error).finally(() => prisma.$disconnect());