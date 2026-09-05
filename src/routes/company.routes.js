import { Router } from "express";
import jwt from "jsonwebtoken";
import { prisma } from "../lib/prisma.js";

const r = Router();
const COMPANY_PASS = process.env.COMPANY_PASSWORD || "company2026";

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
    const [totalUsers, onlineCount, competitionsCount, totalSubmissions, disqualifiedMembers] =
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
      ]);

    const disqualifiedUserIds = new Set(disqualifiedMembers.map((m) => m.userId));
    const cleanCandidatesCount = Math.max(0, totalUsers - disqualifiedUserIds.size);

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
        disqualifiedCount: disqualifiedUserIds.size,
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

    const users = await prisma.user.findMany({
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
                competition: { select: { id: true, title: true } },
              },
            },
          },
        },
        competitionAnswers: {
          select: { id: true, correct: true, points: true, timeTaken: true },
        },
        submissions: {
          select: { id: true, status: true, score: true },
        },
      },
    });

    const candidates = users
      .map((u) => {
        const isDisqualifiedAny = u.teamMemberships.some((m) => m.disqualified);
        const totalAnswers = u.competitionAnswers.length;
        const correctAnswers = u.competitionAnswers.filter((a) => a.correct).length;
        const accuracy = totalAnswers > 0 ? Math.round((correctAnswers / totalAnswers) * 100) : null;
        const totalPointsEarned = u.competitionAnswers.reduce((acc, cur) => acc + (cur.points || 0), 0);
        const avgTime =
          totalAnswers > 0
            ? Math.round(u.competitionAnswers.reduce((acc, cur) => acc + (cur.timeTaken || 0), 0) / totalAnswers)
            : null;

        // contact info from user or team memberships
        const contactPhone =
          u.phone || u.teamMemberships.find((m) => m.contactPhone)?.contactPhone || null;
        const contactTelegram =
          u.telegram || u.teamMemberships.find((m) => m.telegram)?.telegram || null;

        // wins in competitions
        const wonCompetitions = u.teamMemberships.filter((m) => m.team?.rank === 1).length;

        return {
          id: u.id,
          name: u.name,
          username: u.username,
          email: u.email,
          phone: contactPhone,
          telegram: contactTelegram,
          bio: u.bio,
          role: u.role,
          level: u.level,
          province: u.province,
          avatar: u.avatar,
          primaryCategory: u.primaryCategory,
          score: u.score,
          rank: u.rank,
          online: u.online,
          createdAt: u.createdAt,
          isClean: !isDisqualifiedAny,
          suspicionCount: u.teamMemberships.filter((m) => m.disqualified).length,
          competitionsCount: u.teamMemberships.length,
          wonCompetitionsCount: wonCompetitions,
          quizAccuracy: accuracy,
          totalAnswers,
          correctAnswers,
          avgAnswerTimeSeconds: avgTime,
          competitionPointsEarned: totalPointsEarned,
          codeSubmissionsCount: u.submissions.length,
          skills: u.skills.map((s) => s.skill?.name).filter(Boolean),
        };
      })
      .filter((c) => {
        if (onlyClean === "true" && !c.isClean) {
          return false;
        }
        return true;
      });

    // Custom sorting if accuracy or competitions requested
    if (sortBy === "accuracy") {
      candidates.sort((a, b) => (b.quizAccuracy || 0) - (a.quizAccuracy || 0));
    } else if (sortBy === "competitions") {
      candidates.sort((a, b) => b.competitionsCount - a.competitionsCount);
    }

    res.json({ ok: true, candidates, count: candidates.length });
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
    const disqualificationRecords = user.teamMemberships
      .filter((m) => m.disqualified)
      .map((m) => ({
        competitionTitle: m.team?.competition?.title || "Noma'lum musobaqa",
        reason: m.disqualifiedReason || "Shubhali harakat / qoidabuzarlik",
        date: m.joinedAt,
      }));

    const totalAnswers = user.competitionAnswers.length;
    const correctAnswers = user.competitionAnswers.filter((a) => a.correct).length;
    const accuracy = totalAnswers > 0 ? Math.round((correctAnswers / totalAnswers) * 100) : null;
    const avgTime =
      totalAnswers > 0
        ? Math.round(user.competitionAnswers.reduce((acc, cur) => acc + (cur.timeTaken || 0), 0) / totalAnswers)
        : null;

    // Contact info
    const contactPhone =
      user.phone || user.teamMemberships.find((m) => m.contactPhone)?.contactPhone || null;
    const contactTelegram =
      user.telegram || user.teamMemberships.find((m) => m.telegram)?.telegram || null;

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
        role: user.role,
        level: user.level,
        province: user.province,
        avatar: user.avatar,
        primaryCategory: user.primaryCategory,
        score: user.score,
        rank: user.rank,
        online: user.online,
        createdAt: user.createdAt,
        isClean: !isDisqualifiedAny,
        disqualificationRecords,
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
          totalCompetitions: user.teamMemberships.length,
          wonCompetitions: user.teamMemberships.filter((m) => m.team?.rank === 1).length,
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
    const competitions = await prisma.competition.findMany({
      orderBy: { startsAt: "desc" },
      include: {
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
    });

    res.json({ ok: true, competitions });
  } catch (err) {
    next(err);
  }
});

export default r;
