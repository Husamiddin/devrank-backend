import { Router } from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma.js";
import { generateCompetitionQuestions } from "../services/competitionQuiz.service.js";

const r = Router();
const ADMIN_PASS = process.env.LOCAL_ADMIN_PASSWORD || "0427";

export function verifyAdmin(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  const adminKey = req.headers["x-admin-key"] || req.query.adminKey;

  if (adminKey === ADMIN_PASS) {
    return next();
  }

  if (!token) {
    return res.status(401).json({ message: "Admin authorization required." });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || "AslKod-local-secret");
    if (payload.role !== "ADMIN") {
      return res.status(403).json({ message: "Admin ruxsati mavjud emas." });
    }
    next();
  } catch (err) {
    return res.status(401).json({ message: "Admin sessiyasi eskirgan yoki yaroqsiz." });
  }
}

r.post("/admin/login", (req, res) => {
  const { password } = req.body;
  if (String(password || "").trim() !== ADMIN_PASS) {
    return res.status(401).json({ message: "Admin paroli noto'g'ri. (Standart: ....)" });
  }

  const token = jwt.sign(
    { sub: "admin", role: "ADMIN", name: "Super Admin" },
    process.env.JWT_SECRET || "AslKod-local-secret",
    { expiresIn: "7d" }
  );

  res.json({ ok: true, token, role: "ADMIN" });
});

r.get("/admin/stats", verifyAdmin, async (req, res, next) => {
  try {
    const [usersCount, submissionsCount, challengesCount, competitionsCount, activeUsers, companiesCount, jobsCount, projectsCount] = await Promise.all([
      prisma.user.count(),
      prisma.submission.count(),
      prisma.challenge.count(),
      prisma.competition.count(),
      prisma.user.count({ where: { online: true } }),
      prisma.company.count(),
      prisma.job.count({ where: { status: "ACTIVE" } }),
      prisma.project.count()
    ]);

    res.json({
      usersCount,
      submissionsCount,
      challengesCount,
      competitionsCount,
      activeUsers,
      companiesCount,
      jobsCount,
      projectsCount
    });
  } catch (err) {
    next(err);
  }
});

r.get("/admin/users", verifyAdmin, async (req, res, next) => {
  try {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        level: true,
        score: true,
        rank: true,
        province: true,
        primaryCategory: true,
        online: true,
        createdAt: true,
        passwordHash: true,
        projectsCount: true,
        attempts: {
          select: { id: true, isSuspicious: true, suspicionReason: true, passed: true }
        },
        _count: {
          select: { submissions: true, attempts: true }
        }
      }
    });

    const formattedUsers = users.map((u) => {
      const suspiciousAttempts = (u.attempts || []).filter((a) => a.isSuspicious);
      return {
        ...u,
        isSuspicious: suspiciousAttempts.length > 0,
        suspiciousCount: suspiciousAttempts.length,
        suspicionReason: suspiciousAttempts[0]?.suspicionReason || null,
      };
    });

    res.json({ users: formattedUsers });
  } catch (err) {
    next(err);
  }
});

r.delete("/admin/users/:id", verifyAdmin, async (req, res, next) => {
  try {
    const { id } = req.params;
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      return res.status(404).json({ message: "Foydalanuvchi topilmadi." });
    }

    // Safely delete all related records in transaction
    await prisma.$transaction([
      prisma.userSkill.deleteMany({ where: { userId: id } }),
      prisma.challengeAttempt.deleteMany({ where: { userId: id } }),
      prisma.evaluation.deleteMany({ where: { submission: { userId: id } } }),
      prisma.submission.deleteMany({ where: { userId: id } }),
      prisma.projectImage.deleteMany({ where: { project: { userId: id } } }),
      prisma.project.deleteMany({ where: { userId: id } }),
      prisma.message.deleteMany({ where: { userId: id } }),
      prisma.rankSnapshot.deleteMany({ where: { userId: id } }),
      prisma.userCategoryScore.deleteMany({ where: { userId: id } }),
      prisma.competitionAnswer.deleteMany({ where: { userId: id } }),
      prisma.teamMember.deleteMany({ where: { userId: id } }),
      prisma.shortlistEntry.deleteMany({ where: { userId: id } }),
      prisma.companyInvitation.deleteMany({ where: { userId: id } }),
      prisma.user.delete({ where: { id } }),
    ]);

    res.json({ ok: true, message: `"${user.name}" foydalanuvchisi butunlay o'chirildi.` });
  } catch (err) {
    next(err);
  }
});

r.post("/admin/messages", verifyAdmin, async (req, res, next) => {
  try {
    const { userId, title, body, type = "admin" } = req.body;
    if (!title || !body) {
      return res.status(400).json({ message: "Sarlavha va matn kiritilishi shart." });
    }

    if (userId === "ALL" || !userId) {
      const allUsers = await prisma.user.findMany({ select: { id: true } });
      await prisma.message.createMany({
        data: allUsers.map((u) => ({
          userId: u.id,
          title,
          body,
          type
        }))
      });
      return res.json({ ok: true, count: allUsers.length });
    }

    const msg = await prisma.message.create({
      data: {
        userId,
        title,
        body,
        type
      }
    });

    res.json({ ok: true, message: msg });
  } catch (err) {
    next(err);
  }
});

r.post("/admin/news", verifyAdmin, async (req, res, next) => {
  try {
    const { title, summary, content, sourceUrl, imageUrl, category = "IT" } = req.body;
    if (!title || (!summary && !content)) {
      return res.status(400).json({ message: "Yangilik sarlavhasi va matni kiritilishi shart." });
    }

    const news = await prisma.news.create({
      data: {
        title,
        summary: summary || (content ? content.slice(0, 150) : ""),
        content: content || summary || "",
        sourceUrl: sourceUrl || null,
        imageUrl: imageUrl || null,
        category,
        status: "PUBLISHED",
        publishedAt: new Date()
      }
    });

    res.json({ ok: true, item: news });
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/news - Barcha yangiliklar
r.get("/admin/news", verifyAdmin, async (req, res, next) => {
  try {
    const items = await prisma.news.findMany({
      orderBy: { publishedAt: "desc" }
    });
    res.json({ items });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/admin/news/:id - Yangilikni o'chirish
r.delete("/admin/news/:id", verifyAdmin, async (req, res, next) => {
  try {
    await prisma.news.delete({ where: { id: req.params.id } });
    res.json({ ok: true, message: "Yangilik o'chirildi." });
  } catch (err) {
    next(err);
  }
});

r.post("/admin/events", verifyAdmin, async (req, res, next) => {
  try {
    const { title, description, location, eventUrl, startsAt, endsAt, category = "Hackathon" } = req.body;
    if (!title || !description) {
      return res.status(400).json({ message: "Tadbir nomi va tavsifi kiritilishi shart." });
    }

    const event = await prisma.event.create({
      data: {
        title,
        description,
        location: location || "Online",
        eventUrl: eventUrl || null,
        startsAt: startsAt ? new Date(startsAt) : new Date(),
        endsAt: endsAt ? new Date(endsAt) : null,
        category,
        status: "PUBLISHED"
      }
    });

    res.json({ ok: true, item: event });
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/events - Barcha tadbirlar
r.get("/admin/events", verifyAdmin, async (req, res, next) => {
  try {
    const items = await prisma.event.findMany({
      orderBy: { startsAt: "desc" }
    });
    res.json({ items });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/admin/events/:id - Tadbirni o'chirish
r.delete("/admin/events/:id", verifyAdmin, async (req, res, next) => {
  try {
    await prisma.event.delete({ where: { id: req.params.id } });
    res.json({ ok: true, message: "Tadbir o'chirildi." });
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/suspicions - Shubhali harakatlar va chetlatilganlar ro'yxati (Musobaqalar + CodeLab)
r.get("/admin/suspicions", verifyAdmin, async (req, res, next) => {
  try {
    const [disqualifiedMembers, suspiciousAttempts] = await Promise.all([
      prisma.teamMember.findMany({
        where: { disqualified: true },
        include: {
          user: { select: { id: true, name: true, email: true, phone: true, telegram: true } },
          team: {
            include: {
              competition: { select: { id: true, title: true, status: true } }
            }
          }
        },
        orderBy: { joinedAt: "desc" }
      }),
      prisma.challengeAttempt.findMany({
        where: { isSuspicious: true },
        include: {
          user: { select: { id: true, name: true, email: true, phone: true, telegram: true } },
          challenge: { select: { id: true, title: true, category: true, difficulty: true } }
        },
        orderBy: { updatedAt: "desc" }
      })
    ]);

    const compItems = disqualifiedMembers.map(m => ({
      id: "member-" + m.id,
      userId: m.userId,
      userName: m.user?.name || "Noma'lum",
      userEmail: m.user?.email || "-",
      userPhone: m.user?.phone || m.contactPhone || "-",
      telegram: m.user?.telegram || m.telegram || "-",
      teamId: m.teamId,
      teamName: m.team?.name || "-",
      competitionId: m.team?.competition?.id,
      competitionTitle: m.team?.competition?.title || "-",
      competitionStatus: m.team?.competition?.status || "-",
      reason: m.disqualifiedReason || "Shubhali harakat (tab yoki oynani almashtirish)",
      currentQuestion: m.currentQuestion,
      date: m.joinedAt,
      type: "COMPETITION",
      rawMemberId: m.id
    }));

    const attemptItems = suspiciousAttempts.map(a => ({
      id: "attempt-" + a.id,
      userId: a.userId,
      userName: a.user?.name || "Noma'lum",
      userEmail: a.user?.email || "-",
      userPhone: a.user?.phone || "-",
      telegram: a.user?.telegram || "-",
      teamId: null,
      teamName: "AI CodeLab",
      competitionId: null,
      competitionTitle: `AI CodeLab: ${a.challenge?.title || "Topshiriq"} (${(a.challenge?.category || "").toUpperCase()})`,
      competitionStatus: "ACTIVE",
      reason: a.suspicionReason || "Oynadan chiqib ketish / Tab almashtirish",
      currentQuestion: 1,
      date: a.updatedAt,
      type: "CHALLENGE_ATTEMPT",
      rawAttemptId: a.id
    }));

    const items = [...compItems, ...attemptItems];
    res.json({ items, count: items.length });
  } catch (err) {
    next(err);
  }
});

// Clear CodeLab suspicion
r.post("/admin/suspicions/reinstate-attempt", verifyAdmin, async (req, res, next) => {
  try {
    const { attemptId } = req.body;
    if (attemptId) {
      await prisma.challengeAttempt.update({
        where: { id: attemptId },
        data: {
          isSuspicious: false,
          suspicionReason: null,
          tabSwitches: 0
        }
      });
    }
    res.json({ success: true, message: "CodeLab shubhasi bekor qilindi!" });
  } catch (err) {
    next(err);
  }
});

r.get("/admin/activity", verifyAdmin, async (req, res, next) => {
  try {
    const [recentSubmissions, recentUsers] = await Promise.all([
      prisma.submission.findMany({
        take: 20,
        orderBy: { createdAt: "desc" },
        include: {
          user: { select: { name: true, email: true } },
          challenge: { select: { title: true, category: true, difficulty: true } }
        }
      }),
      prisma.user.findMany({
        take: 10,
        orderBy: { createdAt: "desc" },
        select: { id: true, name: true, email: true, createdAt: true }
      })
    ]);

    const events = [];

    recentSubmissions.forEach((s) => {
      events.push({
        id: "sub-" + s.id,
        timestamp: s.createdAt,
        type: s.status === "COMPLETED" ? "SUBMISSION_PASS" : "SUBMISSION_FAIL",
        userName: s.user?.name || "Noma'lum",
        userEmail: s.user?.email,
        text: `${s.user?.name || 'User'} "${s.challenge?.title || 'Topshiriq'}" ni topshirdi (${s.status === 'COMPLETED' ? 'PASS +ball' : 'FAIL'}). Ball: ${s.score ?? 0}`,
        details: s.output ? s.output.slice(0, 120) : null
      });
    });

    recentUsers.forEach((u) => {
      events.push({
        id: "usr-" + u.id,
        timestamp: u.createdAt,
        type: "USER_REGISTER",
        userName: u.name,
        userEmail: u.email,
        text: `Yangi foydalanuvchi ro'yxatdan o'tdi: ${u.name} (${u.email})`,
        details: null
      });
    });

    events.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    res.json({ events: events.slice(0, 30) });
  } catch (err) {
    next(err);
  }
});

r.post("/admin/competitions", verifyAdmin, async (req, res, next) => {
  try {
    const {
      title,
      description,
      rules,
      category = "all",
      startsAt,
      endsAt,
      maxTeams = 4,
      teamNames = ["Alpha", "Bravo", "Charlie", "Delta"],
      autoAssignUsers = true
    } = req.body;

    if (!title || !description) {
      return res.status(400).json({ message: "Musobaqa nomi va tavsifi shart." });
    }

    const competition = await prisma.competition.create({
      data: {
        title,
        description,
        rules: rules || "Halol kod yozish, vaqt chegarasiga rioya qilish.",
        category,
        startsAt: startsAt ? new Date(startsAt) : new Date(),
        endsAt: endsAt ? new Date(endsAt) : new Date(Date.now() + 7 * 86400000),
        maxTeams: Number(maxTeams || 4),
        status: "ACTIVE"
      }
    });

    const createdTeams = [];
    const count = Math.min(Number(maxTeams || 4), (teamNames && teamNames.length) || 4);
    for (let i = 0; i < count; i++) {
      const name = (teamNames && teamNames[i]) || `Jamoa ${i + 1}`;
      const team = await prisma.team.create({
        data: {
          competitionId: competition.id,
          name
        }
      });
      createdTeams.push(team);
    }

    if (autoAssignUsers && createdTeams.length > 0) {
      const allUsers = await prisma.user.findMany({
        take: 30,
        orderBy: { score: "desc" },
        select: { id: true }
      });

      for (let i = 0; i < allUsers.length; i++) {
        const team = createdTeams[i % createdTeams.length];
        try {
          await prisma.teamMember.create({
            data: {
              teamId: team.id,
              userId: allUsers[i].id,
              role: i < createdTeams.length ? "LEADER" : "MEMBER"
            }
          });
        } catch {}
      }
    }

    // Auto-generate 50 questions for this competition based on category/title
    try {
      await generateCompetitionQuestions(competition.id);
    } catch (e) {
      console.error("Quiz generator error:", e);
    }

    res.status(201).json({ ok: true, competition, teams: createdTeams });
  } catch (err) {
    next(err);
  }
});

r.post("/admin/competitions/:id/generate-questions", verifyAdmin, async (req, res, next) => {
  try {
    const questions = await generateCompetitionQuestions(req.params.id);
    res.json({ ok: true, count: questions.length, message: "50 ta savol muvaffaqiyatli generatsiya qilindi!" });
  } catch (err) {
    next(err);
  }
});

r.delete("/admin/competitions/:id", verifyAdmin, async (req, res, next) => {
  try {
    await prisma.competition.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/competitions/:id/live - Musobaqani jonli kuzatish
r.get("/admin/competitions/:id/live", verifyAdmin, async (req, res, next) => {
  try {
    const comp = await prisma.competition.findUnique({
      where: { id: req.params.id },
      include: {
        teams: {
          orderBy: { score: "desc" },
          include: {
            members: {
              include: {
                user: { select: { id: true, name: true, email: true, phone: true, avatar: true, score: true } }
              }
            }
          }
        },
        questions: {
          orderBy: { orderIndex: "asc" },
          select: { id: true, orderIndex: true, difficulty: true, points: true, type: true, question: true }
        }
      }
    });

    if (!comp) return res.status(404).json({ message: "Musobaqa topilmadi." });

    // Fetch all answers submitted in this competition
    const answers = await prisma.competitionAnswer.findMany({
      where: {
        question: { competitionId: comp.id }
      },
      include: {
        user: { select: { id: true, name: true } },
        question: { select: { id: true, orderIndex: true, points: true } }
      },
      orderBy: { createdAt: "desc" },
      take: 200
    });

    res.json({
      competition: comp,
      recentAnswers: answers.map(a => ({
        id: a.id,
        userName: a.user.name,
        userId: a.userId,
        teamId: a.teamId,
        questionIndex: a.question.orderIndex,
        answer: a.answer,
        correct: a.correct,
        points: a.points,
        time: a.createdAt
      }))
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/admin/competitions/:id/reinstate - Chiqarib yuborilgan userga qayta ruxsat berish
r.post("/admin/competitions/:id/reinstate", verifyAdmin, async (req, res, next) => {
  try {
    const { userId, teamMemberId } = req.body;
    let member = null;

    if (teamMemberId) {
      member = await prisma.teamMember.update({
        where: { id: teamMemberId },
        data: { disqualified: false, disqualifiedReason: null }
      });
    } else if (userId) {
      const existing = await prisma.teamMember.findFirst({
        where: { userId, team: { competitionId: req.params.id } }
      });
      if (existing) {
        member = await prisma.teamMember.update({
          where: { id: existing.id },
          data: { disqualified: false, disqualifiedReason: null }
        });
      }
    }

    if (!member) {
      return res.status(404).json({ message: "Foydalanuvchi jamoada topilmadi." });
    }

    res.json({ ok: true, message: "Foydalanuvchiga musobaqaga qayta kirish ruxsati berildi!" });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/admin/competitions/:id/time - Musobaqa boshlanish/tugash vaqtini sozlash
r.patch("/admin/competitions/:id/time", verifyAdmin, async (req, res, next) => {
  try {
    const { startsAt, endsAt, status } = req.body;
    const data = {};
    if (startsAt) data.startsAt = new Date(startsAt);
    if (endsAt) data.endsAt = new Date(endsAt);
    if (status) data.status = String(status);

    const comp = await prisma.competition.update({
      where: { id: req.params.id },
      data
    });

    res.json({ ok: true, competition: comp, message: "Vaqt muvaffaqiyatli o'zgartirildi!" });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/admin/competitions/:id/settings - Natijalar ko'rinishini sozlash
r.patch("/admin/competitions/:id/settings", verifyAdmin, async (req, res, next) => {
  try {
    const { showResults } = req.body;
    const comp = await prisma.competition.update({
      where: { id: req.params.id },
      data: { showResults: Boolean(showResults) }
    });
    res.json({ ok: true, competition: comp, message: `Natijalar ${comp.showResults ? "ochildi" : "yopildi"}!` });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/admin/users/:id/password - Admin user parolini o'zgartirishi
r.patch("/admin/users/:id/password", verifyAdmin, async (req, res, next) => {
  try {
    const { password } = req.body;
    if (!password || String(password).trim().length < 4) {
      return res.status(400).json({ message: "Parol kamida 4 belgidan iborat bo'lishi kerak." });
    }

    const hash = await bcrypt.hash(String(password).trim(), 12);
    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: {
        plainPassword: String(password).trim(),
        passwordHash: hash
      }
    });

    res.json({ ok: true, message: `"${user.name}" ning paroli yangilandi!` });
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/competition-requests - Musobaqani tugatganda so'ralgan kontaktlarni ko'rish
r.get("/admin/competition-requests", verifyAdmin, async (req, res, next) => {
  try {
    const requests = await prisma.teamMember.findMany({
      where: {
        OR: [
          { contactPhone: { not: null } },
          { telegram: { not: null } }
        ]
      },
      include: {
        user: { select: { name: true, email: true, phone: true } },
        team: {
          include: {
            competition: { select: { title: true, status: true } }
          }
        }
      },
      orderBy: { joinedAt: "desc" }
    });

    res.json({ ok: true, requests });
  } catch (err) {
    next(err);
  }
});

// POST /api/admin/users/:id/points - Foydalanuvchiga ball qo'shish / ayirish
r.post("/admin/users/:id/points", verifyAdmin, async (req, res, next) => {
  try {
    const { points } = req.body;
    const pts = parseInt(points, 10);
    
    if (isNaN(pts) || pts === 0) {
      return res.status(400).json({ message: "Ball noto'g'ri kiritildi (0 bo'lmagan son kiriting)." });
    }

    const existingUser = await prisma.user.findUnique({
      where: { id: req.params.id },
      select: { id: true, name: true, score: true }
    });

    if (!existingUser) {
      return res.status(404).json({ message: "Foydalanuvchi topilmadi." });
    }

    if (pts < 0 && Math.abs(pts) > existingUser.score) {
      return res.status(400).json({
        message: `Foydalanuvchida jami ${existingUser.score} ball bor. Undan ko'p (${Math.abs(pts)}) ball ayirib bo'lmaydi!`
      });
    }

    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: { score: { increment: pts } },
      select: { id: true, name: true, score: true }
    });

    res.json({
      ok: true,
      user,
      message: `"${user.name}" ga ${pts > 0 ? `+${pts}` : pts} ball ${pts > 0 ? "qo'shildi" : "ayirildi"}. Yangi ball: ${user.score}`
    });
  } catch (err) {
    next(err);
  }
});

// ─── COMPANY MANAGEMENT ───

// GET /api/admin/companies — Barcha kompaniyalar ro'yxati
r.get("/admin/companies", verifyAdmin, async (req, res, next) => {
  try {
    const companies = await prisma.company.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        companyName: true,
        legalName: true,
        email: true,
        phone: true,
        website: true,
        industry: true,
        companySize: true,
        city: true,
        country: true,
        logo: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: { members: true, jobs: true, shortlists: true, invitations: true }
        }
      }
    });
    res.json({ companies });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/admin/companies/:id/status — Kompaniya statusini o'zgartirish
r.patch("/admin/companies/:id/status", verifyAdmin, async (req, res, next) => {
  try {
    const { status } = req.body;
    const allowed = ["PENDING", "VERIFIED", "REJECTED", "SUSPENDED"];
    if (!status || !allowed.includes(status)) {
      return res.status(400).json({
        message: `Status noto'g'ri. Ruxsat etilganlar: ${allowed.join(", ")}`
      });
    }

    const company = await prisma.company.findUnique({ where: { id: req.params.id } });
    if (!company) {
      return res.status(404).json({ message: "Kompaniya topilmadi." });
    }

    const updated = await prisma.company.update({
      where: { id: req.params.id },
      data: { status },
      select: { id: true, companyName: true, email: true, status: true }
    });

    res.json({
      ok: true,
      company: updated,
      message: `"${updated.companyName}" kompaniyasi statusi "${status}" ga o'zgartirildi.`
    });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/admin/companies/:id — Kompaniyani o'chirish (faqat superadmin)
r.delete("/admin/companies/:id", verifyAdmin, async (req, res, next) => {
  try {
    const company = await prisma.company.findUnique({ where: { id: req.params.id } });
    if (!company) {
      return res.status(404).json({ message: "Kompaniya topilmadi." });
    }

    await prisma.company.delete({ where: { id: req.params.id } });
    res.json({ ok: true, message: `"${company.companyName}" kompaniyasi o'chirildi.` });
  } catch (err) {
    next(err);
  }
});

export default r;
