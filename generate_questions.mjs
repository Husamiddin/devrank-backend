import { prisma } from './src/lib/prisma.js';
import { geminiPool } from './src/lib/geminiPool.js';
import "dotenv/config";

// 4 Canonical yo'nalish: Web, AI, UX/UI, Cyber Security
export const CATEGORIES = ["web", "ai", "ux", "cyber"];

// AI ga har bir yo'nalish mazmuni bo'yicha batafsil ko'rsatmalar
const CATEGORY_NAMES = {
  web: "Web Development (JavaScript, React, Node.js, Express, REST API, DOM, asinxron dasturlash va algoritmlar)",
  ai: "Artificial Intelligence & Machine Learning (Python, ML modellari, Prompt Engineering, LLM, Vektorlar, Ma'lumotlarni tahlil qilish)",
  ux: "UI/UX Design & Frontend Layout (Figma tamoyillari, WCAG, CSS Flexbox/Grid, Responsive dizayn, Dizayn tizimlari)",
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
    if (fB !== -1 && lB !== -1) {
      return JSON.parse(sanitized.substring(fB, lB + 1));
    }
    throw e;
  }
}

function getPointRange(difficulty) {
  switch(difficulty.toLowerCase()) {
    case 'easy': return '15 dan 25 gacha';
    case 'medium': return '35 dan 55 gacha';
    case 'hard': return '65 dan 95 gacha';
    case 'extreme': return '100 dan 150 gacha';
    default: return '20';
  }
}

// Boyitilgan zaxira savollar banki (Gemini limitga tushganda yoki tarmoq uzilganda avtomatik qo'llaniladi)
const CURATED_BANK = {
  web: [
    // EASY
    {
      title: "Satrni teskari o'girish",
      description: "Berilgan satrni (string) teskari qilib qaytaruvchi solve(str) funksiyasini yozing.",
      category: "web", difficulty: "EASY", type: "CODE", points: 20, language: "javascript",
      starterCode: "function solve(str) {\n  // Kodingizni yozing\n  return str.split('').reverse().join('');\n}",
      inputExample: "'salom'", outputExample: "'molas'",
      testCases: [{ input: "salom", expected: "molas" }, { input: "Frontend", expected: "dnetnorF" }, { input: "abc", expected: "cba" }]
    },
    {
      title: "Juft sonlar yig'indisi",
      description: "Berilgan sonlar massividagi faqat juft sonlarning yig'indisini hisoblaydigan solve(arr) funksiyasini tuzing.",
      category: "web", difficulty: "EASY", type: "CODE", points: 20, language: "javascript",
      starterCode: "function solve(arr) {\n  // Juft sonlar yig'indisini qaytaring\n  \n}",
      inputExample: "[1, 2, 3, 4, 5, 6]", outputExample: "12",
      testCases: [{ input: [1, 2, 3, 4, 5, 6], expected: 12 }, { input: [1, 3, 5], expected: 0 }, { input: [2, 4, 8], expected: 14 }]
    },
    {
      title: "Unli harflar soni",
      description: "Berilgan satr ichida nechta ingliz unli harfi (a, e, i, o, u) borligini aniqlovchi solve(s) funksiyasini yozing.",
      category: "web", difficulty: "EASY", type: "CODE", points: 20, language: "javascript",
      starterCode: "function solve(s) {\n  // Unli harflar sonini qaytaring\n  \n}",
      inputExample: "'javascript'", outputExample: "3",
      testCases: [{ input: "javascript", expected: 3 }, { input: "hello world", expected: 3 }, { input: "xyz", expected: 0 }]
    },
    {
      title: "Massivdan takrorlanganlarni o'chirish",
      description: "Massiv elementlaridan takrorlangan qiymatlarni olib tashlab, faqat unikal qiymatlarni qaytaring.",
      category: "web", difficulty: "EASY", type: "CODE", points: 20, language: "javascript",
      starterCode: "function solve(arr) {\n  return [...new Set(arr)];\n}",
      inputExample: "[1, 2, 2, 3, 4, 4, 5]", outputExample: "[1, 2, 3, 4, 5]",
      testCases: [{ input: [1, 2, 2, 3], expected: [1, 2, 3] }, { input: ["a", "a", "b"], expected: ["a", "b"] }]
    },
    {
      title: "DOM 'DOMContentLoaded' hodisasi qachon ishga tushadi?",
      description: "Brauzerda 'DOMContentLoaded' hodisasi aynan qaysi holatda yuz beradi?",
      category: "web", difficulty: "EASY", type: "QUIZ", points: 20, language: "quiz",
      options: [
        "Faqat HTML hujjati to'liq tahlil qilinib (parse), DOM daraxti hosil bo'lganda",
        "HTML, rasm, video va barcha tashqi fayllar to'liq yuklangandan so'ng",
        "Foydalanuvchi sahifani pastga aylantirganda (scroll)",
        "CSS uslublar fayli serverdan yuklab olinayotganda"
      ],
      correctIndex: 0
    },
    {
      title: "JavaScript 'typeof null' natijasi nima?",
      description: "JavaScript tilida 'typeof null' amali qanday qiymat qaytaradi?",
      category: "web", difficulty: "EASY", type: "QUIZ", points: 20, language: "quiz",
      options: ["'null'", "'undefined'", "'object'", "'boolean'"],
      correctIndex: 2
    },
    {
      title: "HTTP 201 status kodi nimani bildiradi?",
      description: "RESTful API arxitekturasida HTTP 201 status javobi qanday ma'noni anglatadi?",
      category: "web", difficulty: "EASY", type: "QUIZ", points: 20, language: "quiz",
      options: [
        "So'rov muvaffaqiyatli bajarildi va yangi resurs yaratildi (Created)",
        "So'rov xato bo'lib, serverda resurs topilmadi (Not Found)",
        "Foydalanuvchi tizimga kirmagan (Unauthorized)",
        "Server ichki xatolikka uchradi (Internal Server Error)"
      ],
      correctIndex: 0
    },

    // MEDIUM
    {
      title: "Massivni qismlarga bo'lish (Chunk array)",
      description: "Berilgan massivni ko'rsatilgan 'size' o'lchamidagi kichik massivchalarga ajratuvchi solve(arr, size) funksiyasini yozing.",
      category: "web", difficulty: "MEDIUM", type: "CODE", points: 45, language: "javascript",
      starterCode: "function solve(arr, size) {\n  // Kodingizni yozing\n  \n}",
      inputExample: "([1, 2, 3, 4, 5], 2)", outputExample: "[[1, 2], [3, 4], [5]]",
      testCases: [
        { input: [[1, 2, 3, 4, 5], 2], expected: [[1, 2], [3, 4], [5]] },
        { input: [[1, 2, 3, 4], 2], expected: [[1, 2], [3, 4]] },
        { input: [[1], 1], expected: [[1]] }
      ]
    },
    {
      title: "Debounce mexanizmi nima maqsadda ishlatiladi?",
      description: "Frontend ishlab chiqishda 'Debounce' funksiyasidan qanday holatlarda foydalanish eng samarali hisoblanadi?",
      category: "web", difficulty: "MEDIUM", type: "QUIZ", points: 45, language: "quiz",
      options: [
        "Qidiruv maydoniga (input) tez yozilganda ortiqcha API so'rovlarini kamaytirish va oxirgi pauzadan keyin chaqirish",
        "Sahifani serverda render qilish (SSR) tezligini oshirish",
        "CSS animatsiyalarini 60fps tezlikda ushbad turish",
        "Ma'lumotlar bazasiga to'g'ridan-to'g'ri SQL so'rovlarini jo'natish"
      ],
      correctIndex: 0
    },
    {
      title: "React useMemo va useCallback farqi",
      description: "React freymvorkida useMemo va useCallback xuklari o'rtasidagi asosiy farq nima?",
      category: "web", difficulty: "MEDIUM", type: "QUIZ", points: 45, language: "quiz",
      options: [
        "useMemo hisoblangan qiymatni keshlaydi, useCallback esa funksiya havolasini keshlaydi",
        "useCallback faqat class komponentlarda ishlaydi",
        "useMemo har renderda serverga yangi so'rov yuboradi",
        "useCallback faqat DOM hodisalarini tinglash uchun xizmat qiladi"
      ],
      correctIndex: 0
    },
    {
      title: "Chuqur obyekt qiymatini olish (Get nested value)",
      description: "Obyekt va nuqtali yo'l (path) berilganda (masalan 'user.profile.name'), ichki qiymatni xavfsiz qaytaruvchi solve(obj, path) funksiyasini yozing.",
      category: "web", difficulty: "MEDIUM", type: "CODE", points: 45, language: "javascript",
      starterCode: "function solve(obj, path) {\n  return path.split('.').reduce((acc, part) => acc && acc[part], obj);\n}",
      inputExample: "({ a: { b: { c: 42 } } }, 'a.b.c')", outputExample: "42",
      testCases: [
        { input: [{ a: { b: { c: 42 } } }, "a.b.c"], expected: 42 },
        { input: [{ x: { y: "salom" } }, "x.y"], expected: "salom" }
      ]
    },
    {
      title: "CORS (Cross-Origin Resource Sharing) nima?",
      description: "Brauzerlarda CORS xavfsizlik mexanizmi nima uchun javobgar?",
      category: "web", difficulty: "MEDIUM", type: "QUIZ", points: 45, language: "quiz",
      options: [
        "Boshqa domendan keladigan AJAX so'rovlarini xavfsiz nazorat qilish va cheklash",
        "Foydalanuvchi parolini shifrlash uchun",
        "Sayt tezligini oshirish uchun statik fayllarni siqish",
        "Faqat mobil qurilmalarga sahifani ko'rsatish"
      ],
      correctIndex: 0
    },

    // HARD
    {
      title: "Asinxron qayta urinish (Retry with backoff)",
      description: "Qoidaga binoan asinxron operatsiyalar xatolikka uchraganda avtomatik qayta urinish amalga oshiriladi. Exponensial backoff formulasi qanday ishlaydi?",
      category: "web", difficulty: "HARD", type: "QUIZ", points: 80, language: "quiz",
      options: [
        "Har bir keyingi urinish oralig'idagi kutish vaqti eksponentsial oshadi: initialDelay * 2^attempt",
        "Har bir urinish oralig'ida aniq 1 soniya o'zgarmas kutish bo'ladi",
        "Urinishlar serverni darhol o'chirib qayta yoqadi",
        "Har safar kutish vaqti 2 barobar kamayadi"
      ],
      correctIndex: 0
    },
    {
      title: "LRU (Least Recently Used) Kesh hajmini cheklash",
      description: "LRU kesh algoritmi bo'yicha cheklangan hajm to'lganda qaysi element o'chiriladi?",
      category: "web", difficulty: "HARD", type: "QUIZ", points: 80, language: "quiz",
      options: [
        "Eng uzoq vaqt davomida foydalanilmagan (chaqirilmagan) element",
        "Hajmi eng katta bo'lgan element",
        "Eng oxirgi qo'shilgan element (LIFO)",
        "Eng ko'p marta xatolik bergan element"
      ],
      correctIndex: 0
    },
    {
      title: "Qator qavslar to'g'riligi (Valid Parentheses)",
      description: "Berilgan '()', '{}', '[]' qavslardan iborat satr to'g'ri yopilganligini tekshiruvchi solve(s) funksiyasini yozing. To'g'ri bo'lsa true, aks holda false qaytarsin.",
      category: "web", difficulty: "HARD", type: "CODE", points: 85, language: "javascript",
      starterCode: "function solve(s) {\n  const stack = [];\n  const pairs = { ')': '(', '}': '{', ']': '[' };\n  for (let ch of s) {\n    if (['(', '{', '['].includes(ch)) stack.push(ch);\n    else if (stack.pop() !== pairs[ch]) return false;\n  }\n  return stack.length === 0;\n}",
      inputExample: "'()[]{}'", outputExample: "true",
      testCases: [
        { input: "()[]{}", expected: true },
        { input: "(]", expected: false },
        { input: "([{}])", expected: true },
        { input: "((", expected: false }
      ]
    },

    // EXTREME
    {
      title: "WASM Memory Bridge arxitekturasi",
      description: "WebAssembly (WASM) va JavaScript Web Worker o'rtasida katta hajmdagi massivlarni nusxalamasdan (zero-copy) almashish uchun qanday mexanizm qo'llaniladi?",
      category: "web", difficulty: "EXTREME", type: "QUIZ", points: 130, language: "quiz",
      options: [
        "SharedArrayBuffer va WebAssembly.Memory orqali umumiy xotiraga to'g'ridan-to'g'ri ko'rsatkich (pointer) bilan murojaat qilish",
        "JSON.stringify qilib har soniyada postMessage orqali uzatish",
        "LocalStorage orqali matn sifatida saqlab o'qish",
        "Har bir ma'lumot uchun yangi HTTP so'rov ochish"
      ],
      correctIndex: 0
    },
    {
      title: "Event Loop microtask va macrotask navbati",
      description: "JavaScript V8 dvigatelida Promise.then (microtask) va setTimeout (macrotask) navbatda turganda ijro ketma-ketligi qanday bo'ladi?",
      category: "web", difficulty: "EXTREME", type: "QUIZ", points: 120, language: "quiz",
      options: [
        "Joriy sinxron kod tugashi bilanoq barcha microtask'lar to'liq bajariladi, so'ngra bitta macrotask olinadi",
        "setTimeout har doim Promise.then dan oldin bajariladi",
        "Ikkisi ham bitta navbatda turadi va tasodifiy tartibda ishlaydi",
        "Microtask'lar faqat sahifa qayta yuklanganda bajariladi"
      ],
      correctIndex: 0
    },
    {
      title: "Massivdagi eng uzun o'suvchi ketma-ketlik (LIS - O(n log n))",
      description: "Berilgan sonlar massividagi eng uzun qat'iy o'suvchi qism-ketma-ketlik uzunligini O(n log n) binar qidiruv bilan hisoblovchi solve(nums) funksiyasini yozing.",
      category: "web", difficulty: "EXTREME", type: "CODE", points: 140, language: "javascript",
      starterCode: "function solve(nums) {\n  if (!nums.length) return 0;\n  const tails = [];\n  for (let x of nums) {\n    let i = 0, j = tails.length;\n    while (i < j) {\n      let m = (i + j) >> 1;\n      if (tails[m] < x) i = m + 1;\n      else j = m;\n    }\n    tails[i] = x;\n  }\n  return tails.length;\n}",
      inputExample: "[10, 9, 2, 5, 3, 7, 101, 18]", outputExample: "4",
      testCases: [
        { input: [10, 9, 2, 5, 3, 7, 101, 18], expected: 4 },
        { input: [0, 1, 0, 3, 2, 3], expected: 4 },
        { input: [7, 7, 7, 7], expected: 1 }
      ]
    }
  ],

  ai: [
    // EASY
    {
      title: "Ikki vektorning skalyar ko'paytmasi (Dot Product)",
      description: "Bir xil uzunlikdagi ikkita sonli vektor berilganda ularning skalyar ko'paytmasini (dot product) hisoblovchi solve(v1, v2) funksiyasini yozing.",
      category: "ai", difficulty: "EASY", type: "CODE", points: 20, language: "python",
      starterCode: "def solve(v1, v2):\n    # v1 va v2 skalyar ko'paytmasini qaytaring\n    return sum(a * b for a, b in zip(v1, v2))",
      inputExample: "([1, 2, 3], [4, 5, 6])", outputExample: "32",
      testCases: [
        { input: [[1, 2, 3], [4, 5, 6]], expected: 32 },
        { input: [[1, 0], [0, 1]], expected: 0 },
        { input: [[2, 2], [3, 3]], expected: 12 }
      ]
    },
    {
      title: "Sigmoid faollashtirish funksiyasi nima qaytaradi?",
      description: "Sun'iy neyron tarmoqlarida Sigmoid funksiyasi kiruvchi x qiymatini qaysi oraliqqa siqadi?",
      category: "ai", difficulty: "EASY", type: "QUIZ", points: 20, language: "quiz",
      options: ["(0, 1) oralig'iga", "(-1, 1) oralig'iga", "(-∞, +∞) oralig'iga", "[0, 100] oralig'iga"],
      correctIndex: 0
    },
    {
      title: "Matnni tokenlarga ajratish (Tokenization)",
      description: "Berilgan matnni bo'shliqlar va tinish belgilari bo'yicha so'zlar ro'yxatiga ajratib qaytaruvchi solve(text) funksiyasini yozing.",
      category: "ai", difficulty: "EASY", type: "CODE", points: 20, language: "python",
      starterCode: "def solve(text):\n    return [w.lower() for w in text.split() if w]",
      inputExample: "'Salom suniy intellekt'", outputExample: "['salom', 'suniy', 'intellekt']",
      testCases: [
        { input: "Salom dunyo", expected: ["salom", "dunyo"] },
        { input: "AI ML Deep Learning", expected: ["ai", "ml", "deep", "learning"] }
      ]
    },
    {
      title: "Nazorat ostidagi ta'lim (Supervised Learning) nima?",
      description: "Machine Learningda Supervised Learning usulining asosiy xususiyati nimada?",
      category: "ai", difficulty: "EASY", type: "QUIZ", points: 20, language: "quiz",
      options: [
        "Model har bir kirish ma'lumotiga mos to'g'ri nishon (label/javob) bilan o'qitiladi",
        "Model faqat nishonsiz ma'lumotlar klasterini topadi",
        "Modelga hech qanday ma'lumot berilmaydi",
        "Faqat tasodifiy sonlar generatoridan foydalaniladi"
      ],
      correctIndex: 0
    },

    // MEDIUM
    {
      title: "Kosinus o'xshashligi (Cosine Similarity)",
      description: "Ikki vektor orasidagi burchak kosinusini hisoblash orqali semantik o'xshashlikni baholash formulasida qaysi qiymat to'liq moslikni bildiradi?",
      category: "ai", difficulty: "MEDIUM", type: "QUIZ", points: 45, language: "quiz",
      options: ["1.0 (vektorlar yo'nalishi to'liq bir xil)", "0.0 (vektorlar o'zaro perpendikulyar)", "-1.0", "100.0"],
      correctIndex: 0
    },
    {
      title: "One-Hot Encoding amalga oshirish",
      description: "Berilgan unikal toifalar ro'yxati va tanlangan element berilganda, uning binar one-hot vektorini qaytaruvchi solve(categories, item) funksiyasini yozing.",
      category: "ai", difficulty: "MEDIUM", type: "CODE", points: 45, language: "python",
      starterCode: "def solve(categories, item):\n    return [1 if c == item else 0 for c in categories]",
      inputExample: "(['it', 'mushuk', 'qush'], 'mushuk')", outputExample: "[0, 1, 0]",
      testCases: [
        { input: [["it", "mushuk", "qush"], "mushuk"], expected: [0, 1, 0] },
        { input: [["qizil", "yashil", "ko'k"], "qizil"], expected: [1, 0, 0] }
      ]
    },
    {
      title: "Prompt Injection xavfi nima?",
      description: "Katta til modellarida (LLM) 'Prompt Injection' hujumi qanday xavf tug'diradi?",
      category: "ai", difficulty: "MEDIUM", type: "QUIZ", points: 45, language: "quiz",
      options: [
        "Foydalanuvchi maxsus kiritgan ko'rsatma tizim qoidalarini (system prompt) chetlab o'tib, modelni noqonuniy xatti-harakatga majburlashi",
        "GPU xotirasini qizdirib yondirib yuborishi",
        "Model bazasidagi fayllarni to'g'ridan-to'g'ri o'chirib yuborishi",
        "Serverning internet provayderini o'zgartirishi"
      ],
      correctIndex: 0
    },
    {
      title: "Matn chastotasi (Term Frequency - TF) hisoblash",
      description: "Hujjatdagi so'zlar ro'yxati va maqsadli so'z berilganda, uning nisbiy uchrash chastotasini hisoblaydigan solve(words, target) funksiyasini tuzing.",
      category: "ai", difficulty: "MEDIUM", type: "CODE", points: 50, language: "python",
      starterCode: "def solve(words, target):\n    if not words: return 0\n    return words.count(target) / len(words)",
      inputExample: "(['ai', 'ml', 'ai', 'data'], 'ai')", outputExample: "0.5",
      testCases: [
        { input: [["ai", "ml", "ai", "data"], "ai"], expected: 0.5 },
        { input: [["a", "b", "c", "d"], "a"], expected: 0.25 }
      ]
    },

    // HARD
    {
      title: "RAG (Retrieval-Augmented Generation) arxitekturasi",
      description: "RAG tizimlarida embedding vektor qidiruvidan so'ng 'Re-ranking' bosqichi nima uchun kerak?",
      category: "ai", difficulty: "HARD", type: "QUIZ", points: 80, language: "quiz",
      options: [
        "Topilgan hujjat qismlarini kontekst dolzarbligi va semantik aniqligi bo'yicha qayta saralab, LLM ga eng muhimlarini uzatish",
        "Hujjatlardagi imlo xatolarini tekshirib tuzatish",
        "Modelni noldan qayta pre-train qilish",
        "Vektorlar bazasini tozalab tashlash"
      ],
      correctIndex: 0
    },
    {
      title: "Softmax funksiyasi hisoblash",
      description: "N sonli logitlar massivi berilganda, raqamli barqaror (numerically stable) Softmax ehtimolliklar taqsimotini hisoblovchi solve(logits) funksiyasini yozing.",
      category: "ai", difficulty: "HARD", type: "CODE", points: 85, language: "python",
      starterCode: "import math\n\ndef solve(logits):\n    max_val = max(logits)\n    exp_vals = [math.exp(x - max_val) for x in logits]\n    sum_exp = sum(exp_vals)\n    return [round(e / sum_exp, 3) for e in exp_vals]",
      inputExample: "[2.0, 1.0, 0.1]", outputExample: "[0.659, 0.242, 0.099]",
      testCases: [
        { input: [0, 0], expected: [0.5, 0.5] },
        { input: [1, 1, 1], expected: [0.333, 0.333, 0.333] }
      ]
    },

    // EXTREME
    {
      title: "Transformer KV-Cache xotira optimallash algoritmi",
      description: "LLM avtoregressiv generatsiya jarayonida 'KV-Cache' nima uchun hal qiluvchi ahamiyatga ega?",
      category: "ai", difficulty: "EXTREME", type: "QUIZ", points: 130, language: "quiz",
      options: [
        "Avvalgi tokenlarning Key va Value matritsalarini keshlab, har bir yangi token uchun barcha o'tgan tokenlarni qayta hisoblashni O(N^2) dan O(N) ga tushirish",
        "Matnni o'zbek tiliga tarjima qilish tezligini oshirish",
        "Model parametrlarining vaznlarini diskka saqlash",
        "Foydalanuvchilar sessiya kuki fayllarini boshqarish"
      ],
      correctIndex: 0
    },
    {
      title: "Scaled Dot-Product Attention hisoblash",
      description: "Q, K, V (Query, Key, Value) matritsalari berilganda Attention(Q, K, V) = softmax(Q * K^T / sqrt(d_k)) * V formulasiga muvofiq natija qatorini hisoblovchi solve(q, k, v, d_k) funksiyasini yozing.",
      category: "ai", difficulty: "EXTREME", type: "CODE", points: 140, language: "python",
      starterCode: "import math\n\ndef solve(q, k, v, d_k):\n    dot = sum(a * b for a, b in zip(q, k))\n    score = math.exp(dot / math.sqrt(d_k))\n    return [round(score * val, 3) for val in v]",
      inputExample: "([1, 0], [1, 0], [5, 10], 2)", outputExample: "[10.143, 20.287]",
      testCases: [
        { input: [[1, 0], [1, 0], [2, 4], 4], expected: [3.297, 6.595] }
      ]
    }
  ],

  ux: [
    // EASY
    {
      title: "Fitts qonuni (Fitts's Law) nimani tushuntiradi?",
      description: "Foydalanuvchi interfeysi (UI) dizaynida Fitts qonunining asosiy g'oyasi nima?",
      category: "ux", difficulty: "EASY", type: "QUIZ", points: 20, language: "quiz",
      options: [
        "Elementga yetib borish vaqti uning o'lchami va masofasiga bog'liq (katta va yaqin tugmalarni bosish osonroq)",
        "Sahifada qancha ko'p rang bo'lsa, shuncha yaxshi",
        "Foydalanuvchi matnni chapdan o'ngga o'qiydi",
        "Rasm hajmi qancha kichik bo'lsa, interfeys chiroyli bo'ladi"
      ],
      correctIndex: 0
    },
    {
      title: "HEX rangni RGB formatga o'tkazish",
      description: "Berilgan '#ffffff' kabi olti belgili HEX rang kodini [r, g, b] sonlar massiviga aylantiruvchi solve(hex) funksiyasini yozing.",
      category: "ux", difficulty: "EASY", type: "CODE", points: 20, language: "javascript",
      starterCode: "function solve(hex) {\n  hex = hex.replace('#', '');\n  return [\n    parseInt(hex.slice(0, 2), 16),\n    parseInt(hex.slice(2, 4), 16),\n    parseInt(hex.slice(4, 6), 16)\n  ];\n}",
      inputExample: "'#ff0000'", outputExample: "[255, 0, 0]",
      testCases: [
        { input: "#ff0000", expected: [255, 0, 0] },
        { input: "#00ff00", expected: [0, 255, 0] },
        { input: "#000000", expected: [0, 0, 0] }
      ]
    },
    {
      title: "WCAG bo'yicha minimal matn kontrasti qancha bo'lishi kerak?",
      description: "Oddiy o'lchamdagi matnlar uchun WCAG AA darajasida tavsiya etilgan minimal rang kontrasti nisbati nechaga teng?",
      category: "ux", difficulty: "EASY", type: "QUIZ", points: 20, language: "quiz",
      options: ["4.5:1 nisbatda", "2.0:1 nisbatda", "1.0:1 nisbatda", "10:1 nisbatda"],
      correctIndex: 0
    },
    {
      title: "Mobil ekranda minimal teginish maydoni (Tap Target)",
      description: "Tegiladigan tugmalar barmoq bilan bemalol bosilishi uchun minimal tavsiya qilingan o'lcham qancha?",
      category: "ux", difficulty: "EASY", type: "QUIZ", points: 20, language: "quiz",
      options: ["Kamida 44x44 yoki 48x48 piksel", "Kamida 10x10 piksel", "Kamida 100x100 piksel", "Cheklov yo'q"],
      correctIndex: 0
    },

    // MEDIUM
    {
      title: "REM birligini Pixel ga hisoblash",
      description: "Asosiy o'lcham basePx (masalan 16px) va rem qiymati berilganda uning pikseldagi qiymatini qaytaruvchi solve(rem, basePx) funksiyasini yozing.",
      category: "ux", difficulty: "MEDIUM", type: "CODE", points: 45, language: "javascript",
      starterCode: "function solve(rem, basePx = 16) {\n  return rem * basePx;\n}",
      inputExample: "(1.5, 16)", outputExample: "24",
      testCases: [
        { input: [1.5, 16], expected: 24 },
        { input: [2, 16], expected: 32 },
        { input: [0.75, 16], expected: 12 }
      ]
    },
    {
      title: "Gik qonuni (Hick's Law) nimani ta'kidlaydi?",
      description: "Interfeysda qaror qabul qilish tezligiga doir Gik qonuni qanday tushuntiriladi?",
      category: "ux", difficulty: "MEDIUM", type: "QUIZ", points: 45, language: "quiz",
      options: [
        "Variantlar soni qancha ko'paysa, foydalanuvchining qaror qabul qilish vaqti logarifmik ravishda oshadi",
        "Har bir tugma qizil rangda bo'lishi shart",
        "Katta rasmlar yuklanish vaqtini sekinlashtiradi",
        "Interfeysda barcha elementlar bitta qatorda joylashishi kerak"
      ],
      correctIndex: 0
    },
    {
      title: "Figma Auto-Layout: Hug vs Fill farqi",
      description: "Figma dasturida 'Hug contents' va 'Fill container' xususiyatlari o'rtasidagi farq nima?",
      category: "ux", difficulty: "MEDIUM", type: "QUIZ", points: 45, language: "quiz",
      options: [
        "Hug o'z ichidagi bolalar o'lchamiga moslashadi, Fill esa ota konteynerning bo'sh joyini to'liq egallaydi",
        "Hug fon rangini o'chiradi, Fill faqat matnni kattalashtiradi",
        "Ikkalasi ham bir xil ishlaydi, faqat nomlanishi boshqacha",
        "Fill faqat SVG vektorlar uchun ishlatiladi"
      ],
      correctIndex: 0
    },

    // HARD
    {
      title: "CSS Nisbiy Luminans hisoblash",
      description: "WCAG kontrasti formulasi bo'yicha yorug'lik L = 0.2126*R + 0.7152*G + 0.0722*B hisoblanadi. Berilgan [r, g, b] rang uchun yaxlitlangan luminans qiymatini qaytaruvchi solve(rgb) funksiyasini yozing.",
      category: "ux", difficulty: "HARD", type: "CODE", points: 80, language: "javascript",
      starterCode: "function solve(rgb) {\n  const [r, g, b] = rgb.map(v => v / 255);\n  const L = 0.2126 * r + 0.7152 * g + 0.0722 * b;\n  return Math.round(L * 100) / 100;\n}",
      inputExample: "[255, 255, 255]", outputExample: "1",
      testCases: [
        { input: [255, 255, 255], expected: 1 },
        { input: [0, 0, 0], expected: 0 },
        { input: [255, 0, 0], expected: 0.21 }
      ]
    },
    {
      title: "Accessible Modal Focus Trap mexanizmi",
      description: "Accessibility (a11y) standartiga ko'ra modal oyna ochilganda klaviatura fokusi (Tab) qanday ishlashi shart?",
      category: "ux", difficulty: "HARD", type: "QUIZ", points: 80, language: "quiz",
      options: [
        "Fokus faqat modal oyna ichidagi elementlar bo'yicha aylanib (trap), orqa fon elementlariga o'tib ketmasligi va Escape bilan yopilishi shart",
        "Fokus avtomatik tarzda brauzer URL qatoriga sakrashi kerak",
        "Klaviaturadan foydalanish to'liq o'chirib qo'yilishi lozim",
        "Faqat sichqoncha bilan bosilgandagina modal yopilishi kerak"
      ],
      correctIndex: 0
    },

    // EXTREME
    {
      title: "OKLab / CIELAB rang fazosida bir xil qadamli rang palitrasi",
      description: "Zamonaviy dizayn tizimlarida RGB o'rniga OKLab rang fazosidan foydalanishning asosiy ustunligi nimada?",
      category: "ux", difficulty: "EXTREME", type: "QUIZ", points: 130, language: "quiz",
      options: [
        "Inson ko'zi idroki bo'yicha bir xil yorug'lik (perceptually uniform) gradientlari va prognoz qilinadigan kontrast qadamlarini ta'minlaydi",
        "Fayl hajmini 90 foizga kichraytiradi",
        "Faqat qora va oq ranglarni qo'llab-quvvatlaydi",
        "Brauzer render tezligini kamaytiradi"
      ],
      correctIndex: 0
    },
    {
      title: "Responsive Clamped Typography hisoblagichi",
      description: "CSS clamp() funksiyasi uchun qiyalik (slope) koeffitsientini hisoblovchi solve(minPx, maxPx, minVw, maxVw) funksiyasini yozing.",
      category: "ux", difficulty: "EXTREME", type: "CODE", points: 140, language: "javascript",
      starterCode: "function solve(minPx, maxPx, minVw, maxVw) {\n  const slope = (maxPx - minPx) / (maxVw - minVw);\n  return Math.round(slope * 1000) / 1000;\n}",
      inputExample: "(16, 24, 320, 1200)", outputExample: "0.009",
      testCases: [
        { input: [16, 24, 320, 1200], expected: 0.009 },
        { input: [14, 28, 400, 1400], expected: 0.014 }
      ]
    }
  ],

  cyber: [
    // EASY
    {
      title: "Parol mustahkamligini tekshirish",
      description: "Parol kamida 8 ta belgidan iborat bo'lishi, bitta katta harf, bitta kichik harf va bitta raqamni o'z ichiga olishini tekshiruvchi solve(password) funksiyasini yozing.",
      category: "cyber", difficulty: "EASY", type: "CODE", points: 20, language: "javascript",
      starterCode: "function solve(password) {\n  const hasUpper = /[A-Z]/.test(password);\n  const hasLower = /[a-z]/.test(password);\n  const hasDigit = /[0-9]/.test(password);\n  return password.length >= 8 && hasUpper && hasLower && hasDigit;\n}",
      inputExample: "'Pass1234'", outputExample: "true",
      testCases: [
        { input: "Pass1234", expected: true },
        { input: "weak", expected: false },
        { input: "NO_DIGITS_HERE", expected: false },
        { input: "12345678", expected: false }
      ]
    },
    {
      title: "SQL Injection hujumi qanday amalga oshiriladi?",
      description: "Veb-ilovalarda SQL Injection (SQLi) zaifligi nimaning oqibatida vujudga keladi?",
      category: "cyber", difficulty: "EASY", type: "QUIZ", points: 20, language: "quiz",
      options: [
        "Foydalanuvchi kiritgan ma'lumotlar filtrlanmasdan to'g'ridan-to'g'ri SQL so'roviga matn sifatida qo'shib yuborilganda",
        "Server xotirasi yetishmay qolganda",
        "HTTPS protokoli yoqilmagan bo'lsa",
        "Foydalanuvchi juda uzun parol tanlaganda"
      ],
      correctIndex: 0
    },
    {
      title: "XSS (Cross-Site Scripting) zarari nima?",
      description: "XSS hujumi orqali xaker nimalarni qo'lga kiritishi mumkin?",
      category: "cyber", difficulty: "EASY", type: "QUIZ", points: 20, language: "quiz",
      options: [
        "Foydalanuvchining sessiya cookie fayllarini o'g'irlash, sahifada soxta shakllar ko'rsatish va uning nomidan amallar bajarish",
        "Serverning protsessorini jismoniy buzish",
        "Foydalanuvchi telefoniga bevosita SMS yuborish",
        "Router parolini tiklash"
      ],
      correctIndex: 0
    },
    {
      title: "HTML xavfli belgilarni zararsizlantirish (HTML Escape)",
      description: "XSS ning oldini olish uchun satrdagi &, <, >, \", ' belgilarini xavfsiz HTML entitiylariga almashtiruvchi solve(str) funksiyasini yozing.",
      category: "cyber", difficulty: "EASY", type: "CODE", points: 20, language: "javascript",
      starterCode: "function solve(str) {\n  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '\"': '&quot;', \"'\": '&#39;' };\n  return str.replace(/[&<>\"']/g, m => map[m]);\n}",
      inputExample: "'<script>'", outputExample: "'&lt;script&gt;'",
      testCases: [
        { input: "<script>", expected: "&lt;script&gt;" },
        { input: "alert(\"xss\")", expected: "alert(&quot;xss&quot;)" }
      ]
    },

    // MEDIUM
    {
      title: "Doimiy vaqtli satr taqqoslash (Timing Attack oldini olish)",
      description: "Parol yoki xesh tekshirganda Timing Attack oldini oluvchi tenglik tekshiruvi qanday ishlaydi?",
      category: "cyber", difficulty: "MEDIUM", type: "QUIZ", points: 45, language: "quiz",
      options: [
        "Birinchi xato belgida to'xtamasdan, satr oxirigacha doimiy vaqt davomida barcha belgilarni solishtiradi",
        "Taqqoslashdan oldin satrni teskari o'giradi",
        "Har doim tasodifiy kechikish qo'shadi",
        "Faqat birinchi 3 ta belgini tekshiradi"
      ],
      correctIndex: 0
    },
    {
      title: "Rate Limiter oynasi (Sliding Window)",
      description: "So'nggi 60 soniya ichidagi so'rovlar vaqti berilganda, belgilangan limit (maxRequests) dan oshgan-oshmaganligini tekshiruvchi solve(timestamps, now, maxRequests) funksiyasini yozing.",
      category: "cyber", difficulty: "MEDIUM", type: "CODE", points: 45, language: "javascript",
      starterCode: "function solve(timestamps, now, maxRequests) {\n  const valid = timestamps.filter(t => now - t <= 60);\n  return valid.length <= maxRequests;\n}",
      inputExample: "([10, 20, 50], 65, 3)", outputExample: "true",
      testCases: [
        { input: [[10, 20, 50], 65, 3], expected: true },
        { input: [[10, 20, 30, 40], 65, 3], expected: false }
      ]
    },
    {
      title: "JWT tokenda 'none' algoritmi hujumi",
      description: "JSON Web Token (JWT) da 'alg': 'none' zaifligi xakerga qanday imkoniyat beradi?",
      category: "cyber", difficulty: "MEDIUM", type: "QUIZ", points: 45, language: "quiz",
      options: [
        "Imzosiz tokenni server tekshiruvidan o'tkazib, admin huquqlarini noqonuniy qo'lga kiritish",
        "Server ma'lumotlar bazasini o'chirib yuborish",
        "Foydalanuvchi kompyuterini o'chirib qo'yish",
        "Internet tezligini 0 ga tushirish"
      ],
      correctIndex: 0
    },

    // HARD
    {
      title: "CSRF token va SameSite cookie himoyasi",
      description: "Cross-Site Request Forgery (CSRF) hujumiga qarshi eng zamonaviy va samarali brauzer himoyasi nima?",
      category: "cyber", difficulty: "HARD", type: "QUIZ", points: 80, language: "quiz",
      options: [
        "Sessiya cookie fayllariga 'SameSite=Lax' yoki 'SameSite=Strict' atributini qo'yish va nozik so'rovlarda CSRF token tekshirish",
        "Saytni faqat HTTP protokolida ishlatish",
        "Foydalanuvchiga har bir sahifada qayta captcha yechtirish",
        "Barcha GET so'rovlarini POST ga almashtirish"
      ],
      correctIndex: 0
    },
    {
      title: "Bitmask orqali RBAC huquqlarini tekshirish",
      description: "Foydalanuvchi huquqlari bitmaski va talab qilingan huquq bitmaski berilganda, kerakli barcha huquqlar mavjudligini tekshiruvchi solve(userMask, requiredMask) funksiyasini yozing.",
      category: "cyber", difficulty: "HARD", type: "CODE", points: 80, language: "javascript",
      starterCode: "function solve(userMask, requiredMask) {\n  return (userMask & requiredMask) === requiredMask;\n}",
      inputExample: "(7, 3)", outputExample: "true",
      testCases: [
        { input: [7, 3], expected: true },
        { input: [4, 3], expected: false },
        { input: [15, 8], expected: true }
      ]
    },

    // EXTREME
    {
      title: "Zero-Knowledge Proof (ZKP) tamoyili",
      description: "Zero-Knowledge Proof kriptografik protokolining mohiyati nimada?",
      category: "cyber", difficulty: "EXTREME", type: "QUIZ", points: 130, language: "quiz",
      options: [
        "Isbotlovchi tomon o'zidagi maxfiy ma'lumotning o'zini oshkor qilmasdan turib, unga ega ekanligini matematik isbotlab berishi",
        "Barcha parollarni ochiq matnda saqlash",
        "Serverda hech qanday hisob-kitob bajarmaslik",
        "Faqat 0 raqamidan iborat kalitlar bilan shifrlash"
      ],
      correctIndex: 0
    },
    {
      title: "Replay Attack himoyasi: Rolling Nonce Validator",
      description: "Qabul qilingan nonce va uning timestamp qiymatini tekshiruvchi funksiya yozing. Agar timestamp joriy vaqtdan 30 soniyadan ko'p farq qilsa yoki nonce avval ishlatilgan bo'lsa false, aks holda true qaytarsin.",
      category: "cyber", difficulty: "EXTREME", type: "CODE", points: 140, language: "javascript",
      starterCode: "function solve(nonce, timestamp, usedNonces, now) {\n  if (Math.abs(now - timestamp) > 30) return false;\n  if (usedNonces.includes(nonce)) return false;\n  return true;\n}",
      inputExample: "('n123', 100, ['n100'], 115)", outputExample: "true",
      testCases: [
        { input: ["n123", 100, ["n100"], 115], expected: true },
        { input: ["n100", 100, ["n100"], 115], expected: false },
        { input: ["n999", 50, [], 100], expected: false }
      ]
    }
  ]
};

// Generatsiya qilingan savolni bazaga qo'shish
async function insertQuestion(q, category, difficulty) {
  const isQuiz = q.type === "QUIZ";
  const qLang = isQuiz ? "quiz" : (q.language || (category === 'ai' ? 'python' : 'javascript'));
  const baseSlug = (category + '-' + (q.title || "task")).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const uniqueSlug = `${baseSlug}-${Math.random().toString(36).substring(2, 7)}`;

  const unitTests = (q.testCases || []).map(tc => ({
    input: tc.input,
    expected: tc.expected !== undefined ? tc.expected : tc.expectedOutput,
    expectedOutput: tc.expected !== undefined ? tc.expected : tc.expectedOutput
  }));

  const starterCode = isQuiz ? "" : (q.starterCode || (qLang === 'python' ? 'def solve(*args):\n    pass' : 'function solve(...args) {\n\n}'));

  await prisma.challenge.create({
    data: {
      title: q.title || "Topshiriq",
      slug: uniqueSlug,
      category: category,
      type: isQuiz ? "QUIZ" : "CODE",
      language: qLang,
      difficulty: difficulty.toUpperCase(),
      description: q.description || "Tavsif yo'q",
      starterCode: starterCode,
      inputExample: q.inputExample ? String(q.inputExample) : null,
      outputExample: q.outputExample ? String(q.outputExample) : null,
      points: Number(q.points) || (difficulty.toUpperCase() === 'EXTREME' ? 120 : difficulty.toUpperCase() === 'HARD' ? 80 : 35),
      published: true,
      tests: isQuiz ? { checks: [] } : { unitTests },
      quiz: isQuiz ? {
        question: q.description,
        options: q.options || [],
        correctIndex: Number(q.correctIndex) || 0
      } : null
    }
  });
}

// Bitta kategoriya va qiyinlik uchun vazifalar generatsiya qilish
export async function generateTasksForCategory(category, difficulty, count = 5, maxTarget = 50) {
  const currentCount = await prisma.challenge.count({ where: { category } });
  if (currentCount >= maxTarget) {
    return 0;
  }

  const need = Math.min(count, maxTarget - currentCount);
  const pointsRange = getPointRange(difficulty);
  console.log(`\n⏳ [${category.toUpperCase()}] uchun ${need} ta [${difficulty.toUpperCase()}] vazifa so'ralmoqda (${pointsRange} pts)...`);

  const langHint = category === 'ai' ? 'python' : (category === 'web' ? 'javascript yoki python' : 'javascript');

  const prompt = `
Siz professional Senior IT-Ekspert va dasturlash bo'yicha imtihon tuzuvchisisiz.
Barcha matnlar, sarlavha, tavsiflar, savollar va variantlar FAQAT va FAQAT ravon O'zbek tilida (lotin yozuvida) bo'lishi shart!

Menga "${CATEGORY_NAMES[category] || category}" yo'nalishi bo'yicha aniq ${need} ta yangi va xilma-xil yuqori sifatli topshiriq tuzib bering.
Qiyinlik darajasi: "${difficulty.toUpperCase()}".
Har bir savol uchun ballni (points) quyidagi oraliqda tasodifiy qilib belgilang: ${pointsRange}.

Talablar:
- Savollarning yarmi "QUIZ" (4 ta variantli nazariy test), yarmi esa "CODE" (amaliy funksiya yozish masalasi) bo'lsin.
- CODE masalalari uchun:
  * "starterCode": funksiya nomi aniq "solve" bo'lsin
  * "testCases": kamida 2-3 ta test case (input va expected)
  * "inputExample" va "outputExample" misollar
  * Dasturlash tili (${langHint}) bo'lsin.
- QUIZ savollari uchun:
  * "description": savol sharti
  * "options": 4 ta aniq variant
  * "correctIndex": to'g'ri variant indeksi (0, 1, 2 yoki 3)

Javobni FAQAT valid JSON massiv formatida qaytaring:
[
  {
    "title": "...",
    "description": "...",
    "category": "${category}",
    "difficulty": "${difficulty.toUpperCase()}",
    "type": "QUIZ",
    "points": 25,
    "options": ["...", "...", "...", "..."],
    "correctIndex": 0
  },
  {
    "title": "...",
    "description": "...",
    "category": "${category}",
    "difficulty": "${difficulty.toUpperCase()}",
    "type": "CODE",
    "points": 45,
    "language": "${category === 'ai' ? 'python' : 'javascript'}",
    "starterCode": "...",
    "inputExample": "...",
    "outputExample": "...",
    "testCases": [{ "input": "...", "expected": "..." }]
  }
]
`;

  let added = 0;

  try {
    const textResponse = await geminiPool.generateWithRetry(prompt);
    const data = safeJSONParse(textResponse);

    for (const q of data) {
      const nowTotal = await prisma.challenge.count({ where: { category } });
      if (nowTotal >= maxTarget) break;
      await insertQuestion(q, category, difficulty);
      added++;
    }
    console.log(`✅ ${added} ta vazifa [${category.toUpperCase()} - ${difficulty.toUpperCase()}] Gemini AI orqali bazaga qo'shildi.`);
    return added;
  } catch (err) {
    console.warn(`⚠️ Gemini AI generatsiyasida to'siq bo'ldi (${err.message}). Boyitilgan zaxira bankidan olinmoqda...`);
    const bank = CURATED_BANK[category] || [];
    const matching = bank.filter(b => b.difficulty.toUpperCase() === difficulty.toUpperCase());
    const candidates = matching.length > 0 ? matching : bank;

    for (const q of candidates) {
      const nowTotal = await prisma.challenge.count({ where: { category } });
      if (nowTotal >= maxTarget || added >= need) break;
      await insertQuestion(q, category, difficulty);
      added++;
    }

    console.log(`✅ ${added} ta zaxira vazifa [${category.toUpperCase()} - ${difficulty.toUpperCase()}] bazaga qo'shildi.`);
    return added;
  }
}

// Barcha toifalarni aniq 50 tadan savolga yetkazish
export async function fillAllCategoriesTo50(target = 50) {
  console.log(`\n======================================================`);
  console.log(`🚀 MaqsadCode: Har bir yo'nalishni aniq ${target} tadan savolga yetkazish`);
  console.log(`======================================================`);

  // Avval barcha mavjud savollar qiyinligini UPPERCASE formatga keltiramiz
  const allCurrent = await prisma.challenge.findMany({ select: { id: true, difficulty: true } });
  for (const c of allCurrent) {
    if (c.difficulty !== c.difficulty.toUpperCase()) {
      await prisma.challenge.update({
        where: { id: c.id },
        data: { difficulty: c.difficulty.toUpperCase() }
      });
    }
  }

  const DIFFICULTIES = ["EASY", "MEDIUM", "HARD", "EXTREME"];

  for (const cat of CATEGORIES) {
    let count = await prisma.challenge.count({ where: { category: cat } });
    console.log(`\n📂 [${cat.toUpperCase()}]: Hozirgi savollar soni = ${count} ta. Maqsad = ${target} ta.`);

    let diffIdx = 0;
    let round = 0;

    while (count < target && round < 30) {
      round++;
      const diff = DIFFICULTIES[diffIdx % DIFFICULTIES.length];
      diffIdx++;

      const need = Math.min(4, target - count);
      const added = await generateTasksForCategory(cat, diff, need, target);
      count = await prisma.challenge.count({ where: { category: cat } });

      console.log(`   📊 [${cat.toUpperCase()}] joriy holat: ${count}/${target}`);

      if (count >= target) {
        console.log(`   🎉 [${cat.toUpperCase()}] yo'nalishi to'liq ${target} ta bo'ldi!`);
        break;
      }

      // Qisqa tanaffus (API rate limit saqlash uchun)
      await new Promise(r => setTimeout(r, 2000));
    }
  }

  console.log(`\n======================================================`);
  console.log(`🏁 YAKUNIY NATIJALAR:`);
  let grandTotal = 0;
  for (const cat of CATEGORIES) {
    const finalCount = await prisma.challenge.count({ where: { category: cat } });
    grandTotal += finalCount;
    const diffs = await prisma.challenge.groupBy({
      by: ['difficulty'],
      where: { category: cat },
      _count: true
    });
    const diffStr = diffs.map(d => `${d.difficulty}: ${d._count}`).join(', ');
    console.log(`- ${cat.toUpperCase()}: ${finalCount} ta (${diffStr})`);
  }
  console.log(`Jami bazadagi topshiriqlar soni: ${grandTotal} ta!`);
  console.log(`======================================================\n`);
}

async function run() {
  const args = process.argv.slice(2);
  const targetCategory = args[0] ? args[0].toLowerCase() : "fill";

  if (targetCategory === "fill" || targetCategory === "all" || targetCategory === "50") {
    const targetNum = parseInt(args[1] || args[0], 10) || 50;
    await fillAllCategoriesTo50(targetNum);
    return;
  }

  const targetDiff = args[1] ? args[1].toLowerCase() : "all";
  const targetCount = parseInt(args[2], 10) || 5;

  console.log("🚀 MaqsadCode AI Savollar Generatsiyasi tizimi ishga tushdi...");
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
    for (const diff of diffsToRun) {
      const added = await generateTasksForCategory(cat, diff, targetCount, 50);
      totalAdded += added;
      await new Promise(r => setTimeout(r, 3000));
    }
  }

  console.log(`\n🎉 Jami ${totalAdded} ta yangi topshiriq generatsiya qilindi!`);
}

if (process.argv[1]?.includes('generate_questions.mjs')) {
  run().catch(console.error).finally(() => prisma.$disconnect());
}