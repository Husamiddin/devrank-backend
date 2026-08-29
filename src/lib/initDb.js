import "dotenv/config";
import pg from "pg";
import { prisma } from "./prisma.js";

export async function initializeDatabase() {
  const dbUrl = process.env.DATABASE_URL || "postgresql://postgres:0427@localhost:5432/devrank?schema=public";
  const client = new pg.Client({ connectionString: dbUrl });
  
  try {
    await client.connect();
    
    // Create enums safely
    const enums = [
      { name: "ChallengeType", vals: "'CODE', 'QUIZ'" },
      { name: "ContentStatus", vals: "'DRAFT', 'PUBLISHED', 'ARCHIVED'" },
      { name: "SubmissionStatus", vals: "'PENDING', 'COMPLETED', 'FAILED'" },
      { name: "RankPeriod", vals: "'ALL', 'MONTH', 'WEEK'" }
    ];
    for (const e of enums) {
      await client.query(`DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = '${e.name}') THEN
          CREATE TYPE "${e.name}" AS ENUM (${e.vals});
        END IF;
      END $$;`);
    }

    // Create tables IF NOT EXISTS
    await client.query(`
      CREATE TABLE IF NOT EXISTS "Challenge" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "slug" TEXT NOT NULL UNIQUE,
        "title" TEXT NOT NULL,
        "category" TEXT NOT NULL,
        "type" "ChallengeType" NOT NULL DEFAULT 'CODE',
        "language" TEXT NOT NULL,
        "difficulty" TEXT NOT NULL,
        "description" TEXT NOT NULL,
        "starterCode" TEXT NOT NULL,
        "inputExample" TEXT,
        "outputExample" TEXT,
        "tests" JSONB NOT NULL,
        "quiz" JSONB,
        "points" INTEGER NOT NULL DEFAULT 100,
        "published" BOOLEAN NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS "ChallengeAttempt" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
        "challengeId" TEXT NOT NULL REFERENCES "Challenge"("id") ON DELETE CASCADE,
        "passed" BOOLEAN NOT NULL DEFAULT false,
        "score" INTEGER NOT NULL DEFAULT 0,
        "feedback" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "ChallengeAttempt_userId_challengeId_key" UNIQUE ("userId", "challengeId")
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS "ProjectImage" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "projectId" TEXT NOT NULL REFERENCES "Project"("id") ON DELETE CASCADE,
        "url" TEXT NOT NULL,
        "sortOrder" INTEGER NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS "News" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "title" TEXT NOT NULL,
        "summary" TEXT NOT NULL,
        "content" TEXT NOT NULL,
        "sourceUrl" TEXT,
        "imageUrl" TEXT,
        "category" TEXT NOT NULL DEFAULT 'IT',
        "status" "ContentStatus" NOT NULL DEFAULT 'PUBLISHED',
        "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS "Event" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "title" TEXT NOT NULL,
        "description" TEXT NOT NULL,
        "location" TEXT,
        "eventUrl" TEXT,
        "startsAt" TIMESTAMP(3) NOT NULL,
        "endsAt" TIMESTAMP(3),
        "category" TEXT NOT NULL DEFAULT 'Hackathon',
        "status" "ContentStatus" NOT NULL DEFAULT 'PUBLISHED',
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS "Message" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
        "type" TEXT NOT NULL DEFAULT 'system',
        "title" TEXT NOT NULL,
        "body" TEXT NOT NULL,
        "read" BOOLEAN NOT NULL DEFAULT false,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Safe column additions
    await client.query(`ALTER TABLE "Evaluation" ADD COLUMN IF NOT EXISTS "correctness" INTEGER NOT NULL DEFAULT 0;`);
    await client.query(`ALTER TABLE "Evaluation" ADD COLUMN IF NOT EXISTS "model" TEXT;`);
    await client.query(`ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "growth" INTEGER NOT NULL DEFAULT 0;`);
    await client.query(`ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "topPercent" DOUBLE PRECISION NOT NULL DEFAULT 100;`);
    await client.query(`ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "online" BOOLEAN NOT NULL DEFAULT false;`);
    await client.query(`ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "purpose" TEXT DEFAULT '';`);
    await client.query(`ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "problem" TEXT DEFAULT '';`);
    await client.query(`ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "technologies" TEXT[] DEFAULT ARRAY[]::TEXT[];`);
    await client.query(`ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "tech" TEXT[] DEFAULT ARRAY[]::TEXT[];`);
    await client.query(`ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "githubUrl" TEXT;`);
    await client.query(`ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "liveUrl" TEXT;`);
    await client.query(`ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "stars" INTEGER NOT NULL DEFAULT 0;`);
    await client.query(`ALTER TABLE "Submission" ADD COLUMN IF NOT EXISTS "challengeId" TEXT;`);
    await client.query(`ALTER TABLE "Submission" ADD COLUMN IF NOT EXISTS "completedAt" TIMESTAMP(3);`);
    await client.query(`ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "views" INTEGER NOT NULL DEFAULT 0;`);

    // Safe foreign key for Submission -> Challenge
    try {
      await client.query(`
        DO $$ BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints 
            WHERE constraint_name = 'Submission_challengeId_fkey'
          ) THEN
            ALTER TABLE "Submission" 
            ADD CONSTRAINT "Submission_challengeId_fkey" 
            FOREIGN KEY ("challengeId") REFERENCES "Challenge"("id") ON DELETE SET NULL;
          END IF;
        END $$;
      `);
    } catch {}

    // Indexes
    await client.query(`CREATE INDEX IF NOT EXISTS "Challenge_category_published_difficulty_idx" ON "Challenge"("category", "published", "difficulty");`);
    await client.query(`CREATE INDEX IF NOT EXISTS "ChallengeAttempt_userId_createdAt_idx" ON "ChallengeAttempt"("userId", "createdAt");`);
    await client.query(`CREATE INDEX IF NOT EXISTS "ChallengeAttempt_challengeId_createdAt_idx" ON "ChallengeAttempt"("challengeId", "createdAt");`);
    await client.query(`CREATE INDEX IF NOT EXISTS "ProjectImage_projectId_sortOrder_idx" ON "ProjectImage"("projectId", "sortOrder");`);
    await client.query(`CREATE INDEX IF NOT EXISTS "News_status_publishedAt_idx" ON "News"("status", "publishedAt");`);
    await client.query(`CREATE INDEX IF NOT EXISTS "Event_status_startsAt_idx" ON "Event"("status", "startsAt");`);
    await client.query(`CREATE INDEX IF NOT EXISTS "Message_userId_read_createdAt_idx" ON "Message"("userId", "read", "createdAt");`);

  } catch (err) {
    console.error("Database initialization SQL error:", err.message);
  } finally {
    await client.end();
  }

  // Seed default skills and challenges if none exist
  try {
    const challengeCount = await prisma.challenge.count();
    if (challengeCount === 0) {
      console.log("Seeding default challenges and skills into database...");
      await seedInitialData();
    }
  } catch (err) {
    console.error("Database seed check error:", err.message);
  }
}

async function seedInitialData() {
  const skills = [
    ['React.js', 'web'], ['Node.js', 'web'], ['TypeScript', 'web'], ['JavaScript', 'web'],
    ['PostgreSQL', 'web'], ['Next.js', 'web'], ['Express.js', 'web'], ['TailwindCSS', 'web'],
    ['Python', 'ai'], ['PyTorch', 'ai'], ['TensorFlow', 'ai'], ['LLM / LangChain', 'ai'],
    ['Machine Learning', 'ai'], ['Cyber Security', 'cyber'], ['OWASP Top 10', 'cyber'],
    ['Penetration Testing', 'cyber'], ['Cryptography', 'cyber'], ['Figma', 'ux'],
    ['UI Design', 'ux'], ['UX Research', 'ux'], ['Design Systems', 'ux'],
    ['C++', 'ai'], ['C#', 'web'], ['Docker', 'web'], ['Git', 'web']
  ];

  for (const [name, category] of skills) {
    await prisma.skill.upsert({
      where: { name },
      update: { category },
      create: { name, category }
    });
  }

  const challenges = [
    // Web challenges
    {
      title: "Two Sum",
      category: "web",
      type: "CODE",
      language: "javascript",
      difficulty: "easy",
      description: "Berilgan `nums` massivi va `target` soni uchun yig‘indisi targetga teng bo‘lgan 2 ta element indeksini massiv ko‘rinishida qaytaring: `[index1, index2]`.",
      starterCode: "function twoSum(nums, target) {\n  // Yechimingizni shu yerga yozing\n  \n}",
      inputExample: "nums = [2, 7, 11, 15], target = 9",
      outputExample: "[0, 1]",
      points: 100,
      tests: {
        unitTests: [
          { input: [[2, 7, 11, 15], 9], expected: [0, 1] },
          { input: [[3, 2, 4], 6], expected: [1, 2] },
          { input: [[3, 3], 6], expected: [0, 1] }
        ]
      }
    },
    {
      title: "TypeScript Safe Validator",
      category: "web",
      type: "CODE",
      language: "typescript",
      difficulty: "medium",
      description: "`unknown` turidagi obyektni tekshirib, `id` (string) va `name` (string) maydonlariga ega bo‘lsa `true`, aks holda `false` qaytaruvchi type guard funksiyasini yozing.",
      starterCode: "type User = { id: string; name: string };\n\nfunction isUser(value: unknown): value is User {\n  // Yechimingizni shu yerga yozing\n  \n}",
      inputExample: "{ id: 'u1', name: 'Ali' }",
      outputExample: "true",
      points: 110,
      tests: {
        unitTests: [
          { input: [{ id: "1", name: "User" }], expected: true },
          { input: [{ id: 123, name: "Bad" }], expected: false },
          { input: [null], expected: false }
        ]
      }
    },
    {
      title: "HTTP Status 201 nima?",
      category: "web",
      type: "QUIZ",
      language: "quiz",
      difficulty: "easy",
      description: "HTTP POST muvaffaqiyatli bajarilib yangi resurs yaratilganda odatda qaysi status kod qaytariladi?",
      starterCode: "",
      points: 75,
      tests: { checks: [] },
      quiz: {
        question: "HTTP POST so'rovi orqali yangi resurs yaratilganda REST standarti bo'yicha qaysi HTTP status kod qaytariladi?",
        options: ["200 OK", "201 Created", "204 No Content", "404 Not Found"],
        correctIndex: 1
      }
    },
    {
      title: "SQL Injection Himoyasi",
      category: "web",
      type: "QUIZ",
      language: "quiz",
      difficulty: "medium",
      description: "SQL so'rovlarida foydalanuvchi ma'lumotlarini xavfsiz uzatishning eng ishonchli usuli qaysi?",
      starterCode: "",
      points: 75,
      tests: { checks: [] },
      quiz: {
        question: "SQL Injection hujumlaridan himoyalanishning eng to'g'ri va xavfsiz usuli qaysi?",
        options: ["Stringlarni qo'shish (Concatenation)", "Parametrlangan so'rovlar (Parameterized Queries / Prepared Statements)", "eval() funksiyasi orqali bajarish", "Faqat frontendda regex bilan tekshirish"],
        correctIndex: 1
      }
    },
    // AI challenges
    {
      title: "Python Matn Tozalash",
      category: "ai",
      type: "CODE",
      language: "python",
      difficulty: "easy",
      description: "Berilgan stringdan ortiqcha bosh va oxir bo'shliqlarni olib tashlang, kichik harflarga o'tkazing va so'zlar orasidagi ko'p bo'shliqlarni 1 ta bo'shliqqa keltiring.",
      starterCode: "def clean_text(text: str) -> str:\n    # Yechimingizni shu yerga yozing\n    pass",
      inputExample: "'  Hello   WORLD  AI  '",
      outputExample: "'hello world ai'",
      points: 100,
      tests: {
        unitTests: [
          { input: ["  Hello   WORLD  AI  "], expected: "hello world ai" },
          { input: ["DevRank   UZ"], expected: "devrank uz" },
          { input: ["   python   "], expected: "python" }
        ]
      }
    },
    {
      title: "Cosine Similarity",
      category: "ai",
      type: "CODE",
      language: "python",
      difficulty: "medium",
      description: "Ikki bir xil o'lchamli sonli massiv (vektor) orasidagi Cosine Similarity qiymatini hisoblovchi funksiya yozing (natija 4 ta kasr xonasigacha yaxlitlangan float bo'lsin).",
      starterCode: "import math\n\ndef cosine_similarity(vec_a: list[float], vec_b: list[float]) -> float:\n    # Yechimingizni shu yerga yozing\n    pass",
      inputExample: "vec_a = [1, 2, 3], vec_b = [1, 2, 3]",
      outputExample: "1.0",
      points: 120,
      tests: {
        unitTests: [
          { input: [[1, 2, 3], [1, 2, 3]], expected: 1.0 },
          { input: [[1, 0], [0, 1]], expected: 0.0 },
          { input: [[1, 2], [2, 4]], expected: 1.0 }
        ]
      }
    },
    {
      title: "Overfitting Tushunchasi",
      category: "ai",
      type: "QUIZ",
      language: "quiz",
      difficulty: "easy",
      description: "Machine Learning modelining training ma'lumotlarida yuqori aniqlik, lekin yangi test ma'lumotlarida yomon ishlashi nima deyiladi?",
      starterCode: "",
      points: 75,
      tests: { checks: [] },
      quiz: {
        question: "Model o'rgatilgan (training) ma'lumotlarda 99% aniqlik ko'rsatib, yangi (test) ma'lumotlarda juda past natija bersa, bu hodisa nima deb ataladi?",
        options: ["Underfitting", "Overfitting", "Gradient Descent", "Quantization"],
        correctIndex: 1
      }
    },
    // Cyber Security challenges
    {
      title: "Secure Password Strength Check",
      category: "cyber",
      type: "CODE",
      language: "javascript",
      difficulty: "easy",
      description: "Parol kamida 8 belgidan iborat, kamida 1 ta katta harf, 1 ta kichik harf, 1 ta raqam va 1 ta maxsus belgiga (`!@#$%^&*`) ega ekanligini tekshiring (`true`/`false`).",
      starterCode: "function isStrongPassword(password) {\n  // Yechimingizni shu yerga yozing\n  \n}",
      inputExample: "'P@ssw0rd123'",
      outputExample: "true",
      points: 100,
      tests: {
        unitTests: [
          { input: ["P@ssw0rd123"], expected: true },
          { input: ["simplepass"], expected: false },
          { input: ["Password123"], expected: false }
        ]
      }
    },
    {
      title: "XSS Hujumi Oqibati",
      category: "cyber",
      type: "QUIZ",
      language: "quiz",
      difficulty: "easy",
      description: "Foydalanuvchi kiritgan HTML/JS kodi sanitizatsiya qilinmasdan sahifada render qilinsa, qaysi zaiflik kelib chiqadi?",
      starterCode: "",
      points: 75,
      tests: { checks: [] },
      quiz: {
        question: "Brauzerda begona JavaScript skriptlarini ishga tushirishga imkon beruvchi zaiflik qaysi?",
        options: ["XSS (Cross-Site Scripting)", "CSRF (Cross-Site Request Forgery)", "DDoS Attack", "SQL Injection"],
        correctIndex: 0
      }
    },
    // UI/UX challenges
    {
      title: "WCAG Contrast Ratio",
      category: "ux",
      type: "QUIZ",
      language: "quiz",
      difficulty: "easy",
      description: "WCAG AA standarti bo'yicha oddiy matn uchun minimal kontrast nisbati qancha bo'lishi kerak?",
      starterCode: "",
      points: 75,
      tests: { checks: [] },
      quiz: {
        question: "WCAG 2.1 AA standarti talabiga ko'ra oddiy matn (normal text) va fon orasidagi minimal kontrast nisbati qanday?",
        options: ["3:1", "4.5:1", "7:1", "10:1"],
        correctIndex: 1
      }
    }
  ];

  for (const c of challenges) {
    const slug = (c.category + '-' + c.title).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    await prisma.challenge.upsert({
      where: { slug },
      update: {
        ...c,
        quiz: c.quiz ?? undefined
      },
      create: {
        ...c,
        slug,
        quiz: c.quiz ?? undefined
      }
    });
  }

  console.log(`Seeded ${challenges.length} real challenges and ${skills.length} skills successfully.`);
}
