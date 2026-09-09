import { Router } from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import {
  computeCategoryScoresForUser,
  getDeterministicTopTalents,
  VALID_CATEGORIES,
} from "../services/categoryScore.service.js";
import { getCandidatesForJob, calculateJobMatch } from "../services/jobMatching.service.js";

const r = Router();
const COMPANY_PASS = process.env.COMPANY_PASSWORD || "company2026";
const JWT_SECRET = process.env.JWT_SECRET || "AslKod-local-secret";

export function formatPhone(raw) {
  if (!raw || typeof raw !== "string") return null;
  const digits = raw.replace(/\D/g, "");
  if (digits.startsWith("998") && digits.length === 12) {
    return `+998 (${digits.slice(3, 5)}) ${digits.slice(5, 8)}-${digits.slice(8, 10)}-${digits.slice(10, 12)}`;
  }
  if (digits.length === 9) {
    return `+998 (${digits.slice(0, 2)}) ${digits.slice(2, 5)}-${digits.slice(5, 7)}-${digits.slice(7, 9)}`;
  }
  return raw;
}

// ----------------- AUTH MIDDLEWARE -----------------
export async function authenticateCompany(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  const key = req.headers["x-company-key"] || req.query.companyKey;

  // Master key bypass for enterprise/admin pairing
  if (key === COMPANY_PASS || key === "0427") {
    let comp = await prisma.company.findFirst();
    if (!comp) {
      const hash = await bcrypt.hash("company2026", 10);
      comp = await prisma.company.create({
        data: {
          companyName: "AslKod Enterprise Partner",
          email: "partner@AslKod.uz",
          passwordHash: hash,
          industry: "IT / FinTech",
          city: "Toshkent",
          status: "VERIFIED",
        },
      });
    }
    req.company = { id: comp.id, role: "OWNER", name: comp.companyName, email: comp.email };
    return next();
  }

  if (!token) {
    return res.status(401).json({ success: false, message: "Kompaniya avtorizatsiyasi talab qilinadi." });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    if (payload.role === "COMPANY" || payload.role === "ADMIN" || payload.companyId) {
      const companyId = payload.companyId || payload.sub;
      let comp = await prisma.company.findUnique({ where: { id: companyId } });
      if (!comp) {
        comp = await prisma.company.findFirst();
      }
      req.company = {
        id: comp?.id || companyId,
        role: payload.companyRole || "RECRUITER",
        name: comp?.companyName || payload.name || "Kompaniya",
        email: comp?.email || payload.email,
      };
      return next();
    }
    return res.status(403).json({ success: false, message: "Kompaniya ruxsati mavjud emas." });
  } catch (err) {
    return res.status(401).json({ success: false, message: "Sessiya eskirgan yoki yaroqsiz." });
  }
}

// ----------------- AUTH ENDPOINTS -----------------
r.post("/company/auth/register", async (req, res, next) => {
  try {
    const { companyName, email, password, phone, website, industry, city, description } = req.body;
    if (!companyName || !email || !password) {
      return res.status(400).json({ success: false, message: "Kompaniya nomi, email va parol kiritilishi shart." });
    }

    const existing = await prisma.company.findUnique({ where: { email: email.toLowerCase() } });
    if (existing) {
      return res.status(409).json({ success: false, message: "Bu email bilan ro'yxatdan o'tilgan." });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const company = await prisma.company.create({
      data: {
        companyName: companyName.trim(),
        email: email.toLowerCase().trim(),
        phone: phone || null,
        website: website || null,
        industry: industry || "IT / Software",
        city: city || "Toshkent",
        description: description || null,
        status: "VERIFIED", // Auto-verify verified partner accounts
        passwordHash,
      },
    });

    // Create default OWNER member
    await prisma.companyMember.create({
      data: {
        companyId: company.id,
        name: company.companyName,
        email: company.email,
        role: "OWNER",
        status: "ACTIVE",
      },
    });

    const token = jwt.sign(
      {
        companyId: company.id,
        role: "COMPANY",
        companyRole: "OWNER",
        name: company.companyName,
        email: company.email,
      },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.status(201).json({
      success: true,
      token,
      company: {
        id: company.id,
        name: company.companyName,
        email: company.email,
        industry: company.industry,
        city: company.city,
        status: company.status,
        role: "OWNER",
      },
    });
  } catch (err) {
    next(err);
  }
});

r.post("/company/auth/login", async (req, res, next) => {
  try {
    const { email, password, companyName } = req.body;
    const inputPass = String(password || "").trim();

    // Direct password match for company2026 or 0427 master keys
    if (inputPass === COMPANY_PASS || inputPass === "0427") {
      let company = await prisma.company.findFirst();
      if (!company) {
        const hash = await bcrypt.hash("company2026", 10);
        company = await prisma.company.create({
          data: {
            companyName: companyName || "AslKod Enterprise Partner",
            email: email || "partner@AslKod.uz",
            passwordHash: hash,
            status: "VERIFIED",
          },
        });
      }

      const token = jwt.sign(
        {
          companyId: company.id,
          role: "COMPANY",
          companyRole: "OWNER",
          name: company.companyName,
          email: company.email,
        },
        JWT_SECRET,
        { expiresIn: "7d" }
      );

      return res.json({
        success: true,
        token,
        company: {
          id: company.id,
          name: company.companyName,
          email: company.email,
          industry: company.industry,
          status: company.status,
          role: "OWNER",
        },
      });
    }

    if (!email) {
      return res.status(400).json({ success: false, message: "Email yoki maxfiy kalit kiritilishi shart." });
    }

    const company = await prisma.company.findUnique({ where: { email: email.toLowerCase() } });
    if (!company) {
      return res.status(401).json({ success: false, message: "Email yoki parol noto'g'ri." });
    }

    const match = await bcrypt.compare(inputPass, company.passwordHash);
    if (!match) {
      return res.status(401).json({ success: false, message: "Email yoki parol noto'g'ri." });
    }

    const token = jwt.sign(
      {
        companyId: company.id,
        role: "COMPANY",
        companyRole: "OWNER",
        name: company.companyName,
        email: company.email,
      },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      success: true,
      token,
      company: {
        id: company.id,
        name: company.companyName,
        email: company.email,
        industry: company.industry,
        city: company.city,
        status: company.status,
        role: "OWNER",
      },
    });
  } catch (err) {
    next(err);
  }
});

r.get("/company/auth/me", authenticateCompany, async (req, res, next) => {
  try {
    const company = await prisma.company.findUnique({
      where: { id: req.company.id },
      include: {
        _count: {
          select: { jobs: true, shortlists: true, invitations: true, members: true },
        },
      },
    });

    if (!company) {
      return res.status(404).json({ success: false, message: "Kompaniya ma'lumotlari topilmadi." });
    }

    res.json({
      success: true,
      company: {
        id: company.id,
        name: company.companyName,
        legalName: company.legalName,
        email: company.email,
        phone: company.phone,
        website: company.website,
        industry: company.industry,
        companySize: company.companySize,
        city: company.city,
        country: company.country,
        description: company.description,
        status: company.status,
        role: req.company.role,
        counts: company._count,
      },
    });
  } catch (err) {
    next(err);
  }
});

// ----------------- OVERVIEW & ANALYTICS -----------------
r.get("/company/overview", authenticateCompany, async (req, res, next) => {
  try {
    const companyId = req.company.id;

    const [
      totalUsers,
      onlineUsers,
      activeJobs,
      shortlistedCount,
      invitationsCount,
      hiredCount,
      interviewCount,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { online: true } }),
      prisma.job.count({ where: { companyId, status: "ACTIVE" } }),
      prisma.shortlistEntry.count({ where: { companyId } }),
      prisma.companyInvitation.count({ where: { companyId } }),
      prisma.shortlistEntry.count({ where: { companyId, status: "HIRED" } }),
      prisma.shortlistEntry.count({ where: { companyId, status: "INTERVIEW" } }),
    ]);

    const topTalents = await getDeterministicTopTalents();

    res.json({
      success: true,
      metrics: {
        totalTalent: totalUsers,
        onlineTalent: onlineUsers,
        activeJobs,
        shortlisted: shortlistedCount,
        invitations: invitationsCount,
        interviews: interviewCount,
        hired: hiredCount,
      },
      topTalents,
    });
  } catch (err) {
    next(err);
  }
});

// ----------------- TALENT DISCOVERY -----------------
r.get("/company/talent", authenticateCompany, async (req, res, next) => {
  try {
    const companyId = req.company.id;
    const {
      search,
      category,
      minScore,
      minCategoryPoints,
      minLevel,
      province,
      onlyOnline,
      sortBy = "score",
      page = 1,
      limit = 20,
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
      const cat = String(category).toLowerCase();
      where.primaryCategory = cat;
    }

    if (onlyOnline === "true") {
      where.online = true;
    }

    if (minScore) {
      where.score = { gte: Number(minScore) };
    }

    if (minLevel) {
      where.level = { gte: Number(minLevel) };
    }

    if (province && province !== "ALL") {
      where.province = String(province);
    }

    let orderBy = [{ score: "desc" }, { createdAt: "asc" }];
    if (sortBy === "rank") orderBy = [{ rank: "asc" }, { score: "desc" }];
    if (sortBy === "level") orderBy = [{ level: "desc" }, { score: "desc" }];
    if (sortBy === "recent") orderBy = [{ createdAt: "desc" }];

    const take = Math.min(100, Math.max(1, Number(limit)));
    const skip = (Math.max(1, Number(page)) - 1) * take;

    const [total, users] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        orderBy,
        skip,
        take,
        include: {
          skills: { include: { skill: true }, take: 6 },
          projects: { take: 3 },
          attempts: { select: { id: true, passed: true, score: true } },
          categoryScores: true,
          shortlists: { where: { companyId } },
        },
      }),
    ]);

    // Format candidate list
    const candidates = await Promise.all(
      users.map(async (u) => {
        // Map category points
        const catPoints = { web: 0, ai: 0, cyber: 0, ux: 0 };
        u.categoryScores.forEach((cs) => {
          if (catPoints[cs.category] !== undefined) {
            catPoints[cs.category] = cs.points;
          }
        });

        // Ensure category baseline from global score if not yet initialized
        if (Object.values(catPoints).every((v) => v === 0) && u.score > 0) {
          const comp = await computeCategoryScoresForUser(u.id);
          if (comp) {
            Object.keys(comp).forEach((k) => {
              catPoints[k] = comp[k].points;
            });
          }
        }

        const totalAttempts = u.attempts.length;
        const passedAttempts = u.attempts.filter((a) => a.passed).length;
        const accuracy = totalAttempts > 0 ? Math.round((passedAttempts / totalAttempts) * 100) : null;

        return {
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
          phone: formatPhone(u.phone),
          telegram: u.telegram,
          primaryCategory: u.primaryCategory,
          categoryPoints: catPoints,
          skills: u.skills.map((s) => s.skill?.name).filter(Boolean),
          projectsCount: u.projects.length,
          accuracy,
          shortlistStatus: u.shortlists?.[0]?.status || null,
          shortlistId: u.shortlists?.[0]?.id || null,
        };
      })
    );

    res.json({
      success: true,
      total,
      page: Number(page),
      limit: take,
      candidates,
    });
  } catch (err) {
    next(err);
  }
});

// ----------------- TOP TALENTS PER CATEGORY -----------------
r.get("/company/talent/top", authenticateCompany, async (req, res, next) => {
  try {
    const topTalents = await getDeterministicTopTalents();
    res.json({
      success: true,
      topTalents,
    });
  } catch (err) {
    next(err);
  }
});

// ----------------- SINGLE CANDIDATE DOSSIER -----------------
r.get("/company/talent/:id", authenticateCompany, async (req, res, next) => {
  try {
    const companyId = req.company.id;
    const { id } = req.params;

    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        skills: { include: { skill: true } },
        projects: {
          include: { images: true },
          orderBy: { createdAt: "desc" },
        },
        attempts: {
          include: {
            challenge: {
              select: { id: true, title: true, category: true, points: true, difficulty: true },
            },
          },
          orderBy: { createdAt: "desc" },
          take: 20,
        },
        categoryScores: true,
        shortlists: { where: { companyId } },
        invitations: { where: { companyId } },
      },
    });

    if (!user) {
      return res.status(404).json({ success: false, message: "Nomzod topilmadi." });
    }

    // Ensure category scores exist
    let catScores = user.categoryScores;
    if (catScores.length === 0) {
      await computeCategoryScoresForUser(user.id);
      catScores = await prisma.userCategoryScore.findMany({ where: { userId: user.id } });
    }

    const catPoints = { web: 0, ai: 0, cyber: 0, ux: 0 };
    const catDetails = {};
    for (const cat of VALID_CATEGORIES) {
      const record = catScores.find((cs) => cs.category === cat);
      catPoints[cat] = record ? record.points : 0;
      catDetails[cat] = {
        points: record ? record.points : 0,
        completed: record ? record.completedChallenges : 0,
        passed: record ? record.passedChallenges : 0,
        successRate:
          record && record.completedChallenges > 0
            ? Math.round((record.passedChallenges / record.completedChallenges) * 100)
            : 0,
      };
    }

    const totalAttempts = user.attempts.length;
    const passedAttempts = user.attempts.filter((a) => a.passed).length;
    const accuracy = totalAttempts > 0 ? Math.round((passedAttempts / totalAttempts) * 100) : null;

    res.json({
      success: true,
      candidate: {
        id: user.id,
        name: user.name,
        username: user.username,
        email: user.email,
        phone: formatPhone(user.phone),
        telegram: user.telegram,
        bio: user.bio,
        role: user.role,
        province: user.province,
        level: user.level,
        score: user.score,
        rank: user.rank,
        online: user.online,
        avatar: user.avatar,
        primaryCategory: user.primaryCategory,
        categoryPoints: catPoints,
        categoryDetails: catDetails,
        accuracy,
        skills: user.skills.map((s) => s.skill?.name).filter(Boolean),
        projects: user.projects.map((p) => ({
          id: p.id,
          title: p.title,
          description: p.description,
          technologies: p.technologies || p.tech,
          githubUrl: p.githubUrl,
          liveUrl: p.liveUrl,
          stars: p.stars,
        })),
        challenges: user.attempts.map((a) => ({
          id: a.id,
          title: a.challenge?.title || "Topshiriq",
          category: a.challenge?.category || "web",
          difficulty: a.challenge?.difficulty || "medium",
          passed: a.passed,
          score: a.score,
          createdAt: a.createdAt,
        })),
        shortlist: user.shortlists?.[0] || null,
        invitations: user.invitations || [],
      },
    });
  } catch (err) {
    next(err);
  }
});

// ----------------- CANDIDATE COMPARISON -----------------
r.post("/company/talent/compare", authenticateCompany, async (req, res, next) => {
  try {
    const { candidateIds } = req.body;
    if (!Array.isArray(candidateIds) || candidateIds.length < 2) {
      return res.status(400).json({ success: false, message: "Kamida 2 ta nomzod tanlanishi kerak." });
    }

    const users = await prisma.user.findMany({
      where: { id: { in: candidateIds.slice(0, 4) } },
      include: {
        skills: { include: { skill: true } },
        projects: true,
        categoryScores: true,
        attempts: { select: { id: true, passed: true } },
      },
    });

    const comparison = users.map((u) => {
      const catPoints = { web: 0, ai: 0, cyber: 0, ux: 0 };
      u.categoryScores.forEach((cs) => {
        if (catPoints[cs.category] !== undefined) catPoints[cs.category] = cs.points;
      });

      const totalAttempts = u.attempts.length;
      const passed = u.attempts.filter((a) => a.passed).length;
      const accuracy = totalAttempts > 0 ? Math.round((passed / totalAttempts) * 100) : null;

      return {
        id: u.id,
        name: u.name,
        role: u.role,
        province: u.province,
        level: u.level,
        globalScore: u.score,
        globalRank: u.rank,
        categoryPoints: catPoints,
        skills: u.skills.map((s) => s.skill?.name).filter(Boolean),
        projectsCount: u.projects.length,
        accuracy,
      };
    });

    res.json({ success: true, comparison });
  } catch (err) {
    next(err);
  }
});

// ----------------- JOBS MANAGEMENT -----------------
r.get("/company/jobs", authenticateCompany, async (req, res, next) => {
  try {
    const companyId = req.company.id;
    const jobs = await prisma.job.findMany({
      where: { companyId },
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: { shortlists: true, invitations: true },
        },
      },
    });

    res.json({ success: true, jobs });
  } catch (err) {
    next(err);
  }
});

r.post("/company/jobs", authenticateCompany, async (req, res, next) => {
  try {
    const companyId = req.company.id;
    const {
      title,
      description,
      category = "web",
      requiredSkills = [],
      preferredSkills = [],
      minLevel = 1,
      minCategoryPoints = 0,
      minGlobalScore = 0,
      province = "Toshkent shahri",
      locationType = "REMOTE",
      employmentType = "FULL_TIME",
      salaryRange,
      deadline,
    } = req.body;

    if (!title || !description) {
      return res.status(400).json({ success: false, message: "Vakansiya sarlavhasi va tavsifi kiritilishi shart." });
    }

    const job = await prisma.job.create({
      data: {
        companyId,
        title: title.trim(),
        description: description.trim(),
        category: String(category).toLowerCase(),
        requiredSkills: Array.isArray(requiredSkills) ? requiredSkills : [],
        preferredSkills: Array.isArray(preferredSkills) ? preferredSkills : [],
        minLevel: Number(minLevel) || 1,
        minCategoryPoints: Number(minCategoryPoints) || 0,
        minGlobalScore: Number(minGlobalScore) || 0,
        province,
        locationType,
        employmentType,
        salaryRange: salaryRange || null,
        deadline: deadline ? new Date(deadline) : null,
        status: "ACTIVE",
      },
    });

    res.status(201).json({ success: true, job });
  } catch (err) {
    next(err);
  }
});

r.get("/company/jobs/:id", authenticateCompany, async (req, res, next) => {
  try {
    const companyId = req.company.id;
    const { id } = req.params;

    const job = await prisma.job.findFirst({
      where: { id, companyId },
      include: {
        shortlists: {
          include: {
            user: {
              select: { id: true, name: true, role: true, level: true, score: true, province: true },
            },
          },
        },
      },
    });

    if (!job) {
      return res.status(404).json({ success: false, message: "Vakansiya topilmadi." });
    }

    res.json({ success: true, job });
  } catch (err) {
    next(err);
  }
});

r.patch("/company/jobs/:id", authenticateCompany, async (req, res, next) => {
  try {
    const companyId = req.company.id;
    const { id } = req.params;

    const job = await prisma.job.findFirst({ where: { id, companyId } });
    if (!job) return res.status(404).json({ success: false, message: "Vakansiya topilmadi." });

    const updated = await prisma.job.update({
      where: { id },
      data: {
        ...req.body,
        updatedAt: new Date(),
      },
    });

    res.json({ success: true, job: updated });
  } catch (err) {
    next(err);
  }
});

r.delete("/company/jobs/:id", authenticateCompany, async (req, res, next) => {
  try {
    const companyId = req.company.id;
    const { id } = req.params;

    const job = await prisma.job.findFirst({ where: { id, companyId } });
    if (!job) return res.status(404).json({ success: false, message: "Vakansiya topilmadi." });

    await prisma.job.delete({ where: { id } });
    res.json({ success: true, message: "Vakansiya o'chirildi." });
  } catch (err) {
    next(err);
  }
});

r.get("/company/jobs/:id/candidates", authenticateCompany, async (req, res, next) => {
  try {
    const companyId = req.company.id;
    const { id } = req.params;

    const matchedCandidates = await getCandidatesForJob(id, companyId);
    if (!matchedCandidates) {
      return res.status(404).json({ success: false, message: "Vakansiya topilmadi." });
    }

    res.json({ success: true, candidates: matchedCandidates });
  } catch (err) {
    next(err);
  }
});

// ----------------- SHORTLIST KANBAN PIPELINE -----------------
r.get("/company/shortlist", authenticateCompany, async (req, res, next) => {
  try {
    const companyId = req.company.id;
    const entries = await prisma.shortlistEntry.findMany({
      where: { companyId },
      orderBy: { updatedAt: "desc" },
      include: {
        job: { select: { id: true, title: true, category: true } },
        user: {
          include: {
            skills: { include: { skill: true }, take: 4 },
            categoryScores: true,
          },
        },
      },
    });

    const formatted = entries.map((entry) => {
      const u = entry.user;
      const catPoints = { web: 0, ai: 0, cyber: 0, ux: 0 };
      u.categoryScores.forEach((cs) => {
        if (catPoints[cs.category] !== undefined) catPoints[cs.category] = cs.points;
      });

      return {
        id: entry.id,
        status: entry.status,
        notes: entry.notes,
        createdAt: entry.createdAt,
        updatedAt: entry.updatedAt,
        job: entry.job,
        candidate: {
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
          phone: formatPhone(u.phone),
          telegram: u.telegram,
          primaryCategory: u.primaryCategory,
          categoryPoints: catPoints,
          skills: u.skills.map((s) => s.skill?.name).filter(Boolean),
        },
      };
    });

    res.json({ success: true, shortlist: formatted });
  } catch (err) {
    next(err);
  }
});

r.post("/company/shortlist", authenticateCompany, async (req, res, next) => {
  try {
    const companyId = req.company.id;
    const { userId, jobId, status = "SAVED", notes } = req.body;

    if (!userId) {
      return res.status(400).json({ success: false, message: "userId kiritilishi shart." });
    }

    const existing = await prisma.shortlistEntry.findFirst({
      where: { companyId, userId, jobId: jobId || null },
    });

    if (existing) {
      const updated = await prisma.shortlistEntry.update({
        where: { id: existing.id },
        data: { status, notes: notes !== undefined ? notes : existing.notes },
      });
      return res.json({ success: true, entry: updated });
    }

    const entry = await prisma.shortlistEntry.create({
      data: {
        companyId,
        userId,
        jobId: jobId || null,
        status,
        notes: notes || null,
      },
    });

    res.status(201).json({ success: true, entry });
  } catch (err) {
    next(err);
  }
});

r.patch("/company/shortlist/:id", authenticateCompany, async (req, res, next) => {
  try {
    const companyId = req.company.id;
    const { id } = req.params;
    const { status, notes } = req.body;

    const entry = await prisma.shortlistEntry.findFirst({ where: { id, companyId } });
    if (!entry) return res.status(404).json({ success: false, message: "Shortlist yozuvi topilmadi." });

    const updated = await prisma.shortlistEntry.update({
      where: { id },
      data: {
        ...(status ? { status } : {}),
        ...(notes !== undefined ? { notes } : {}),
      },
    });

    res.json({ success: true, entry: updated });
  } catch (err) {
    next(err);
  }
});

r.delete("/company/shortlist/:id", authenticateCompany, async (req, res, next) => {
  try {
    const companyId = req.company.id;
    const { id } = req.params;

    const entry = await prisma.shortlistEntry.findFirst({ where: { id, companyId } });
    if (!entry) return res.status(404).json({ success: false, message: "Shortlist yozuvi topilmadi." });

    await prisma.shortlistEntry.delete({ where: { id } });
    res.json({ success: true, message: "Nomzod shortlistdan o'chirildi." });
  } catch (err) {
    next(err);
  }
});

// ----------------- INVITATIONS -----------------
r.get("/company/invitations", authenticateCompany, async (req, res, next) => {
  try {
    const companyId = req.company.id;
    const invitations = await prisma.companyInvitation.findMany({
      where: { companyId },
      orderBy: { createdAt: "desc" },
      include: {
        job: { select: { id: true, title: true, category: true } },
        user: {
          select: {
            id: true,
            name: true,
            role: true,
            email: true,
            phone: true,
            telegram: true,
            province: true,
            level: true,
            score: true,
          },
        },
      },
    });

    res.json({ success: true, invitations });
  } catch (err) {
    next(err);
  }
});

r.post("/company/invitations", authenticateCompany, async (req, res, next) => {
  try {
    const companyId = req.company.id;
    const { userId, jobId, message } = req.body;

    if (!userId || !message) {
      return res.status(400).json({ success: false, message: "userId va taklif matni kiritilishi shart." });
    }

    const company = await prisma.company.findUnique({ where: { id: companyId } });

    const invitation = await prisma.companyInvitation.create({
      data: {
        companyId,
        userId,
        jobId: jobId || null,
        message: message.trim(),
        status: "PENDING",
      },
    });

    // Also send an in-platform notification to the developer
    await prisma.message.create({
      data: {
        userId,
        type: "company_invitation",
        title: `? ${company?.companyName || "Hamkor Kompaniya"} sizga taklif yubordi`,
        body: message.trim(),
      },
    });

    // Auto-update or create shortlist entry as 'CONTACTED'
    const existingShortlist = await prisma.shortlistEntry.findFirst({
      where: { companyId, userId },
    });
    if (existingShortlist) {
      await prisma.shortlistEntry.update({
        where: { id: existingShortlist.id },
        data: { status: "CONTACTED" },
      });
    } else {
      await prisma.shortlistEntry.create({
        data: {
          companyId,
          userId,
          jobId: jobId || null,
          status: "CONTACTED",
        },
      });
    }

    res.status(201).json({ success: true, invitation });
  } catch (err) {
    next(err);
  }
});

// ----------------- COMPANY PROFILE & TEAM -----------------
r.patch("/company/profile", authenticateCompany, async (req, res, next) => {
  try {
    const companyId = req.company.id;
    const { companyName, legalName, phone, website, industry, companySize, city, description } = req.body;

    const updated = await prisma.company.update({
      where: { id: companyId },
      data: {
        ...(companyName ? { companyName } : {}),
        ...(legalName !== undefined ? { legalName } : {}),
        ...(phone !== undefined ? { phone } : {}),
        ...(website !== undefined ? { website } : {}),
        ...(industry !== undefined ? { industry } : {}),
        ...(companySize !== undefined ? { companySize } : {}),
        ...(city !== undefined ? { city } : {}),
        ...(description !== undefined ? { description } : {}),
      },
    });

    res.json({ success: true, company: updated });
  } catch (err) {
    next(err);
  }
});

r.get("/company/team", authenticateCompany, async (req, res, next) => {
  try {
    const companyId = req.company.id;
    const members = await prisma.companyMember.findMany({
      where: { companyId },
      orderBy: { createdAt: "asc" },
    });

    res.json({ success: true, members });
  } catch (err) {
    next(err);
  }
});

r.post("/company/team", authenticateCompany, async (req, res, next) => {
  try {
    const companyId = req.company.id;
    const { name, email, role = "RECRUITER" } = req.body;

    if (!name || !email) {
      return res.status(400).json({ success: false, message: "Ism va email kiritilishi shart." });
    }

    const member = await prisma.companyMember.create({
      data: {
        companyId,
        name: name.trim(),
        email: email.toLowerCase().trim(),
        role,
        status: "ACTIVE",
      },
    });

    res.status(201).json({ success: true, member });
  } catch (err) {
    next(err);
  }
});

r.delete("/company/team/:id", authenticateCompany, async (req, res, next) => {
  try {
    const companyId = req.company.id;
    const { id } = req.params;

    const member = await prisma.companyMember.findFirst({ where: { id, companyId } });
    if (!member) return res.status(404).json({ success: false, message: "A'zo topilmadi." });

    if (member.role === "OWNER") {
      return res.status(403).json({ success: false, message: "Kompaniya egasini o'chirib bo'lmaydi." });
    }

    await prisma.companyMember.delete({ where: { id } });
    res.json({ success: true, message: "A'zo o'chirildi." });
  } catch (err) {
    next(err);
  }
});

export default r;

