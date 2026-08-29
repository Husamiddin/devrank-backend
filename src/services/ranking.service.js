import { prisma } from "../lib/prisma.js";

export function levelFromScore(score) {
  return Math.max(1, Math.floor(Number(score || 0) / 100) + 1);
}

export async function recalculateAllTimeRanks() {
  const users = await prisma.user.findMany({
    select: { id: true, score: true, createdAt: true },
    orderBy: [{ score: "desc" }, { createdAt: "asc" }]
  });
  const total = users.length || 1;
  for (let i = 0; i < users.length; i++) {
    const u = users[i];
    await prisma.user.update({
      where: { id: u.id },
      data: {
        rank: i + 1,
        level: levelFromScore(u.score),
        topPercent: Number((((i + 1) / total) * 100).toFixed(2))
      }
    });
  }
  return users.length;
}

async function periodRows(period, category, province) {
  const normalized = String(period || "all").toLowerCase();
  if (normalized === "all") {
    return prisma.user.findMany({
      where: {
        ...(province ? { province } : {}),
        ...(category && category !== "all" ? { primaryCategory: category } : {})
      },
      include: { skills: { include: { skill: true } } },
      orderBy: [{ score: "desc" }, { createdAt: "asc" }],
      take: 100
    });
  }

  const from = normalized === "week"
    ? new Date(Date.now() - 7 * 86400000)
    : new Date(Date.now() - 31 * 86400000);

  const where = {
    createdAt: { gte: from },
    passed: true,
    user: {
      ...(province ? { province } : {}),
      ...(category && category !== "all" ? { primaryCategory: category } : {})
    }
  };

  const attempts = await prisma.challengeAttempt.findMany({
    where,
    include: { user: { include: { skills: { include: { skill: true } } } } }
  });

  const map = new Map();
  for (const attempt of attempts) {
    const current = map.get(attempt.userId) || { user: attempt.user, score: 0 };
    current.score += attempt.score;
    map.set(attempt.userId, current);
  }
  return [...map.values()]
    .sort((a, b) => b.score - a.score || String(a.user.createdAt).localeCompare(String(b.user.createdAt)))
    .slice(0, 100);
}

export async function getLeaderboard({ period = "all", category = "all", province = null }) {
  const rows = await periodRows(period, category, province);
  return rows.map((row, index) => {
    const user = row.user || row;
    const score = row.score ?? user.score;
    return {
      id: user.id,
      name: user.name,
      username: user.username,
      province: user.province,
      score,
      rank: index + 1,
      level: levelFromScore(user.score),
      growth: user.growth,
      avatar: user.avatar,
      online: user.online,
      skills: (user.skills || []).map((x) => x.skill?.name || x.name).filter(Boolean),
      category: user.primaryCategory
    };
  });
}
