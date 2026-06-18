import { Router } from "express";
import crypto from "crypto";
import path from "path";
import fs from "fs";
import { ZipArchive } from "archiver";
import { requireUser } from "../middleware/auth.js";
import { agentAuth } from "../middleware/agentAuth.js";
import { agentRepository } from "../repositories/agentRepository.js";
import { scanJobRepository } from "../repositories/scanJobRepository.js";
import { scanRepository } from "../repositories/scanRepository.js";
import { alertRepository } from "../repositories/alertRepository.js";
import { serialize, serializeMany } from "../utils/serialize.js";
import { emitToUser } from "../services/socketManager.js";
import { logAudit } from "../services/audit.js";
import { summarizeScan } from "../services/scanner/findings.js";

const router = Router();

// ─── USER AUTHENTICATED ROUTES ───────────────────────────────────────────────

// POST /api/agents/register : Register a new agent
router.post("/register", requireUser, async (req, res) => {
  const { name, deviceName, operatingSystem, version = "1.0.0" } = req.body || {};

  if (!name?.trim()) {
    return res.status(400).json({ error: "Agent friendly name is required" });
  }

  try {
    const agentId = `age_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
    const apiKey = `psa_${crypto.randomBytes(24).toString("hex")}`;

    const agent = await agentRepository.create({
      agentId,
      name: name.trim(),
      deviceName: deviceName || "Unknown Device",
      operatingSystem: operatingSystem || "Unknown OS",
      version,
      status: "online",
      lastSeen: new Date(),
      apiKey,
      userId: req.user.id,
    });

    await logAudit({
      userId: req.user.id,
      action: "agent.registered",
      entityType: "agent",
      entityId: agent.id,
      metadata: { name: agent.name, agentId: agent.agentId },
    });

    // Notify user dashboard of the new active agent
    emitToUser(req.user.id, "agent:status", {
      agentId: agent.agentId,
      status: "online",
      agent: serialize(agent),
    });

    return res.status(201).json({ agent: serialize(agent) });
  } catch (err) {
    return res.status(500).json({ error: "Failed to register agent: " + err.message });
  }
});

// GET /api/agents : List all agents (scoped by role)
router.get("/", requireUser, async (req, res) => {
  try {
    let agents;
    if (req.user.role === "SUPER_ADMIN" || req.user.role === "SECURITY_ANALYST") {
      agents = await agentRepository.findAll();
    } else {
      agents = await agentRepository.findByUserId(req.user.id);
    }
    return res.json(serializeMany(agents));
  } catch (err) {
    return res.status(500).json({ error: "Failed to list agents: " + err.message });
  }
});

// GET /api/agents/download : Download the local agent package as a ZIP
router.get("/download", requireUser, async (req, res) => {
  try {
    const archive = new ZipArchive({ zlib: { level: 9 } });
    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", 'attachment; filename="portsentinel-agent.zip"');

    archive.on("error", (err) => {
      throw err;
    });

    archive.pipe(res);

    let resolvedAgentPath = path.resolve(process.cwd(), "../agent");
    if (!fs.existsSync(resolvedAgentPath)) {
      resolvedAgentPath = path.resolve(process.cwd(), "agent");
    }
    
    // Check if the agent folder exists
    if (!fs.existsSync(resolvedAgentPath)) {
      return res.status(404).json({ error: "Agent project template folder not found on the server" });
    }

    archive.directory(resolvedAgentPath, false, (entry) => {
      const parts = entry.name.split(/[\\/]/);
      if (parts.includes("node_modules") || parts.includes(".git") || parts.includes(".env")) {
        return false;
      }
      return entry;
    });
    await archive.finalize();
  } catch (err) {
    if (!res.headersSent) {
      return res.status(500).json({ error: "Failed to download agent ZIP: " + err.message });
    }
  }
});


// GET /api/agents/:id : Get details of a specific agent
router.get("/:id", requireUser, async (req, res) => {
  const { id } = req.params;
  try {
    let agent = await agentRepository.findById(id);
    if (!agent) {
      agent = await agentRepository.findByAgentId(id);
    }

    if (!agent) {
      return res.status(404).json({ error: "Agent not found" });
    }

    if (req.user.role === "USER" && agent.userId !== req.user.id) {
      return res.status(403).json({ error: "Access denied" });
    }

    return res.json(serialize(agent));
  } catch (err) {
    return res.status(500).json({ error: "Failed to get agent: " + err.message });
  }
});

// DELETE /api/agents/:id : Deregister/delete an agent
router.delete("/:id", requireUser, async (req, res) => {
  const { id } = req.params;
  try {
    let agent = await agentRepository.findById(id);
    if (!agent) {
      agent = await agentRepository.findByAgentId(id);
    }

    if (!agent) {
      return res.status(404).json({ error: "Agent not found" });
    }

    if (req.user.role === "SUPER_ADMIN") {
      await agentRepository.deleteGlobal(agent.id);
    } else if (req.user.role === "USER" && agent.userId === req.user.id) {
      await agentRepository.delete(agent.id, req.user.id);
    } else {
      return res.status(403).json({ error: "Access denied. Only the owner or an administrator can delete this agent." });
    }

    await logAudit({
      userId: req.user.id,
      action: "agent.deleted",
      entityType: "agent",
      entityId: agent.id,
      metadata: { name: agent.name, agentId: agent.agentId },
    });

    // Emit real-time offline status to disconnect UI
    emitToUser(agent.userId, "agent:status", {
      agentId: agent.agentId,
      status: "offline",
      deleted: true,
    });

    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: "Failed to delete agent: " + err.message });
  }
});

// ─── AGENT AUTHENTICATED ROUTES ───────────────────────────────────────────────

// POST /api/agents/heartbeat : Agent heartbeat ping (using x-agent-key header)
router.post("/heartbeat", agentAuth, async (req, res) => {
  const { deviceName, operatingSystem, version } = req.body || {};
  try {
    const updated = await agentRepository.updateHeartbeat(
      req.agent.agentId,
      deviceName || req.agent.deviceName,
      operatingSystem || req.agent.operatingSystem,
      version || req.agent.version
    );

    emitToUser(req.agent.userId, "agent:status", {
      agentId: req.agent.agentId,
      status: "online",
      agent: serialize(updated),
    });

    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: "Heartbeat processing failed: " + err.message });
  }
});

// PUT /api/agents/:agentId/heartbeat : Heartbeat to support local script path
router.put("/:agentId/heartbeat", agentAuth, async (req, res) => {
  const { agentId } = req.params;
  const { deviceName, operatingSystem, version } = req.body || {};

  if (agentId !== req.agent.agentId) {
    return res.status(403).json({ error: "Unauthorized for this Agent ID" });
  }

  try {
    const updated = await agentRepository.updateHeartbeat(
      agentId,
      deviceName || req.agent.deviceName,
      operatingSystem || req.agent.operatingSystem,
      version || req.agent.version
    );

    emitToUser(req.agent.userId, "agent:status", {
      agentId: agentId,
      status: "online",
      agent: serialize(updated),
    });

    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: "Heartbeat processing failed: " + err.message });
  }
});

// GET /api/agents/jobs : Poll pending scan jobs for this agent
router.get("/jobs", agentAuth, async (req, res) => {
  try {
    const jobs = await scanJobRepository.findPendingByAgent(req.agent.id);

    // Transition polled jobs to running status to prevent duplicate execution
    const updatedJobs = [];
    for (const job of jobs) {
      const updatedJob = await scanJobRepository.update(job.id, {
        status: "running",
      });
      updatedJobs.push(updatedJob);

      // Find the associated ScanResult and update its status
      const scans = await scanRepository.findByUserId(job.userId);
      const associatedScan = scans.find((s) => s.scanJobId === job.id);

      if (associatedScan) {
        // Mark scan as running and append pickup event to timeline
        await scanRepository.update(associatedScan.id, {
          status: "running",
          progress: 10,
          startedAt: new Date(),
          currentStage: "running",
        });

        const updatedScan = await scanRepository.appendTimeline(associatedScan.id, {
          at: new Date(),
          level: "info",
          msg: `Scan picked up by agent "${req.agent.name}"`,
        });

        // Emit real-time progress update to user dashboard
        if (updatedScan) {
          emitToUser(job.userId, "scan:progress", {
            scanId: associatedScan.id,
            progress: 10,
            currentStage: "running",
            msg: `Scan picked up by agent "${req.agent.name}"`,
            timeline: updatedScan.timeline,
          });
        }
      }
    }

    return res.json(serializeMany(updatedJobs));
  } catch (err) {
    return res.status(500).json({ error: "Job polling failed: " + err.message });
  }
});

// GET /api/agents/:agentId/jobs : Job polling alias to support local script path
router.get("/:agentId/jobs", agentAuth, async (req, res) => {
  const { agentId } = req.params;

  if (agentId !== req.agent.agentId) {
    return res.status(403).json({ error: "Unauthorized for this Agent ID" });
  }

  // Redirect internally to the standard jobs polling controller
  req.url = "/jobs";
  return router.handle(req, res);
});

// POST /api/agents/:agentId/jobs/:jobId/result : Upload scan results
router.post("/:agentId/jobs/:jobId/result", agentAuth, async (req, res) => {
  const { agentId, jobId } = req.params;
  const { result, error } = req.body || {};

  if (agentId !== req.agent.agentId) {
    return res.status(403).json({ error: "Unauthorized for this Agent ID" });
  }

  try {
    const job = await scanJobRepository.findById(jobId);
    if (!job) {
      return res.status(404).json({ error: "Scan job not found" });
    }

    const scans = await scanRepository.findByUserId(job.userId);
    const associatedScan = scans.find((s) => s.scanJobId === jobId);

    if (error) {
      // Handle failed job reporting from agent
      await scanJobRepository.update(jobId, {
        status: "failed",
        result: { error },
      });

      if (associatedScan) {
        await scanRepository.update(associatedScan.id, {
          status: "failed",
          progress: 100,
          finishedAt: new Date(),
          currentStage: "failed",
          errorMessage: error,
        });

        const updatedScan = await scanRepository.appendTimeline(associatedScan.id, {
          at: new Date(),
          level: "error",
          msg: `Agent scan failed: ${error}`,
        });

        // Emit failure to frontend
        emitToUser(job.userId, "scan:failed", {
          scanId: associatedScan.id,
          error: error,
          timeline: updatedScan?.timeline,
        });

        await logAudit({
          userId: job.userId,
          action: "scan.failed",
          entityType: "scan",
          entityId: associatedScan.id,
          metadata: { target: associatedScan.target, error },
        });
      }

      return res.json({ success: true });
    }

    if (!result) {
      return res.status(400).json({ error: "Result payload or error payload required" });
    }

    // Process successful scan results from agent
    const summary = summarizeScan({ ...result, target: job.target });
    const savedAt = new Date();

    await scanJobRepository.update(jobId, {
      status: "completed",
      result: result,
    });

    if (associatedScan) {
      await scanRepository.update(associatedScan.id, {
        ...summary,
        status: "completed",
        progress: 100,
        workerMode: "agent",
        finishedAt: savedAt,
        savedAt,
        timestamp: savedAt,
        currentStage: "completed",
        errorMessage: "",
      });

      const updatedScan = await scanRepository.appendTimeline(associatedScan.id, {
        at: new Date(),
        level: "success",
        msg: "Agent scan complete. Report saved to history.",
      });

      // Handle alerts & socket notifications for critical/high findings
      let misconfigs = [];
      if (summary.misconfigs) {
        misconfigs = Array.isArray(summary.misconfigs) ? summary.misconfigs : [];
      }
      const top = misconfigs.slice().sort((a, b) => {
        const order = { critical: 0, high: 1, medium: 2, low: 3 };
        return (order[a.risk] ?? 9) - (order[b.risk] ?? 9);
      })[0];

      const alert = await alertRepository.create({
        userId: job.userId,
        title: top ? `${String(top.risk || "info").toUpperCase()} finding detected` : "Agent Scan finished",
        message: top
          ? `${top.title} on ${associatedScan.target}`
          : `Agent scan completed for ${associatedScan.target} with no major misconfigurations detected.`,
        risk: top?.risk || "info",
        metadata: { scanId: associatedScan.id },
      });

      // Emit new events
      emitToUser(job.userId, "alert:new", alert);
      emitToUser(job.userId, "scan:completed", {
        scanId: associatedScan.id,
        scan: serialize(updatedScan),
      });

      await logAudit({
        userId: job.userId,
        action: "scan.completed",
        entityType: "scan",
        entityId: associatedScan.id,
        metadata: { target: associatedScan.target, openPorts: summary.openPorts },
      });
    }

    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: "Failed to upload scan result: " + err.message });
  }
});

export default router;
