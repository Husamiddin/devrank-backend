import { Router } from "express";
import jwt from "jsonwebtoken";
import { prisma } from "../lib/prisma.js";

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
    const payload = jwt.verify(token, process.env.JWT_SECRET || "devrank-local-secret");
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
    process.env.JWT_SECRET || "devrank-local-secret",
    { expiresIn: "7d" }
  );

  res.json({ ok: true, token, role: "ADMIN" });
});

r.get("/admin/stats", verifyAdmin, async (req, res, next) => {
  try {
    const [usersCount, submissionsCount, challengesCount, competitionsCount, activeUsers] = await Promise.all([
      prisma.user.count(),
      prisma.submission.count(),
      prisma.challenge.count(),
      prisma.competition.count(),
      prisma.user.count({ where: { online: true } })
    ]);

    res.json({
      usersCount,
      submissionsCount,
      challengesCount,
      competitionsCount,
      activeUsers
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
        _count: {
          select: { submissions: true, attempts: true }
        }
      }
    });
    res.json({ users });
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

    res.status(201).json({ ok: true, competition, teams: createdTeams });
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

export default r;
