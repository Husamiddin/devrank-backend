import { Router } from "express";
import { prisma } from "../lib/prisma.js";

const r = Router();

// Parolni tekshiruvchi yordamchi funksiya
const checkPassword = (req, res) => {
  const password = req.headers["x-admin-password"] || req.body.password;
  const adminPass = process.env.LOCAL_ADMIN_PASSWORD || "admin123"; // O'zingiz xohlagan parol
  return password === adminPass;
};

// 1. Parolni tekshirish va statistikani olish
r.post("/local-admin/login", async (req, res) => {
  if (!checkPassword(req, res)) {
    return res.status(401).json({ success: false, message: "Parol noto'g'ri!" });
  }

  try {
    const usersCount = await prisma.user.count();
    const challengesCount = await prisma.challenge.count();
    const submissionsCount = await prisma.submission.count();
    const pendingRequests = await prisma.challengeAttempt.findMany({
      where: { status: "PENDING" },
      include: {
        user: { select: { id: true, name: true, email: true } },
        challenge: { select: { id: true, title: true, category: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    const topUsers = await prisma.user.findMany({
      select: { id: true, name: true, email: true, score: true, level: true, rank: true },
      orderBy: { score: 'desc' },
      take: 10
    });

    res.json({
      success: true,
      stats: { usersCount, challengesCount, submissionsCount },
      pendingRequests,
      topUsers
    });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// 2. So'rovni tasdiqlash yoki rad etish
r.post("/local-admin/action", async (req, res) => {
  if (!checkPassword(req, res)) {
    return res.status(401).json({ success: false, message: "Ruxsat yo'q!" });
  }

  try {
    const { attemptId, action } = req.body; // action: "APPROVE" yoki "REJECT"
    const newStatus = action === "APPROVE" ? "ACTIVE" : "LOCKED";

    const updated = await prisma.challengeAttempt.update({
      where: { id: attemptId },
      data: {
        status: newStatus,
        attempts: action === "APPROVE" ? 0 : 2,
        passed: action === "APPROVE" ? false : undefined
      }
    });

    res.json({ success: true, message: "Muvaffaqiyatli bajarildi!", updated });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

export default r;