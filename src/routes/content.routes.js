import { Router } from "express";
import { auth } from "../middleware/auth.js";
import { prisma } from "../lib/prisma.js";
const r=Router();
r.get("/news",async(req,res,next)=>{try{res.json({items:await prisma.news.findMany({where:{status:"PUBLISHED"},orderBy:{publishedAt:"desc"},take:50})})}catch(e){next(e)}});
r.get("/events",async(req,res,next)=>{try{res.json({items:await prisma.event.findMany({where:{status:"PUBLISHED"},orderBy:{startsAt:"asc"},take:50})})}catch(e){next(e)}});
r.get("/messages",auth,async(req,res,next)=>{try{const items=await prisma.message.findMany({where:{userId:req.user.id},orderBy:{createdAt:"desc"},take:100});res.json({items,unread:items.filter(x=>!x.read).length})}catch(e){next(e)}});
r.post("/messages/:id/read",auth,async(req,res,next)=>{try{await prisma.message.updateMany({where:{id:req.params.id,userId:req.user.id},data:{read:true}});res.json({ok:true})}catch(e){next(e)}});
export default r;
