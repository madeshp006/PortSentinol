import { Router } from "express";
import { authRequired } from "../middleware/auth.js";
import { userRepository } from "../repositories/userRepository.js";

const router = Router();

router.get("/", authRequired, async (req, res) => {
  const user = await userRepository.findById(req.auth.userId);
  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  return res.json({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role || "Security Analyst",
    company: user.company || "PortSentinel Lab",
    createdAt: user.createdAt,
  });
});

router.put("/", authRequired, async (req, res) => {
  const { name, role, company } = req.body || {};
  const user = await userRepository.findById(req.auth.userId);
  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  const updates = {};
  if (typeof name === "string" && name.trim()) updates.name = name.trim();
  if (typeof role === "string") updates.role = role.trim();
  if (typeof company === "string") updates.company = company.trim();

  const updatedUser = await userRepository.update(user.id, updates);

  return res.json({
    id: updatedUser.id,
    name: updatedUser.name,
    email: updatedUser.email,
    role: updatedUser.role || "Security Analyst",
    company: updatedUser.company || "PortSentinel Lab",
    createdAt: updatedUser.createdAt,
  });
});

export default router;
