import { prisma } from "../lib/prisma.js";

async function main() {
  const compId = "cmtpnj4kh0000tpq0s4fv06nx"; // AI 2026 (2-seriya)

  console.log("Checking competition:", compId);
  const comp = await prisma.competition.findUnique({ where: { id: compId } });
  if (!comp) {
    console.error("Competition not found!");
    process.exit(1);
  }

  // Update startsAt to now - 1 hour, endsAt to +3 days so it's currently active!
  const now = new Date();
  const startsAt = new Date(now.getTime() - 60 * 60 * 1000);
  const endsAt = new Date(now.getTime() + 72 * 60 * 60 * 1000);

  await prisma.competition.update({
    where: { id: compId },
    data: {
      status: "ACTIVE",
      startsAt,
      endsAt,
      description: "AI 2026 (2-seriya) — Sun'iy intellekt, Prompt Engineering, AI Video/Rasm va Machine Learning olimpiadasi."
    }
  });

  console.log("Updated competition times to be active.");

  // Clear existing questions for this competition
  await prisma.competitionAnswer.deleteMany({
    where: { question: { competitionId: compId } }
  });
  await prisma.competitionQuestion.deleteMany({
    where: { competitionId: compId }
  });

  console.log("Cleared old questions.");

  // 1-20: Easy (30 pts each)
  const easyQuestions = [
    {
      q: "System Prompt (Tizimli prompt) nima va uning asosiy vazifasi qanday?",
      options: [
        "Modelning o'zini tutishi, roli, cheklovlari va javob berish uslubini belgilab beruvchi boshlang'ich ko'rsatma",
        "Operatsion tizimni o'rnatish kodi",
        "Grafik kartani yangilash skripti",
        "Faqat foydalanuvchi ismini saqlovchi matn"
      ],
      a: "Modelning o'zini tutishi, roli, cheklovlari va javob berish uslubini belgilab beruvchi boshlang'ich ko'rsatma"
    },
    {
      q: "Zero-Shot prompting usuli nimani anglatadi?",
      options: [
        "Modelga hech qanday misol keltirmasdan to'g'ridan-to'g'ri topshiriqni bajarishni so'rash",
        "Modelni o'chirish buyrug'i",
        "Kodni xatosiz kompyuterda ishlatish",
        "Modelga 10 tadan ko'p misol berish"
      ],
      a: "Modelga hech qanday misol keltirmasdan to'g'ridan-to'g'ri topshiriqni bajarishni so'rash"
    },
    {
      q: "Few-Shot prompting usulida qanday yondashuv qo'llaniladi?",
      options: [
        "Topshiriqdan oldin modelga bir nechta kirish-chiqish (input-output) namunalari ko'rsatiladi",
        "Modelga faqat bitta harf yoziladi",
        "Model har 5 daqiqada qayta o'qitiladi",
        "Barcha javoblar tasodifiy tanlanadi"
      ],
      a: "Topshiriqdan oldin modelga bir nechta kirish-chiqish (input-output) namunalari ko'rsatiladi"
    },
    {
      q: "LLM larda Temperature parametri 0.0 ga o'rnatilsa, natija qanday bo'ladi?",
      options: [
        "Javoblar maksimal darajada deterministik, aniq va bir xil bo'ladi (tasodifiylik yo'qoladi)",
        "Model mutlaqo javob bermay to'xtab qoladi",
        "Model eng ijodiy va tasodifiy javoblarni beradi",
        "Model kompyuterni qizdiradi"
      ],
      a: "Javoblar maksimal darajada deterministik, aniq va bir xil bo'ladi (tasodifiylik yo'qoladi)"
    },
    {
      q: "Top-P (Nucleus Sampling) parametri nimani boshqaradi?",
      options: [
        "Ehtimolliklari yig'indisi P ga teng bo'lgan eng yuqori ehtimolli tokenlar to'plamidan tanlashni",
        "Protsessor quvvatini",
        "Fayl hajmini",
        "Foydalanuvchi akkauntini"
      ],
      a: "Ehtimolliklari yig'indisi P ga teng bo'lgan eng yuqori ehtimolli tokenlar to'plamidan tanlashni"
    },
    {
      q: "Sun'iy intellektda Hallucination (Gallyutsinatsiya) nima?",
      options: [
        "Model haqiqatga to'g'ri kelmaydigan, to'qima faktlarni qat'iy ishonch bilan yaratishi",
        "Modelning internet tezligi pasayishi",
        "Modelning monitorda rasm chizishi",
        "Koddagi sintaktik xatolik"
      ],
      a: "Model haqiqatga to'g'ri kelmaydigan, to'qima faktlarni qat'iy ishonch bilan yaratishi"
    },
    {
      q: "RAG (Retrieval-Augmented Generation) texnologiyasining asosiy maqsadi nima?",
      options: [
        "Modelga tashqi bilimlar bazasidan tegishli ma'lumotlarni qidirib topib, kontekstga qo'shib berish",
        "Modelni noldan qayta o'qitish",
        "Rasmlarni siqish",
        "Faqat ingliz tilida ishlashga majburlash"
      ],
      a: "Modelga tashqi bilimlar bazasidan tegishli ma'lumotlarni qidirib topib, kontekstga qo'shib berish"
    },
    {
      q: "Matn Embeddingi (Text Embedding) deganda nima tushuniladi?",
      options: [
        "Matn ma'nosini ko'p o'lchamli fazodagi sonlar vektori (float massiv) ko'rinishida ifodalash",
        "Matnni shifrlab yashirish",
        "Matn shriftini o'zgartirish",
        "Matnni arxivga solish"
      ],
      a: "Matn ma'nosini ko'p o'lchamli fazodagi sonlar vektori (float massiv) ko'rinishida ifodalash"
    },
    {
      q: "Transformer arxitekturasi 2017-yilda Google jamoasining qaysi mashhur maqolasida e'lon qilingan?",
      options: [
        "Attention Is All You Need",
        "Deep Residual Learning",
        "Generative Adversarial Nets",
        "Mastering the Game of Go"
      ],
      a: "Attention Is All You Need"
    },
    {
      q: "Tokenizer (Tokenizator) LLM pipeline'ida qanday vazifani bajaradi?",
      options: [
        "Xom matnni model qabul qila oladigan sonli token identifikatorlariga (ID larga) aylantiradi",
        "Javobni foydalanuvchiga ovoz chiqarib o'qib beradi",
        "Faqat tinish belgilarini o'chiradi",
        "Xotiradagi keshni tozalaydi"
      ],
      a: "Xom matnni model qabul qila oladigan sonli token identifikatorlariga (ID larga) aylantiradi"
    },
    {
      q: "Vibe Coding atamasi zamonaviy dasturlashda nimani anglatadi?",
      options: [
        "Dasturchi har bir kod qatorini qo'lda yozmasdan, tabiiy tilda AI agentlariga yo'nalish berib dastur yaratishi",
        "Musiqa tinglab xatosiz kod yozish",
        "Hech qanday kutubxonalardan foydalanmaslik",
        "Faqat assembler tilida ishlash"
      ],
      a: "Dasturchi har bir kod qatorini qo'lda yozmasdan, tabiiy tilda AI agentlariga yo'nalish berib dastur yaratishi"
    },
    {
      q: "Context Window (Kontekst oynasi) chegarasidan oshib ketilsa nima yuz beradi?",
      options: [
        "Avvalgi so'zlashuv konteksti unutiladi yoki xatolik qaytariladi",
        "Model javob berish tezligi 10 barobar oshadi",
        "Kompyuter o'chib qoladi",
        "Model avtomatik pullik rejimidan chiqadi"
      ],
      a: "Avvalgi so'zlashuv konteksti unutiladi yoki xatolik qaytariladi"
    },
    {
      q: "Prompt Injection hujumining mohiyati nimada?",
      options: [
        "Foydalanuvchi kiritgan hiylali matn orqali modelning asl xavfsizlik ko'rsatmalarini buzib o'tish",
        "Sayt serveriga DDoS hujum qilish",
        "SQL ma'lumotlar bazasini o'chirish",
        "Brauzer keshini tozalash"
      ],
      a: "Foydalanuvchi kiritgan hiylali matn orqali modelning asl xavfsizlik ko'rsatmalarini buzib o'tish"
    },
    {
      q: "Multimodal (Ko'p modalli) AI modeli nimasi bilan ajralib turadi?",
      options: [
        "Bir vaqtning o'zida matn, rasm, audio va video ma'lumotlarni tushunish va qayta ishlash qobiliyatiga ega",
        "Faqat bitta tilda gaplasha oladi",
        "Faqat smartfonda ishlaydi",
        "Internet bo'lmasa ishlamaydi"
      ],
      a: "Bir vaqtning o'zida matn, rasm, audio va video ma'lumotlarni tushunish va qayta ishlash qobiliyatiga ega"
    },
    {
      q: "Role Prompting (Rol belgilash) texnikasining foydasi nimada?",
      options: [
        "Modelga aniq soha mutaxassisi (masalan: 'Sen 10 yillik Senior Python arxitektori...') rolini berish orqali javob sifatini keskin oshirish",
        "Modelning xotirasini tejash",
        "API narxini pasaytirish",
        "Modelni tezroq yuklash"
      ],
      a: "Modelga aniq soha mutaxassisi (masalan: 'Sen 10 yillik Senior Python arxitektori...') rolini berish orqali javob sifatini keskin oshirish"
    },
    {
      q: "Vektor ma'lumotlar bazasi (Vector Database) nima uchun maxsus ishlab chiqilgan?",
      options: [
        "Millionlab yuqori o'lchamli vektorlar orasida semantik yaqinlik (KNN) qidiruvini tez bajarish uchun",
        "Faqat rasmlarni saqlash uchun",
        "Parollarni shifrlash uchun",
        "Log fayllarni yozish uchun"
      ],
      a: "Millionlab yuqori o'lchamli vektorlar orasida semantik yaqinlik (KNN) qidiruvini tez bajarish uchun"
    },
    {
      q: "Sun'iy intellektda 'Grounding' nimani bildiradi?",
      options: [
        "Model javoblarini ishonchli, tekshirilgan real ma'lumotlar va manbalarga tayanishini ta'minlash",
        "Modelni serverdan diskka nusxalash",
        "Tarmoq simlarini yerga ulash",
        "Tokenlar sonini nolga tushirish"
      ],
      a: "Model javoblarini ishonchli, tekshirilgan real ma'lumotlar va manbalarga tayanishini ta'minlash"
    },
    {
      q: "Agentic AI (Sun'iy intellekt agenti) ning oddiy LLM dan asosiy ustunligi nima?",
      options: [
        "Mustaqil rejalashtirish, asboblardan (web qidiruv, kod bajarish, API) foydalanish va ko'p bosqichli maqsadlarni bajarish qobiliyati",
        "Faqat qisqa javob qaytarishi",
        "Hech qachon internetga ulanmasligi",
        "Faqat bitta savolga javob bera olishi"
      ],
      a: "Mustaqil rejalashtirish, asboblardan (web qidiruv, kod bajarish, API) foydalanish va ko'p bosqichli maqsadlarni bajarish qobiliyati"
    },
    {
      q: "Fine-Tuning (Modelni moslashtirish) qachon eng maqbul hisoblanadi?",
      options: [
        "Modelni ma'lum bir tor soha uslubiga, yangi jargoniga yoki qat'iy formatga o'rgatish kerak bo'lganda",
        "Har kuni yangi yangiliklar haqida bilishi kerak bo'lganda",
        "Modelning narxi yoqmaganda",
        "Faqat bitta savol berish uchun"
      ],
      a: "Modelni ma'lum bir tor soha uslubiga, yangi jargoniga yoki qat'iy formatga o'rgatish kerak bo'lganda"
    },
    {
      q: "Stop Sequences (To'xtatish ketma-ketliklari) nima uchun ishlatiladi?",
      options: [
        "Model belgilangan so'z yoki belgiga yetganda keyingi javob yaratishni darhol to'xtatishi uchun",
        "Serverni o'chirib qo'yish uchun",
        "Kompilyatsiyani to'xtatish uchun",
        "Internet aloqasini uzish uchun"
      ],
      a: "Model belgilangan so'z yoki belgiga yetganda keyingi javob yaratishni darhol to'xtatishi uchun"
    }
  ];

  // 21-35: Medium (50 pts each)
  const mediumQuestions = [
    {
      q: "Chain-of-Thought (CoT - Fikrlar zanjiri) prompting qanday muammolarni hal qiladi?",
      options: [
        "Modelga murakkab masalani bosqichma-bosqich fikrlab yechishni buyurish orqali mantiqiy va matematik xatolarni kamaytiradi",
        "Modelning javobini 1 ta so'zga qisqartiradi",
        "Tasodifiy javob tanlashni majburlaydi",
        "Xotira sarfini nolga tushiradi"
      ],
      a: "Modelga murakkab masalani bosqichma-bosqich fikrlab yechishni buyurish orqali mantiqiy va matematik xatolarni kamaytiradi"
    },
    {
      q: "ReAct (Reasoning + Acting) freymvorki sikli qaysi ketma-ketlikda ishlaydi?",
      options: [
        "Fikrlash (Thought) -> Harakat (Action) -> Kuzatuv (Observation) -> Xulosa",
        "Kod yozish -> Kompilyatsiya -> O'chirish",
        "Qidiruv -> Chop etish -> Yuklash",
        "Ovoz yozish -> Tarjima -> To'xtash"
      ],
      a: "Fikrlash (Thought) -> Harakat (Action) -> Kuzatuv (Observation) -> Xulosa"
    },
    {
      q: "LoRA (Low-Rank Adaptation) usulining nozik sozlashdagi (fine-tuning) bosh ustunligi nimada?",
      options: [
        "Barcha og'irliklarni emas, faqat kichik past darajali qo'shimcha matritsalarni o'qitish orqali VRAM xarajatini keskin kamaytiradi",
        "Model hajmini 100 barobar kattalashtiradi",
        "Modelni faqat bitta GPU da ishlatishni taqiqlaydi",
        "Faqat matnsiz modellarda ishlaydi"
      ],
      a: "Barcha og'irliklarni emas, faqat kichik past darajali qo'shimcha matritsalarni o'qitish orqali VRAM xarajatini keskin kamaytiradi"
    },
    {
      q: "Quantization (Kvantlash - masalan 16-bit dan 4-bit ga) modelga qanday ta'sir qiladi?",
      options: [
        "Modelning xotira (RAM/VRAM) talabini bir necha barobar kamaytiradi, deyarli sifatni yo'qotmagan holda",
        "Modelni butunlay yaroqsiz qiladi",
        "Modelning parametrlar sonini oshiradi",
        "Model faqat Windowsda ishlaydigan bo'lib qoladi"
      ],
      a: "Modelning xotira (RAM/VRAM) talabini bir necha barobar kamaytiradi, deyarli sifatni yo'qotmagan holda"
    },
    {
      q: "GGUF formati asosan qaysi kutubxona va maqsad uchun yaratilgan?",
      options: [
        "llama.cpp loyihasida modellarni oddiy protsessorda (CPU) samarali ishlatish va bitta faylda saqlash uchun",
        "Faqat NVIDIA superkompyuterlarida ishlash uchun",
        "Audio fayllarni MP3 ga aylantirish uchun",
        "JavaScript sintaksisini tekshirish uchun"
      ],
      a: "llama.cpp loyihasida modellarni oddiy protsessorda (CPU) samarali ishlatish va bitta faylda saqlash uchun"
    },
    {
      q: "Tree-of-Thoughts (ToT) texnikasining Chain-of-Thought (CoT) dan ustunligi nimada?",
      options: [
        "Model bir nechta fikrlash shoxlarini parallel ko'rib chiqadi, orqaga qayta oladi (backtracking) va eng yaxshi yo'lni baholaydi",
        "Faqat bitta to'g'ri chiziqli fikr yuritadi",
        "Har doim eng qisqa yo'lni tanlaydi",
        "Hech qanday qo'shimcha token sarflamaydi"
      ],
      a: "Model bir nechta fikrlash shoxlarini parallel ko'rib chiqadi, orqaga qayta oladi (backtracking) va eng yaxshi yo'lni baholaydi"
    },
    {
      q: "Self-Consistency (O'z-o'zini tekshirish) prompting usuli qanday ishlaydi?",
      options: [
        "Bir nechta mustaqil fikrlash zanjirlarini yaratib, eng ko'p takrorlangan yakuniy javobni (majority vote) tanlaydi",
        "Faqat bitta javobni 10 marta chop etadi",
        "Foydalanuvchidan tasdiqlash so'raydi",
        "Kodni xato deb topadi"
      ],
      a: "Bir nechta mustaqil fikrlash zanjirlarini yaratib, eng ko'p takrorlangan yakuniy javobni (majority vote) tanlaydi"
    },
    {
      q: "LLM larda Function Calling (Tool Calling) qanday ishlaydi?",
      options: [
        "Model matn o'rniga chaqirilishi kerak bo'lgan funksiya nomi va uning parametrlarini strukturalangan JSON formatida qaytaradi",
        "Model to'g'ridan-to'g'ri operatsion tizim terminalini buzib kiradi",
        "Model kodni o'zi ishga tushirib serverni to'xtatadi",
        "Faqat CSS kodlarini yaratadi"
      ],
      a: "Model matn o'rniga chaqirilishi kerak bo'lgan funksiya nomi va uning parametrlarini strukturalangan JSON formatida qaytaradi"
    },
    {
      q: "Prompt Leaking (Tizim promptini sizdirish) hujumidan qanday himoyalanish eng samarali?",
      options: [
        "Tizim promptiga qat'iy yo'riqnomalar qo'shish va kiruvchi/chiquvchi matnni filtrlovchi Guardrails tizimlaridan foydalanish",
        "Foydalanuvchiga hech narsa yozishga ruxsat bermaslik",
        "Internetni o'chirish",
        "Modelni har soatda yangilash"
      ],
      a: "Tizim promptiga qat'iy yo'riqnomalar qo'shish va kiruvchi/chiquvchi matnni filtrlovchi Guardrails tizimlaridan foydalanish"
    },
    {
      q: "Semantic Caching (Semantik keshlash) ning an'anaviy keshlashdan farqi nima?",
      options: [
        "Savollarning aniq so'zma-so'z mosligini emas, balki ularning ma'naviy (vektorli) yaqinligini hisobga olib keshdan javob beradi",
        "Faqat sonlarni keshlash bilan cheklanadi",
        "Keshni har daqiqada tozalaydi",
        "Faqat SQL so'rovlarini saqlaydi"
      ],
      a: "Savollarning aniq so'zma-so'z mosligini emas, balki ularning ma'naviy (vektorli) yaqinligini hisobga olib keshdan javob beradi"
    },
    {
      q: "Context Caching (Kontekstni keshlash) texnologiyasi qanday tejash imkonini beradi?",
      options: [
        "Takrorlanuvchi katta kontekst (hujjatlar, kodlar) serverda keshlanadi va qayta tokenizatsiya qilinmasdan narx va vaqtni 50-80% tejaydi",
        "Modelni kichraytiradi",
        "Elektr sarfini kamaytiradi",
        "Javobni o'chiradi"
      ],
      a: "Takrorlanuvchi katta kontekst (hujjatlar, kodlar) serverda keshlanadi va qayta tokenizatsiya qilinmasdan narx va vaqtni 50-80% tejaydi"
    },
    {
      q: "RAG tizimlarida Chunking (matnni bo'laklash) strategiyasining ahamiyati nimada?",
      options: [
        "Hujjatlarni semantik jihatdan mustaqil va qidiruv uchun optimal o'lchamdagi bo'laklarga ajratib, qidiruv aniqligini ta'minlaydi",
        "Hujjat hajmini sun'iy ko'paytirish uchun",
        "Faqat shriftlarni ajratish uchun",
        "Xavfsizlik kalitlarini yashirish uchun"
      ],
      a: "Hujjatlarni semantik jihatdan mustaqil va qidiruv uchun optimal o'lchamdagi bo'laklarga ajratib, qidiruv aniqligini ta'minlaydi"
    },
    {
      q: "Cosine Similarity (Kosinus o'xshashligi) vektor qidiruvida nima uchun eng ko'p afzal ko'riladi?",
      options: [
        "Vektorlar uzunligidan (hajmidan) qat'i nazar, ularning ko'p o'lchamli fazodagi yo'nalish burchagini aniq baholaydi",
        "Faqat 2D tekislikda ishlaydi",
        "Hisoblash uchun millionlab dollar talab qiladi",
        "Faqat manfiy sonlar bilan ishlaydi"
      ],
      a: "Vektorlar uzunligidan (hajmidan) qat'i nazar, ularning ko'p o'lchamli fazodagi yo'nalish burchagini aniq baholaydi"
    },
    {
      q: "Mixture of Experts (MoE - Mutaxassislar aralashmasi) arxitekturasida har bir token qanday qayta ishlanadi?",
      options: [
        "Geyting tarmog'i (Router) har bir token uchun faqat eng mos keluvchi 1-2 ta mutaxassis (expert) neyron qatlamini faollashtiradi",
        "Barcha milliardlab parametrlar har bir tokenda to'liq hisoblanadi",
        "Tokenlar tasodifiy o'chirib yuboriladi",
        "Faqat bitta expert butun matnni o'qiydi"
      ],
      a: "Geyting tarmog'i (Router) har bir token uchun faqat eng mos keluvchi 1-2 ta mutaxassis (expert) neyron qatlamini faollashtiradi"
    },
    {
      q: "Jailbreak tushunchasi LLM lar xavfsizligida nimani anglatadi?",
      options: [
        "Rollar, gipotetik stsenariylar yoki shifrlash orqali modelning axloqiy va xavfsizlik cheklovlarini (guardrails) aylanib o'tish",
        "Smartfonni root qilish",
        "Modelni pullik qilish",
        "API xatoliklarini tuzatish"
      ],
      a: "Rollar, gipotetik stsenariylar yoki shifrlash orqali modelning axloqiy va xavfsizlik cheklovlarini (guardrails) aylanib o'tish"
    }
  ];

  // 36-45: Hard (80 pts each)
  const hardQuestions = [
    {
      q: "Transformerlarda inferensiya vaqtida KV Cache (Key-Value Cache) nima uchun ishlatiladi?",
      options: [
        "Oldingi tokenlarning hisoblangan Key va Value matritsalarini xotirada saqlab, har yangi token uchun takroriy hisoblashlarni chetlab o'tish",
        "Javobni diskka yozish",
        "Model og'irliklarini o'chirish",
        "Matnni arxivlash"
      ],
      a: "Oldingi tokenlarning hisoblangan Key va Value matritsalarini xotirada saqlab, har yangi token uchun takroriy hisoblashlarni chetlab o'tish"
    },
    {
      q: "RoPE (Rotary Position Embedding) ning asosiy matematik yutug'i nimada?",
      options: [
        "Tokenlarning nisbiy o'rnini kompleks sonlar fazosida aylanish (rotatsiya) orqali ifodalab, uzun kontekstlarda ajoyib ekstrapolyatsiya beradi",
        "Faqat juft sonlarni taniydi",
        "Pozitsiya matritsasini nolga aylantiradi",
        "Faqat birinchi 10 ta so'zga ta'sir qiladi"
      ],
      a: "Tokenlarning nisbiy o'rnini kompleks sonlar fazosida aylanish (rotatsiya) orqali ifodalab, uzun kontekstlarda ajoyib ekstrapolyatsiya beradi"
    },
    {
      q: "FlashAttention algoritmi qanday qilib Attention tezligini 2-4 barobar oshiradi va GPU xotirasini tejaydi?",
      options: [
        "Attention hisoblashini GPU ning tezkor SRAM xotirasi bloklariga bo'lib (tiling), sekin HBM xotirasiga murojaatlarni minimallashtiradi",
        "Barcha matritsalarni o'chirib yuboradi",
        "Faqat 1 ta qatlam qoldiradi",
        "Precision ni 1 bitga tushiradi"
      ],
      a: "Attention hisoblashini GPU ning tezkor SRAM xotirasi bloklariga bo'lib (tiling), sekin HBM xotirasiga murojaatlarni minimallashtiradi"
    },
    {
      q: "DPO (Direct Preference Optimization) ning an'anaviy RLHF (Reward Model + PPO) dan inqilobiy farqi nima?",
      options: [
        "Alohida Reward Model o'qitmasdan va beqaror PPO qadamisiz, to'g'ridan-to'g'ri afzallik ma'lumotlari bo'yicha yopiq matematik formulada modelni tekislaydi",
        "Modelni sekinlashtiradi",
        "Faqat insonlar baholagan kodlar bilan ishlaydi",
        "PPO dan 10 barobar ko'p VRAM talab qiladi"
      ],
      a: "Alohida Reward Model o'qitmasdan va beqaror PPO qadamisiz, to'g'ridan-to'g'ri afzallik ma'lumotlari bo'yicha yopiq matematik formulada modelni tekislaydi"
    },
    {
      q: "Reranking (Qayta tartiblash) modeli RAG pipeline'ida qanday rol o'ynaydi?",
      options: [
        "Vektor qidiruvidan chiqqan eng yaqin Top-K hujjatlarni Cross-Encoder orqali chuqur semantik tekshirib, eng dolzarblarini yuqoriga chiqaradi",
        "Fayllarni alifbo bo'yicha saralaydi",
        "Matndagi xatolarni to'g'rilaydi",
        "Matnni boshqa tilga tarjima qiladi"
      ],
      a: "Vektor qidiruvidan chiqqan eng yaqin Top-K hujjatlarni Cross-Encoder orqali chuqur semantik tekshirib, eng dolzarblarini yuqoriga chiqaradi"
    },
    {
      q: "Needle In A Haystack (Somon ichidagi igna) benchmarki LLM larning qaysi xususiyatini sinaydi?",
      options: [
        "Uzun kontekst (masalan 128k yoki 1M token) ichiga yashirilgan kichik bir faktni model qanchalik aniq eslay olishi va topib bera olishini",
        "Modelning qanchalik tez o'qiy olishini",
        "Modelning umumiy parametrlar sonini",
        "Modelning audio tushunishini"
      ],
      a: "Uzun kontekst (masalan 128k yoki 1M token) ichiga yashirilgan kichik bir faktni model qanchalik aniq eslay olishi va topib bera olishini"
    },
    {
      q: "Speculative Decoding (Taxminiy dekodlash) qanday qilib LLM inferensiyasini sezilarli darajada tezlashtiradi?",
      options: [
        "Kichik va tezkor model bir nechta tokenlarni taxmin qiladi, katta asosiy model esa ularni bitta qadamda parallel tekshiradi va tasdiqlaydi",
        "Model javobini to'xtatib qo'yadi",
        "Tokenlarni tasodifiy tashlab yuboradi",
        "Faqat bitta tokenni qaytaradi"
      ],
      a: "Kichik va tezkor model bir nechta tokenlarni taxmin qiladi, katta asosiy model esa ularni bitta qadamda parallel tekshiradi va tasdiqlaydi"
    },
    {
      q: "Grouped-Query Attention (GQA) ning Multi-Head Attention (MHA) ga nisbatan asosiy yutug'i nima?",
      options: [
        "Bir nechta Query headlari bitta Key-Value headini bo'lishadi, bu esa KV Cache hajmini va xotira o'tkazuvchanligi yukini keskin kamaytiradi",
        "Barcha Query larni o'chiradi",
        "Faqat bitta bosh (head) qoldiradi",
        "Model tezligini pasaytiradi"
      ],
      a: "Bir nechta Query headlari bitta Key-Value headini bo'lishadi, bu esa KV Cache hajmini va xotira o'tkazuvchanligi yukini keskin kamaytiradi"
    },
    {
      q: "Model Collapse (Model degradatsiyasi) xavfi nima?",
      options: [
        "Kelajak modellari sun'iy intellekt tomonidan yaratilgan (sintetik) ma'lumotlar bilan qayta-qayta o'qitilganda sifat va xilma-xillikning yo'qolishi",
        "Model faylining buzilishi",
        "Serverning qizib ketishi",
        "API kalitning bekor qilinishi"
      ],
      a: "Kelajak modellari sun'iy intellekt tomonidan yaratilgan (sintetik) ma'lumotlar bilan qayta-qayta o'qitilganda sifat va xilma-xillikning yo'qolishi"
    },
    {
      q: "CLIP (Contrastive Language-Image Pre-training) arxitekturasi qanday printsipda o'qitiladi?",
      options: [
        "Rasm va uning matnli tavsifi vektor fazosida bir-biriga yaqinlashadi (ijobiy juftlik), mos kelmaydiganlar esa itariladi (kontrastiv yo'qotish)",
        "Faqat rasmlarni piksellarini bashorat qiladi",
        "Matnlarni gramatikasini tekshiradi",
        "Hech qanday loss funksiyasi ishlatmaydi"
      ],
      a: "Rasm va uning matnli tavsifi vektor fazosida bir-biriga yaqinlashadi (ijobiy juftlik), mos kelmaydiganlar esa itariladi (kontrastiv yo'qotish)"
    }
  ];

  // 46-50: Extreme (2 Image Prompt, 2 Video Prompt, 1 ML Code 500 BALL!)
  const extremeQuestions = [
    {
      orderIndex: 46,
      difficulty: "extreme",
      type: "PROMPT",
      question: "🎨 AI Rasm Yaratish (Prompt Engineering - 150 BALL):\n2026-yilgi Toshkent zamonaviy kiberpank shahrida, yomg'irli kechada neon chiroqlar bilan yoritilgan osmono'par binolar orasida uchib ketayotgan aerotaksi va an'anaviy o'zbek milliy choponini kiygan kiborg qahramon portretini yaratish uchun Midjourney / Flux uslubida mukammal inglizcha formal prompt yozing.\nTalab: Promptda kamera burchagi (masalan: cinematic low-angle), yorug'lik (volumetric neon lighting, ray tracing), uslub (hyper-realistic, Unreal Engine 5 render, 8k, photorealistic) va kompozitsiya to'liq formal inglizcha ifodalansin.",
      options: null,
      correctAnswer: "cyberpunk,tashkent,cyborg,neon,cinematic,photorealistic,render,lighting,rain,unreal",
      codeTemplate: "// Yozadigan formal inglizcha rasm prompt shabloningiz:\n// [Subject + Futuristic Environment + Cinematic Lighting + Camera Angle + Style/Quality]",
      language: "prompt",
      points: 150
    },
    {
      orderIndex: 47,
      difficulty: "extreme",
      type: "PROMPT",
      question: "🎨 AI Rasm Yaratish (Prompt Engineering - 150 BALL):\nQadimiy Samarqand Registon maydoni ustida, shaffof ulkan kosmik gumbaz ostida joylashgan kelajak ilmiy-tadqiqot observatoriyasi va unda ishlayotgan xalqaro olimlar guruhi. DALL-E 3 / Midjourney v6 uchun yuqori darajadagi fotorealistik, arxitekturaviy va ilmiy tasvir yaratuvchi mukammal inglizcha formal prompt tuzing.\nTalab: Islomiy geometrik naqshlar bilan uyg'unlashgan kelajak oynaviy arxitekturasi, botayotgan quyosh nuri (golden hour), atmosfera tumanligi (atmospheric haze) va keng burchakli kamera (ultra-wide 16mm lens, Hasselblad detail) qat'iy formal kiritilsin.",
      options: null,
      correctAnswer: "samarkand,registan,futuristic,observatory,architecture,glass,dome,golden hour,photorealistic,hasselblad",
      codeTemplate: "// Yozadigan formal inglizcha rasm prompt shabloningiz:\n// [Architecture + Futuristic Elements + Lighting/Sunset + Camera Lens + Photorealistic Details]",
      language: "prompt",
      points: 150
    },
    {
      orderIndex: 48,
      difficulty: "extreme",
      type: "PROMPT",
      question: "🎬 AI Video Yaratish (Video Prompt Engineering - 200 BALL):\nSora / Runway Gen-3 / Luma Dream Machine uchun dinamik kinematik video prompti. Sahna tavsifi: Buxoro cho'llari bo'ylab ulkan tezlikda harakatlanayotgan futuristik magnitli poyezd (hyperloop maglev). FPV dron kamerasi poyezd orqasidan quvib yetib, poyezd derazasiga yaqinlashadi va deraza ichidagi muhandisning planshetda sun'iy intellekt tizimini boshqarayotganini ko'rsatadi.\nTalab: Kamera harakati (smooth high-speed FPV drone tracking shot, seamless zoom-in), vaqt va yoritish (dusk golden hour into twilight), dinamika (motion blur, cinematic 24fps, photorealistic physics, 4k 60fps) bo'yicha mukammal inglizcha formal video prompt tuzing.",
      options: null,
      correctAnswer: "fpv drone,camera,tracking,hyperloop,maglev,bukhara,desert,high speed,cinematic,motion blur,photorealistic,4k",
      codeTemplate: "// Yozadigan formal inglizcha video prompt shabloningiz:\n// [Camera Movement Dynamics + Scene Action + Subject Interaction + Cinematic Lighting + Technical Specs]",
      language: "prompt",
      points: 200
    },
    {
      orderIndex: 49,
      difficulty: "extreme",
      type: "PROMPT",
      question: "🎬 AI Video Yaratish (Video Prompt Engineering - 200 BALL):\nSora / Runway Gen-3 uchun mikroskopik biologik kinematik video prompti. Sahna tavsifi: Inson miyasidagi bitta biologik neyron hujayrasi ichiga kirib borish (macro cinematic dolly-in). Neyronlar orasidagi elektr impulslari (sinapslar) sun'iy neyron tarmoqlarining og'irliklariga (weights) aylanib ketishi, neon ko'k va tilla rangli zaryadlarning portlashi.\nTalab: Kamera optikasi (slow-motion 120fps macro lens, depth of field with cinematic bokeh), yoritish (bioluminescent glow, sub-surface scattering) va temporal consistency (barqaror kadrlar oqimi) bo'yicha mukammal inglizcha formal video prompt tuzing.",
      options: null,
      correctAnswer: "macro,dolly-in,neuron,synapse,brain,bioluminescent,neon,electrical,slow-motion,depth of field,cinematic",
      codeTemplate: "// Yozadigan formal inglizcha video prompt shabloningiz:\n// [Macro Camera Motion + Biological Neuron Action + Bioluminescent Lighting + Temporal Dynamics + Visual Quality]",
      language: "prompt",
      points: 200
    },
    {
      orderIndex: 50,
      difficulty: "extreme",
      type: "CODE",
      question: "🧠 Machine Learning & Deep Learning (500 BALL):\nTransformer arxitekturasining o'zagi bo'lgan 'Scaled Dot-Product Attention' formulasini JavaScript da to'liq amalga oshiring.\nFunksiya: scaledDotProductAttention(Q, K, V, d_k)\nFormula: Attention(Q, K, V) = Softmax((Q * K^T) / sqrt(d_k)) * V\nParametrlar:\n- Q: [N, d_k] Query matritsasi (2D massiv)\n- K: [N, d_k] Key matritsasi (2D massiv)\n- V: [N, d_v] Value matritsasi (2D massiv)\n- d_k: embedding o'lchami (son)\nQadamlar:\n1. Q va K^T (K ning transponirlangani) ko'paytmasini hisoblang: S = Q * K^T\n2. Har bir elementni Math.sqrt(d_k) ga bo'ling\n3. Har bir qator bo'yicha barqaror Softmax qo'llang (e^(x - max) / sum(e^(x - max)))\n4. Natijaviy ehtimollik matritsasini V ga ko'paytiring\n5. Chiqqan Out matritsaning birinchi qatori yig'indisini 2 kasr xonasigacha yaxlitlab string qaytaring (masalan: '4.32')",
      options: null,
      correctAnswer: "4.32",
      codeTemplate: "function scaledDotProductAttention(Q, K, V, d_k) {\n  // TODO: Transformer Scaled Dot-Product Attention mexanizmini amalga oshiring.\n  // Chiqish: Out matritsasining birinchi qatoridagi sonlar yig'indisini 2 kasr xonasigacha string qilib qaytaring (masalan: '4.32')\n  \n}",
      language: "javascript",
      points: 500
    }
  ];

  console.log("Preparing 50 questions...");

  let order = 1;
  for (const q of easyQuestions) {
    await prisma.competitionQuestion.create({
      data: {
        competitionId: compId,
        orderIndex: order++,
        difficulty: "easy",
        type: "QUIZ",
        question: q.q,
        options: JSON.stringify(q.options),
        correctAnswer: q.a,
        points: 30
      }
    });
  }

  for (const q of mediumQuestions) {
    await prisma.competitionQuestion.create({
      data: {
        competitionId: compId,
        orderIndex: order++,
        difficulty: "medium",
        type: "QUIZ",
        question: q.q,
        options: JSON.stringify(q.options),
        correctAnswer: q.a,
        points: 50
      }
    });
  }

  for (const q of hardQuestions) {
    await prisma.competitionQuestion.create({
      data: {
        competitionId: compId,
        orderIndex: order++,
        difficulty: "hard",
        type: "QUIZ",
        question: q.q,
        options: JSON.stringify(q.options),
        correctAnswer: q.a,
        points: 80
      }
    });
  }

  for (const q of extremeQuestions) {
    await prisma.competitionQuestion.create({
      data: {
        competitionId: compId,
        orderIndex: q.orderIndex,
        difficulty: q.difficulty,
        type: q.type,
        question: q.question,
        options: null,
        correctAnswer: q.correctAnswer,
        codeTemplate: q.codeTemplate,
        language: q.language,
        points: q.points
      }
    });
  }

  const count = await prisma.competitionQuestion.count({ where: { competitionId: compId } });
  console.log(`Successfully created ${count} questions for competition AI 2026 (2-seriya)!`);
  process.exit(0);
}

main().catch(err => {
  console.error("Error in seeding:", err);
  process.exit(1);
});
