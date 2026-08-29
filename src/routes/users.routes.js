import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { publicUser } from "../services/user.service.js";

const r = Router();

// GET /api/search?q=query
r.get("/search", async (req, res, next) => {
  try {
    const q = String(req.query.q || "").trim();
    if (!q || q.length < 2) {
      return res.json({ users: [], projects: [], challenges: [] });
    }

    const [users, projects, challenges] = await Promise.all([
      prisma.user.findMany({
        where: {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { username: { contains: q, mode: "insensitive" } },
            { role: { contains: q, mode: "insensitive" } }
          ]
        },
        select: {
          id: true,
          name: true,
          username: true,
          avatar: true,
          role: true,
          level: true,
          score: true,
          rank: true,
          province: true
        },
        take: 10
      }),
      prisma.project.findMany({
        where: {
          OR: [
            { title: { contains: q, mode: "insensitive" } },
            { description: { contains: q, mode: "insensitive" } },
            { technologies: { hasSome: [q] } }
          ]
        },
        include: {
          images: true,
          user: {
            select: { id: true, name: true, avatar: true }
          }
        },
        take: 10
      }),
      prisma.challenge.findMany({
        where: {
          published: true,
          OR: [
            { title: { contains: q, mode: "insensitive" } },
            { description: { contains: q, mode: "insensitive" } },
            { category: { contains: q, mode: "insensitive" } }
          ]
        },
        select: {
          id: true,
          slug: true,
          title: true,
          category: true,
          type: true,
          difficulty: true,
          points: true
        },
        take: 10
      })
    ]);

    res.json({ users, projects, challenges });
  } catch (e) {
    next(e);
  }
});

// GET /api/users/:id
r.get("/users/:id", async (req, res, next) => {
  try {
    const user = await publicUser(req.params.id);
    if (!user) return res.status(404).json({ message: "Profil topilmadi." });
    res.json({ user });
  } catch (e) {
    next(e);
  }
});

export default r;
