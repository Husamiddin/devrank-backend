import { Router } from "express";
import rateLimit from "express-rate-limit";
import { auth } from "../middleware/auth.js";
import { prisma } from "../lib/prisma.js";
import { evaluateWithGemini } from "../services/evaluation.service.js";
import { executeCodeTests } from "../services/runner.service.js";
import { levelFromScore, recalculateAllTimeRanks } from "../services/ranking.service.js";
import { notify } from "../services/user.service.js";
import { pushLiveLeaderboard } from "./leaderboard.routes.js";
import { geminiPool } from "../lib/geminiPool.js";

const r = Router();

const submitLimiter = rateLimit({
  windowMs: 60000,
  max: Number(process.env.SUBMIT_RATE_LIMIT_MAX || 30),
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { message: "Juda ko‘p submission yuborildi. Bir ozdan keyin yana urinib ko‘ring." }
});

// GET /api/challenges?category=web&difficulty=easy
r.get("/challenges", auth, async (req, res, next) => {
  try {
    const category = String(req.query.category || "web").toLowerCase();
    const DIFFICULTY_ORDER = ["EASY", "MEDIUM", "HARD", "EXTREME"];

    const items = await prisma.challenge.findMany({
      where: { category, published: true },
      orderBy: [{ difficulty: "asc" }, { type: "desc" }, { createdAt: "asc" }]
    });

    // URINISHLAR VA STATUSNI TO'LIQ OLIB KELISH
    const attempts = await prisma.challengeAttempt.findMany({
      where: {
        userId: req.user.id,
        challengeId: { in: items.map((x) => x.id) }
      },
      select: { challengeId: true, passed: true, score: true, status: true, attempts: true }
    });

    const map = new Map(attempts.map((x) => [x.challengeId, x]));

    const completionByDifficulty = {};
    for (const diff of DIFFICULTY_ORDER) {
      const diffItems = items.filter((x) => x.difficulty?.toUpperCase() === diff);
      const diffTotal = diffItems.length;
      const diffCompleted = diffItems.filter((x) => map.get(x.id)?.passed || map.get(x.id)?.status === "COMPLETED").length;
      completionByDifficulty[diff] = {
        total: diffTotal,
        completed: diffCompleted,
        pct: diffTotal > 0 ? Math.round((diffCompleted / diffTotal) * 100) : 0
      };
    }

    const UNLOCK_THRESHOLD = 60;
    const unlockedLevels = new Set(["EASY"]);
    for (let i = 1; i < DIFFICULTY_ORDER.length; i++) {
      const prev = DIFFICULTY_ORDER[i - 1];
      const curr = DIFFICULTY_ORDER[i];
      if (completionByDifficulty[prev].pct >= UNLOCK_THRESHOLD || completionByDifficulty[prev].total === 0) {
        unlockedLevels.add(curr);
      }
    }

    res.json({
      items: items.map(({ tests, quiz, ...x }) => {
        const attemptData = map.get(x.id);
        const isCompleted = Boolean(attemptData?.passed || attemptData?.status === "COMPLETED");
        const isLockedByAttempts = attemptData?.status === "LOCKED";
        const isLevelLocked = !unlockedLevels.has(x.difficulty?.toUpperCase() || "EASY");

        return {
          ...x,
          completed: isCompleted,
          status: attemptData?.status || "ACTIVE",
          attempts: attemptData?.attempts || 0,
          bestScore: attemptData?.score || 0,
          hasQuiz: Boolean(quiz),
          locked: isLevelLocked || isLockedByAttempts
        };
      }),
      progression: {
        EASY: completionByDifficulty["EASY"],
        MEDIUM: completionByDifficulty["MEDIUM"],
        HARD: completionByDifficulty["HARD"],
        EXTREME: completionByDifficulty["EXTREME"],
        unlockedLevels: [...unlockedLevels]
      }
    });
  } catch (e) {
    next(e);
  }
});

// GET /api/challenges/:id
r.get("/challenges/:id", auth, async (req, res, next) => {
  try {
    const challenge = await prisma.challenge.findUnique({
      where: { id: req.params.id }
    });

    if (!challenge) {
      return res.status(404).json({ message: "Challenge topilmadi." });
    }

    const attempt = await prisma.challengeAttempt.findUnique({
      where: {
        userId_challengeId: {
          userId: req.user.id,
          challengeId: challenge.id
        }
      }
    });

    // Agar vazifa bloklangan yoki bajarilgan bo'lsa frontendga aniq holatni qaytaramiz
    res.json({ 
      challenge, 
      attempt: attempt || { status: "ACTIVE", attempts: 0, passed: false } 
    });
  } catch (e) {
    next(e);
  }
});

// POST /api/challenges/:id/submit
r.post("/challenges/:id/submit", auth, submitLimiter, async (req, res, next) => {
  try {
    const challenge = await prisma.challenge.findUnique({
      where: { id: req.params.id }
    });

    if (!challenge) {
      return res.status(404).json({ message: "Challenge topilmadi." });
    }

    const prevAttempt = await prisma.challengeAttempt.findUnique({
      where: {
        userId_challengeId: { userId: req.user.id, challengeId: challenge.id }
      }
    });

    // QAT'IY TEKshIRUV: Agar oldin bloklangan yoki bajarilgan bo'lsa darhol to'xtatamiz
    if (prevAttempt && (prevAttempt.status === "LOCKED" || prevAttempt.status === "COMPLETED")) {
      return res.status(403).json({ 
        success: false, 
        locked: true,
        message: prevAttempt.status === "LOCKED" 
          ? "Bu vazifa imkoniyatlar tugagani uchun bloklangan." 
          : "Siz bu vazifani allaqachon muvaffaqiyatli bajargansiz." 
      });
    }

    let code = String(req.body.code || "");
    let language = String(req.body.language || challenge.language || "javascript");
    let runnerResult = { passed: false, results: [], output: "" };
    
    let attemptsCount = prevAttempt?.attempts || 0;
    let updatedStatus = "ACTIVE"; 

    if (challenge.type === "QUIZ") {
      const selectedAnswer = Number(req.body.answer);
      const isCorrect = selectedAnswer === Number(challenge.quiz?.correctIndex);
      const expectedText = challenge.quiz?.options?.[challenge.quiz?.correctIndex] || "To'g'ri variant";
      const actualText = Number.isInteger(selectedAnswer) && challenge.quiz?.options?.[selectedAnswer]
        ? challenge.quiz.options[selectedAnswer]
        : "Javob belgilanmagan";

      runnerResult = {
        passed: isCorrect,
        results: [{ index: 1, passed: isCorrect, expected: expectedText, actual: actualText }],
        output: isCorrect ? "> Test 1: PASS. To'g'ri javob tanlandi." : "> Test 1: FAIL. Noto'g'ri variant tanlandi."
      };

      if (!isCorrect) {
        attemptsCount += 1;
        // 2-martagacha urinishga ruxsat, 2 taga yetsa status LOCKED bo'ladi
        updatedStatus = attemptsCount >= 2 ? "LOCKED" : "ACTIVE";
      } else {
        updatedStatus = "COMPLETED";
      }
    } else {
      if (!code.trim()) {
        return res.status(400).json({ message: "Kod bo‘sh bo'lishi mumkin emas." });
      }

      if (code.length > Number(process.env.MAX_CODE_LENGTH || 50000)) {
        return res.status(413).json({ message: "Kod hajmi belgilangan chegaradan katta." });
      }

      runnerResult = await executeCodeTests({
        code,
        language,
        challenge
      });
    }

    let aiReview;
    let isCheatDetected = false;

    if (challenge.type === "QUIZ") {
      aiReview = {
        overall: runnerResult.passed ? 100 : 0,
        correctness: runnerResult.passed ? 100 : 0,
        quality: 85,
        security: 90,
        speed: 90,
        feedback: runnerResult.passed
          ? "Ajoyib! To'g'ri javob berdingiz."
          : `Javob noto'g'ri. Qolgan urinishlar: ${Math.max(0, 2 - attemptsCount)}`,
        model: "Quiz Validator",
        results: runnerResult.results
      };
    } else {
      if (runnerResult.passed) {
        const cheatPrompt = `
          Siz qat'iy ustozsiz. O'quvchi yuborgan ushbu kodni AIdan (ChatGPT/Gemini) ko'chirilgan yoki yo'qligini aniqlang.
          Agar kodda mukammal izohlar, inson xatolarisiz o'ta murakkab yoki noan'anaviy abstraksiyalar bo'lsa, qabul qilmang!
          O'quvchi kodi: \n${code}\n
          Javobni FAQAT valid JSON formatda qaytaring: {"status": "CHEAT" yoki "PASS", "message": "O'zbek tilida qisqa izoh"}
        `;
        try {
          const textResponse = await geminiPool.generateWithRetry(cheatPrompt);
          const cheatResult = JSON.parse(textResponse.replace(/^```json\s*|\s*```$/g, ""));
          if (cheatResult.status === 'CHEAT') {
            isCheatDetected = true;
            aiReview = {
              overall: 0,
              correctness: 0,
              quality: 0,
              security: 0,
              speed: 0,
              feedback: "Xato, o'tmadingiz! Kodingizda sun'iy intellekt yordami aniqlandi.",
              model: "AI Anti-Cheat Detektiv"
            };
            updatedStatus = "ACTIVE";
          }
        } catch (err) {
          console.error("Anti-Cheat Error:", err);
        }
      }

      if (!isCheatDetected) {
        aiReview = await evaluateWithGemini({
          code,
          language,
          challenge,
          runnerResult
        });
        if (runnerResult.passed && aiReview.overall >= 60) {
          updatedStatus = "COMPLETED";
        }
      }
    }

    const passed = challenge.type === "QUIZ"
      ? runnerResult.passed
      : (runnerResult.passed && !isCheatDetected && aiReview.overall >= 60);

    const earnedPoints = passed ? challenge.points : 0;

    const submissionResult = await prisma.$transaction(async (tx) => {
      const previousBest = prevAttempt?.score || 0;
      const addedPoints = Math.max(0, earnedPoints - previousBest);

      const sub = await tx.submission.create({
        data: {
          userId: req.user.id,
          challengeId: challenge.id,
          language,
          code,
          status: passed ? "COMPLETED" : "FAILED",
          score: aiReview.overall,
          output: runnerResult.output,
          completedAt: new Date(),
          evaluation: {
            create: {
              overall: aiReview.overall,
              quality: aiReview.quality,
              security: aiReview.security,
              speed: aiReview.speed,
              correctness: aiReview.correctness,
              feedback: aiReview.feedback,
              model: aiReview.model
            }
          }
        }
      });

      await tx.challengeAttempt.upsert({
        where: {
          userId_challengeId: {
            userId: req.user.id,
            challengeId: challenge.id
          }
        },
        update: {
          passed: prevAttempt?.passed || passed,
          score: Math.max(previousBest, earnedPoints),
          attempts: attemptsCount,
          status: updatedStatus,
          feedback: aiReview.feedback,
          createdAt: new Date()
        },
        create: {
          userId: req.user.id,
          challengeId: challenge.id,
          passed,
          score: earnedPoints,
          attempts: attemptsCount,
          status: updatedStatus,
          feedback: aiReview.feedback
        }
      });

      const currentUser = await tx.user.findUnique({
        where: { id: req.user.id },
        select: { score: true, growth: true }
      });

      const currentScore = Number(currentUser?.score || 0);
      const newScore = currentScore + addedPoints;

      await tx.user.update({
        where: { id: req.user.id },
        data: {
          score: newScore,
          level: levelFromScore(newScore),
          growth: addedPoints > 0 ? Number(currentUser?.growth || 0) + 1 : Number(currentUser?.growth || 0),
          online: true
        }
      });

      return { sub, addedPoints, newScore };
    });

    await recalculateAllTimeRanks();

    const updatedUser = await prisma.user.findUnique({
      where: { id: req.user.id }
    });

    if (submissionResult.addedPoints > 0) {
      await notify(
        req.user.id,
        "Challenge muvaffaqiyatli topshirildi!",
        `“${challenge.title}”: +${submissionResult.addedPoints} score olindi. Hozirgi darajangiz: Level ${updatedUser.level}, Reyting: #${updatedUser.rank}.`,
        "challenge"
      );
    }

    await pushLiveLeaderboard();

    if (challenge.type === "QUIZ" && !passed) {
      return res.json({
        passed: false,
        locked: updatedStatus === "LOCKED",
        attemptsLeft: Math.max(0, 2 - attemptsCount),
        message: updatedStatus === "LOCKED" 
          ? "Imkoniyatlaringiz tugadi (2 ta urinish). Vazifa bloklandi." 
          : `Xato javob! Yana ${Math.max(0, 2 - attemptsCount)} ta imkoniyatingiz qoldi.`,
        feedback: aiReview.feedback
      });
    }

    if (isCheatDetected) {
      return res.json({
        passed: false,
        cheatDetected: true,
        message: aiReview.feedback,
        feedback: aiReview.feedback
      });
    }

    res.json({
      score: aiReview.overall,
      correctness: aiReview.correctness,
      quality: aiReview.quality,
      security: aiReview.security,
      speed: aiReview.speed,
      feedback: aiReview.feedback,
      model: aiReview.model,
      passed,
      points: submissionResult.addedPoints,
      correctIndex: challenge.type === "QUIZ" ? (challenge.quiz?.correct ?? challenge.quiz?.correctIndex ?? null) : null,
      test: {
        passed: runnerResult.passed,
        results: runnerResult.results,
        output: runnerResult.output
      },
      user: {
        score: updatedUser.score,
        level: updatedUser.level,
        rank: updatedUser.rank
      }
    });
  } catch (e) {
    next(e);
  }
});

export default r;