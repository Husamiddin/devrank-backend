import { prisma } from "../lib/prisma.js";
import { computeCategoryScoresForUser } from "./categoryScore.service.js";

/**
 * Calculates a deterministic job match score (0-100%) for a given candidate against a job specification.
 * Formula:
 * - Category relevance (40%): How well candidate category points match/exceed job.minCategoryPoints
 * - Required skills (30%): Proportion of required skills candidate actually possesses
 * - Challenge & accuracy performance (15%): Passed attempts and accuracy
 * - Level & global score (10%): Proportional to minLevel / minGlobalScore
 * - Portfolio & projects (5%): Real projects uploaded
 */
export function calculateJobMatch(candidate, job) {
  let score = 0;

  // 1. Category relevance (40 max)
  const jobCategory = String(job.category || "web").toLowerCase();
  const candidateCatPoints = candidate.categoryPoints?.[jobCategory] || 0;
  const minPoints = job.minCategoryPoints || 100;
  if (candidateCatPoints >= minPoints) {
    score += 40;
  } else if (minPoints > 0) {
    score += Math.round((candidateCatPoints / minPoints) * 40);
  } else if (candidate.primaryCategory === jobCategory) {
    score += 30;
  }

  // 2. Required skills match (30 max)
  const required = (job.requiredSkills || []).map((s) => s.toLowerCase().trim());
  const candidateSkills = (candidate.skills || []).map((s) =>
    (typeof s === "string" ? s : s.name || s.skill?.name || "").toLowerCase().trim()
  );
  if (required.length === 0) {
    score += 30;
  } else {
    const matchedCount = required.filter((r) => candidateSkills.includes(r)).length;
    score += Math.round((matchedCount / required.length) * 30);
  }

  // 3. Challenge performance & accuracy (15 max)
  const accuracy = candidate.accuracy !== null && candidate.accuracy !== undefined ? candidate.accuracy : 50;
  score += Math.round((accuracy / 100) * 15);

  // 4. Level requirement (10 max)
  const minLvl = job.minLevel || 1;
  if (candidate.level >= minLvl) {
    score += 10;
  } else {
    score += Math.round((candidate.level / minLvl) * 10);
  }

  // 5. Portfolio projects (5 max)
  const projCount = candidate.projectsCount || candidate.projects?.length || 0;
  if (projCount >= 3) {
    score += 5;
  } else {
    score += projCount * 1.5;
  }

  return Math.min(100, Math.max(0, Math.round(score)));
}

/**
 * Finds and ranks real candidates for a specific job in the database.
 */
export async function getCandidatesForJob(jobId, companyId) {
  const job = await prisma.job.findFirst({
    where: { id: jobId, companyId },
  });
  if (!job) return null;

  const users = await prisma.user.findMany({
    orderBy: [{ score: "desc" }],
    include: {
      skills: { include: { skill: true } },
      projects: { take: 3 },
      attempts: { select: { id: true, passed: true, score: true } },
      categoryScores: true,
      shortlists: { where: { companyId } },
    },
    take: 50,
  });

  const candidatesWithMatch = await Promise.all(
    users.map(async (u) => {
      // Build category points map
      const catPoints = { web: 0, ai: 0, cyber: 0, ux: 0 };
      u.categoryScores.forEach((cs) => {
        if (catPoints[cs.category] !== undefined) {
          catPoints[cs.category] = cs.points;
        }
      });
      // If user has baseline score but no category scores, compute them
      if (Object.values(catPoints).every((v) => v === 0) && u.score > 0) {
        const computed = await computeCategoryScoresForUser(u.id);
        if (computed) {
          Object.keys(computed).forEach((k) => {
            catPoints[k] = computed[k].points;
          });
        }
      }

      const totalAttempts = u.attempts.length;
      const passedAttempts = u.attempts.filter((a) => a.passed).length;
      const accuracy = totalAttempts > 0 ? Math.round((passedAttempts / totalAttempts) * 100) : null;

      const candidateData = {
        id: u.id,
        name: u.name,
        username: u.username,
        role: u.role,
        province: u.province,
        level: u.level,
        score: u.score,
        rank: u.rank,
        online: u.online,
        avatar: u.avatar,
        primaryCategory: u.primaryCategory,
        categoryPoints: catPoints,
        skills: u.skills.map((s) => s.skill?.name).filter(Boolean),
        projectsCount: u.projects.length,
        accuracy,
        shortlistStatus: u.shortlists?.[0]?.status || null,
        shortlistId: u.shortlists?.[0]?.id || null,
      };

      const matchScore = calculateJobMatch(candidateData, job);

      return {
        ...candidateData,
        matchScore,
      };
    })
  );

  // Sort by match score descending
  return candidatesWithMatch.sort((a, b) => b.matchScore - a.matchScore);
}
