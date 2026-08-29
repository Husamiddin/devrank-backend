import { prisma } from './src/lib/prisma.js';
import { GoogleGenAI } from '@google/genai';
import "dotenv/config";


const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const CATEGORIES = ["web", "ai", "cyber", "ux"];
const CATEGORY_NAMES = {
  web: "Web Development (Frontend, Backend, React, Node.js, SQL)",
  ai: "AI & Machine Learning (Python, LLMs, Vectors, Data Science)",
  cyber: "Cyber Security (AppSec, OWASP, Penetration Testing, Crypto)",
  ux: "UI/UX Design (Figma, WCAG, Design Systems, Typography)"
};

async function generateQuestionsForCategory(category, count = 25) {
  console.log(`\n⏳ Generating ${count} real questions for [${category.toUpperCase()}]...`);
  
  const prompt = `
Siz professional Senior Dasturchisiz.
Menga ${CATEGORY_NAMES[category]} yo'nalishi bo'yicha ${count} ta REAL, QIYIN va SIFATLI test (QUIZ) savollarini tuzib bering.
Hech qanday soxta yoki oson (HTML nima kabi) savollar bo'lmasin. Haqiqiy muhandislar uchun.
Savol matni va variantlari faqat O'zbek tilida bo'lsin.

Javobni FAQAT quyidagi JSON massiv formatida qaytaring:
[
  {
    "title": "Qisqa mavzu nomi (max 3-4 so'z)",
    "description": "To'liq savol matni, qoidalar va kod misoli (agar kerak bo'lsa)...",
    "difficulty": "EASY", // yoki "MEDIUM", "HARD"
    "points": 10, // 10 dan 30 gacha
    "options": ["Variant A", "Variant B", "Variant C", "Variant D"],
    "correct": 0 // to'g'ri javob indeksi (0 dan 3 gacha)
  }
]
`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json"
      }
    });
    
    const data = JSON.parse(response.text);
    let added = 0;
    
    for (const q of data) {
      await prisma.challenge.create({
        data: {
          title: q.title, language: 'javascript', starterCode: '// kod shu yerga yoziladi', tests: [],  slug: q.title.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + Date.now(),
          category: category,
          type: "QUIZ",
          difficulty: q.difficulty,
          description: q.description,
          points: q.points,
          published: true,
          quiz: {
            options: q.options,
            correct: q.correct
          }
        }
      });
      added++;
    }
    console.log(`✅ ${added} questions added to ${category}`);
  } catch (err) {
    console.error(`❌ Error generating for ${category}:`, err.message);
  }
}

async function run() {
  console.log("🚀 Starting AI Question Generator...");
  for (const cat of CATEGORIES) {
    await generateQuestionsForCategory(cat, 15); await new Promise(r => setTimeout(r, 35000));
  }
  console.log("\n🎉 All generating finished! Now each category has 25+ real questions.");
}

run().catch(console.error).finally(() => prisma.$disconnect());
