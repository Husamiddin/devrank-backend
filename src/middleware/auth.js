import jwt from "jsonwebtoken";
import { prisma } from "../lib/prisma.js";
export async function auth(req,res,next){
  try{
    const header=req.headers.authorization||"";
    const token=header.startsWith("Bearer ")?header.slice(7):null;
    if(!token) return res.status(401).json({message:"Authentication required."});
    const payload=jwt.verify(token,process.env.JWT_SECRET||"devrank-local-secret");
    const user=await prisma.user.findUnique({where:{id:payload.sub}});
    if(!user) return res.status(401).json({message:"User session not found."});
    req.user=user;
    next();
  }catch(e){ return res.status(401).json({message:"Invalid or expired session."}); }
}
export function signUser(user){ return jwt.sign({sub:user.id,email:user.email},process.env.JWT_SECRET||"devrank-local-secret",{expiresIn:process.env.JWT_EXPIRES_IN||"7d"}); }
