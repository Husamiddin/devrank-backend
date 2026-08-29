import { GoogleGenAI } from "@google/genai";

function clamp(v) {
  return Math.max(0, Math.min(100, Math.round(Number(v) || 0)));
}

function parseJson(text) {
  const s = String(text || "")
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();

  try {
    return JSON.parse(s);
  } catch {
    const match = s.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

/**
 * Evaluates submitted code with Gemini 2.5 Flash
 *
 * @param {Object} params
 * @param {string} params.code
 * @param {string} params.language
 * @param {Object} params.challenge
 * @param {Object} params.runnerResult
 * @returns {Promise<Object>}
 */
export async function evaluateWithGemini({ code, language, challenge, runnerResult }) {
  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";

  if (!apiKey) {
    return {
      overall: runnerResult?.passed ? 85 : Math.round((runnerResult?.results?.filter(r => r.passed).length / Math.max(runnerResult?.results?.length || 1, 1)) * 60),
      correctness: runnerResult?.passed ? 100 : Math.round((runnerResult?.results?.filter(r => r.passed).length / Math.max(runnerResult?.results?.length || 1, 1)) * 100),
      quality: 75,
      security: 85,
      speed: 80,
      feedback: "AI baholash sozlanmagan (GEMINI_API_KEY). Test runner natijalari ko'rsatildi.",
      model: "AI Unavailable",
      results: runnerResult?.results || []
    };
  }

  const prompt = `
Siz DevRank UZ professional AI Senior Code Reviewer tizimisiz.
Foydalanuvchi quyidagi dasturlash topshirig'ini bajardi va test runner natijalari keltirilgan.

Topshiriq:
Nomi: ${challenge?.title || "Challenge"}
Kategoriya: ${challenge?.category || "web"}
Dasturlash tili: ${language}
Tavsifi: ${challenge?.description || ""}

Haqiqiy Test Runner natijalari:
${JSON.stringify(runnerResult?.results || [], null, 2)}
Testlar umumiy holati: ${runnerResult?.passed ? "BARCHA TESTLAR O'TDI (PASS)" : "AYRIM TESTLAR QONIQTIRILMADI (FAIL)"}

Foydalanuvchi kodi:
\`\`\`${language}
${code}
\`\`\`

Iltimos, kodni chuqur tahlil qiling va FAQAT quyidagi JSON formatida javob qaytaring (hech qanday qo'shimcha matnsiz):
{
  "overall": 0-100,
  "correctness": 0-100,
  "quality": 0-100,
  "security": 0-100,
  "speed": 0-100,
  "feedback": "O'zbek tilida aniq, tushunarli va professional tavsiya va fikr (2-4 gap)."
}
`;

  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
    });

    const parsed = parseJson(response.text);
    if (!parsed) {
      throw new Error("Gemini javobi JSON formatida emas.");
    }

    return {
      overall: clamp(parsed.overall),
      correctness: clamp(parsed.correctness),
      quality: clamp(parsed.quality),
      security: clamp(parsed.security),
      speed: clamp(parsed.speed),
      feedback: String(parsed.feedback || "Tahlil muvaffaqiyatli yakunlandi."),
      model,
      results: runnerResult?.results || []
    };
  } catch (error) {
    console.error("Gemini evaluation error:", error.message || error);
    
    // Transparent status indicating Gemini was unavailable, using test runner's factual score
    const runnerScore = runnerResult?.passed ? 90 : Math.round((runnerResult?.results?.filter(r => r.passed).length / Math.max(runnerResult?.results?.length || 1, 1)) * 60);
    return {
      overall: runnerScore,
      correctness: runnerResult?.passed ? 100 : Math.round((runnerResult?.results?.filter(r => r.passed).length / Math.max(runnerResult?.results?.length || 1, 1)) * 100),
      quality: 75,
      security: 80,
      speed: 80,
      feedback: `AI evaluation unavailable: ${error.message || "Xatolik"}. Test runner natijalari asos qilib olindi.`,
      model: "AI Unavailable",
      results: runnerResult?.results || []
    };
  }
}
