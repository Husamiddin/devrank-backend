import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma.js";
import { recalculateAllTimeRanks } from "./ranking.service.js";

export async function publicUser(id) {
  const user = await prisma.user.findUnique({
    where: { id },
    include: {
      skills: { include: { skill: true } },
      projects: { include: { images: true }, orderBy: { createdAt: "desc" }, take: 10 },
      attempts: {
        where: { passed: true },
        select: {
          challenge: {
            select: { type: true, category: true }
          }
        }
      }
    }
  });
  if (!user) return null;

  const passedAttempts = user.attempts || [];
  const passedQuizCount = passedAttempts.filter((a) => a.challenge?.type === "QUIZ").length;
  const passedCodeCount = passedAttempts.filter((a) => a.challenge?.type === "CODE").length;

  const isFounder = user.email === "aminovhusamiddin@gmail.com";
  // Qualification rule: Must pass at least 5 quiz AND 5 code challenges to be "Full Stack Developer"
  const isQualified = passedQuizCount >= 5 && passedCodeCount >= 5;

  let effectiveRole;
  if (isFounder) {
    effectiveRole = "AslKod Asoschisi";
  } else if (isQualified) {
    effectiveRole = user.role && user.role !== "Boshlang'ich Dasturchi" ? user.role : "Full Stack Developer";
  } else {
    effectiveRole = "Boshlang'ich Dasturchi";
  }

  return {
    ...user,
    role: effectiveRole,
    isQualifiedDeveloper: isQualified,
    passedQuizCount,
    passedCodeCount,
    passwordHash: undefined,
    plainPassword: undefined,
    skills: user.skills.map((x) => x.skill.name),
    projects: user.projects,
    projectsCount: user.projectsCount,
    followersCount: user.followersCount
  };
}
export async function hashPassword(password){return bcrypt.hash(password,12)}
export async function verifyPassword(password,hash){return bcrypt.compare(password,hash)}
export async function updateSkills(userId,names,category="web"){
  const clean=[...new Set((names||[]).map(x=>String(x).trim()).filter(Boolean))].slice(0,30);
  await prisma.userSkill.deleteMany({where:{userId}});
  for(const name of clean){
    const skill=await prisma.skill.upsert({where:{name},update:{},create:{name,category}});
    await prisma.userSkill.create({data:{userId,skillId:skill.id}});
  }
}
export async function notify(userId,title,body,type="system"){
  return prisma.message.create({data:{userId,title,body,type}});
}
