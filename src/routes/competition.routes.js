import { Router } from "express";
import { auth } from "../middleware/auth.js";
import { prisma } from "../lib/prisma.js";
import { generateCompetitionQuestions } from "../services/competitionQuiz.service.js";

const r = Router();

// GET /api/competitions - Barcha musobaqalar
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

    // Auto generate questions if none
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
            members: {
              select: {
                id: true,
                userId: true,
                role: true,
                disqualified: true,
                disqualifiedReason: true,
                currentQuestion: true
              }
            }
          }
        }
      }
    });

    if (!comp) return res.status(404).json({ message: "Musobaqa topilmadi." });

    // Check start time: Arena cannot be accessed before startsAt
    const now = new Date();
    if (new Date(comp.startsAt) > now) {
      return res.status(403).json({
        message: "Musobaqa hali boshlanmagan! Belgilangan vaqtda ochiladi.",
        startsAt: comp.startsAt
      });
    }

    // Find current user's team
    const myTeam = comp.teams.find(t => t.members.some(m => m.userId === req.user.id));
    if (!myTeam) {
      return res.status(403).json({ message: "Savollarni ko'rish uchun avval jamoaga qo'shiling!" });
    }

    const currentMember = myTeam.members.find(m => m.userId === req.user.id);
    if (currentMember?.disqualified) {
      return res.status(403).json({
        message: "Siz qoidabuzarlik sababli musobaqadan chetlatilgansiz!",
        disqualified: true,
        reason: currentMember.disqualifiedReason || "Boshqa oynaga o'tish yoki shubhali harakat"
      });
    }

    // Auto generate questions if none
    let questions = await prisma.competitionQuestion.findMany({
      where: { competitionId: comp.id },
      orderBy: { orderIndex: "asc" }
    });

    if (questions.length < 50) {
      questions = await generateCompetitionQuestions(comp.id);
    }

    // Fetch all answers submitted by current user's team ONLY
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

    // Round robin assignment across team members
    const activeMembers = myTeam.members.filter(m => !m.disqualified);
    const teamMemberIds = activeMembers.map(m => m.userId);
    const myMemberIndex = teamMemberIds.indexOf(req.user.id);
    const totalMembers = Math.max(teamMemberIds.length, 1);

    const formattedQuestions = questions.map((q) => {
      const assignedIndex = (q.orderIndex - 1) % totalMembers;
      const isMyTurn = assignedIndex === myMemberIndex;
      const assignedUserId = teamMemberIds[assignedIndex];

      let parsedOptions = null;
      if (q.options) {
        try { parsedOptions = JSON.parse(q.options); } catch {}
      }

      // Time limit per question: 60s for quiz, 300s (5 min) for code
      const timeLimitSec = q.type === "CODE" ? 300 : 60;

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
        timeLimitSec,
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
      disqualified: false,
      questions: formattedQuestions
    });
  } catch (e) {
    next(e);
  }
});

// POST /api/competitions/:id/disqualify - Shubhali harakat / ekrandan chiqish
r.post("/competitions/:id/disqualify", auth, async (req, res, next) => {
  try {
    const { reason = "Boshqa oynaga o'tish yoki shubhali harakat" } = req.body;
    const { id: compId } = req.params;

    const teamMember = await prisma.teamMember.findFirst({
      where: {
        userId: req.user.id,
        team: { competitionId: compId }
      },
      include: { team: true, user: true }
    });

    if (!teamMember) {
      return res.status(404).json({ message: "Jamoa a'zosi topilmadi." });
    }

    await prisma.teamMember.update({
      where: { id: teamMember.id },
      data: {
        disqualified: true,
        disqualifiedReason: String(reason).slice(0, 200)
      }
    });

    // Notify user
    await prisma.message.create({
      data: {
        userId: req.user.id,
        title: "Musobaqadan chetlatildingiz",
        body: `Siz "${teamMember.team.name}" jamoasidagi musobaqadan quyidagi sababga ko'ra chetlatildingiz: ${reason}. Admin ruxsati bilan qayta tiklanishingiz mumkin.`,
        type: "system"
      }
    });

    res.json({
      ok: true,
      disqualified: true,
      message: "Qoidabuzarlik qayd etildi. Siz musobaqadan chetlatildingiz!"
    });
  } catch (e) {
    next(e);
  }
});

// POST /api/competitions/:id/questions/:questionId/answer - Savolga javob berish
r.post("/competitions/:id/questions/:questionId/answer", auth, async (req, res, next) => {
  try {
    const { answer, currentQuestionIndex = 1 } = req.body;
    const { id: compId, questionId } = req.params;

    if (!answer) {
      return res.status(400).json({ message: "Javob kiritilmadi." });
    }

    const comp = await prisma.competition.findUnique({
      where: { id: compId }
    });
    if (!comp) return res.status(404).json({ message: "Musobaqa topilmadi." });

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

    if (teamMember.disqualified) {
      return res.status(403).json({
        message: "Siz musobaqadan chetlatilgansiz! Qayta kirish imkoni yo'q.",
        disqualified: true
      });
    }

    const question = await prisma.competitionQuestion.findUnique({
      where: { id: questionId }
    });
    if (!question || question.competitionId !== compId) {
      return res.status(404).json({ message: "Savol topilmadi." });
    }

    // Update current question progress
    await prisma.teamMember.update({
      where: { id: teamMember.id },
      data: { currentQuestion: Number(currentQuestionIndex || question.orderIndex) }
    });

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

    // Check if user already answered this question - CANNOT CHANGE ANSWER!
    const existingUserAns = await prisma.competitionAnswer.findUnique({
      where: {
        questionId_userId: {
          questionId,
          userId: req.user.id
        }
      }
    });
    if (existingUserAns) {
      return res.status(400).json({ message: "Siz bu savolga allaqachon javob bergansiz! Javobni qayta o'zgartirib bo'lmaydi." });
    }

    let isCorrect = false;
    const cleanUserAnswer = String(answer).trim().toLowerCase();
    const cleanCorrectAnswer = String(question.correctAnswer).trim().toLowerCase();

    if (question.type === "QUIZ") {
      isCorrect = cleanUserAnswer === cleanCorrectAnswer;
    } else {
      isCorrect = cleanUserAnswer.length > 10;
    }

    const pointsAwarded = isCorrect ? question.points : 0;

    await prisma.competitionAnswer.upsert({
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

    if (isCorrect) {
      await prisma.team.update({
        where: { id: teamMember.teamId },
        data: { score: { increment: pointsAwarded } }
      });
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
        : "Javob noto'g'ri. Jamoangiz bilan qayta urinib ko'ring!"
    });
  } catch (e) {
    next(e);
  }
});

// POST /api/competitions/:id/winner-contact - G'olib jamoa a'zosi diplom olish uchun ma'lumot qoldirishi
r.post("/competitions/:id/winner-contact", auth, async (req, res, next) => {
  try {
    const { phone, telegram } = req.body;
    const { id: compId } = req.params;

    if (!phone || !telegram) {
      return res.status(400).json({ message: "Telefon va telegram kiritilishi shart." });
    }

    // Update user
    await prisma.user.update({
      where: { id: req.user.id },
      data: {
        phone: String(phone).trim(),
        telegram: String(telegram).trim()
      }
    });

    // Update team member
    await prisma.teamMember.updateMany({
      where: {
        userId: req.user.id,
        team: { competitionId: compId }
      },
      data: {
        contactPhone: String(phone).trim(),
        telegram: String(telegram).trim()
      }
    });

    // Send congratulation message
    await prisma.message.create({
      data: {
        userId: req.user.id,
        title: "Diplom ma'lumotlari qabul qilindi 🎓",
        body: `Tabriklaymiz! Musobaqadagi g'alabangiz munosabati bilan diplomingiz tayyorlanmoqda. Biz siz bilan ${telegram} yoki ${phone} orqali bog'lanamiz!`,
        type: "system"
      }
    });

    res.json({
      ok: true,
      message: "Ma'lumotlaringiz muvaffaqiyatli saqlandi! Tez orada admin jamoasi siz bilan bog'lanadi."
    });
  } catch (e) {
    next(e);
  }
});

// POST /api/competitions/:id/finish - User o'zi testni qonuniy yakunlashi
r.post("/competitions/:id/finish", auth, async (req, res, next) => {
  try {
    const { phone, telegram } = req.body;
    const { id: compId } = req.params;

    if (phone || telegram) {
      await prisma.user.update({
        where: { id: req.user.id },
        data: {
          phone: phone ? String(phone).trim() : undefined,
          telegram: telegram ? String(telegram).trim() : undefined
        }
      });
      await prisma.teamMember.updateMany({
        where: { userId: req.user.id, team: { competitionId: compId } },
        data: {
          contactPhone: phone ? String(phone).trim() : undefined,
          telegram: telegram ? String(telegram).trim() : undefined
        }
      });
    }

    res.json({ ok: true, message: "Musobaqa muvaffaqiyatli yakunlandi! Natijalarni ko'rishingiz mumkin." });
  } catch (e) {
    next(e);
  }
});

// GET /api/competitions/:id/results - Musobaqa yakuniy natijalari va g'oliblar
r.get("/competitions/:id/results", auth, async (req, res, next) => {
  try {
    const comp = await prisma.competition.findUnique({
      where: { id: req.params.id },
      include: {
        teams: {
          orderBy: { score: "desc" },
          include: {
            members: {
              include: {
                user: { select: { id: true, name: true, avatar: true, score: true, level: true } }
              }
            }
          }
        }
      }
    });

    if (!comp) return res.status(404).json({ message: "Musobaqa topilmadi." });

    if (!comp.showResults) {
      return res.json({
        showResults: false,
        message: "Natijalar hozircha admin tomonidan berkitilgan."
      });
    }

    // Award bonus points to Top 1, 2, 3 places if not yet awarded
    const isEnded = new Date(comp.endsAt) <= new Date() || comp.status === "COMPLETED";
    if (isEnded && comp.teams.length > 0) {
      try {
        const existingAward = await prisma.message.findFirst({
          where: {
            title: "Musobaqa sovrin ballari",
            body: { contains: comp.id }
          }
        });

        if (!existingAward) {
          const userPoints = await prisma.competitionAnswer.groupBy({
            by: ["userId"],
            where: { question: { competitionId: comp.id }, correct: true },
            _sum: { points: true }
          });
          const scoreMap = {};
          userPoints.forEach(p => { scoreMap[p.userId] = p._sum.points || 0; });

          for (let teamIdx = 0; teamIdx < comp.teams.length; teamIdx++) {
            const team = comp.teams[teamIdx];
            const isWinningTeam = teamIdx === 0;

            const sortedMembers = [...team.members].sort((a, b) => {
              const scA = scoreMap[a.userId] || 0;
              const scB = scoreMap[b.userId] || 0;
              return scB - scA;
            });

            // 1-o'rin uchun 500 pts (yutgan jamoa) / 100 pts (mag'lub jamoa), 2-o'rin 50 pts, 3-o'rin 20 pts
            const prizeTiers = isWinningTeam ? [500, 50, 20] : [100, 50, 20];

            for (let mIdx = 0; mIdx < sortedMembers.length && mIdx < 3; mIdx++) {
              const member = sortedMembers[mIdx];
              const bonusPts = prizeTiers[mIdx];
              const memberRankInTeam = mIdx + 1;

              await prisma.user.update({
                where: { id: member.userId },
                data: { score: { increment: bonusPts } }
              });

              await prisma.message.create({
                data: {
                  userId: member.userId,
                  title: "Musobaqa sovrin ballari",
                  body: `Tabriklaymiz! "${comp.title}" musobaqasida jamoangiz ${isWinningTeam ? "G'olib (1-o'rin)" : "ishtirokchi"} bo'ldi. Siz jamoangizda ${memberRankInTeam}-o'rinni egallab, shaxsiy hisobingizga +${bonusPts} pts mukofot ball oldingiz! (Musobaqa ID: ${comp.id})`,
                  type: "reward"
                }
              });
            }
          }
        }
      } catch (errAward) {
        console.error("Bonus awarding error:", errAward);
      }
    }

    // Find my team
    const myTeam = comp.teams.find(t => t.members.some(m => m.userId === req.user.id));
    const isWinner = comp.teams.length > 0 && myTeam?.id === comp.teams[0].id;

    // Fetch team's detailed mistakes & successes (only for user's own team)
    let myTeamMistakes = [];
    if (myTeam) {
      const answers = await prisma.competitionAnswer.findMany({
        where: { teamId: myTeam.id },
        include: {
          question: { select: { id: true, orderIndex: true, question: true, difficulty: true, points: true, type: true } },
          user: { select: { id: true, name: true } }
        },
        orderBy: { question: { orderIndex: "asc" } }
      });

      myTeamMistakes = answers.map(a => ({
        questionNumber: a.question.orderIndex,
        questionText: a.question.question,
        difficulty: a.question.difficulty,
        answeredBy: a.user.name,
        isCorrect: a.correct,
        userAnswer: a.answer,
        points: a.points
      }));
    }

    const leaderboard = comp.teams.map((t, idx) => ({
      rank: idx + 1,
      id: t.id,
      name: t.name,
      score: t.score,
      isWinner: idx === 0,
      isMyTeam: t.id === myTeam?.id,
      memberCount: t.members.length,
      members: t.members.map(m => ({
        id: m.id,
        userId: m.userId,
        name: m.user.name,
        role: m.role,
        disqualified: m.disqualified
      }))
    }));

    res.json({
      showResults: true,
      competition: {
        id: comp.id,
        title: comp.title,
        status: comp.status,
        endsAt: comp.endsAt
      },
      isWinner,
      myTeamRank: myTeam ? (comp.teams.findIndex(t => t.id === myTeam.id) + 1) : null,
      leaderboard,
      myTeamMistakes
    });
  } catch (e) {
    next(e);
  }
});

export default r;
