import { Router } from "express";
import { authRequired } from "../middleware/auth.js";
import { alertRepository } from "../repositories/alertRepository.js";
import { serializeMany } from "../utils/serialize.js";

const router = Router();

router.get("/", authRequired, async (req, res) => {
  const alerts = await alertRepository.findByUserId(req.auth.userId);
  return res.json(serializeMany(alerts));
});

router.put("/read-all", authRequired, async (req, res) => {
  await alertRepository.markAllRead(req.auth.userId);
  return res.json({ success: true });
});

router.put("/:id/read", authRequired, async (req, res) => {
  const { id } = req.params;
  await alertRepository.markRead(id, req.auth.userId);
  return res.json({ success: true });
});

router.delete("/", authRequired, async (req, res) => {
  await alertRepository.deleteByUserId(req.auth.userId);
  return res.json({ success: true });
});

export default router;
