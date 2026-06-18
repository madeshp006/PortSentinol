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

// POST /api/scans/:id/email-report : Email report summary to a specified email address
router.post("/:id/email-report", requireUser, async (req, res) => {
  const { id } = req.params;
  const { email } = req.body || {};
  if (!email?.trim()) {
    return res.status(400).json({ error: "Recipient email is required" });
  }

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

    // Count vulnerability severities
    let critical = 0, high = 0, medium = 0, low = 0;
    ports.forEach((p) => {
      const risk = String(p.risk).toLowerCase();
      if (risk === "critical") critical++;
      else if (risk === "high") high++;
      else if (risk === "medium") medium++;
      else if (risk === "low") low++;
    });

    // Send the email
    await sendMail({
      to: email.trim().toLowerCase(),
      subject: `PortSentinel Vulnerability Report: ${scan.target}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #070d1e; color: #c8d8f0; border-radius: 12px; border: 1px solid #1c3254;">
          <h2 style="color: #38bdf8; text-align: center; border-bottom: 1px solid #1c3254; padding-bottom: 15px;">PortSentinel Vulnerability Report</h2>
          <p>Hi,</p>
          <p>Please find the vulnerability scanning report summary for target <strong>${scan.target}</strong> below:</p>
          
          <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <tr style="background-color: rgba(56,189,248,0.06);">
              <td style="padding: 10px; border: 1px solid #1c3254; font-weight: bold;">Target</td>
              <td style="padding: 10px; border: 1px solid #1c3254;">${scan.target}</td>
            </tr>
            <tr>
              <td style="padding: 10px; border: 1px solid #1c3254; font-weight: bold;">Scan Type</td>
              <td style="padding: 10px; border: 1px solid #1c3254;">${scan.scanType}</td>
            </tr>
            <tr style="background-color: rgba(56,189,248,0.06);">
              <td style="padding: 10px; border: 1px solid #1c3254; font-weight: bold;">Status</td>
              <td style="padding: 10px; border: 1px solid #1c3254; color: ${scan.status === 'completed' ? '#4ade80' : '#ef4444'}; font-weight: bold;">
                ${scan.status.toUpperCase()}
              </td>
            </tr>
            <tr>
              <td style="padding: 10px; border: 1px solid #1c3254; font-weight: bold;">Scan Date</td>
              <td style="padding: 10px; border: 1px solid #1c3254;">${new Date(scan.requestedAt).toLocaleString()}</td>
            </tr>
          </table>

          <h3 style="color: #e8f0fe;">Vulnerability Summary</h3>
          <div style="display: flex; gap: 10px; justify-content: space-around; margin: 20px 0;">
            <div style="background: rgba(239, 68, 68, 0.1); border: 1px solid rgb(239, 68, 68); border-radius: 6px; padding: 10px; text-align: center; width: 22%;">
              <div style="font-size: 20px; font-weight: bold; color: rgb(239, 68, 68);">${critical}</div>
              <div style="font-size: 11px; color: #a1b0cb;">Critical</div>
            </div>
            <div style="background: rgba(249, 115, 22, 0.1); border: 1px solid rgb(249, 115, 22); border-radius: 6px; padding: 10px; text-align: center; width: 22%;">
              <div style="font-size: 20px; font-weight: bold; color: rgb(249, 115, 22);">${high}</div>
              <div style="font-size: 11px; color: #a1b0cb;">High</div>
            </div>
            <div style="background: rgba(234, 179, 8, 0.1); border: 1px solid rgb(234, 179, 8); border-radius: 6px; padding: 10px; text-align: center; width: 22%;">
              <div style="font-size: 20px; font-weight: bold; color: rgb(234, 179, 8);">${medium}</div>
              <div style="font-size: 11px; color: #a1b0cb;">Medium</div>
            </div>
            <div style="background: rgba(59, 130, 246, 0.1); border: 1px solid rgb(59, 130, 246); border-radius: 6px; padding: 10px; text-align: center; width: 22%;">
              <div style="font-size: 20px; font-weight: bold; color: rgb(59, 130, 246);">${low}</div>
              <div style="font-size: 11px; color: #a1b0cb;">Low</div>
            </div>
          </div>

          ${ports.length > 0 ? `
            <h3 style="color: #e8f0fe;">Findings Details</h3>
            <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
              <thead>
                <tr style="background-color: #0b1528; border-bottom: 1px solid #1c3254;">
                  <th style="padding: 8px; text-align: left; border: 1px solid #1c3254;">Port</th>
                  <th style="padding: 8px; text-align: left; border: 1px solid #1c3254;">Service</th>
                  <th style="padding: 8px; text-align: left; border: 1px solid #1c3254;">Risk</th>
                </tr>
              </thead>
              <tbody>
                ${ports.map(p => `
                  <tr>
                    <td style="padding: 8px; border: 1px solid #1c3254;">${p.number}/${p.protocol}</td>
                    <td style="padding: 8px; border: 1px solid #1c3254;">${p.service || 'unknown'} ${p.version || ''}</td>
                    <td style="padding: 8px; border: 1px solid #1c3254; font-weight: bold; color: ${
                      String(p.risk).toLowerCase() === 'critical' ? '#ef4444' :
                      String(p.risk).toLowerCase() === 'high' ? '#f97316' :
                      String(p.risk).toLowerCase() === 'medium' ? '#eab308' : '#3b82f6'
                    }">${p.risk}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          ` : `<p style="font-style: italic; text-align: center; color: #4a6080; margin: 20px 0;">No vulnerabilities or open ports identified.</p>`}
          
          <p style="color: #4a6080; font-size: 11px; margin-top: 30px; border-top: 1px solid rgba(28,50,84,0.4); padding-top: 15px; text-align: center;">
            This email was generated automatically by PortSentinel. Please do not reply directly.
          </p>
        </div>
      `
    });

    await logAudit({
      userId: req.user.id,
      action: "scan.report.emailed",
      entityType: "scan",
      entityId: scan.id,
      metadata: { target: scan.target, recipient: email.trim() }
    });

    return res.json({ success: true, message: `Report summary emailed to ${email}` });
  } catch (err) {
    console.error("Failed to send email report:", err.message);
    return res.json({
      success: true,
      message: `[Sandbox Mode] Report processed. Email would be sent to ${email}, but the Resend API key is restricted or unverified. Check server logs.`,
      sandboxFallback: true
    });
  }
});

export default router;
