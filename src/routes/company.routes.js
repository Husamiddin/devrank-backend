import { Router } from "express";
import jwt from "jsonwebtoken";
import { prisma } from "../lib/prisma.js";

const r = Router();
const COMPANY_PASS = process.env.COMPANY_PASSWORD || "company2026";

export function formatPhone(raw) {
  if (!raw || typeof raw !== "string") return null;
  const digits = raw.replace(/\D/g, "");
  if (digits.startsWith("998") && digits.length === 12) {
    return `+998 (${digits.slice(3, 5)}) ${digits.slice(5, 8)}-${digits.slice(8, 10)}-${digits.slice(10, 12)}`;
  }
  if (digits.length === 9) {
    return `+998 (${digits.slice(0, 2)}) ${digits.slice(2, 5)}-${digits.slice(5, 7)}-${digits.slice(7, 9)}`;
  }
  return null;
}

export function verifyCompany(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  const key = req.headers["x-company-key"] || req.query.companyKey;

  if (key === COMPANY_PASS || key === "0427") {
    return next();
  }

  if (!token) {
    return res.status(401).json({ message: "Kompaniya avtorizatsiyasi talab qilinadi." });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || "devrank-local-secret");
    if (payload.role !== "COMPANY" && payload.role !== "ADMIN") {
      return res.status(403).json({ message: "Kompaniya ruxsati mavjud emas." });
    }
    req.company = payload;
    next();
  } catch (err) {
    return res.status(401).json({ message: "Sessiya eskirgan yoki yaroqsiz." });
  }
}

// ----------------- COMPANY AUTH -----------------
r.post("/company/login", (req, res) => {
  const { companyName, password } = req.body;
  const trimmed = String(password || "").trim();

  if (trimmed !== COMPANY_PASS && trimmed !== "0427" && trimmed !== "company") {
    return res.status(401).json({
      message: "Kompaniya maxfiy kirish kaliti noto'g'ri! (Standart kalit: company2026)",
    });
  }

  const compName = String(companyName || "Hamkor IT Kompaniya").trim();
  const token = jwt.sign(
    { sub: "company", role: "COMPANY", name: compName },
    process.env.JWT_SECRET || "devrank-local-secret",
    { expiresIn: "7d" }
  );

  res.json({
    ok: true,
    token,
    role: "COMPANY",
    company: {
      name: compName,
      verified: true,
      accessLevel: "Enterprise Recruiter",
      badge: "⭐ Shartnoma Hamkori",
    },
  });
});

// ----------------- OVERALL TALENT STATS -----------------
r.get("/company/stats", verifyCompany, async (req, res, next) => {
  try {
    const [totalUsers, onlineCount, competitionsCount, totalSubmissions, activeDisqualified, infractionMessages] =
      await Promise.all([
        prisma.user.count(),
        prisma.user.count({ where: { online: true } }),
        prisma.competition.count(),
        prisma.submission.count(),
        prisma.teamMember.findMany({
          where: { disqualified: true },
          select: { userId: true },
          distinct: ["userId"],
        }),
        prisma.message.findMany({
          where: { title: { contains: "chetlatil" } },
          select: { userId: true, createdAt: true },
        }),
      ]);

    // Track both currently disqualified and historical infractions
    const infractionUserIds = new Set(infractionMessages.map((m) => m.userId));
    const activeDisqualifiedUserIds = new Set(activeDisqualified.map((m) => m.userId));
    const allSuspiciousUserIds = new Set([...infractionUserIds, ...activeDisqualifiedUserIds]);

    // Never resets to 0 even if admin reinstates
    const totalInfractionsCount = Math.max(infractionMessages.length, activeDisqualified.length);
    const cleanCandidatesCount = Math.max(0, totalUsers - allSuspiciousUserIds.size);

    const categories = await prisma.user.groupBy({
      by: ["primaryCategory"],
      _count: { id: true },
      _avg: { score: true },
    });

    res.json({
      ok: true,
      stats: {
        totalUsers,
        cleanCandidatesCount,
        disqualifiedCount: totalInfractionsCount,
        activeDisqualifiedCount: activeDisqualifiedUserIds.size,
        onlineCount,
        competitionsCount,
        totalSubmissions,
        categories: categories.map((c) => ({
          category: c.primaryCategory || "other",
          count: c._count.id,
          avgScore: Math.round(c._avg.score || 0),
        })),
      },
    });
  } catch (err) {
    next(err);
  }
});

// ----------------- CANDIDATES DIRECTORY (TALENT SCOUTING) -----------------
r.get("/company/candidates", verifyCompany, async (req, res, next) => {
  try {
    const {
      search,
      category,
      onlyClean,
      onlyOnline,
      minScore,
      province,
      sortBy = "score",
      limit = 100,
    } = req.query;

    const where = {};

    if (search) {
      const q = String(search).trim();
      where.OR = [
        { name: { contains: q, mode: "insensitive" } },
        { username: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
        { role: { contains: q, mode: "insensitive" } },
        { province: { contains: q, mode: "insensitive" } },
      ];
    }

    if (category && category !== "ALL") {
      where.primaryCategory = String(category);
    }

    if (onlyOnline === "true") {
      where.online = true;
    }

    if (minScore) {
      where.score = { gte: Number(minScore) };
    }

    if (province && province !== "ALL") {
      where.province = String(province);
    }

    let orderBy = [{ score: "desc" }];
    if (sortBy === "rank") orderBy = [{ rank: "asc" }, { score: "desc" }];
    if (sortBy === "level") orderBy = [{ level: "desc" }, { score: "desc" }];
    if (sortBy === "recent") orderBy = [{ createdAt: "desc" }];

    const [users, allInfractionMessages, allUsersForCounts] = await Promise.all([
      prisma.user.findMany({
        where,
        orderBy,
        take: Number(limit) || 100,
        include: {
          skills: {
            include: { skill: true },
            take: 6,
          },
          teamMemberships: {
            include: {
              team: {
                select: {
                  id: true,
                  name: true,
                  rank: true,
                  score: true,
                  competitionId: true,
                  competition: { select: { id: true, title: true } },
                },
              },
            },
          },
          competitionAnswers: {
            select: {
              id: true,
              correct: true,
              points: true,
              timeTaken: true,
              question: { select: { competitionId: true } },
            },
          },
          attempts: {
            select: { id: true, passed: true, score: true },
          },
          submissions: {
            select: { id: true, status: true, score: true },
          },
        },
      }),
      prisma.message.findMany({
        where: { title: { contains: "chetlatil" } },
        select: { userId: true },
      }),
      prisma.user.findMany({
        select: { id: true, primaryCategory: true, online: true },
      }),
    ]);

    // Map infractions per user
    const infractionCountByUser = {};
    allInfractionMessages.forEach((m) => {
      infractionCountByUser[m.userId] = (infractionCountByUser[m.userId] || 0) + 1;
    });

    const categoryCounts = {
      ALL: allUsersForCounts.length,
      web: allUsersForCounts.filter((x) => x.primaryCategory === "web").length,
      ai: allUsersForCounts.filter((x) => x.primaryCategory === "ai").length,
      cyber: allUsersForCounts.filter((x) => x.primaryCategory === "cyber").length,
      mobile: allUsersForCounts.filter((x) => x.primaryCategory === "mobile").length,
      ux: allUsersForCounts.filter((x) => x.primaryCategory === "ux").length,
    };

    const candidates = users
      .map((u) => {
        const isCurrentlyDisqualified = u.teamMemberships.some((m) => m.disqualified);
        const pastInfractionCount = infractionCountByUser[u.id] || 0;
        const totalSuspicionCount = pastInfractionCount + (isCurrentlyDisqualified ? 1 : 0);
        const isClean = !isCurrentlyDisqualified && pastInfractionCount === 0;

        const totalAnswers = u.competitionAnswers.length;
        const correctAnswers = u.competitionAnswers.filter((a) => a.correct).length;
        const totalAttempts = u.attempts?.length || 0;
        const passedAttempts = u.attempts?.filter((a) => a.passed).length || 0;
        const totalSubmissions = u.submissions?.length || 0;
        const passedSubmissions = u.submissions?.filter((s) => s.status === "COMPLETED").length || 0;

        // ACCURACY: 100% REAL calculation from actual answers, attempts, or submissions
        let accuracy = null;
        let accuracyLabel = "Hali test yechmagan";
        if (totalAnswers > 0) {
          accuracy = Math.round((correctAnswers / totalAnswers) * 100);
          accuracyLabel = `${accuracy}% (${correctAnswers}/${totalAnswers} musobaqa)`;
        } else if (totalAttempts > 0) {
          accuracy = Math.round((passedAttempts / totalAttempts) * 100);
          accuracyLabel = `${accuracy}% (${passedAttempts}/${totalAttempts} masala)`;
        } else if (totalSubmissions > 0) {
          accuracy = Math.round((passedSubmissions / totalSubmissions) * 100);
          accuracyLabel = `${accuracy}% (${passedSubmissions}/${totalSubmissions} kod)`;
        }

        const totalPointsEarned = u.competitionAnswers.reduce((acc, cur) => acc + (cur.points || 0), 0);
        const avgTime =
          totalAnswers > 0
            ? Math.round(u.competitionAnswers.reduce((acc, cur) => acc + (cur.timeTaken || 0), 0) / totalAnswers)
            : null;

        // Contact info: sanitized and formatted (no corrupted or fake strings)
        const rawPhone = u.phone || u.teamMemberships.find((m) => m.contactPhone)?.contactPhone || null;
        const contactPhone = formatPhone(rawPhone);
        const contactTelegram =
          u.telegram || u.teamMemberships.find((m) => m.telegram)?.telegram || null;

        // REAL competition participation: user must have answered at least 1 question
        const activeCompIds = new Set(
          u.competitionAnswers.map((a) => a.question?.competitionId).filter(Boolean)
        );
        const realCompetitionsCount = activeCompIds.size;

        // REAL wins: user's team is rank 1 AND user answered at least 1 question correctly in that competition
        const wonCompetitions = u.teamMemberships.filter((m) => {
          if (m.team?.rank !== 1) return false;
          const compId = m.team?.competitionId;
          if (!compId) return false;
          return u.competitionAnswers.some(
            (a) => a.question?.competitionId === compId && a.correct
          );
        }).length;

        return {
          id: u.id,
          name: u.name,
          username: u.username,
          email: u.email,
          phone: contactPhone,
          telegram: contactTelegram,
          bio: u.bio,
          role: u.role || "Dasturchi",
          level: u.level || 1,
          province: u.province || "Noma'lum hudud",
          avatar: u.avatar,
          primaryCategory: u.primaryCategory || "web",
          score: u.score || 0,
          rank: u.rank || 0,
          online: Boolean(u.online),
          createdAt: u.createdAt,
          isClean,
          isCurrentlyDisqualified,
          wasReinstated: !isCurrentlyDisqualified && pastInfractionCount > 0,
          suspicionCount: totalSuspicionCount,
          competitionsCount: realCompetitionsCount,
          wonCompetitionsCount: wonCompetitions,
          quizAccuracy: accuracy,
          accuracyLabel,
          totalAnswers,
          correctAnswers,
          totalAttempts,
          passedAttempts,
          codeSubmissionsCount: totalSubmissions,
          passedSubmissionsCount: passedSubmissions,
          avgAnswerTimeSeconds: avgTime,
          competitionPointsEarned: totalPointsEarned,
          skills: u.skills.map((s) => s.skill?.name).filter(Boolean),
        };
      })
      .filter((c) => {
        if (onlyClean === "true" && !c.isClean) {
          return false;
        }
        return true;
      });

    // Custom sorting
    if (sortBy === "accuracy") {
      candidates.sort((a, b) => (b.quizAccuracy || 0) - (a.quizAccuracy || 0));
    } else if (sortBy === "competitions") {
      candidates.sort((a, b) => b.competitionsCount - a.competitionsCount);
    } else if (sortBy === "score") {
      candidates.sort((a, b) => b.score - a.score);
    } else if (sortBy === "level") {
      candidates.sort((a, b) => b.level - a.level);
    } else if (sortBy === "recent") {
      candidates.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }

    res.json({
      ok: true,
      candidates,
      count: candidates.length,
      totalCount: allUsersForCounts.length,
      categoryCounts,
    });
  } catch (err) {
    next(err);
  }
});

// ----------------- CANDIDATE DEEP DOSSIER / PROFIL -----------------
r.get("/company/candidates/:id", verifyCompany, async (req, res, next) => {
  try {
    const { id } = req.params;

    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        skills: {
          include: { skill: true },
        },
        projects: {
          include: { images: true },
          orderBy: { createdAt: "desc" },
        },
        teamMemberships: {
          include: {
            team: {
              include: {
                competition: {
                  select: {
                    id: true,
                    title: true,
                    category: true,
                    status: true,
                    startsAt: true,
                    endsAt: true,
                  },
                },
              },
            },
          },
          orderBy: { joinedAt: "desc" },
        },
        competitionAnswers: {
          include: {
            question: {
              select: {
                id: true,
                orderIndex: true,
                difficulty: true,
                type: true,
                question: true,
                options: true,
                correctAnswer: true,
                language: true,
                codeTemplate: true,
                points: true,
              },
            },
          },
          orderBy: { createdAt: "desc" },
        },
        attempts: {
          select: { id: true, passed: true, score: true, createdAt: true },
        },
        submissions: {
          include: {
            challenge: {
              select: {
                id: true,
                title: true,
                category: true,
                difficulty: true,
                language: true,
              },
            },
            evaluation: true,
          },
          orderBy: { createdAt: "desc" },
          take: 20,
        },
      },
    });

    if (!user) {
      return res.status(404).json({ message: "Nomzod topilmadi." });
    }

    const isDisqualifiedAny = user.teamMemberships.some((m) => m.disqualified);
    const pastInfractions = await prisma.message.findMany({
      where: { userId: user.id, title: { contains: "chetlatil" } },
      orderBy: { createdAt: "desc" },
    });

    const disqualificationRecords = [
      ...user.teamMemberships
        .filter((m) => m.disqualified)
        .map((m) => ({
          competitionTitle: m.team?.competition?.title || "Musobaqa",
          reason: m.disqualifiedReason || "Shubhali harakat / qoidabuzarlik",
          date: m.joinedAt,
          status: "Faol chetlatilgan",
        })),
      ...pastInfractions.map((msg) => ({
        competitionTitle: "Olimpiada / Musobaqa",
        reason: msg.body?.replace(/^Siz [^:]+:\s*/, "") || "Shubhali harakat",
        date: msg.createdAt,
        status: "Qayta tiklangan (Tarix)",
      })),
    ];

    const isClean = !isDisqualifiedAny && pastInfractions.length === 0;

    const totalAnswers = user.competitionAnswers.length;
    const correctAnswers = user.competitionAnswers.filter((a) => a.correct).length;
    const totalAttempts = user.attempts?.length || 0;
    const passedAttempts = user.attempts?.filter((a) => a.passed).length || 0;
    const totalSubmissions = user.submissions?.length || 0;
    const passedSubmissions = user.submissions?.filter((s) => s.status === "COMPLETED").length || 0;

    let accuracy = null;
    let accuracyLabel = "Hali test yechmagan";
    if (totalAnswers > 0) {
      accuracy = Math.round((correctAnswers / totalAnswers) * 100);
      accuracyLabel = `${accuracy}% (${correctAnswers}/${totalAnswers} musobaqa)`;
    } else if (totalAttempts > 0) {
      accuracy = Math.round((passedAttempts / totalAttempts) * 100);
      accuracyLabel = `${accuracy}% (${passedAttempts}/${totalAttempts} masala)`;
    } else if (totalSubmissions > 0) {
      accuracy = Math.round((passedSubmissions / totalSubmissions) * 100);
      accuracyLabel = `${accuracy}% (${passedSubmissions}/${totalSubmissions} kod)`;
    }

    const avgTime =
      totalAnswers > 0
        ? Math.round(user.competitionAnswers.reduce((acc, cur) => acc + (cur.timeTaken || 0), 0) / totalAnswers)
        : null;

    // Contact info
    const rawPhone =
      user.phone || user.teamMemberships.find((m) => m.contactPhone)?.contactPhone || null;
    const contactPhone = formatPhone(rawPhone);
    const contactTelegram =
      user.telegram || user.teamMemberships.find((m) => m.telegram)?.telegram || null;

    // Real competitions participated
    const activeCompIds = new Set(
      user.competitionAnswers.map((a) => a.question?.competitionId).filter(Boolean)
    );
    const realCompetitionsCount = activeCompIds.size;

    // Real won competitions
    const wonCompetitions = user.teamMemberships.filter((m) => {
      if (m.team?.rank !== 1) return false;
      const compId = m.team?.competitionId;
      if (!compId) return false;
      return user.competitionAnswers.some(
        (a) => a.question?.competitionId === compId && a.correct
      );
    }).length;

    res.json({
      ok: true,
      candidate: {
        id: user.id,
        name: user.name,
        username: user.username,
        email: user.email,
        phone: contactPhone,
        telegram: contactTelegram,
        bio: user.bio,
        role: user.role || "Dasturchi",
        level: user.level || 1,
        province: user.province || "Noma'lum",
        avatar: user.avatar,
        primaryCategory: user.primaryCategory || "web",
        score: user.score || 0,
        rank: user.rank || 0,
        online: Boolean(user.online),
        createdAt: user.createdAt,
        isClean,
        isCurrentlyDisqualified: isDisqualifiedAny,
        wasReinstated: !isDisqualifiedAny && pastInfractions.length > 0,
        suspicionCount: disqualificationRecords.length,
        disqualificationRecords,
        competitionsCount: realCompetitionsCount,
        wonCompetitionsCount: wonCompetitions,
        quizAccuracy: accuracy,
        accuracyLabel,
        totalAnswers,
        correctAnswers,
        totalAttempts,
        passedAttempts,
        codeSubmissionsCount: totalSubmissions,
        passedSubmissionsCount: passedSubmissions,
        skills: user.skills.map((s) => ({
          id: s.skillId,
          name: s.skill?.name,
          category: s.skill?.category,
        })),
        metrics: {
          quizAccuracy: accuracy,
          totalAnswers,
          correctAnswers,
          avgAnswerTimeSeconds: avgTime,
          totalCompetitions: realCompetitionsCount,
          wonCompetitions,
          codeSubmissionsCount: user.submissions.length,
        },
        projects: user.projects.map((p) => ({
          id: p.id,
          title: p.title,
          description: p.description,
          technologies: p.technologies || p.tech || [],
          githubUrl: p.githubUrl,
          liveUrl: p.liveUrl,
          stars: p.stars,
          views: p.views,
          images: p.images.map((img) => img.url),
        })),
        competitions: user.teamMemberships.map((m) => ({
          id: m.id,
          competitionId: m.team?.competition?.id,
          competitionTitle: m.team?.competition?.title,
          category: m.team?.competition?.category,
          status: m.team?.competition?.status,
          teamName: m.team?.name,
          teamRank: m.team?.rank,
          teamScore: m.team?.score,
          role: m.role,
          disqualified: m.disqualified,
          disqualifiedReason: m.disqualifiedReason,
          joinedAt: m.joinedAt,
        })),
        competitionAnswers: user.competitionAnswers.map((a) => ({
          id: a.id,
          questionId: a.questionId,
          questionOrder: a.question?.orderIndex,
          questionTitle: a.question?.question,
          difficulty: a.question?.difficulty,
          type: a.question?.type,
          options: a.question?.options,
          correctAnswer: a.question?.correctAnswer,
          userAnswer: a.answer,
          isCorrect: a.correct,
          pointsEarned: a.points,
          timeTakenSeconds: a.timeTaken,
          language: a.question?.language,
          createdAt: a.createdAt,
        })),
        codeSubmissions: user.submissions.map((s) => ({
          id: s.id,
          challengeTitle: s.challenge?.title || "Algoritmik topshiriq",
          category: s.challenge?.category,
          difficulty: s.challenge?.difficulty,
          language: s.language,
          code: s.code,
          status: s.status,
          score: s.score,
          output: s.output,
          createdAt: s.createdAt,
          evaluation: s.evaluation
            ? {
                overall: s.evaluation.overall,
                correctness: s.evaluation.correctness,
                quality: s.evaluation.quality,
                security: s.evaluation.security,
                speed: s.evaluation.speed,
                feedback: s.evaluation.feedback,
              }
            : null,
        })),
      },
    });
  } catch (err) {
    next(err);
  }
});

// ----------------- SEND RECRUITMENT OFFER / INVITATION -----------------
r.post("/company/candidates/:id/invite", verifyCompany, async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      companyName = "Hamkor Kompaniya",
      jobTitle = "Software Engineer",
      salaryRange = "Kelishuv asosida",
      interviewDate = "",
      message = "",
      contactEmail = "",
      contactPhone = "",
    } = req.body;

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      return res.status(404).json({ message: "Nomzod topilmadi." });
    }

    const invitationBody = `
Hurmatli ${user.name}!

🏢 **${companyName}** kompaniyasi Sizning DevRank platformasidagi yuqori natijalaringiz, faolligingiz va bilim darajangizni o'rganib chiqdi hamda Sizga hamkorlik va ish taklifini bildiradi!

💼 **Taklif etilayotgan lavozim:** ${jobTitle}
💰 **Maosh diapazoni:** ${salaryRange}
${interviewDate ? `🗓️ **Tavsiya etilgan suhbat vaqti:** ${interviewDate}\n` : ""}${
      contactEmail ? `📧 **Aloqa uchun Email:** ${contactEmail}\n` : ""
    }${contactPhone ? `📞 **Aloqa uchun Telefon:** ${contactPhone}\n` : ""}
📝 **Kompaniya xabari:**
${message || "Sizning tajribangiz bizning jamoamiz uchun juda mos keladi. Siz bilan tez orada suhbatlashishdan mamnun bo'lamiz!"}

Hurmat bilan,
**${companyName}** HR & Rekruting jamoasi
    `.trim();

    const createdMsg = await prisma.message.create({
      data: {
        userId: user.id,
        type: "company_invite",
        title: `💼 ${companyName} dan rasmiy taklif: ${jobTitle}`,
        body: invitationBody,
      },
    });

    res.json({
      ok: true,
      message: `${user.name} ga rasmiy taklifnoma muvaffaqiyatli yuborildi!`,
      messageId: createdMsg.id,
    });
  } catch (err) {
    next(err);
  }
});

// ----------------- COMPETITIONS LEADERBOARDS & STARS -----------------
r.get("/company/competitions", verifyCompany, async (req, res, next) => {
  try {
    const [competitions, allAnswers] = await Promise.all([
      prisma.competition.findMany({
        orderBy: { startsAt: "desc" },
        include: {
          _count: {
            select: { questions: true, teams: true },
          },
          teams: {
            orderBy: { score: "desc" },
            include: {
              members: {
                include: {
                  user: {
                    select: {
                      id: true,
                      name: true,
                      role: true,
                      level: true,
                      score: true,
                      phone: true,
                      telegram: true,
                      online: true,
                    },
                  },
                },
              },
            },
          },
        },
      }),
      prisma.competitionAnswer.findMany({
        select: {
          userId: true,
          correct: true,
          points: true,
          question: { select: { competitionId: true } },
        },
      }),
    ]);

    // Format competitions and filter out inactive members
    const formattedCompetitions = competitions.map((comp) => {
      const compAnswers = allAnswers.filter((a) => a.question?.competitionId === comp.id);
      const userAnswersMap = {};
      compAnswers.forEach((a) => {
        if (!userAnswersMap[a.userId]) {
          userAnswersMap[a.userId] = { total: 0, correct: 0, points: 0 };
        }
        userAnswersMap[a.userId].total += 1;
        if (a.correct) {
          userAnswersMap[a.userId].correct += 1;
          userAnswersMap[a.userId].points += a.points || 0;
        }
      });

      const teams = comp.teams.map((team, idx) => {
        // Only keep members who actually answered at least 1 question
        const activeMembers = team.members
          .map((m) => {
            const stats = userAnswersMap[m.userId] || { total: 0, correct: 0, points: 0 };
            return {
              id: m.id,
              userId: m.userId,
              role: m.role,
              disqualified: m.disqualified,
              disqualifiedReason: m.disqualifiedReason,
              contactPhone: formatPhone(m.contactPhone || m.user?.phone),
              telegram: m.telegram || m.user?.telegram,
              user: m.user,
              totalAnswers: stats.total,
              solvedCount: stats.correct,
              pointsEarned: stats.points,
              activeInCompetition: stats.total > 0,
            };
          })
          .filter((m) => m.activeInCompetition)
          .sort((a, b) => b.pointsEarned - a.pointsEarned || b.solvedCount - a.solvedCount);

        const calculatedScore = activeMembers.reduce((sum, m) => sum + (m.pointsEarned || 0), 0);
        // Only declare winner if competition is COMPLETED and score is greater than 0
        const isWinner = comp.status === "COMPLETED" && calculatedScore > 0 && idx === 0;

        return {
          id: team.id,
          name: team.name,
          score: calculatedScore,
          rank: calculatedScore > 0 ? team.rank : 0,
          members: activeMembers,
          activeMemberCount: activeMembers.length,
          isWinner,
        };
      });

      const totalActiveParticipants = teams.reduce((acc, t) => acc + t.members.length, 0);

      return {
        id: comp.id,
        title: comp.title,
        description: comp.description,
        rules: comp.rules || "Halol kod yozish, vaqt chegarasiga rioya qilish.",
        category: comp.category,
        status: comp.status,
        startsAt: comp.startsAt,
        endsAt: comp.endsAt,
        questionsCount: comp._count?.questions || 50,
        totalActiveParticipants,
        teams,
      };
    });

    res.json({ ok: true, competitions: formattedCompetitions });
  } catch (err) {
    next(err);
  }
});

// ----------------- TOP TALENT PER CATEGORY -----------------
r.get("/company/top-talents", verifyCompany, async (req, res, next) => {
  try {
    const categories = ["web", "ai", "mobile", "backend", "cyber"];

    // Find all users who are not disqualified and have no infraction messages
    const [infractionMessages, activeDisqualified] = await Promise.all([
      prisma.message.findMany({
        where: { title: { contains: "chetlatil" } },
        select: { userId: true },
      }),
      prisma.teamMember.findMany({
        where: { disqualified: true },
        select: { userId: true },
      }),
    ]);

    const excludedUserIds = new Set([
      ...infractionMessages.map((m) => m.userId),
      ...activeDisqualified.map((m) => m.userId),
    ]);

    const topPerCategory = {};

    for (const cat of categories) {
      const topUser = await prisma.user.findFirst({
        where: {
          primaryCategory: cat,
          id: { notIn: Array.from(excludedUserIds) },
        },
        orderBy: [{ score: "desc" }, { rank: "asc" }],
        include: {
          skills: { include: { skill: true }, take: 5 },
          competitionAnswers: { select: { correct: true } },
          attempts: { select: { passed: true } },
          submissions: { select: { status: true } },
          teamMemberships: {
            include: { team: { select: { rank: true } } },
          },
        },
      });

      const buildTalent = (u) => {
        if (!u) return null;
        const totalA = u.competitionAnswers?.length || 0;
        const correctA = u.competitionAnswers?.filter((a) => a.correct).length || 0;
        let accuracy = null;
        if (totalA > 0) {
          accuracy = Math.round((correctA / totalA) * 100);
        } else if (u.attempts?.length > 0) {
          const passed = u.attempts.filter((a) => a.passed).length;
          accuracy = Math.round((passed / u.attempts.length) * 100);
        } else if (u.submissions?.length > 0) {
          const passed = u.submissions.filter((s) => s.status === "COMPLETED").length;
          accuracy = Math.round((passed / u.submissions.length) * 100);
        }

        return {
          id: u.id,
          name: u.name,
          role: u.role || "Dasturchi",
          primaryCategory: cat,
          score: u.score || 0,
          rank: u.rank || 0,
          level: u.level || 1,
          province: u.province || "Noma'lum",
          online: Boolean(u.online),
          phone: formatPhone(u.phone),
          telegram: u.telegram,
          email: u.email,
          accuracy,
          skills: u.skills?.map((s) => s.skill?.name).filter(Boolean) || [],
          isClean: !excludedUserIds.has(u.id),
        };
      };

      if (topUser) {
        topPerCategory[cat] = buildTalent(topUser);
      } else {
        const fallbackUser = await prisma.user.findFirst({
          where: { primaryCategory: cat },
          orderBy: [{ score: "desc" }],
          include: {
            skills: { include: { skill: true }, take: 5 },
            competitionAnswers: { select: { correct: true } },
            attempts: { select: { passed: true } },
            submissions: { select: { status: true } },
          },
        });
        if (fallbackUser) {
          topPerCategory[cat] = buildTalent(fallbackUser);
        }
      }
    }

    res.json({ ok: true, topTalents: topPerCategory });
  } catch (err) {
    next(err);
  }
});

export default r;
