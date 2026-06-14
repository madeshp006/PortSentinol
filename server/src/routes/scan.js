import { Router } from "express";
import { authRequired } from "../middleware/auth.js";
import { scanRepository } from "../repositories/scanRepository.js";
import { agentRepository } from "../repositories/agentRepository.js";
import { scanJobRepository } from "../repositories/scanJobRepository.js";
import { serialize } from "../utils/serialize.js";
import { logAudit } from "../services/audit.js";
import { validateAuthorizedTarget } from "../services/scanner/scopeValidator.js";
import { estimateTotalPorts } from "../services/scanner/internalScanner.js";
import { enqueueScan, getQueueState } from "../jobs/scanQueue.js";

const router = Router();

function displayScanType(scanType) {
  if (scanType === "deep") return "Deep Scan";
  if (scanType === "custom") return "Custom Scan";
  return "Quick Scan";
}

function totalPortsFor(scanType, portRange) {
  return estimateTotalPorts(scanType, portRange);
}

router.post("/start", authRequired, async (req, res) => {
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

  // If target is private, check if agent is specified and active
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

router.get("/queue-state", authRequired, async (_req, res) => {
  return res.json(getQueueState());
});

router.post("/stream", authRequired, async (_req, res) => {
  return res.status(410).json({
    error: "Streaming scans are no longer used in this build. Start a job with POST /api/scan/start and poll /api/scans/:id.",
  });
});

export default router;
