import { Router } from "express";
import { auth } from "../middleware/auth.js";
import { prisma } from "../lib/prisma.js";

const r = Router();

// GET /api/competitions - Barcha faol va bo'lajak musobaqalar
r.get("/competitions", async (req, res, next) => {
  try {
    const items = await prisma.competition.findMany({
      orderBy: { startsAt: "desc" },
      include: {
        teams: {
          include: {
            members: {
              include: {
                user: {
                  select: { id: true, name: true, avatar: true, score: true, level: true, primaryCategory: true }
                }
              }
            }
          }
        },
        _count: {
          select: { teams: true, rounds: true }
        }
      }
    });

    res.json({ items });
  } catch (e) {
    next(e);
  }
});

// GET /api/competitions/:id
r.get("/competitions/:id", async (req, res, next) => {
  try {
    const item = await prisma.competition.findUnique({
      where: { id: req.params.id },
      include: {
        teams: {
          orderBy: { score: "desc" },
          include: {
            members: {
              include: {
                user: {
                  select: { id: true, name: true, avatar: true, score: true, level: true, primaryCategory: true, province: true }
                }
              }
            }
          }
        },
        rounds: true
      }
    });

    if (!item) return res.status(404).json({ message: "Musobaqa topilmadi." });
    res.json({ item });
  } catch (e) {
    next(e);
  }
});

// POST /api/competitions/:id/join - Jamoaga qo'shilish
r.post("/competitions/:id/join", auth, async (req, res, next) => {
  try {
    const { teamId } = req.body;
    const comp = await prisma.competition.findUnique({
      where: { id: req.params.id },
      include: { teams: true }
    });

    if (!comp) return res.status(404).json({ message: "Musobaqa topilmadi." });

    // Check if user is already in any team for this competition
    const existing = await prisma.teamMember.findFirst({
      where: {
        userId: req.user.id,
        team: { competitionId: comp.id }
      }
    });

    if (existing) {
      return res.status(400).json({ message: "Siz allaqachon ushbu musobaqa jamoasidasiz!" });
    }

    let targetTeamId = teamId;
    if (!targetTeamId) {
      // Find team with fewest members
      const teams = await prisma.team.findMany({
        where: { competitionId: comp.id },
        include: { _count: { select: { members: true } } },
        orderBy: { members: { _count: "asc" } }
      });
      if (teams.length === 0) {
        return res.status(400).json({ message: "Hozircha jamoalar mavjud emas." });
      }
      targetTeamId = teams[0].id;
    }

    const member = await prisma.teamMember.create({
      data: {
        teamId: targetTeamId,
        userId: req.user.id,
        role: "MEMBER"
      },
      include: {
        team: true
      }
    });

    res.status(201).json({ ok: true, member, message: `Siz muvaffaqiyatli "${member.team.name}" jamoasiga qo'shildingiz!` });
  } catch (e) {
    next(e);
  }
});

export default r;
