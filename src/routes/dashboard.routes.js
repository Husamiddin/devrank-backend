import { Router } from "express";
import { auth } from "../middleware/auth.js";
import { prisma } from "../lib/prisma.js";
const r=Router();
r.get("/stats",auth,async(req,res,next)=>{try{const [submissions,completed,skillCount,projectCount,last]=await Promise.all([prisma.submission.count({where:{userId:req.user.id}}),prisma.challengeAttempt.count({where:{userId:req.user.id,passed:true}}),prisma.userSkill.count({where:{userId:req.user.id}}),prisma.project.count({where:{userId:req.user.id}}),prisma.evaluation.aggregate({where:{submission:{userId:req.user.id}},_avg:{overall:true}})]);res.json({submissions,completed,skillCount,projectCount,aiScore:Math.round(last._avg.overall||0),score:req.user.score,level:req.user.level,rank:req.user.rank,streak:0,githubConnected:false})}catch(e){next(e)}});
export default r;
