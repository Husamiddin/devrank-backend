import { Router } from "express";
import multer from "multer";
import path from "node:path";
import fs from "node:fs";
import { auth } from "../middleware/auth.js";
import { prisma } from "../lib/prisma.js";
import { notify } from "../services/user.service.js";

const r = Router();
const uploadRoot = process.env.UPLOAD_DIR || "uploads";
const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, path.resolve(uploadRoot, "projects")),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
    }
  }),
  limits: { files: 5, fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (/^image\/(png|jpeg|webp|gif)$/.test(file.mimetype)) cb(null, true);
    else cb(new Error("Faqat PNG/JPEG/WebP/GIF rasm mumkin."));
  }
});

function dto(project, origin) {
  return {
    ...project,
    technologies: Array.isArray(project.technologies) ? project.technologies : [],
    images: project.images.map((image) => ({
      ...image,
      url: image.url.startsWith("http") ? image.url : `${origin}${image.url}`
    }))
  };
}

r.get("/projects", auth, async (req, res, next) => {
  try {
    const projects = await prisma.project.findMany({
      where: { userId: req.user.id },
      include: { images: true },
      orderBy: { createdAt: "desc" }
    });
    const origin = `${req.protocol}://${req.get("host")}`;
    res.json({ items: projects.map((p) => dto(p, origin)) });
  } catch (e) { next(e); }
});

r.post("/projects", auth, upload.array("images", 5), async (req, res, next) => {
  try {
    const title = String(req.body.title || "").trim();
    const description = String(req.body.description || "").trim();
    const purpose = String(req.body.purpose || "").trim();
    const problem = String(req.body.problem || "").trim();
    if (!title || !description || !purpose || !problem) {
      return res.status(400).json({ message: "Nomi, tavsif, maqsad va muammo majburiy." });
    }
    let technologies = [];
    try { technologies = JSON.parse(req.body.technologies || "[]"); }
    catch { technologies = String(req.body.technologies || "").split(",").map((x) => x.trim()).filter(Boolean); }
    const files = req.files || [];
    const project = await prisma.project.create({
      data: {
        userId: req.user.id,
        title,
        description,
        purpose,
        problem,
        technologies: technologies.slice(0, 20),
        tech: technologies.slice(0, 20),
        githubUrl: req.body.githubUrl || null,
        liveUrl: req.body.liveUrl || null,
        images: { create: files.map((f, i) => ({ url: `/uploads/projects/${f.filename}`, sortOrder: i })) }
      },
      include: { images: true }
    });
    await prisma.user.update({ where: { id: req.user.id }, data: { projectsCount: { increment: 1 } } });
    await notify(req.user.id, "Loyiha qo‘shildi", `“${title}” portfolioingizga qo‘shildi.`);
    res.status(201).json({ project: dto(project, `${req.protocol}://${req.get("host")}`) });
  } catch (e) { next(e); }
});

r.patch("/projects/:id", auth, upload.array("images", 5), async (req, res, next) => {
  try {
    const existing = await prisma.project.findFirst({ where: { id: req.params.id, userId: req.user.id }, include: { images: true } });
    if (!existing) return res.status(404).json({ message: "Loyiha topilmadi." });
    let technologies = existing.technologies;
    if (req.body.technologies !== undefined) {
      try { technologies = JSON.parse(req.body.technologies); }
      catch { technologies = String(req.body.technologies).split(",").map((x) => x.trim()).filter(Boolean); }
    }
    const project = await prisma.project.update({
      where: { id: existing.id },
      data: {
        title: req.body.title ?? existing.title,
        description: req.body.description ?? existing.description,
        purpose: req.body.purpose ?? existing.purpose,
        problem: req.body.problem ?? existing.problem,
        technologies,
        tech: technologies,
        githubUrl: req.body.githubUrl ?? existing.githubUrl,
        liveUrl: req.body.liveUrl ?? existing.liveUrl,
        images: { create: (req.files || []).map((f, i) => ({ url: `/uploads/projects/${f.filename}`, sortOrder: existing.images.length + i })) }
      },
      include: { images: true }
    });
    res.json({ project: dto(project, `${req.protocol}://${req.get("host")}`) });
  } catch (e) { next(e); }
});

r.delete("/projects/:id", auth, async (req, res, next) => {
  try {
    const project = await prisma.project.findFirst({ where: { id: req.params.id, userId: req.user.id }, include: { images: true } });
    if (!project) return res.status(404).json({ message: "Loyiha topilmadi." });
    await prisma.project.delete({ where: { id: project.id } });
    await prisma.user.update({ where: { id: req.user.id }, data: { projectsCount: { decrement: 1 } } });
    for (const img of project.images) {
      try { fs.unlinkSync(path.resolve(uploadRoot, img.url.replace(/^\/uploads\//, ""))); } catch {}
    }
    res.json({ ok: true });
  } catch (e) { next(e); }
});

r.delete("/projects/:id/images/:imageId", auth, async (req, res, next) => {
  try {
    const image = await prisma.projectImage.findFirst({ where: { id: req.params.imageId, project: { id: req.params.id, userId: req.user.id } } });
    if (!image) return res.status(404).json({ message: "Rasm topilmadi." });
    await prisma.projectImage.delete({ where: { id: image.id } });
    try { fs.unlinkSync(path.resolve(uploadRoot, image.url.replace(/^\/uploads\//, ""))); } catch {}
    res.json({ ok: true });
  } catch (e) { next(e); }
});

export default r;
