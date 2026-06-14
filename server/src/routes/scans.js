import { Router } from "express";
import { authRequired } from "../middleware/auth.js";
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

const router = Router();

function displayScanType(scanType) {
  if (scanType === "deep") return "Deep Scan";
  if (scanType === "custom") return "Custom Scan";
  return "Quick Scan";
}

function totalPortsFor(scanType, portRange) {
  return estimateTotalPorts(scanType, portRange);
}

// GET /api/scans : Retrieve all scans for the user
router.get("/", authRequired, async (req, res) => {
  const scans = await scanRepository.findByUserId(req.auth.userId);
  return res.json(serializeMany(scans));
});

// GET /api/scans/:id : Retrieve details of a specific scan
router.get("/:id", authRequired, async (req, res) => {
  const { id } = req.params;
  const scan = await scanRepository.findById(id);
  if (!scan || scan.userId !== req.auth.userId) {
    return res.status(404).json({ error: "Scan not found" });
  }
  return res.json(serialize(scan));
});

// POST /api/scans : Save scan result directly (usually for offline imports)
router.post("/", authRequired, async (req, res) => {
  const payload = req.body || {};
  const scan = await scanRepository.create({
    ...payload,
    userId: req.auth.userId,
    savedAt: payload.savedAt || new Date(),
    timestamp: payload.timestamp || new Date(),
    requestedAt: payload.requestedAt || new Date(),
  });
  return res.status(201).json(serialize(scan));
});

// POST /api/scans/create : Create and queue a scan job (equivalent to startScan)
router.post("/create", authRequired, async (req, res) => {
  const { target, scanType = "quick", portRange = "", agentId } = req.body || {};
  if (!target?.trim()) {
    return res.status(400).json({ error: "Target is required" });
  }

  const scope = validateAuthorizedTarget(target);
  if (!scope.allowed) {
    await logAudit({
      userId: req.auth.userId,
      action: "scan.blocked",
      entityType: "scan",
      metadata: { target, reason: scope.reason },
    });
    return res.status(403).json({ error: scope.reason, scopeStatus: scope.scopeStatus });
  }

  let selectedAgent = null;
  const normalizedTarget = scope.normalizedTarget || target.trim();

  // Validate agent requirements if scanning private networks
  if (scope.isPrivate) {
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

    if (!selectedAgent || selectedAgent.userId !== req.auth.userId) {
      return res.status(404).json({ error: "Selected agent not found" });
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
      userId: req.auth.userId,
    });
  }

  const scan = await scanRepository.create({
    userId: req.auth.userId,
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
    userId: req.auth.userId,
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
router.post("/:id/cancel", authRequired, async (req, res) => {
  const { id } = req.params;
  const scan = await scanRepository.findById(id);
  if (!scan || scan.userId !== req.auth.userId) {
    return res.status(404).json({ error: "Scan not found" });
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
    userId: req.auth.userId,
    action: "scan.cancel.requested",
    entityType: "scan",
    entityId: scan.id,
    metadata: { target: scan.target },
  });

  return res.json({ success: true });
});

// DELETE /api/scans/:id : Delete a scan
router.delete("/:id", authRequired, async (req, res) => {
  const { id } = req.params;
  const scan = await scanRepository.findById(id);
  if (!scan || scan.userId !== req.auth.userId) {
    return res.status(404).json({ error: "Scan not found" });
  }
  await scanRepository.delete(id, req.auth.userId);
  await logAudit({
    userId: req.auth.userId,
    action: "scan.deleted",
    entityType: "scan",
    entityId: id,
  });
  return res.json({ success: true });
});

// ─── EXPORT ENPOINT METHODS ──────────────────────────────────────────────

// GET /api/scans/:id/export/pdf : Export report to PDF
router.get("/:id/export/pdf", authRequired, async (req, res) => {
  const { id } = req.params;
  try {
    const scan = await scanRepository.findById(id);
    if (!scan || scan.userId !== req.auth.userId) {
      return res.status(404).json({ error: "Scan not found" });
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
router.get("/:id/export/csv", authRequired, async (req, res) => {
  const { id } = req.params;
  try {
    const scan = await scanRepository.findById(id);
    if (!scan || scan.userId !== req.auth.userId) {
      return res.status(404).json({ error: "Scan not found" });
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
router.get("/:id/export/json", authRequired, async (req, res) => {
  const { id } = req.params;
  try {
    const scan = await scanRepository.findById(id);
    if (!scan || scan.userId !== req.auth.userId) {
      return res.status(404).json({ error: "Scan not found" });
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

export default router;
