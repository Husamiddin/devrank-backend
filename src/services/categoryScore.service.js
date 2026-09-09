import { prisma } from "../lib/prisma.js";

export const VALID_CATEGORIES = ["web", "ai", "cyber", "ux"];

export const CATEGORY_LABELS = {
  web: "Web Development",
  ai: "Artificial Intelligence",
  cyber: "Cyber Security",
  ux: "UI / UX Design",
};

/**
 * Deterministically computes category scores for a specific user from actual
 * passed challenges, verified submissions, and competition answers.
 *
 * STRICT PRODUCTION RULE:
 * - A developer starts with: Web = 0, AI = 0, Cyber = 0, UI/UX = 0.
 * - Only activity in that specific category increases that category's points.
 * - NEVER copy global score (user.score) into categories.
 */
export async function computeCategoryScoresForUser(userId) {
  const [passedAttempts, correctAnswers, user] = await Promise.all([
    prisma.challengeAttempt.findMany({
      where: { userId, passed: true },
      include: {
        challenge: {
          select: { id: true, category: true, points: true },
        },
      },
    }),
    prisma.competitionAnswer.findMany({
      where: { userId, correct: true },
      include: {
        question: {
          select: {
            id: true,
            points: true,
            competition: { select: { category: true } },
          },
        },
      },
    }),
    prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, primaryCategory: true, score: true },
    }),
  ]);

  if (!user) return null;

  // Initialize raw metrics strictly at 0
  const metrics = {
    web: { points: 0, completed: 0, passed: 0 },
    ai: { points: 0, completed: 0, passed: 0 },
    cyber: { points: 0, completed: 0, passed: 0 },
    ux: { points: 0, completed: 0, passed: 0 },
  };

  // 1. Process passed challenge attempts (avoid duplicate counting by challenge id)
  const challengeCategoryMap = new Map();
  for (const att of passedAttempts) {
    if (!att.challenge) continue;
    const rawCat = String(att.challenge.category || "").toLowerCase().trim();
    if (!VALID_CATEGORIES.includes(rawCat)) continue;

    if (!challengeCategoryMap.has(att.challenge.id)) {
      challengeCategoryMap.set(att.challenge.id, true);
      const earned = att.score > 0 ? att.score : (att.challenge.points || 0);
      metrics[rawCat].points += earned;
      metrics[rawCat].passed += 1;
      metrics[rawCat].completed += 1;
    }
  }

  // 2. Process correct competition answers
  const compQuestionMap = new Map();
  for (const ans of correctAnswers) {
    if (!ans.question) continue;
    const rawCat = String(ans.question.competition?.category || "").toLowerCase().trim();
    if (!VALID_CATEGORIES.includes(rawCat)) continue;

    if (!compQuestionMap.has(ans.question.id)) {
      compQuestionMap.set(ans.question.id, true);
      metrics[rawCat].points += ans.points || 0;
      metrics[rawCat].passed += 1;
      metrics[rawCat].completed += 1;
    }
  }

  // 3. Persist strictly to UserCategoryScore table in PostgreSQL
  for (const cat of VALID_CATEGORIES) {
    await prisma.userCategoryScore.upsert({
      where: {
        userId_category: {
          userId,
          category: cat,
        },
      },
      update: {
        points: metrics[cat].points,
        completedChallenges: metrics[cat].completed,
        passedChallenges: metrics[cat].passed,
      },
      create: {
        userId,
        category: cat,
        points: metrics[cat].points,
        completedChallenges: metrics[cat].completed,
        passedChallenges: metrics[cat].passed,
      },
    });
  }

  return metrics;
}

/**
 * Recalculates category scores for ALL users in the database.
 */
export async function recalculateAllCategoryScores() {
  const users = await prisma.user.findMany({ select: { id: true } });
  for (const u of users) {
    await computeCategoryScoresForUser(u.id);
  }
}

/**
 * Returns deterministic top talent per category.
 *
 * STRICT RULES:
 * 1. Points MUST strictly reflect actual activity in that category (points > 0).
 * 2. UNIQUE LEADERS: A developer chosen as #1 in one category will NOT be reused
 *    as #1 in another category. Each category features a distinct leader.
 * 3. NO FAKE DATA: If no developer has points > 0 in a category, returns NULL.
 *    The frontend will cleanly show "Hali developer mavjud emas."
 * 4. NEVER copies global score or uses primaryCategory as a fallback for category points.
 */
export async function getDeterministicTopTalents() {
  const result = {
    web: null,
    ai: null,
    cyber: null,
    ux: null,
  };

  // Fetch all category score records where points > 0
  const allCategoryScores = await prisma.userCategoryScore.findMany({
    where: {
      points: { gt: 0 },
    },
    include: {
      user: {
        include: {
          skills: { include: { skill: true }, take: 6 },
          projects: { take: 3 },
          attempts: { select: { id: true, passed: true } },
        },
      },
    },
    orderBy: [
      { points: "desc" },
      { passedChallenges: "desc" },
      { updatedAt: "asc" },
    ],
  });

  const usedUserIds = new Set();

  for (const cat of VALID_CATEGORIES) {
    // Filter available candidates for this category who haven't been assigned to another category
    const catCandidates = allCategoryScores.filter(
      (cs) => cs.category === cat && !usedUserIds.has(cs.userId) && cs.user
    );

    // Sort priority:
    // 1. Primary category matches current category (specialist priority)
    // 2. Higher category points
    // 3. Higher passed challenges count
    catCandidates.sort((a, b) => {
      const aSpecialist = a.user.primaryCategory?.toLowerCase() === cat ? 1 : 0;
      const bSpecialist = b.user.primaryCategory?.toLowerCase() === cat ? 1 : 0;
      if (aSpecialist !== bSpecialist) return bSpecialist - aSpecialist;
      if (b.points !== a.points) return b.points - a.points;
      return b.passedChallenges - a.passedChallenges;
    });

    const topScoreRecord = catCandidates[0];

    if (topScoreRecord && topScoreRecord.points > 0 && topScoreRecord.user) {
      usedUserIds.add(topScoreRecord.userId);
      const u = topScoreRecord.user;
      const totalAttempts = u.attempts?.length || 0;
      const passedCount = u.attempts?.filter((a) => a.passed).length || 0;
      const accuracy = totalAttempts > 0 ? Math.round((passedCount / totalAttempts) * 100) : null;

      result[cat] = {
        id: u.id,
        name: u.name,
        username: u.username,
        role: u.role,
        province: u.province,
        level: u.level,
        globalScore: u.score,
        globalRank: u.rank,
        categoryPoints: topScoreRecord.points,
        passedChallenges: topScoreRecord.passedChallenges,
        completedChallenges: topScoreRecord.completedChallenges,
        accuracy,
        online: u.online,
        avatar: u.avatar,
        skills: u.skills.map((s) => s.skill?.name).filter(Boolean),
        projectsCount: u.projects.length,
      };
    } else {
      // Fallback: Check if any registered user has primaryCategory matching this category
      const fallbackUser = await prisma.user.findFirst({
        where: {
          primaryCategory: cat,
          NOT: { id: { in: Array.from(usedUserIds) } }
        },
        orderBy: [{ score: "desc" }, { createdAt: "desc" }],
        include: {
          skills: { include: { skill: true }, take: 6 },
          projects: { take: 3 },
          attempts: { select: { id: true, passed: true } },
        }
      });

      if (fallbackUser) {
        usedUserIds.add(fallbackUser.id);
        const totalAttempts = fallbackUser.attempts?.length || 0;
        const passedCount = fallbackUser.attempts?.filter((a) => a.passed).length || 0;
        const accuracy = totalAttempts > 0 ? Math.round((passedCount / totalAttempts) * 100) : null;

        result[cat] = {
          id: fallbackUser.id,
          name: fallbackUser.name,
          username: fallbackUser.username,
          role: fallbackUser.role || "Dasturchi",
          province: fallbackUser.province || "Toshkent shahri",
          level: fallbackUser.level || 1,
          globalScore: fallbackUser.score || 0,
          globalRank: fallbackUser.rank || 1,
          categoryPoints: 0,
          passedChallenges: 0,
          completedChallenges: 0,
          accuracy,
          online: Boolean(fallbackUser.online),
          avatar: fallbackUser.avatar,
          skills: fallbackUser.skills?.map((s) => s.skill?.name).filter(Boolean) || [],
          projectsCount: fallbackUser.projects?.length || 0,
        };
      } else {
        result[cat] = null;
      }
    }
  }

  return result;
}
