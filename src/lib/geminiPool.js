import { GoogleGenAI } from '@google/genai';
import "dotenv/config";

class GeminiPool {
  constructor() {
    const rawKeys = process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY || "";
    this.keys = rawKeys.split(",").map(k => k.trim()).filter(Boolean);
    
    if (this.keys.length === 0) {
      throw new Error("Hech qanday GEMINI_API_KEYS topilmadi!");
    }
    this.currentIndex = 0;
  }

  // Keyingi kalitni olib, navbatni keyingisiga o'tkazadi
  getNextClient() {
    const apiKey = this.keys[this.currentIndex];
    // Navbatdagi kalitga o'tamiz (oxiriga yetsa boshidan boshlaydi)
    this.currentIndex = (this.currentIndex + 1) % this.keys.length;
    return new GoogleGenAI({ apiKey });
  }

  // Xatolik (429) chiqqanda boshqa kalit bilan qayta urinib ko'rish uchun safe wrapper
  async generateWithRetry(prompt, config = { responseMimeType: "application/json" }) {
    let attempts = 0;
    const maxAttempts = this.keys.length;

    while (attempts < maxAttempts) {
      const ai = this.getNextClient();
      try {
        const response = await ai.models.generateContent({
          model: "gemini-3.6-flash",
          contents: prompt,
          config: config
        });
        return response.text.trim();
      } catch (err) {
        attempts++;
        console.warn(`⚠️ Kalit xato berdi yoki limitga tushdi. Qolgan urinishlar: ${maxAttempts - attempts}. Xato: ${err.message}`);
        if (attempts >= maxAttempts) throw err;
        // Qisqa kutish
        await new Promise(r => setTimeout(r, 2000));
      }
    }
  }
}

export const geminiPool = new GeminiPool();