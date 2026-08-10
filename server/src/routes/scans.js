import { Router } from "express";
import { requireUser, requireAnalyst } from "../middleware/auth.js";
import { scanRepository } from "../repositories/scanRepository.js";
import { scanJobRepository } from "../repositories/scanJobRepository.js";
import { agentRepository } from "../repositories/agentRepository.js";
import { serialize, serializeMany } from "../utils/serialize.js";
import { logAudit } from "../services/audit.js";
import { validateAuthorizedTarget } from "../services/scanner/scopeValidator.js";
import { estimateTotalPorts } from "../services/scanner/internalScanner.js";
import { enqueueScan, getQueueState } from "../jobs/scanQueue.js";
import { Parser } from "json2csv";
import { generatePdfReport } from "../utils/pdfGenerator.js";
import { sendMail } from "../utils/mailer.js";

const router = Router();

function displayScanType(scanType) {
  if (scanType === "deep") return "Deep Scan";
  if (scanType === "custom") return "Custom Scan";
  return "Quick Scan";
}

function totalPortsFor(scanType, portRange) {
  return estimateTotalPorts(scanType, portRange);
}

// GET /api/scans : Retrieve scans (scoped by role)
router.get("/", requireUser, async (req, res) => {
  try {
    let scans;
    if (req.user.role === "SUPER_ADMIN" || req.user.role === "SECURITY_ANALYST") {
      scans = await scanRepository.findAll();
    } else {
      scans = await scanRepository.findByUserId(req.user.id);
    }
    return res.json(serializeMany(scans));
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/scans/:id : Retrieve details of a specific scan
router.get("/:id", requireUser, async (req, res) => {
  const { id } = req.params;
  try {
    const scan = await scanRepository.findById(id);
    if (!scan) {
      return res.status(404).json({ error: "Scan not found" });
    }
    if (req.user.role === "USER" && scan.userId !== req.user.id) {
      return res.status(403).json({ error: "Access denied" });
    }
    return res.json(serialize(scan));
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/scans/:id/drift : Surfacing "Changes since last scan"
router.get("/:id/drift", requireUser, async (req, res) => {
  const { id } = req.params;
  try {
    const scan = await scanRepository.findById(id);
    if (!scan) {
      return res.status(404).json({ error: "Scan not found" });
    }
    if (req.user.role === "USER" && scan.userId !== req.user.id) {
      return res.status(403).json({ error: "Access denied" });
    }

    let driftEvents = [];
    if (scan.driftEvents) {
      driftEvents = typeof scan.driftEvents === "string"
        ? JSON.parse(scan.driftEvents)
        : (Array.isArray(scan.driftEvents) ? scan.driftEvents : []);
    }

    return res.json({
      scanId: scan.id,
      target: scan.target,
      requestedAt: scan.requestedAt,
      finishedAt: scan.finishedAt,
      totalDriftEvents: driftEvents.length,
      driftEvents,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/scans : Save scan result directly (usually for offline imports)
router.post("/", requireUser, async (req, res) => {
  const payload = req.body || {};
  try {
    const scan = await scanRepository.create({
      ...payload,
      userId: req.user.id,
      savedAt: payload.savedAt || new Date(),
      timestamp: payload.timestamp || new Date(),
      requestedAt: payload.requestedAt || new Date(),
    });
    return res.status(201).json(serialize(scan));
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/scans/create : Create and queue a scan job (equivalent to startScan)
router.post("/create", requireUser, async (req, res) => {
  const { target, scanType = "quick", portRange = "", agentId } = req.body || {};
  if (!target?.trim()) {
    return res.status(400).json({ error: "Target is required" });
  }

  const scope = validateAuthorizedTarget(target);
  if (!scope.allowed) {
    await logAudit({
      userId: req.user.id,
      action: "scan.blocked",
      entityType: "scan",
      metadata: { target, reason: scope.reason },
    });
    return res.status(403).json({ error: scope.reason, scopeStatus: scope.scopeStatus });
  }

  let selectedAgent = null;
  const normalizedTarget = scope.normalizedTarget || target.trim();

  const scannerMode = String(process.env.INTERNAL_SCANNER_MODE || "local").toLowerCase();
  // Validate agent requirements if scanning private networks (only when in agent mode)
  if (scope.isPrivate && scannerMode === "agent") {
    if (!agentId) {
      return res.status(400).json({
        error: "Private network scanning requires an active PortSentinel Agent",
        privateTarget: true
      });
    }

    selectedAgent = await agentRepository.findById(agentId);
    if (!selectedAgent) {
      selectedAgent = await agentRepository.findByAgentId(agentId);
    }

    if (!selectedAgent) {
      return res.status(404).json({ error: "Selected agent not found" });
    }

    if (req.user.role === "USER" && selectedAgent.userId !== req.user.id) {
      return res.status(403).json({ error: "Access denied to selected agent" });
    }

    if (selectedAgent.status === "offline") {
      return res.status(400).json({ error: `Selected agent "${selectedAgent.name}" is offline` });
    }
  }

  // Create scan Job if using agent
  let scanJob = null;
  if (selectedAgent) {
    scanJob = await scanJobRepository.create({
      target: normalizedTarget,
      scanType: displayScanType(scanType),
      portRange,
      status: "pending",
      agentId: selectedAgent.id,
      userId: req.user.id,
    });
  }

  const scan = await scanRepository.create({
    userId: req.user.id,
    target: normalizedTarget,
    scanType: displayScanType(scanType),
    portRange,
    totalPorts: totalPortsFor(scanType, portRange),
    status: "queued",
    progress: 0,
    scopeStatus: scope.scopeStatus,
    workerMode: selectedAgent ? "agent" : "local",
    agentId: selectedAgent ? selectedAgent.id : null,
    scanJobId: scanJob ? scanJob.id : null,
    currentStage: "queued",
    timeline: [
      { at: new Date(), level: "info", msg: "Scan request accepted" },
      { at: new Date(), level: "info", msg: selectedAgent
        ? `Queued for execution on Agent "${selectedAgent.name}"`
        : "Queued for local worker execution"
      },
    ],
    requestedAt: new Date(),
    savedAt: new Date(),
    timestamp: new Date(),
  });

  await logAudit({
    userId: req.user.id,
    action: "scan.queued",
    entityType: "scan",
    entityId: scan.id,
    metadata: { target: scan.target, scanType: scan.scanType, workerMode: scan.workerMode },
  });

  // If local scan, enqueue in server's local scan queue
  if (!selectedAgent) {
    enqueueScan(scan.id);
  }

  return res.status(202).json({ scan: serialize(scan), queue: getQueueState() });
});

// POST /api/scans/:id/cancel : Cancel a running scan
router.post("/:id/cancel", requireUser, async (req, res) => {
  const { id } = req.params;
  try {
    const scan = await scanRepository.findById(id);
    if (!scan) {
      return res.status(404).json({ error: "Scan not found" });
    }
    if (req.user.role === "USER" && scan.userId !== req.user.id) {
      return res.status(403).json({ error: "Access denied" });
    }

    if (!["queued", "running"].includes(scan.status)) {
      return res.status(400).json({ error: "Only queued or running scans can be cancelled" });
    }

    await scanRepository.appendTimeline(id, {
      at: new Date(),
      level: "warning",
      msg: "Cancellation requested by user"
    }, {
      cancelRequested: true
    });

    if (scan.scanJobId) {
      await scanJobRepository.update(scan.scanJobId, {
        status: "failed",
        result: { error: "Cancelled by user" }
      });
    }

    await logAudit({
      userId: req.user.id,
      action: "scan.cancel.requested",
      entityType: "scan",
      entityId: scan.id,
      metadata: { target: scan.target },
    });

    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// DELETE /api/scans/:id : Delete a scan (standard users delete own scans, admins delete any)
router.delete("/:id", requireUser, async (req, res) => {
  const { id } = req.params;
  try {
    const scan = await scanRepository.findById(id);
    if (!scan) {
      return res.status(404).json({ error: "Scan not found" });
    }

    if (req.user.role === "SUPER_ADMIN") {
      await scanRepository.deleteGlobal(id);
    } else if (req.user.role === "USER" && scan.userId === req.user.id) {
      await scanRepository.delete(id, req.user.id);
    } else {
      return res.status(403).json({ error: "Access denied. Only the owner or an administrator can delete this scan." });
    }

    await logAudit({
      userId: req.user.id,
      action: "scan.deleted",
      entityType: "scan",
      entityId: id,
    });
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ─── EXPORT ENDPOINT METHODS ──────────────────────────────────────────────

// GET /api/scans/:id/export/pdf : Export report to PDF
router.get("/:id/export/pdf", requireUser, async (req, res) => {
  const { id } = req.params;
  try {
    const scan = await scanRepository.findById(id);
    if (!scan) {
      return res.status(404).json({ error: "Scan not found" });
    }
    if (req.user.role === "USER" && scan.userId !== req.user.id) {
      return res.status(403).json({ error: "Access denied" });
    }

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=PortSentinel_Report_${scan.target.replace(/[^a-zA-Z0-9]/g, "_")}_${new Date().toISOString().split("T")[0]}.pdf`
    );

    return generatePdfReport(scan, res);
  } catch (err) {
    return res.status(500).json({ error: "Failed to generate PDF: " + err.message });
  }
});

// GET /api/scans/:id/export/csv : Export report to CSV
router.get("/:id/export/csv", requireUser, async (req, res) => {
  const { id } = req.params;
  try {
    const scan = await scanRepository.findById(id);
    if (!scan) {
      return res.status(404).json({ error: "Scan not found" });
    }
    if (req.user.role === "USER" && scan.userId !== req.user.id) {
      return res.status(403).json({ error: "Access denied" });
    }

    let ports = [];
    if (scan.ports) {
      ports = typeof scan.ports === "string" ? JSON.parse(scan.ports) : scan.ports;
    }

    const fields = ["number", "protocol", "service", "version", "state", "risk", "description", "fix"];
    const parser = new Parser({ fields });
    const csv = parser.parse(ports);

    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=PortSentinel_Report_${scan.target.replace(/[^a-zA-Z0-9]/g, "_")}_${new Date().toISOString().split("T")[0]}.csv`
    );

    return res.send(csv);
  } catch (err) {
    return res.status(500).json({ error: "Failed to generate CSV: " + err.message });
  }
});

// GET /api/scans/:id/export/json : Export report to JSON
router.get("/:id/export/json", requireUser, async (req, res) => {
  const { id } = req.params;
  try {
    const scan = await scanRepository.findById(id);
    if (!scan) {
      return res.status(404).json({ error: "Scan not found" });
    }
    if (req.user.role === "USER" && scan.userId !== req.user.id) {
      return res.status(403).json({ error: "Access denied" });
    }

    res.setHeader("Content-Type", "application/json");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=PortSentinel_Report_${scan.target.replace(/[^a-zA-Z0-9]/g, "_")}_${new Date().toISOString().split("T")[0]}.json`
    );

    return res.json(serialize(scan));
  } catch (err) {
    return res.status(500).json({ error: "Failed to generate JSON: " + err.message });
  }
});

// POST /api/scans/:id/email-report : Disabled / Removed
router.post("/:id/email-report", requireUser, async (req, res) => {
  return res.status(410).json({ error: "Emailing reports has been disabled." });
});

export default router;
