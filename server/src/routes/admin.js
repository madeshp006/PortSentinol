import { Router } from "express";
import { authRequired } from "../middleware/auth.js";
import { userRepository } from "../repositories/userRepository.js";
import { scanRepository } from "../repositories/scanRepository.js";
import { alertRepository } from "../repositories/alertRepository.js";
import { agentRepository } from "../repositories/agentRepository.js";
import { auditLogRepository } from "../repositories/auditLogRepository.js";
import { serializeMany } from "../utils/serialize.js";

const router = Router();

router.get("/overview", authRequired, async (req, res) => {
  const requestingUser = await userRepository.findById(req.auth.userId);
  if (!requestingUser || requestingUser.role !== "Administrator") {
    return res.status(403).json({ error: "Access denied. Administrator role required." });
  }

  const [totalUsers, totalScans, totalAlerts, totalAgents, activeAgents, recentScans, recentAuditLogs] = await Promise.all([
    userRepository.countAll(),
    scanRepository.countAll(),
    alertRepository.countAll(),
    agentRepository.countAll(),
    agentRepository.countActive(),
    scanRepository.findByUserId(req.auth.userId),
    auditLogRepository.findRecent(12),
  ]);

  return res.json({
    totalUsers,
    totalScans,
    totalAlerts,
    totalAgents,
    activeAgents,
    systemLogsCount: totalScans,
    recentScans: serializeMany(recentScans.slice(0, 8)),
    recentAuditLogs: recentAuditLogs.map((log) => ({
      id: log.id,
      action: log.action,
      entityType: log.entityType,
      entityId: log.entityId,
      metadata: log.metadata || {},
      createdAt: log.createdAt,
    })),
  });
});

export default router;
