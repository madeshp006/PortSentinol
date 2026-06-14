import { scanRepository } from "../repositories/scanRepository.js";
import { alertRepository } from "../repositories/alertRepository.js";
import { logAudit } from "../services/audit.js";
import { summarizeScan } from "../services/scanner/findings.js";
import { runInternalScannerJob } from "../services/scanner/internalScanner.js";
import { emitToUser } from "../services/socketManager.js";

const queue = [];
let processing = false;

function makeEvent(msg, level = "info") {
  return { at: new Date(), msg, level };
}

async function appendTimeline(scanId, msg, level = "info", extra = {}) {
  const event = makeEvent(msg, level);
  const scan = await scanRepository.appendTimeline(scanId, event, extra);
  if (scan) {
    emitToUser(scan.userId, "scan:progress", {
      scanId,
      progress: scan.progress,
      currentStage: scan.currentStage,
      msg,
      timeline: scan.timeline,
    });
  }
}

async function isCancelled(scanId) {
  const scan = await scanRepository.findById(scanId);
  return !scan || scan.cancelRequested || scan.status === "cancelled";
}

function toEngineScanType(scanType) {
  const normalized = String(scanType || "").toLowerCase();
  if (normalized.includes("deep")) return "deep";
  if (normalized.includes("custom")) return "custom";
  return "quick";
}

function displayScanType(scanType) {
  if (scanType === "deep" || String(scanType).toLowerCase().includes("deep")) return "Deep Scan";
  if (scanType === "custom" || String(scanType).toLowerCase().includes("custom")) return "Custom Scan";
  return "Quick Scan";
}

async function runScan(scanId) {
  const scan = await scanRepository.findById(scanId);
  if (!scan) return;
  if (scan.status !== "queued") return;

  await scanRepository.update(scanId, {
    status: "running",
    progress: 5,
    startedAt: new Date(),
    currentStage: "queued",
  });
  await appendTimeline(scanId, "Worker picked up the scan job");

  try {
    const rawResult = await runInternalScannerJob({
      target: scan.target,
      scanType: toEngineScanType(scan.scanType),
      portRange: scan.portRange || "",
      onProgress: async ({ progress, stage, msg }) => {
        if (await isCancelled(scanId)) {
          throw new Error("Scan cancelled by user");
        }
        await appendTimeline(scanId, msg, "info", {
          progress,
          currentStage: stage,
        });
      },
    });

    if (await isCancelled(scanId)) {
      await scanRepository.update(scanId, {
        status: "cancelled",
        progress: 100,
        finishedAt: new Date(),
        currentStage: "cancelled",
        errorMessage: "Scan cancelled by user",
      });
      await appendTimeline(scanId, "Scan cancelled by user", "warning");
      emitToUser(scan.userId, "scan:failed", { scanId, error: "Scan cancelled by user" });
      return;
    }

    const summary = summarizeScan({ ...rawResult, target: scan.target });
    const savedAt = new Date();

    await scanRepository.update(scanId, {
      ...summary,
      scanType: displayScanType(rawResult.scanType || scan.scanType),
      status: "completed",
      progress: 100,
      workerMode: rawResult.workerMode || "local",
      finishedAt: savedAt,
      savedAt,
      timestamp: savedAt,
      currentStage: "completed",
      errorMessage: "",
    });
    await appendTimeline(scanId, "Scan complete. Report saved to history.", "success");

    const latest = await scanRepository.findById(scanId);
    if (latest) {
      let misconfigs = [];
      if (latest.misconfigs) {
        misconfigs = typeof latest.misconfigs === "string"
          ? JSON.parse(latest.misconfigs)
          : (Array.isArray(latest.misconfigs) ? latest.misconfigs : []);
      }
      const top = misconfigs.slice().sort((a, b) => {
        const order = { critical: 0, high: 1, medium: 2, low: 3 };
        return (order[a.risk] ?? 9) - (order[b.risk] ?? 9);
      })[0];

      const alert = await alertRepository.create({
        userId: latest.userId,
        title: top ? `${String(top.risk || "info").toUpperCase()} finding detected` : "Scan finished",
        message: top
          ? `${top.title} on ${latest.target}`
          : `Scan completed for ${latest.target} with no major misconfigurations detected.`,
        risk: top?.risk || "info",
        metadata: { scanId: latest.id },
      });

      emitToUser(latest.userId, "alert:new", alert);
      emitToUser(latest.userId, "scan:completed", { scanId, scan: latest });

      await logAudit({
        userId: latest.userId,
        action: "scan.completed",
        entityType: "scan",
        entityId: latest.id,
        metadata: { target: latest.target, status: latest.status, openPorts: latest.openPorts },
      });
    }
  } catch (error) {
    const cancelled = String(error.message || "").toLowerCase().includes("cancelled");
    await scanRepository.update(scanId, {
      status: cancelled ? "cancelled" : "failed",
      progress: 100,
      finishedAt: new Date(),
      currentStage: cancelled ? "cancelled" : "failed",
      errorMessage: error.message || "Scan failed",
    });
    await appendTimeline(scanId, cancelled ? "Scan cancelled by user" : `Scan failed: ${error.message || "Unknown error"}`, cancelled ? "warning" : "error");

    emitToUser(scan.userId, "scan:failed", { scanId, error: error.message || "Scan failed" });

    await logAudit({
      userId: scan.userId,
      action: cancelled ? "scan.cancelled" : "scan.failed",
      entityType: "scan",
      entityId: scan.id,
      metadata: { target: scan.target, error: error.message || "Scan failed" },
    });
  }
}

async function processQueue() {
  if (processing) return;
  processing = true;
  try {
    while (queue.length > 0) {
      const nextId = queue.shift();
      await runScan(nextId);
    }
  } finally {
    processing = false;
  }
}

export function enqueueScan(scanId) {
  if (!queue.includes(scanId)) {
    queue.push(scanId);
  }
  void processQueue();
}

export function getQueueState() {
  return {
    queued: queue.length,
    processing,
  };
}
