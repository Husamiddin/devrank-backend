import { Router } from "express";
import { getLeaderboard } from "../services/ranking.service.js";

const r = Router();
const clients = new Set();

function writeEvent(res, users) {
  try {
    res.write(`event: leaderboard\ndata: ${JSON.stringify({ users })}\n\n`);
    return true;
  } catch {
    return false;
  }
}

export async function broadcastLeaderboard({ period = "all", category = "all", province = null } = {}) {
  const users = await getLeaderboard({ period, category, province });
  for (const res of clients) {
    if (!writeEvent(res, users)) clients.delete(res);
  }
}

r.get("/leaderboard", async (req, res, next) => {
  try {
    const users = await getLeaderboard({
      period: req.query.period || "all",
      category: req.query.category || "all",
      province: req.query.province || null,
    });
    res.json({ users });
  } catch (e) {
    next(e);
  }
});

r.get("/leaderboard/stream", async (req, res) => {
  const period = req.query.period || "all";
  const category = req.query.category || "all";
  const province = req.query.province || null;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  clients.add(res);

  try {
    const users = await getLeaderboard({ period, category, province });
    writeEvent(res, users);
  } catch {
    writeEvent(res, []);
  }

  const heartbeat = setInterval(() => {
    try {
      res.write(": heartbeat\n\n");
    } catch {
      clearInterval(heartbeat);
      clients.delete(res);
    }
  }, 20000);

  req.on("close", () => {
    clearInterval(heartbeat);
    clients.delete(res);
  });
});

export async function pushLiveLeaderboard() {
  await broadcastLeaderboard({ period: "all", category: "all", province: null });
}

export default r;
