import { Router } from "express";
import bcrypt from "bcryptjs";
import { requireAdmin } from "../middleware/auth.js";
import { userRepository } from "../repositories/userRepository.js";
import { scanRepository } from "../repositories/scanRepository.js";
import { alertRepository } from "../repositories/alertRepository.js";
import { agentRepository } from "../repositories/agentRepository.js";
import { auditLogRepository } from "../repositories/auditLogRepository.js";
import { serializeMany, serialize } from "../utils/serialize.js";
import { prisma } from "../config/db.js";

const router = Router();

// GET /api/admin/overview : Stats dashboard metrics
router.get("/overview", requireAdmin, async (req, res) => {
  try {
    // 1. Gather counts
    const [
      totalUsers,
      activeUsers,
      totalScans,
      successfulScans,
      failedScans,
      totalAgents,
      onlineAgents,
    ] = await Promise.all([
      userRepository.countAll(),
      userRepository.countActive(),
      scanRepository.countAll(),
      scanRepository.countSuccessful(),
      scanRepository.countFailed(),
      agentRepository.countAll(),
      agentRepository.countActive(),
    ]);

    const offlineAgents = Math.max(0, totalAgents - onlineAgents);

    // 2. Fetch completed scans to sum vulnerabilities by severity
    const completedScans = await prisma.scanResult.findMany({
      where: { status: "completed" },
      select: { ports: true },
    });

    let critical = 0, high = 0, medium = 0, low = 0;
    completedScans.forEach((s) => {
      const ports = typeof s.ports === "string" ? JSON.parse(s.ports) : (Array.isArray(s.ports) ? s.ports : []);
      ports.forEach((p) => {
        const risk = String(p.risk).toLowerCase();
        if (risk === "critical") critical++;
        else if (risk === "high") high++;
        else if (risk === "medium") medium++;
        else if (risk === "low") low++;
      });
    });

    // 3. Fetch global scans across all users
    const recentScans = await scanRepository.findAll();

    // 4. Fetch recent audit logs
    const recentAuditLogs = await auditLogRepository.findRecent(12);

    return res.json({
      summary: {
        users: totalUsers,
        activeUsers,
        totalScans,
        completed: successfulScans,
        failed: failedScans,
        onlineAgents,
        offlineAgents,
        critical,
        high,
        medium,
        low,
      },
      recentScans: serializeMany(recentScans.slice(0, 8)),
      recentAuditLogs: recentAuditLogs.map((log) => ({
        id: log.id,
        action: log.action,
        entityType: log.entityType,
        entityId: log.entityId,
        metadata: log.metadata || {},
        createdAt: log.createdAt,
        user: log.user ? { name: log.user.name, email: log.user.email } : null,
      })),
    });
  } catch (err) {
    return res.status(500).json({ error: "Failed to load admin overview: " + err.message });
  }
});

// GET /api/admin/users : List all users
router.get("/users", requireAdmin, async (req, res) => {
  try {
    const users = await userRepository.findAll();
    return res.json(serializeMany(users).map((u) => {
      delete u.password;
      return u;
    }));
  } catch (err) {
    return res.status(500).json({ error: "Failed to list users: " + err.message });
  }
});

// POST /api/admin/users : Create a user (User or Security Analyst)
router.post("/users", requireAdmin, async (req, res) => {
  const { name, email, password, role = "USER" } = req.body || {};
  if (!name?.trim() || !email?.trim() || !password) {
    return res.status(400).json({ error: "Name, email, and password are required" });
  }
  if (!["SUPER_ADMIN", "SECURITY_ANALYST", "USER"].includes(role)) {
    return res.status(400).json({ error: "Invalid role value" });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const exists = await userRepository.findByEmail(normalizedEmail);
  if (exists) {
    return res.status(409).json({ error: "Email address already registered" });
  }

  try {
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        name: name.trim(),
        email: normalizedEmail,
        password: passwordHash,
        role,
        isVerified: true,
        isActive: true,
      }
    });

    const serialized = serialize(user);
    delete serialized.password;
    return res.status(201).json(serialized);
  } catch (err) {
    return res.status(500).json({ error: "Failed to create user: " + err.message });
  }
});

// PUT /api/admin/users/:id : Edit user details, change roles, enable/disable status
router.put("/users/:id", requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { name, email, role, isActive, password } = req.body || {};

  const user = await userRepository.findById(id);
  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  // Prevent admin from disabling their own admin account
  if (user.id === req.user.id && isActive === false) {
    return res.status(400).json({ error: "You cannot disable your own administrator account" });
  }

  const updates = {};
  if (typeof name === "string" && name.trim()) updates.name = name.trim();
  if (typeof email === "string" && email.trim()) updates.email = email.trim().toLowerCase();
  if (typeof isActive === "boolean") updates.isActive = isActive;

  if (role !== undefined) {
    if (!["SUPER_ADMIN", "SECURITY_ANALYST", "USER"].includes(role)) {
      return res.status(400).json({ error: "Invalid role value" });
    }
    updates.role = role;
  }

  if (typeof password === "string" && password.trim()) {
    if (password.length < 8) {
      return res.status(400).json({ error: "Password must be at least 8 characters" });
    }
    updates.password = await bcrypt.hash(password, 10);
  }

  try {
    const updatedUser = await userRepository.update(id, updates);
    const serialized = serialize(updatedUser);
    delete serialized.password;
    return res.json(serialized);
  } catch (err) {
    return res.status(500).json({ error: "Failed to update user: " + err.message });
  }
});

// DELETE /api/admin/users/:id : Delete a user
router.delete("/users/:id", requireAdmin, async (req, res) => {
  const { id } = req.params;
  if (id === req.user.id) {
    return res.status(400).json({ error: "You cannot delete your own administrator account" });
  }

  try {
    const user = await userRepository.findById(id);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    await userRepository.delete(id);
    return res.json({ success: true, message: "User deleted successfully" });
  } catch (err) {
    return res.status(500).json({ error: "Failed to delete user: " + err.message });
  }
});

export default router;
