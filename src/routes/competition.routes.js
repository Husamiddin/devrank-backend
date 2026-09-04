import { Router } from "express";
import { auth } from "../middleware/auth.js";
import { prisma } from "../lib/prisma.js";
import { generateCompetitionQuestions } from "../services/competitionQuiz.service.js";

const r = Router();

// GET /api/competitions - Barcha faol va bo'lajak musobaqalar
r.get("/competitions", async (req, res, next) => {
  try {
    const items = await prisma.competition.findMany({
      orderBy: { startsAt: "desc" },
      include: {
        teams: {
          orderBy: { score: "desc" },
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
          select: { teams: true, rounds: true, questions: true }
        }
      }
    });

    res.json({ items });
  } catch (e) {
    next(e);
  }
});

// GET /api/competitions/:id - Tafsilotlar
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
        rounds: true,
        _count: {
          select: { questions: true }
        }
      }
    });

    if (!item) return res.status(404).json({ message: "Musobaqa topilmadi." });

    // If no questions exist, auto-generate them
    if (item._count.questions === 0) {
      await generateCompetitionQuestions(item.id);
    }

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

// GET /api/competitions/:id/questions - Musobaqa savollari (50 ta)
r.get("/competitions/:id/questions", auth, async (req, res, next) => {
  try {
    const comp = await prisma.competition.findUnique({
      where: { id: req.params.id },
      include: {
        teams: {
          include: {
            members: { select: { userId: true, role: true } }
          }
        }
      }
    });

    if (!comp) return res.status(404).json({ message: "Musobaqa topilmadi." });

    // Find current user's team
    const myTeam = comp.teams.find(t => t.members.some(m => m.userId === req.user.id));
    if (!myTeam) {
      return res.status(403).json({ message: "Savollarni ko'rish uchun avval jamoaga qo'shiling!" });
    }

    // Auto generate questions if none
    let questions = await prisma.competitionQuestion.findMany({
      where: { competitionId: comp.id },
      orderBy: { orderIndex: "asc" }
    });

    if (questions.length < 50) {
      questions = await generateCompetitionQuestions(comp.id);
    }

    // Fetch all answers submitted by current user's team
    const teamAnswers = await prisma.competitionAnswer.findMany({
      where: {
        teamId: myTeam.id
      },
      include: {
        user: { select: { id: true, name: true } }
      }
    });

    const answersMap = {};
    for (const ans of teamAnswers) {
      answersMap[ans.questionId] = {
        answered: true,
        correct: ans.correct,
        points: ans.points,
        answeredBy: ans.user.name,
        userId: ans.userId,
        answer: ans.answer
      };
    }

    // Calculate question assignment across team members
    const teamMemberIds = myTeam.members.map(m => m.userId);
    const myMemberIndex = teamMemberIds.indexOf(req.user.id);
    const totalMembers = Math.max(teamMemberIds.length, 1);

    const formattedQuestions = questions.map((q) => {
      // Round robin assignment: is this question primarily assigned to current user?
      const assignedIndex = (q.orderIndex - 1) % totalMembers;
      const isMyTurn = assignedIndex === myMemberIndex;
      const assignedUserId = teamMemberIds[assignedIndex];

      let parsedOptions = null;
      if (q.options) {
        try { parsedOptions = JSON.parse(q.options); } catch {}
      }

      return {
        id: q.id,
        orderIndex: q.orderIndex,
        difficulty: q.difficulty,
        type: q.type,
        question: q.question,
        options: parsedOptions,
        codeTemplate: q.codeTemplate,
        language: q.language,
        points: q.points,
        isMyTurn,
        assignedToUserId: assignedUserId,
        status: answersMap[q.id] ? (answersMap[q.id].correct ? "SOLVED" : "FAILED") : "UNSOLVED",
        solvedInfo: answersMap[q.id] || null
      };
    });

    res.json({
      competition: {
        id: comp.id,
        title: comp.title,
        status: comp.status,
        startsAt: comp.startsAt,
        endsAt: comp.endsAt
      },
      team: {
        id: myTeam.id,
        name: myTeam.name,
        score: myTeam.score,
        memberCount: teamMemberIds.length
      },
      questions: formattedQuestions
    });
  } catch (e) {
    next(e);
  }
});

// POST /api/competitions/:id/questions/:questionId/answer - Savolga javob berish
r.post("/competitions/:id/questions/:questionId/answer", auth, async (req, res, next) => {
  try {
    const { answer } = req.body;
    const { id: compId, questionId } = req.params;

    if (!answer) {
      return res.status(400).json({ message: "Javob kiritilmadi." });
    }

    const comp = await prisma.competition.findUnique({
      where: { id: compId }
    });
    if (!comp) return res.status(404).json({ message: "Musobaqa topilmadi." });

    // Check if competition is active
    const now = new Date();
    if (new Date(comp.startsAt) > now) {
      return res.status(400).json({ message: "Musobaqa hali boshlanmadi!" });
    }
    if (new Date(comp.endsAt) < now) {
      return res.status(400).json({ message: "Musobaqa yakunlangan!" });
    }

    // Find user's team
    const teamMember = await prisma.teamMember.findFirst({
      where: {
        userId: req.user.id,
        team: { competitionId: compId }
      },
      include: { team: true }
    });

    if (!teamMember) {
      return res.status(403).json({ message: "Siz ushbu musobaqa jamoasida emassiz!" });
    }

    const question = await prisma.competitionQuestion.findUnique({
      where: { id: questionId }
    });
    if (!question || question.competitionId !== compId) {
      return res.status(404).json({ message: "Savol topilmadi." });
    }

    // Check if team already answered correctly
    const existingCorrect = await prisma.competitionAnswer.findFirst({
      where: {
        questionId,
        teamId: teamMember.teamId,
        correct: true
      }
    });

    if (existingCorrect) {
      return res.status(400).json({ message: "Bu savol jamoangiz tomonidan allaqachon to'g'ri ishlangan!" });
    }

    // Check answer correctness
    let isCorrect = false;
    const cleanUserAnswer = String(answer).trim().toLowerCase();
    const cleanCorrectAnswer = String(question.correctAnswer).trim().toLowerCase();

    if (question.type === "QUIZ") {
      isCorrect = cleanUserAnswer === cleanCorrectAnswer;
    } else {
      // CODE type: basic check or code verification
      isCorrect = cleanUserAnswer.length > 10;
    }

    const pointsAwarded = isCorrect ? question.points : 0;

    // Record answer
    const savedAnswer = await prisma.competitionAnswer.upsert({
      where: {
        questionId_userId: {
          questionId,
          userId: req.user.id
        }
      },
      update: {
        answer: String(answer),
        correct: isCorrect,
        points: pointsAwarded
      },
      create: {
        questionId,
        userId: req.user.id,
        teamId: teamMember.teamId,
        answer: String(answer),
        correct: isCorrect,
        points: pointsAwarded
      }
    });

    // Update Team score if correct
    if (isCorrect) {
      await prisma.team.update({
        where: { id: teamMember.teamId },
        data: { score: { increment: pointsAwarded } }
      });
      // Also update user's overall score
      await prisma.user.update({
        where: { id: req.user.id },
        data: { score: { increment: pointsAwarded } }
      });
    }

    res.json({
      ok: true,
      correct: isCorrect,
      pointsAwarded,
      message: isCorrect
        ? `To'g'ri javob! Jamoangizga +${pointsAwarded} ball qo'shildi!`
        : "Javob noto'g'ri. Qayta urinib ko'ring!"
    });
  } catch (e) {
    next(e);
  }
});

export default r;
