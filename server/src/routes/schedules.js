import { Router } from "express";
import { authRequired } from "../middleware/auth.js";
import { scheduleRepository } from "../repositories/scheduleRepository.js";
import { serialize, serializeMany } from "../utils/serialize.js";

const router = Router();

router.get("/", authRequired, async (req, res) => {
  const list = await scheduleRepository.findByUserId(req.auth.userId);
  return res.json(serializeMany(list));
});

router.post("/", authRequired, async (req, res) => {
  const { name, target, frequency, scanType } = req.body || {};
  if (!name || !target || !frequency || !scanType) {
    return res.status(400).json({ error: "Missing required fields (name, target, frequency, scanType)" });
  }

  const s = await scheduleRepository.create({
    userId: req.auth.userId,
    name: name.trim(),
    target: target.trim(),
    frequency: frequency.trim(),
    scanType: scanType.trim(),
    active: true,
  });

  return res.status(201).json(serialize(s));
});

router.put("/:id", authRequired, async (req, res) => {
  const { id } = req.params;
  const updates = req.body || {};
  
  const existing = await scheduleRepository.findById(id);
  if (!existing || existing.userId !== req.auth.userId) {
    return res.status(404).json({ error: "Schedule not found" });
  }

  await scheduleRepository.update(id, req.auth.userId, updates);
  const s = await scheduleRepository.findById(id);
  return res.json(serialize(s));
});

router.delete("/:id", authRequired, async (req, res) => {
  const { id } = req.params;
  const existing = await scheduleRepository.findById(id);
  if (!existing || existing.userId !== req.auth.userId) {
    return res.status(404).json({ error: "Schedule not found" });
  }

  await scheduleRepository.delete(id, req.auth.userId);
  return res.json({ success: true });
});

export default router;
