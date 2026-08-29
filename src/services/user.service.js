import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma.js";
import { recalculateAllTimeRanks } from "./ranking.service.js";

export async function publicUser(id){
  const user=await prisma.user.findUnique({where:{id},include:{skills:{include:{skill:true}},projects:{include:{images:true},orderBy:{createdAt:"desc"},take:10}}});
  if(!user) return null;
  return {...user,passwordHash:undefined,skills:user.skills.map(x=>x.skill.name),projects:user.projects,projectsCount:user.projectsCount,followersCount:user.followersCount};
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
