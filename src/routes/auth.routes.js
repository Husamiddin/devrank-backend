import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { hashPassword, verifyPassword, publicUser } from "../services/user.service.js";
import { signUser } from "../middleware/auth.js";
import { recalculateAllTimeRanks } from "../services/ranking.service.js";

const r = Router();

const DISPOSABLE_DOMAINS = ["mailinator.com", "tempmail.com", "10minutemail.com", "throwawaymail.com", "fake.com", "test.com", "example.com", "trashmail.com"];

const registerSchema = z.object({
  name: z.string().min(2, "Ism kamida 2 ta belgidan iborat bo'lishi kerak").max(80),
  email: z.string().email("Haqiqiy email manzilini kiriting").refine((val) => {
    const domain = val.split("@")[1]?.toLowerCase();
    if (!domain || !domain.includes(".")) return false;
    const tld = domain.split(".").pop();
    if (!tld || tld.length < 2) return false;
    return !DISPOSABLE_DOMAINS.includes(domain);
  }, { message: "Mavjud bo'lgan haqiqiy email manzilini kiriting (soxta yoki vaqtinchalik pochtalar qabul qilinmaydi)" }),
  phone: z.string().min(7, "Telefon raqami noto'g'ri").max(35),
  password: z.string().min(6, "Parol kamida 6 ta belgidan iborat bo'lishi kerak").max(200)
});

r.post("/register", async (req, res, next) => {
  try {
    const body = registerSchema.parse(req.body);
    const email = body.email.toLowerCase().trim();

    const exists = await prisma.user.findFirst({
      where: {
        OR: [
          { email },
          { phone: body.phone.trim() }
        ]
      }
    });

    if (exists) {
      return res.status(409).json({ 
        message: "Ushbu email yoki telefon bilan akkaunt allaqachon mavjud! Bitta akkauntdan faqat 1 ta foydalanuvchi ro'yxatdan o'tishi mumkin." 
      });
    }

    const passwordHash = await hashPassword(body.password);
    const user = await prisma.user.create({
      data: {
        name: body.name,
        email: body.email.toLowerCase(),
        phone: body.phone || null,
        passwordHash,
        online: true
      }
    });

    await recalculateAllTimeRanks();
    const dto = await publicUser(user.id);
    res.status(201).json({ token: signUser(user), user: dto });
  } catch (e) {
    next(e);
  }
});

r.post("/login", async (req, res, next) => {
  try {
    const email = String(req.body.email || "").toLowerCase();
    const inputPassword = String(req.body.password || "");
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user || !(await verifyPassword(inputPassword, user.passwordHash))) {
      return res.status(401).json({ message: "Email yoki parol noto‘g‘ri." });
    }

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        online: true
      }
    });

    res.json({ token: signUser(updated), user: await publicUser(updated.id) });
  } catch (e) {
    next(e);
  }
});

r.post("/logout", async (req, res) => res.json({ ok: true }));

export default r;
