import { Router } from "express";
import { authRequired } from "../middleware/auth.js";
import { userRepository } from "../repositories/userRepository.js";
import { logAudit } from "../services/audit.js";
import { alertRepository } from "../repositories/alertRepository.js";
import { sendMail } from "../utils/mailer.js";

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
  if (typeof company === "string") updates.company = company.trim();

  if (role !== undefined) {
    if (user.role !== "SUPER_ADMIN" && role !== user.role) {
      return res.status(403).json({ error: "Only administrators can change roles." });
    }
    
    // Normalize role string to matching Role enum
    let targetRole = role;
    if (role === "Security Analyst") targetRole = "SECURITY_ANALYST";
    else if (role === "Administrator" || role === "Super Admin") targetRole = "SUPER_ADMIN";
    else if (role === "User") targetRole = "USER";

    if (!["SUPER_ADMIN", "SECURITY_ANALYST", "USER"].includes(targetRole)) {
      return res.status(400).json({ error: "Invalid role value" });
    }
    updates.role = targetRole;
  }

  const updatedUser = await userRepository.update(user.id, updates);

  return res.json({
    id: updatedUser.id,
    name: updatedUser.name,
    email: updatedUser.email,
    role: updatedUser.role,
    company: updatedUser.company || "PortSentinel Lab",
    createdAt: updatedUser.createdAt,
  });
});

router.post("/feedback", authRequired, async (req, res) => {
  const { category, text } = req.body || {};
  if (!text?.trim()) {
    return res.status(400).json({ error: "Feedback text is required" });
  }

  try {
    const user = await userRepository.findById(req.auth.userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // 1. Log as audit event
    await logAudit({
      userId: user.id,
      action: "user.feedback",
      entityType: "feedback",
      metadata: { category, text: text.trim() }
    });

    // 2. Alert the administrator
    const admin = await userRepository.findByEmail("admin@portsentinel.com");
    if (admin) {
      await alertRepository.create({
        userId: admin.id,
        title: `Feedback Received: ${category}`,
        message: `Feedback from ${user.name} (${user.email}): "${text.trim()}"`,
        risk: "info",
      });
    }

    // 3. Email the feedback to the admin
    try {
      await sendMail({
        to: "admin@portsentinel.com",
        subject: `PortSentinel Feedback: [${category}] from ${user.name}`,
        text: `Feedback Category: ${category}\nFrom: ${user.name} (${user.email})\nMessage: ${text.trim()}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #070d1e; color: #c8d8f0; border-radius: 12px; border: 1px solid #1c3254;">
            <h2 style="color: #a78bfa;">New Feedback Received</h2>
            <p><strong>From:</strong> ${user.name} (${user.email})</p>
            <p><strong>Category:</strong> ${category.toUpperCase()}</p>
            <p><strong>Feedback:</strong></p>
            <div style="background-color: rgba(167,139,250,0.06); padding: 15px; border-radius: 8px; border: 1px solid rgba(167,139,250,0.18); font-style: italic;">
              "${text.trim()}"
            </div>
          </div>
        `
      });
    } catch (err) {
      console.error("Failed to email feedback to admin:", err.message);
    }

    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: "Failed to submit feedback: " + err.message });
  }
});

export default router;
