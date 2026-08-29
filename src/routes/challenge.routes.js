import { Router } from "express";
import rateLimit from "express-rate-limit";
import { auth } from "../middleware/auth.js";
import { prisma } from "../lib/prisma.js";
import { evaluateWithGemini } from "../services/evaluation.service.js";
import { executeCodeTests } from "../services/runner.service.js";
import { levelFromScore, recalculateAllTimeRanks } from "../services/ranking.service.js";
import { notify } from "../services/user.service.js";
import { pushLiveLeaderboard } from "./leaderboard.routes.js";

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

    // Get all challenges in this category
    const items = await prisma.challenge.findMany({
      where: { category, published: true },
      orderBy: [{ difficulty: "asc" }, { type: "desc" }, { createdAt: "asc" }]
    });

    // Get all user attempts for this category's challenges
    const attempts = await prisma.challengeAttempt.findMany({
      where: {
        userId: req.user.id,
        challengeId: { in: items.map((x) => x.id) }
      },
      select: { challengeId: true, passed: true, score: true }
    });

    const map = new Map(attempts.map((x) => [x.challengeId, x]));

    // Calculate completion % per difficulty to determine unlock status
    const completionByDifficulty = {};
    for (const diff of DIFFICULTY_ORDER) {
      const diffItems = items.filter((x) => x.difficulty?.toUpperCase() === diff);
      const diffTotal = diffItems.length;
      const diffCompleted = diffItems.filter((x) => map.get(x.id)?.passed).length;
      completionByDifficulty[diff] = {
        total: diffTotal,
        completed: diffCompleted,
        pct: diffTotal > 0 ? Math.round((diffCompleted / diffTotal) * 100) : 0
      };
    }

    // Unlock rules: Easy = always open. Next level unlocks at 60% of previous
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
      items: items.map(({ tests, quiz, ...x }) => ({
        ...x,
        completed: Boolean(map.get(x.id)?.passed),
        bestScore: map.get(x.id)?.score || 0,
        hasQuiz: Boolean(quiz),
        locked: !unlockedLevels.has(x.difficulty?.toUpperCase() || "EASY")
      })),
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

    res.json({ challenge, attempt });
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

    let code = String(req.body.code || "");
    let language = String(req.body.language || challenge.language || "javascript");
    let runnerResult = { passed: false, results: [], output: "" };

    if (challenge.type === "QUIZ") {
      const selectedAnswer = Number(req.body.answer);
      const isCorrect = selectedAnswer === Number(challenge.quiz?.correctIndex);
      const expectedText = challenge.quiz?.options?.[challenge.quiz?.correctIndex] || "To'g'ri variant";
      const actualText = Number.isInteger(selectedAnswer) && challenge.quiz?.options?.[selectedAnswer]
        ? challenge.quiz.options[selectedAnswer]
        : "Javob belgilanmagan";

      runnerResult = {
        passed: isCorrect,
        results: [
          {
            index: 1,
            passed: isCorrect,
            expected: expectedText,
            actual: actualText
          }
        ],
        output: isCorrect
          ? "> Test 1: PASS. To'g'ri javob tanlandi."
          : "> Test 1: FAIL. Noto'g'ri variant tanlandi."
      };
    } else {
      if (!code.trim()) {
        return res.status(400).json({ message: "Kod bo‘sh bo'lishi mumkin emas." });
      }

      if (code.length > Number(process.env.MAX_CODE_LENGTH || 50000)) {
        return res.status(413).json({ message: "Kod hajmi belgilangan chegaradan katta." });
      }

      // Execute in isolated subprocess test runner
      runnerResult = await executeCodeTests({
        code,
        language,
        challenge
      });
    }

    // AI Evaluation with Gemini
    let aiReview;
    if (challenge.type === "QUIZ") {
      aiReview = {
        overall: runnerResult.passed ? 100 : 0,
        correctness: runnerResult.passed ? 100 : 0,
        quality: 85,
        security: 90,
        speed: 90,
        feedback: runnerResult.passed
          ? "Ajoyib! To'g'ri javob berdingiz. Keyingi savol va topshiriqlarga o'ting."
          : "Javob noto'g'ri. Mavzu bo'yicha qo'llanma va savol shartini yana bir bor ko'rib chiqing.",
        model: "Quiz Validator",
        results: runnerResult.results
      };
    } else {
      aiReview = await evaluateWithGemini({
        code,
        language,
        challenge,
        runnerResult
      });
    }

    // Determine if challenge is passed
    const passed = challenge.type === "QUIZ"
      ? runnerResult.passed
      : (runnerResult.passed && aiReview.overall >= 60);

    const earnedPoints = passed ? challenge.points : 0;

    // Database transaction to persist submission, attempt, and update user score
    const submissionResult = await prisma.$transaction(async (tx) => {
      const prevAttempt = await tx.challengeAttempt.findUnique({
        where: {
          userId_challengeId: {
            userId: req.user.id,
            challengeId: challenge.id
          }
        }
      });

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
          feedback: aiReview.feedback,
          createdAt: new Date()
        },
        create: {
          userId: req.user.id,
          challengeId: challenge.id,
          passed,
          score: earnedPoints,
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

    // Recalculate ranks across all users
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
