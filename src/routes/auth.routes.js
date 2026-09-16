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
    return domain === "gmail.com" || domain === "googlemail.com";
  }, { message: "Faqat haqiqiy Google (Gmail) akkaunti orqali ro'yxatdan o'tish mumkin (@gmail.com)!" }),
  phone: z.string().min(9, "Telefon raqamini to'liq kiriting (kamida 9 ta raqam)").max(35),
  province: z.string().min(2, "Viloyat (manzil) tanlanishi majburiy"),
  password: z.string().min(6, "Parol kamida 6 ta belgidan iborat bo'lishi kerak").max(200)
});

r.post("/register", async (req, res, next) => {
  try {
    const body = registerSchema.parse(req.body);
    const email = body.email.toLowerCase().trim();
    const cleanPhone = body.phone.trim();

    const exists = await prisma.user.findFirst({
      where: {
        OR: [
          { email },
          { phone: cleanPhone }
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
        name: body.name.trim(),
        email,
        phone: cleanPhone,
        province: body.province.trim(),
        role: "Boshlang'ich Dasturchi",
        passwordHash,
        plainPassword: body.password,
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

r.post("/google", async (req, res, next) => {
  try {
    let { email, name, avatar, credential } = req.body;

    // Support Google Identity Services JWT credential if provided
    if (credential && typeof credential === "string" && credential.includes(".")) {
      try {
        const payloadBase64 = credential.split(".")[1];
        const payloadJson = Buffer.from(payloadBase64, "base64").toString("utf-8");
        const parsed = JSON.parse(payloadJson);
        if (parsed.email) {
          email = parsed.email;
          name = name || parsed.name || parsed.given_name;
          avatar = avatar || parsed.picture;
        }
      } catch (err) {
        console.warn("Failed to decode Google credential JWT:", err.message);
      }
    }

    if (!email || typeof email !== "string" || !email.includes("@")) {
      return res.status(400).json({ message: "Google hisobidan haqiqiy email olinmadi." });
    }

    const cleanEmail = email.toLowerCase().trim();
    const domain = cleanEmail.split("@")[1]?.toLowerCase();
    if (domain !== "gmail.com" && domain !== "googlemail.com") {
      return res.status(400).json({ message: "Faqat mavjud Google (Gmail) akkaunti orqali kirish/ro'yxatdan o'tish mumkin (@gmail.com)!" });
    }

    let user = await prisma.user.findUnique({ where: { email: cleanEmail } });

    if (user) {
      // Existing user logging in with Google
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          online: true,
          ...(avatar && !user.avatar ? { avatar } : {})
        }
      });
      const dto = await publicUser(user.id);
      return res.json({ token: signUser(user), user: dto });
    } else {
      // New user registering with Google: email and name are verified from Google,
      // but user MUST complete mandatory registration fields (phone, province, password)
      return res.json({
        needsRegistration: true,
        email: cleanEmail,
        name: name?.trim() || cleanEmail.split("@")[0],
        avatar: avatar || null,
        message: "Google hisobi tasdiqlandi. Ro'yxatdan o'tishni yakunlash uchun telefon raqam, viloyat va parolingizni kiriting."
      });
    }
  } catch (e) {
    next(e);
  }
});

r.post("/logout", async (req, res) => res.json({ ok: true }));

export default r;
